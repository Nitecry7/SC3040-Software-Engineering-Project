import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadListingCounts } from '../FrontEnd/src/lib/listingCounts.ts';

function catalog(pages) {
  const calls = [];
  const query = Object.fromEntries(['select', 'eq', 'order', 'range'].map(method => [method, (...args) => {
    calls.push([method, ...args]);
    return query;
  }]));
  query.abortSignal = async signal => {
    assert.ok(signal instanceof AbortSignal);
    return pages.shift();
  };
  return { calls, from(table) { assert.equal(table, 'properties'); return query; } };
}

test('counts approved HDB rows and normalized distinct towns across response pages', async () => {
  const client = catalog([
    { data: [{ id: '1', town: ' tampines ', location: 'block 123' }, { id: '2', town: null, location: 'TAMPINES' }], count: 4, error: null },
    { data: [{ id: '3', town: '', location: 'yishun' }, { id: '4', town: null, location: 'PENDING' }], count: 4, error: null },
  ]);
  assert.deepEqual(await loadListingCounts(client, new AbortController().signal), { properties: 4, locations: 2 });
  assert.deepEqual(client.calls.filter(call => call[0] === 'range'), [['range', 0, 499], ['range', 2, 501]]);
  assert.deepEqual(client.calls.slice(0, 4), [['select', 'id,town,location', { count: 'exact' }], ['eq', 'status', 'approved'], ['eq', 'type', 'HDB'], ['order', 'id']]);
});

test('an empty approved catalog reports real zero counts', async () => {
  assert.deepEqual(await loadListingCounts(catalog([{ data: [], count: 0, error: null }]), new AbortController().signal), { properties: 0, locations: 0 });
});

test('failed or incomplete fetches reject instead of publishing false zero or partial totals', async () => {
  await assert.rejects(loadListingCounts(catalog([{ data: null, count: null, error: new Error('offline') }]), new AbortController().signal), /offline/);
  await assert.rejects(loadListingCounts(catalog([
    { data: [{ id: '1', town: 'YISHUN' }], count: 2, error: null },
    { data: [], count: 2, error: null },
  ]), new AbortController().signal), /Incomplete listing counts/);
});
