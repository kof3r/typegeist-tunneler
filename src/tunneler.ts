
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
  data?: any
  rq: string
}

interface TunnelerResponse {
  cid: string
  res?: any
  err?: any
}

export async function createTunneler({ transporter, name }: TunnelerConfig) : Promise<Tunneler> {
  let listening = false;
  const messageHandlers: MessageHandlerMap = {};
  const serviceTunnels: { [service: string]: ServiceTunnel } = {};
  
  const promiseMap = createPromiseMap();
  const responseQueue = `resQ::${name}/${uuid.v4()}`;

  await transporter.receive(responseQueue, (response: TunnelerResponse) => {
    const { cid, err, res } = response;
    if (err) {
      promiseMap.reject(cid, err);
    } else {
      promiseMap.resolve(cid, res);
    }
  }, { durable: false, autoDelete: true });

  return {
    async handleMessages(handlers: MessageHandlerMap) {
      Object.assign(messageHandlers, handlers);

      if (listening) {
        return;
      }
      listening = true;

      await transporter.receive(name, async (sm: ServiceMessage) => {
        const { cid, type, data } = sm;

        const tr: TunnelerResponse = { cid };

        if (type in messageHandlers) {
          try {
            tr.res = await messageHandlers[type](data)
          } catch(error) {
            tr.err = error;
          }
        } else {
          tr.err = { type: 'unknown-procedure', procedure: type };
        }

        transporter.send(sm.rq, tr);
      });
    },
    async createServiceTunnel(service): Promise<ServiceTunnel> {
      if (service in serviceTunnels) {
        return serviceTunnels[service];
      }

      const serviceTunnel : ServiceTunnel = {
        send(type, data) {
          const cid = uuid.v4();

          const message: ServiceMessage = {
            rq: responseQueue,
            cid,
            type,
            data,
          };

          const promise = promiseMap.create(cid);

          transporter.send(service, message, { expiration: 30000 });

          return promise;
        },
        getPendingRequestCount() {
          return promiseMap.length;
        }
      };
      serviceTunnels[service] = serviceTunnel;

      return serviceTunnel;
    },
  };
}
