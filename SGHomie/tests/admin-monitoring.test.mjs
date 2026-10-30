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
const request = (body = {}) => edgeRequest(body, { headers: { Authorization: 'Bearer synthetic-user-session' } });
const interactionId = 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b';

async function fixture(options = {}) {
  const reads = [];
  const probes = [];
  const writes = [];
  const rpcCalls = [];
  const { handler } = await loadEdgeFunction('admin-monitoring', {
    env: { ...env, ...options.env },
    createClient(_url, key, config) {
      reads.push({ type: 'client', key, authorization: config?.global?.headers?.Authorization });
      if (key === env.SUPABASE_ANON_KEY) return { auth: { getUser: async () => ({
        data: { user: options.invalidAuth ? null : { id: 'synthetic-admin' } }, error: null,
      }) } };
      assert.equal(key, env.SUPABASE_SERVICE_ROLE_KEY);
      return {
        async rpc(name, args) {
          rpcCalls.push({ name, args });
          if (name === 'monitoring_dashboard_summary') return options.summaryError
            ? { data: null, error: new Error('private-summary-error') }
            : { data: { version: 2, range: { range: args.p_range }, metrics: {}, valuation: {}, chatbot: {}, alerts: [], health: [], retention: { target_days: 90 } }, error: null };
          if (name === 'record_monitoring_alert') return { data: null, error: null };
          if (name === 'transition_monitoring_alert') return options.transitionError
            ? { data: null, error: { code: 'P0002' } }
            : { data: { id: args.p_alert_id, severity: 'critical', source: 'render_model', category: 'model_not_ready', state: args.p_action === 'resolve' ? 'resolved' : 'acknowledged', occurrence_count: 1, latest_request_id: null }, error: null };
          throw new Error(`unexpected RPC ${name}`);
        },
        from(table) {
          return {
            insert(record) {
              writes.push({ type: 'insert', table, record });
              return Promise.resolve({ error: options.failedTable === table ? new Error('private-insert-error') : null });
            },
            select(columns) {
              if (table === 'user_profiles') return {
                eq(column, id) {
                  reads.push({ type: 'role', column, id });
                  return { maybeSingle: async () => ({ data: options.nonAdmin ? { is_admin: false } : { is_admin: true }, error: options.roleError ? new Error('private-role-error') : null }) };
                },
              };
              return {
                eq(column, value) {
                  reads.push({ type: 'detail', table, columns, column, value });
                  return { maybeSingle: async () => ({
                    data: options.detailMissing ? null : {
                      request_id: value, created_at: '2026-10-31T00:00:00Z', completed_at: '2026-10-31T00:00:01Z',
                      status: 'failure', failure_category: 'RENDER_UNAVAILABLE', model_version: 'model-v1',
                      prediction_sanity: 'not_checked', total_edge_ms: 10, authentication_ms: 2,
                      database_lookup_ms: 1, request_construction_ms: null, render_fetch_ms: null,
                      property_id: 'must-not-be-selected', user_id: 'private-user', raw_response: 'private',
                    }, error: null,
                  }) };
                },
                gte(column, start) {
                  return {
                    order(orderColumn) {
                      return {
                        async limit(limit) {
                          reads.push({ type: 'monitoring', table, columns, column, start, orderColumn, limit });
                          if (options.failedTable === table) return { data: null, error: new Error('private-database-error') };
                          const data = table === 'chat_interactions'
                            ? [{ request_id: interactionId, created_at: '2026-10-31T00:00:00Z', status: 'provider_error', error_code: 'provider_http_503', total_latency_ms: 840, user_id: 'private-user', user_message_redacted: 'secret@example.invalid' }]
                            : table === 'chat_provider_calls' ? [{ status: 'provider_error', error_code: 'private-error-detail', latency_ms: 600 }]
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
  return { handler, reads, probes, writes, rpcCalls, options };
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
  const { handler, reads, probes, writes, rpcCalls } = await fixture();
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
  assert.equal(body.chatbot.provider_calls.error_codes.OTHER, 1);
  assert.equal(body.chatbot.recent_interactions[0].error_code, 'provider_http_503');
  assert.equal(body.chatbot.feedback.ratings.negative, 1);
  assert.equal(body.chatbot.recent_interactions[0].request_id, interactionId);
  assert.equal(body.chatbot.sample_median_latency_ms, 840);
  assert.equal(body.dashboard_v2.version, 2);
  assert.equal(body.dashboard_v2.range.range, '24h');
  assert.equal(writes.filter(write => write.table === 'service_health_checks').length, 1);
  assert.equal(writes[0].record.source, 'admin_view');
  assert.equal(writes[0].record.status, 'healthy');
  assert.equal(rpcCalls.some(call => call.name === 'record_monitoring_alert'), false);
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

test('Render uncertainty stays unknown; only explicit not-ready and confirmed version mismatch create incidents', async () => {
  for (const [options, expected] of [
    [{ networkError: true }, 'unavailable'],
    [{ healthStatus: 503 }, 'unavailable'],
    [{ healthStatus: 500, healthBody: { status: 'not_ready', model_loaded: false } }, 'unavailable'],
    [{ healthBody: { status: 'ok', model_loaded: 'yes' } }, 'unavailable'],
    [{ env: { VALUATION_API_URL: undefined } }, 'not_configured'],
    [{ env: { VALUATION_API_URL: 'http://external.example.test/v1/valuation/predict' } }, 'not_configured'],
  ]) {
    const { handler, writes, rpcCalls } = await fixture(options);
    const body = await (await handler(request())).json();
    assert.equal(body.valuation.render_state, expected);
    assert.equal(body.valuation.version_match, 'unknown');
    if (options.networkError) {
      assert.equal(writes[0].record.status, 'unknown');
      assert.equal(typeof writes[0].record.duration_ms, 'number');
      assert.equal(rpcCalls.some(call => call.name === 'record_monitoring_alert'), false);
    }
  }
  const mismatch = await fixture({ modelVersion: 'model-v2' });
  const body = await (await mismatch.handler(request())).json();
  assert.equal(body.valuation.version_match, 'mismatch');
  assert.equal(body.valuation.loaded_model_version, 'model-v2');
  const missing = await fixture({ env: { VALUATION_EXPECTED_MODEL_VERSION: undefined, VALUATION_SERVICE_TOKEN: undefined } });
  const missingBody = await (await missing.handler(request())).json();
  assert.equal(missingBody.valuation.version_match, 'unknown');
  assert.equal(missingBody.valuation.loaded_model_version, null);

  const unready = await fixture({ healthStatus: 503, healthBody: { detail: 'Valuation model is unavailable.' } });
  const unreadyResponse = await (await unready.handler(request())).json();
  assert.equal(unreadyResponse.dashboard_v2.version, 2);
  assert.equal(unready.rpcCalls.filter(call => call.name === 'record_monitoring_alert').length, 1);
  assert.equal(unready.rpcCalls.find(call => call.name === 'record_monitoring_alert').args.p_category, 'model_not_ready');

  const invalid503 = await fixture({ healthStatus: 503, healthBody: { detail: 'upstream timeout' } });
  await invalid503.handler(request());
  assert.equal(invalid503.rpcCalls.filter(call => call.name === 'record_monitoring_alert').length, 0);

  const confirmedMismatch = await fixture({ modelVersion: 'model-v2' });
  await confirmedMismatch.handler(request());
  assert.equal(confirmedMismatch.rpcCalls.filter(call => call.name === 'record_monitoring_alert').length, 1);
  assert.equal(confirmedMismatch.rpcCalls[0].args.p_category, 'model_version_mismatch');
  // The known alert remains in the database. A later healthy observation must
  // update health evidence without invoking a lifecycle transition.
  confirmedMismatch.options.modelVersion = 'model-v1';
  await confirmedMismatch.handler(request());
  assert.equal(confirmedMismatch.writes.at(-1).record.status, 'healthy');
  assert.equal(confirmedMismatch.rpcCalls.filter(call => call.name === 'record_monitoring_alert').length, 1);
  assert.equal(confirmedMismatch.rpcCalls.some(call => call.name === 'transition_monitoring_alert'), false);
});

test('every admin action is independently authorized before reads, probes or writes', async () => {
  for (const body of [
    { action: 'summary', range: '1h' },
    { action: 'detail', request_id: interactionId },
    { action: 'acknowledge', alert_id: 1 },
    { action: 'resolve', alert_id: 1 },
  ]) {
    const guest = await fixture();
    assert.equal((await guest.handler(edgeRequest(body))).status, 401);
    assert.equal(guest.probes.length, 0);
    assert.equal(guest.writes.length, 0);
    const nonAdmin = await fixture({ nonAdmin: true });
    assert.equal((await nonAdmin.handler(request(body))).status, 403);
    assert.equal(nonAdmin.probes.length, 0);
    assert.equal(nonAdmin.writes.length, 0);
  }
});

test('range, request detail and alert actions validate input and return safe metadata', async () => {
  const fixtureState = await fixture();
  assert.equal((await fixtureState.handler(request({ action: 'summary', range: '2h' }))).status, 400);
  assert.equal((await fixtureState.handler(request({ action: 'detail', request_id: 'not-a-uuid' }))).status, 400);
  assert.equal((await fixtureState.handler(request({ action: 'acknowledge', alert_id: 0 }))).status, 400);

  const detail = await (await fixtureState.handler(request({ action: 'detail', request_id: interactionId }))).json();
  assert.equal(detail.dashboard_v2.request_detail.request_id, interactionId);
  assert.doesNotMatch(JSON.stringify(detail), /must-not-be-selected|private-user|raw_response/);
  const ack = await (await fixtureState.handler(request({ action: 'acknowledge', alert_id: 7 }))).json();
  assert.equal(ack.dashboard_v2.alert.state, 'acknowledged');
  const resolve = await (await fixtureState.handler(request({ action: 'resolve', alert_id: 7 }))).json();
  assert.equal(resolve.dashboard_v2.alert.state, 'resolved');
  assert.equal(fixtureState.rpcCalls.filter(call => call.name === 'transition_monitoring_alert').length, 2);
});

test('legacy no-body request remains compatible when the advanced summary is unavailable', async () => {
  const { handler } = await fixture({ summaryError: true });
  const noBody = new Request('https://functions.example.test/fixture', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-user-session' },
  });
  const response = await handler(noBody);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(typeof body.checked_at, 'string');
  assert.equal(body.chatbot.sample_median_latency_ms, 840);
  assert.deepEqual(body.dashboard_v2, { version: 2, state: 'unavailable', reason: 'monitoring_data_unavailable' });
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
