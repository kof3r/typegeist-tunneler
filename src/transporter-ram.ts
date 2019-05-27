
import { Transporter } from './transporter';

export function createRamTransporter(): Transporter {
  const listeners: { [key: string]: (msg: any) => void } = {};
  return {
    receive(queue: string, handler: (msg: any) => void, options?: { durable: boolean, autoDelete: boolean }): void {
      listeners[queue] = handler;
    },
    send(queue: string, message: any, options?: { expiration: number }): boolean {
      if (queue in listeners) {
        listeners[queue](message);
        return true;
      }
      return false;
    }
  };
}
