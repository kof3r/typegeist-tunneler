import 'mocha';
import { expect } from 'chai';

import { createTunneler, Tunneler, ServiceTunnel } from './tunneler';
import { createRamTransporter } from './transporter-ram';
import { Transporter } from './transporter';

describe('Tunneler', () => {
  let transporter: Transporter;
  let serviceTunneler: Tunneler;
  let clientTunneler: Tunneler;
  let serviceTunnel: ServiceTunnel;

  beforeEach(async () => {
    transporter = createRamTransporter();
    serviceTunneler = await createTunneler({ transporter, name: 'service' });
    clientTunneler = await createTunneler({ transporter, name: 'client' });
    serviceTunnel = await clientTunneler.createServiceTunnel('service');
  });

  it('works', async () => {
    serviceTunneler.handleMessages({
      'test': a => a * a,
      'hello': name => `Hello, ${name}!`
    });
    const r = await serviceTunnel.send('test', 3);
    const greet = await serviceTunnel.send('hello', 'World');
    expect(r).to.eq(9);
    expect(greet).to.eq('Hello, World!');
  });

  it('can handle adding message handlers', async () => {
    serviceTunneler.handleMessages({
      'test': a => a * a,
    });
    const r = await serviceTunnel.send('test', 3);

    serviceTunneler.handleMessages({
      'hello': name => `Hello, ${name}!`
    });
    const greet = await serviceTunnel.send('hello', 'World');

    expect(r).to.eq(9);
    expect(greet).to.eq('Hello, World!');
  });

  it('throws for an unknown procedure', async () => {
    serviceTunneler.handleMessages({
      'test': function() { throw 'error'; }
    });
    let error;
    try { await serviceTunnel.send('not-present', 3); }
    catch (e) { error = e; }
    expect(error).not.to.eq(undefined);
  });

  it('throws if a handler throws', async () => {
    serviceTunneler.handleMessages({
      'test': function() { throw 'error'; }
    });
    let error;
    try { await serviceTunnel.send('test', null); }
    catch (e) { error = e; }
    expect(error).to.eq('error');
  });
});
