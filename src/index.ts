
import amqp from 'amqplib';
import uuid from 'uuid';

import { createTunnelerCore, createServiceTunnelCore, TunnelerResponse, MessageHandlerMap, TunnelerMessage, TunnelerCore } from './tunneler-core';

interface TunnelerConfig {
  amqpUrl: string
  name: string
}

interface ServiceTunnel {
  send(type: string, payload: any): Promise<any>
}

interface Tunneler {
  handleMessages(handlers: MessageHandlerMap): Promise<void>,
  createServiceTunnel(serviceQueue: string): Promise<ServiceTunnel>
}

interface ServiceMessage extends TunnelerMessage {
  responseQueue: string
}

export async function createTunneler({ amqpUrl, name }: TunnelerConfig) : Promise<Tunneler> {
  const conn = await amqp.connect(amqpUrl);
  const chan = await conn.createChannel();
  let tunnelerCore: TunnelerCore;
  const messageHandlers: MessageHandlerMap = {};
  const serviceTunnels: { [service: string]: ServiceTunnel } = {};

  return {
    async handleMessages(handlers: MessageHandlerMap) {
      Object.assign(messageHandlers, handlers);
      if (tunnelerCore) {
        return;
      }

      tunnelerCore = createTunnelerCore(messageHandlers);

      await chan.assertQueue(name);

      chan.consume(name, async (msg) => {
        if (!msg) { return; }

        const message = JSON.parse(msg.content.toString()) as ServiceMessage;
        const response = await tunnelerCore.handleMessage(message);
        chan.sendToQueue(message.responseQueue, Buffer.from(JSON.stringify(response)));
        chan.ack(msg);
      });
    },
    async createServiceTunnel(serviceQueue): Promise<ServiceTunnel> {
      if (serviceQueue in serviceTunnels) {
        return serviceTunnels[serviceQueue];
      }
      const responseQueue = `${serviceQueue}::${name}/${uuid.v4()}`;

      const serviceTunnelCore = createServiceTunnelCore();

      const serviceTunnel : ServiceTunnel = {
        send(type, payload) {
          const message: ServiceMessage = { cid: uuid.v4(), type, payload, responseQueue };
          const promise = serviceTunnelCore.createResponsePromise(message);
          chan.sendToQueue(serviceQueue, Buffer.from(JSON.stringify(message)), { expiration: 30000 });
          return promise;
        }
      };
      serviceTunnels[serviceQueue] = serviceTunnel;

      await Promise.all([
        chan.assertQueue(responseQueue, { durable: false, autoDelete: true }),
        chan.assertQueue(serviceQueue),
      ]);

      await chan.consume(responseQueue, msg => {
        if (!msg) { return; }

        const res = JSON.parse(msg.content.toString()) as TunnelerResponse;
        serviceTunnelCore.handleTunnelerResponse(res);
        chan.ack(msg);
      });

      return serviceTunnel;
    },
  };
}
