import { createClient } from 'npm:@supabase/supabase-js@2.114.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SAMPLE_LIMIT = 100;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const PROBE_TIMEOUT_MS = 8_000;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
}

function safeCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(value) ? value : null;
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
        || url.username || url.password
        || !url.pathname.endsWith('/v1/valuation/predict')) return null;
    return new URL('/', url);
  } catch {
    return null;
  }
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

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await service.from('user_profiles')
      .select('is_admin').eq('id', authData.user.id).maybeSingle();
    if (profileError) return json({ error: 'Monitoring unavailable' }, 503);
    if (profile?.is_admin !== true) return json({ error: 'Admin privileges required' }, 403);

    const checkedAt = new Date().toISOString();
    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();
    const sample = async (table: string, columns: string, timeColumn: string) => {
      try {
        const { data, error } = await service.from(table).select(columns)
          .gte(timeColumn, windowStart).order(timeColumn, { ascending: false }).limit(SAMPLE_LIMIT);
        return error || !Array.isArray(data) ? null : data as Record<string, unknown>[];
      } catch {
        return null;
      }
    };
    const [interactions, providerCalls, feedback] = await Promise.all([
      sample('chat_interactions', 'request_id,created_at,status,error_code,quota_result,total_latency_ms', 'created_at'),
      sample('chat_provider_calls', 'status,error_code,latency_ms,started_at', 'started_at'),
      sample('chat_feedback', 'rating,updated_at', 'updated_at'),
    ]);

    const renderBase = renderBaseUrl(Deno.env.get('VALUATION_API_URL'));
    const renderToken = Deno.env.get('VALUATION_SERVICE_TOKEN');
    const configuredVersion = Deno.env.get('VALUATION_EXPECTED_MODEL_VERSION');
    const expectedVersion = configuredVersion && /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(configuredVersion) ? configuredVersion : null;
    let renderState = renderBase ? 'unavailable' : 'not_configured';
    let loadedVersion: string | null = null;
    if (renderBase) {
      try {
        const health = await fetch(new URL('/health', renderBase), { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), redirect: 'error' });
        if (health.status === 503) renderState = 'not_ready';
        else if (health.ok) {
          const body = await health.json();
          if (body?.status === 'ok' && body?.model_loaded === true) renderState = 'ready';
        }
      } catch {
        renderState = 'unavailable';
      }
      if (renderState === 'ready' && renderToken) {
        try {
          const info = await fetch(new URL('/v1/valuation/model-info', renderBase), {
            headers: { Authorization: `Bearer ${renderToken}` },
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
            redirect: 'error',
          });
          if (info.ok) {
            const body = await info.json();
            if (typeof body?.model_version === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(body.model_version)) {
              loadedVersion = body.model_version;
            }
          }
        } catch {
          // Model identity remains unknown if the protected probe fails.
        }
      }
    }

    const safeInteractions = interactions?.map((row) => ({
      request_id: typeof row.request_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.request_id) ? row.request_id : null,
      created_at: typeof row.created_at === 'string' ? row.created_at : null,
      status: safeCode(row.status) ?? 'OTHER',
      error_code: safeCode(row.error_code),
      total_latency_ms: nonnegative(row.total_latency_ms),
    })) ?? [];
    return json({
      checked_at: checkedAt,
      window_start: windowStart,
      sample_limit: SAMPLE_LIMIT,
      database: { state: interactions === null ? 'unknown' : 'responsive' },
      valuation: {
        render_state: renderState,
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
          sampled: providerCalls.length,
          statuses: countBy(providerCalls, 'status'),
          error_codes: countBy(providerCalls.filter((row) => safeCode(row.error_code) !== null), 'error_code'),
        },
        feedback: feedback === null ? null : { sampled: feedback.length, ratings: countBy(feedback, 'rating') },
      },
    });
  } catch {
    return json({ error: 'Monitoring unavailable' }, 503);
  }
});
