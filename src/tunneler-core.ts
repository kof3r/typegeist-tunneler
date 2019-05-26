
export type MessageHandler = (payload: any) => any;

export type MessageHandlerMap = { [key: string]: MessageHandler }

export interface TunnelerMessage {
  cid: string
  type: string
  payload?: any
}

export interface TunnelerResponse {
  cid: string
  response?: any
  error?: any
}

export interface TunnelerCore {
  handleMessage(msg: TunnelerMessage): Promise<TunnelerResponse>
}

export interface ServiceTunnelCore {
  createResponsePromise(msg: TunnelerMessage): Promise<any>
  handleTunnelerResponse(res: TunnelerResponse): void
}

export function createTunnelerCore(handlers: MessageHandlerMap) : TunnelerCore {
  return {
    async handleMessage(msg: TunnelerMessage): Promise<TunnelerResponse> {
      const { cid, type, payload } = msg;
      let message: TunnelerResponse = { cid };
      if (type in handlers) {
        try {
          const response = await handlers[type](payload)
          message.response = response;
        } catch(error) {
          message.error = error;
        }
        return message;
      }
      message.error = { type: 'unknown-procedure', procedure: type };
      return message
    }
  }
}

export function createServiceTunnelCore() : ServiceTunnelCore {
  const resolutions: { [cid: string]: { resolve(result: any): void, reject(error: any): void } } = {};

  return {
    createResponsePromise(msg: TunnelerMessage): Promise<any> {
      const promise = new Promise((resolve, reject) => {
        resolutions[msg.cid] = { resolve, reject };
      });
      return promise;
    },
    handleTunnelerResponse(res: TunnelerResponse): void {
      const { cid, response, error } = res;
      if (cid in resolutions) {
        if (error) {
          resolutions[cid].reject(error);
        } else {
          resolutions[cid].resolve(response);
        }
        delete resolutions[cid];
      }
    }
  };
}
