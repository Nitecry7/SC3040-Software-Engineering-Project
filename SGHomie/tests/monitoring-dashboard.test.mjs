import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { componentHarness, content, deferred, nodes } from './helpers/frontend-component.mjs';
import {
  formatDuration, formatSgt, formatSgtWithZone, isUnsupportedMonitoringAction, monitoringBucketLabel,
  monitoringDisplayLabel, parseFeedbackConversation, parseHealthCheckResult, parseDashboard, parseMonitoringBadge, parseMonitoringDetail, parseSyntheticCanaryResult, percentileLabel,
} from '../FrontEnd/src/lib/monitoringDashboard.ts';
import { serializeFeedbackCopyForAnalysis } from '../BackEnd/supabase/functions/_shared/feedbackConversation.ts';

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
    recent_feedback: [],
  },
});
const flush = async (app) => { await setImmediate(); app.render(); await app.effects(); await setImmediate(); };
function makeApp(invoke, globals = {}) {
  const icons = Object.fromEntries(['Activity','AlertTriangle','BarChart3','Bot','CheckCircle2','ChevronRight','ClipboardCopy','Clock3','Cpu','Database','Download','FileText','Gauge','Globe2','Info','LayoutDashboard','MessageCircle','MessageSquare','Monitor','Radar','RefreshCw','Search','ShieldAlert','ShieldCheck','ThumbsDown','ThumbsUp','Timer','TrendingUp','Wrench','X'].map((name) => [name, name]));
  const props = {
    onBadgeChanged() {}, view: 'overview', range: '7d',
    onViewChange(view) { props.view = view; },
    onRangeChange(range) { props.range = range; },
  };
  return componentHarness(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), {
    'lucide-react': icons,
    'react-dom': { createPortal: (node) => node },
    recharts: Object.fromEntries(['Area', 'AreaChart', 'Bar', 'BarChart', 'CartesianGrid', 'Cell', 'ResponsiveContainer', 'Tooltip', 'XAxis', 'YAxis'].map((name) => [name, name])),
    '../lib/supabase': { supabase: { functions: { invoke } } },
    '../lib/monitoringDashboard': { formatCount: (n) => String(n), formatDuration, formatSgt, formatSgtWithZone,
      monitoringBucketLabel, monitoringDisplayLabel, percentileMinimums: { p50: 5, p95: 20, p99: 100 },
      isUnsupportedMonitoringAction, parseFeedbackConversation, parseHealthCheckResult, parseDashboard, parseMonitoringDetail, parseSyntheticCanaryResult, percentileLabel },
    '../../../BackEnd/supabase/functions/_shared/feedbackConversation': { serializeFeedbackCopyForAnalysis },
  }, props, { document: { body: {}, activeElement: null }, HTMLElement: class HTMLElement {}, window: { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {} }, ...globals });
}
const click = (app, text) => app.find((node) => node.type === 'button' && content(node).toLowerCase().includes(text.toLowerCase())).props.onClick();
const expandComponents = (node) => {
  if (Array.isArray(node)) return node.map(expandComponents);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expandComponents(node.type(node.props));
  return { ...node, props: { ...node.props, children: expandComponents(node.props?.children) } };
};
const viewText = (app) => content(expandComponents(app.render()));

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
  assert.equal(formatSgtWithZone(null), 'Unavailable');
  assert.equal(monitoringDisplayLabel('CHAT_USER_BURST_LIMIT'), 'User Burst Limit');
  assert.equal(monitoringDisplayLabel('prediction_interval_invalid'), 'Prediction Interval Invalid');
  assert.equal(monitoringBucketLabel('Today so far', stamp, '7d'), 'Today');
  assert.equal(monitoringBucketLabel('Today (Partial)', stamp, '7d'), 'Today');
  assert.match(monitoringBucketLabel(null, stamp, '7d'), /Sat 31/);
  assert.match(monitoringBucketLabel(null, stamp, '24h'), /8 am/);
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
  const feedback = parseDashboard({ dashboard_v2: { ...complete.dashboard_v2, recent_feedback: [
    { feedback_id: 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b', rating: 'negative', recorded_at: stamp, comment: 'Plain text', user_id: 'private', interaction_id: 'private-id' },
    { feedback_id: '6d2e9c2e-06c9-4ef0-a47b-60d9071e1df8', rating: 'positive', recorded_at: stamp, comment: null },
  ] } });
  assert.deepEqual(feedback?.recent_feedback, [
    { feedback_id: 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b', rating: 'negative', recorded_at: stamp, comment: 'Plain text' },
    { feedback_id: '6d2e9c2e-06c9-4ef0-a47b-60d9071e1df8', rating: 'positive', recorded_at: stamp, comment: null },
  ]);
  assert.equal(parseDashboard({ dashboard_v2: { ...complete.dashboard_v2, recent_feedback: [{ rating: 'negative', recorded_at: stamp, comment: 'x'.repeat(1001) }] } }), null);
});

test('feedback conversation parser binds target ID, bounds text, and accepts explicit unavailable state', () => {
  const id = 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b';
  const response = { dashboard_v2: { feedback_conversation: {
    feedback: { feedback_id: id, rating: 'negative', recorded_at: stamp, comment: null, comment_expires_at: null },
    conversation_state: 'available', conversation: [
      { role: 'user', content: 'Question', rated: false, truncated: false },
      { role: 'assistant', content: 'Answer', rated: true, truncated: false },
    ], technical_context: null, content_expires_at: stamp, truncated: false, omitted_context_count: 0,
  } } };
  assert.equal(parseFeedbackConversation(response, id)?.conversation[1].rated, true);
  assert.equal(parseFeedbackConversation(response, '6d2e9c2e-06c9-4ef0-a47b-60d9071e1df8'), null);
  assert.equal(parseFeedbackConversation({ dashboard_v2: { feedback_conversation: {
    ...response.dashboard_v2.feedback_conversation, conversation: [
      response.dashboard_v2.feedback_conversation.conversation[0],
      { ...response.dashboard_v2.feedback_conversation.conversation[1], rated: false },
    ],
  } } }, id), null);
  assert.equal(parseFeedbackConversation({ dashboard_v2: { feedback_conversation: {
    ...response.dashboard_v2.feedback_conversation, conversation_state: 'unavailable', conversation: [],
  } } }, id)?.conversation_state, 'unavailable');
});

test('older backend action rejection shows one upgrade state without fake charts', async () => {
  const app = makeApp(() => Promise.resolve({ data: null, error: { context: { status: 400 } } }));
  app.render(); await app.effects(); await flush(app);
  const text = viewText(app);
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
  assert.match(viewText(app), /42 succeeded/);
  assert.doesNotMatch(viewText(app), /99 succeeded/);
});

test('overlapping refreshes retain newest response and previous freshness while pending', async () => {
  const pending = [];
  const app = makeApp((_name, options) => {
    const task = deferred(); pending.push({ body: options.body, task }); return task.promise;
  });
  app.render(); await app.effects();
  pending[0].task.resolve({ data: dashboard('7d', 10), error: null }); await flush(app);
  click(app, 'Refresh Data'); app.render();
  click(app, 'Refresh Data'); app.render();
  assert.match(viewText(app), /10 succeeded/);
  assert.match(viewText(app), /Data as of/);
  pending.at(-1).task.resolve({ data: dashboard('7d', 25), error: null }); await flush(app);
  pending.at(-2).task.resolve({ data: dashboard('7d', 90), error: null }); await flush(app);
  assert.match(viewText(app), /25 succeeded/);
  assert.doesNotMatch(viewText(app), /90 succeeded/);
});

test('health check uses selected range, prevents duplicate submission and retains data on unknown', async () => {
  const pending = deferred(); const calls = [];
  const app = makeApp((_name, options) => {
    calls.push(options.body);
    return options.body.action === 'health_check' ? pending.promise : Promise.resolve({ data: dashboard(options.body.range, 10), error: null });
  });
  app.render(); await app.effects(); await flush(app);
  click(app, '24h'); await flush(app);
  click(app, 'Run Health Check'); app.render();
  assert.match(viewText(app), /Running Health Check/);
  click(app, 'Running Health Check');
  assert.equal(calls.filter((call) => call.action === 'health_check').length, 1);
  assert.equal(calls.at(-1).range, '24h');
  const unknown = dashboard('24h', 99);
  unknown.dashboard_v2.health[0].status = 'unknown';
  unknown.dashboard_v2.health_check_result = { status: 'unknown', observed_at: stamp, recorded: true };
  pending.resolve({ data: unknown, error: null }); await flush(app);
  assert.match(viewText(app), /could not provide/);
  assert.match(viewText(app), /10 succeeded/);
  assert.doesNotMatch(viewText(app), /99 succeeded/);
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
  click(app, 'Run Health Check'); await flush(app);
  assert.equal(calls.at(-1).action, 'health_check');
  assert.equal(calls.at(-1).range, '30d');
  assert.match(viewText(app), /28 succeeded/);
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
  click(app, 'Refresh Data'); await flush(app);
  const text = viewText(app);
  assert.match(text, /12 succeeded/);
  assert.match(text, /Data as of/);
  assert.match(text, /dashboard read error, not a service outage/);
  assert.match(text, /Try Again/);
});

test('monitoring chart source provides labelled accessible tables and lazy loading boundary', () => {
  const component = readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../FrontEnd/src/pages/AdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(component, /aria-labelledby="volume-summary"/);
  assert.match(component, /aria-labelledby="latency-summary"/);
  assert.match(component, /<summary[^>]*>View data as table<\/summary>/);
  assert.match(component, /Valuation recorded/);
  assert.match(component, /Chatbot recorded/);
  assert.match(component, /Valid Samples/);
  assert.doesNotMatch(component, /Valid n/);
  assert.match(component, /The number of usable recorded measurements available for this timing/);
  assert.match(component, /Insufficient Samples/);
  assert.match(component, /role="tooltip"/);
  assert.match(component, /createPortal\(tooltip, document\.body\)/);
  assert.match(component, /onFocus=\{\(\) => setFocused\(true\)\}/);
  assert.match(component, /window\.addEventListener\('scroll', update, true\)/);
  assert.match(component, /P50 Typical Latency/);
  assert.match(component, /50% of recorded requests completed within this time, while 50% took longer/);
  assert.match(component, /role="img" aria-labelledby="latency-summary"/);
  assert.doesNotMatch(component, /<(?:button|div|span|p|a|td|th)[^>]*\stitle=/);
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
  assert.match(content(volume), /Today/);
  assert.match(content(volume), /Valuation recorded/);
  assert.match(content(volume), /Chatbot recorded/);
  assert.ok(nodes(volume).some((node) => node.type === 'summary' && content(node) === 'View data as table'));
  const latency = expand(app.exports.LatencyChart({ data }));
  const area = nodes(latency).find((node) => node.type === 'AreaChart');
  assert.equal(area.props.data[0].count, 20);
  assert.equal(area.props.data[0].p50, 100);
  assert.equal(area.props.data[0].p95, 300);
  assert.equal(area.props.data[0].p99, null);
  assert.match(content(latency), /Insufficient Samples/);
  assert.match(content(latency), /Valid Samples/);
});

test('all six monitoring tabs and timing matrix are reachable', async () => {
  const app = makeApp((_name, options) => Promise.resolve({ data: dashboard(options.body.range, 10), error: null }));
  app.render(); await app.effects(); await flush(app);
  for (const tab of ['Services', 'Chatbot', 'Valuation', 'Security', 'Feedback']) {
    click(app, tab); const rendered = viewText(app);
    assert.ok(rendered.length > 0, tab);
  }
  click(app, 'Overview');
  const text = viewText(app);
  assert.match(readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8'), /Insufficient Samples/);
  click(app, 'Chatbot');
  assert.match(readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8'), /Latency Percentiles/);
  assert.match(readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8'), /First Application Output/);
  assert.doesNotMatch(readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8'), /Interaction latency · P50/);
  assert.match(text, /10 succeeded/);
});

test('portal help tooltips open on keyboard focus and dismiss with Escape', async () => {
  const app = makeApp(() => Promise.resolve({ data: dashboard('7d'), error: null }));
  app.render(); await app.effects(); await flush(app);
  let tree = expandComponents(app.render());
  let trigger = nodes(tree).find((node) => node.type === 'button' && node.props['aria-label'] === 'Help: Run Health Check');
  assert.ok(trigger);
  trigger.props.onFocus();
  tree = expandComponents(app.render());
  const tip = nodes(tree).find((node) => node.type === 'span' && node.props.role === 'tooltip' && content(node).includes('one-time Render/model readiness check'));
  assert.ok(tip);
  assert.equal(tip.props.style.position, 'fixed');
  assert.equal(tip.props.style.visibility, 'visible');
  trigger = nodes(tree).find((node) => node.type === 'button' && node.props['aria-label'] === 'Help: Run Health Check');
  trigger.props.onKeyDown({ key: 'Escape' });
  tree = expandComponents(app.render());
  const closed = nodes(tree).find((node) => node.type === 'span' && node.props.role === 'tooltip' && content(node).includes('one-time Render/model readiness check'));
  assert.equal(closed.props.style.visibility, 'hidden');
});

test('overview KPI tiles omit sparklines while the request chart keeps real bucket counts', () => {
  const app = makeApp(() => Promise.resolve({ data: dashboard('7d'), error: null }));
  const source = readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Sparkline|trend=\{/);
  assert.equal(nodes(expandComponents(app.render())).some((node) => node.type === 'polyline'), false);
  const raw = dashboard('7d');
  raw.dashboard_v2.valuation.series.push({ ...raw.dashboard_v2.valuation.series[0], bucket_start: '2026-10-30T00:00:00Z', label: 'Fri 30', request_count: 4, chatbot_request_count: 1 });
  const data = parseDashboard(raw);
  assert.deepEqual(data.valuation.series.map((bucket) => bucket.request_count), [20, 4]);
});

test('Valid Samples help is available to keyboard users and valuation rows show an accessible chevron', async () => {
  const id = '6d2e9c2e-06c9-4ef0-a47b-60d9071e1df8';
  const summary = dashboard('7d');
  summary.dashboard_v2.recent_valuation_requests = [{ request_id: id, created_at: stamp, status: 'success', failure_category: null, total_edge_ms: 100 }];
  const app = makeApp((_name, options) => Promise.resolve({ data: summary, error: null }));
  app.render(); await app.effects(); await flush(app);
  click(app, 'Valuation');
  let tree = expandComponents(app.render());
  const validSamplesTip = nodes(tree).find((node) => node.type === 'button' && node.props['aria-label'] === 'Help: Valid Samples');
  assert.ok(validSamplesTip);
  validSamplesTip.props.onFocus();
  tree = expandComponents(app.render());
  const tooltip = nodes(tree).find((node) => node.props.role === 'tooltip' && content(node).includes('The number of usable recorded measurements available for this timing'));
  assert.ok(tooltip);
  assert.equal(tooltip.props.style.visibility, 'visible');
  assert.match(content(tree), /CatBoost Prediction/);
  assert.match(content(tree), /Conformal Interval/);
  const row = nodes(tree).find((node) => node.type === 'tr' && content(node).includes(id));
  assert.match(row.props.className, /hover:bg-slate-50/);
  const arrow = nodes(row).find((node) => node.type === 'ChevronRight');
  assert.ok(arrow);
  assert.equal(arrow.props['aria-hidden'], 'true');
  const detailButton = nodes(row).find((node) => node.type === 'button' && node.props['aria-label'] === `View operational details for ${id}`);
  assert.match(detailButton.props.className, /focus-visible:outline/);
  const component = readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8');
  assert.match(component, /catboost_prediction: TrendingUp/);
  assert.match(component, /conformal_interval: BarChart3/);
  assert.doesNotMatch(component, /Valid n/);
});

test('range labels and service evidence stay clear and truthful', async () => {
  const app = makeApp((_name, options) => Promise.resolve({ data: dashboard(options.body.range), error: null }));
  app.render(); await app.effects(); await flush(app);
  assert.match(viewText(app), /Rolling Last 7 Days/);
  assert.doesNotMatch(viewText(app), /previous 6 Singapore days|Today \(Partial\)/);
  click(app, 'Services');
  const services = viewText(app);
  assert.match(services, /Evidence/);
  assert.match(services, /Telemetry Read/);
  assert.match(services, /Last Observed/);
  assert.match(services, /31 Oct 2026/);
  assert.match(services, /Expected Model/);
  assert.match(services, /Valuation Canary/);
});

test('synthetic checks run only after an explicit click and show the persisted result', async () => {
  const calls = [];
  const pending = deferred();
  const app = makeApp((_name, options) => {
    calls.push(options.body);
    return options.body.action === 'run_canary' ? pending.promise : Promise.resolve({ data: dashboard(options.body.range), error: null });
  });
  app.render(); await app.effects(); await flush(app);
  click(app, 'Services');
  assert.equal(JSON.stringify(calls), JSON.stringify([{ action: 'read_summary', range: '7d' }]));
  const cardNode = nodes(expandComponents(app.render())).find((node) => node.type === 'article' && content(node).includes('Chatbot Synthetic Check'));
  const runButton = nodes(cardNode).find((node) => node.type === 'button' && content(node).includes('Run Check'));
  assert.ok(runButton);
  runButton.props.onClick(); app.render();
  assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify({ action: 'run_canary', canary_type: 'chatbot' }));
  const pendingButton = nodes(expandComponents(app.render())).find((node) => node.type === 'button' && content(node).includes('Running Check'));
  assert.equal(pendingButton.props.disabled, true);
  pending.resolve({ data: { dashboard_v2: { synthetic_canary: {
    canary_type: 'chatbot', status: 'success', failure_category: null, started_at: stamp,
    completed_at: stamp, duration_ms: 842, request_id: 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b',
    expected_model_version: null, observed_model_version: null, provider: 'openrouter', model: 'openrouter/free',
    edge_reached: true, upstream_reached: true, response_valid: true, canary_valid: true,
  } } }, error: null });
  await flush(app);
  assert.match(viewText(app), /Chatbot Synthetic Check[\s\S]*Success/);
  assert.match(viewText(app), /Synthetic check passed/);
  assert.equal(calls.filter((call) => call.action === 'run_canary').length, 1);
});

test('valuation request details open inline without a modal or page dimming', async () => {
  const id = '6d2e9c2e-06c9-4ef0-a47b-60d9071e1df8';
  const summary = dashboard('7d');
  summary.dashboard_v2.recent_valuation_requests = [{ request_id: id, created_at: stamp, status: 'success', failure_category: null, total_edge_ms: 100 }];
  const detail = { dashboard_v2: { version: 2, request_detail: { request_id: id, created_at: stamp, completed_at: stamp, status: 'success', failure_category: null, total_edge_ms: 100, model_version: null, prediction_sanity: 'passed', authentication_ms: 1, database_lookup_ms: 2, request_construction_ms: 3, render_fetch_ms: 4 } } };
  const app = makeApp((_name, options) => Promise.resolve({ data: options.body.action === 'detail' ? detail : summary, error: null }));
  app.render(); await app.effects(); await flush(app);
  click(app, 'Valuation');
  const requestButton = nodes(expandComponents(app.render())).find((node) => node.type === 'button' && node.props['aria-label'] === `Open request ${id}`);
  requestButton.props.onClick(); await flush(app);
  const tree = expandComponents(app.render());
  assert.ok(nodes(tree).some((node) => node.type === 'aside' && node.props['aria-labelledby'] === 'operational-detail-title'));
  assert.equal(nodes(tree).some((node) => node.props?.role === 'dialog' || node.props?.['aria-modal'] === 'true'), false);
  assert.doesNotMatch(readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8'), /fixed inset-0 z-50/);
});

test('written feedback detail uses plain text and excludes identity and conversation fields', async () => {
  const response = dashboard('7d');
  response.dashboard_v2.chatbot.feedback_count = 1;
  response.dashboard_v2.chatbot.feedback_ratings = { negative: 1 };
  response.dashboard_v2.recent_feedback = [{ feedback_id: 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b', rating: 'negative', recorded_at: stamp, comment: '<script>plain text only</script>' }];
  const detail = { dashboard_v2: { feedback_conversation: {
    feedback: { feedback_id: 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b', rating: 'negative', recorded_at: stamp,
      comment: '<script>plain text only</script>', comment_expires_at: '2026-11-30T00:00:00Z' },
    conversation_state: 'available', conversation: [
      { role: 'user', content: 'A private prompt', rated: false, truncated: false },
      { role: 'assistant', content: 'A stored answer', rated: true, truncated: false },
    ], technical_context: null, content_expires_at: '2026-11-30T00:00:00Z', truncated: false, omitted_context_count: 0,
  } } };
  const app = makeApp((_name, options) => Promise.resolve({ data: options.body.action === 'get_feedback_conversation' ? detail : response, error: null }));
  app.render(); await app.effects(); await flush(app);
  click(app, 'Feedback');
  let feedback = expandComponents(app.render());
  const row = nodes(feedback).find((node) => node.type === 'button' && content(node).includes('<script>plain text only</script>'));
  row.props.onClick({ currentTarget: { focus() {} } });
  await flush(app);
  feedback = expandComponents(app.render());
  assert.match(content(feedback), /Recent Feedback/);
  assert.match(content(feedback), /Feedback Details/);
  assert.match(content(feedback), /<script>plain text only<\/script>/);
  assert.match(content(feedback), /A private prompt/);
  assert.match(content(feedback), /A stored answer/);
  assert.doesNotMatch(content(feedback), /user_id|interaction_id|conversation-safe-id/);
  assert.equal(nodes(feedback).some((node) => node.type === 'script'), false);
  assert.ok(nodes(feedback).some((node) => node.type === 'aside' && node.props['aria-labelledby'] === 'feedback-detail-title'));
  assert.match(readFileSync(new URL('../FrontEnd/src/components/AdminMonitoringV2.tsx', import.meta.url), 'utf8'), /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(26rem,32rem\)\]/);
});

test('feedback transcript requests are click-driven and stale A or closed-panel responses are discarded', async () => {
  const feedbackA = 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b';
  const feedbackB = '6d2e9c2e-06c9-4ef0-a47b-60d9071e1df8';
  const summary = dashboard('7d');
  summary.dashboard_v2.recent_feedback = [
    { feedback_id: feedbackA, rating: 'negative', recorded_at: stamp, comment: null },
    { feedback_id: feedbackB, rating: 'positive', recorded_at: stamp, comment: null },
  ];
  const conversation = (id, text) => ({ dashboard_v2: { feedback_conversation: {
    feedback: { feedback_id: id, rating: id === feedbackA ? 'negative' : 'positive', recorded_at: stamp, comment: null, comment_expires_at: null },
    conversation_state: 'available', conversation: [
      { role: 'user', content: `${text} user`, rated: false, truncated: false },
      { role: 'assistant', content: `${text} assistant`, rated: true, truncated: false },
    ], technical_context: null, content_expires_at: '2026-11-30T00:00:00Z', truncated: false, omitted_context_count: 0,
  } } });
  const pending = [];
  let clickRequests = 0;
  const app = makeApp((_name, options) => {
    if (options.body.action !== 'get_feedback_conversation') return Promise.resolve({ data: summary, error: null });
    clickRequests += 1;
    const request = deferred(); pending.push({ id: options.body.feedback_id, request }); return request.promise;
  });
  app.render(); await app.effects(); await flush(app);
  click(app, 'Feedback');
  let tree = expandComponents(app.render());
  const rowA = nodes(tree).find((node) => node.type === 'button' && node.props['aria-pressed'] === false && content(node).includes('Negative'));
  rowA.props.onClick({ currentTarget: { focus() {} } });
  tree = expandComponents(app.render());
  const rowB = nodes(tree).find((node) => node.type === 'button' && node.props['aria-pressed'] === false && content(node).includes('Positive'));
  rowB.props.onClick({ currentTarget: { focus() {} } });
  assert.equal(clickRequests, 2);
  await app.effects(); // No React effect starts transcript reads, including a Strict Mode replay.
  assert.equal(clickRequests, 2);
  pending[1].request.resolve({ data: conversation(feedbackB, 'B'), error: null });
  await flush(app);
  assert.match(content(expandComponents(app.render())), /B assistant/);
  pending[0].request.resolve({ data: conversation(feedbackA, 'A'), error: null });
  await flush(app);
  assert.match(content(expandComponents(app.render())), /B assistant/);
  assert.doesNotMatch(content(expandComponents(app.render())), /A assistant/);

  const rowBAgain = nodes(expandComponents(app.render())).find((node) => node.type === 'button'
    && node.props['aria-pressed'] === true && content(node).includes('Positive'));
  rowBAgain.props.onClick({ currentTarget: { focus() {} } });
  const close = nodes(expandComponents(app.render())).find((node) => node.type === 'button' && node.props['aria-label'] === 'Close feedback details');
  close.props.onClick();
  pending[2].request.resolve({ data: conversation(feedbackB, 'Late'), error: null });
  await flush(app);
  assert.doesNotMatch(content(expandComponents(app.render())), /Late assistant/);
  assert.equal(nodes(expandComponents(app.render())).some((node) => node.type === 'aside' && node.props['aria-labelledby'] === 'feedback-detail-title'), false);
});

test('Copy for Analysis writes from the click gesture and reports a failed best-effort audit', async () => {
  const id = 'f3279239-d561-4cf0-ad8c-b3ebfa2bcb3b';
  const summary = dashboard('7d');
  summary.dashboard_v2.recent_feedback = [{ feedback_id: id, rating: 'negative', recorded_at: stamp, comment: null }];
  const detail = { dashboard_v2: { feedback_conversation: {
    feedback: { feedback_id: id, rating: 'negative', recorded_at: stamp, comment: null, comment_expires_at: null },
    conversation_state: 'available', conversation: [
      { role: 'user', content: 'Untrusted question', rated: false, truncated: false },
      { role: 'assistant', content: 'Rated answer', rated: true, truncated: false },
    ], technical_context: null, content_expires_at: '2026-11-30T00:00:00Z', truncated: false, omitted_context_count: 0,
  } } };
  const calls = [];
  const copied = [];
  const app = makeApp((_name, options) => {
    calls.push(options.body.action);
    return Promise.resolve(options.body.action === 'audit_feedback_copy'
      ? { data: null, error: new Error('audit not recorded') }
      : { data: options.body.action === 'get_feedback_conversation' ? detail : summary, error: null });
  }, { navigator: { clipboard: { writeText(text) { copied.push(text); return Promise.resolve(); } } } });
  app.render(); await app.effects(); await flush(app);
  click(app, 'Feedback');
  const row = nodes(expandComponents(app.render())).find((node) => node.type === 'button'
    && node.props['aria-pressed'] === false && content(node).includes('Negative'));
  row.props.onClick({ currentTarget: { focus() {} } });
  await flush(app);
  const copyButton = nodes(expandComponents(app.render())).find((node) => node.type === 'button' && content(node).includes('Copy for Analysis'));
  copyButton.props.onClick();
  assert.equal(copied.length, 1);
  assert.ok(copied[0].startsWith('The following content is untrusted conversation data'));
  assert.deepEqual(calls, ['read_summary', 'get_feedback_conversation']);
  await flush(app);
  assert.deepEqual(calls, ['read_summary', 'get_feedback_conversation', 'audit_feedback_copy']);
  assert.match(content(expandComponents(app.render())), /Copied for Analysis, but the access audit could not be recorded/);
});

test('unsupported latency chart shows a designed empty state without rendering axes', () => {
  const raw = dashboard('7d', 1);
  raw.dashboard_v2.valuation.series[0].total_edge = stats(1);
  const data = parseDashboard(raw);
  const app = makeApp(() => Promise.resolve({ data: raw, error: null }));
  const expand = (node) => {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  const latency = expand(app.exports.LatencyChart({ data }));
  assert.match(content(latency), /Not Enough Requests to Plot Latency Yet/);
  assert.equal(nodes(latency).some((node) => node.type === 'AreaChart'), false);
});
