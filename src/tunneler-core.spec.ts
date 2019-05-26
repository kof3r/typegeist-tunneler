import 'mocha';
import chai, { expect } from 'chai';
import spies from 'chai-spies';
import { createTunnelerCore, createServiceTunnelCore, MessageHandlerMap } from './tunneler-core';

chai.use(spies);

describe('TunnelerCore', () => {
  it('can create a TunnelerCore', () => {
    const tc = createTunnelerCore({});
    expect(tc).to.be.ok;
  });

  it('does not throw while creating a TunnelerCore', () => {
    expect(() => createTunnelerCore({})).not.to.throw()
  });

  it('preserves the correlation id', async () => {
    const tc = createTunnelerCore({ a: chai.spy() });
    const msg = await tc.handleMessage({ cid: '1', type: 'a' });

    expect(msg.cid).to.eq('1');
  });

  it('correctly calculates the response', async () => {
    const tc = createTunnelerCore({ a: function({ a, b }) { return a + b; } });
    const msg = await tc.handleMessage({ cid: '1', type: 'a', payload: { a: 1, b: 2 } });

    expect(msg.response).to.eq(3);
  });

  it('returns an error message when the handler is not recognized', async () => {
    const tc = createTunnelerCore({});
    const result = await tc.handleMessage({ cid: '1', type: 'non-existing' });
    expect(!!result.error).to.be.true;
    expect(result.response).to.eq(undefined);
  });

  it('correctly identifies the handler', async () => {
    const handlers = { a: chai.spy(), b: chai.spy() }
    const tc = createTunnelerCore(handlers);
    await tc.handleMessage({ cid: '1', type: 'b' });

    expect(handlers.a).to.have.been.called.exactly(0);
    expect(handlers.b).to.have.been.called.exactly(1);
  });

  it('can execute multiple handlers', async () => {
    const handlers = { a: chai.spy(), b: chai.spy(), c: chai.spy(), d: chai.spy() }
    const tc = createTunnelerCore(handlers);
    await tc.handleMessage({ cid: '1', type: 'a' });
    await tc.handleMessage({ cid: '2', type: 'b' });
    await tc.handleMessage({ cid: '3', type: 'c' });
    await tc.handleMessage({ cid: '4', type: 'a' });
    await tc.handleMessage({ cid: '5', type: 'b' });

    expect(handlers.a).to.have.been.called.exactly(2);
    expect(handlers.b).to.have.been.called.exactly(2);
    expect(handlers.c).to.have.been.called.exactly(1);
    expect(handlers.d).to.have.been.called.exactly(0);
  });

  it('can handle changed handlers', async () => {
    const handlers: MessageHandlerMap = { a: chai.spy() }
    const tc = createTunnelerCore(handlers);

    handlers.b = chai.spy();

    await tc.handleMessage({ cid: '1', type: 'b' });

    expect(handlers.a).to.have.been.called.exactly(0);
    expect(handlers.b).to.have.been.called.exactly(1);
  });

  it('returns an error message when the handler throws', async () => {
    const error = new Error();
    const tc = createTunnelerCore({ a: function() { throw error } });

    const msg = await tc.handleMessage({ cid: '1', type: 'a' });

    expect(msg.error).to.eq(error);
    expect(msg.response).to.eq(undefined);
  });
});

describe('ServiceTunnelCore', () => {
  it('correctly resolves a promise', async () => {
    const stc = createServiceTunnelCore();
    const p = stc.createResponsePromise({ cid: '1', type: 'a' });
    stc.handleTunnelerResponse({ cid: '1', response: 2 });

    const result = await p;
    expect(result).to.eq(2);
  });

  it('correctly rejects a promise', async () => {
    const stc = createServiceTunnelCore();
    const p = stc.createResponsePromise({ cid: '1', type: 'a' });
    stc.handleTunnelerResponse({ cid: '1', error: 2 });

    let error;
    try { await p; }
    catch (err) { error = err; }
    expect(error).to.eq(2);
  });
});
