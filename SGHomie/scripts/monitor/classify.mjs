// Pure classification of a raw observation into healthy / failed / unknown with a stable reason code.
// Only whitelisted, validated fields are copied into the result, so anything else present on an
// observation (for example a fixture carrying extra data) can never reach the report.

/** Stable reason codes and the status each one maps to. */
export const REASONS = Object.freeze({
  OK: 'healthy',
  NOT_READY: 'failed',
  MODEL_VERSION_MISMATCH: 'failed',
  ROOT_ELEMENT_MISSING: 'failed',
  INVALID_BODY: 'failed',
  HTTP_5XX: 'failed',
  UPSTREAM_UNAVAILABLE: 'unknown',
  TIMEOUT: 'unknown',
  NETWORK_ERROR: 'unknown',
  UNEXPECTED_STATUS: 'unknown',
  REDIRECT_NOT_FOLLOWED: 'unknown',
  NOT_CONFIGURED: 'unknown',
  INVALID_CONFIG: 'unknown',
  VERSION_CHECK_UNAVAILABLE: 'unknown',
});

const ERROR_KIND_REASON = {
  timeout: 'TIMEOUT',
  network: 'NETWORK_ERROR',
  redirect: 'REDIRECT_NOT_FOLLOWED',
  not_configured: 'NOT_CONFIGURED',
  invalid_config: 'INVALID_CONFIG',
};
const HOST_PATTERN = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

/**
 * @typedef {{
 *   target: string, status: 'healthy' | 'failed' | 'unknown', reason: string, startedAt: string,
 *   durationMs: number, httpStatus: number | null, host: string | null,
 *   versionCheck: 'not_checked' | 'matched' | 'mismatch' | 'unavailable',
 * }} Result
 */

// A sleeping free-tier service can answer 502/503/504 from its proxy while waking, and without
// stored state a wake-up cannot be told from an outage. These are unknown for Render only.
const PROXY_STATUSES = [502, 503, 504];

function fromStatus(httpStatus) {
  if (httpStatus >= 500) return 'HTTP_5XX';
  if (httpStatus !== 200) return 'UNEXPECTED_STATUS';
  return null;
}

/** Returns [reason, versionCheck] for a 200 render health response. */
function renderOutcome(obs) {
  const f = obs.fields ?? {};
  if (f.bodyValid !== true) return ['INVALID_BODY', 'not_checked'];
  if (f.statusOk !== true || f.modelLoaded !== true) return ['NOT_READY', 'not_checked'];
  const v = obs.version;
  if (!v) return ['OK', 'not_checked'];
  if (v.errorKind) return ['VERSION_CHECK_UNAVAILABLE', 'unavailable'];
  const statusReason = fromStatus(v.httpStatus);
  if (PROXY_STATUSES.includes(v.httpStatus)) return ['VERSION_CHECK_UNAVAILABLE', 'unavailable'];
  if (statusReason === 'HTTP_5XX') return ['HTTP_5XX', 'unavailable'];
  if (statusReason) return ['VERSION_CHECK_UNAVAILABLE', 'unavailable'];
  if (v.bodyValid !== true) return ['INVALID_BODY', 'unavailable'];
  return v.match === true ? ['OK', 'matched'] : ['MODEL_VERSION_MISMATCH', 'mismatch'];
}

/**
 * @param {import('./checks.mjs').Observation} obs
 * @returns {Result}
 */
export function classify(obs) {
  const f = obs.fields ?? {};
  let reason;
  let versionCheck = 'not_checked';
  if (obs.errorKind) {
    reason = ERROR_KIND_REASON[obs.errorKind] ?? 'NETWORK_ERROR';
  } else if (obs.httpStatus === 503 && obs.target === 'render_model' && f.notReadySignal === true) {
    reason = 'NOT_READY';
  } else if (obs.target === 'render_model' && PROXY_STATUSES.includes(obs.httpStatus)) {
    reason = 'UPSTREAM_UNAVAILABLE';
  } else if (fromStatus(obs.httpStatus)) {
    reason = fromStatus(obs.httpStatus);
  } else if (obs.target === 'frontend') {
    reason = f.rootPresent === true ? 'OK' : 'ROOT_ELEMENT_MISSING';
  } else if (obs.target === 'render_model') {
    [reason, versionCheck] = renderOutcome(obs);
  } else if (obs.target === 'supabase_app') {
    reason = f.bodyValid === true && f.replyPresent === true ? 'OK' : 'INVALID_BODY';
  } else {
    reason = 'INVALID_BODY';
  }
  const startedAt = new Date(obs.startedAt);
  return {
    target: /^[a-z_]{1,32}$/.test(obs.target) ? obs.target : 'invalid_target',
    status: REASONS[reason],
    reason,
    startedAt: Number.isNaN(startedAt.getTime()) ? new Date(0).toISOString() : startedAt.toISOString(),
    durationMs: Number.isFinite(obs.durationMs) ? Math.max(0, Math.round(obs.durationMs)) : 0,
    httpStatus: Number.isInteger(obs.httpStatus) ? obs.httpStatus : null,
    host: typeof obs.host === 'string' && HOST_PATTERN.test(obs.host) ? obs.host : null,
    versionCheck,
  };
}
