
import uuid from 'uuid';

import { createTunnelerCore, createServiceTunnelCore, TunnelerResponse, MessageHandlerMap, TunnelerMessage, TunnelerCore } from './tunneler-core';
import { createAmqpTransporter, Transporter } from './amqp-transporter';

interface TunnelerConfig {
  transporter: Transporter
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

async function createTunneler({ transporter, name }: TunnelerConfig) : Promise<Tunneler> {
  let tunnelerCore: TunnelerCore;
  const messageHandlers: MessageHandlerMap = {};
  const serviceTunnels: { [service: string]: ServiceTunnel } = {};

  return {
    async handleMessages(handlers: MessageHandlerMap) {
      Object.assign(messageHandlers, handlers);
      if (tunnelerCore) { return; }
      tunnelerCore = createTunnelerCore(messageHandlers);

      await transporter.receive(name, async (msg: ServiceMessage) => {
        const response = await tunnelerCore.handleMessage(msg);
        transporter.send(msg.responseQueue, response);
      });
    },
    async createServiceTunnel(service): Promise<ServiceTunnel> {
      if (service in serviceTunnels) {
        return serviceTunnels[service];
      }
      const responseQueue = `${service}::${name}/${uuid.v4()}`;
      const serviceTunnelCore = createServiceTunnelCore();

      const serviceTunnel : ServiceTunnel = {
        send(type, payload) {
          const message: ServiceMessage = { cid: uuid.v4(), type, payload, responseQueue };
          const promise = serviceTunnelCore.createResponsePromise(message);
          transporter.send(service, message, { expiration: 30000 });
          return promise;
        }
      };
      serviceTunnels[service] = serviceTunnel;

      await transporter.receive(responseQueue, (res: TunnelerResponse) => {
        serviceTunnelCore.handleTunnelerResponse(res);
      }, { durable: false, autoDelete: true });

      return serviceTunnel;
    },
  };
}

export async function createAmqpTunneler(name: string, amqpUrl: string) {
  const transporter = await createAmqpTransporter({ amqpUrl });
  return createTunneler({ transporter, name });
}
