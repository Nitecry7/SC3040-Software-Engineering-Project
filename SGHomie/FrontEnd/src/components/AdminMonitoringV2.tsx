import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, AlertTriangle, BarChart3, Bot, CheckCircle2, ChevronRight, ClipboardCopy, Clock3, Cpu, Database, Download, FileText, Gauge, Globe2, Info, LayoutDashboard, MessageCircle, MessageSquare, Monitor, Radar, RefreshCw, Search, ShieldAlert, ShieldCheck, ThumbsDown, ThumbsUp, Timer, TrendingUp, Wrench, X, type LucideIcon } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { serializeFeedbackCopyForAnalysis, type FeedbackConversation } from '../../../BackEnd/supabase/functions/_shared/feedbackConversation';
import {
  formatCount, formatDuration, formatSgt, formatSgtWithZone, isUnsupportedMonitoringAction, monitoringBucketLabel, monitoringDisplayLabel, parseFeedbackConversation, parseHealthCheckResult,
  parseDashboard, parseMonitoringDetail, percentileMinimums,
  type DurationStats, type MonitoringAlert, type MonitoringDashboard, type MonitoringDetail, type MonitoringFeedback,
  type MonitoringRange,
} from '../lib/monitoringDashboard';
import type { AdminDashboardUrlState, MonitoringView } from '../lib/adminDashboardState';

const tabs: MonitoringView[] = ['overview', 'services', 'chatbot', 'valuation', 'security', 'feedback'];
const tabLabels: Record<MonitoringView, string> = {
  overview: 'Overview', services: 'Services', chatbot: 'Chatbot',
  valuation: 'Valuation', security: 'Security', feedback: 'Feedback',
};
const ranges: MonitoringRange[] = ['1h', '24h', '7d', '30d'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const card = 'rounded-xl border border-gray-200 bg-white p-4';
const button = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50';
const percentileCopy = {
  p50: ['P50 Typical Latency', '50% of recorded requests completed within this time, while 50% took longer.'],
  p95: ['P95 Slow Tail Latency', '95% of recorded requests completed within this time. Only the slowest 5% took longer.'],
  p99: ['P99 Extreme Tail Latency', '99% of recorded requests completed within this time. This highlights rare, unusually slow requests.'],
} as const;
const validSamplesHelp = {
  title: 'Valid Samples',
  text: 'The number of usable recorded measurements available for this timing. P50 requires at least 5 valid samples, P95 requires 20, and P99 requires 100.',
};
const metricIcons: Record<string, LucideIcon> = {
  valuation_total_edge: Timer, valuation_authentication: ShieldCheck, valuation_database_lookup: Database,
  valuation_request_construction: Wrench, valuation_render_fetch: Globe2, render_total: Cpu,
  catboost_prediction: TrendingUp, conformal_interval: BarChart3, chat_total_interaction: MessageCircle,
  chat_provider: Bot, chat_tool: Wrench, chat_first_output: Activity,
};
function IconTile({ icon: Icon, tone = 'blue' }: { icon: LucideIcon; tone?: 'blue' | 'teal' | 'green' | 'amber' | 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-800',
    teal: 'bg-teal-50 text-teal-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>;
}
function HelpTip({ title, text, required }: { title: string; text: string; required?: string }) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 8 });
  const open = hovered || focused;
  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!anchor || !tooltip) return;
      const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - tooltip.width / 2, window.innerWidth - tooltip.width - 8));
      const above = anchor.top - tooltip.height - 8;
      const top = above >= 8 ? above : Math.min(anchor.bottom + 8, window.innerHeight - tooltip.height - 8);
      setPosition({ top, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);
  const tooltip = <span ref={tooltipRef} id={tooltipId} role="tooltip" style={{ position: 'fixed', top: position.top, left: position.left, visibility: open ? 'visible' : 'hidden', opacity: open ? 1 : 0 }} className="pointer-events-none z-[1000] w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg transition-opacity">
      <strong className="block text-white">{title}</strong>{text}{required && <span className="mt-1 block text-slate-300">Requires at least {required} valid observations.</span>}
    </span>;
  return <span className="inline-flex align-middle">
    <button ref={triggerRef} type="button" aria-label={`Help: ${title}`} aria-describedby={tooltipId} aria-expanded={open}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onKeyDown={(event) => { if (event.key === 'Escape') { setHovered(false); setFocused(false); } }}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><Info className="h-4 w-4" aria-hidden="true" /></button>
    {typeof document === 'undefined' ? null : createPortal(tooltip, document.body)}
  </span>;
}
function SampleValue({ stats, percentile }: { stats: DurationStats | { state: 'unavailable' } | undefined; percentile: 'p50' | 'p95' | 'p99' }) {
  if (!stats || 'state' in stats) return <span className="text-slate-500">Unavailable</span>;
  if (stats[percentile].state === 'available') return <span className="font-semibold tabular-nums text-slate-900">{formatDuration(stats[percentile].value_ms)}</span>;
  const needed = percentileMinimums[percentile];
  const progress = Math.min(100, stats.sample_count / needed * 100);
  return <span className="block min-w-32"><span className="block text-sm text-slate-400">—</span><span className="block text-xs font-medium text-slate-600">Insufficient Samples</span>
    <span className="mt-1 block h-1.5 w-32 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><span className="block h-full rounded-full bg-slate-400" style={{ width: `${progress}%` }} /></span>
    <span className="mt-1 block text-xs text-slate-500">{stats.sample_count} of {needed} valid</span></span>;
}

function Panel({ title, note, children, icon, tone = 'blue', help, className = '' }: { title: string; note?: string; children: React.ReactNode; icon?: LucideIcon; tone?: 'blue' | 'teal' | 'green' | 'amber' | 'slate'; help?: { title: string; text: string }; className?: string }) {
  return <section className={`${card} ${className}`} aria-label={title}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <h3 className="flex items-center gap-3 text-base font-semibold text-gray-900">{icon && <IconTile icon={icon} tone={tone} />}{title}{help && <HelpTip {...help} />}</h3>
      {note && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{note}</span>}
    </div>
    {children}
  </section>;
}
function StatePill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = ['critical', 'failed', 'failure', 'provider_error'].includes(normalized) ? 'bg-rose-100 text-rose-900' : normalized === 'warning'
    ? 'bg-amber-100 text-amber-900' : ['healthy', 'success', 'ready', 'observed ready', 'data read ok', 'allowed', 'positive'].includes(normalized)
      ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{monitoringDisplayLabel(value)}</span>;
}
function Counts({ values, empty }: { values: Record<string, number>; empty: string }) {
  const entries = Object.entries(values);
  return entries.length ? <ul className="divide-y divide-gray-100 text-sm">
    {entries.map(([name, value]) => <li key={name} className="flex justify-between gap-3 py-2"><span className="text-gray-700">{monitoringDisplayLabel(name)}</span><strong className="tabular-nums text-gray-900">{value}</strong></li>)}
  </ul> : <p className="text-sm text-gray-600">{empty}</p>;
}
function combinedCounts(a: Record<string, number>, b: Record<string, number>) {
  return Object.keys({ ...a, ...b }).reduce((result, name) => {
    result[name] = (a[name] ?? 0) + (b[name] ?? 0);
    return result;
  }, {} as Record<string, number>);
}
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number | null; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"><p className="mb-1 font-semibold text-slate-900">{label}</p>{payload.map((item) => <p key={item.name} className="flex items-center gap-2 py-0.5 text-slate-700"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}<strong className="ml-auto pl-3 tabular-nums">{item.value === null ? 'Unavailable' : item.name.toLowerCase().includes('latency') || item.name.startsWith('P') ? formatDuration(item.value) : item.value}</strong></p>)}</div>;
}
function LegendItems({ items }: { items: Array<{ name: string; color: string; dashed?: boolean }> }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">{items.map((item) => <li key={item.name} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-sm ${item.dashed ? 'border border-dashed border-slate-500 bg-white' : ''}`} style={item.dashed ? undefined : { backgroundColor: item.color }} aria-hidden="true" />{item.name}</li>)}</ul>;
}
export function VolumeChart({ data }: { data: MonitoringDashboard }) {
  const points = data.valuation.series.map((bucket) => ({
    label: monitoringBucketLabel(bucket.label, bucket.bucket_start, data.range.range), valuation: bucket.request_count,
    chatbot: bucket.chatbot_request_count, today: bucket.label === 'Today so far' || bucket.label === 'Today (Partial)' || bucket.label === 'Today',
  }));
  return <Panel title="Recorded Request Volume" icon={Activity} note={`${data.range.range} · ${data.aggregation_timezone}`}>
    <p id="volume-summary" className="sr-only">Recorded valuation and chatbot events for each Singapore time bucket. A table follows the chart.</p>
    <LegendItems items={[{ name: 'Valuation', color: '#2563eb' }, { name: 'Chatbot', color: '#0f766e' }, { name: 'Today', color: '', dashed: true }]} />
    {points.length === 0 ? <div className="mt-3 flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center"><IconTile icon={TrendingUp} tone="blue" /><h4 className="mt-3 font-semibold text-slate-800">No Recorded Activity in This Range</h4><p className="mt-1 text-sm text-slate-600">Recorded request counts will appear here when events are available.</p></div> : <div role="img" aria-labelledby="volume-summary" className="mt-3 h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -25 }}>
          <defs><pattern id="monitoring-today" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#eff6ff" /><line x1="0" y1="0" x2="0" y2="6" stroke="#93c5fd" strokeWidth="2" /></pattern></defs>
          <CartesianGrid stroke="#e8edf3" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={18} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="valuation" name="Valuation recorded" stackId="requests" fill="#2563eb">
            {points.map((point, index) => <Cell key={index} fill={point.today ? 'url(#monitoring-today)' : '#2563eb'} stroke={point.today ? '#2563eb' : 'none'} strokeDasharray={point.today ? '4 3' : undefined} strokeWidth={point.today ? 1.5 : 0} />)}
          </Bar>
          <Bar dataKey="chatbot" name="Chatbot recorded" stackId="requests" fill="#0f766e">
            {points.map((point, index) => <Cell key={index} fill={point.today ? 'url(#monitoring-today)' : '#0f766e'} stroke={point.today ? '#0f766e' : 'none'} strokeDasharray={point.today ? '4 3' : undefined} strokeWidth={point.today ? 1.5 : 0} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>}
    <details className="mt-2 text-sm"><summary className="cursor-pointer text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">View data as table</summary>
      <div className="mt-2 overflow-x-auto"><table className="min-w-full text-left text-xs"><caption className="sr-only">Recorded events by Singapore time bucket</caption>
        <thead><tr><th className="p-2">Bucket (SGT)</th><th className="p-2">Valuation recorded</th><th className="p-2">Chatbot recorded</th></tr></thead>
        <tbody>{points.map((point, index) => <tr key={index} className={point.today ? 'border-l-2 border-blue-600 bg-blue-50' : 'border-t border-gray-100'}><th className="p-2 font-normal">{point.label}</th><td className="p-2">{point.valuation}</td><td className="p-2">{point.chatbot}</td></tr>)}</tbody>
      </table></div>
    </details>
    <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">Recorded events may undercount traffic when best-effort telemetry writes fail. <HelpTip title="Best-Effort Telemetry" text="Monitoring writes can fail independently of the user request, so recorded events may undercount actual activity." /></p>
  </Panel>;
}
export function LatencyChart({ data }: { data: MonitoringDashboard }) {
  const points = data.valuation.series.map((bucket) => ({
    label: monitoringBucketLabel(bucket.label, bucket.bucket_start, data.range.range), count: bucket.total_edge.sample_count,
    p50: bucket.total_edge.p50.value_ms, p95: bucket.total_edge.p95.value_ms,
    p99: bucket.total_edge.p99.value_ms,
  }));
  const showP99 = points.filter((point) => point.p99 !== null).length >= 2;
  const supported = points.some((point) => point.p50 !== null || point.p95 !== null || point.p99 !== null);
  return <Panel title="Valuation Latency · Edge Total" icon={Timer} note={`Valid samples · ${data.range.range}`}>
    <p id="latency-summary" className="sr-only">P50 typical and P95 slow-tail Edge latency by bucket. Missing points have insufficient samples. A table follows the chart.</p>
    {!supported ? <div className="mt-3 flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center"><IconTile icon={Timer} tone="blue" /><h4 className="mt-3 font-semibold text-slate-800">Not Enough Requests to Plot Latency Yet</h4><p className="mt-1 max-w-md text-sm text-slate-600">Latency trends appear once enough valid requests exist in a time bucket.</p></div> : <><LegendItems items={[{ name: 'P50 Typical', color: '#2563eb' }, { name: 'P95 Slow Tail', color: '#0f766e' }, ...(showP99 ? [{ name: 'P99 Extreme Tail', color: '#64748b' }] : [])]} />
    <div role="img" aria-labelledby="latency-summary" className="mt-3 h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#e8edf3" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={18} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value: number) => formatDuration(value)} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="p50" name="P50 Typical" stroke="#2563eb" strokeWidth={2.5} fill="#dbeafe" fillOpacity={0.45} connectNulls={false} />
          <Area type="monotone" dataKey="p95" name="P95 Slow Tail" stroke="#0f766e" strokeWidth={2} fill="none" connectNulls={false} />
          {showP99 && <Area type="monotone" dataKey="p99" name="P99 Extreme Tail" stroke="#64748b" strokeWidth={2} fill="none" strokeDasharray="4 3" connectNulls={false} />}
        </AreaChart>
      </ResponsiveContainer>
    </div></>}
    <details className="mt-2 text-sm"><summary className="cursor-pointer text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">View data as table</summary>
      <div className="mt-2 overflow-x-auto"><table className="min-w-full text-left text-xs"><caption className="sr-only">Edge latency percentiles by Singapore time bucket</caption>
        <thead><tr><th className="p-2">Bucket (SGT)</th><th className="p-2">Valid Samples <HelpTip {...validSamplesHelp} /></th><th className="p-2">P50</th><th className="p-2">P95</th><th className="p-2">P99</th></tr></thead>
        <tbody>{points.map((point, index) => <tr key={index} className="border-t border-gray-100"><th className="p-2 font-normal">{point.label}</th><td className="p-2">{point.count}</td><td className="p-2">{point.p50 === null ? 'Insufficient Samples' : formatDuration(point.p50)}</td><td className="p-2">{point.p95 === null ? 'Insufficient Samples' : formatDuration(point.p95)}</td><td className="p-2">{point.p99 === null ? 'Insufficient Samples' : formatDuration(point.p99)}</td></tr>)}</tbody>
      </table></div>
    </details>
    <p className="mt-2 text-xs text-gray-500">Tail percentile points are omitted when a time bucket does not contain enough recorded requests.</p>
  </Panel>;
}
function Incidents({ data, onAction, pending }: { data: MonitoringDashboard; onAction: (alert: MonitoringAlert) => void; pending: boolean }) {
  return <Panel title="Unresolved Incidents" icon={AlertTriangle} tone="amber" note="Recovery does not resolve an incident">
    {data.unresolved_alerts === null ? <p className="text-sm text-gray-600">Incident list unavailable.</p>
      : data.unresolved_alerts.length === 0 ? <p className="text-sm text-gray-600">No unresolved incidents recorded.</p>
        : <div className="space-y-3">{data.unresolved_alerts.map((alert) => <article key={alert.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2"><StatePill value={alert.severity} /><StatePill value={alert.state} /><strong className="break-all text-sm text-gray-900">{monitoringDisplayLabel(alert.category)}</strong></div>
            <button className={button} disabled={pending} onClick={() => onAction(alert)}>{alert.state === 'active' ? 'Acknowledge' : 'Resolve'}</button>
          </div>
          <dl className="mt-3 grid gap-2 text-xs text-gray-700 sm:grid-cols-3">
            <div><dt>First Detected</dt><dd>{formatSgtWithZone(alert.first_detected_at)}</dd></div>
            <div><dt>Last Detected</dt><dd>{formatSgtWithZone(alert.last_detected_at)}</dd></div>
            <div><dt>Occurrences</dt><dd>{alert.occurrence_count}</dd></div>
          </dl>
          {alert.latest_request_id && <p className="mt-2 break-all text-xs text-gray-700">Latest request ID: {alert.latest_request_id}</p>}
          {alert.source === 'render_model' && data.health[0]?.status === 'healthy' && <p className="mt-2 text-xs text-gray-600">Latest admin check observed the model ready. Resolve the incident when reviewed.</p>}
        </article>)}</div>}
  </Panel>;
}

function MetricTile({ icon, label, value, note, tone = 'blue', help }: { icon: LucideIcon; label: string; value: React.ReactNode; note: string; tone?: 'blue' | 'teal' | 'green' | 'amber' | 'slate'; help?: { title: string; text: string } }) {
  return <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4" aria-label={label}>
    <div className="flex min-w-0 items-start gap-3"><IconTile icon={icon} tone={tone} /><div className="min-w-0 flex-1"><p className="flex items-center gap-1 text-xs font-medium text-slate-600">{label}{help && <HelpTip title={help.title} text={help.text} />}</p><div className="mt-1 break-words text-2xl font-semibold tabular-nums leading-7 text-slate-900">{value}</div><p className="mt-1 text-xs text-slate-500">{note}</p></div></div>
  </section>;
}
function PercentileTile({ percentile, stats, tone }: { percentile: 'p50' | 'p95' | 'p99'; stats: DurationStats | { state: 'unavailable' } | undefined; tone: 'blue' | 'teal' | 'slate' }) {
  const Icon = percentile === 'p50' ? Timer : Gauge;
  const title = percentileCopy[percentile][0];
  const samples = stats && 'sample_count' in stats ? `${stats.sample_count} valid samples` : 'Source unavailable';
  return <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-3" aria-label={title}>
    <div className="flex items-center gap-2"><IconTile icon={Icon} tone={tone} /><p className="min-w-0 text-xs font-medium text-slate-600">{title}</p><HelpTip title={title} text={percentileCopy[percentile][1]} required={String(percentileMinimums[percentile])} /></div>
    <div className="mt-2 min-h-[3.75rem] text-xl tabular-nums"><SampleValue stats={stats} percentile={percentile} /></div><p className="text-xs text-slate-500">{samples}</p>
  </section>;
}
function ServiceStrip({ data }: { data: MonitoringDashboard }) {
  const observation = data.health[0];
  const items: Array<{ name: string; icon: LucideIcon; tone: 'blue' | 'teal' | 'green' | 'slate'; state: string; evidence: string; help?: { title: string; text: string } }> = [
    { name: 'Application', icon: Monitor, tone: 'slate', state: 'Unknown', evidence: 'No outside-in monitor' },
    { name: 'Database', icon: Database, tone: 'green', state: 'Data Read OK', evidence: 'Monitoring data read' },
    { name: 'Chatbot', icon: Bot, tone: 'teal', state: 'Live Health Unknown', evidence: 'Stored outcomes only' },
    { name: 'Render Model', icon: Cpu, tone: observation?.status === 'healthy' ? 'green' : 'slate', state: observation?.status === 'healthy' ? 'Observed Ready' : observation ? monitoringDisplayLabel(observation.status) : 'Unknown', evidence: observation ? `Admin check · ${formatSgtWithZone(observation.checked_at)}` : 'No admin check recorded', help: { title: 'Admin Check', text: 'A point-in-time Render/model readiness observation. It does not measure continuous uptime.' } },
    { name: 'Hosted Canary', icon: Radar, tone: 'slate', state: 'Not Yet Verified', evidence: 'Deferred', help: { title: 'Hosted Canary', text: 'An end-to-end hosted run is not implemented or recorded.' } },
  ];
  return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{items.map((item) => <div key={item.name} className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
    <IconTile icon={item.icon} tone={item.tone} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><p className="text-sm font-semibold text-slate-800">{item.name}</p><StatePill value={item.state} />{item.help && <HelpTip {...item.help} />}</div><p className="mt-0.5 truncate text-xs text-slate-500">{item.evidence}</p></div>
  </div>)}</div>;
}
function ServiceCard({ icon, name, state, evidence, copy, tone = 'slate', help, lastObserved, className = '' }: { icon: LucideIcon; name: string; state: string; evidence: string; copy: string; tone?: 'green' | 'slate' | 'teal'; help?: { title: string; text: string }; lastObserved?: string | null; className?: string }) {
  return <Panel title={name} icon={icon} tone={tone} help={help} className={className}><div className="flex items-center justify-between gap-3"><StatePill value={state} /></div><p className="mt-3 text-sm leading-5 text-slate-600">{copy}</p><dl className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2"><div><dt className="font-medium text-slate-500">Evidence</dt><dd className="mt-0.5 font-semibold text-slate-700">{evidence}</dd></div>{lastObserved !== undefined && <div><dt className="font-medium text-slate-500">Last Observed</dt><dd className="mt-0.5 font-semibold text-slate-700">{lastObserved ?? 'Unavailable'}</dd></div>}</dl></Panel>;
}
function MetricDatum({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="font-medium text-slate-500">{label}</dt><dd className="mt-0.5 break-words font-semibold text-slate-800">{value || 'Unavailable'}</dd></div>;
}
function ValueChip({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="min-w-0"><dt className="font-medium text-slate-500">{label}</dt><dd className="mt-1"><span className="inline-flex max-w-full break-all rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{value || 'Unavailable'}</span></dd></div>;
}
function QuotaOutcomes({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const details: Record<string, string> = {
    allowed: 'The request passed the configured quota checks.',
    user_burst_limit: 'The user exceeded the allowed short-term request rate.',
    CHAT_USER_BURST_LIMIT: 'The user exceeded the allowed short-term request rate.',
    user_daily_limit: 'The user reached the configured daily usage allowance.',
    CHAT_USER_DAILY_LIMIT: 'The user reached the configured daily usage allowance.',
  };
  return entries.length ? <ul className="divide-y divide-slate-100">{entries.map(([key, amount]) => {
    const ratio = total ? amount / total * 100 : 0;
    const positive = key.toLowerCase() === 'allowed';
    const Icon = positive ? CheckCircle2 : key.toLowerCase().includes('daily') ? Clock3 : Gauge;
    const help = key.toLowerCase().includes('burst') ? { title: 'User Burst Limit', text: 'The user exceeded the allowed short-term chatbot request rate.' } : key.toLowerCase().includes('daily') ? { title: 'User Daily Limit', text: 'The user reached the configured daily chatbot usage allowance.' } : undefined;
    return <li key={key} className="py-3"><div className="flex items-center gap-3"><IconTile icon={Icon} tone={positive ? 'green' : 'slate'} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="text-sm text-slate-800">{monitoringDisplayLabel(key)} {help && <HelpTip {...help} />}</strong><span className="text-sm font-semibold tabular-nums text-slate-900">{amount}<span className="ml-1 text-xs font-normal text-slate-500">· {ratio.toFixed(1)}%</span></span></div><p className="mt-0.5 text-xs text-slate-500">{details[key] ?? 'Recorded quota classification.'}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${positive ? 'bg-emerald-600' : 'bg-slate-500'}`} style={{ width: `${ratio}%` }} /></div></div></div></li>;
  })}</ul> : <p className="text-sm text-slate-600">No quota outcomes recorded in this period.</p>;
}
function RatingDistribution({ values }: { values: Record<string, number> }) {
  const positive = values.positive ?? 0; const negative = values.negative ?? 0; const total = positive + negative;
  if (!total) return <p className="text-sm text-slate-600">No feedback ratings recorded in this period.</p>;
  return <div><div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${positive} positive ratings and ${negative} negative ratings`}><span className="bg-emerald-600" style={{ width: `${positive / total * 100}%` }} /><span className="bg-slate-500" style={{ width: `${negative / total * 100}%` }} /></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />Positive · {positive} · {(positive / total * 100).toFixed(1)}%</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-slate-500" />Negative · {negative} · {(negative / total * 100).toFixed(1)}%</span></div></div>;
}
function OutcomeBar({ label, success, total, tone = 'blue' }: { label: string; success: number; total: number; tone?: 'blue' | 'teal' }) {
  const ratio = total > 0 ? Math.max(0, Math.min(100, success / total * 100)) : 0;
  const color = tone === 'teal' ? 'bg-teal-700' : 'bg-blue-700';
  return <div className="mt-3"><div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><strong className="text-slate-800">{label}</strong><span className="text-slate-600"><strong className="tabular-nums text-slate-900">{success}</strong> of {total} succeeded{total > 0 && ` · ${ratio.toFixed(1)}%`}</span></div><div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${success} of ${total} succeeded`}><span className={color} style={{ width: `${ratio}%` }} /><span className="bg-rose-600" style={{ width: `${100 - ratio}%` }} /></div></div>;
}
function FeedbackList({ items, selected, onSelect }: { items: MonitoringFeedback[] | null; selected: string | null; onSelect: (item: MonitoringFeedback, target: HTMLButtonElement) => void }) {
  if (items === null) return <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4"><IconTile icon={MessageSquare} tone="teal" /><div><p className="font-semibold text-slate-800">Feedback Details Unavailable</p><p className="mt-0.5 text-sm text-slate-600">The monitoring backend could not provide the recent feedback list. Ratings remain available above.</p></div></div>;
  if (!items.length) return <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center"><IconTile icon={MessageSquare} tone="teal" /><p className="mt-3 font-semibold text-slate-800">No Feedback In This Range</p><p className="mt-1 text-sm text-slate-600">Recorded ratings appear here when available.</p></div>;
  return <ul className="divide-y divide-slate-100">{items.map((item) => <li key={item.feedback_id}><button type="button" aria-pressed={selected === item.feedback_id} onClick={(event) => onSelect(item, event.currentTarget)} className={`flex min-h-16 w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selected === item.feedback_id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}><IconTile icon={item.rating === 'positive' ? ThumbsUp : ThumbsDown} tone={item.rating === 'positive' ? 'green' : 'slate'} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{monitoringDisplayLabel(item.rating)}</span><span className="block truncate text-xs text-slate-600">{item.comment?.trim() || 'No Written Comment'}</span></span><time className="shrink-0 text-xs text-slate-500">{formatSgt(item.recorded_at)}</time><ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /></button></li>)}</ul>;
}
function FeedbackDetails({ item, context, loading, error, actionPending, actionMessage, onClose, onExport, onCopy, panelRef }: {
  item: MonitoringFeedback; context: FeedbackConversation | null; loading: boolean; error: 'upgrade' | 'read' | null;
  actionPending: string | null; actionMessage: string | null; onClose: () => void;
  onExport: (format: 'export_markdown' | 'export_text' | 'export_json') => void; onCopy: () => void;
  panelRef: React.RefObject<HTMLElement>;
}) {
  const feedback = context?.feedback;
  const technical = context?.technical_context;
  const displayedComment = context
    ? feedback?.comment ?? 'No Written Comment'
    : item.comment ?? 'No Written Comment';
  return <aside ref={panelRef} tabIndex={-1} aria-labelledby="feedback-detail-title" className="max-h-[calc(100vh-7rem)] min-w-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 xl:sticky xl:top-4 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><h3 id="feedback-detail-title" className="text-lg font-semibold text-slate-900">Feedback Details</h3><p className="mt-1 text-xs leading-5 text-slate-600">Stored redacted text may still contain details the redactor does not detect.</p></div><button type="button" aria-label="Close feedback details" onClick={onClose} className={button}><X className="h-4 w-4" aria-hidden="true" /></button></div>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><MetricDatum label="Rating" value={monitoringDisplayLabel(feedback?.rating ?? item.rating)} /><MetricDatum label="Recorded" value={formatSgtWithZone(feedback?.recorded_at ?? item.recorded_at)} /></dl>
    <div className="mt-4"><h4 className="text-xs font-semibold text-slate-500">Feedback Comment</h4><p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{displayedComment}</p>{feedback?.comment_expires_at && <p className="mt-2 text-xs text-slate-500">Comment retained until {formatSgtWithZone(feedback.comment_expires_at)}.</p>}</div>
    <section className="mt-5 border-t border-slate-100 pt-4" aria-labelledby="feedback-conversation-title"><h4 id="feedback-conversation-title" className="text-sm font-semibold text-slate-900">Conversation Context</h4>
      {loading && <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Loading stored conversation context…</p>}
      {error === 'upgrade' && <div role="status" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="font-medium text-slate-800">Monitoring Backend Upgrade Required</p><p className="mt-1 text-sm text-slate-600">Deploy the current admin-monitoring function to inspect feedback conversations.</p></div>}
      {error === 'read' && <p role="alert" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Conversation context could not be retrieved. Feedback details remain available; try opening this item again.</p>}
      {!loading && !error && context?.conversation_state === 'unavailable' && <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="font-medium text-slate-800">Conversation Context Unavailable</p><p className="mt-1 text-sm leading-5 text-slate-600">Stored conversation text is retained for up to 30 days after the interaction. Ratings remain available after transcript expiry.</p>{context.content_expires_at && <p className="mt-2 text-xs text-slate-500">Stored content expiry date: {formatSgtWithZone(context.content_expires_at)}. The transcript is not available for this feedback item.</p>}</div>}
      {!loading && !error && context?.conversation_state === 'available' && <>
        <p className="mt-1 text-xs leading-5 text-slate-500">Stored redacted text · up to six preceding messages · {context.content_expires_at ? `available until ${formatSgtWithZone(context.content_expires_at)}` : 'retention date unavailable'}.</p>
        {context.conversation.map((message, index) => <article key={`${message.role}-${index}`} aria-label={message.rated ? 'Rated assistant response' : message.role === 'user' ? 'User message' : 'Assistant response'} className={`mt-3 rounded-lg p-3 ${message.rated ? 'border border-blue-200 bg-blue-50' : 'bg-slate-50'}`}><div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-xs font-semibold text-slate-700">{message.role === 'user' ? 'User' : message.rated ? 'Assistant Response · Rated' : 'Assistant'}</h5>{message.truncated && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700">Truncated</span>}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{message.content}</p></article>)}
        {(context.truncated || context.omitted_context_count > 0) && <p className="mt-3 text-xs text-slate-600">Some context was omitted to fit the display limits. {context.omitted_context_count} earlier messages omitted.</p>}
      </>}
    </section>
    {technical && <details className="mt-5 border-t border-slate-100 pt-4"><summary className="cursor-pointer rounded-sm text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Technical Context</summary><dl className="mt-3 grid grid-cols-2 gap-3 text-xs">{([['Provider', technical.provider], ['Requested Model', technical.requested_model], ['Resolved Model', technical.resolved_model], ['Prompt Version', technical.prompt_version], ['Outcome', technical.outcome], ['Total Latency', technical.total_latency_ms === null ? null : `${technical.total_latency_ms} ms`]] as const).filter(([, value]) => value !== null).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-slate-500">{label}</dt><dd className="break-words text-slate-800">{value}</dd></div>)}</dl>{technical.tool_summary && <p className="mt-3 break-words text-xs text-slate-600">Tool: {technical.tool_summary.name} · {technical.tool_summary.called ? 'called' : 'not called'}{technical.tool_summary.succeeded === null ? '' : technical.tool_summary.succeeded ? ' · succeeded' : ' · failed'}</p>}{technical.provider_calls?.length ? <ul className="mt-3 space-y-2 text-xs text-slate-600">{technical.provider_calls.map((call, index) => <li key={`${call.provider}-${index}`}>{call.provider} · {call.outcome}{call.resolved_model ? ` · ${call.resolved_model}` : ''}{call.latency_ms === null ? '' : ` · ${call.latency_ms} ms`}</li>)}</ul> : null}</details>}
    {context && <section className="mt-5 border-t border-slate-100 pt-4"><h4 className="text-sm font-semibold text-slate-900">Exports</h4><p className="mt-1 text-xs leading-5 text-slate-600">Conversation exports may contain user-provided information. Handle them according to project data-handling requirements.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={actionPending !== null} onClick={() => onExport('export_markdown')} className={button}><Download className="mr-1 inline h-4 w-4" aria-hidden="true" />Markdown</button><button type="button" disabled={actionPending !== null} onClick={() => onExport('export_text')} className={button}><FileText className="mr-1 inline h-4 w-4" aria-hidden="true" />Text</button><button type="button" disabled={actionPending !== null} onClick={() => onExport('export_json')} className={button}><Download className="mr-1 inline h-4 w-4" aria-hidden="true" />JSON</button><button type="button" disabled={actionPending !== null} onClick={onCopy} className={button}><ClipboardCopy className="mr-1 inline h-4 w-4" aria-hidden="true" />Copy for Analysis</button></div>{actionPending && <p role="status" className="mt-2 text-xs text-slate-600">Preparing {actionPending.replace('export_', '')} export…</p>}{actionMessage && <p role="status" aria-live="polite" className="mt-2 text-xs text-slate-600">{actionMessage}</p>}</section>}
  </aside>;
}
function OperationalRequestDetails({ detail, onClose, panelRef }: { detail: MonitoringDetail; onClose: () => void; panelRef: React.RefObject<HTMLElement> }) {
  return <aside ref={panelRef} tabIndex={-1} aria-labelledby="operational-detail-title" className="h-fit min-w-0 rounded-xl border border-slate-200 bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><h3 id="operational-detail-title" className="text-lg font-semibold text-gray-900">Operational Request Details</h3><p className="mt-1 text-xs text-gray-600">No property, user, price or feature data is shown.</p></div><button type="button" onClick={onClose} aria-label="Close request details" className={button}><X className="h-4 w-4" aria-hidden="true" /></button></div>
    <p className="mt-4 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">{detail.request_id}</p>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{([['Recorded', formatSgtWithZone(detail.created_at)], ['Status', monitoringDisplayLabel(detail.status)], ['Category', detail.failure_category ? monitoringDisplayLabel(detail.failure_category) : 'Unavailable'], ['Sanity Result', detail.prediction_sanity ? monitoringDisplayLabel(detail.prediction_sanity) : 'Unavailable'], ['Model Version', detail.model_version ?? 'Unavailable']] as const).map(([name, value]) => <div key={name} className="min-w-0"><dt className="text-gray-600">{name}</dt><dd className="break-words font-medium text-gray-900">{value}</dd></div>)}</dl>
    <h4 className="mt-6 text-sm font-semibold text-gray-900">Measured Edge Timings</h4>
    <dl className="mt-2 space-y-2">{([['Edge Total', detail.total_edge_ms], ['Authentication', detail.authentication_ms], ['Database Lookup', detail.database_lookup_ms], ['Request Construction', detail.request_construction_ms], ['Render Fetch', detail.render_fetch_ms]] as const).map(([name, value]) => <div key={name} className="flex justify-between gap-3 border-b border-gray-100 py-2 text-sm"><dt>{name}{name === 'Request Construction' && <HelpTip title={name} text="Includes eligibility checks, feature preparation, and trusted request preparation." />}{name === 'Render Fetch' && <HelpTip title={name} text="Measures the full outbound HTTP request duration." />}</dt><dd className="tabular-nums">{formatDuration(value)}</dd></div>)}</dl>
    <p className="mt-4 text-xs text-gray-600">Render total, CatBoost and conformal historical timings are unavailable. Use this request ID in approved service logs for the full trace.</p>
  </aside>;
}
function TimingMatrix({ rows, label, metrics }: { rows: Array<{ key: string; name: string; description: string }>; label: string; metrics: MonitoringDashboard['metrics'] }) {
  return <Panel title={label} icon={Timer} note="Each timing uses its own valid observations">
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
      <caption className="sr-only">{label} percentiles and valid sample counts</caption>
      <thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="py-3 pr-4">Timing</th>{(['p50', 'p95', 'p99'] as const).map((p) => <th key={p} className="px-3 py-3">{percentileCopy[p][0]} <HelpTip title={percentileCopy[p][0]} text={percentileCopy[p][1]} required={String(percentileMinimums[p])} /></th>)}<th className="px-3 py-3 text-right">Valid Samples <HelpTip {...validSamplesHelp} /></th></tr></thead>
      <tbody>{rows.map((row) => {
        const stats = metrics[row.key];
        const n = stats && 'sample_count' in stats ? stats.sample_count : null;
        const Icon = metricIcons[row.key] ?? Timer;
        return <tr key={row.key} className="border-b border-slate-100 last:border-0"><th scope="row" className="py-3 pr-4 font-medium text-slate-800"><span className="flex items-center gap-3"><IconTile icon={Icon} tone="blue" /><span>{row.name}{row.key === 'valuation_request_construction' && <HelpTip title="Request Construction" text="Includes eligibility checks, feature preparation, and trusted request preparation." />}{row.key === 'valuation_render_fetch' && <HelpTip title="Render Fetch" text="Measures the full outbound HTTP request duration." />}<span className="mt-0.5 block text-xs font-normal text-slate-500">{row.description}</span></span></span></th>{(['p50', 'p95', 'p99'] as const).map((p) => <td key={p} className="px-3 py-3 align-middle"><SampleValue stats={stats} percentile={p} /></td>)}<td className="px-3 py-3 text-right font-medium tabular-nums text-slate-600">{n === null ? '—' : n}</td></tr>;
      })}</tbody>
    </table></div>
  </Panel>;
}

export default function AdminMonitoringV2({
  onBadgeChanged, range, view: tab, onViewChange, onRangeChange,
}: {
  onBadgeChanged: () => void;
  range: AdminDashboardUrlState['range'];
  view: MonitoringView;
  onViewChange: (view: MonitoringView) => void;
  onRangeChange: (range: AdminDashboardUrlState['range']) => void;
}) {
  const rangeRef = useRef<MonitoringRange>(range);
  rangeRef.current = range;
  const [data, setData] = useState<MonitoringDashboard | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [healthPending, setHealthPending] = useState(false);
  const healthLock = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [detail, setDetail] = useState<MonitoringDetail | null>(null);
  const [feedbackDetail, setFeedbackDetail] = useState<string | null>(null);
  const [feedbackContext, setFeedbackContext] = useState<FeedbackConversation | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<'upgrade' | 'read' | null>(null);
  const [feedbackActionPending, setFeedbackActionPending] = useState<string | null>(null);
  const [feedbackActionMessage, setFeedbackActionMessage] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState('');
  const [alertPending, setAlertPending] = useState(false);
  const sequence = useRef(0);
  const feedbackRequestSequence = useRef(0);
  const detailPanelRef = useRef<HTMLElement>(null);
  const feedbackPanelRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const feedbackReturnFocus = useRef<HTMLButtonElement | null>(null);

  const clearFeedbackDetails = useCallback((restoreFocus = false) => {
    feedbackRequestSequence.current += 1;
    setFeedbackDetail(null);
    setFeedbackContext(null);
    setFeedbackLoading(false);
    setFeedbackError(null);
    setFeedbackActionPending(null);
    setFeedbackActionMessage(null);
    if (restoreFocus) feedbackReturnFocus.current?.focus();
    feedbackReturnFocus.current = null;
  }, []);

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
      if (parsed === 'upgrade_required') { setUpgrade(true); setData(null); clearFeedbackDetails(); return; }
      if (!parsed || parsed.range.range !== requested) throw new Error('Invalid monitoring dashboard response');
      setUpgrade(false);
      clearFeedbackDetails();
      setData(parsed);
    } catch (error) {
      if (id === sequence.current && requested === rangeRef.current) {
        if (isUnsupportedMonitoringAction(error)) { setUpgrade(true); setData(null); clearFeedbackDetails(); }
        else setNotice('Couldn’t refresh monitoring data. This is a dashboard read error, not a service outage.');
      }
    } finally {
      if (id === sequence.current) { setUpdating(false); setInitialLoading(false); }
    }
  }, [clearFeedbackDetails]);
  useEffect(() => {
    void read(range);
    return () => { sequence.current += 1; };
  }, [read, range]);
  useEffect(() => () => { feedbackRequestSequence.current += 1; }, []);
  useEffect(() => {
    if (!detail) return;
    detailPanelRef.current?.focus();
  }, [detail]);
  useEffect(() => {
    if (!feedbackDetail) return;
    feedbackPanelRef.current?.focus();
  }, [feedbackDetail]);
  const changeRange = (next: MonitoringRange) => {
    if (next === rangeRef.current) return;
    rangeRef.current = next;
    clearFeedbackDetails();
    onRangeChange(next);
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
      clearFeedbackDetails();
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
  const openFeedbackDetails = async (item: MonitoringFeedback, target: HTMLButtonElement) => {
    const requestId = ++feedbackRequestSequence.current;
    feedbackReturnFocus.current = target;
    setFeedbackDetail(item.feedback_id);
    setFeedbackContext(null);
    setFeedbackError(null);
    setFeedbackActionMessage(null);
    setFeedbackLoading(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('admin-monitoring', {
        body: { action: 'get_feedback_conversation', feedback_id: item.feedback_id },
      });
      if (requestId !== feedbackRequestSequence.current) return;
      if (error) {
        setFeedbackError(isUnsupportedMonitoringAction(error) ? 'upgrade' : 'read');
        return;
      }
      const parsed = parseFeedbackConversation(response, item.feedback_id);
      if (!parsed) { setFeedbackError('read'); return; }
      setFeedbackContext(parsed);
    } catch {
      if (requestId === feedbackRequestSequence.current) setFeedbackError('read');
    } finally {
      if (requestId === feedbackRequestSequence.current) setFeedbackLoading(false);
    }
  };
  const closeFeedbackDetails = () => clearFeedbackDetails(true);
  const exportFeedback = async (action: 'export_markdown' | 'export_text' | 'export_json') => {
    const feedbackId = feedbackDetail;
    if (!feedbackId || feedbackActionPending) return;
    const requestId = feedbackRequestSequence.current;
    setFeedbackActionPending(action);
    setFeedbackActionMessage(null);
    try {
      const { data: response, error, response: httpResponse } = await supabase.functions.invoke('admin-monitoring', {
        body: { action, feedback_id: feedbackId },
      });
      if (requestId !== feedbackRequestSequence.current) return;
      if (error) {
        if (isUnsupportedMonitoringAction(error)) setFeedbackError('upgrade');
        setFeedbackActionMessage('Export could not be prepared. No file was downloaded.');
        return;
      }
      const body = typeof response === 'string' ? response : null;
      if (requestId !== feedbackRequestSequence.current) return;
      if (body === null && !(response instanceof Blob)) { setFeedbackActionMessage('Export could not be prepared. No file was downloaded.'); return; }
      const extension = action === 'export_markdown' ? 'md' : action === 'export_text' ? 'txt' : 'json';
      const fallbackName = `sg-homie-feedback-${feedbackId}-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}.${extension}`;
      const disposition = httpResponse?.headers.get('content-disposition') ?? '';
      const filename = disposition.match(/filename="(sg-homie-feedback-[a-f0-9-]+-[0-9TZ]+\.(?:md|txt|json))"/i)?.[1] ?? fallbackName;
      const type = action === 'export_markdown' ? 'text/markdown;charset=utf-8' : action === 'export_text' ? 'text/plain;charset=utf-8' : 'application/json;charset=utf-8';
      const fileBlob = response instanceof Blob ? response.slice(0, response.size, type) : new Blob([body ?? ''], { type });
      const objectUrl = URL.createObjectURL(fileBlob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl; anchor.download = filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      setFeedbackActionMessage(`${extension.toUpperCase()} export downloaded. Access audit recorded.`);
    } catch {
      if (requestId === feedbackRequestSequence.current) setFeedbackActionMessage('Export could not be prepared. No file was downloaded.');
    } finally { if (requestId === feedbackRequestSequence.current) setFeedbackActionPending(null); }
  };
  const copyFeedbackForAnalysis = () => {
    const context = feedbackContext;
    if (!context) return;
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) { setFeedbackActionMessage('Clipboard access is unavailable. Use a server-generated export instead.'); return; }
    const text = serializeFeedbackCopyForAnalysis(context);
    const requestId = feedbackRequestSequence.current;
    // Invoke clipboard synchronously from the click before best-effort auditing.
    void clipboard.writeText(text).then(async () => {
      if (requestId === feedbackRequestSequence.current) setFeedbackActionMessage('Copied for Analysis. Recording the access audit…');
      try {
        const { error } = await supabase.functions.invoke('admin-monitoring', {
          body: { action: 'audit_feedback_copy', feedback_id: context.feedback.feedback_id },
        });
        if (requestId === feedbackRequestSequence.current) setFeedbackActionMessage(error
          ? 'Copied for Analysis, but the access audit could not be recorded.'
          : 'Copied for Analysis. Access audit recorded.');
      } catch { if (requestId === feedbackRequestSequence.current) setFeedbackActionMessage('Copied for Analysis, but the access audit could not be recorded.'); }
    }).catch(() => { if (requestId === feedbackRequestSequence.current) setFeedbackActionMessage('Clipboard access failed. No content was copied.'); });
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
  const selectedFeedback = current?.recent_feedback?.find((item) => item.feedback_id === feedbackDetail) ?? null;
  const rangeCaption: Record<MonitoringRange, string> = {
    '1h': 'Rolling Last 1 Hour', '24h': 'Rolling Last 24 Hours',
    '7d': 'Rolling Last 7 Days', '30d': 'Rolling Last 30 Days',
  };
  return <section aria-labelledby="monitoring-title" className="min-h-[calc(100vh-12rem)] space-y-4 bg-[#F6F8FB] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div><div className="flex flex-wrap items-center gap-2"><h2 id="monitoring-title" className="text-2xl font-bold tracking-tight text-gray-900">System Monitoring</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">Recorded Data</span></div>
        <p className="mt-1 text-sm text-gray-600">{rangeCaption[range]} · Recorded events only · Singapore Time (SGT)</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Monitoring time range" className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
          {ranges.map((option) => <button key={option} type="button" aria-pressed={range === option}
            onClick={() => changeRange(option)}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${range === option ? 'bg-white text-blue-700' : 'text-gray-700 hover:bg-gray-200'}`}>{option}</button>)}
        </div>
        <span className="flex items-center gap-1.5 text-xs text-gray-600">{current && <Clock3 className="h-4 w-4" aria-hidden="true" />}{current ? `Data as of ${formatSgtWithZone(current.generated_at)}` : 'No data loaded'}</span>
        <button className={button} onClick={() => void read(rangeRef.current)}><RefreshCw className="mr-1 inline h-4 w-4" aria-hidden="true" />Refresh Data</button>
        <span className="inline-flex items-center gap-1"><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
          onClick={() => void runHealth()} disabled={healthPending}>
          <Activity className="mr-1 inline h-4 w-4" aria-hidden="true" />{healthPending ? 'Running Health Check…' : 'Run Health Check'}
        </button><HelpTip title="Run Health Check" text="Runs a one-time Render/model readiness check. It may record an observation or update alerts. It is not a browser uptime monitor, hosted canary, or chatbot replay." /></span>
      </div>
    </header>
    {(healthPending || updating || notice) && <div role={notice ? 'alert' : 'status'} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <span>{notice ? `${notice}${current ? ` Showing previous data from ${formatSgtWithZone(current.generated_at)}.` : ''}` : healthPending ? 'Checking Render/model readiness. Existing monitoring data stays visible.' : `Updating to ${range}. Showing previous ${current?.range.range} data until it completes.`}</span>
      {notice && <button className={button} onClick={() => void read(rangeRef.current)}>Try Again</button>}
    </div>}
    {initialLoading && !current && <div role="status" aria-label="Loading monitoring dashboard" className="space-y-3">
      <div className="h-14 rounded-xl bg-gray-100" /><div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 rounded-xl bg-gray-100" />)}</div><div className="h-56 rounded-xl bg-gray-100" />
    </div>}
    {upgrade && !current && <div className={card}><h3 className="font-semibold text-gray-900">Monitoring backend upgrade required</h3><p className="mt-2 text-sm text-gray-600">Advanced monitoring data is unavailable on the deployed backend.</p></div>}
    {!initialLoading && !current && !upgrade && <div className={card}><h3 className="font-semibold text-gray-900">Monitoring data unavailable</h3><p className="mt-2 text-sm text-gray-600">Try refreshing the dashboard.</p></div>}
    {current && <div aria-busy={updating || healthPending} className={updating || healthPending ? 'opacity-80' : ''}>
      <nav aria-label="Monitoring sections" className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 pb-2">
        {tabs.map((item) => { const Icon = ({ overview: LayoutDashboard, services: Database, chatbot: MessageCircle, valuation: TrendingUp, security: ShieldCheck, feedback: MessageSquare })[item]; return <button key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => onViewChange(item)}
          className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${tab === item ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-gray-100'}`}><Icon className="h-4 w-4" aria-hidden="true" />{tabLabels[item]}</button>; })}
      </nav>
      {tab === 'overview' && <div className="space-y-4">
        <ServiceStrip data={current} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricTile icon={TrendingUp} label="Valuation Requests" value={formatCount(current.valuation.recorded_events)} note={`${current.valuation.successful_events} succeeded · recorded`} help={{ title: 'Recorded Valuation Requests', text: 'Completed valuation events recorded by monitoring. Best-effort telemetry may undercount activity.' }} />
          <MetricTile icon={MessageCircle} tone="teal" label="Chat Interactions" value={formatCount(current.chatbot.recorded_interactions)} note={`${current.chatbot.successful_interactions} succeeded · recorded`} help={{ title: 'Recorded Chat Interactions', text: 'Stored interaction outcomes for this range. They do not indicate live chatbot availability.' }} />
          {(['p50', 'p95', 'p99'] as const).map((p, i) => <PercentileTile key={p} percentile={p} stats={current.metrics.valuation_total_edge} tone={i === 0 ? 'blue' : i === 1 ? 'teal' : 'slate'} />)}
          <MetricTile icon={AlertTriangle} tone="amber" label="Unresolved Incidents" value={current.unresolved_alert_count === null ? 'Unavailable' : String(current.unresolved_alert_count)} note={`${current.active_unacknowledged_alert_count} active unacknowledged`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2"><VolumeChart data={current} /><LatencyChart data={current} /></div>
        <div className="grid gap-4 lg:grid-cols-2"><Panel title="Recorded Outcomes" icon={CheckCircle2} tone="green">
          <OutcomeBar label="Valuation" success={current.valuation.successful_events} total={current.valuation.recorded_events} />
          <OutcomeBar label="Chatbot" success={current.chatbot.successful_interactions} total={current.chatbot.recorded_interactions} tone="teal" />
          <h4 className="mt-5 border-t border-slate-100 pt-4 text-sm font-semibold text-gray-800">Failure Categories</h4>
          <Counts values={combinedCounts(current.valuation.failure_categories, current.chatbot.failure_categories)} empty="No failures recorded in this period." />
        </Panel><Incidents data={current} onAction={(alert) => void changeAlert(alert)} pending={alertPending} /></div>
        <div className={`${card} flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-700`}><strong className="flex items-center gap-2"><Database className="h-4 w-4" aria-hidden="true" />Data Retention</strong>
          <span>Target {current.retention.target_days} days</span>
          <span>Oldest Valuation Event: {formatSgtWithZone(current.retention.oldest_valuation_event_at)}</span>
          <span>Oldest Health Observation: {formatSgtWithZone(current.retention.oldest_service_health_check_at)}</span>
          <span>Oldest Resolved Alert: {formatSgtWithZone(current.retention.oldest_resolved_alert_at)}</span>
          <span>Cleanup scheduling not yet verified</span></div>
      </div>}
      {tab === 'services' && <div className="space-y-4">
        <ServiceStrip data={current} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <ServiceCard className="xl:col-span-2" icon={Monitor} name="Application" state="Unknown" evidence="None Collected" copy="No outside-in monitor exists, so browser availability is unknown." help={{ title: 'Application Monitoring', text: 'No external browser availability monitor is configured. Unknown does not mean healthy.' }} />
          <ServiceCard className="xl:col-span-2" icon={Database} name="Database" state="Data Read OK" tone="green" evidence="Telemetry Read" lastObserved={formatSgtWithZone(current.generated_at)} copy="The monitoring data read succeeded. This timestamp describes the latest summary read, not continuous database availability." help={{ title: 'Database Evidence', text: 'A successful telemetry read confirms this summary query completed. It does not measure ongoing database uptime.' }} />
          <ServiceCard className="xl:col-span-2" icon={Bot} name="Chatbot" state="Live Health Unknown" tone="teal" evidence="Stored Chat Records" copy="Stored interactions describe past outcomes. They do not test live provider health." help={{ title: 'Chatbot Monitoring', text: 'Historical interactions show recorded outcomes only; they do not probe live chatbot or provider availability.' }} />
          <Panel className="xl:col-span-4" title="Render Model" icon={Cpu} tone="green" help={{ title: 'Admin Check', text: 'This is a point-in-time Render/model readiness check, not continuous monitoring.' }}><div className="flex items-center justify-between gap-3"><StatePill value={current.health[0]?.status === 'healthy' ? 'Observed Ready' : current.health[0]?.status ?? 'Unknown'} /></div>
            <p className="mt-3 text-sm text-slate-600">Readiness reflects the last admin check and is not observed continuously.</p>
            <dl className="mt-4 grid gap-x-4 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3"><ValueChip label="Expected Model" value={current.health[0]?.expected_model_version} /><ValueChip label="Loaded Model" value={current.health[0]?.loaded_model_version} /><ValueChip label="Version Comparison" value={current.health[0]?.expected_model_version && current.health[0]?.loaded_model_version ? current.health[0].expected_model_version === current.health[0].loaded_model_version ? 'Match' : 'Mismatch' : 'Not Compared'} /><ValueChip label="Last Admin Check" value={current.health[0] ? formatSgtWithZone(current.health[0].checked_at) : null} /><ValueChip label="Source" value={current.health[0] ? current.health[0].source === 'admin_view' ? 'Admin Check' : monitoringDisplayLabel(current.health[0].source) : null} /></dl></Panel>
          <ServiceCard className="xl:col-span-2" icon={Radar} name="Hosted Canary" state="Not Yet Verified" evidence="Deferred" copy="An end-to-end hosted canary run has not been recorded." help={{ title: 'Hosted Canary', text: 'An end-to-end hosted canary run is deferred and is not part of Run Health Check.' }} />
        </div>
      </div>}
      {tab === 'chatbot' && <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3"><MetricTile icon={MessageCircle} label="Recorded Interactions" value={formatCount(current.chatbot.recorded_interactions)} note="Recorded events only" tone="teal" help={{ title: 'Recorded Events', text: 'Best-effort telemetry can undercount activity when a write fails.' }} /><MetricTile icon={CheckCircle2} label="Successful Interactions" value={formatCount(current.chatbot.successful_interactions)} note={current.chatbot.recorded_interactions ? `${(current.chatbot.successful_interactions / current.chatbot.recorded_interactions * 100).toFixed(1)}% of recorded interactions` : 'No recorded interactions'} tone="green" /><MetricTile icon={Bot} label="Provider Calls" value={formatCount(current.chatbot.provider_calls)} note="Recorded calls" tone="blue" help={{ title: 'Provider Calls', text: 'The number of provider calls recorded in this time range, not a live availability check.' }} /></div>
        <TimingMatrix label="Latency Percentiles" metrics={current.metrics} rows={[
          { key: 'chat_total_interaction', name: 'Interaction', description: 'Total chat interaction time' },
          { key: 'chat_provider', name: 'Provider', description: 'Model provider call time' },
          { key: 'chat_tool', name: 'Tool Duration', description: 'Time spent in tool calls' },
          { key: 'chat_first_output', name: 'First Application Output', description: 'Time until the first output appears' },
        ]} />
        <div className="grid gap-4 md:grid-cols-2"><Panel title="Provider Outcomes"><Counts values={current.chatbot.provider_statuses} empty="No provider calls recorded in this period." /><p className="mt-3 text-xs text-slate-500">Only statuses with at least one recorded call are listed.</p></Panel><Panel title="Failure Categories"><Counts values={current.chatbot.failure_categories} empty="No failures recorded in this period." /></Panel></div>
      </div>}
      {tab === 'valuation' && <div className={detail ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)]' : ''}>
        <div className="min-w-0 space-y-4">
        <div className="grid gap-3 md:grid-cols-2"><Panel title="Model Observation" icon={Cpu} tone="green"><div className="flex items-center justify-between gap-3"><StatePill value={current.health[0]?.status === 'healthy' ? 'Observed Ready' : current.health[0]?.status ?? 'Unknown'} /></div><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><MetricDatum label="Last Admin Check" value={current.health[0] ? formatSgtWithZone(current.health[0].checked_at) : null} /><MetricDatum label="Expected Model" value={current.health[0]?.expected_model_version} /><MetricDatum label="Loaded Model" value={current.health[0]?.loaded_model_version} /><MetricDatum label="Version Comparison" value={current.health[0]?.expected_model_version && current.health[0]?.loaded_model_version ? current.health[0].expected_model_version === current.health[0].loaded_model_version ? 'Match' : 'Mismatch' : 'Not Compared'} /><MetricDatum label="Source" value={current.health[0]?.source ? monitoringDisplayLabel(current.health[0].source) : null} /></dl></Panel>
          <Panel title="Recorded Valuation Activity" icon={TrendingUp}><div className="flex items-center gap-3"><div><p className="text-3xl font-semibold tabular-nums text-slate-900">{formatCount(current.valuation.recorded_events)}</p><p className="text-sm text-slate-600">requests recorded</p></div></div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{current.valuation.successful_events} succeeded</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">{current.valuation.prediction_sanity_failures} sanity warnings</span><span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-800">{current.valuation.failed_events} failed</span></div></Panel></div>
        <TimingMatrix label="Stage Timings" metrics={current.metrics} rows={[
          { key: 'valuation_total_edge', name: 'Edge Total', description: 'Whole valuation handler' },
          { key: 'valuation_authentication', name: 'Authentication', description: 'Session and role check' },
          { key: 'valuation_database_lookup', name: 'Database Lookup', description: 'Property record read' },
          { key: 'valuation_request_construction', name: 'Request Construction', description: 'Eligibility checks, feature preparation, and trusted request preparation' },
          { key: 'valuation_render_fetch', name: 'Render Fetch', description: 'Full outbound HTTP request' },
          { key: 'render_total', name: 'Render Total', description: 'No trusted queryable historical source' },
          { key: 'catboost_prediction', name: 'CatBoost Prediction', description: 'No trusted queryable historical source' },
          { key: 'conformal_interval', name: 'Conformal Interval', description: 'No trusted queryable historical source' },
        ]} />
        <p className="-mt-2 px-1 text-xs text-slate-500">Each timing uses its own valid samples. Operational latency does not measure valuation accuracy.</p>
        <div className="grid gap-4 lg:grid-cols-2"><VolumeChart data={current} /><LatencyChart data={current} /></div>
        <Panel title="Recent Valuation Requests" icon={Activity} note="Safe operational records only">
          <form onSubmit={(event) => { event.preventDefault(); void openDetail(requestId.trim()); }} className="mb-3 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="monitor-request-id">Look up request UUID</label><input id="monitor-request-id" value={requestId} onChange={(event) => setRequestId(event.target.value)} placeholder="Request UUID" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" />
            <button className={button}><Search className="mr-1 inline h-4 w-4" aria-hidden="true" />Open</button>
          </form>
          {detailError && <p role="alert" className="mb-2 text-sm text-rose-800">{detailError}</p>}
          {current.recent_valuation_requests === null ? <p className="text-sm text-gray-600">Recent request list unavailable.</p>
            : current.recent_valuation_requests.length === 0 ? <p className="text-sm text-gray-600">No valuation requests recorded in this range.</p>
              : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="p-2">Request ID</th><th className="p-2">Time (SGT)</th><th className="p-2">Outcome</th><th className="p-2 text-right">Edge Total</th><th className="p-2"><span className="sr-only">Open details</span></th></tr></thead><tbody>{current.recent_valuation_requests.map((item) => <tr key={item.request_id} className="border-t border-slate-100 transition-colors hover:bg-slate-50"><td className="p-2"><button aria-label={`Open request ${item.request_id}`} className="max-w-36 truncate text-left text-blue-700 underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" onClick={() => void openDetail(item.request_id)}>{item.request_id}</button></td><td className="p-2">{formatSgt(item.created_at)}</td><td className="p-2"><StatePill value={item.failure_category ?? item.status} /></td><td className="p-2 text-right tabular-nums">{formatDuration(item.total_edge_ms)}</td><td className="p-2 text-right"><button type="button" aria-label={`View operational details for ${item.request_id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" onClick={() => void openDetail(item.request_id)}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>}
        </Panel>
        </div>
        {detail && <OperationalRequestDetails detail={detail} onClose={closeDetail} panelRef={detailPanelRef} />}
      </div>}
      {tab === 'security' && <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Recorded Quota Outcomes" icon={Gauge} note={`${Object.values(current.chatbot.quota_outcomes).reduce((sum, n) => sum + n, 0)} recorded · ${range}`}><QuotaOutcomes values={current.chatbot.quota_outcomes} /></Panel>
        <Panel title="Coverage" help={{ title: 'Recorded Security Classifications', text: 'Only classifications persisted after monitoring began are counted. This is not a complete audit of blocked or unrecorded activity.' }}><div className="flex items-center gap-3"><IconTile icon={ShieldAlert} tone="slate" /><StatePill value="Recorded Events Only" /></div><p className="mt-3 text-sm leading-6 text-slate-600">Only stored and persisted classifications appear here. Events blocked before telemetry begins are not counted.</p><div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Authorization categories and quota outcomes describe recorded events. No security events are inferred.</div></Panel>
      </div>}
      {tab === 'feedback' && <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3"><MetricTile icon={MessageSquare} tone="teal" label="Recorded Feedback" value={formatCount(current.chatbot.feedback_count)} note="Ratings recorded in this range" /><MetricTile icon={ThumbsUp} tone="green" label="Positive" value={current.chatbot.feedback_ratings.positive ?? 0} note="Recorded positive ratings" /><MetricTile icon={ThumbsDown} tone="slate" label="Negative" value={current.chatbot.feedback_ratings.negative ?? 0} note="Recorded negative ratings" /></div>
        <div className={selectedFeedback ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]' : ''}>
          <div className="min-w-0 space-y-4"><Panel title="Rating Distribution" icon={Activity} tone="green"><RatingDistribution values={current.chatbot.feedback_ratings} /><p className="mt-3 text-xs text-slate-500">Recorded ratings only. No rate or trend comparison is shown without a matching denominator.</p></Panel>
            <Panel title="Recent Feedback" icon={MessageSquare} tone="teal" note="Ratings and unexpired comments"><FeedbackList items={current.recent_feedback} selected={feedbackDetail} onSelect={(item, target) => void openFeedbackDetails(item, target)} /></Panel></div>
          {selectedFeedback && <FeedbackDetails item={selectedFeedback} context={feedbackContext} loading={feedbackLoading} error={feedbackError}
            actionPending={feedbackActionPending} actionMessage={feedbackActionMessage} onClose={closeFeedbackDetails}
            onExport={(action) => void exportFeedback(action)} onCopy={copyFeedbackForAnalysis} panelRef={feedbackPanelRef} />}
        </div>
      </div>}
    </div>}
  </section>;
}
