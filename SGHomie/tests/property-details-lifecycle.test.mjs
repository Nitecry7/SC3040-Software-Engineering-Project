import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';
import * as amenityHelpers from "../FrontEnd/src/lib/amenities.ts";


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

function renderedText(node) {
  if (Array.isArray(node)) return node.map(renderedText).join(' ');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node && typeof node === 'object') return renderedText(node.props?.children ?? '');
  return '';
}

function containsType(node, type) {
  if (Array.isArray(node)) return node.some(child => containsType(child, type));
  if (!node || typeof node !== 'object') return false;
  return node.type === type || containsType(node.props?.children, type);
}

function harness(response = query => query.table === 'properties'
  ? { data: {
      id: query.filters.id, title: 'Fixture listing', price: 750000, image_url: 'image.png',
      bedrooms: 3, bathrooms: 2, area_sqft: 900, description: 'Fixture description',
      detailed_location: '123 Example Street', seller_name: null, seller_phone: null,
      built_year: 2000, photos: [], latitude: 1.35, longitude: 103.87,
    }, error: null }
  : { data: [], count: 3, error: null }, { user = null, requestValuation = async () => ({}), intersectionObserver = true } = {}) {
  const writes = [];
  const errors = [];
  const queries = [];
  const channels = new Map();
  const removed = [];
  const markers = [];
  const stateOverrides = new Map();
  const refs = [];
  const dispatchedEvents = [];
  const effectDefinitions = [];
  const effectSlots = [];
  const timers = new Map();
  const clearedTimers = [];
  const observers = [];
  let nextTimerId = 1;
  let timerNow = 0;
  let hookIndex = 0;
  let routeId;
  let lastTree;
  let activeEffectCount = 0;
  const hooks = {
    useState(initial) {
      const index = hookIndex++;
      const value = stateOverrides.has(index) ? stateOverrides.get(index) : initial;
      return [value, nextValue => {
        const resolvedValue = typeof nextValue === 'function' ? nextValue(stateOverrides.get(index) ?? initial) : nextValue;
        stateOverrides.set(index, resolvedValue);
        writes.push({ index, value: resolvedValue });
      }];
    },
    useRef(initial) {
      const index = hookIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect(callback, dependencies = []) { effectDefinitions.push({ callback, dependencies }); },
  };
  const client = {
    from(table) {
      const query = { table, filters: {}, signal: undefined };
      const builder = {
        select(columns, options) { query.columns = columns; query.selectOptions = options; return builder; },
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
    if (props?.ref && type === 'div' && String(props.className ?? '').includes('h-[360px]')) {
      props.ref.current = { observedMapPlaceholder: true };
    }
    return { type, props, key };
  };
  const RangeGauge = 'ValuationRangeGauge';
  const modules = {
    react: {
      ...hooks,
      useCallback: (callback) => callback,
      default: hooks,
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-router-dom": { useParams: () => ({ id: routeId }) },
    "../contexts/AuthContext": { useAuth: () => ({ user }) },
    "../lib/supabase": { supabase: client },
    "../lib/valuation": {
      getPropertyValuation: requestValuation,
      getPricePositionLabel: position => ({
        below_estimated_market_range: 'Asking price is below the estimated market range',
        within_estimated_market_range: 'Asking price is within the estimated market range',
        above_estimated_market_range: 'Asking price is above the estimated market range',
      })[position],
      getValuationErrorMessage: category => category,
      PropertyValuationError: class PropertyValuationError extends Error {
        constructor(category) { super(category); this.category = category; }
      },
    },

    "../lib/amenities": amenityHelpers,

    "../lib/valuationRange": { formatSingaporeDollars: value => `S$${Math.round(value)}` },
    "../components/ValuationRangeGauge": { ValuationRangeGauge: RangeGauge },

    "lucide-react": {},
    "react-leaflet": {
      Marker: "Marker",
      MapContainer: "MapContainer",
      TileLayer: "TileLayer",
      Popup: "Popup",
      useMap: () => ({
        setView() {},
        fitBounds() {},
        on() {},
        off() {},
        invalidateSize() {},
        getContainer() {
          return {};
        },
      }),
    },

    leaflet: {
      divIcon: (options) => ({ ...options }),
    },

    "leaflet/dist/leaflet.css": {},
    "react-hot-toast": { error: (error) => errors.push(error) },
  };
  runInNewContext(compiled, {
    exports, AbortController, crypto: { randomUUID }, console: { error: (...args) => errors.push(args) },
    window: {
      dispatchEvent: event => dispatchedEvents.push(event.type),
      setTimeout(callback, delay) { const timerId = nextTimerId++; timers.set(timerId, { callback, due: timerNow + delay }); return timerId; },
      clearTimeout(timerId) { clearedTimers.push(timerId); timers.delete(timerId); },
    },
    ...(intersectionObserver ? { IntersectionObserver: class IntersectionObserver {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      disconnect() {}
    } } : {}),
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    require(name) { assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name]; },
  });
  return {
    writes,
    errors,
    dispatchedEvents,
    queries,
    channels,
    removed,
    timers,
    clearedTimers,
    observers,
    advanceTimers(milliseconds) {
      timerNow += milliseconds;
      for (const [timerId, timer] of [...timers.entries()].sort((a, b) => a[1].due - b[1].due)) {
        if (timer.due <= timerNow) {
          timers.delete(timerId);
          timer.callback();
        }
      }
    },
    mount(id = "property-a") {
      routeId = id;
      effectSlots.length = 0;
      this.render(id);
      return () => {
        for (const slot of effectSlots) slot.cleanup?.();
        effectSlots.length = 0;
        activeEffectCount = 0;
      };
    },
    render(id = routeId) {
      routeId = id;
      hookIndex = 0;
      effectDefinitions.length = 0;
      lastTree = exports.default();
      for (let index = 0; index < effectDefinitions.length; index += 1) {
        const definition = effectDefinitions[index];
        const previous = effectSlots[index];
        const changed = !previous || definition.dependencies.length !== previous.dependencies.length ||
          definition.dependencies.some((dependency, dependencyIndex) => dependency !== previous.dependencies[dependencyIndex]);
        if (changed) {
          previous?.cleanup?.();
          effectSlots[index] = { dependencies: [...definition.dependencies], cleanup: definition.callback() };
        }
      }
      activeEffectCount = effectDefinitions.length;
      return lastTree;
    },
    getTree() { return lastTree; },
    getButton(label) {
      const pending = [lastTree];
      while (pending.length) {
        const node = pending.pop();
        if (!node || typeof node !== 'object') continue;
        const children = node.props?.children;
        const text = Array.isArray(children) ? children.filter(child => typeof child === 'string').join('') : children;
        if (node.type === 'button' && text === label) return node;
        if (Array.isArray(children)) pending.push(...children);
        else pending.push(children);
      }
      return null;
    },
    setStateOverride(index, value) { stateOverrides.set(index, value); },
    renderUnknownAmenity() {
      routeId = 'property-a';
      stateOverrides.set(0, {
        id: "property-a",
        title: "Test fixture",
        photos: [],
        price: 1,
      });

      stateOverrides.set(1, [
        {
          id: "amenity-1",
          name: "Unknown place",
          type: "Unmapped category",
          distance: 0.5,
          latitude: 1.3,
          longitude: 103.8,
          source: "test",
        },
      ]);

      stateOverrides.set(2, false); // amenitiesLoading
      stateOverrides.set(3, false); // amenitiesError
      stateOverrides.set(4, "all"); // amenityCategory
      stateOverrides.set(5, false); // property page loading
      stateOverrides.set(21, 'property-a'); // map has entered the viewport

      hookIndex = 0;
      effectDefinitions.length = 0;
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
  assert.ok(amenity, JSON.stringify(markers));
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

test('a valuation response from the previous property route is ignored', async () => {
  const pendingValuation = deferred();
  const app = harness(undefined, {
    user: { id: 'buyer-1' },
    requestValuation: () => pendingValuation.promise,
  });
  const property = {
    id: 'property-a', title: 'Fixture listing', price: 750000, location: 'SERANGOON',
    type: 'HDB', image_url: 'image.png', bedrooms: 3, bathrooms: 2, area_sqft: 900,
    description: 'Fixture', detailed_location: '123 Example Street', seller_name: null,
    seller_phone: null, photos: [], latitude: 1.35, longitude: 103.87, built_year: 2000,
  };
  app.setStateOverride(0, property);
  app.setStateOverride(5, false);

  const cleanupOld = app.mount('property-a');
  await setImmediate();
  app.render('property-a');
  const button = app.getButton('Get property valuation.');
  assert.ok(button, 'signed-in users can explicitly request a valuation');
  const request = button.props.onClick();

  cleanupOld();
  app.setStateOverride(0, { ...property, id: 'property-b' });
  const cleanupNew = app.mount('property-b');
  await setImmediate();
  const valuationWritesBeforeResolve = app.writes.filter(write => write.index === 14).length;
  pendingValuation.resolve({ estimated_value: 700000 });
  await request;

  assert.equal(app.writes.filter(write => write.index === 14).length, valuationWritesBeforeResolve);
  cleanupNew();
});

test('logged-out valuation requests open the existing auth modal without invoking the service', async () => {
  let serviceCalls = 0;
  const app = harness(undefined, { requestValuation: async () => { serviceCalls += 1; return {}; } });
  app.setStateOverride(0, {
    id: 'property-a', title: 'Fixture listing', price: 750000, photos: [],
  });
  app.setStateOverride(5, false);
  const cleanup = app.mount('property-a');
  await setImmediate();
  app.render('property-a');

  const button = app.getButton('Sign in for valuation');
  assert.ok(button);
  await button.props.onClick();
  assert.deepEqual(app.dispatchedEvents, ['toggle-auth-modal']);
  assert.equal(serviceCalls, 0);
  cleanup();
});

test('property content appears while independent interest lookups are pending and map mounts on approach', async () => {
  const pendingCount = deferred();
  const pendingUserInterest = deferred();
  const app = harness(query => {
    if (query.table === 'properties') return { data: { id: 'property-a', title: 'Ready listing', price: 750000, photos: [], bedrooms: 3, bathrooms: 2, area_sqft: 900, built_year: 2000 }, error: null };
    if (query.table === 'property_interests' && query.filters.user_id) return pendingUserInterest.promise;
    if (query.table === 'property_interests') return pendingCount.promise;
    return { data: [], error: null };
  }, { user: { id: 'buyer-1' } });

  const cleanup = app.mount();
  await setImmediate();
  app.render();
  const text = renderedText(app.getTree());
  assert.match(text, /Ready listing/);
  assert.match(text, /Loading interest count/);
  assert.match(text, /Checking your interest/);
  assert.equal(app.queries.find(query => query.table === 'properties').columns,
    'id,title,price,image_url,bedrooms,bathrooms,area_sqft,description,detailed_location,seller_name,seller_phone,built_year,photos,latitude,longitude');
  assert.equal(app.channels.size, 1, 'realtime interest updates subscribe without waiting for lookups');
  assert.equal(app.queries.filter(query => query.table === 'property_interests').length, 2);

  const pending = app.observers.at(-1);
  assert.ok(pending, 'nearby map is observed after property content mounts');
  assert.match(renderedText(app.getTree()), /nearby map will load as you explore/);
  assert.equal(containsType(app.getTree(), 'MapContainer'), false);
  pending.callback([{ isIntersecting: true }]);
  app.render();
  assert.equal(containsType(app.getTree(), 'MapContainer'), true);

  pendingCount.resolve({ count: 4, error: null });
  await setImmediate();
  app.render();
  assert.match(renderedText(app.getTree()), /4\s+people interested/);
  assert.match(renderedText(app.getTree()), /Checking your interest/);
  pendingUserInterest.resolve({ data: { id: 'interest-1' }, error: null });
  await setImmediate();
  cleanup();
});

test('map mounts eagerly when IntersectionObserver is unavailable', async () => {
  const app = harness(undefined, { intersectionObserver: false });
  const cleanup = app.mount('property-a');
  await setImmediate();
  app.render('property-a');
  app.render('property-a');
  assert.equal(containsType(app.getTree(), 'MapContainer'), true);
  cleanup();
});

test('valuation CTA prevents duplicates, shows staged copy, renders the hierarchy and clears timers', async () => {
  const pendingValuation = deferred();
  let serviceCalls = 0;
  const app = harness(undefined, {
    user: { id: 'buyer-1' },
    requestValuation: () => { serviceCalls += 1; return pendingValuation.promise; },
  });
  app.setStateOverride(0, { id: 'property-a', title: 'Fixture listing', price: 105, photos: [], bedrooms: 3, bathrooms: 2, area_sqft: 900 });
  app.setStateOverride(5, false);
  const cleanup = app.mount('property-a');
  await setImmediate();
  app.render('property-a');
  const button = app.getButton('Get property valuation.');
  assert.ok(button);
  assert.match(button.props.className, /from-blue-700/);
  assert.match(button.props.className, /focus-visible:outline/);

  const request = button.props.onClick();
  void button.props.onClick();
  assert.equal(serviceCalls, 1, 'repeated clicks do not start a second request');
  app.render('property-a');
  assert.equal(app.getButton('Calculating valuation...').props.disabled, true);
  assert.match(renderedText(app.getTree()), /Preparing property valuation/);
  app.advanceTimers(4000);
  app.render('property-a');
  assert.match(renderedText(app.getTree()), /Analysing historical HDB resale patterns/);
  app.advanceTimers(11000);
  app.render('property-a');
  assert.match(renderedText(app.getTree()), /Waking the demo valuation service/);

  pendingValuation.resolve({
    estimated_value: 100, lower_bound: 80, upper_bound: 120, interval_half_width: 20,
    interval_full_width: 40, coverage_target: 0.9, model_version: 'research',
    uncertainty_method: 'town_conformal', uncertainty_group: 'TOWN', uncertainty_support: 100,
    used_global_fallback: false, price_position: 'within_estimated_market_range',
  });
  await request;
  app.render('property-a');
  const resultText = renderedText(app.getTree());
  assert.match(resultText, /Estimated market value/);
  assert.match(resultText, /Likely market range/);
  assert.match(resultText, /90\s*%\s*calibration target/);
  assert.match(resultText, /Asking price/);
  assert.match(resultText, /Asking price is within the estimated market range/);
  assert.match(resultText, /not a property-specific probability/);
  assert.equal(app.timers.size, 0);
  assert.equal(app.clearedTimers.length, 2);
  cleanup();
});

test('below, within and above asking-price labels stay human-readable', async () => {
  for (const [position, label] of [
    ['below_estimated_market_range', 'Asking price is below the estimated market range'],
    ['within_estimated_market_range', 'Asking price is within the estimated market range'],
    ['above_estimated_market_range', 'Asking price is above the estimated market range'],
  ]) {
    const app = harness(undefined, { user: { id: 'buyer-1' }, requestValuation: async () => ({
      estimated_value: 100, lower_bound: 80, upper_bound: 120, interval_half_width: 20,
      interval_full_width: 40, coverage_target: 0.9, model_version: 'research',
      uncertainty_method: 'town_conformal', uncertainty_group: 'TOWN', uncertainty_support: 100,
      used_global_fallback: false, price_position: position,
    }) });
    app.setStateOverride(0, { id: 'property-a', title: 'Fixture', price: 100, photos: [] });
    app.setStateOverride(5, false);
    const cleanup = app.mount('property-a');
    await setImmediate();
    app.render('property-a');
    await app.getButton('Get property valuation.').props.onClick();
    app.render('property-a');
    assert.match(renderedText(app.getTree()), new RegExp(label));
    cleanup();
  }
});

test('unmounting a pending valuation clears both timers and ignores its response', async () => {
  const pendingValuation = deferred();
  const app = harness(undefined, { user: { id: 'buyer-1' }, requestValuation: () => pendingValuation.promise });
  app.setStateOverride(0, { id: 'property-a', title: 'Fixture', price: 100, photos: [] });
  app.setStateOverride(5, false);
  const cleanup = app.mount('property-a');
  await setImmediate();
  app.render('property-a');
  const request = app.getButton('Get property valuation.').props.onClick();
  app.render('property-a');
  assert.equal(app.timers.size, 2);
  cleanup();
  assert.equal(app.timers.size, 0);
  assert.equal(app.clearedTimers.length >= 2, true);
  const valuationWrites = app.writes.filter(write => write.index === 14).length;
  pendingValuation.resolve({ estimated_value: 1 });
  await request;
  assert.equal(app.writes.filter(write => write.index === 14).length, valuationWrites);
});

test('valuation failure clears staged timers and leaves a retry action available', async () => {
  let rejectValuation;
  const app = harness(undefined, {
    user: { id: 'buyer-1' },
    requestValuation: () => new Promise((_, reject) => { rejectValuation = reject; }),
  });
  const cleanup = app.mount('property-a');
  await setImmediate();
  app.render('property-a');
  const request = app.getButton('Get property valuation.').props.onClick();
  app.render('property-a');
  assert.equal(app.timers.size, 2);
  rejectValuation(new Error('private network detail'));
  await request;
  app.render('property-a');
  assert.equal(app.timers.size, 0);
  assert.equal(app.clearedTimers.length, 2);
  assert.ok(app.getButton('Try valuation again'));
  assert.doesNotMatch(renderedText(app.getTree()), /private network detail/);
  cleanup();
});

test('changing property routes clears the prior valuation stage timers', async () => {
  const pendingValuation = deferred();
  const app = harness(undefined, { user: { id: 'buyer-1' }, requestValuation: () => pendingValuation.promise });
  const cleanup = app.mount('property-a');
  await setImmediate();
  app.render('property-a');
  const request = app.getButton('Get property valuation.').props.onClick();
  app.render('property-a');
  assert.equal(app.timers.size, 2);
  app.render('property-b');
  await setImmediate();
  app.render('property-b');
  assert.equal(app.timers.size, 0);
  assert.equal(app.clearedTimers.length >= 2, true);
  pendingValuation.resolve({ estimated_value: 1 });
  await request;
  cleanup();
});
