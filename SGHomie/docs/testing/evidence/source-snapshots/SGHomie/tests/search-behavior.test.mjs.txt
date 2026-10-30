import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { componentHarness, content, nodes } from './helpers/frontend-component.mjs';

// Query contract tests using synthetic catalog rows. The database double does
// not evaluate PostgreSQL regexes or prove hosted RLS/database behavior.
const property = {
  id: 'synthetic-listing', title: 'Synthetic 4-room HDB', price: 500000,
  location: 'TAMPINES', image_url: null, bedrooms: 3, bathrooms: 2,
  area_sqft: 1000, latitude: 1.35, longitude: 103.94,
};
function harness({ result = { data: [property], error: null } } = {}) {
  const requests = [];
  const app = componentHarness(new URL('../FrontEnd/src/pages/Search.tsx', import.meta.url), {
    'react-router-dom': { Link: 'Link' },
    'lucide-react': {},
    '../contexts/AuthContext': { useAuth: () => ({ user: null }) },
    '../components/MarketplaceMap': { default: 'MarketplaceMap' },
    '../lib/supabase': { supabase: { from(table) {
      assert.equal(table, 'properties');
      const calls = [];
      const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'or'].map(method => [method, (...args) => { calls.push([method, ...args]); return query; }]));
      query.order = async (...args) => { calls.push(['order', ...args]); requests.push(calls); return result; };
      return query;
    } } },
  });
  const select = (index, value) => nodes(app.render()).filter(node => node.type === 'select')[index].props.onChange({ target: { value } });
  const input = (placeholder, value) => app.find(node => node.props.placeholder === placeholder).props.onChange({ target: { value } });
  const submit = async () => { app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await setImmediate(); };
  return { ...app, requests, select, input, submit };
}

test('FE-SEARCH-01 the initial search reads approved HDB rows and newest first', async () => {
  const app = harness();
  app.render();
  await app.effects();
  await setImmediate();
  assert.deepEqual(app.requests[0].filter(call => call[0] === 'eq'), [['eq', 'type', 'HDB'], ['eq', 'status', 'approved']]);
  assert.deepEqual(JSON.parse(JSON.stringify(app.requests[0].at(-1))), ['order', 'created_at', { ascending: false }]);
  assert.match(content(app.render()), /1 home found/);
  assert.match(content(app.render()), /Synthetic 4-room HDB/);
});

test('FE-SEARCH-02 4 ROOM filters listing room-type text without requiring four bedrooms', async () => {
  const app = harness();
  app.select(1, '4 ROOM');
  await app.submit();
  assert.ok(app.requests[0].some(call => call[0] === 'or' && /title\.imatch/.test(call[1]) && /description\.imatch/.test(call[1]) && call[1].includes('4[-[:space:]]+room')));
  assert.equal(app.requests[0].some(call => call[0] === 'eq' && call[1] === 'bedrooms'), false);
});

test('FE-SEARCH-03 EXECUTIVE produces a valid text filter rather than a NaN bedroom query', async () => {
  const app = harness();
  app.select(1, 'EXECUTIVE');
  await app.submit();
  assert.ok(app.requests[0].some(call => call[0] === 'or' && /executive/.test(call[1])));
  assert.equal(app.requests[0].flat().some(value => typeof value === 'number' && !Number.isFinite(value)), false);
  assert.equal(app.requests[0].some(call => call[1] === 'bedrooms'), false);
});

test('FE-SEARCH-04 ALL leaves town and room type unrestricted', async () => {
  const app = harness();
  await app.submit();
  assert.equal(app.requests[0].some(call => call[0] === 'or' || call[1] === 'location' || call[1] === 'bedrooms'), false);
});

test('FE-SEARCH-05 explicit town and inclusive price limits are passed to the catalog', async () => {
  const app = harness();
  app.select(0, 'TAMPINES');
  app.input('No minimum', '0');
  app.input('No maximum', '600000');
  await app.submit();
  assert.deepEqual(app.requests[0].filter(call => ['eq', 'gte', 'lte'].includes(call[0])), [
    ['eq', 'type', 'HDB'], ['eq', 'status', 'approved'], ['eq', 'location', 'TAMPINES'], ['gte', 'price', 0], ['lte', 'price', 600000],
  ]);
});

test('FE-SEARCH-06 a catalog failure shows an alert rather than a false no-match result', async () => {
  const app = harness({ result: { data: null, error: new Error('synthetic database failure') } });
  await app.submit();
  assert.match(content(app.find(node => node.props.role === 'alert')), /We could not load homes/);
  assert.doesNotMatch(content(app.render()), /No homes match these filters/);
});

test('FE-SEARCH-07 an empty successful catalog displays no matches', async () => {
  const app = harness({ result: { data: [], error: null } });
  await app.submit();
  assert.match(content(app.render()), /No homes match these filters/);
  assert.equal(nodes(app.render()).some(node => node.props.role === 'alert'), false);
});

test('FE-SEARCH-08 selecting a card updates the map selection and accessible pressed state', async () => {
  const app = harness();
  await app.submit();
  app.find(node => node.type === 'button' && node.props['aria-pressed'] === false).props.onClick();
  assert.equal(app.find(node => node.type === 'button' && node.props['aria-pressed'] === true).props['aria-pressed'], true);
  assert.equal(app.find(node => node.type === 'MarketplaceMap').props.selectedProperty.id, property.id);
});

test('FE-SEARCH-09 an unsupported profile flat size is rejected before a catalog query', async () => {
  const app = harness();
  app.select(1, 'unexpected-profile-value');
  await app.submit();
  assert.equal(app.requests.length, 0);
  assert.match(content(app.find(node => node.props.role === 'alert')), /We could not load homes/);
});
