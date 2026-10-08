import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';

// Run the component's real effect with isolated hooks, database responses and
// channels. No browser credentials or external database writes are involved.
const source = readFileSync(new URL('../FrontEnd/src/pages/PropertyDetails.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function harness(response = query => query.table === 'properties'
  ? { data: { id: query.filters.id }, error: null }
  : { data: [], count: 3, error: null }) {
  const writes = [];
  const errors = [];
  const queries = [];
  const channels = new Map();
  const removed = [];
  const markers = [];
  const stateOverrides = new Map();
  let hookIndex = 0;
  let routeId;
  let effect;
  const hooks = {
    useState(initial) {
      const index = hookIndex++;
      return [stateOverrides.has(index) ? stateOverrides.get(index) : initial, value => writes.push(value)];
    },
    useEffect(callback) { effect = callback; },
  };
  const client = {
    from(table) {
      const query = { table, filters: {}, signal: undefined };
      const builder = {
        select() { return builder; },
        eq(key, value) { query.filters[key] = value; return builder; },
        abortSignal(signal) { query.signal = signal; return builder; },
        maybeSingle() { return builder; },
        then(resolve, reject) { queries.push(query); return Promise.resolve(response(query)).then(resolve, reject); },
      };
      return builder;
    },
    channel(name) {
      if (channels.has(name)) return channels.get(name);
      const channel = {
        name, subscribed: false,
        on(event, filter, callback) {
          if (channel.subscribed) throw new Error('cannot add postgres_changes callbacks after subscribe()');
          channel.event = event;
          channel.filter = filter;
          channel.callback = callback;
          return channel;
        },
        subscribe() { channel.subscribed = true; return channel; },
      };
      channels.set(name, channel);
      return channel;
    },
    removeChannel(channel) {
      removed.push(channel);
      // Deliberately leave the old topic registered while removal is pending.
      return new Promise(() => {});
    },
  };
  const exports = {};
  const jsx = (type, props, key) => {
    if (type === 'Marker') markers.push({ props, key });
    return null;
  };
  const modules = {
    react: { ...hooks, default: hooks },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-router-dom': { useParams: () => ({ id: routeId }) },
    '../contexts/AuthContext': { useAuth: () => ({ user: null }) },
    '../lib/supabase': { supabase: client },
    'lucide-react': {},
    'react-leaflet': { Marker: 'Marker' },
    leaflet: { Icon: class {} },
    'leaflet/dist/leaflet.css': {},
    'react-hot-toast': { error: error => errors.push(error) },
  };
  runInNewContext(compiled, {
    exports, AbortController, crypto: { randomUUID }, console: { error: (...args) => errors.push(args) },
    require(name) { assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name]; },
  });
  return {
    writes, errors, queries, channels, removed,
    mount(id = 'property-a') { routeId = id; hookIndex = 0; exports.default(); return effect(); },
    renderUnknownAmenity() {
      stateOverrides.set(0, { id: 'property-a', title: 'Test fixture', photos: [], price: 1 });
      stateOverrides.set(1, [{ id: 'amenity-1', type: 'Unmapped category', latitude: 1, longitude: 103 }]);
      stateOverrides.set(2, false);
      hookIndex = 0;
      exports.default();
      return markers;
    },
  };
}

// React Strict Mode runs setup, cleanup, then setup again on initial mount.
test('effect replay cancels the old fetch and never subscribes after cleanup', async () => {
  const pending = deferred();
  let propertyReads = 0;
  const app = harness(query => {
    if (query.table === 'properties' && propertyReads++ === 0) return pending.promise;
    return query.table === 'properties' ? { data: { id: query.filters.id }, error: null } : { data: [], count: 3, error: null };
  });
  const cleanupOld = app.mount();
  await setImmediate();
  assert.equal(typeof cleanupOld, 'function');
  cleanupOld();
  assert.equal(app.queries[0].signal.aborted, true);
  const cleanupNew = app.mount();
  await setImmediate();
  const writeCount = app.writes.length;
  pending.resolve({ data: { id: 'property-a' }, error: null });
  await setImmediate();
  assert.equal(app.writes.length, writeCount);
  assert.equal(app.channels.size, 1);
  assert.deepEqual(app.errors, []);
  cleanupNew();
  assert.equal(app.removed.length, 1);
});

test('an unmapped amenity type still supplies a Leaflet marker icon', () => {
  const markers = harness().renderUnknownAmenity();
  const amenity = markers.find(marker => marker.key === 'amenity-1');
  assert.ok(amenity);
  assert.ok(amenity.props.icon, 'Leaflet must not receive an undefined icon');
});

test('revisiting a property while channel removal is pending owns a fresh subscription', async () => {
  const app = harness();
  const cleanupFirst = app.mount();
  await setImmediate();
  cleanupFirst();
  const cleanupSecond = app.mount();
  await setImmediate();
  assert.equal(app.channels.size, 2);
  assert.equal(app.removed.length, 1);
  for (const channel of app.channels.values()) {
    assert.equal(channel.event, 'postgres_changes');
    assert.equal(channel.filter.table, 'property_interests');
    assert.equal(channel.filter.filter, 'property_id=eq.property-a');
  }
  assert.deepEqual(app.errors, []);
  cleanupSecond();
  assert.equal(app.removed.length, 2);
});

test('navigation ignores a realtime count response arriving after the old page cleanup', async () => {
  const pendingCount = deferred();
  let delayCount = false;
  const app = harness(query => {
    if (query.table === 'property_interests' && delayCount) return pendingCount.promise;
    return query.table === 'properties' ? { data: { id: query.filters.id }, error: null } : { data: [], count: 3, error: null };
  });
  const cleanup = app.mount();
  await setImmediate();
  const oldChannel = [...app.channels.values()][0];
  delayCount = true;
  const update = oldChannel.callback();
  await setImmediate();
  cleanup();
  delayCount = false;
  const cleanupNext = app.mount('property-b');
  await setImmediate();
  const writeCount = app.writes.length;
  pendingCount.resolve({ count: 99, error: null });
  await update;
  assert.equal(app.writes.length, writeCount);
  assert.equal([...app.channels.values()][1].filter.filter, 'property_id=eq.property-b');
  const queryCount = app.queries.length;
  await oldChannel.callback();
  assert.equal(app.queries.length, queryCount);
  assert.deepEqual(app.errors, []);
  cleanupNext();
});
