
import { createAmqpTransporter } from './transporter-amqp';
import { createTunneler } from './tunneler';

export async function createAmqpTunneler(name: string, amqpUrl: string) {
  const transporter = await createAmqpTransporter({ amqpUrl });
  return createTunneler({ transporter, name });
}
