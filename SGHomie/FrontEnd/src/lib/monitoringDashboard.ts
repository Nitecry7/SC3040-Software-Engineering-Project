import type { FeedbackConversation, FeedbackRating } from '../../../BackEnd/supabase/functions/_shared/feedbackConversation.ts';

export type MonitoringRange = '1h' | '24h' | '7d' | '30d';
export type Percentile = { state: 'available' | 'insufficient_samples'; value_ms: number | null };
export type DurationStats = { sample_count: number; p50: Percentile; p95: Percentile; p99: Percentile };
export type MonitoringAlert = {
  id: number; severity: 'warning' | 'critical'; source: string; category: string;
  state: 'active' | 'acknowledged' | 'resolved'; first_detected_at: string;
  last_detected_at: string; occurrence_count: number; latest_request_id: string | null;
  acknowledged_at: string | null; resolved_at: string | null;
};
export type MonitoringRequest = {
  request_id: string; created_at: string; status: string;
  failure_category: string | null; total_edge_ms: number | null;
};
export type MonitoringDetail = MonitoringRequest & {
  completed_at: string | null; model_version: string | null; prediction_sanity: string | null;
  authentication_ms: number | null; database_lookup_ms: number | null;
  request_construction_ms: number | null; render_fetch_ms: number | null;
};
export type MonitoringFeedback = { feedback_id: string; rating: FeedbackRating; recorded_at: string; comment: string | null };
export type SyntheticCanaryType = 'chatbot' | 'valuation';
export type SyntheticCanaryResult = {
  canary_type: SyntheticCanaryType; status: 'success' | 'failure' | 'unknown'; failure_category: string | null;
  started_at: string; completed_at: string; duration_ms: number; request_id: string | null;
  expected_model_version: string | null; observed_model_version: string | null;
  provider: 'openai' | 'openrouter' | null; model: string | null;
  edge_reached: boolean; upstream_reached: boolean; response_valid: boolean; canary_valid: boolean;
};
export type MonitoringBucket = {
  bucket_start: string; label: string | null; request_count: number; success_count: number;
  failure_count: number; chatbot_request_count: number; chatbot_success_count: number;
  chatbot_failure_count: number; total_edge: DurationStats; chatbot_total_interaction: DurationStats;
};
export type MonitoringDashboard = {
  version: 2; generated_at: string; range: { start: string; end: string; range: MonitoringRange };
  aggregation_timezone: 'Asia/Singapore'; metrics: Record<string, DurationStats | { state: 'unavailable' }>;
  valuation: { recorded_events: number; successful_events: number; failed_events: number;
    failure_categories: Record<string, number>; prediction_sanity_failures: number; series: MonitoringBucket[] };
  chatbot: { recorded_interactions: number; successful_interactions: number;
    failure_categories: Record<string, number>; quota_outcomes: Record<string, number>;
    provider_calls: number; provider_statuses: Record<string, number>;
    feedback_count: number; feedback_ratings: Record<string, number> };
  alerts: MonitoringAlert[]; unresolved_alerts: MonitoringAlert[] | null;
  unresolved_alert_count: number | null;
  active_unacknowledged_alert_count: number;
  health: Array<{ checked_at: string; service: string; status: string; source: string;
    duration_ms: number | null; expected_model_version: string | null;
    loaded_model_version: string | null; failure_category: string | null }>;
  retention: { target_days: number; cleanup_scheduling: string;
    oldest_valuation_event_at: string | null; oldest_service_health_check_at: string | null;
    oldest_resolved_alert_at: string | null };
  recent_valuation_requests: MonitoringRequest[] | null;
  recent_feedback: MonitoringFeedback[] | null;
  synthetic_canaries?: { chatbot: SyntheticCanaryResult | null; valuation: SyntheticCanaryResult | null } | null;
};

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const date = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const duration = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
const counts = (value: unknown): value is Record<string, number> =>
  object(value) && Object.values(value).every(count);
const nullableDate = (value: unknown) => value === null || date(value);
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const ranges: MonitoringRange[] = ['1h', '24h', '7d', '30d'];
const requiredMetrics = ['valuation_total_edge', 'valuation_authentication', 'valuation_database_lookup',
  'valuation_request_construction', 'valuation_render_fetch', 'chat_total_interaction',
  'chat_provider', 'chat_tool', 'chat_first_output', 'provider_call',
  'render_total', 'catboost_prediction', 'conformal_interval'];
const validStats = (value: unknown): value is DurationStats =>
  object(value) && count(value.sample_count) && ['p50', 'p95', 'p99'].every((key) => {
    const percentile = value[key];
    return object(percentile) && ['available', 'insufficient_samples'].includes(String(percentile.state))
      && duration(percentile.value_ms)
      && (percentile.state === 'available' ? typeof percentile.value_ms === 'number' : percentile.value_ms === null);
  });
const validAlert = (value: unknown): value is MonitoringAlert =>
  object(value) && count(value.id) && ['warning', 'critical'].includes(String(value.severity))
  && typeof value.source === 'string' && typeof value.category === 'string'
  && ['active', 'acknowledged', 'resolved'].includes(String(value.state))
  && date(value.first_detected_at) && date(value.last_detected_at) && count(value.occurrence_count)
  && nullableText(value.latest_request_id) && nullableDate(value.acknowledged_at) && nullableDate(value.resolved_at);
const validRequest = (value: unknown): value is MonitoringRequest & Record<string, unknown> =>
  object(value) && typeof value.request_id === 'string' && date(value.created_at)
  && typeof value.status === 'string' && nullableText(value.failure_category) && duration(value.total_edge_ms);

export function parseMonitoringDetail(value: unknown, requestedId: string): MonitoringDetail | null {
  if (!object(value) || !object(value.dashboard_v2) || value.dashboard_v2.version !== 2
    || !object(value.dashboard_v2.request_detail)) return null;
  const detail = value.dashboard_v2.request_detail;
  if (!validRequest(detail) || detail.request_id !== requestedId || !nullableDate(detail.completed_at)
    || !nullableText(detail.model_version) || !nullableText(detail.prediction_sanity)
    || !duration(detail.authentication_ms) || !duration(detail.database_lookup_ms)
    || !duration(detail.request_construction_ms) || !duration(detail.render_fetch_ms)) return null;
  return {
    request_id: detail.request_id, created_at: detail.created_at,
    status: detail.status, failure_category: detail.failure_category,
    total_edge_ms: detail.total_edge_ms, completed_at: detail.completed_at,
    model_version: detail.model_version, prediction_sanity: detail.prediction_sanity,
    authentication_ms: detail.authentication_ms, database_lookup_ms: detail.database_lookup_ms,
    request_construction_ms: detail.request_construction_ms, render_fetch_ms: detail.render_fetch_ms,
  } as MonitoringDetail;
}

export function parseFeedbackConversation(value: unknown, requestedId: string): FeedbackConversation | null {
  if (!object(value) || !object(value.dashboard_v2) || !object(value.dashboard_v2.feedback_conversation)) return null;
  const item = value.dashboard_v2.feedback_conversation;
  if (!object(item.feedback) || item.feedback.feedback_id !== requestedId
    || typeof item.feedback.feedback_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.feedback.feedback_id)
    || !['positive', 'negative'].includes(String(item.feedback.rating)) || !date(item.feedback.recorded_at)
    || !(item.feedback.comment === null || (typeof item.feedback.comment === 'string' && item.feedback.comment.length <= 1000))
    || !nullableDate(item.feedback.comment_expires_at)
    || !['available', 'unavailable'].includes(String(item.conversation_state))
    || !Array.isArray(item.conversation) || item.conversation.length > 8
    || typeof item.truncated !== 'boolean' || !count(item.omitted_context_count)
    || !nullableDate(item.content_expires_at)) return null;
  const conversation = item.conversation;
  if (!conversation.every((message: unknown) => object(message)
    && ['user', 'assistant'].includes(String(message.role)) && typeof message.content === 'string'
    && typeof message.rated === 'boolean' && typeof message.truncated === 'boolean'
    && !(message.rated && message.role !== 'assistant'))
    || conversation.reduce((sum: number, message: Record<string, unknown>) => sum + Array.from(message.content as string).length, 0) > 20_000) return null;
  if (item.conversation_state === 'available'
    && (conversation.filter((message: Record<string, unknown>) => message.rated).length !== 1
      || conversation.filter((message: Record<string, unknown>) => message.rated && message.role === 'assistant').length !== 1
      || !conversation.some((message: Record<string, unknown>) => message.role === 'user'))) return null;
  if (item.conversation_state === 'unavailable' && conversation.length !== 0) return null;
  if (item.technical_context !== null && !object(item.technical_context)) return null;
  const tech = item.technical_context as Record<string, unknown> | null;
  if (tech && (['provider', 'requested_model', 'resolved_model', 'prompt_version', 'outcome'].some((key) => !nullableText(tech[key]))
    || !duration(tech.total_latency_ms) || !(tech.provider_calls === null || Array.isArray(tech.provider_calls))
    || !(tech.tool_summary === null || object(tech.tool_summary)))) return null;
  return {
    feedback: {
      feedback_id: item.feedback.feedback_id as string,
      rating: item.feedback.rating as FeedbackRating,
      recorded_at: item.feedback.recorded_at as string,
      comment: item.feedback.comment as string | null,
      comment_expires_at: item.feedback.comment_expires_at as string | null,
    },
    conversation_state: item.conversation_state as FeedbackConversation['conversation_state'],
    conversation: conversation.map((message: Record<string, unknown>) => ({
      role: message.role as 'user' | 'assistant', content: message.content as string,
      rated: message.rated as boolean, truncated: message.truncated as boolean,
    })),
    technical_context: tech as FeedbackConversation['technical_context'],
    content_expires_at: item.content_expires_at as string | null,
    truncated: item.truncated,
    omitted_context_count: item.omitted_context_count,
  };
}

export function parseDashboard(value: unknown): MonitoringDashboard | 'upgrade_required' | null {
  if (!object(value) || !object(value.dashboard_v2)) return 'upgrade_required';
  const data = value.dashboard_v2;
  if (data.version !== 2 || data.state === 'unavailable') return 'upgrade_required';
  if (!('recent_valuation_requests' in data) || !('unresolved_alerts' in data)
    || !('unresolved_alert_count' in data)) return 'upgrade_required';
  if (!date(data.generated_at) || !object(data.range) || !ranges.includes(data.range.range as MonitoringRange)
    || !date(data.range.start) || !date(data.range.end) || data.aggregation_timezone !== 'Asia/Singapore'
    || !object(data.metrics) || !object(data.valuation) || !object(data.chatbot)
    || !object(data.retention) || !Array.isArray(data.health) || !Array.isArray(data.alerts)
    || !count(data.active_unacknowledged_alert_count)) return null;
  const valuation = data.valuation;
  const chatbot = data.chatbot;
  const metrics = data.metrics as Record<string, unknown>;
  if (!Object.values(metrics).every((metric) => validStats(metric)
      || (object(metric) && metric.state === 'unavailable'))
    || !requiredMetrics.every((key) => key in metrics)
    || !['recorded_events', 'successful_events', 'failed_events', 'prediction_sanity_failures']
      .every((key) => count(valuation[key]))
    || !counts(valuation.failure_categories) || !Array.isArray(valuation.series)
    || !valuation.series.every((bucket: unknown) => object(bucket) && date(bucket.bucket_start)
      && nullableText(bucket.label) && ['request_count', 'success_count', 'failure_count',
        'chatbot_request_count', 'chatbot_success_count', 'chatbot_failure_count'].every((key) => count(bucket[key]))
      && validStats(bucket.total_edge) && validStats(bucket.chatbot_total_interaction))
    || !['recorded_interactions', 'successful_interactions', 'provider_calls', 'feedback_count']
      .every((key) => count(chatbot[key]))
    || !['failure_categories', 'quota_outcomes', 'provider_statuses', 'feedback_ratings']
      .every((key) => counts(chatbot[key]))
    || !data.alerts.every(validAlert)
    || !(data.unresolved_alerts === null || (Array.isArray(data.unresolved_alerts) && data.unresolved_alerts.every(validAlert)))
    || !(data.unresolved_alert_count === null || count(data.unresolved_alert_count))
    || !(data.recent_valuation_requests === null
      || (Array.isArray(data.recent_valuation_requests) && data.recent_valuation_requests.every(validRequest)))
    || !data.health.every((item: unknown) => object(item) && date(item.checked_at)
      && typeof item.service === 'string' && typeof item.status === 'string'
      && typeof item.source === 'string' && duration(item.duration_ms)
      && nullableText(item.expected_model_version) && nullableText(item.loaded_model_version)
      && nullableText(item.failure_category))
    || !count(data.retention.target_days) || typeof data.retention.cleanup_scheduling !== 'string'
    || !nullableDate(data.retention.oldest_valuation_event_at)
    || !nullableDate(data.retention.oldest_service_health_check_at)
    || !nullableDate(data.retention.oldest_resolved_alert_at)) return null;
  const feedback = data.recent_feedback;
  if (feedback !== undefined && feedback !== null && (!Array.isArray(feedback) || feedback.length > 20
    || !feedback.every((item) => object(item)
      && typeof item.feedback_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.feedback_id)
      && ['positive', 'negative'].includes(String(item.rating))
      && date(item.recorded_at) && (item.comment === null || (typeof item.comment === 'string' && item.comment.length <= 1000))))) return null;
  const canaries = data.synthetic_canaries;
  const validCanary = (item: unknown): item is SyntheticCanaryResult => item === null || (object(item)
    && ['chatbot', 'valuation'].includes(String(item.canary_type))
    && ['success', 'failure', 'unknown'].includes(String(item.status))
    && (item.failure_category === null || typeof item.failure_category === 'string')
    && date(item.started_at) && date(item.completed_at) && duration(item.duration_ms) && item.duration_ms !== null
    && (item.request_id === null || (typeof item.request_id === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.request_id)))
    && nullableText(item.expected_model_version) && nullableText(item.observed_model_version)
    && (item.provider === null || item.provider === 'openai' || item.provider === 'openrouter')
    && nullableText(item.model)
    && ['edge_reached', 'upstream_reached', 'response_valid', 'canary_valid'].every((key) => typeof item[key] === 'boolean'));
  if (canaries !== undefined && canaries !== null && (!object(canaries)
    || !validCanary(canaries.chatbot) || !validCanary(canaries.valuation))) return null;
  return {
    ...data,
    recent_feedback: Array.isArray(feedback) ? feedback.map((item) => ({
      feedback_id: item.feedback_id as string, rating: item.rating as MonitoringFeedback['rating'],
      recorded_at: item.recorded_at as string, comment: item.comment as string | null,
    })) : null,
    ...(canaries !== undefined ? { synthetic_canaries: canaries as MonitoringDashboard['synthetic_canaries'] } : {}),
  } as MonitoringDashboard;
}

export function parseMonitoringBadge(value: unknown): number | null {
  if (!object(value) || !object(value.dashboard_v2) || value.dashboard_v2.version !== 2) return null;
  const amount = value.dashboard_v2.active_unacknowledged_alert_count;
  return count(amount) && amount > 0 ? amount : null;
}

export function isUnsupportedMonitoringAction(error: unknown): boolean {
  return object(error) && object(error.context) && error.context.status === 400;
}

export function parseHealthCheckResult(value: unknown): { status: 'healthy' | 'critical' | 'unknown'; recorded: boolean } | null {
  if (!object(value) || !object(value.dashboard_v2) || !object(value.dashboard_v2.health_check_result)) return null;
  const result = value.dashboard_v2.health_check_result;
  if (!['healthy', 'critical', 'unknown'].includes(String(result.status))
    || typeof result.recorded !== 'boolean' || !date(result.observed_at)) return null;
  return { status: result.status as 'healthy' | 'critical' | 'unknown', recorded: result.recorded };
}

export function parseSyntheticCanaryResult(value: unknown, expectedType?: SyntheticCanaryType): SyntheticCanaryResult | null {
  if (!object(value) || !object(value.dashboard_v2)) return null;
  const item = value.dashboard_v2.synthetic_canary;
  if (!object(item)) return null;
  const valid = (item.canary_type === 'chatbot' || item.canary_type === 'valuation')
    && (!expectedType || item.canary_type === expectedType)
    && ['success', 'failure', 'unknown'].includes(String(item.status))
    && (item.failure_category === null || typeof item.failure_category === 'string')
    && date(item.started_at) && date(item.completed_at)
    && duration(item.duration_ms) && item.duration_ms !== null
    && (item.request_id === null || (typeof item.request_id === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.request_id)))
    && nullableText(item.expected_model_version) && nullableText(item.observed_model_version)
    && (item.provider === null || item.provider === 'openai' || item.provider === 'openrouter')
    && nullableText(item.model)
    && ['edge_reached', 'upstream_reached', 'response_valid', 'canary_valid'].every((key) => typeof item[key] === 'boolean');
  return valid ? item as SyntheticCanaryResult : null;
}

export function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return 'Unavailable';
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`;
}
export function formatCount(value: number): string {
  return value < 1000 ? String(value) : `${(value / 1000).toFixed(1)}k`;
}
export function formatSgt(value: string | null): string {
  if (!value || !date(value)) return 'Unavailable';
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(value));
}
export function formatSgtWithZone(value: string | null): string {
  const formatted = formatSgt(value);
  return formatted === 'Unavailable' ? formatted : `${formatted} SGT`;
}
const friendlyLabels: Record<string, string> = {
  success: 'Success', failure: 'Failed', failed: 'Failed', healthy: 'Ready', critical: 'Critical',
  warning: 'Warning', unknown: 'Unknown', active: 'Active', acknowledged: 'Acknowledged', resolved: 'Resolved',
  user_burst_limit: 'User Burst Limit', CHAT_USER_BURST_LIMIT: 'User Burst Limit',
  user_daily_limit: 'User Daily Limit', CHAT_USER_DAILY_LIMIT: 'User Daily Limit',
  prediction_interval_invalid: 'Prediction Interval Invalid', RENDER_UNAVAILABLE: 'Render Unavailable',
  provider_error: 'Provider Error', provider_http_429: 'Provider Rate Limit',
  provider_http_500: 'Provider Error', provider_http_502: 'Provider Error', provider_http_503: 'Provider Error',
  provider_http_504: 'Provider Timeout', OTHER: 'Other',
  edge_total: 'Edge Total', database_lookup: 'Database Lookup', request_construction: 'Request Construction',
  render_fetch: 'Render Fetch', render_total: 'Render Total', catboost_prediction: 'CatBoost Prediction',
  conformal_interval: 'Conformal Interval', prediction_sanity: 'Prediction Sanity', not_authorized: 'Not Authorized',
  rate_limited: 'Rate Limited',
};
export function monitoringDisplayLabel(value: string): string {
  return friendlyLabels[value] ?? friendlyLabels[value.toLowerCase()]
    ?? value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
export const percentileMinimums = { p50: 5, p95: 20, p99: 100 } as const;
export function monitoringBucketLabel(label: string | null, bucketStart: string, range?: MonitoringRange): string {
  if (label === 'Today so far' || label === 'Today (Partial)') return 'Today';
  if (label) return label;
  const d = new Date(bucketStart);
  const options: Intl.DateTimeFormatOptions = range === '7d' || range === '30d'
    ? { weekday: 'short', day: 'numeric' } : { hour: 'numeric', hour12: true };
  return new Intl.DateTimeFormat('en-SG', { ...options, timeZone: 'Asia/Singapore' }).format(d);
}
export function percentileLabel(stats: DurationStats | { state: 'unavailable' } | undefined,
  key: 'p50' | 'p95' | 'p99'): string {
  if (!stats || 'state' in stats) return 'Unavailable';
  const item = stats[key];
  return item.state === 'available' ? formatDuration(item.value_ms) : 'Insufficient samples';
}
