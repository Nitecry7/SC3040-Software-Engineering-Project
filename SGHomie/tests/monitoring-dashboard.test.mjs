import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { componentHarness, content, deferred, nodes } from './helpers/frontend-component.mjs';
import {
  formatDuration, formatSgt, isUnsupportedMonitoringAction, parseHealthCheckResult,
  parseDashboard, parseMonitoringBadge, parseMonitoringDetail, percentileLabel,
} from '../FrontEnd/src/lib/monitoringDashboard.ts';

const stamp = '2026-10-31T00:00:00Z';
const stats = (n, p50 = 100, p95 = 300, p99 = 500) => ({
  sample_count: n,
  p50: { state: n >= 5 ? 'available' : 'insufficient_samples', value_ms: n >= 5 ? p50 : null },
  p95: { state: n >= 20 ? 'available' : 'insufficient_samples', value_ms: n >= 20 ? p95 : null },
  p99: { state: n >= 100 ? 'available' : 'insufficient_samples', value_ms: n >= 100 ? p99 : null },
});
const dashboard = (range, count = 20) => ({
  dashboard_v2: {
    version: 2, generated_at: stamp, range: { range, start: stamp, end: '2026-10-31T01:00:00Z' },
    aggregation_timezone: 'Asia/Singapore',
    metrics: { valuation_total_edge: stats(count), chat_total_interaction: stats(count),
      chat_provider: stats(4), chat_tool: stats(4), chat_first_output: stats(4), provider_call: stats(4),
      valuation_authentication: stats(count), valuation_database_lookup: stats(count),
      valuation_request_construction: stats(count), valuation_render_fetch: stats(count),
      render_total: { state: 'unavailable' }, catboost_prediction: { state: 'unavailable' },
      conformal_interval: { state: 'unavailable' } },
    valuation: { recorded_events: count, successful_events: count, failed_events: 0,
      failure_categories: {}, prediction_sanity_failures: 0,
      series: [{ bucket_start: stamp, label: 'Today so far', request_count: count,
        success_count: count, failure_count: 0, chatbot_request_count: 2,
        chatbot_success_count: 2, chatbot_failure_count: 0, total_edge: stats(count),
        chatbot_total_interaction: stats(2) }] },
    chatbot: { recorded_interactions: 2, successful_interactions: 2, failure_categories: {},
      quota_outcomes: {}, provider_calls: 2, provider_statuses: { success: 2 },
      feedback_count: 0, feedback_ratings: {} },
    alerts: [], unresolved_alerts: [], unresolved_alert_count: 0, active_unacknowledged_alert_count: 0,
    health: [{ checked_at: stamp, service: 'render_model', status: 'healthy', source: 'admin_view',
      duration_ms: 20, expected_model_version: 'model-v1', loaded_model_version: 'model-v1',
      failure_category: null }],
    retention: { target_days: 90, cleanup_scheduling: 'not_verified',
      oldest_valuation_event_at: stamp, oldest_service_health_check_at: stamp,
      oldest_resolved_alert_at: null },
    recent_valuation_requests: [],
  },
});
const flush = async (app) => { await setImmediate(); app.render(); await app.effects(); await setImmediate(); };
function makeApp(invoke) {
  const icons = Object.fromEntries(['Activity', 'Info', 'RefreshCw', 'Search', 'ShieldAlert', 'X'].map((name) => [name, name]));
  const props = {
    onBadgeChanged() {}, view: 'overview', range: '7d',
    onViewChange(view) { props.view = view; },
    onRangeChange(range) { props.range = range; },
  };
  return componentHarness(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), {
    'lucide-react': icons,
    recharts: Object.fromEntries(['Area', 'AreaChart', 'Bar', 'BarChart', 'CartesianGrid', 'Cell', 'Legend', 'ResponsiveContainer', 'Tooltip', 'XAxis', 'YAxis'].map((name) => [name, name])),
    '../lib/supabase': { supabase: { functions: { invoke } } },
    '../lib/monitoringDashboard': { formatCount: (n) => String(n), formatDuration, formatSgt,
      isUnsupportedMonitoringAction, parseHealthCheckResult, parseDashboard, parseMonitoringDetail, percentileLabel },
  }, props);
}
const click = (app, text) => app.find((node) => node.type === 'button' && content(node).includes(text)).props.onClick();

test('versioned dashboard rejects malformed values and treats an older backend as an upgrade state', () => {
  assert.equal(parseDashboard({ checked_at: stamp }), 'upgrade_required');
  assert.equal(parseDashboard({ dashboard_v2: { version: 2, state: 'unavailable' } }), 'upgrade_required');
  const complete = dashboard('7d');
  assert.equal(parseDashboard(complete)?.range.range, '7d');
  assert.equal(parseDashboard({ dashboard_v2: { ...complete.dashboard_v2, recent_valuation_requests: undefined } }), null);
  assert.equal(parseDashboard({ dashboard_v2: { ...complete.dashboard_v2, recent_valuation_requests: undefined, unresolved_alerts: undefined } }), null);
  assert.equal(parseDashboard({ dashboard_v2: { ...complete.dashboard_v2, valuation: { ...complete.dashboard_v2.valuation, recorded_events: -1 } } }), null);
  assert.equal(parseDashboard({ dashboard_v2: { ...complete.dashboard_v2, metrics: {} } }), null);
  assert.equal(percentileLabel(stats(4), 'p50'), 'Insufficient samples');
  assert.equal(percentileLabel(stats(5), 'p50'), '100 ms');
  assert.equal(percentileLabel(stats(19), 'p95'), 'Insufficient samples');
  assert.equal(percentileLabel(stats(20), 'p95'), '300 ms');
  assert.equal(percentileLabel(stats(99), 'p99'), 'Insufficient samples');
  assert.equal(percentileLabel(stats(100), 'p99'), '500 ms');
  assert.equal(percentileLabel({ state: 'unavailable' }, 'p50'), 'Unavailable');
  assert.equal(formatDuration(1800), '1.8 s');
  assert.match(formatSgt(stamp), /31 Oct 2026/);
  assert.equal(parseMonitoringBadge({ dashboard_v2: { version: 2, active_unacknowledged_alert_count: 3 } }), 3);
  assert.equal(parseMonitoringBadge({ dashboard_v2: { version: 2, active_unacknowledged_alert_count: 0 } }), null);
  assert.equal(parseMonitoringBadge(null), null);
  assert.equal(isUnsupportedMonitoringAction({ context: { status: 400 } }), true);
  assert.equal(isUnsupportedMonitoringAction({ context: { status: 503 } }), false);
  assert.equal(parseHealthCheckResult({ dashboard_v2: { health_check_result: { status: 'unknown', observed_at: stamp, recorded: false } } })?.recorded, false);
  const id = 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b';
  const safeDetail = { dashboard_v2: { version: 2, request_detail: {
    request_id: id, created_at: stamp, completed_at: stamp, status: 'success',
    failure_category: null, total_edge_ms: 10, model_version: 'model-v1',
    prediction_sanity: 'passed', authentication_ms: 1, database_lookup_ms: 2,
    request_construction_ms: 3, render_fetch_ms: 4, property_id: 'private',
  } } };
  assert.equal(parseMonitoringDetail(safeDetail, id)?.request_id, id);
  assert.doesNotMatch(JSON.stringify(parseMonitoringDetail(safeDetail, id)), /property_id|private/);
  assert.equal(parseMonitoringDetail(safeDetail, 'another-id'), null);
  assert.equal(parseMonitoringDetail({ dashboard_v2: { version: 2, request_detail: {
    ...safeDetail.dashboard_v2.request_detail, render_fetch_ms: -1,
  } } }, id), null);
});

test('older backend action rejection shows one upgrade state without fake charts', async () => {
  const app = makeApp(() => Promise.resolve({ data: null, error: { context: { status: 400 } } }));
  app.render(); await app.effects(); await flush(app);
  const text = content(app.render());
  assert.match(text, /Monitoring backend upgrade required/);
  assert.doesNotMatch(text, /Recorded request volume|P50 typical|Valuation requests/);
});

test('newer selected range wins when older response arrives late', async () => {
  const pending = [];
  const app = makeApp((_name, options) => {
    const task = deferred(); pending.push({ range: options.body.range, task }); return task.promise;
  });
  app.render(); await app.effects();
  assert.equal(pending[0].range, '7d');
  pending[0].task.resolve({ data: dashboard('7d'), error: null }); await flush(app);
  click(app, '24h'); await flush(app);
  click(app, '7d'); await flush(app);
  assert.equal(pending.at(-2).range, '24h');
  assert.equal(pending.at(-1).range, '7d');
  pending.at(-1).task.resolve({ data: dashboard('7d', 42), error: null }); await flush(app);
  pending.at(-2).task.resolve({ data: dashboard('24h', 99), error: null }); await flush(app);
  assert.match(content(app.render()), /42 succeeded/);
  assert.doesNotMatch(content(app.render()), /99 succeeded/);
});

test('overlapping refreshes retain newest response and previous freshness while pending', async () => {
  const pending = [];
  const app = makeApp((_name, options) => {
    const task = deferred(); pending.push({ body: options.body, task }); return task.promise;
  });
  app.render(); await app.effects();
  pending[0].task.resolve({ data: dashboard('7d', 10), error: null }); await flush(app);
  click(app, 'Refresh data'); app.render();
  click(app, 'Refresh data'); app.render();
  assert.match(content(app.render()), /10 succeeded/);
  assert.match(content(app.render()), /Data as of/);
  pending.at(-1).task.resolve({ data: dashboard('7d', 25), error: null }); await flush(app);
  pending.at(-2).task.resolve({ data: dashboard('7d', 90), error: null }); await flush(app);
  assert.match(content(app.render()), /25 succeeded/);
  assert.doesNotMatch(content(app.render()), /90 succeeded/);
});

test('health check uses selected range, prevents duplicate submission and retains data on unknown', async () => {
  const pending = deferred(); const calls = [];
  const app = makeApp((_name, options) => {
    calls.push(options.body);
    return options.body.action === 'health_check' ? pending.promise : Promise.resolve({ data: dashboard(options.body.range, 10), error: null });
  });
  app.render(); await app.effects(); await flush(app);
  click(app, '24h'); await flush(app);
  click(app, 'Run health check'); app.render();
  assert.match(content(app.render()), /Running health check/);
  click(app, 'Running health check');
  assert.equal(calls.filter((call) => call.action === 'health_check').length, 1);
  assert.equal(calls.at(-1).range, '24h');
  const unknown = dashboard('24h', 99);
  unknown.dashboard_v2.health[0].status = 'unknown';
  unknown.dashboard_v2.health_check_result = { status: 'unknown', observed_at: stamp, recorded: true };
  pending.resolve({ data: unknown, error: null }); await flush(app);
  assert.match(content(app.render()), /could not provide/);
  assert.match(content(app.render()), /10 succeeded/);
  assert.doesNotMatch(content(app.render()), /99 succeeded/);
});

test('successful health check keeps the chosen range and updates that range without another probe', async () => {
  const calls = [];
  const app = makeApp((_name, options) => {
    calls.push(options.body);
    const result = dashboard(options.body.range, options.body.action === 'health_check' ? 28 : 10);
    if (options.body.action === 'health_check') result.dashboard_v2.health_check_result = { status: 'healthy', observed_at: stamp, recorded: true };
    return Promise.resolve({ data: result, error: null });
  });
  app.render(); await app.effects(); await flush(app);
  click(app, '30d'); await flush(app);
  click(app, 'Run health check'); await flush(app);
  assert.equal(calls.at(-1).action, 'health_check');
  assert.equal(calls.at(-1).range, '30d');
  assert.match(content(app.render()), /28 succeeded/);
  assert.equal(calls.filter((call) => call.action === 'health_check').length, 1);
  assert.equal(calls.filter((call) => call.action === 'read_summary').length, 2);
});

test('failed refresh keeps previous values and freshness with a neutral retry state', async () => {
  let fail = false;
  const app = makeApp((_name, options) => Promise.resolve(fail
    ? { data: null, error: { context: { status: 503 } } }
    : { data: dashboard(options.body.range, 12), error: null }));
  app.render(); await app.effects(); await flush(app);
  fail = true;
  click(app, 'Refresh data'); await flush(app);
  const text = content(app.render());
  assert.match(text, /12 succeeded/);
  assert.match(text, /Data as of/);
  assert.match(text, /dashboard read error, not a service outage/);
  assert.match(text, /Try again/);
});

test('monitoring chart source provides labelled accessible tables and lazy loading boundary', () => {
  const component = readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../FrontEnd/src/pages/AdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(component, /aria-labelledby="volume-summary"/);
  assert.match(component, /aria-labelledby="latency-summary"/);
  assert.match(component, /<summary[^>]*>View data as table<\/summary>/);
  assert.match(component, /Valuation recorded/);
  assert.match(component, /Chatbot recorded/);
  assert.match(component, /Valid n/);
  assert.match(component, /Insufficient samples/);
  assert.match(route, /lazy\(\(\) => import\('\.\.\/components\/AdminMonitoringV2'\)\)/);
  assert.match(route, /Suspense fallback=/);
  assert.match(route, /monitoringBadge !== null/);
  assert.match(route, /overflow-visible/);
});

test('chart tables expose the same recorded counts and supported percentile values as chart data', () => {
  const app = makeApp(() => Promise.resolve({ data: dashboard('7d'), error: null }));
  const data = parseDashboard(dashboard('7d', 20));
  assert.ok(data && data !== 'upgrade_required');
  const expand = (node) => {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  const volume = expand(app.exports.VolumeChart({ data }));
  const bars = nodes(volume).find((node) => node.type === 'BarChart');
  assert.equal(bars.props.data[0].valuation, 20);
  assert.equal(bars.props.data[0].chatbot, 2);
  assert.match(content(volume), /Today so far/);
  assert.match(content(volume), /Valuation recorded/);
  assert.match(content(volume), /Chatbot recorded/);
  assert.ok(nodes(volume).some((node) => node.type === 'summary' && content(node) === 'View data as table'));
  const latency = expand(app.exports.LatencyChart({ data }));
  const area = nodes(latency).find((node) => node.type === 'AreaChart');
  assert.equal(area.props.data[0].count, 20);
  assert.equal(area.props.data[0].p50, 100);
  assert.equal(area.props.data[0].p95, 300);
  assert.equal(area.props.data[0].p99, null);
  assert.match(content(latency), /Insufficient samples/);
  assert.match(content(latency), /Valid n/);
});

test('all six secondary tabs and sparse percentile cards are reachable', async () => {
  const app = makeApp((_name, options) => Promise.resolve({ data: dashboard(options.body.range, 10), error: null }));
  app.render(); await app.effects(); await flush(app);
  for (const tab of ['Services', 'Chatbot', 'Valuation', 'Security', 'Feedback']) {
    click(app, tab); const rendered = content(app.render());
    assert.ok(rendered.length > 0, tab);
  }
  click(app, 'Overview');
  const text = content(app.render());
  assert.match(text, /Insufficient samples/);
  assert.match(text, /10 succeeded/);
});
