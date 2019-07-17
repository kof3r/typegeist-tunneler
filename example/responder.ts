
import { createAmqpTunneler } from '../src/index';

async function run() {
  const tunneler = await createAmqpTunneler('res', 'amqp://localhost:5672');

  tunneler.handleMessages({
    req: a => a * a,
  });
}

run();
