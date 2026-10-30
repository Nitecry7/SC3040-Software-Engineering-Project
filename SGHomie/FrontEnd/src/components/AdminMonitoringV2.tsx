import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Info, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import {
  formatCount, formatDuration, formatSgt, isUnsupportedMonitoringAction, parseHealthCheckResult,
  parseDashboard, parseMonitoringDetail, percentileLabel,
  type DurationStats, type MonitoringAlert, type MonitoringDashboard, type MonitoringDetail,
  type MonitoringRange,
} from '../lib/monitoringDashboard';

type Tab = 'Overview' | 'Services' | 'Chatbot' | 'Valuation' | 'Security' | 'Feedback';
const tabs: Tab[] = ['Overview', 'Services', 'Chatbot', 'Valuation', 'Security', 'Feedback'];
const ranges: MonitoringRange[] = ['1h', '24h', '7d', '30d'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const card = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm';
const button = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50';
const metricNames = {
  valuation_total_edge: 'Edge total', valuation_authentication: 'Authentication',
  valuation_database_lookup: 'Database lookup', valuation_request_construction: 'Request construction',
  valuation_render_fetch: 'Render fetch', render_total: 'Render total',
  catboost_prediction: 'CatBoost prediction', conformal_interval: 'Conformal interval',
  chat_total_interaction: 'Total interaction', chat_provider: 'Provider', chat_tool: 'Tool',
  chat_first_output: 'First application output',
} as const;
const metricDescription: Record<string, string> = {
  valuation_request_construction: 'Eligibility, feature preparation and trusted request construction',
  valuation_render_fetch: 'Full outbound HTTP request',
  render_total: 'No trusted queryable historical source',
  catboost_prediction: 'No trusted queryable historical source',
  conformal_interval: 'No trusted queryable historical source',
};
const sampleNeed = { p50: 5, p95: 20, p99: 100 };
const percentileMeaning = { p50: 'Typical latency', p95: 'Slow-tail latency', p99: 'Extreme-tail latency' };

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <section className={card} aria-label={title}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {note && <p className="text-xs text-gray-600">{note}</p>}
    </div>
    {children}
  </section>;
}
function StatePill({ value }: { value: string }) {
  const tone = value === 'critical' ? 'bg-rose-100 text-rose-900' : value === 'warning'
    ? 'bg-amber-100 text-amber-900' : value === 'healthy' || value === 'success'
      ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-100 text-gray-700';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{value.replace(/_/g, ' ')}</span>;
}
function PercentileCards({ stats, label }: { stats: DurationStats | { state: 'unavailable' } | undefined; label: string }) {
  return <div className="grid gap-3 sm:grid-cols-3">
    {(['p50', 'p95', 'p99'] as const).map((key) => {
      const count = stats && 'sample_count' in stats ? stats.sample_count : null;
      return <div key={key} className={card}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-gray-600">{label} · {key.toUpperCase()}</p>
          <span title={`${key.toUpperCase()}: ${percentileMeaning[key]}. At least ${sampleNeed[key]} valid observations required.`}
            aria-label={`${key.toUpperCase()}: ${percentileMeaning[key]}`} className="cursor-help text-blue-700"><Info className="h-4 w-4" aria-hidden="true" /></span>
        </div>
        <p className="mt-2 min-h-8 text-xl font-bold tabular-nums text-gray-900">{percentileLabel(stats, key)}</p>
        <p className="mt-1 text-xs text-gray-600">{percentileMeaning[key]} · {count === null ? 'Source unavailable' : `${count} valid samples`}</p>
        {count !== null && count < sampleNeed[key] && <p className="mt-1 text-xs text-gray-500">{count}/{sampleNeed[key]} recorded</p>}
      </div>;
    })}
  </div>;
}
function Counts({ values, empty }: { values: Record<string, number>; empty: string }) {
  const entries = Object.entries(values);
  return entries.length ? <ul className="divide-y divide-gray-100 text-sm">
    {entries.map(([name, value]) => <li key={name} className="flex justify-between gap-3 py-2"><span className="break-all text-gray-700">{name.replace(/_/g, ' ')}</span><strong className="tabular-nums text-gray-900">{value}</strong></li>)}
  </ul> : <p className="text-sm text-gray-600">{empty}</p>;
}
export function VolumeChart({ data }: { data: MonitoringDashboard }) {
  const points = data.valuation.series.map((bucket) => ({
    label: bucket.label ?? formatSgt(bucket.bucket_start), valuation: bucket.request_count,
    chatbot: bucket.chatbot_request_count, today: bucket.label === 'Today so far',
  }));
  return <Panel title="Recorded request volume" note={`${data.range.range} · ${data.aggregation_timezone}`}>
    <p id="volume-summary" className="sr-only">Recorded valuation and chatbot events for each Singapore time bucket. A table follows the chart.</p>
    <div role="img" aria-labelledby="volume-summary" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 5, right: 8, bottom: 5, left: -25 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip wrapperStyle={{ zIndex: 40 }} />
          <Legend />
          <Bar dataKey="valuation" name="Valuation recorded" stackId="requests" fill="#2563eb">
            {points.map((point, index) => <Cell key={index} stroke={point.today ? '#1e40af' : 'none'} strokeWidth={point.today ? 2 : 0} />)}
          </Bar>
          <Bar dataKey="chatbot" name="Chatbot recorded" stackId="requests" fill="#f97316">
            {points.map((point, index) => <Cell key={index} stroke={point.today ? '#9a3412' : 'none'} strokeWidth={point.today ? 2 : 0} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <details className="mt-2 text-sm"><summary className="cursor-pointer text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">View data as table</summary>
      <div className="mt-2 overflow-x-auto"><table className="min-w-full text-left text-xs"><caption className="sr-only">Recorded events by Singapore time bucket</caption>
        <thead><tr><th className="p-2">Bucket (SGT)</th><th className="p-2">Valuation recorded</th><th className="p-2">Chatbot recorded</th></tr></thead>
        <tbody>{points.map((point, index) => <tr key={index} className={point.today ? 'border-l-2 border-blue-600 bg-blue-50' : 'border-t border-gray-100'}><th className="p-2 font-normal">{point.label}</th><td className="p-2">{point.valuation}</td><td className="p-2">{point.chatbot}</td></tr>)}</tbody>
      </table></div>
    </details>
    <p className="mt-2 text-xs text-gray-600">Recorded events may undercount traffic when best-effort telemetry writes fail.</p>
  </Panel>;
}
export function LatencyChart({ data }: { data: MonitoringDashboard }) {
  const points = data.valuation.series.map((bucket) => ({
    label: bucket.label ?? formatSgt(bucket.bucket_start), count: bucket.total_edge.sample_count,
    p50: bucket.total_edge.p50.value_ms, p95: bucket.total_edge.p95.value_ms,
    p99: bucket.total_edge.p99.value_ms,
  }));
  const showP99 = points.filter((point) => point.p99 !== null).length >= 2;
  return <Panel title="Valuation latency · Edge total" note={`Valid samples · ${data.range.range}`}>
    <p id="latency-summary" className="sr-only">P50 typical and P95 slow-tail Edge latency by bucket. Missing points have insufficient samples. A table follows the chart.</p>
    <div role="img" aria-labelledby="latency-summary" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 5, right: 8, bottom: 5, left: -18 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatDuration(value)} />
          <Tooltip wrapperStyle={{ zIndex: 40 }} formatter={(value: number) => formatDuration(value)} />
          <Legend />
          <Area type="linear" dataKey="p50" name="P50 typical" stroke="#2563eb" fill="#dbeafe" connectNulls={false} />
          <Area type="linear" dataKey="p95" name="P95 slow tail" stroke="#ea580c" fill="none" connectNulls={false} />
          {showP99 && <Area type="linear" dataKey="p99" name="P99 extreme tail" stroke="#7c3aed" fill="none" connectNulls={false} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <details className="mt-2 text-sm"><summary className="cursor-pointer text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">View data as table</summary>
      <div className="mt-2 overflow-x-auto"><table className="min-w-full text-left text-xs"><caption className="sr-only">Edge latency percentiles by Singapore time bucket</caption>
        <thead><tr><th className="p-2">Bucket (SGT)</th><th className="p-2">Valid n</th><th className="p-2">P50</th><th className="p-2">P95</th><th className="p-2">P99</th></tr></thead>
        <tbody>{points.map((point, index) => <tr key={index} className="border-t border-gray-100"><th className="p-2 font-normal">{point.label}</th><td className="p-2">{point.count}</td><td className="p-2">{point.p50 === null ? 'Insufficient samples' : formatDuration(point.p50)}</td><td className="p-2">{point.p95 === null ? 'Insufficient samples' : formatDuration(point.p95)}</td><td className="p-2">{point.p99 === null ? 'Insufficient samples' : formatDuration(point.p99)}</td></tr>)}</tbody>
      </table></div>
    </details>
    <p className="mt-2 text-xs text-gray-600">Tail percentile points are omitted when a time bucket does not contain enough recorded requests.</p>
  </Panel>;
}
function Incidents({ data, onAction, pending }: { data: MonitoringDashboard; onAction: (alert: MonitoringAlert) => void; pending: boolean }) {
  return <Panel title="Unresolved incidents" note="Recovery does not resolve an incident">
    {data.unresolved_alerts === null ? <p className="text-sm text-gray-600">Incident list unavailable.</p>
      : data.unresolved_alerts.length === 0 ? <p className="text-sm text-gray-600">No unresolved incidents recorded.</p>
        : <div className="space-y-3">{data.unresolved_alerts.map((alert) => <article key={alert.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2"><StatePill value={alert.severity} /><StatePill value={alert.state} /><strong className="break-all text-sm text-gray-900">{alert.category.replace(/_/g, ' ')}</strong></div>
            <button className={button} disabled={pending} onClick={() => onAction(alert)}>{alert.state === 'active' ? 'Acknowledge' : 'Resolve'}</button>
          </div>
          <dl className="mt-3 grid gap-2 text-xs text-gray-700 sm:grid-cols-3">
            <div><dt>First detected</dt><dd>{formatSgt(alert.first_detected_at)} SGT</dd></div>
            <div><dt>Last detected</dt><dd>{formatSgt(alert.last_detected_at)} SGT</dd></div>
            <div><dt>Occurrences</dt><dd>{alert.occurrence_count}</dd></div>
          </dl>
          {alert.latest_request_id && <p className="mt-2 break-all text-xs text-gray-700">Latest request ID: {alert.latest_request_id}</p>}
          {alert.source === 'render_model' && data.health[0]?.status === 'healthy' && <p className="mt-2 text-xs text-gray-600">Latest admin check observed the model ready. Resolve the incident when reviewed.</p>}
        </article>)}</div>}
  </Panel>;
}

export default function AdminMonitoringV2({ onBadgeChanged }: { onBadgeChanged: () => void }) {
  const [range, setRange] = useState<MonitoringRange>('7d');
  const rangeRef = useRef<MonitoringRange>('7d');
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<MonitoringDashboard | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [healthPending, setHealthPending] = useState(false);
  const healthLock = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [detail, setDetail] = useState<MonitoringDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState('');
  const [alertPending, setAlertPending] = useState(false);
  const sequence = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const read = useCallback(async (requested: MonitoringRange) => {
    const id = ++sequence.current;
    setUpdating(true);
    setNotice(null);
    try {
      const { data: response, error } = await supabase.functions.invoke('admin-monitoring', {
        body: { action: 'read_summary', range: requested },
      });
      if (error) throw error;
      const parsed = parseDashboard(response);
      if (id !== sequence.current || requested !== rangeRef.current) return;
      if (parsed === 'upgrade_required') { setUpgrade(true); setData(null); return; }
      if (!parsed || parsed.range.range !== requested) throw new Error('Invalid monitoring dashboard response');
      setUpgrade(false);
      setData(parsed);
    } catch (error) {
      if (id === sequence.current && requested === rangeRef.current) {
        if (isUnsupportedMonitoringAction(error)) { setUpgrade(true); setData(null); }
        else setNotice('Couldn’t refresh monitoring data. This is a dashboard read error, not a service outage.');
      }
    } finally {
      if (id === sequence.current) { setUpdating(false); setInitialLoading(false); }
    }
  }, []);
  useEffect(() => {
    void read(rangeRef.current);
    return () => { sequence.current += 1; };
  }, [read]);
  useEffect(() => {
    if (!detail) return;
    dialogRef.current?.focus();
  }, [detail]);
  const changeRange = (next: MonitoringRange) => {
    if (next === rangeRef.current) return;
    rangeRef.current = next;
    setRange(next);
    void read(next);
  };
  const runHealth = async () => {
    if (healthLock.current) return;
    healthLock.current = true;
    setHealthPending(true);
    setUpdating(false);
    setNotice(null);
    const requested = rangeRef.current;
    const id = ++sequence.current;
    try {
      const { data: response, error } = await supabase.functions.invoke('admin-monitoring', {
        body: { action: 'health_check', range: requested },
      });
      if (error) throw error;
      const parsed = parseDashboard(response);
      const check = parseHealthCheckResult(response);
      onBadgeChanged();
      if (id !== sequence.current || requested !== rangeRef.current) return;
      if (!parsed || parsed === 'upgrade_required' || parsed.range.range !== requested)
        throw new Error('Invalid health check response');
      if (!check || check.status === 'unknown' || !check.recorded) {
        setNotice('Health check could not provide a recorded Render/model readiness observation. Previous dashboard data remains visible.');
        return;
      }
      setData(parsed);
    } catch {
      if (id === sequence.current && requested === rangeRef.current)
        setNotice('Health check could not provide a recorded Render/model readiness observation. Previous dashboard data remains visible.');
    } finally {
      healthLock.current = false;
      setHealthPending(false);
      if (id === sequence.current) setInitialLoading(false);
    }
  };
  const openDetail = async (id: string) => {
    if (!uuid.test(id)) { setDetailError('Enter a valid request UUID.'); return; }
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDetailError(null);
    const { data: response, error } = await supabase.functions.invoke('admin-monitoring', {
      body: { action: 'detail', request_id: id },
    });
    const item = error ? null : parseMonitoringDetail(response, id);
    if (!item) { setDetailError('Operational request details are unavailable.'); return; }
    setDetail(item);
  };
  const closeDetail = () => { setDetail(null); returnFocus.current?.focus(); };
  const changeAlert = async (alert: MonitoringAlert) => {
    setAlertPending(true);
    const { error } = await supabase.functions.invoke('admin-monitoring', {
      body: { action: alert.state === 'active' ? 'acknowledge' : 'resolve', alert_id: alert.id },
    });
    setAlertPending(false);
    if (error) { setNotice('Could not update the incident. Try again.'); return; }
    onBadgeChanged();
    void read(rangeRef.current);
  };
  const current = data;
  const totalActivity = current ? current.valuation.recorded_events + current.chatbot.recorded_interactions : 0;
  const edgeSamples = current && 'sample_count' in current.metrics.valuation_total_edge
    ? current.metrics.valuation_total_edge.sample_count : null;
  const rangeCaption = range === '7d' ? 'Today so far + previous 6 Singapore days'
    : range === '30d' ? 'Today so far + previous 29 Singapore days'
      : range === '1h' ? 'Rolling last hour' : 'Rolling last 24 hours';
  return <section aria-labelledby="monitoring-title" className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="monitoring-title" className="text-xl font-bold text-gray-900">System Monitoring</h2>
        <p className="mt-1 text-xs text-gray-600">{rangeCaption} · Recorded events only · SGT</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Monitoring time range" className="inline-flex rounded-lg bg-gray-100 p-1">
          {ranges.map((option) => <button key={option} type="button" aria-pressed={range === option}
            onClick={() => changeRange(option)}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${range === option ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}>{option}</button>)}
        </div>
        <span className="text-xs text-gray-600">{current ? `Data as of ${formatSgt(current.generated_at)} SGT` : 'No data loaded'}</span>
        <button className={button} onClick={() => void read(rangeRef.current)}><RefreshCw className="mr-1 inline h-4 w-4" aria-hidden="true" />Refresh data</button>
        <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
          onClick={() => void runHealth()} disabled={healthPending}>
          <Activity className="mr-1 inline h-4 w-4" aria-hidden="true" />{healthPending ? 'Running health check...' : 'Run health check'}
        </button>
      </div>
    </header>
    {healthPending && <p role="status" className="text-sm text-blue-700">Running health check. This may take a while if Render is starting.</p>}
    {updating && current && <p role="status" className="text-xs text-blue-700">Updating to {range}… Showing previous {current.range.range} data until it completes.</p>}
    {notice && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
      <span>{notice}{current && ` Showing data from ${formatSgt(current.generated_at)} SGT.`}</span>
      <button className={button} onClick={() => void read(rangeRef.current)}>Try again</button>
    </div>}
    {initialLoading && !current && <div role="status" aria-label="Loading monitoring dashboard" className="space-y-3 animate-pulse">
      <div className="h-14 rounded-xl bg-gray-100" /><div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 rounded-xl bg-gray-100" />)}</div><div className="h-56 rounded-xl bg-gray-100" />
    </div>}
    {upgrade && !current && <div className={card}><h3 className="font-semibold text-gray-900">Monitoring backend upgrade required</h3><p className="mt-2 text-sm text-gray-600">Advanced monitoring data is unavailable on the deployed backend.</p></div>}
    {!initialLoading && !current && !upgrade && <div className={card}><h3 className="font-semibold text-gray-900">Monitoring data unavailable</h3><p className="mt-2 text-sm text-gray-600">Try refreshing the dashboard.</p></div>}
    {current && <div aria-busy={updating || healthPending} className={updating || healthPending ? 'opacity-80' : ''}>
      <nav aria-label="Monitoring sections" className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 pb-2">
        {tabs.map((item) => <button key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}
          className={`rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${tab === item ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{item}</button>)}
      </nav>
      {tab === 'Overview' && <div className="space-y-4">
        <div className={`${card} flex flex-wrap items-center gap-x-5 gap-y-2 text-xs`}>
          <span className="font-semibold text-gray-700">Last admin check: {current.health[0] ? formatSgt(current.health[0].checked_at) + ' SGT' : 'Unavailable'}</span>
          <span>Application <StatePill value="unknown" /> No outside-in monitor</span>
          <span>Database <span className="text-gray-700">Monitoring data read</span></span>
          <span>Render model <StatePill value={current.health[0]?.status ?? 'unknown'} /> {current.health[0]?.source === 'admin_view' ? 'Admin check' : 'No observation'}</span>
          <span>Chatbot <span className="text-gray-700">Live health unknown</span></span>
          <span>Hosted canary <span className="text-gray-700">Not yet verified</span></span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ['Valuation requests', formatCount(current.valuation.recorded_events), `${current.valuation.successful_events} succeeded · recorded`],
            ['Chat interactions', formatCount(current.chatbot.recorded_interactions), `${current.chatbot.successful_interactions} succeeded · recorded`],
            ['P50 typical', percentileLabel(current.metrics.valuation_total_edge, 'p50'), `Valuation Edge total · n = ${edgeSamples ?? 'Unavailable'}`],
            ['P95 slow tail', percentileLabel(current.metrics.valuation_total_edge, 'p95'), `Valuation Edge total · n = ${edgeSamples ?? 'Unavailable'}`],
            ['P99 extreme tail', percentileLabel(current.metrics.valuation_total_edge, 'p99'), `Valuation Edge total · n = ${edgeSamples ?? 'Unavailable'}`],
            ['Unresolved incidents', current.unresolved_alert_count === null ? 'Unavailable' : String(current.unresolved_alert_count), `${current.active_unacknowledged_alert_count} active unacknowledged`],
          ].map(([label, value, sub]) => <div key={label} className={card}><p className="text-xs font-medium text-gray-600">{label}</p><p className="mt-2 break-words text-2xl font-bold tabular-nums text-gray-900">{value}</p><p className="mt-1 text-xs text-gray-600">{sub}</p></div>)}
        </div>
        {totalActivity === 0 ? <div className={card}><p className="font-semibold text-gray-900">No recorded requests in this period</p><p className="mt-1 text-sm text-gray-600">Recorded activity may be sparse or unavailable.</p>{range !== '7d' && <button className={`${button} mt-3`} onClick={() => changeRange('7d')}>Switch to 7d</button>}</div>
          : <div className="grid gap-4 lg:grid-cols-2"><VolumeChart data={current} /><LatencyChart data={current} /></div>}
        <div className="grid gap-4 lg:grid-cols-2"><Panel title="Recorded outcomes">
          <p className="text-sm text-gray-700">Valuation: {current.valuation.successful_events} succeeded of {current.valuation.recorded_events} recorded.</p>
          <p className="mt-2 text-sm text-gray-700">Chatbot: {current.chatbot.successful_interactions} succeeded of {current.chatbot.recorded_interactions} recorded.</p>
          <h4 className="mt-4 text-sm font-semibold text-gray-800">Failure categories</h4>
          <Counts values={{ ...current.valuation.failure_categories, ...current.chatbot.failure_categories }} empty="No failures recorded in this period." />
        </Panel><Incidents data={current} onAction={(alert) => void changeAlert(alert)} pending={alertPending} /></div>
        <div className={`${card} flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-700`}><strong>Data retention</strong>
          <span>Target {current.retention.target_days} days</span>
          <span>Oldest valuation event: {formatSgt(current.retention.oldest_valuation_event_at)} SGT</span>
          <span>Oldest health observation: {formatSgt(current.retention.oldest_service_health_check_at)} SGT</span>
          <span>Oldest resolved alert: {formatSgt(current.retention.oldest_resolved_alert_at)} SGT</span>
          <span>Cleanup scheduling not yet verified</span></div>
      </div>}
      {tab === 'Services' && <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Application"><StatePill value="unknown" /><p className="mt-2 text-sm text-gray-600">No outside-in monitor. Browser availability is unknown.</p></Panel>
        <Panel title="Database"><p className="text-sm text-gray-700">Monitoring data read succeeded. This does not establish continuous availability.</p></Panel>
        <Panel title="Chatbot"><StatePill value="unknown" /><p className="mt-2 text-sm text-gray-600">Stored interactions do not test live provider health.</p></Panel>
        <Panel title="Render model">{current.health[0] ? <><StatePill value={current.health[0].status} /><p className="mt-2 text-sm text-gray-700">Last observation: {formatSgt(current.health[0].checked_at)} SGT</p><p className="text-sm text-gray-600">Source: {current.health[0].source === 'admin_view' ? 'Admin check' : current.health[0].source}</p><p className="text-sm text-gray-600">Expected: {current.health[0].expected_model_version ?? 'Unavailable'} · Loaded: {current.health[0].loaded_model_version ?? 'Unavailable'}</p></>
          : <p className="text-sm text-gray-600">No admin health observation recorded.</p>}</Panel>
        <Panel title="Hosted canary"><p className="text-sm text-gray-600">Not yet verified.</p></Panel>
      </div>}
      {tab === 'Chatbot' && <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3"><Panel title="Recorded interactions"><p className="text-2xl font-bold tabular-nums">{formatCount(current.chatbot.recorded_interactions)}</p></Panel><Panel title="Successful interactions"><p className="text-2xl font-bold tabular-nums">{current.chatbot.successful_interactions}</p></Panel><Panel title="Provider calls"><p className="text-2xl font-bold tabular-nums">{current.chatbot.provider_calls}</p></Panel></div>
        <PercentileCards stats={current.metrics.chat_total_interaction} label="Interaction latency" />
        <PercentileCards stats={current.metrics.chat_provider} label="Provider latency" />
        <div className="grid gap-4 md:grid-cols-2"><Panel title="Provider outcomes"><Counts values={current.chatbot.provider_statuses} empty="No provider calls recorded in this period." /></Panel><Panel title="Failure categories"><Counts values={current.chatbot.failure_categories} empty="No failures recorded in this period." /></Panel></div>
        <Panel title="Other supported timings"><div className="grid gap-4 md:grid-cols-2"><div><h4 className="font-medium">Tool duration</h4><PercentileCards stats={current.metrics.chat_tool} label="Tool" /></div><div><h4 className="font-medium">First application output</h4><PercentileCards stats={current.metrics.chat_first_output} label="First output" /></div></div></Panel>
      </div>}
      {tab === 'Valuation' && <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2"><Panel title="Model observation"><p className="text-sm text-gray-700">Last admin check: {current.health[0] ? formatSgt(current.health[0].checked_at) + ' SGT' : 'Unavailable'}</p><p className="mt-1 text-sm text-gray-700">Expected: {current.health[0]?.expected_model_version ?? 'Unavailable'}</p><p className="text-sm text-gray-700">Loaded: {current.health[0]?.loaded_model_version ?? 'Unavailable'}</p></Panel><Panel title="Recorded valuation activity"><p className="text-2xl font-bold tabular-nums">{current.valuation.recorded_events}</p><p className="text-sm text-gray-600">{current.valuation.successful_events} succeeded · {current.valuation.prediction_sanity_failures} sanity failures</p></Panel></div>
        <Panel title="Stage timings" note="P50 needs 5 · P95 needs 20 · P99 needs 100 valid samples">
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-gray-200 text-xs text-gray-600"><tr><th className="p-2">Stage</th><th className="p-2">Valid n</th><th className="p-2">P50 typical</th><th className="p-2">P95 slow tail</th><th className="p-2">P99 extreme tail</th></tr></thead>
            <tbody>{(['valuation_total_edge', 'valuation_authentication', 'valuation_database_lookup', 'valuation_request_construction', 'valuation_render_fetch', 'render_total', 'catboost_prediction', 'conformal_interval'] as const).map((key) => {
              const stat = current.metrics[key]; const n = stat && 'sample_count' in stat ? stat.sample_count : null;
              return <tr key={key} className="border-b border-gray-100"><th className="p-2 font-medium text-gray-900">{metricNames[key]}<span className="block text-xs font-normal text-gray-600">{metricDescription[key]}</span></th><td className="p-2 tabular-nums">{n ?? '—'}</td>{(['p50', 'p95', 'p99'] as const).map((percentile) => <td key={percentile} className="p-2">{percentileLabel(stat, percentile)}{n !== null && n < sampleNeed[percentile] && <span className="block text-xs text-gray-500">{n}/{sampleNeed[percentile]}</span>}</td>)}</tr>;
            })}</tbody></table></div>
          <p className="mt-3 text-xs text-gray-600">Each timing uses its own valid samples. Operational latency does not measure valuation accuracy.</p>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2"><VolumeChart data={current} /><LatencyChart data={current} /></div>
        <Panel title="Recent valuation requests" note="Safe operational records only">
          <form onSubmit={(event) => { event.preventDefault(); void openDetail(requestId.trim()); }} className="mb-3 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="monitor-request-id">Look up request UUID</label><input id="monitor-request-id" value={requestId} onChange={(event) => setRequestId(event.target.value)} placeholder="Request UUID" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" />
            <button className={button}><Search className="mr-1 inline h-4 w-4" aria-hidden="true" />Open</button>
          </form>
          {detailError && <p role="alert" className="mb-2 text-sm text-rose-800">{detailError}</p>}
          {current.recent_valuation_requests === null ? <p className="text-sm text-gray-600">Recent request list unavailable.</p>
            : current.recent_valuation_requests.length === 0 ? <p className="text-sm text-gray-600">No valuation requests recorded in this range.</p>
              : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr><th className="p-2">Request ID</th><th className="p-2">Time (SGT)</th><th className="p-2">Outcome</th><th className="p-2">Edge total</th></tr></thead><tbody>{current.recent_valuation_requests.map((item) => <tr key={item.request_id} className="border-t border-gray-100"><td className="p-2"><button className="break-all text-left text-blue-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => void openDetail(item.request_id)}>{item.request_id}</button></td><td className="p-2">{formatSgt(item.created_at)}</td><td className="p-2">{item.status.replace(/_/g, ' ')}</td><td className="p-2">{formatDuration(item.total_edge_ms)}</td></tr>)}</tbody></table></div>}
        </Panel>
      </div>}
      {tab === 'Security' && <div className="grid gap-4 md:grid-cols-2"><Panel title="Recorded quota outcomes"><Counts values={current.chatbot.quota_outcomes} empty="No quota outcomes recorded in this period." /></Panel><Panel title="Coverage"><ShieldAlert className="h-5 w-5 text-gray-500" aria-hidden="true" /><p className="mt-2 text-sm text-gray-600">Historical coverage is limited to persisted classifications. Events blocked before telemetry begins are not counted here.</p></Panel></div>}
      {tab === 'Feedback' && <div className="grid gap-4 md:grid-cols-2"><Panel title="Recorded feedback"><p className="text-2xl font-bold tabular-nums">{current.chatbot.feedback_count}</p></Panel><Panel title="Rating distribution"><Counts values={current.chatbot.feedback_ratings} empty="No feedback collected in this period." /></Panel></div>}
    </div>}
    {detail && <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="operational-detail-title" onKeyDown={(event) => {
        if (event.key === 'Escape') closeDetail();
        if (event.key === 'Tab') { const button = dialogRef.current?.querySelector('button'); if (button) { event.preventDefault(); button.focus(); } }
      }} className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl outline-none">
        <div className="flex items-start justify-between gap-3"><div><h3 id="operational-detail-title" className="text-lg font-semibold text-gray-900">Operational request details</h3><p className="text-xs text-gray-600">No property, user, price or feature data.</p></div><button onClick={closeDetail} aria-label="Close request details" className={button}><X className="h-4 w-4" /></button></div>
        <p className="mt-4 break-all rounded-lg bg-gray-100 p-3 font-mono text-xs">{detail.request_id}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {([['Recorded', formatSgt(detail.created_at) + ' SGT'], ['Status', detail.status], ['Category', detail.failure_category ?? 'Unavailable'], ['Sanity result', detail.prediction_sanity ?? 'Unavailable'], ['Model version', detail.model_version ?? 'Unavailable']] as const).map(([name, value]) => <div key={name} className="min-w-0"><dt className="text-gray-600">{name}</dt><dd className="break-words font-medium text-gray-900">{value}</dd></div>)}
        </dl>
        <h4 className="mt-6 text-sm font-semibold text-gray-900">Measured Edge timings</h4>
        <dl className="mt-2 space-y-2">{([['Edge total', detail.total_edge_ms], ['Authentication', detail.authentication_ms], ['Database lookup', detail.database_lookup_ms], ['Request construction', detail.request_construction_ms], ['Render fetch', detail.render_fetch_ms]] as const).map(([name, value]) => <div key={name} className="flex justify-between gap-3 border-b border-gray-100 py-1 text-sm"><dt>{name}</dt><dd className="tabular-nums">{formatDuration(value)}</dd></div>)}</dl>
        <p className="mt-4 text-xs text-gray-600">Render total, CatBoost and conformal historical timings are unavailable. Use this request ID in approved service logs for the full trace.</p>
      </div>
    </div>}
  </section>;
}
