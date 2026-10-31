import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
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
  let authCallback;
  let effect;
  const context = { Provider: 'AuthProvider' };
  const react = {
    createContext: () => context,
    useContext: () => context,
    useEffect: callback => { effect = callback; },
    useRef: initial => ({ current: initial }),
    useState: initial => [initial, value => stateWrites.push(value)],
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
    require(name) {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    },
  });
  exports.AuthProvider({ children: null });
  return {
    queries,
    stateWrites,
    sessionLookup,
    profileResponses,
    start: () => effect(),
    authEvent: (...args) => authCallback(...args),
  };
}

test('overlapping startup profile checks share one lookup but later auth events refresh', async () => {
  const startupProfile = deferred();
  const refreshedProfile = deferred();
  const harness = authHarness();
  harness.profileResponses.push(startupProfile, refreshedProfile);
  const cleanup = harness.start();
  const session = { user: { id: 'buyer-1' } };

  harness.authEvent('INITIAL_SESSION', session);
  assert.equal(harness.queries.length, 1);
  harness.sessionLookup.resolve({ data: { session }, error: null });
  await setImmediate();
  assert.equal(harness.queries.length, 1, 'getSession and INITIAL_SESSION overlap and deduplicate');

  startupProfile.resolve({ data: {
    name: 'Buyer', income_range: 'middle', preferred_property_type: 'HDB',
    preferred_locations: ['Tampines'], family_members: 2, is_admin: false, is_seller: false,
  }, error: null });
  await setImmediate();
  harness.authEvent('TOKEN_REFRESHED', session);
  assert.equal(harness.queries.length, 2, 'deduplication is in-flight only and later auth events refresh profile state');
  cleanup();
  refreshedProfile.resolve({ data: {
    name: 'Buyer', income_range: 'middle', preferred_property_type: 'HDB',
    preferred_locations: ['Tampines'], family_members: 2, is_admin: false, is_seller: false,
  }, error: null });
  await setImmediate();
});
