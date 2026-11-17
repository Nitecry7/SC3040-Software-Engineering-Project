import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';

// Loads a fresh copy of the real module so its in-memory state starts empty.
// Synthetic fragments only; no Supabase client or network is involved.
function load({ hash = '', search = '', pathname = '/', stored = null, storageThrows = false } = {}) {
  const source = readFileSync(new URL('../FrontEnd/src/lib/authRecovery.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const storage = new Map(stored === null ? [] : [['sghomie:auth-recovery', stored]]);
  const exports = {};
  const window = {
    location: { hash, search, pathname },
    sessionStorage: {
      getItem(key) { if (storageThrows) throw new Error('synthetic privacy restriction'); return storage.get(key) ?? null; },
      setItem(key, value) { if (storageThrows) throw new Error('synthetic privacy restriction'); storage.set(key, value); },
      removeItem(key) { if (storageThrows) throw new Error('synthetic privacy restriction'); storage.delete(key); },
    },
  };
  runInNewContext(compiled, { exports, window, URLSearchParams, JSON, Object, Set });
  return { ...exports, storage };
}

const parse = (hash, search = '') => load().parseAuthRedirect(hash, search);
const TOKEN = 'synthetic-access-token-value';

test('FE-RECOVERY-01 a recovery fragment is recognised and carries no token', () => {
  const result = parse(`#access_token=${TOKEN}&refresh_token=synthetic-refresh&expires_in=3600&token_type=bearer&type=recovery`);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { kind: 'recovery' });
  assert.ok(!JSON.stringify(result).includes(TOKEN));
});

test('FE-RECOVERY-02 an expired link maps to expired, by code or by description', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parse('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))), { kind: 'error', reason: 'expired' });
  assert.deepEqual(JSON.parse(JSON.stringify(parse('#error=access_denied&error_description=The+link+has+expired'))), { kind: 'error', reason: 'expired' });
});

test('FE-RECOVERY-03 any other auth error maps to invalid and exposes no raw description', () => {
  const result = parse('#error=server_error&error_code=unexpected_failure&error_description=Something+secret+went+wrong');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { kind: 'error', reason: 'invalid' });
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('FE-RECOVERY-04 an empty or unrelated fragment is none', () => {
  for (const [hash, search] of [['', ''], ['#', ''], ['#section-2', ''], ['#foo=bar', '?q=1'], [`#access_token=${TOKEN}&type=signup`, '']]) {
    assert.deepEqual(JSON.parse(JSON.stringify(parse(hash, search))), { kind: 'none' }, `${hash}${search}`);
  }
});

test('FE-RECOVERY-05 a fragment with both a token and an error is an error and never leaks the token', () => {
  const result = parse(`#access_token=${TOKEN}&type=recovery&error=access_denied&error_code=otp_expired`);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { kind: 'error', reason: 'expired' });
  assert.ok(!JSON.stringify(result).includes(TOKEN));
});

test('FE-RECOVERY-06 errors in the query string are recognised too', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parse('', '?error=access_denied&error_code=otp_expired'))), { kind: 'error', reason: 'expired' });
});

test('FE-RECOVERY-07 capturing a recovery redirect stores only the kind', () => {
  const module = load({ hash: `#access_token=${TOKEN}&refresh_token=r&type=recovery` });
  module.captureAuthRedirect();
  assert.deepEqual(JSON.parse(JSON.stringify(module.getRecoveryState())), { kind: 'recovery' });
  const stored = [...module.storage.values()].join('|');
  assert.ok(!stored.includes(TOKEN));
  assert.equal(module.storage.size, 1);
  assert.deepEqual(JSON.parse(stored), { kind: 'recovery' });
});

test('FE-RECOVERY-08 capturing an error redirect keeps the reason', () => {
  const module = load({ hash: '#error=access_denied&error_code=otp_expired', pathname: '/reset-password' });
  module.captureAuthRedirect();
  assert.deepEqual(JSON.parse(JSON.stringify(module.getRecoveryState())), { kind: 'error', reason: 'expired' });
});

test('FE-RECOVERY-09 a reload without a fragment restores the stored state', () => {
  const module = load({ stored: JSON.stringify({ kind: 'recovery' }) });
  module.captureAuthRedirect();
  assert.deepEqual(JSON.parse(JSON.stringify(module.getRecoveryState())), { kind: 'recovery' });
});

test('FE-RECOVERY-10 malformed stored state is ignored', () => {
  for (const stored of ['not json', JSON.stringify({ kind: 'bogus' }), JSON.stringify({ kind: 'error', reason: 'x' }), 'null']) {
    const module = load({ stored });
    module.captureAuthRedirect();
    assert.equal(module.getRecoveryState(), null, stored);
  }
});

test('FE-RECOVERY-11 clearing removes memory and storage and notifies subscribers', () => {
  const module = load({ hash: `#access_token=${TOKEN}&type=recovery` });
  module.captureAuthRedirect();
  let calls = 0;
  const unsubscribe = module.subscribeRecoveryState(() => { calls++; });
  module.clearRecoveryState();
  assert.equal(module.getRecoveryState(), null);
  assert.equal(module.storage.size, 0);
  assert.equal(calls, 1);
  unsubscribe();
  module.clearRecoveryState();
  assert.equal(calls, 1);
});

test('FE-RECOVERY-12 when storage throws the in-memory state still works and nothing throws', () => {
  const module = load({ hash: `#access_token=${TOKEN}&type=recovery`, storageThrows: true });
  assert.doesNotThrow(() => module.captureAuthRedirect());
  assert.deepEqual(JSON.parse(JSON.stringify(module.getRecoveryState())), { kind: 'recovery' });
  assert.doesNotThrow(() => module.clearRecoveryState());
  assert.equal(module.getRecoveryState(), null);
  const restored = load({ storageThrows: true });
  assert.doesNotThrow(() => restored.captureAuthRedirect());
  assert.equal(restored.getRecoveryState(), null);
});

test('FE-RECOVERY-13 the state snapshot is referentially stable until it changes', () => {
  const module = load({ hash: `#access_token=${TOKEN}&type=recovery` });
  module.captureAuthRedirect();
  assert.equal(module.getRecoveryState(), module.getRecoveryState());
});

test('FE-RECOVERY-20 only a redirect read from the URL counts as freshly captured, not a restored state', () => {
  const fromUrl = load({ hash: `#access_token=${TOKEN}&type=recovery` });
  fromUrl.captureAuthRedirect();
  assert.equal(fromUrl.wasCapturedFromUrl(), true);
  const restored = load({ stored: JSON.stringify({ kind: 'recovery' }) });
  restored.captureAuthRedirect();
  assert.equal(restored.wasCapturedFromUrl(), false);
  assert.equal(load().wasCapturedFromUrl(), false);
});

test('FE-RECOVERY-21 an error redirect on any other path is ignored: no state, nothing stored', () => {
  for (const pathname of ['/', '/search', '/reset-password/extra']) {
    const module = load({ hash: '#error=access_denied&error_code=otp_expired&error_description=expired', pathname });
    module.captureAuthRedirect();
    assert.equal(module.getRecoveryState(), null, pathname);
    assert.equal(module.storage.size, 0, pathname);
    assert.equal(module.wasCapturedFromUrl(), false, pathname);
  }
});

test('FE-RECOVERY-22 an error redirect on /reset-password gives the error state', () => {
  const module = load({ hash: '#error=access_denied&error_code=otp_expired', pathname: '/reset-password' });
  module.captureAuthRedirect();
  assert.deepEqual(JSON.parse(JSON.stringify(module.getRecoveryState())), { kind: 'error', reason: 'expired' });
  assert.equal(module.wasCapturedFromUrl(), true);
});

test('FE-RECOVERY-23 a recovery fragment is still captured on any path', () => {
  const module = load({ hash: `#access_token=${TOKEN}&type=recovery`, pathname: '/' });
  module.captureAuthRedirect();
  assert.deepEqual(JSON.parse(JSON.stringify(module.getRecoveryState())), { kind: 'recovery' });
  assert.equal(module.wasCapturedFromUrl(), true);
});

test('FE-RECOVERY-14 the module does not import Supabase or log', () => {
  const source = readFileSync(new URL('../FrontEnd/src/lib/authRecovery.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import\s/);
  assert.doesNotMatch(source, /console\./);
});

// ---- AuthProvider: the profile-setup overlay stays hidden during a reset ----

import { setImmediate } from 'node:timers/promises';

// A small dedicated harness for the real AuthProvider. Synthetic session and
// profile data only; nothing reaches Supabase.
function providerHarness() {
  const source = readFileSync(new URL('../FrontEnd/src/contexts/AuthContext.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const slots = [];
  let cursor = 0;
  let effect;
  let authCallback;
  let state = null;
  let clears = 0;
  const listeners = new Set();
  const context = { Provider: 'AuthProvider' };
  const react = {
    createContext: () => context,
    useContext: () => context,
    useCallback(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, at) => !Object.is(value, previous.dependencies[at]))) slots[index] = { value: callback, dependencies };
      return slots[index].value;
    },
    useEffect: callback => { effect = callback; },
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: { current: initial } };
      return slots[index].value;
    },
  };
  const supabase = {
    auth: {
      getSession: () => new Promise(() => {}),
      onAuthStateChange(callback) { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    },
    from() {
      const builder = {
        select: () => builder, eq: () => builder,
        single: async () => ({ data: { name: null, income_range: null, is_admin: false, is_seller: false }, error: null }),
      };
      return builder;
    },
  };
  const notify = () => listeners.forEach(listener => listener());
  const recovery = {
    getRecoveryState: () => state,
    clearRecoveryState() { clears++; state = null; notify(); },
    subscribeRecoveryState(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: { ...react, default: react },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@supabase/supabase-js': { User: Object },
    '../lib/supabase': { supabase },
    '../components/InitialProfileSetup': { default: 'InitialProfileSetup' },
    '../lib/authRecovery': recovery,
  };
  const exports = {};
  runInNewContext(compiled, {
    exports, console: { error() {} }, localStorage: { clear() {} }, setTimeout, clearTimeout,
    require(name) { assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name]; },
  });
  const render = () => { cursor = 0; return exports.AuthProvider({ children: null }); };
  render();
  const overlay = () => [].concat(render().props.children).some(child => child && child.type === 'InitialProfileSetup');
  return {
    overlay,
    start: () => effect(),
    signIn: () => authCallback('SIGNED_IN', { user: { id: 'buyer-1' } }),
    signOutEvent: () => authCallback('SIGNED_OUT', null),
    setState(next) { state = next; notify(); },
    clears: () => clears,
    listenerCount: () => listeners.size,
  };
}

test('FE-RECOVERY-15 the profile setup overlay is hidden while recovery is active and returns after clearing', async () => {
  const provider = providerHarness();
  provider.start();
  provider.signIn();
  await setImmediate();
  assert.equal(provider.overlay(), true);
  provider.setState({ kind: 'recovery' });
  assert.equal(provider.overlay(), false);
  provider.setState(null);
  assert.equal(provider.overlay(), true);
});

test('FE-RECOVERY-16 an error recovery state does not hide the overlay', async () => {
  const provider = providerHarness();
  provider.start();
  provider.signIn();
  await setImmediate();
  provider.setState({ kind: 'error', reason: 'expired' });
  assert.equal(provider.overlay(), true);
});

test('FE-RECOVERY-17 a sign-out event clears the recovery state', () => {
  const provider = providerHarness();
  provider.start();
  provider.setState({ kind: 'recovery' });
  provider.signOutEvent();
  assert.equal(provider.clears(), 1);
});

test('FE-RECOVERY-18 unmounting unsubscribes from recovery changes', () => {
  const provider = providerHarness();
  const cleanup = provider.start();
  assert.equal(provider.listenerCount(), 1);
  cleanup();
  assert.equal(provider.listenerCount(), 0);
});

test('FE-RECOVERY-19 a recovery state present at start-up hides the overlay without waiting for a notification', async () => {
  const provider = providerHarness();
  provider.setState({ kind: 'recovery' });
  provider.start();
  provider.signIn();
  await setImmediate();
  assert.equal(provider.overlay(), false);
});
