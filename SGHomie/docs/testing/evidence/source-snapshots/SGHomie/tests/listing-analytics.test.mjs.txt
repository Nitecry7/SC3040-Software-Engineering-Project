import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeListings } from '../FrontEnd/src/lib/listingAnalytics.ts';

const listing = (price, location, town = null) => ({ price, location, town });

test('averages individual listing prices and uses listing counts for the popular area', () => {
  const summary = summarizeListings([
    listing(400000, 'TAMPINES'), listing('500000', 'TAMPINES'), listing(600000, 'TAMPINES'), listing(900000, 'YISHUN'),
  ]);
  assert.equal(summary.count, 4);
  assert.equal(summary.averagePrice, 600000); // Not the unweighted average of the two towns.
  assert.deepEqual(summary.towns, [{ town: 'TAMPINES', count: 3, price: 500000 }, { town: 'YISHUN', count: 1, price: 900000 }]);
  assert.deepEqual(summary.popularTowns, [{ town: 'TAMPINES', count: 3, price: 500000 }]);
});

test('normalizes town names, falls back to location and preserves ties honestly', () => {
  const summary = summarizeListings([listing(500000, 'Block 123', ' tampines '), listing(600000, 'yishun'), listing(700000, 'PENDING', '')]);
  assert.equal(summary.count, 3);
  assert.equal(summary.averagePrice, 600000);
  assert.deepEqual(summary.popularTowns.map(town => town.town), ['TAMPINES', 'YISHUN']);
  assert.equal(summary.towns.length, 2); // Pending location is not a popular town.
});

test('empty or invalid prices show missing data rather than inventing zero averages', () => {
  assert.deepEqual(summarizeListings([]), { count: 0, averagePrice: null, towns: [], popularTowns: [] });
  const summary = summarizeListings([listing(null, 'YISHUN'), listing('', 'YISHUN'), listing('bad', 'YISHUN'), listing(-1, 'YISHUN')]);
  assert.equal(summary.count, 4);
  assert.equal(summary.averagePrice, null);
  assert.equal(summary.towns[0].price, null);
  assert.equal(summarizeListings([listing(0, 'YISHUN')]).averagePrice, 0);
});
