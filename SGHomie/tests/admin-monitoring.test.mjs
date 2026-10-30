import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { edgeRequest, loadEdgeFunction } from './helpers/edge-function.mjs';
import { componentHarness, content } from './helpers/frontend-component.mjs';
import {
  formatMonitoringDuration, formatMonitoringTime, parseMonitoringSnapshot,
} from '../FrontEnd/src/lib/adminMonitoring.ts';

const env = {
  SUPABASE_URL: 'https://database.example.test',
  SUPABASE_ANON_KEY: 'synthetic-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-secret',
  VALUATION_API_URL: 'https://render.example.test/v1/valuation/predict',
  VALUATION_SERVICE_TOKEN: 'synthetic-render-secret',
  VALUATION_EXPECTED_MODEL_VERSION: 'model-v1',
};
const request = () => edgeRequest({}, { headers: { Authorization: 'Bearer synthetic-user-session' } });
const interactionId = 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b';

async function fixture(options = {}) {
  const reads = [];
  const probes = [];
  const { handler } = await loadEdgeFunction('admin-monitoring', {
    env: { ...env, ...options.env },
    createClient(_url, key, config) {
      reads.push({ type: 'client', key, authorization: config?.global?.headers?.Authorization });
      if (key === env.SUPABASE_ANON_KEY) return { auth: { getUser: async () => ({
        data: { user: options.invalidAuth ? null : { id: 'synthetic-admin' } }, error: null,
      }) } };
      assert.equal(key, env.SUPABASE_SERVICE_ROLE_KEY);
      return {
        from(table) {
          return {
            select(columns) {
              if (table === 'user_profiles') return {
                eq(column, id) {
                  reads.push({ type: 'role', column, id });
                  return { maybeSingle: async () => ({ data: options.nonAdmin ? { is_admin: false } : { is_admin: true }, error: options.roleError ? new Error('private-role-error') : null }) };
                },
              };
              return {
                gte(column, start) {
                  return {
                    order(orderColumn) {
                      return {
                        async limit(limit) {
                          reads.push({ type: 'monitoring', table, columns, column, start, orderColumn, limit });
                          if (options.failedTable === table) return { data: null, error: new Error('private-database-error') };
                          const data = table === 'chat_interactions'
                            ? [{ request_id: interactionId, created_at: '2026-10-31T00:00:00Z', status: 'provider_error', error_code: 'PROVIDER_UNAVAILABLE', total_latency_ms: 840, user_id: 'private-user', user_message_redacted: 'secret@example.invalid' }]
                            : table === 'chat_provider_calls' ? [{ status: 'provider_error', error_code: 'UPSTREAM', latency_ms: 600 }]
                              : [{ rating: 'negative', comment_redacted: 'secret@example.invalid' }];
                          return { data, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    async fetch(url, init) {
      probes.push({ url: String(url), authorization: init.headers?.Authorization ?? null, signal: init.signal, redirect: init.redirect });
      if (options.networkError) throw new Error('private-network-error');
      if (String(url).endsWith('/health')) return Response.json(options.healthBody ?? { status: 'ok', model_loaded: true }, { status: options.healthStatus ?? 200 });
      return Response.json(options.modelBody ?? { model_version: options.modelVersion ?? 'model-v1', private_bundle_url: 'https://private.invalid' }, { status: options.modelStatus ?? 200 });
    },
  });
  return { handler, reads, probes };
}

test('admin monitoring denies guests and non-admins before monitoring reads or Render probes', async () => {
  const guest = await fixture();
  assert.equal((await guest.handler(edgeRequest({}))).status, 401);
  assert.equal(guest.reads.length, 0);
  const invalid = await fixture({ invalidAuth: true });
  assert.equal((await invalid.handler(request())).status, 401);
  assert.deepEqual(invalid.reads.map((item) => item.type), ['client']);
  const nonAdmin = await fixture({ nonAdmin: true });
  assert.equal((await nonAdmin.handler(request())).status, 403);
  assert.equal(nonAdmin.reads.filter((item) => item.type === 'monitoring').length, 0);
  assert.equal(nonAdmin.probes.length, 0);
  const roleError = await fixture({ roleError: true });
  assert.equal((await roleError.handler(request())).status, 503);
  assert.equal(roleError.reads.filter((item) => item.type === 'monitoring').length, 0);
});

test('admin monitoring returns only safe bounded samples and readiness with version match', async () => {
  const { handler, reads, probes } = await fixture();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.valuation.render_state, 'ready');
  assert.equal(body.valuation.version_match, 'match');
  assert.deepEqual(body.valuation.canary, { state: 'not_recorded', last_run_at: null });
  assert.equal(body.valuation.history_state, 'unavailable');
  assert.equal(body.chatbot.interaction_statuses.provider_error, 1);
  assert.equal(body.chatbot.provider_calls.statuses.provider_error, 1);
  assert.equal(body.chatbot.provider_calls.error_codes.UPSTREAM, 1);
  assert.equal(body.chatbot.feedback.ratings.negative, 1);
  assert.equal(body.chatbot.recent_interactions[0].request_id, interactionId);
  assert.equal(body.chatbot.sample_median_latency_ms, 840);
  assert.ok(reads.filter((item) => item.type === 'monitoring').every((item) => item.limit === 100 && !item.columns.includes('message') && !item.columns.includes('user_id') && !item.columns.includes('comment')));
  assert.equal(reads.find((item) => item.type === 'role').id, 'synthetic-admin');
  assert.equal(probes.length, 2);
  assert.equal(probes[0].authorization, null);
  assert.equal(probes[1].authorization, 'Bearer synthetic-render-secret');
  assert.ok(probes.every((probe) => probe.signal));
  assert.ok(probes.every((probe) => probe.redirect === 'error'));
  assert.ok(probes.every((probe) => probe.url.startsWith('https://render.example.test/')));
  const serialized = JSON.stringify(body);
  for (const privateValue of ['synthetic-service-secret', 'synthetic-render-secret', 'synthetic-user-session', 'secret@example.invalid', 'private-user', 'private_bundle_url']) {
    assert.doesNotMatch(serialized, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.ok(parseMonitoringSnapshot(body));
});

test('Render failure, not-ready model, malformed health and version mismatch never become full-path health', async () => {
  for (const [options, expected] of [
    [{ networkError: true }, 'unavailable'],
    [{ healthStatus: 503 }, 'not_ready'],
    [{ healthBody: { status: 'ok', model_loaded: 'yes' } }, 'unavailable'],
    [{ env: { VALUATION_API_URL: undefined } }, 'not_configured'],
    [{ env: { VALUATION_API_URL: 'http://external.example.test/v1/valuation/predict' } }, 'not_configured'],
  ]) {
    const { handler } = await fixture(options);
    const body = await (await handler(request())).json();
    assert.equal(body.valuation.render_state, expected);
    assert.equal(body.valuation.version_match, 'unknown');
  }
  const mismatch = await fixture({ modelVersion: 'model-v2' });
  const body = await (await mismatch.handler(request())).json();
  assert.equal(body.valuation.version_match, 'mismatch');
  assert.equal(body.valuation.loaded_model_version, 'model-v2');
  const missing = await fixture({ env: { VALUATION_EXPECTED_MODEL_VERSION: undefined, VALUATION_SERVICE_TOKEN: undefined } });
  const missingBody = await (await missing.handler(request())).json();
  assert.equal(missingBody.valuation.version_match, 'unknown');
  assert.equal(missingBody.valuation.loaded_model_version, null);
});

test('telemetry read failure remains visibly unavailable and does not leak database errors', async () => {
  const { handler } = await fixture({ failedTable: 'chat_interactions' });
  const body = await (await handler(request())).json();
  assert.equal(body.database.state, 'unknown');
  assert.equal(body.chatbot.telemetry_state, 'unavailable');
  assert.equal(body.chatbot.sampled_interactions, null);
  assert.equal(body.chatbot.sample_median_latency_ms, null);
  assert.doesNotMatch(JSON.stringify(body), /private-database-error/);
});

test('monitoring parser and formatters reject malformed data and preserve unknown states', async () => {
  const { handler } = await fixture();
  const body = await (await handler(request())).json();
  assert.equal(parseMonitoringSnapshot({ ...body, valuation: { ...body.valuation, render_state: 'invented-green' } }), null);
  assert.equal(parseMonitoringSnapshot({ ...body, chatbot: { ...body.chatbot, sample_median_latency_ms: -1 } }), null);
  assert.equal(parseMonitoringSnapshot({ ...body, checked_at: 'no date' }), null);
  assert.equal(formatMonitoringDuration(null), 'Unavailable');
  assert.equal(formatMonitoringDuration(24.6), '25 ms');
  assert.equal(formatMonitoringTime(null), 'Unavailable');
  assert.match(formatMonitoringTime('2026-10-31T00:00:00Z'), /31 Oct 2026/);
});

test('monitoring tab has loading, error, unknown and safe request ID views', async () => {
  const { handler } = await fixture();
  const body = await (await handler(request())).json();
  const routeSource = readFileSync(new URL('../FrontEnd/src/pages/AdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(routeSource, /activeTab === 'monitoring' && <AdminMonitoring \/>/);
  assert.match(routeSource, /error && activeTab !== 'monitoring'/);

  let result = { data: body, error: null };
  const app = componentHarness(new URL('../FrontEnd/src/components/AdminMonitoring.tsx', import.meta.url), {
    'lucide-react': { Activity: 'Activity', RefreshCw: 'RefreshCw' },
    '../lib/supabase': { supabase: { functions: { invoke: async (name) => {
      assert.equal(name, 'admin-monitoring');
      return result;
    } } } },
    '../lib/adminMonitoring': { formatMonitoringDuration, formatMonitoringTime, parseMonitoringSnapshot },
  });
  assert.match(content(app.render()), /Checking monitoring sources/);
  await app.effects();
  await setImmediate();
  const rendered = content(app.render());
  assert.match(rendered, /System Monitoring/);
  assert.match(rendered, /No outside-in browser check/);
  assert.match(rendered, /Not recorded/);
  assert.match(rendered, new RegExp(interactionId));
  assert.doesNotMatch(rendered, /secret@example.invalid/);
  result = { data: null, error: new Error('private failure') };
  app.find((node) => node.type === 'button' && content(node).includes('Refresh checks')).props.onClick();
  app.render();
  await app.effects();
  await setImmediate();
  assert.match(content(app.render()), /Monitoring could not be loaded/);
  assert.doesNotMatch(content(app.render()), /private failure/);
});
