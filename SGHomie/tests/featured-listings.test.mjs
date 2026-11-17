import assert from 'node:assert/strict';
import { test } from 'node:test';
import { componentHarness } from './helpers/frontend-component.mjs';

const file = new URL('../FrontEnd/src/components/FeaturedListings.tsx', import.meta.url);
// Columns the component renders (image_url, title, type, price, location,
// bedrooms, bathrooms, area_sqft) plus id, which is the React key.
const allowed = ['id', 'image_url', 'title', 'type', 'price', 'location', 'bedrooms', 'bathrooms', 'area_sqft'];

test('featured listings request an explicit column list limited to rendered columns and the key', async () => {
  const calls = [];
  const query = Object.fromEntries(['select', 'limit', 'order'].map(method => [method, (...args) => {
    calls.push([method, ...args]);
    return method === 'order' ? Promise.resolve({ data: [], error: null }) : query;
  }]));
  const supabase = { from(table) { calls.push(['from', table]); return query; } };
  const harness = componentHarness(file, {
    '../lib/supabase': { supabase },
    'lucide-react': { MapPin: 'MapPin' },
  });
  harness.render();
  await harness.effects();

  assert.deepEqual(calls[0], ['from', 'properties']);
  const select = calls.find(call => call[0] === 'select');
  assert.ok(select, 'Expected a select call');
  const columns = String(select[1]).split(',').map(column => column.trim());
  assert.ok(!columns.includes('*'), 'select must not request every column');
  assert.ok(columns.length > 0 && columns.every(column => allowed.includes(column)), `Unexpected columns: ${columns}`);
  for (const column of allowed) assert.ok(columns.includes(column), `Missing rendered column: ${column}`);
});
