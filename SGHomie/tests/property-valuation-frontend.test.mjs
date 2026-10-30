import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';

const source = readFileSync(new URL('../FrontEnd/src/lib/valuation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

class FunctionsFetchError extends Error {}
class FunctionsRelayError extends Error {}
class FunctionsHttpError extends Error {
  constructor(context) {
    super('Edge Function returned a non-2xx status code');
    this.context = context;
  }
}

const valuation = {
  estimated_value: 678402.5554,
  lower_bound: 586363.1157,
  upper_bound: 770441.9951,
  interval_half_width: 92039.4397,
  interval_full_width: 184078.8794,
  coverage_target: 0.9,
  model_version: 'hdb-catboost-2025-12-v1',
  uncertainty_method: 'town_conformal',
  uncertainty_group: 'SERANGOON',
  uncertainty_support: 2209,
  used_global_fallback: false,
  price_position: 'within_estimated_market_range',
};

function service({ session, sessionError = null, invocation, setAuthError } = {}) {
  const calls = { getSession: 0, setAuth: [], invoke: [] };
  const exports = {};
  const supabase = {
    auth: {
      async getSession() {
        calls.getSession += 1;
        return { data: { session }, error: sessionError };
      },
    },
  };
  const functionsSupabase = {
    functions: {
      setAuth(token) {
        calls.setAuth.push(token);
        if (setAuthError) throw setAuthError;
      },
      async invoke(name, options) {
        calls.invoke.push({ name, options });
        if (invocation instanceof Error) return { data: null, error: invocation };
        return { data: invocation ?? { data: valuation, request_id: 'request-1' }, error: null };
      },
    },
  };
  const modules = {
    '@supabase/supabase-js': { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError },
    './supabase': { supabase, functionsSupabase },
  };
  runInNewContext(compiled, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    },
  });
  return { api: exports, calls };
}

test('valuation sends only the property ID and passes the authenticated session token', async () => {
  const { api, calls } = service({ session: { access_token: 'user-session-jwt' } });
  const result = await api.getPropertyValuation('property-123');
  assert.deepEqual(calls.setAuth, ['user-session-jwt']);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.invoke)), [{ name: 'valuation', options: { body: { property_id: 'property-123' } } }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), valuation);
  assert.equal('asking_price' in calls.invoke[0].options.body, false);
  assert.equal('model_features' in calls.invoke[0].options.body, false);
});

test('empty property IDs fail before session or function calls', async () => {
  const { api, calls } = service({ session: { access_token: 'user-session-jwt' } });
  await assert.rejects(api.getPropertyValuation('  '), error => error.category === 'function_error');
  assert.equal(calls.getSession, 0);
  assert.equal(calls.invoke.length, 0);
});

test('missing sessions and session lookup errors are controlled authentication failures', async () => {
  for (const options of [{}, { sessionError: new Error('private auth detail') }]) {
    const { api, calls } = service(options);
    await assert.rejects(api.getPropertyValuation('property-123'), error => error.category === 'authentication');
    assert.equal(calls.invoke.length, 0);
  }
});

test('function failures retain controlled authentication, network, unavailable and generic categories', async () => {
  const cases = [
    [new FunctionsFetchError('network detail'), 'network'],
    [new FunctionsRelayError('relay detail'), 'network'],
    [new FunctionsHttpError(new Response('{}', { status: 401 })), 'authentication'],
    [new FunctionsHttpError(new Response(JSON.stringify({ error: { code: 'VALUATION_UNAVAILABLE' } }), { status: 409 })), 'valuation_unavailable'],
    [new FunctionsHttpError(new Response(JSON.stringify({ error: { code: 'PROPERTY_NOT_FOUND' } }), { status: 404 })), 'property_not_found'],
    [new FunctionsHttpError(new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'private details' } }), { status: 500 })), 'function_error'],
  ];

  for (const [invocation, expectedCategory] of cases) {
    const { api } = service({ session: { access_token: 'user-session-jwt' }, invocation });
    await assert.rejects(api.getPropertyValuation('property-123'), error => {
      assert.equal(error.category, expectedCategory);
      assert.doesNotMatch(error.message, /private|detail|network|relay/);
      return true;
    });
  }
});

test('malformed success responses are rejected instead of rendered', async () => {
  const malformedResponses = [
    {},
    { data: { ...valuation, estimated_value: '678402' }, request_id: 'request-1' },
    { data: { ...valuation, estimated_value: 0 }, request_id: 'request-1' },
    { data: { ...valuation, price_position: 'great_deal' }, request_id: 'request-1' },
    { data: { ...valuation, lower_bound: 700000 }, request_id: 'request-1' },
    { data: { ...valuation, coverage_target: 0.5 }, request_id: 'request-1' },
    { data: { ...valuation, interval_half_width: 1 }, request_id: 'request-1' },
    { data: { ...valuation, interval_full_width: 1 }, request_id: 'request-1' },
    { data: { ...valuation, uncertainty_group: ' ' }, request_id: 'request-1' },
    ...[undefined, null, '2209', -1, 2.5].map(uncertainty_support => ({
      data: { ...valuation, uncertainty_support },
      request_id: 'request-1',
    })),
  ];

  for (const invocation of malformedResponses) {
    const { api } = service({ session: { access_token: 'user-session-jwt' }, invocation });
    await assert.rejects(api.getPropertyValuation('property-123'), error => error.category === 'malformed_response');
  }
});

test('price-position labels are customer-facing and specific', () => {
  const { api } = service();
  assert.equal(api.getPricePositionLabel('below_estimated_market_range'), 'Asking price is below the estimated market range');
  assert.equal(api.getPricePositionLabel('within_estimated_market_range'), 'Asking price is within the estimated market range');
  assert.equal(api.getPricePositionLabel('above_estimated_market_range'), 'Asking price is above the estimated market range');
});
