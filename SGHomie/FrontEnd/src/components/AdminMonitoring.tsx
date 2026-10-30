import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  formatMonitoringDuration, formatMonitoringTime, parseMonitoringSnapshot,
  type MonitoringSnapshot,
} from '../lib/adminMonitoring';

function Status({ label, state }: { label: string; state: 'healthy' | 'warning' | 'critical' | 'unknown' }) {
  const colors = {
    healthy: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-900',
    critical: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-700',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[state]}`}>{label}</span>;
}

function Counts({ values }: { values: Record<string, number> | null }) {
  if (!values) return <p className="text-sm text-gray-600">Unavailable</p>;
  const entries = Object.entries(values);
  if (!entries.length) return <p className="text-sm text-gray-600">No records in this sample.</p>;
  return (
    <dl className="flex flex-wrap gap-2">
      {entries.map(([key, count]) => (
        <div key={key} className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
          <dt className="inline">{key.replace(/_/g, ' ')}: </dt>
          <dd className="inline font-semibold tabular-nums">{count}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AdminMonitoring() {
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const { data, error: requestError } = await supabase.functions.invoke('admin-monitoring');
        if (requestError) throw requestError;
        const parsed = parseMonitoringSnapshot(data);
        if (!parsed) throw new Error('Invalid monitoring response');
        if (active) setSnapshot(parsed);
      } catch {
        if (active) { setSnapshot(null); setError(true); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [refresh]);

  return (
    <section aria-labelledby="monitoring-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="monitoring-title" className="text-xl font-semibold text-gray-900">System Monitoring</h2>
          <p className="mt-1 text-sm text-gray-600">Current service checks and a limited sample of recent chat telemetry.</p>
        </div>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50">
          <RefreshCw aria-hidden="true" className="h-4 w-4" /> Refresh checks
        </button>
      </div>

      {loading && <p role="status" className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">Checking monitoring sources…</p>}
      {error && !loading && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-900">
        Monitoring could not be loaded. Check your connection or ask an operator to inspect the admin monitoring function, then retry.
      </div>}

      {snapshot && !loading && !error && <>
        <p className="text-sm text-gray-600">Checked {formatMonitoringTime(snapshot.checked_at)} SGT. Values describe this check or the stated sample window.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Service overview">
          <div className="rounded-xl border border-gray-200 p-4"><p className="text-sm font-medium text-gray-700">Application</p><div className="mt-2"><Status label="Unknown" state="unknown" /></div><p className="mt-2 text-xs text-gray-600">No outside-in browser check is collected.</p></div>
          <div className="rounded-xl border border-gray-200 p-4"><p className="text-sm font-medium text-gray-700">Database query</p><div className="mt-2"><Status label={snapshot.database.state === 'responsive' ? 'Responsive' : 'Unknown'} state={snapshot.database.state === 'responsive' ? 'healthy' : 'unknown'} /></div><p className="mt-2 text-xs text-gray-600">Based on the chat telemetry read only.</p></div>
          <div className="rounded-xl border border-gray-200 p-4"><p className="text-sm font-medium text-gray-700">Render model</p><div className="mt-2"><Status label={snapshot.valuation.version_match === 'mismatch' ? 'Version mismatch' : { ready: 'Ready', not_ready: 'Not ready', unavailable: 'Unavailable', not_configured: 'Not configured' }[snapshot.valuation.render_state]} state={snapshot.valuation.version_match === 'mismatch' || snapshot.valuation.render_state === 'not_ready' ? 'critical' : snapshot.valuation.render_state === 'ready' ? 'healthy' : 'unknown'} /></div><p className="mt-2 text-xs text-gray-600">Render /health checks model readiness only.</p></div>
          <div className="rounded-xl border border-gray-200 p-4"><p className="text-sm font-medium text-gray-700">Chatbot</p><div className="mt-2"><Status label="Live health unknown" state="unknown" /></div><p className="mt-2 text-xs text-gray-600">Stored chat records do not test provider availability.</p></div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="valuation-monitor-title" className="rounded-xl border border-gray-200 p-5">
            <h3 id="valuation-monitor-title" className="text-lg font-semibold text-gray-900">Valuation</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-gray-600">Expected model version</dt><dd className="break-all font-medium text-gray-900">{snapshot.valuation.expected_model_version ?? 'Not configured for monitoring'}</dd></div>
              <div><dt className="text-gray-600">Loaded model version</dt><dd className="break-all font-medium text-gray-900">{snapshot.valuation.loaded_model_version ?? 'Unavailable'}</dd></div>
              <div><dt className="text-gray-600">Version comparison</dt><dd><Status label={{ match: 'Match', mismatch: 'Mismatch', unknown: 'Unknown' }[snapshot.valuation.version_match]} state={snapshot.valuation.version_match === 'match' ? 'healthy' : snapshot.valuation.version_match === 'mismatch' ? 'critical' : 'unknown'} /></dd></div>
              <div><dt className="text-gray-600">End-to-end canary</dt><dd className="font-medium text-gray-900">Not recorded. No run time is available.</dd></div>
              <div><dt className="text-gray-600">Recent failures, request latency and prediction sanity</dt><dd className="text-gray-700">Unavailable in this dashboard. Phase 6 records these in correlated Edge and Render logs; no queryable history is configured.</dd></div>
            </dl>
          </section>

          <section aria-labelledby="chat-monitor-title" className="rounded-xl border border-gray-200 p-5">
            <h3 id="chat-monitor-title" className="text-lg font-semibold text-gray-900">Chat telemetry</h3>
            <p className="mt-1 text-sm text-gray-600">Most recent {snapshot.sample_limit} records at most, since {formatMonitoringTime(snapshot.window_start)} SGT. Counts describe this sample, not all traffic.</p>
            <div className="mt-4 space-y-4">
              <div><p className="mb-2 text-sm font-medium text-gray-800">Interaction outcomes ({snapshot.chatbot.sampled_interactions ?? 'unavailable'} sampled)</p><Counts values={snapshot.chatbot.interaction_statuses} /></div>
              <div><p className="mb-2 text-sm font-medium text-gray-800">Provider calls ({snapshot.chatbot.provider_calls?.sampled ?? 'unavailable'} sampled)</p><Counts values={snapshot.chatbot.provider_calls?.statuses ?? null} /></div>
              <div><p className="mb-2 text-sm font-medium text-gray-800">Provider failure codes in sample</p><Counts values={snapshot.chatbot.provider_calls?.error_codes ?? null} /></div>
              <div><p className="mb-2 text-sm font-medium text-gray-800">Feedback ({snapshot.chatbot.feedback?.sampled ?? 'unavailable'} sampled)</p><Counts values={snapshot.chatbot.feedback?.ratings ?? null} /></div>
              <p className="text-sm text-gray-700">Median total interaction time in sample: <span className="font-medium">{formatMonitoringDuration(snapshot.chatbot.sample_median_latency_ms)}</span></p>
            </div>
          </section>
        </div>

        <section aria-labelledby="recent-chat-title" className="rounded-xl border border-gray-200 p-5">
          <h3 id="recent-chat-title" className="text-lg font-semibold text-gray-900">Recent chat request IDs</h3>
          <p className="mt-1 text-sm text-gray-600">Use an ID to find the related server log. This view excludes messages, account identifiers and property details.</p>
          {snapshot.chatbot.recent_interactions.length === 0 ? <p className="mt-4 text-sm text-gray-600">No recent records are available.</p> :
            <ul className="mt-4 divide-y divide-gray-200">
              {snapshot.chatbot.recent_interactions.map((item, index) => <li key={`${item.request_id ?? 'missing'}-${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="min-w-0 break-all font-mono text-xs text-gray-900">{item.request_id ?? 'ID unavailable'}</span>
                <span className="text-gray-700">{item.status.replace(/_/g, ' ')}{item.error_code ? ` · ${item.error_code}` : ''} · {formatMonitoringTime(item.created_at)} SGT</span>
              </li>)}
            </ul>}
        </section>
      </>}
    </section>
  );
}
