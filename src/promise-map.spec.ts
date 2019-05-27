import 'mocha';
import { expect } from 'chai';

import { createPromiseMap } from './promise-map';

describe('PromiseMap', () => {
  it('should resolve a promise', async () => {
    const pm = createPromiseMap();
    const p = pm.create('promise');
    pm.resolve('promise', 4);
    const four = await p;
    expect(four).to.eq(4);
  });

  it('should reject a promise', async () => {
    const pm = createPromiseMap();
    const p = pm.create('promise');
    pm.reject('promise', 'error!');
    let error;
    try { await p; }
    catch(err) { error = err; }
    expect(error).to.eq('error!');
  });

  it('should prevent memory leaks', async () => {
    const pm = createPromiseMap();
    expect(pm.length).to.eq(0);

    const pa = pm.create('a');
    const pb = pm.create('b');
    expect(pm.length).to.eq(2);

    try {
      pm.resolve('a', 1);
      pm.reject('b', 'error');
      await Promise.all([pa, pb]);
    } catch(e) { }
    expect(pm.length).to.eq(0);
  });
});
