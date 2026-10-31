import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { validateValuationCanaryResponse } from '../BackEnd/supabase/functions/_shared/valuationCanary.ts';

const TIMEOUT_MS = 150_000;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANONICAL_BATCH_PATTERN = /^sghomie-test-\d{4}-\d{2}-\d{2}-[a-f0-9]+$/;

function requiredValue(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error('CANARY_CONFIGURATION');
  return value;
}

export function loadCanaryConfig(env = process.env) {
  const supabaseUrl = new URL(requiredValue(env, 'SGHOMIE_CANARY_SUPABASE_URL'));
  if (supabaseUrl.protocol !== 'https:') throw new Error('CANARY_CONFIGURATION');
  const anonKey = requiredValue(env, 'SGHOMIE_CANARY_SUPABASE_ANON_KEY');
  const userToken = requiredValue(env, 'SGHOMIE_CANARY_USER_TOKEN');
  const expectedModelVersion = requiredValue(env, 'SGHOMIE_CANARY_EXPECTED_MODEL_VERSION');
  if (!VERSION_PATTERN.test(expectedModelVersion)) throw new Error('CANARY_CONFIGURATION');
  return { supabaseUrl: supabaseUrl.origin, anonKey, userToken, expectedModelVersion };
}

async function canonicalFixtureId() {
  const seed = await readFile(new URL('../BackEnd/supabase/seed.sql', import.meta.url), 'utf8');
  const fixture = /^-- fixture: batch=(\S+) id=([0-9a-f-]{36})\b/gim;
  for (const match of seed.matchAll(fixture)) {
    if (CANONICAL_BATCH_PATTERN.test(match[1]) && REQUEST_ID_PATTERN.test(match[2])) return match[2];
  }
  throw new Error('CANARY_FIXTURE_UNAVAILABLE');
}

export async function runValuationCanary(config, fetcher = fetch, timeoutMs = TIMEOUT_MS) {
  const startedAt = performance.now();
  let requestId = null;
  let httpStatus = null;
  let failureCode = null;
  let checks = null;

  try {
    const propertyId = await canonicalFixtureId();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${config.supabaseUrl}/functions/v1/valuation`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ property_id: propertyId }),
        signal: controller.signal,
      });
      httpStatus = response.status;
      const responseRequestId = response.headers.get('X-Valuation-Request-ID');
      requestId = responseRequestId && REQUEST_ID_PATTERN.test(responseRequestId) ? responseRequestId : null;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) failureCode = 'AUTH_FAILURE';
        else if (response.status === 404) failureCode = 'PROPERTY_NOT_FOUND';
        else if (response.status === 409) failureCode = 'FEATURE_PREPARATION_FAILURE';
        else failureCode = 'EDGE_UNAVAILABLE';
      } else {
        let body;
        try {
          body = await response.json();
        } catch (error) {
          if (controller.signal.aborted || ['AbortError', 'TimeoutError'].includes(error?.name)) throw error;
          body = null;
        }
        checks = validateValuationCanaryResponse(body, config.expectedModelVersion, responseRequestId);
        if (!checks?.response_schema) failureCode = 'INVALID_PREDICTION_SCHEMA';
        else if (!checks.interval_ordering) failureCode = 'INVALID_INTERVAL';
        else if (!checks.request_id_correlation) failureCode = 'REQUEST_ID_MISMATCH';
        else if (!checks.expected_model_version) failureCode = 'MODEL_VERSION_MISMATCH';
        requestId = checks?.request_id ?? requestId;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    failureCode = ['AbortError', 'TimeoutError'].includes(error?.name) ? 'TIMEOUT'
      : error?.message === 'CANARY_FIXTURE_UNAVAILABLE' ? 'CANARY_FIXTURE_UNAVAILABLE'
        : 'EDGE_UNAVAILABLE';
  }

  const report = {
    canary: 'synthetic-valuation',
    status: failureCode ? 'failed' : 'passed',
    checked_at: new Date().toISOString(),
    duration_ms: Math.round((performance.now() - startedAt) * 100) / 100,
    http_status: httpStatus,
    request_id: requestId,
    expected_model_version: config.expectedModelVersion,
    returned_model_version: checks?.model_version ?? null,
    checks: checks ? {
      response_schema: checks.response_schema,
      interval_ordering: checks.interval_ordering,
      request_id_correlation: checks.request_id_correlation,
      expected_model_version: checks.expected_model_version,
    } : null,
    failure_code: failureCode,
  };
  return { ...report, exit_code: failureCode ? 1 : 0 };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  let report;
  try {
    const config = loadCanaryConfig();
    report = await runValuationCanary(config);
  } catch (error) {
    report = {
      canary: 'synthetic-valuation',
      status: 'failed',
      checked_at: new Date().toISOString(),
      duration_ms: 0,
      http_status: null,
      request_id: null,
      expected_model_version: null,
      returned_model_version: null,
      checks: null,
      failure_code: error?.message === 'CANARY_CONFIGURATION' ? 'CANARY_CONFIGURATION' : 'CANARY_SETUP_FAILURE',
      exit_code: 1,
    };
  }
  console.log(JSON.stringify(report));
  process.exitCode = report.exit_code;
}
