import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';
import { protectedRouteHarness } from './helpers/protected-route-harness.mjs';

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
  const signOutResult = deferred();
  let storageClears = 0;
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
      signOut: () => signOutResult.promise,
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
    localStorage: { clear() { storageClears++; } },
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
    signOutResult,
    storageClears: () => storageClears,
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

async function signedInHarness() {
  const harness = authHarness();
  const profile = deferred();
  harness.profileResponses.push(profile);
  harness.start();
  harness.authEvent('SIGNED_IN', { user: { id: 'buyer-1' } });
  profile.resolve(completeBuyerProfile);
  await setImmediate();
  return harness;
}

function profileHarness(auth) {
  const source = readFileSync(new URL('../FrontEnd/src/pages/Profile.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const state = [];
  const successes = [];
  const errors = [];
  const navigations = [];
  let hookIndex = 0;
  let effect;
  const react = {
    useState(initial) {
      const index = hookIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = next; }];
    },
    useEffect(callback) { effect = callback; },
  };
  const jsx = (type, props) => ({ type, props });
  const query = {
    select: () => query, eq: () => query,
    maybeSingle: async () => completeBuyerProfile,
  };
  const modules = {
    react: { ...react, default: react },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-router-dom': { useNavigate: () => path => navigations.push(path) },
    '../contexts/AuthContext': { useAuth: () => auth.value() },
    '../lib/supabase': { supabase: { from: table => {
      assert.equal(table, 'user_profiles');
      return query;
    } } },
    'lucide-react': {},
    'react-hot-toast': { default: {
      success: message => successes.push(message), error: message => errors.push(message),
    } },
  };
  const exports = {};
  runInNewContext(compiled, { exports, console: { error() {} }, require: name => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  } });
  const render = () => { hookIndex = 0; return exports.default(); };
  render();
  effect();
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
    ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  return {
    successes, errors, navigations,
    clickSignOut: () => {
      const button = nodes(render()).find(node => node.type === 'button'
        && nodes(node.props.children).some(child => child.props?.children === 'Sign Out'));
      assert.ok(button, 'actual Profile sign-out button must be rendered');
      return button.props.onClick();
    },
  };
}

for (const result of ['success', 'returned-error', 'rejection']) {
  test(`Profile sign-out ${result} shows only the appropriate notification`, async () => {
    const harness = await signedInHarness();
    // Profile reads these presentation fields from the authenticated user.
    Object.assign(harness.value().user, { user_metadata: {}, created_at: '2026-01-01' });
    const profile = profileHarness(harness);
    await setImmediate();
    const clicking = profile.clickSignOut();
    assert.deepEqual(profile.successes, [], 'no success before Supabase resolves');
    if (result === 'success') harness.signOutResult.resolve({ error: null });
    else if (result === 'returned-error') harness.signOutResult.resolve({ error: new Error('Unavailable') });
    else harness.signOutResult.reject(new Error('Unavailable'));
    await clicking;
    assert.deepEqual(profile.successes, result === 'success' ? ['Signed out successfully'] : []);
    assert.deepEqual(profile.errors, result === 'success' ? [] : ['Failed to sign out']);
    assert.deepEqual(profile.navigations, result === 'success' ? ['/'] : []);
  });
}

for (const eventOrder of ['before-result', 'after-result']) {
  test(`intentional sign-out (${eventOrder}) removes protected content without a guest warning`, async () => {
    const harness = await signedInHarness();
    const route = protectedRouteHarness(harness.value());
    assert.equal(route.render('Profile').props.children, 'Profile');
    route.flushEffects();

    const signingOut = harness.value().signOut();
    assert.equal(harness.value().authTransition, 'intentional-sign-out');
    if (eventOrder === 'before-result') harness.authEvent('SIGNED_OUT', null);
    else {
      harness.signOutResult.resolve({ error: null });
      await signingOut;
    }
    route.setAuth(harness.value());
    assert.equal(route.render('Profile').type, 'Navigate');
    route.flushEffects();
    assert.deepEqual(route.notices, []);

    if (eventOrder === 'before-result') {
      harness.signOutResult.resolve({ error: null });
      await signingOut;
    } else harness.authEvent('SIGNED_OUT', null);
    route.setAuth(harness.value());
    assert.equal(route.render('Profile').type, 'Navigate');
    route.flushEffects();
    assert.deepEqual(route.notices, []);
    assert.equal(harness.storageClears(), 1);

    route.setLocation('new-guest-navigation');
    assert.equal(route.render('Search').type, 'Navigate');
    route.flushEffects();
    assert.equal(route.notices.at(-1).message, 'Please sign in to access this feature');

    const nextProfile = deferred();
    harness.profileResponses.push(nextProfile);
    harness.authEvent('SIGNED_IN', { user: { id: 'buyer-1' } });
    nextProfile.resolve(completeBuyerProfile);
    await setImmediate();
    assert.equal(harness.value().authTransition, null);
  });
}

for (const failure of ['returned-error', 'rejection']) {
  test(`sign-out ${failure} propagates without clearing the session or storage`, async () => {
    const harness = await signedInHarness();
    const signingOut = harness.value().signOut();
    const error = new Error('Sign-out unavailable');
    if (failure === 'returned-error') harness.signOutResult.resolve({ error });
    else harness.signOutResult.reject(error);
    await assert.rejects(signingOut, /Sign-out unavailable/);
    assert.equal(harness.value().authTransition, null);
    assert.equal(harness.value().user.id, 'buyer-1');
    assert.equal(harness.storageClears(), 0);
  });
}

test('a token refresh during intentional sign-out does not clear its reason', async () => {
  const harness = await signedInHarness();
  const profile = deferred();
  harness.profileResponses.push(profile);
  const signingOut = harness.value().signOut();
  harness.authEvent('TOKEN_REFRESHED', { user: { id: 'buyer-1' } });
  assert.equal(harness.value().authTransition, 'intentional-sign-out');
  harness.authEvent('SIGNED_OUT', null);
  harness.signOutResult.resolve({ error: null });
  await signingOut;
  profile.resolve(completeBuyerProfile);
  await setImmediate();
  assert.equal(harness.value().user, null);
  assert.equal(harness.value().authTransition, 'intentional-sign-out');
});

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

test('a profile response from the previous account cannot overwrite a later sign-in', async () => {
  const previousAccountProfile = deferred();
  const currentAccountProfile = deferred();
  const harness = authHarness();
  harness.profileResponses.push(previousAccountProfile, currentAccountProfile);
  const cleanup = harness.start();

  harness.authEvent('SIGNED_IN', { user: { id: 'buyer-old' } });
  harness.authEvent('SIGNED_IN', { user: { id: 'seller-current' } });
  assert.equal(harness.value().user.id, 'seller-current');
  assert.equal(harness.queries.length, 2);

  currentAccountProfile.resolve({ data: { ...completeBuyerProfile.data, is_seller: true }, error: null });
  await setImmediate();
  assert.equal(harness.value().isSeller, true);
  assert.equal(harness.value().loading, false);

  previousAccountProfile.resolve({ data: { ...completeBuyerProfile.data, is_admin: true }, error: null });
  await setImmediate();
  assert.equal(harness.value().user.id, 'seller-current');
  assert.equal(harness.value().isSeller, true);
  assert.equal(harness.value().isAdmin, false, 'stale admin role cannot cross account boundaries');
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
