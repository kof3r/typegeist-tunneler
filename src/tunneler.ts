
import uuid from 'uuid';
import { createPromiseMap } from './promise-map';
import { Transporter } from './transporter';

type MessageHandler = (payload: any) => any;

type MessageHandlerMap = { [key: string]: MessageHandler }

interface TunnelerConfig {
  transporter: Transporter
  name: string
}

export interface ServiceTunnel {
  send(type: string, payload?: any): Promise<any>
  getPendingRequestCount(): number,
}

export interface Tunneler {
  handleMessages(handlers: MessageHandlerMap): Promise<void>,
  createServiceTunnel(serviceQueue: string): Promise<ServiceTunnel>,
}

interface ServiceMessage {
  cid: string
  type: string
  payload?: any
  responseQueue: string
}

interface TunnelerResponse {
  cid: string
  response?: any
  error?: any
}

export async function createTunneler({ transporter, name }: TunnelerConfig) : Promise<Tunneler> {
  let listening = false;
  const messageHandlers: MessageHandlerMap = {};
  const serviceTunnels: { [service: string]: ServiceTunnel } = {};

  return {
    async handleMessages(handlers: MessageHandlerMap) {
      Object.assign(messageHandlers, handlers);

      if (listening) { return; }
      listening = true;

      await transporter.receive(name, async (sm: ServiceMessage) => {
        const { cid, type, payload } = sm;
        const tr: TunnelerResponse = { cid };
        if (type in messageHandlers) {
          try {
            tr.response = await messageHandlers[type](payload)
          } catch(error) {
            tr.error = error;
          }
        } else {
          tr.error = { type: 'unknown-procedure', procedure: type };
        }
        transporter.send(sm.responseQueue, tr);
      });
    },
    async createServiceTunnel(service): Promise<ServiceTunnel> {
      if (service in serviceTunnels) {
        return serviceTunnels[service];
      }
      const promiseMap = createPromiseMap();
      const responseQueue = `${service}::${name}/${uuid.v4()}`;

      const serviceTunnel : ServiceTunnel = {
        send(type, payload) {
          const message: ServiceMessage = { cid: uuid.v4(), type, payload, responseQueue };
          const promise = promiseMap.create(message.cid);
          transporter.send(service, message, { expiration: 30000 });
          return promise;
        },
        getPendingRequestCount() {
          return promiseMap.length;
        }
      };
      serviceTunnels[service] = serviceTunnel;

      await transporter.receive(responseQueue, (res: TunnelerResponse) => {
        const { cid, error, response } = res;
        if (error) {
          promiseMap.reject(cid, error);
        } else {
          promiseMap.resolve(cid, response);
        }
      }, { durable: false, autoDelete: true });

      return serviceTunnel;
    },
  };
}
