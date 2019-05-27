
import amqp from 'amqplib';
import { Transporter } from './transporter';

export async function createAmqpTransporter({ amqpUrl }: { amqpUrl: string }): Promise<Transporter> {
  const conn = await amqp.connect(amqpUrl);
  const chan = await conn.createChannel();

  return {
    async receive(queue: string, handler: (msg: any) => void, options?: { durable: boolean, autoDelete: boolean }): Promise<void> {
      await chan.assertQueue(queue, options);

      await chan.consume(queue, async msg => {
        if (!msg) { return; }

        const message = JSON.parse(msg.content.toString());
        await handler(message);
        chan.ack(msg);
      });
    },
    send(queue: string, message: any, options?: { expiration: number }): boolean {
      return chan.sendToQueue(queue, Buffer.from(JSON.stringify(message)), options);
    }
  }
}
