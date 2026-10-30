import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadCanaryConfig, runValuationCanary } from '../scripts/valuation-canary.mjs';

const requestId = 'd4e6be0e-1849-4fc8-9425-04200fc76c21';
const modelVersion = 'hdb-catboost-2025-12-v1';
const canaryConfig = {
  supabaseUrl: 'https://synthetic-project.supabase.co',
  anonKey: 'publishable-test-key',
  userToken: 'registered-test-user-token',
  expectedModelVersion: modelVersion,
};
const validResult = {
  estimated_value: 500_000,
  lower_bound: 450_000,
  upper_bound: 550_000,
  interval_half_width: 50_000,
  interval_full_width: 100_000,
  coverage_target: 0.9,
  model_version: modelVersion,
  uncertainty_method: 'town_conformal',
  uncertainty_group: 'SYNTHETIC TOWN',
  uncertainty_support: 40,
  used_global_fallback: false,
  price_position: null,
};

test('hosted canary config requires deliberate HTTPS credentials and expected model version', () => {
  const config = loadCanaryConfig({
    SGHOMIE_CANARY_SUPABASE_URL: canaryConfig.supabaseUrl,
    SGHOMIE_CANARY_SUPABASE_ANON_KEY: canaryConfig.anonKey,
    SGHOMIE_CANARY_USER_TOKEN: canaryConfig.userToken,
    SGHOMIE_CANARY_EXPECTED_MODEL_VERSION: canaryConfig.expectedModelVersion,
  });
  assert.deepEqual(config, canaryConfig);
  assert.throws(() => loadCanaryConfig({}), { message: 'CANARY_CONFIGURATION' });
  assert.throws(() => loadCanaryConfig({
    SGHOMIE_CANARY_SUPABASE_URL: 'http://localhost:54321',
    SGHOMIE_CANARY_SUPABASE_ANON_KEY: canaryConfig.anonKey,
    SGHOMIE_CANARY_USER_TOKEN: canaryConfig.userToken,
    SGHOMIE_CANARY_EXPECTED_MODEL_VERSION: modelVersion,
  }), { message: 'CANARY_CONFIGURATION' });
});

test('hosted canary CLI exits nonzero with a safe configuration report when not configured', () => {
  const env = { ...process.env };
  for (const name of [
    'SGHOMIE_CANARY_SUPABASE_URL',
    'SGHOMIE_CANARY_SUPABASE_ANON_KEY',
    'SGHOMIE_CANARY_USER_TOKEN',
    'SGHOMIE_CANARY_EXPECTED_MODEL_VERSION',
  ]) delete env[name];
  const cliPath = fileURLToPath(new URL('../scripts/valuation-canary.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [cliPath], { encoding: 'utf8', env });
  assert.equal(child.status, 1);
  const report = JSON.parse(child.stdout);
  assert.equal(report.failure_code, 'CANARY_CONFIGURATION');
  assert.equal(report.request_id, null);
  assert.equal(child.stdout.includes(canaryConfig.userToken), false);
});

test('deterministic canary submits only a seeded synthetic property and reports safe success metadata', async () => {
  let request;
  const fetcher = async (url, options) => {
    request = { url, options };
    return Response.json({ data: validResult, request_id: requestId }, {
      headers: { 'X-Valuation-Request-ID': requestId },
    });
  };
  const result = await runValuationCanary(canaryConfig, fetcher, 1000);
  assert.equal(result.status, 'passed');
  assert.equal(result.exit_code, 0);
  assert.equal(result.request_id, requestId);
  assert.equal(result.returned_model_version, modelVersion);
  assert.deepEqual(result.checks, {
    response_schema: true,
    interval_ordering: true,
    request_id_correlation: true,
    expected_model_version: true,
  });
  assert.equal(request.url, `${canaryConfig.supabaseUrl}/functions/v1/valuation`);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.apikey, canaryConfig.anonKey);
  assert.equal(request.options.headers.Authorization, `Bearer ${canaryConfig.userToken}`);
  assert.deepEqual(Object.keys(JSON.parse(request.options.body)), ['property_id']);
  const reportText = JSON.stringify(result);
  assert.equal(reportText.includes(canaryConfig.anonKey), false);
  assert.equal(reportText.includes(canaryConfig.userToken), false);
  assert.equal(reportText.includes('500000'), false);
});

test('deterministic canary fails closed on interval, schema, model and request ID regressions', async () => {
  const cases = [
    { data: { ...validResult, lower_bound: 600_000 }, code: 'INVALID_INTERVAL' },
    { data: { ...validResult, uncertainty_support: '40' }, code: 'INVALID_PREDICTION_SCHEMA' },
    { data: { ...validResult, model_version: 'another-model-v1' }, code: 'MODEL_VERSION_MISMATCH' },
    { data: validResult, headerId: 'd4e6be0e-1849-4fc8-9425-04200fc76c22', code: 'REQUEST_ID_MISMATCH' },
  ];
  for (const item of cases) {
    const headerId = item.headerId ?? requestId;
    const result = await runValuationCanary(canaryConfig, async () => Response.json({
      data: item.data,
      request_id: requestId,
    }, { headers: { 'X-Valuation-Request-ID': headerId } }), 1000);
    assert.equal(result.status, 'failed');
    assert.equal(result.exit_code, 1);
    assert.equal(result.failure_code, item.code);
  }
});

test('deterministic canary reports safe auth, property, feature, service and timeout failure categories', async () => {
  for (const scenario of [
    { response: new Response('private details', { status: 401 }), code: 'AUTH_FAILURE' },
    { response: new Response('private details', { status: 404, headers: { 'X-Valuation-Request-ID': requestId } }), code: 'PROPERTY_NOT_FOUND' },
    { response: new Response('private details', { status: 409, headers: { 'X-Valuation-Request-ID': requestId } }), code: 'FEATURE_PREPARATION_FAILURE' },
    { response: new Response('private details', { status: 503 }), code: 'EDGE_UNAVAILABLE' },
  ]) {
    const result = await runValuationCanary(canaryConfig, async () => scenario.response, 1000);
    assert.equal(result.failure_code, scenario.code);
    assert.equal(result.exit_code, 1);
    if (scenario.response.status === 404 || scenario.response.status === 409) {
      assert.equal(result.request_id, requestId);
    }
    assert.equal(JSON.stringify(result).includes('private details'), false);
  }
  const timeout = await runValuationCanary(canaryConfig, async () => {
    const error = new Error('private timeout details');
    error.name = 'AbortError';
    throw error;
  }, 1000);
  assert.equal(timeout.failure_code, 'TIMEOUT');
  assert.equal(JSON.stringify(timeout).includes('private timeout details'), false);

  const bodyTimeout = await runValuationCanary(canaryConfig, async () => ({
    status: 200,
    ok: true,
    headers: new Headers({ 'X-Valuation-Request-ID': requestId }),
    async json() {
      const error = new Error('private response timeout');
      error.name = 'AbortError';
      throw error;
    },
  }), 1000);
  assert.equal(bodyTimeout.failure_code, 'TIMEOUT');
  assert.equal(JSON.stringify(bodyTimeout).includes('private response timeout'), false);
});
