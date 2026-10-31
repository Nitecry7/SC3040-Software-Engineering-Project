export type MonitoringSnapshot = {
  checked_at: string;
  window_start: string;
  sample_limit: number;
  database: { state: 'responsive' | 'unknown' };
  valuation: {
    render_state: 'ready' | 'not_ready' | 'unavailable' | 'not_configured';
    expected_model_version: string | null;
    loaded_model_version: string | null;
    version_match: 'match' | 'mismatch' | 'unknown';
    history_state: 'unavailable';
    canary: { state: 'not_recorded'; last_run_at: null };
  };
  chatbot: {
    telemetry_state: 'available' | 'unavailable';
    sampled_interactions: number | null;
    interaction_statuses: Record<string, number> | null;
    recent_interactions: Array<{
      request_id: string | null;
      created_at: string | null;
      status: string;
      error_code: string | null;
      total_latency_ms: number | null;
    }>;
    sample_median_latency_ms: number | null;
    provider_calls: { sampled: number; statuses: Record<string, number>; error_codes: Record<string, number> } | null;
    feedback: { sampled: number; ratings: Record<string, number> } | null;
  };
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validCounts(value: unknown): value is Record<string, number> {
  return object(value) && Object.values(value).every((count) => Number.isInteger(count) && (count as number) >= 0);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function nullableDuration(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

export function parseMonitoringSnapshot(value: unknown): MonitoringSnapshot | null {
  if (!object(value) || !object(value.database) || !object(value.valuation) || !object(value.chatbot)) return null;
  const { database, valuation, chatbot } = value;
  if (typeof value.checked_at !== 'string' || !Number.isFinite(Date.parse(value.checked_at))
      || typeof value.window_start !== 'string' || !Number.isFinite(Date.parse(value.window_start))
      || !Number.isInteger(value.sample_limit) || (value.sample_limit as number) <= 0) return null;
  if (!['responsive', 'unknown'].includes(String(database.state))
      || !['ready', 'not_ready', 'unavailable', 'not_configured'].includes(String(valuation.render_state))
      || !nullableString(valuation.expected_model_version) || !nullableString(valuation.loaded_model_version)
      || !['match', 'mismatch', 'unknown'].includes(String(valuation.version_match))
      || valuation.history_state !== 'unavailable' || !object(valuation.canary)
      || valuation.canary.state !== 'not_recorded' || valuation.canary.last_run_at !== null) return null;
  if (!['available', 'unavailable'].includes(String(chatbot.telemetry_state))
      || !(chatbot.sampled_interactions === null || (Number.isInteger(chatbot.sampled_interactions) && (chatbot.sampled_interactions as number) >= 0))
      || !(chatbot.interaction_statuses === null || validCounts(chatbot.interaction_statuses))
      || !nullableDuration(chatbot.sample_median_latency_ms)
      || !Array.isArray(chatbot.recent_interactions)) return null;
  if (!chatbot.recent_interactions.every((row: unknown) => object(row)
      && nullableString(row.request_id) && nullableString(row.created_at)
      && typeof row.status === 'string' && nullableString(row.error_code)
      && nullableDuration(row.total_latency_ms))) return null;
  for (const field of ['provider_calls', 'feedback'] as const) {
    const sample = chatbot[field];
    if (sample !== null && (!object(sample) || !Number.isInteger(sample.sampled)
        || (sample.sampled as number) < 0 || !validCounts(sample[field === 'provider_calls' ? 'statuses' : 'ratings']))) return null;
  }
  if (chatbot.provider_calls !== null && !validCounts((chatbot.provider_calls as Record<string, unknown>).error_codes)) return null;
  return value as MonitoringSnapshot;
}

export function formatMonitoringTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable';
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}

export function formatMonitoringDuration(value: number | null): string {
  return value === null || !Number.isFinite(value) || value < 0 ? 'Unavailable' : `${Math.round(value)} ms`;
}
