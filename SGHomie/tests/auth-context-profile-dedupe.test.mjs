import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function authHarness() {
  const source = readFileSync(new URL('../FrontEnd/src/contexts/AuthContext.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sessionLookup = deferred();
  const profileResponses = [];
  const queries = [];
  const stateWrites = [];
  const timers = [];
  const hooks = [];
  let hookIndex = 0;
  let authCallback;
  let effect;
  const context = { Provider: 'AuthProvider' };
  const react = {
    createContext: () => context,
    useContext: () => context,
    useCallback(callback, dependencies) {
      const index = hookIndex++;
      const previous = hooks[index];
      if (!previous || dependencies.some((dependency, dependencyIndex) => !Object.is(dependency, previous.dependencies[dependencyIndex]))) {
        hooks[index] = { value: callback, dependencies };
      }
      return hooks[index].value;
    },
    useEffect: callback => { effect = callback; },
    useState(initial) {
      const index = hookIndex++;
      if (!hooks[index]) hooks[index] = { value: initial };
      return [hooks[index].value, next => {
        hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next;
        stateWrites.push({ index, value: hooks[index].value });
      }];
    },
    useRef(initial) {
      const index = hookIndex++;
      if (!hooks[index]) hooks[index] = { value: { current: initial } };
      return hooks[index].value;
    },
  };
  const supabase = {
    auth: {
      getSession: () => sessionLookup.promise,
      onAuthStateChange(callback) {
        authCallback = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signOut() {},
    },
    from(table) {
      const query = { table, filters: {} };
      const builder = {
        select(columns) { query.columns = columns; return builder; },
        eq(key, value) { query.filters[key] = value; return builder; },
        single() { queries.push(query); return profileResponses.shift().promise; },
      };
      return builder;
    },
  };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: { ...react, default: react },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@supabase/supabase-js': { User: Object },
    '../lib/supabase': { supabase },
    '../components/InitialProfileSetup': { default: 'InitialProfileSetup' },
  };
  runInNewContext(compiled, {
    exports,
    console: { error() {} },
    localStorage: { clear() {} },
    setTimeout(callback, delay) {
      const timer = { callback, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) { timer.cleared = true; },
    require(name) {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    },
  });
  const AuthProvider = exports.AuthProvider;
  const render = () => {
    hookIndex = 0;
    return AuthProvider({ children: null });
  };
  render();
  return {
    queries,
    stateWrites,
    sessionLookup,
    profileResponses,
    timers,
    fireTimers: () => timers.filter(timer => !timer.cleared).forEach(timer => timer.callback()),
    start: () => effect(),
    authEvent: (...args) => authCallback(...args),
    value: () => render().props.value,
  };
}

const completeBuyerProfile = {
  data: {
    name: 'Buyer', income_range: 'middle', preferred_property_type: 'HDB',
    preferred_locations: ['Tampines'], family_members: 2, is_admin: false, is_seller: false,
  }, error: null,
};

test('protected authorization remains loading through profile and role lookup', async () => {
  const profile = deferred();
  const harness = authHarness();
  harness.profileResponses.push(profile);
  const cleanup = harness.start();

  assert.equal(harness.value().authLoading, true);
  assert.equal(harness.value().loading, true);
  harness.sessionLookup.resolve({ data: { session: { user: { id: 'buyer-1' } } }, error: null });
  await setImmediate();

  assert.equal(harness.value().user.id, 'buyer-1');
  assert.equal(harness.value().authLoading, false);
  assert.equal(harness.value().profileLoading, true);
  assert.equal(harness.value().loading, true, 'route guards must wait for completion and role flags');

  profile.resolve(completeBuyerProfile);
  await setImmediate();
  assert.equal(harness.value().loading, false);
  assert.equal(harness.value().needsProfileSetup, false);
  assert.equal(harness.value().isSeller, false);
  cleanup();
});

test('auth events deduplicate startup lookup and refresh roles after it resolves', async () => {
  const startupProfile = deferred();
  const refreshedProfile = deferred();
  const harness = authHarness();
  harness.profileResponses.push(startupProfile, refreshedProfile);
  const cleanup = harness.start();
  const session = { user: { id: 'seller-1' } };

  harness.authEvent('INITIAL_SESSION', session);
  assert.equal(harness.value().loading, true);
  assert.equal(harness.value().profileLoading, true);
  assert.equal(harness.queries.length, 1);
  harness.sessionLookup.resolve({ data: { session }, error: null });
  await setImmediate();
  assert.equal(harness.queries.length, 1, 'getSession does not duplicate INITIAL_SESSION');

  startupProfile.resolve({ data: {
    ...completeBuyerProfile.data, is_seller: true,
  }, error: null });
  await setImmediate();
  assert.equal(harness.value().loading, false);
  assert.equal(harness.value().isSeller, true);

  harness.authEvent('TOKEN_REFRESHED', session);
  assert.equal(harness.queries.length, 2);
  assert.equal(harness.value().profileLoading, true);
  refreshedProfile.resolve({ data: { ...completeBuyerProfile.data, is_seller: true }, error: null });
  await setImmediate();
  assert.equal(harness.value().loading, false);
  cleanup();
});

test('seller registration refreshes the current profile role before protected navigation', async () => {
  const initialProfile = deferred();
  const pendingTokenRefresh = deferred();
  const updatedProfile = deferred();
  const harness = authHarness();
  harness.profileResponses.push(initialProfile, pendingTokenRefresh, updatedProfile);
  const cleanup = harness.start();
  const session = { user: { id: 'new-seller-1' } };
  harness.authEvent('SIGNED_IN', session);
  initialProfile.resolve({ data: { ...completeBuyerProfile.data, is_seller: false }, error: null });
  await setImmediate();
  assert.equal(harness.value().isSeller, false);

  harness.authEvent('TOKEN_REFRESHED', session);
  assert.equal(harness.queries.length, 2);
  const refreshed = harness.value().refreshProfile();
  assert.equal(harness.queries.length, 3, 'seller registration refresh bypasses an older in-flight role lookup');
  assert.equal(harness.value().profileLoading, true);
  pendingTokenRefresh.resolve({ data: { ...completeBuyerProfile.data, is_seller: false }, error: null });
  updatedProfile.resolve({ data: { ...completeBuyerProfile.data, is_seller: true }, error: null });
  assert.equal((await refreshed).isSeller, true);
  assert.equal(harness.value().isSeller, true);
  assert.equal(harness.value().profileLoading, false);
  cleanup();
});

test('sign-out clears role state and ignores a late profile response', async () => {
  const profile = deferred();
  const harness = authHarness();
  harness.profileResponses.push(profile);
  const cleanup = harness.start();
  harness.authEvent('INITIAL_SESSION', { user: { id: 'seller-1' } });
  assert.equal(harness.value().loading, true);

  harness.authEvent('SIGNED_OUT', null);
  assert.equal(harness.value().user, null);
  assert.equal(harness.value().profileLoading, false);
  assert.equal(harness.value().loading, false);
  assert.equal(harness.value().isSeller, false);

  profile.resolve({ data: { ...completeBuyerProfile.data, is_seller: true }, error: null });
  await setImmediate();
  assert.equal(harness.value().user, null);
  assert.equal(harness.value().isSeller, false, 'stale role data cannot restore protected access');
  cleanup();
});

test('Supabase anonymous sessions resolve as guests without a profile-role lookup', () => {
  const harness = authHarness();
  const cleanup = harness.start();
  const anonymousUser = { id: 'anonymous-1', is_anonymous: true };
  harness.authEvent('INITIAL_SESSION', { user: anonymousUser });
  assert.equal(harness.value().user, anonymousUser);
  assert.equal(harness.value().authLoading, false);
  assert.equal(harness.value().profileLoading, false);
  assert.equal(harness.value().loading, false);
  assert.equal(harness.queries.length, 0);
  cleanup();
});

test('profile lookup failures resolve closed instead of leaving authorization loading forever', async () => {
  const profile = deferred();
  const harness = authHarness();
  harness.profileResponses.push(profile);
  const cleanup = harness.start();
  harness.authEvent('INITIAL_SESSION', { user: { id: 'buyer-1' } });
  profile.reject(new Error('profile unavailable'));
  await setImmediate();
  assert.equal(harness.value().loading, false);
  assert.equal(harness.value().needsProfileSetup, true);
  assert.equal(harness.value().isAdmin, false);
  assert.equal(harness.value().isSeller, false);
  cleanup();
});

test('a stalled profile lookup times out and resolves authorization closed', async () => {
  const profile = deferred();
  const harness = authHarness();
  harness.profileResponses.push(profile);
  const cleanup = harness.start();
  harness.authEvent('INITIAL_SESSION', { user: { id: 'buyer-1' } });
  assert.equal(harness.value().loading, true);
  assert.equal(harness.timers[0].delay, 10_000);

  harness.fireTimers();
  await setImmediate();
  assert.equal(harness.value().loading, false);
  assert.equal(harness.value().needsProfileSetup, true);
  assert.equal(harness.value().isSeller, false);
  cleanup();
});
