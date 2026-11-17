import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runChecks } from '../scripts/monitor/checks.mjs';
import { classify, REASONS } from '../scripts/monitor/classify.mjs';
import { buildJson, renderMarkdown, renderTable } from '../scripts/monitor/report.mjs';
import { loadMonitorConfig, runMonitor } from '../scripts/service-monitor.mjs';

const TOKEN = 'render-token-SECRET-123';
const KEY = 'anon-key-SECRET-456';
const QUERY_SECRET = 'QUERYSECRET789';
const BODY_SECRET = 'BODYSECRET-abc';
const ERROR_SECRET = 'ERRORSECRET-xyz';
const SECRETS = [TOKEN, KEY, QUERY_SECRET, BODY_SECRET, ERROR_SECRET, 'Authorization', 'Bearer'];
const BASE = 1_700_000_000_000;

const config = {
  frontendUrl: `https://app.example.test/?access_token=${QUERY_SECRET}`,
  renderUrl: 'https://render.example.test',
  supabaseUrl: 'https://proj.supabase.example.test',
  supabaseAnonKey: KEY,
  renderToken: TOKEN,
  expectedModelVersion: 'model-v1',
  timeoutMs: 200,
};

const html = `<html><body><div id="root"></div><!-- ${BODY_SECRET} --></body></html>`;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

/** Router-style mock fetch. Records every call. */
function mockFetch(routes) {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ url: String(url), path: u.pathname, init });
    const handler = routes[u.pathname];
    if (!handler) throw new Error(`unrouted ${u.pathname}`);
    return handler(init);
  };
  fetcher.calls = calls;
  return fetcher;
}

const healthyRoutes = () => ({
  '/': () => new Response(html, { status: 200 }),
  '/health': () => json({ status: 'ok', model_loaded: true, note: BODY_SECRET }),
  '/v1/valuation/model-info': () => json({ model_version: 'model-v1', secret: BODY_SECRET }),
  '/functions/v1/chatbot': () => json({ response: `Welcome ${BODY_SECRET}`, choices: [] }),
});

function clock() {
  const state = { t: BASE };
  return { state, now: () => state.t };
}

async function evaluate(cfg, routes) {
  const fetcher = mockFetch(routes);
  const { now } = clock();
  const observations = await runChecks(cfg, { fetcher, now });
  const results = observations.map(classify);
  return { results, byTarget: Object.fromEntries(results.map(r => [r.target, r])), fetcher };
}

const outcome = r => `${r.status}:${r.reason}`;

test('frontend classifies healthy, failed and unknown', async () => {
  const cases = [
    [() => new Response(html), 'healthy:OK'],
    [() => new Response('<html>no app</html>'), 'failed:ROOT_ELEMENT_MISSING'],
    [() => new Response('boom', { status: 502 }), 'failed:HTTP_5XX'],
    [() => new Response('', { status: 404 }), 'unknown:UNEXPECTED_STATUS'],
    [() => new Response('', { status: 403 }), 'unknown:UNEXPECTED_STATUS'],
    [() => new Response('', { status: 429 }), 'unknown:UNEXPECTED_STATUS'],
    [() => { throw new Error(`socket ${ERROR_SECRET}`); }, 'unknown:NETWORK_ERROR'],
    [() => new Response(null, { status: 302, headers: { location: 'https://evil.example.test/' } }), 'unknown:REDIRECT_NOT_FOLLOWED'],
  ];
  for (const [handler, expected] of cases) {
    const { byTarget } = await evaluate({ ...config, supabaseUrl: '', renderUrl: '' }, { '/': handler });
    assert.equal(outcome(byTarget.frontend), expected);
  }
});

test('render_model classifies healthy, not ready, invalid body, 5xx and unknown', async () => {
  const only = { ...config, frontendUrl: '', supabaseUrl: '', renderToken: '', expectedModelVersion: '' };
  const cases = [
    [() => json({ status: 'ok', model_loaded: true }), 'healthy:OK'],
    [() => json({ status: 'ok', model_loaded: false }), 'failed:NOT_READY'],
    [() => json({ status: 'starting', model_loaded: true }), 'failed:NOT_READY'],
    [() => json({ detail: 'Valuation model is unavailable.' }, 503), 'failed:NOT_READY'],
    [() => json({ detail: 'something else' }, 500), 'failed:HTTP_5XX'],
    [() => new Response('<html>gateway</html>', { status: 200 }), 'failed:INVALID_BODY'],
    [() => json([1, 2]), 'failed:INVALID_BODY'],
    [() => new Response('', { status: 401 }), 'unknown:UNEXPECTED_STATUS'],
    [() => { throw new Error('ECONNRESET'); }, 'unknown:NETWORK_ERROR'],
  ];
  for (const [handler, expected] of cases) {
    const { byTarget } = await evaluate(only, { '/health': handler });
    assert.equal(outcome(byTarget.render_model), expected);
    assert.equal(byTarget.render_model.versionCheck, 'not_checked');
  }
});

test('supabase_app classifies healthy, failed and unknown', async () => {
  const only = { ...config, frontendUrl: '', renderUrl: '' };
  const cases = [
    [() => json({ response: 'Welcome to SG Homie' }), 'healthy:OK'],
    [() => json({ response: '   ' }), 'failed:INVALID_BODY'],
    [() => json({ choices: [] }), 'failed:INVALID_BODY'],
    [() => new Response('not json', { status: 200 }), 'failed:INVALID_BODY'],
    [() => json({ error: 'x' }, 500), 'failed:HTTP_5XX'],
    [() => json({ error: 'x' }, 401), 'unknown:UNEXPECTED_STATUS'],
    [() => json({ error: 'x' }, 404), 'unknown:UNEXPECTED_STATUS'],
    [() => json({ error: 'x' }, 429), 'unknown:UNEXPECTED_STATUS'],
    [() => json({ error: 'x' }, 400), 'unknown:UNEXPECTED_STATUS'],
    [() => { throw new Error('dns'); }, 'unknown:NETWORK_ERROR'],
  ];
  for (const [handler, expected] of cases) {
    const { byTarget } = await evaluate(only, { '/functions/v1/chatbot': handler });
    assert.equal(outcome(byTarget.supabase_app), expected);
  }
});

test('a timeout is unknown, never failed, and the request is aborted', async () => {
  const never = ({ signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const { byTarget } = await evaluate({ ...config, timeoutMs: 20 }, {
    '/': never, '/health': never, '/functions/v1/chatbot': never,
  });
  for (const target of ['frontend', 'render_model', 'supabase_app']) {
    assert.equal(outcome(byTarget[target]), 'unknown:TIMEOUT');
  }
});

test('a missing or invalid URL is unknown NOT_CONFIGURED / INVALID_CONFIG and makes no request', async () => {
  const { results, fetcher } = await evaluate(
    { ...config, frontendUrl: '', renderUrl: undefined, supabaseUrl: '   ' }, {});
  assert.deepEqual(results.map(outcome), ['unknown:NOT_CONFIGURED', 'unknown:NOT_CONFIGURED', 'unknown:NOT_CONFIGURED']);
  assert.equal(fetcher.calls.length, 0);

  const bad = await evaluate({ ...config, frontendUrl: 'ftp://x.example.test', renderUrl: 'not a url', supabaseUrl: '' }, {});
  assert.equal(outcome(bad.byTarget.frontend), 'unknown:INVALID_CONFIG');
  assert.equal(outcome(bad.byTarget.render_model), 'unknown:INVALID_CONFIG');
  assert.equal(bad.fetcher.calls.length, 0);
});

test('model version is requested only when token and expected version are both set', async () => {
  const base = { ...config, frontendUrl: '', supabaseUrl: '' };
  for (const partial of [{ renderToken: '' }, { expectedModelVersion: '' }]) {
    const { fetcher, byTarget } = await evaluate({ ...base, ...partial }, healthyRoutes());
    assert.deepEqual(fetcher.calls.map(c => c.path), ['/health']);
    assert.equal(byTarget.render_model.versionCheck, 'not_checked');
    assert.equal(byTarget.render_model.status, 'healthy');
  }
  const match = await evaluate(base, healthyRoutes());
  assert.deepEqual(match.fetcher.calls.map(c => c.path), ['/health', '/v1/valuation/model-info']);
  assert.equal(match.fetcher.calls[1].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(outcome(match.byTarget.render_model), 'healthy:OK');
  assert.equal(match.byTarget.render_model.versionCheck, 'matched');

  const mismatch = await evaluate(base, { ...healthyRoutes(), '/v1/valuation/model-info': () => json({ model_version: 'model-v0' }) });
  assert.equal(outcome(mismatch.byTarget.render_model), 'failed:MODEL_VERSION_MISMATCH');
  assert.equal(mismatch.byTarget.render_model.versionCheck, 'mismatch');

  const rejected = await evaluate(base, { ...healthyRoutes(), '/v1/valuation/model-info': () => new Response('', { status: 401 }) });
  assert.equal(outcome(rejected.byTarget.render_model), 'unknown:VERSION_CHECK_UNAVAILABLE');

  const invalid = await evaluate(base, { ...healthyRoutes(), '/v1/valuation/model-info': () => new Response('nope') });
  assert.equal(outcome(invalid.byTarget.render_model), 'failed:INVALID_BODY');

  const skipped = await evaluate(base, { ...healthyRoutes(), '/health': () => json({ status: 'ok', model_loaded: false }) });
  assert.equal(skipped.fetcher.calls.length, 1, 'no version request after a failed health check');
});

test('requests are read-only, one per target, without redirects, and the supabase request is the public sell onboarding request', async () => {
  const { fetcher } = await evaluate({ ...config, renderToken: '' }, healthyRoutes());
  assert.equal(fetcher.calls.length, 3);
  const byPath = Object.fromEntries(fetcher.calls.map(c => [c.path, c]));
  assert.equal(byPath['/'].init.method, 'GET');
  assert.equal(byPath['/'].url, 'https://app.example.test/', 'the query string is never sent');
  assert.equal(byPath['/health'].init.method, 'GET');
  assert.equal(byPath['/health'].init.headers?.Authorization, undefined);
  const chat = byPath['/functions/v1/chatbot'];
  assert.equal(chat.init.method, 'POST');
  assert.equal(chat.init.headers.Authorization, undefined, 'no Authorization header: the function treats the caller as signed out');
  assert.equal(chat.init.headers.apikey, KEY);
  assert.deepEqual(JSON.parse(chat.init.body), { intent: 'sell', message: 'sell', stream: false });
  for (const call of fetcher.calls) assert.equal(call.init.redirect, 'manual');
});

test('every result has a timestamp, a duration and a status; timing uses the injected clock', async () => {
  const state = { t: BASE };
  const fetcher = async () => { state.t += 250; return new Response(html); };
  const observations = await runChecks({ ...config, renderUrl: '', supabaseUrl: '' }, { fetcher, now: () => state.t });
  const results = observations.map(classify);
  for (const r of results) {
    assert.match(r.startedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.ok(Number.isInteger(r.durationMs) && r.durationMs >= 0);
    assert.ok(['healthy', 'failed', 'unknown'].includes(r.status));
    assert.ok(/^[A-Z0-9_]+$/.test(r.reason));
  }
  const frontend = results.find(r => r.target === 'frontend');
  assert.equal(frontend.startedAt, new Date(BASE).toISOString());
  assert.equal(frontend.durationMs, 250);
  assert.equal(frontend.httpStatus, 200);
  assert.equal(frontend.host, 'app.example.test');
});

test('reason codes are a fixed stable set mapping to one status each', () => {
  assert.deepEqual({ ...REASONS }, {
    OK: 'healthy',
    NOT_READY: 'failed',
    MODEL_VERSION_MISMATCH: 'failed',
    ROOT_ELEMENT_MISSING: 'failed',
    INVALID_BODY: 'failed',
    HTTP_5XX: 'failed',
    TIMEOUT: 'unknown',
    NETWORK_ERROR: 'unknown',
    UNEXPECTED_STATUS: 'unknown',
    REDIRECT_NOT_FOLLOWED: 'unknown',
    UPSTREAM_UNAVAILABLE: 'unknown',
    NOT_CONFIGURED: 'unknown',
    INVALID_CONFIG: 'unknown',
    VERSION_CHECK_UNAVAILABLE: 'unknown',
  });
});

test('JSON document has a fixed shape', async () => {
  const { results } = await evaluate(config, healthyRoutes());
  const doc = buildJson(results, '2026-11-16T00:00:00.000Z');
  assert.deepEqual(Object.keys(doc), ['schema_version', 'generated_at', 'overall', 'exit_code', 'summary', 'results']);
  assert.equal(doc.schema_version, 1);
  assert.equal(doc.overall, 'healthy');
  assert.equal(doc.exit_code, 0);
  assert.deepEqual(doc.summary, { healthy: 3, failed: 0, unknown: 0 });
  assert.deepEqual(doc.results.map(r => r.target), ['frontend', 'render_model', 'supabase_app']);
  for (const r of doc.results) {
    assert.deepEqual(Object.keys(r), ['target', 'status', 'reason', 'started_at', 'duration_ms', 'http_status', 'host', 'version_check']);
  }
});

test('tokens, keys, query strings, error text and response bodies never reach any output', async () => {
  const routes = {
    '/': () => new Response(html),
    '/health': () => json({ status: 'ok', model_loaded: true, leak: BODY_SECRET }),
    '/v1/valuation/model-info': () => json({ model_version: 'model-v0', leak: BODY_SECRET }),
    '/functions/v1/chatbot': () => { throw new Error(`failed with ${TOKEN} ${KEY} ${ERROR_SECRET}`); },
  };
  for (const variant of [routes, healthyRoutes(), {
    '/': () => new Response(`<html>${BODY_SECRET}</html>`, { status: 200 }),
    '/health': () => json({ detail: BODY_SECRET }, 503),
    '/functions/v1/chatbot': () => new Response(BODY_SECRET, { status: 200 }),
  }]) {
    const { results } = await evaluate(config, variant);
    const all = [
      renderTable(results), renderMarkdown(results),
      JSON.stringify(buildJson(results, '2026-11-16T00:00:00.000Z')), JSON.stringify(results),
    ].join('\n');
    for (const secret of SECRETS) assert.ok(!all.includes(secret), `output leaked ${secret}`);
    assert.ok(!all.includes('access_token'));
    assert.ok(!all.includes('?'));
  }
});

test('fixture input carrying secrets and extra fields cannot leak through report output', () => {
  const dirty = {
    target: 'frontend', startedAt: '2026-11-16T00:00:00.000Z', durationMs: 5, httpStatus: 200,
    errorKind: null, host: `app.example.test/?token=${QUERY_SECRET}`, body: BODY_SECRET,
    authorization: `Bearer ${TOKEN}`, fields: { rootPresent: true, raw: BODY_SECRET },
  };
  const results = [classify(dirty)];
  const all = renderTable(results) + renderMarkdown(results) + JSON.stringify(buildJson(results, '2026-11-16T00:00:00.000Z'));
  for (const secret of [BODY_SECRET, TOKEN, QUERY_SECRET]) assert.ok(!all.includes(secret));
});

test('exit code is 1 only when a target is failed', async () => {
  const run = async routes => {
    const fetcher = mockFetch(routes);
    return runMonitor({ env: envFor(config), argv: [], fetcher, now: () => BASE });
  };
  assert.equal((await run(healthyRoutes())).exitCode, 0);
  assert.equal((await run({ ...healthyRoutes(), '/health': () => json({ status: 'ok', model_loaded: false }) })).exitCode, 1);
  const unknownOnly = await run({
    '/': () => { throw new Error('down'); }, '/health': () => new Response('', { status: 401 }),
    '/functions/v1/chatbot': () => json({}, 429),
  });
  assert.equal(unknownOnly.exitCode, 0);
  const none = await runMonitor({ env: {}, argv: [], fetcher: mockFetch({}), now: () => BASE });
  assert.equal(none.exitCode, 0);
  assert.equal(none.json.overall, 'unknown');
});

function envFor(c) {
  return {
    MONITOR_FRONTEND_URL: c.frontendUrl, MONITOR_RENDER_URL: c.renderUrl, MONITOR_SUPABASE_URL: c.supabaseUrl,
    MONITOR_SUPABASE_ANON_KEY: c.supabaseAnonKey, MONITOR_RENDER_TOKEN: c.renderToken,
    MONITOR_EXPECTED_MODEL_VERSION: c.expectedModelVersion, MONITOR_TIMEOUT_MS: String(c.timeoutMs),
  };
}

test('config loads from the environment with a bounded timeout', () => {
  assert.deepEqual(loadMonitorConfig({ ...envFor(config), MONITOR_TIMEOUT_MS: '5000' }), { ...config, timeoutMs: 5000 });
  assert.equal(loadMonitorConfig({ MONITOR_TIMEOUT_MS: '10' }).timeoutMs, 60_000);
  assert.equal(loadMonitorConfig({}).timeoutMs, 60_000);
  assert.equal(loadMonitorConfig({ MONITOR_TIMEOUT_MS: 'abc' }).timeoutMs, 60_000);
  assert.equal(loadMonitorConfig({ MONITOR_TIMEOUT_MS: '999999999' }).timeoutMs, 60_000);
});

// Expected statuses are written out here, independently of the fixture files.
const EXPECTED_FIXTURES = {
  'all-healthy': { frontend: 'healthy', render_model: 'healthy', supabase_app: 'healthy' },
  'render-not-ready': { frontend: 'healthy', render_model: 'failed', supabase_app: 'healthy' },
  'render-version-mismatch': { frontend: 'healthy', render_model: 'failed', supabase_app: 'healthy' },
  'frontend-timeout': { frontend: 'unknown', render_model: 'healthy', supabase_app: 'healthy' },
  'supabase-unexpected-status': { frontend: 'healthy', render_model: 'healthy', supabase_app: 'unknown' },
  'render-waking': { frontend: 'healthy', render_model: 'unknown', supabase_app: 'healthy' },
  'nothing-configured': { frontend: 'unknown', render_model: 'unknown', supabase_app: 'unknown' },
};

test('fixture mode makes no fetch call and each fixture yields its expected statuses', async () => {
  const dir = fileURLToPath(new URL('../scripts/monitor/fixtures/', import.meta.url));
  assert.deepEqual(readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort(),
    Object.keys(EXPECTED_FIXTURES).sort());
  for (const [name, expected] of Object.entries(EXPECTED_FIXTURES)) {
    let fetchCalls = 0;
    const fetcher = () => { fetchCalls++; throw new Error('network is forbidden in fixture mode'); };
    const { json: doc, exitCode } = await runMonitor({ env: envFor(config), argv: ['--fixtures', name], fetcher, now: () => BASE });
    assert.equal(fetchCalls, 0, name);
    assert.deepEqual(Object.fromEntries(doc.results.map(r => [r.target, r.status])), expected, name);
    assert.equal(exitCode, doc.summary.failed > 0 ? 1 : 0, name);
  }
});

test('unknown or path-like fixture names are rejected without reading outside the fixture folder', async () => {
  for (const name of ['../service-monitor', 'missing', 'a/b', '']) {
    const result = await runMonitor({ env: {}, argv: ['--fixtures', name], fetcher: () => { throw new Error('no'); }, now: () => BASE });
    assert.equal(result.exitCode, 2);
    assert.match(result.stdout, /^FIXTURE_NOT_FOUND\n?$/);
  }
});

test('CLI in fixture mode prints the table, writes the JSON file and exits 1 for a failed scenario', () => {
  const dir = mkdtempSync(join(tmpdir(), 'service-monitor-'));
  try {
    const out = join(dir, 'report.json');
    const script = fileURLToPath(new URL('../scripts/service-monitor.mjs', import.meta.url));
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith('MONITOR_')) delete env[key];
    const run = spawnSync(process.execPath, [script, '--fixtures', 'render-not-ready', '--json', out], { encoding: 'utf8', env });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /render_model\s+failed\s+NOT_READY/);
    const doc = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(doc.exit_code, 1);
    assert.equal(doc.results.find(r => r.target === 'render_model').reason, 'NOT_READY');
    const healthy = spawnSync(process.execPath, [script, '--fixtures', 'all-healthy'], { encoding: 'utf8', env });
    assert.equal(healthy.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('render_model 502, 503 without the signal and 504 are unknown UPSTREAM_UNAVAILABLE', async () => {
  const only = { ...config, frontendUrl: '', supabaseUrl: '' };
  for (const handler of [
    () => new Response('bad gateway', { status: 502 }),
    () => json({ detail: 'something else' }, 503),
    () => new Response('', { status: 503 }),
    () => new Response('timeout', { status: 504 }),
  ]) {
    const { byTarget, fetcher } = await evaluate(only, { '/health': handler });
    assert.equal(outcome(byTarget.render_model), 'unknown:UPSTREAM_UNAVAILABLE');
    assert.equal(fetcher.calls.length, 1);
  }
});

test('render_model 503 with the not-ready signal stays failed NOT_READY and 500 stays failed HTTP_5XX', async () => {
  const only = { ...config, frontendUrl: '', supabaseUrl: '' };
  const ready = await evaluate(only, { '/health': () => json({ detail: 'Valuation model is unavailable.' }, 503) });
  assert.equal(outcome(ready.byTarget.render_model), 'failed:NOT_READY');
  for (const status of [500, 501, 507]) {
    const { byTarget } = await evaluate(only, { '/health': () => new Response('x', { status }) });
    assert.equal(outcome(byTarget.render_model), 'failed:HTTP_5XX');
  }
});

test('frontend and supabase_app keep every 5xx as failed HTTP_5XX', async () => {
  for (const status of [500, 502, 503, 504]) {
    const { byTarget } = await evaluate({ ...config, renderUrl: '' }, {
      '/': () => new Response('x', { status }), '/functions/v1/chatbot': () => json({}, status),
    });
    assert.equal(outcome(byTarget.frontend), 'failed:HTTP_5XX');
    assert.equal(outcome(byTarget.supabase_app), 'failed:HTTP_5XX');
  }
});

test('model-version request: 502/503/504 are unknown VERSION_CHECK_UNAVAILABLE, other 5xx stay failed', async () => {
  const base = { ...config, frontendUrl: '', supabaseUrl: '' };
  for (const status of [502, 503, 504]) {
    const { byTarget } = await evaluate(base, { ...healthyRoutes(), '/v1/valuation/model-info': () => new Response('x', { status }) });
    assert.equal(outcome(byTarget.render_model), 'unknown:VERSION_CHECK_UNAVAILABLE');
    assert.equal(byTarget.render_model.versionCheck, 'unavailable');
  }
  const { byTarget } = await evaluate(base, { ...healthyRoutes(), '/v1/valuation/model-info': () => new Response('x', { status: 500 }) });
  assert.equal(outcome(byTarget.render_model), 'failed:HTTP_5XX');
});

test('render-waking fixture exits 0 with render_model unknown', async () => {
  const { json: doc, exitCode } = await runMonitor({ env: {}, argv: ['--fixtures', 'render-waking'],
    fetcher: () => { throw new Error('no network'); }, now: () => BASE });
  assert.equal(exitCode, 0);
  const render = doc.results.find(r => r.target === 'render_model');
  assert.equal(render.status, 'unknown');
  assert.equal(render.reason, 'UPSTREAM_UNAVAILABLE');
  assert.equal(render.http_status, 503);
});
