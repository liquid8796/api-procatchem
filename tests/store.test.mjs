/**
 * Store tests, including the functional update that keeps throttled editors
 * from writing a stale snapshot back over newer state.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { Store } from '../assets/builder/js/core/store.js';

test('setIn writes a nested path and notifies once', () => {
  const store = new Store({ a: { b: 1 } });
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  store.setIn('a.b', 2);
  assert.equal(store.getIn('a.b'), 2);
  assert.equal(calls, 1);
});

test('setIn clones along the mutated path and leaves siblings alone', () => {
  const original = { a: { b: 1, keep: {} }, other: {} };
  const store = new Store(original);
  const keep = store.getIn('a.keep');
  const other = store.getIn('other');
  store.setIn('a.b', 2);

  assert.notEqual(store.state, original, 'root should be a new object');
  assert.notEqual(store.getIn('a'), original.a, 'mutated branch should be new');
  assert.equal(store.getIn('a.keep'), keep, 'untouched sibling should be shared');
  assert.equal(store.getIn('other'), other, 'untouched branch should be shared');
});

test('setIn writes into arrays by index', () => {
  const store = new Store({ list: ['a', 'b'] });
  store.setIn('list.1', 'z');
  assert.deepEqual(store.getIn('list'), ['a', 'z']);
});

test('update derives from the live value, not from a caller-held snapshot', () => {
  const store = new Store({ items: ['a'] });

  // What a throttled editor holds after its last render.
  const staleSnapshot = store.getIn('items');
  // Something else changes the list in the meantime.
  store.setIn('items', [...staleSnapshot, 'b']);

  store.update('items', (live) => [...live, 'c'], []);
  assert.deepEqual(store.getIn('items'), ['a', 'b', 'c'],
    'the concurrent change must survive');
});

test('update falls back when nothing is stored yet', () => {
  const store = new Store({});
  store.update('missing.list', (live) => [...live, 'x'], []);
  assert.deepEqual(store.getIn('missing.list'), ['x']);
});

test('subscribe returns an unsubscribe that takes effect', () => {
  const store = new Store({ n: 0 });
  let calls = 0;
  const off = store.subscribe(() => { calls += 1; });
  store.setIn('n', 1);
  off();
  store.setIn('n', 2);
  assert.equal(calls, 1);
});

test('a listener may unsubscribe while listeners are being notified', () => {
  const store = new Store({ n: 0 });
  const seen = [];
  const off = store.subscribe(() => { seen.push('first'); off(); });
  store.subscribe(() => { seen.push('second'); });
  assert.doesNotThrow(() => store.setIn('n', 1));
  assert.deepEqual(seen, ['first', 'second']);
});

test('replace swaps the whole document', () => {
  const store = new Store({ a: 1 });
  store.replace({ b: 2 });
  assert.deepEqual(store.state, { b: 2 });
});

test('getIn returns undefined for a path that runs off the end', () => {
  const store = new Store({ a: null });
  assert.equal(store.getIn('a.b.c'), undefined);
  assert.equal(store.getIn('nope'), undefined);
});
