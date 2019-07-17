
import { createAmqpTunneler } from '../src/index';

async function run() {
  const tunneler = await createAmqpTunneler('req', 'amqp://localhost:5672');
  const service = await tunneler.createServiceTunnel('res');
  
  async function request() {
    const res = await service.send('req', 2);
  }

  setInterval(async () => {
    try {
      await request();
    } catch (err) {
      console.log('failed...');
    }
  }, 3000);
}

run();
