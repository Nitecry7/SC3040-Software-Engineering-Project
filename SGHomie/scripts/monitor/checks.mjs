// Level 1 service checks. One request per target, plus one optional model-version request.
// Response bodies are parsed here into a few booleans and then dropped: nothing returned
// from this module contains a body, header, token, key, URL query string or error message.

export const TARGETS = ['frontend', 'render_model', 'supabase_app'];

// Public, signed-out chatbot request. See the handoff report for the code evidence that the
// function answers `intent: "sell"` from a constant with no database access or provider call.
const SUPABASE_BODY = JSON.stringify({ intent: 'sell', message: 'sell', stream: false });
const NOT_READY_DETAIL = 'Valuation model is unavailable.';
const ROOT_PATTERN = /id\s*=\s*["']root["']/;

/**
 * @typedef {{ httpStatus: number | null, errorKind: string | null, bodyValid?: boolean, [field: string]: unknown }} RawPart
 * @typedef {{
 *   target: string, startedAt: string, durationMs: number, httpStatus: number | null,
 *   errorKind: string | null, host: string | null, fields: Record<string, boolean>,
 *   version: { httpStatus: number | null, errorKind: string | null, bodyValid: boolean, match: boolean } | null,
 * }} Observation
 * @typedef {{
 *   frontendUrl?: string, renderUrl?: string, supabaseUrl?: string, supabaseAnonKey?: string,
 *   renderToken?: string, expectedModelVersion?: string, timeoutMs: number,
 * }} MonitorConfig
 */

/** Returns { origin, host } for an http(s) URL, null when blank, or false when invalid. Never keeps query or userinfo. */
function parseBase(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return { origin: url.origin, pathname: url.pathname, host: url.host };
  } catch {
    return false;
  }
}

function isAbort(error, signal) {
  return signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError';
}

/** Performs one request. Returns only the status, an error kind and (for 200/503) the body text for local parsing. */
async function perform(ctx, url, init, readBodyFor) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
  try {
    const response = await ctx.fetcher(url, { ...init, redirect: 'manual', signal: controller.signal });
    const httpStatus = response.status;
    if (httpStatus >= 300 && httpStatus < 400) return { httpStatus, errorKind: 'redirect', text: null };
    const text = readBodyFor.includes(httpStatus) ? await response.text() : null;
    return { httpStatus, errorKind: null, text };
  } catch (error) {
    return { httpStatus: null, errorKind: isAbort(error, controller.signal) ? 'timeout' : 'network', text: null };
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text) {
  try {
    const value = JSON.parse(text ?? '');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Starts timing one check and returns a function that builds its observation. */
function begin(ctx, target, base) {
  const startedMs = ctx.now();
  return (partial) => ({
    target, startedAt: new Date(startedMs).toISOString(), durationMs: Math.max(0, Math.round(ctx.now() - startedMs)),
    httpStatus: null, errorKind: null, host: base ? base.host : null, fields: {}, version: null, ...partial,
  });
}

async function checkFrontend(ctx, cfg) {
  const base = parseBase(cfg.frontendUrl);
  const finish = begin(ctx, 'frontend', base);
  if (base === null || base === false) return finish({ errorKind: base === null ? 'not_configured' : 'invalid_config' });
  const res = await perform(ctx, base.origin + base.pathname, { method: 'GET' }, [200]);
  return finish({
    httpStatus: res.httpStatus, errorKind: res.errorKind,
    fields: res.text === null ? {} : { rootPresent: ROOT_PATTERN.test(res.text) },
  });
}

async function checkRender(ctx, cfg) {
  const base = parseBase(cfg.renderUrl);
  const finish = begin(ctx, 'render_model', base);
  if (base === null || base === false) return finish({ errorKind: base === null ? 'not_configured' : 'invalid_config' });
  const health = await perform(ctx, `${base.origin}/health`, { method: 'GET' }, [200, 503]);
  let fields = {};
  if (health.text !== null) {
    const body = parseJson(health.text);
    fields = health.httpStatus === 503
      ? { notReadySignal: body?.detail === NOT_READY_DETAIL }
      : { bodyValid: body !== null, statusOk: body?.status === 'ok', modelLoaded: body?.model_loaded === true };
  }
  let version = null;
  const versionConfigured = Boolean(cfg.renderToken && cfg.expectedModelVersion);
  if (versionConfigured && health.httpStatus === 200 && fields.bodyValid && fields.statusOk && fields.modelLoaded) {
    const info = await perform(ctx, `${base.origin}/v1/valuation/model-info`,
      { method: 'GET', headers: { Authorization: `Bearer ${cfg.renderToken}` } }, [200]);
    const body = info.text === null ? null : parseJson(info.text);
    version = {
      httpStatus: info.httpStatus, errorKind: info.errorKind,
      bodyValid: typeof body?.model_version === 'string',
      match: body?.model_version === cfg.expectedModelVersion,
    };
  }
  return finish({ httpStatus: health.httpStatus, errorKind: health.errorKind, fields, version });
}

async function checkSupabase(ctx, cfg) {
  const base = parseBase(cfg.supabaseUrl);
  const finish = begin(ctx, 'supabase_app', base);
  if (base === null || base === false) return finish({ errorKind: base === null ? 'not_configured' : 'invalid_config' });
  // No Authorization header on purpose: the function then treats the caller as signed out.
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.supabaseAnonKey) headers.apikey = cfg.supabaseAnonKey;
  const res = await perform(ctx, `${base.origin}/functions/v1/chatbot`, { method: 'POST', headers, body: SUPABASE_BODY }, [200]);
  let fields = {};
  if (res.text !== null) {
    const body = parseJson(res.text);
    fields = { bodyValid: body !== null, replyPresent: typeof body?.response === 'string' && body.response.trim() !== '' };
  }
  return finish({ httpStatus: res.httpStatus, errorKind: res.errorKind, fields });
}

/**
 * Runs every target concurrently. `fetcher` and `now` (milliseconds) are injected.
 * @param {MonitorConfig} config
 * @param {{ fetcher?: typeof fetch, now?: () => number }} [deps]
 * @returns {Promise<Observation[]>}
 */
export async function runChecks(config, { fetcher = fetch, now = () => Date.now() } = {}) {
  const ctx = { fetcher, now, timeoutMs: config.timeoutMs };
  return Promise.all([checkFrontend(ctx, config), checkRender(ctx, config), checkSupabase(ctx, config)]);
}
