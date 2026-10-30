import { createClient } from 'npm:@supabase/supabase-js@2.114.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SAMPLE_LIMIT = 100;
const PROBE_TIMEOUT_MS = 8_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODEL_VERSION = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const SAFE_ERROR_CODES = new Set([
  'success', 'started', 'quota_denied', 'sensitive_input_blocked', 'provider_error', 'tool_error',
  'internal_error', 'aborted', 'capacity_denied', 'positive', 'negative',
  'client_cancelled', 'incomplete_timeout', 'CHAT_QUOTA_UNAVAILABLE',
  'CHAT_USER_BURST_LIMIT', 'CHAT_USER_DAILY_LIMIT', 'CHAT_COOLDOWN_ACTIVE', 'CHAT_GLOBAL_CAPACITY',
]);

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
}
function safeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (SAFE_ERROR_CODES.has(value) || /^provider_http_[1-5][0-9]{2}$/.test(value)) return value;
  return null;
}
function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function countBy(rows: Record<string, unknown>[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const label = safeCode(row[field]) ?? 'OTHER';
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
}
function renderBaseUrl(raw: string | undefined): URL | null {
  try {
    if (!raw) return null;
    const url = new URL(raw);
    if (!(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
        || url.username || url.password || !url.pathname.endsWith('/v1/valuation/predict')) return null;
    return new URL('/', url);
  } catch {
    return null;
  }
}
function validHealthBody(body: unknown): body is { status: 'ok'; model_loaded: true } {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    && (body as Record<string, unknown>).status === 'ok'
    && (body as Record<string, unknown>).model_loaded === true;
}
function explicitlyNotReady(status: number, body: unknown): boolean {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return (status >= 200 && status < 300 && value.status === 'not_ready' && value.model_loaded === false)
    || (status === 503 && value.detail === 'Valuation model is unavailable.');
}
function boundedSafeAlert(value: Record<string, unknown>): Record<string, unknown> {
  return {
    id: Number.isSafeInteger(value.id) ? value.id : null,
    severity: value.severity,
    source: value.source,
    category: value.category,
    state: value.state,
    first_detected_at: value.first_detected_at,
    last_detected_at: value.last_detected_at,
    occurrence_count: value.occurrence_count,
    latest_request_id: typeof value.latest_request_id === 'string' && UUID.test(value.latest_request_id) ? value.latest_request_id : null,
    acknowledged_at: value.acknowledged_at,
    resolved_at: value.resolved_at,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return json({ error: 'Authentication required' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Monitoring unavailable' }, 503);

  try {
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);

    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await service.from('user_profiles')
      .select('is_admin').eq('id', authData.user.id).maybeSingle();
    if (profileError) return json({ error: 'Monitoring unavailable' }, 503);
    if (profile?.is_admin !== true) return json({ error: 'Admin privileges required' }, 403);

    const rawBody = await request.text();
    let input: Record<string, unknown> = {};
    if (rawBody.trim()) {
      try {
        const parsed: unknown = JSON.parse(rawBody);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return json({ error: 'Invalid monitoring request' }, 400);
        input = parsed as Record<string, unknown>;
      } catch {
        return json({ error: 'Invalid monitoring request' }, 400);
      }
    }
    const action = input.action === undefined ? 'summary' : input.action;
    if (!['summary', 'detail', 'acknowledge', 'resolve'].includes(String(action))) return json({ error: 'Invalid monitoring action' }, 400);

    if (action === 'detail') {
      if (typeof input.request_id !== 'string' || !UUID.test(input.request_id)
          || Object.keys(input).some((key) => !['action', 'request_id'].includes(key))) {
        return json({ error: 'Invalid request ID' }, 400);
      }
      const { data, error } = await service.from('valuation_events')
        .select('request_id,created_at,completed_at,status,failure_category,model_version,prediction_sanity,total_edge_ms,authentication_ms,database_lookup_ms,request_construction_ms,render_fetch_ms')
        .eq('request_id', input.request_id).maybeSingle();
      if (error) return json({ error: 'Monitoring detail unavailable' }, 503);
      if (!data) return json({ error: 'Monitoring request not found' }, 404);
      return json({ dashboard_v2: { version: 2, request_detail: {
        request_id: data.request_id, created_at: data.created_at, completed_at: data.completed_at,
        status: data.status, failure_category: data.failure_category, model_version: data.model_version,
        prediction_sanity: data.prediction_sanity, total_edge_ms: nonnegative(data.total_edge_ms),
        authentication_ms: nonnegative(data.authentication_ms), database_lookup_ms: nonnegative(data.database_lookup_ms),
        request_construction_ms: nonnegative(data.request_construction_ms), render_fetch_ms: nonnegative(data.render_fetch_ms),
      } } });
    }

    if (action === 'acknowledge' || action === 'resolve') {
      if (!Number.isSafeInteger(input.alert_id) || (input.alert_id as number) <= 0
          || Object.keys(input).some((key) => !['action', 'alert_id'].includes(key))) return json({ error: 'Invalid alert action' }, 400);
      const { data, error } = await service.rpc('transition_monitoring_alert', {
        p_alert_id: input.alert_id, p_action: action, p_admin_id: authData.user.id,
      });
      if (error) return json({ error: 'Alert transition unavailable' }, error.code === 'P0002' ? 404 : 503);
      return json({ dashboard_v2: { version: 2, alert: boundedSafeAlert(data as Record<string, unknown>) } });
    }

    const selectedRange = input.range === undefined ? '24h' : input.range;
    if (!['1h', '24h', '7d', '30d'].includes(String(selectedRange))
        || Object.keys(input).some((key) => !['action', 'range'].includes(key))) return json({ error: 'Invalid monitoring range' }, 400);

    const checkedAt = new Date().toISOString();
    const sample = async (table: string, columns: string, timeColumn: string, start: string) => {
      try {
        const { data, error } = await service.from(table).select(columns)
          .gte(timeColumn, start).order(timeColumn, { ascending: false }).limit(SAMPLE_LIMIT);
        return error || !Array.isArray(data) ? null : data as Record<string, unknown>[];
      } catch { return null; }
    };
    const now = Date.now();
    const legacyStart = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const [interactions, providerCalls, feedback] = await Promise.all([
      sample('chat_interactions', 'request_id,created_at,status,error_code,quota_result,total_latency_ms', 'created_at', legacyStart),
      sample('chat_provider_calls', 'status,error_code,latency_ms,started_at', 'started_at', legacyStart),
      sample('chat_feedback', 'rating,updated_at', 'updated_at', legacyStart),
    ]);

    const renderBase = renderBaseUrl(Deno.env.get('VALUATION_API_URL'));
    const renderToken = Deno.env.get('VALUATION_SERVICE_TOKEN');
    const configuredVersion = Deno.env.get('VALUATION_EXPECTED_MODEL_VERSION');
    const expectedVersion = configuredVersion && MODEL_VERSION.test(configuredVersion) ? configuredVersion : null;
    let renderState: 'ready' | 'not_ready' | 'unknown' | 'not_configured' = renderBase ? 'unknown' : 'not_configured';
    let loadedVersion: string | null = null;
    let probeDuration: number | null = null;
    let probeFailure: 'MODEL_NOT_READY' | null = null;
    const fetchStarted = performance.now();
    if (renderBase) {
      let healthBody: unknown = null;
      try {
        const health = await fetch(new URL('/health', renderBase), { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), redirect: 'error' });
        try { healthBody = await health.json(); } catch { healthBody = null; }
        probeDuration = nonnegative(performance.now() - fetchStarted);
        if (validHealthBody(healthBody) && health.ok) renderState = 'ready';
        else if (explicitlyNotReady(health.status, healthBody)) {
          renderState = 'not_ready';
          probeFailure = 'MODEL_NOT_READY';
        }
      } catch {
        probeDuration = nonnegative(performance.now() - fetchStarted);
        renderState = 'unknown';
      }
      if (renderState === 'ready' && renderToken) {
        try {
          const info = await fetch(new URL('/v1/valuation/model-info', renderBase), {
            headers: { Authorization: `Bearer ${renderToken}` }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), redirect: 'error',
          });
          if (info.ok) {
            const body: unknown = await info.json();
            if (typeof body === 'object' && body !== null && !Array.isArray(body)
                && typeof (body as Record<string, unknown>).model_version === 'string'
                && MODEL_VERSION.test((body as Record<string, unknown>).model_version as string)) {
              loadedVersion = (body as Record<string, unknown>).model_version as string;
            }
          }
        } catch { /* Health readiness remains a valid observation; model identity is unknown. */ }
      }
    }
    const versionMismatch = expectedVersion !== null && loadedVersion !== null && expectedVersion !== loadedVersion;
    const healthStatus = renderState === 'ready' && !versionMismatch ? 'healthy'
      : renderState === 'not_ready' || versionMismatch ? 'critical' : 'unknown';
    const healthFailure = probeFailure ?? (versionMismatch ? 'MODEL_VERSION_MISMATCH' : null);
    try {
      const healthWrite = await service.from('service_health_checks').insert({
        service: 'render_model', status: healthStatus, source: 'admin_view', duration_ms: probeDuration,
        expected_model_version: expectedVersion, loaded_model_version: loadedVersion, failure_category: healthFailure,
      });
      if (healthWrite.error) console.error(JSON.stringify({ event: 'telemetry_persist_failed', telemetry_sink: 'service_health_checks', failure_class: 'write_failed' }));
    } catch {
      console.error(JSON.stringify({ event: 'telemetry_persist_failed', telemetry_sink: 'service_health_checks', failure_class: 'write_failed' }));
    }
    const recordConfirmedAlert = async (category: string) => {
      try {
        const { error } = await service.rpc('record_monitoring_alert', {
          p_severity: 'critical', p_source: 'render_model', p_category: category, p_request_id: null,
        });
        if (error) throw new Error('monitoring alert write failed');
      } catch {
        console.error(JSON.stringify({ event: 'telemetry_persist_failed', telemetry_sink: 'system_alerts', failure_class: 'write_failed' }));
      }
    };
    if (probeFailure) await recordConfirmedAlert('model_not_ready');
    if (versionMismatch) await recordConfirmedAlert('model_version_mismatch');

    const summaryResponse = await service.rpc('monitoring_dashboard_summary', { p_range: selectedRange });
    const summary = summaryResponse.error ? null : summaryResponse.data;
    const safeInteractions = interactions?.map((row) => ({
      request_id: typeof row.request_id === 'string' && UUID.test(row.request_id) ? row.request_id : null,
      created_at: typeof row.created_at === 'string' ? row.created_at : null,
      status: safeCode(row.status) ?? 'OTHER', error_code: safeCode(row.error_code),
      total_latency_ms: nonnegative(row.total_latency_ms),
    })) ?? [];
    const legacy = {
      checked_at: checkedAt,
      window_start: legacyStart,
      sample_limit: SAMPLE_LIMIT,
      database: { state: interactions === null ? 'unknown' : 'responsive' },
      valuation: {
        render_state: renderState === 'unknown' ? 'unavailable' : renderState,
        expected_model_version: expectedVersion,
        loaded_model_version: loadedVersion,
        version_match: expectedVersion && loadedVersion ? (expectedVersion === loadedVersion ? 'match' : 'mismatch') : 'unknown',
        history_state: 'unavailable',
        canary: { state: 'not_recorded', last_run_at: null },
      },
      chatbot: {
        telemetry_state: interactions === null ? 'unavailable' : 'available',
        sampled_interactions: interactions?.length ?? null,
        interaction_statuses: interactions ? countBy(interactions, 'status') : null,
        recent_interactions: safeInteractions.slice(0, 10),
        sample_median_latency_ms: interactions ? median(interactions.map((row) => nonnegative(row.total_latency_ms)).filter((value): value is number => value !== null)) : null,
        provider_calls: providerCalls === null ? null : {
          sampled: providerCalls.length, statuses: countBy(providerCalls, 'status'),
          error_codes: countBy(providerCalls.filter((row) => typeof row.error_code === 'string'), 'error_code'),
        },
        feedback: feedback === null ? null : { sampled: feedback.length, ratings: countBy(feedback, 'rating') },
      },
    };
    return json({ ...legacy, dashboard_v2: summary ?? { version: 2, state: 'unavailable', reason: 'monitoring_data_unavailable' } });
  } catch {
    return json({ error: 'Monitoring unavailable' }, 503);
  }
});
