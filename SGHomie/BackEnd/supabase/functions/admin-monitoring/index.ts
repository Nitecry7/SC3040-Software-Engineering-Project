import { createClient } from 'npm:@supabase/supabase-js@2.114.0';
import {
  boundFeedbackConversation, serializeFeedbackJson, serializeFeedbackMarkdown, serializeFeedbackText,
  type FeedbackConversation, type FeedbackRating, type FeedbackTechnicalContext,
} from '../_shared/feedbackConversation.ts';

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
const SAFE_VALUATION_FAILURES = new Set([
  'AUTH_FAILURE', 'PROPERTY_NOT_FOUND', 'PROPERTY_LOOKUP_FAILURE',
  'FEATURE_PREPARATION_FAILURE', 'TIMEOUT', 'RENDER_UNAVAILABLE',
  'INVALID_PREDICTION_SCHEMA', 'INVALID_INTERVAL', 'MODEL_VERSION_MISMATCH',
  'EDGE_UNAVAILABLE', 'INVALID_REQUEST',
]);

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
}
function attachment(body: string, filename: string, contentType: string): Response {
  return new Response(body, { status: 200, headers: {
    ...corsHeaders,
    'Access-Control-Expose-Headers': 'Content-Disposition',
    'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  } });
}
function optionalSafeText(value: unknown, max = 160): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}
function safeModelLabel(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._:/-]{0,119}$/i.test(value) ? value : null;
}
function safeProvider(value: unknown): string | null {
  return value === 'openai' || value === 'openrouter' ? value : null;
}
function safeInteractionOutcome(value: unknown): string | null {
  return ['success', 'quota_denied', 'provider_error', 'tool_error', 'internal_error', 'aborted'].includes(String(value))
    ? String(value) : null;
}
function safeProviderOutcome(value: unknown): string | null {
  return ['success', 'provider_error', 'capacity_denied'].includes(String(value)) ? String(value) : null;
}
function safePromptVersion(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(value) ? value : null;
}
function exportFilename(feedbackId: string, recordedAt: string, extension: string): string {
  const timestamp = new Date(recordedAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `sg-homie-feedback-${feedbackId}-${timestamp}.${extension}`;
}
async function writeFeedbackAudit(service: any, adminId: string, feedbackId: string, action: string): Promise<boolean> {
  try {
    const { error } = await service.from('feedback_access_audit').insert({
      admin_id: adminId, feedback_id: feedbackId, action, created_at: new Date().toISOString(),
    });
    return !error;
  } catch { return false; }
}
async function loadFeedbackConversation(service: any, feedbackId: string): Promise<
  { state: 'found'; data: FeedbackConversation } | { state: 'missing' } | { state: 'error' }
> {
  try {
    const feedbackResult = await service.from('chat_feedback')
      .select('interaction_id,rating,updated_at,comment_redacted,comment_expires_at')
      .eq('interaction_id', feedbackId).maybeSingle();
    if (feedbackResult.error) return { state: 'error' };
    const feedback = feedbackResult.data as Record<string, unknown> | null;
    if (!feedback || feedback.interaction_id !== feedbackId
      || !['positive', 'negative'].includes(String(feedback.rating))
      || typeof feedback.updated_at !== 'string' || !Number.isFinite(Date.parse(feedback.updated_at))) return { state: 'missing' };

    const interactionResult = await service.from('chat_interactions')
      .select('interaction_id,conversation_id,created_at,content_expires_at,status,user_message_redacted,assistant_message_redacted,provider,requested_model,resolved_model,prompt_version,tool_name,tool_called,tool_success,tool_result_count,total_latency_ms')
      .eq('interaction_id', feedback.interaction_id).maybeSingle();
    if (interactionResult.error) return { state: 'error' };
    const interaction = interactionResult.data as Record<string, unknown> | null;
    if (interaction && interaction.interaction_id !== feedbackId) return { state: 'missing' };
    const commentExpiresAt = typeof feedback.comment_expires_at === 'string'
      && Number.isFinite(Date.parse(feedback.comment_expires_at)) ? feedback.comment_expires_at : null;
    const comment = commentExpiresAt && Date.parse(commentExpiresAt) > Date.now()
      && typeof feedback.comment_redacted === 'string' && feedback.comment_redacted.trim().length > 0
      ? feedback.comment_redacted.slice(0, 1000) : null;
    const metadata = {
      feedback_id: feedbackId,
      rating: feedback.rating as FeedbackRating,
      recorded_at: feedback.updated_at,
      comment,
      comment_expires_at: comment ? commentExpiresAt : null,
    };

    if (!interaction) return { state: 'found', data: {
      feedback: metadata, conversation_state: 'unavailable', conversation: [], technical_context: null,
      content_expires_at: null, truncated: false, omitted_context_count: 0,
    } };

    const contentExpiresAt = typeof interaction.content_expires_at === 'string'
      && Number.isFinite(Date.parse(interaction.content_expires_at)) ? interaction.content_expires_at : null;
    const providerCallsPromise = service.from('chat_provider_calls')
      .select('sequence,provider,requested_model,resolved_model,status,latency_ms')
      .eq('interaction_id', feedbackId).order('sequence', { ascending: true }).limit(10);
    const interactionAvailable = interaction.status === 'success'
      && typeof interaction.created_at === 'string' && Number.isFinite(Date.parse(interaction.created_at))
      && typeof interaction.conversation_id === 'string' && contentExpiresAt !== null
      && Date.parse(contentExpiresAt) > Date.now()
      && typeof interaction.user_message_redacted === 'string'
      && typeof interaction.assistant_message_redacted === 'string';
    const technicalPromise = providerCallsPromise.then((result: { data: unknown; error: unknown }) => {
      if (result.error || !Array.isArray(result.data)) return null;
      return result.data.flatMap((call: unknown) => {
        if (typeof call !== 'object' || call === null || Array.isArray(call)) return [];
        const row = call as Record<string, unknown>;
        const outcome = safeProviderOutcome(row.status);
        const provider = safeProvider(row.provider);
        if (!outcome || !provider) return [];
        return [{ provider, requested_model: safeModelLabel(row.requested_model),
          resolved_model: safeModelLabel(row.resolved_model), outcome, latency_ms: nonnegative(row.latency_ms) }];
      });
    }).catch(() => null);
    let priorCount = 0;
    let precedingNearestFirst: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (interactionAvailable) {
      const [countResult, priorResult] = await Promise.all([
        service.rpc('monitoring_feedback_prior_message_count', { p_feedback_id: feedbackId }),
        service.from('chat_interactions')
          .select('interaction_id,created_at,user_message_redacted,assistant_message_redacted')
          .eq('conversation_id', interaction.conversation_id)
          .lt('created_at', interaction.created_at)
          .gt('content_expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }).order('interaction_id', { ascending: false }).limit(6),
      ]);
      if (countResult.error || !Number.isSafeInteger(countResult.data) || countResult.data < 0
        || priorResult.error || !Array.isArray(priorResult.data)) return { state: 'error' };
      priorCount = countResult.data;
      const chronological = [...priorResult.data].reverse().flatMap((row: Record<string, unknown>) => [
        ...(typeof row.user_message_redacted === 'string' ? [{ role: 'user' as const, content: row.user_message_redacted }] : []),
        ...(typeof row.assistant_message_redacted === 'string' ? [{ role: 'assistant' as const, content: row.assistant_message_redacted }] : []),
      ]).slice(-6);
      precedingNearestFirst = chronological.reverse();
    }
    const technicalCalls = await technicalPromise;
    const technical: FeedbackTechnicalContext = {
      provider: safeProvider(interaction.provider),
      requested_model: safeModelLabel(interaction.requested_model),
      resolved_model: safeModelLabel(interaction.resolved_model),
      prompt_version: safePromptVersion(interaction.prompt_version),
      outcome: safeInteractionOutcome(interaction.status),
      tool_summary: typeof interaction.tool_name === 'string' && /^[a-z0-9_]{1,64}$/i.test(interaction.tool_name)
        && typeof interaction.tool_called === 'boolean'
        ? { name: interaction.tool_name, called: interaction.tool_called,
          succeeded: typeof interaction.tool_success === 'boolean' ? interaction.tool_success : null,
          result_count: countValue(interaction.tool_result_count) ? interaction.tool_result_count : null } : null,
      provider_calls: technicalCalls,
      total_latency_ms: nonnegative(interaction.total_latency_ms),
    };
    if (!interactionAvailable) return { state: 'found', data: {
      feedback: metadata, conversation_state: 'unavailable', conversation: [], technical_context: technical,
      content_expires_at: contentExpiresAt, truncated: false, omitted_context_count: 0,
    } };

    const bounded = boundFeedbackConversation({
      user: interaction.user_message_redacted as string,
      assistant: interaction.assistant_message_redacted as string,
    }, precedingNearestFirst, priorCount);
    return { state: 'found', data: {
      feedback: metadata, conversation_state: 'available', ...bounded,
      technical_context: technical, content_expires_at: contentExpiresAt,
    } };
  } catch { return { state: 'error' }; }
}
function safeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (SAFE_ERROR_CODES.has(value) || /^provider_http_[1-5][0-9]{2}$/.test(value)) return value;
  return null;
}
function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function countValue(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
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
    const feedbackExportActions = ['export_markdown', 'export_text', 'export_json'] as const;
    if (!['summary', 'read_summary', 'health_check', 'badge', 'detail', 'acknowledge', 'resolve',
      'get_feedback_conversation', 'audit_feedback_copy', ...feedbackExportActions].includes(String(action))) {
      return json({ error: 'Invalid monitoring action' }, 400);
    }

    if (action === 'get_feedback_conversation' || feedbackExportActions.includes(action as typeof feedbackExportActions[number])) {
      if (typeof input.feedback_id !== 'string' || !UUID.test(input.feedback_id)
        || Object.keys(input).length !== 2 || !Object.keys(input).every((key) => ['action', 'feedback_id'].includes(key))) {
        return json({ error: 'Invalid feedback ID' }, 400);
      }
      const loaded = await loadFeedbackConversation(service, input.feedback_id);
      if (loaded.state === 'missing') return json({ error: 'Feedback context unavailable' }, 404);
      if (loaded.state === 'error') return json({ error: 'Feedback context unavailable' }, 503);
      const auditAction = action === 'get_feedback_conversation' ? 'view_transcript' : String(action);
      if (!await writeFeedbackAudit(service, authData.user.id, input.feedback_id, auditAction)) {
        return json({ error: 'Feedback audit unavailable' }, 503);
      }
      if (action === 'get_feedback_conversation') {
        return json({ dashboard_v2: { feedback_conversation: loaded.data } });
      }
      const format = action === 'export_markdown' ? 'markdown' : action === 'export_text' ? 'text' : 'json';
      const content = format === 'markdown' ? serializeFeedbackMarkdown(loaded.data)
        : format === 'text' ? serializeFeedbackText(loaded.data) : serializeFeedbackJson(loaded.data);
      const extension = format === 'markdown' ? 'md' : format === 'text' ? 'txt' : 'json';
      const contentType = format === 'markdown' ? 'text/markdown; charset=utf-8'
        : format === 'text' ? 'text/plain; charset=utf-8' : 'application/octet-stream';
      return attachment(content, exportFilename(input.feedback_id, loaded.data.feedback.recorded_at, extension), contentType);
    }

    if (action === 'audit_feedback_copy') {
      if (typeof input.feedback_id !== 'string' || !UUID.test(input.feedback_id)
        || Object.keys(input).length !== 2 || !Object.keys(input).every((key) => ['action', 'feedback_id'].includes(key))) {
        return json({ error: 'Invalid feedback ID' }, 400);
      }
      const { data, error } = await service.from('chat_feedback').select('interaction_id')
        .eq('interaction_id', input.feedback_id).maybeSingle();
      if (error) return json({ error: 'Feedback audit unavailable' }, 503);
      if (!data) return json({ error: 'Feedback context unavailable' }, 404);
      if (!await writeFeedbackAudit(service, authData.user.id, input.feedback_id, 'copy_for_analysis')) {
        return json({ error: 'Feedback audit unavailable' }, 503);
      }
      return json({ dashboard_v2: { feedback_copy_audited: true } });
    }

    if (action === 'badge') {
      if (Object.keys(input).some((key) => key !== 'action')) return json({ error: 'Invalid monitoring request' }, 400);
      const { count, error } = await service.from('system_alerts').select('id', { count: 'exact', head: true })
        .eq('state', 'active').in('severity', ['warning', 'critical']);
      if (error || !Number.isSafeInteger(count) || (count as number) < 0) return json({ error: 'Monitoring badge unavailable' }, 503);
      return json({ dashboard_v2: { version: 2, active_unacknowledged_alert_count: count } });
    }

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

    const dashboard = async () => {
      const { data, error } = await service.rpc('monitoring_dashboard_summary', { p_range: selectedRange });
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
      const rangeInfo = (data as Record<string, unknown>).range;
      if (!rangeInfo || typeof rangeInfo !== 'object' || Array.isArray(rangeInfo)) return null;
      const { start, end } = rangeInfo as Record<string, unknown>;
      if (typeof start !== 'string' || typeof end !== 'string'
          || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) return null;
      let requests: { data: Record<string, unknown>[] | null; error: unknown } = { data: null, error: true };
      let alerts: { data: Record<string, unknown>[] | null; error: unknown } = { data: null, error: true };
      let feedback: { data: unknown; error: unknown } = { data: null, error: true };
      let unresolvedCount: number | null = null;
      try { [requests, alerts, feedback] = await Promise.all([
        service.from('valuation_events').select('request_id,created_at,status,failure_category,total_edge_ms')
          .gte('created_at', start).lt('created_at', end)
          .order('created_at', { ascending: false }).limit(10),
        service.from('system_alerts').select('id,severity,source,category,state,first_detected_at,last_detected_at,occurrence_count,latest_request_id,acknowledged_at,resolved_at')
          .in('state', ['active', 'acknowledged']).order('last_detected_at', { ascending: false }).limit(30),
        service.rpc('monitoring_recent_feedback', { p_start: start, p_end: end }),
      ]);
        const total = await service.from('system_alerts').select('id', { count: 'exact', head: true })
          .in('state', ['active', 'acknowledged']);
        unresolvedCount = total.error ? null : total.count;
      } catch { /* Supplemental records can be unavailable without changing the legacy response. */ }
      return {
        ...(data as Record<string, unknown>),
        recent_valuation_requests: requests.error ? null : (requests.data ?? []).map((row: Record<string, unknown>) => ({
          request_id: typeof row.request_id === 'string' && UUID.test(row.request_id) ? row.request_id : null,
          created_at: row.created_at, status: row.status,
          failure_category: typeof row.failure_category === 'string' && SAFE_VALUATION_FAILURES.has(row.failure_category)
            ? row.failure_category : null,
          total_edge_ms: nonnegative(row.total_edge_ms),
        })),
        unresolved_alerts: alerts.error ? null : (alerts.data ?? []).map((row: Record<string, unknown>) => boundedSafeAlert(row)),
        unresolved_alert_count: unresolvedCount,
        recent_feedback: feedback.error || !Array.isArray(feedback.data) ? null
          : feedback.data.slice(0, 20).flatMap((row: unknown) => {
            if (typeof row !== 'object' || row === null || Array.isArray(row)) return [];
            const item = row as Record<string, unknown>;
            if (typeof item.feedback_id !== 'string' || !UUID.test(item.feedback_id)
                || !['positive', 'negative'].includes(String(item.rating))
                || typeof item.recorded_at !== 'string' || !Number.isFinite(Date.parse(item.recorded_at))
                || !(item.comment === null || (typeof item.comment === 'string' && item.comment.length <= 1000))) return [];
            return [{ feedback_id: item.feedback_id, rating: item.rating, recorded_at: item.recorded_at, comment: item.comment }];
          }),
      };
    };

    if (action === 'read_summary') {
      const summary = await dashboard();
      return summary ? json({ dashboard_v2: summary }) : json({ error: 'Monitoring data unavailable' }, 503);
    }

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
    let healthRecorded = false;
    try {
      const healthWrite = await service.from('service_health_checks').insert({
        service: 'render_model', status: healthStatus, source: 'admin_view', duration_ms: probeDuration,
        expected_model_version: expectedVersion, loaded_model_version: loadedVersion, failure_category: healthFailure,
      });
      healthRecorded = !healthWrite.error;
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

    const summary = await dashboard();
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
    return action === 'health_check'
      ? (summary ? json({ dashboard_v2: { ...summary, health_check_result: {
        status: healthStatus, observed_at: checkedAt, recorded: healthRecorded,
      } } }) : json({ error: 'Monitoring data unavailable' }, 503))
      : json({ ...legacy, dashboard_v2: summary ?? { version: 2, state: 'unavailable', reason: 'monitoring_data_unavailable' } });
  } catch {
    return json({ error: 'Monitoring unavailable' }, 503);
  }
});
