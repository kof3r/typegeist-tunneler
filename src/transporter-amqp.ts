
import amqp, { Channel } from 'amqplib';
import { Transporter } from './transporter';

export async function createAmqpTransporter({ amqpUrl }: { amqpUrl: string }): Promise<Transporter> {
  let chan: Channel | null = null;
  const receiveHandlerMap: { [queue: string]: { handler: (msg: any) => void, options?: { durable: boolean, autoDelete: boolean } } } = {};

  async function createChannel() {
    chan = null;
    try {
      const conn = await amqp.connect(amqpUrl);
      conn.on('close', (err) => {
        chan = null;
        setTimeout(createChannel, 5000);
      });
      chan = await conn.createChannel();
      await receiveMessages();
    } catch (error) {
      chan = null;
      setTimeout(createChannel, 5000);
    }
  }

  async function receiveMessages() {
    for (const queue in receiveHandlerMap) {
      const { handler, options } = receiveHandlerMap[queue];
      if (chan === null) return;
      await chan.assertQueue(queue, options);

      await chan.consume(queue, async msg => {
        if (!msg) { return; }

        const message = JSON.parse(msg.content.toString());
        await handler(message);

        if (chan === null) return;
        chan.ack(msg);
      });
    }
  }

  setTimeout(createChannel, 0);

  return {
    async receive(queue: string, handler: (msg: any) => void, options?: { durable: boolean, autoDelete: boolean }): Promise<void> {
      receiveHandlerMap[queue] = { handler, options: options }
    },
    send(queue: string, message: any, options?: { expiration: number }): boolean {
      if (!chan) {
        throw new Error('tunneler/disconnected');
      }
      return chan.sendToQueue(queue, Buffer.from(JSON.stringify(message)), options);
    }
  }
}
