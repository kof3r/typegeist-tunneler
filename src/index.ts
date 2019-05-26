
import amqp from 'amqplib';
import uuid from 'uuid';

interface TunnelerConfig {
  amqpUrl: string
  name: string
}

type MessageHandler = (payload: any) => any;

type MessageHandlerMap = { [key: string]: MessageHandler }

interface ServiceTunnel {
  send(type: string, payload: any): Promise<any>
}

interface Tunneler {
  handleMessages(handlers: MessageHandlerMap): Promise<void>,
  createServiceTunnel(serviceQueue: string): Promise<ServiceTunnel>
}

interface ServiceMessage {
  cid: string
  type: string
  payload?: any
  responseQueue: string
}

interface ServiceResponse {
  cid: string
  response?: any
  error?: any
}

export async function createTunneler({ amqpUrl, name }: TunnelerConfig) : Promise<Tunneler> {
  const conn = await amqp.connect(amqpUrl);
  const chan = await conn.createChannel();

  return {
    async handleMessages(handlers: MessageHandlerMap) {
      await chan.assertQueue(name);

      chan.consume(name, async (msg) => {
        if (!msg) { return; }

        const { cid, type, payload, responseQueue } = JSON.parse(msg.content.toString()) as ServiceMessage;
        if (type in handlers) {
          let message: ServiceResponse;
          try {
            const response = await handlers[type](payload)
            message  = { cid, response };
          } catch(error) {
            message = { cid, error };
          }
          chan.sendToQueue(responseQueue, Buffer.from(JSON.stringify(message)));
        }
        chan.ack(msg);
      });
    },
    async createServiceTunnel(serviceQueue): Promise<ServiceTunnel> {
      const responseQueue = `${serviceQueue}::${name}/${uuid.v4()}`;
      const resolveMap: { [cid: string]: { resolve(result: any): void, reject(error: any): void } } = {};

      await Promise.all([
        chan.assertQueue(responseQueue, { durable: false, autoDelete: true }),
        chan.assertQueue(serviceQueue),
      ]);

      chan.consume(responseQueue, msg => {
        if (!msg) { return; }

        const { cid, response, error } = <ServiceResponse>JSON.parse(msg.content.toString());
        if (cid in resolveMap) {
          if (error) {
            resolveMap[cid].reject(error);
          } else {
            resolveMap[cid].resolve(response);
          }
          delete resolveMap[cid];
        }
        chan.ack(msg);
      });

      return {
        send(type, payload) {
          const cid = uuid.v4();
          const promise = new Promise((resolve, reject) => {
            resolveMap[cid] = { resolve, reject };
          });
          const message: ServiceMessage = { cid, type, payload, responseQueue };
          chan.sendToQueue(serviceQueue, Buffer.from(JSON.stringify(message)), { expiration: 30000 });
          return promise;
        }
      };
    },
  };
}
