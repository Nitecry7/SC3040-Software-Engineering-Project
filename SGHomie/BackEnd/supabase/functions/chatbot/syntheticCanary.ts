const CANARY_REPLY = 'SGHOMIE_CANARY_OK';
const CANARY_PROMPT = `Output only the following token. Do not add quotes, punctuation, formatting, reasoning or any other text.\n${CANARY_REPLY}`;

export type CanaryValidation = 'exact' | 'wrapped' | 'truncated' | 'contains' | 'unrelated' | 'empty';
export type CanaryDiagnostics = {
  validation: CanaryValidation | null;
  finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'other' | null;
  served_model: string | null;
  output_chars: number;
};

// Cosmetic wrappers that may surround the token: paired quotes, backticks, emphasis markers.
const WRAPPERS: Array<[string, string]> = [
  ['```', '```'], ['**', '**'], ['__', '__'], ['"', '"'], ["'", "'"], ['`', '`'], ['*', '*'], ['_', '_'],
  ['“', '”'], ['‘', '’'],
];

// Pure classifier. Only the token itself, optionally wrapped cosmetically, is accepted.
export function classifyCanaryText(text: unknown): CanaryValidation {
  if (typeof text !== 'string' || text.trim().length === 0) return 'empty';
  const trimmed = text.trim();
  if (trimmed === CANARY_REPLY) return 'exact';
  let inner = trimmed;
  let fullStopUsed = false;
  for (let depth = 0; depth < 6 && inner !== CANARY_REPLY; depth += 1) {
    if (!fullStopUsed && inner.endsWith('.')) { inner = inner.slice(0, -1).trim(); fullStopUsed = true; continue; }
    const pair = WRAPPERS.find(([open, close]) => inner.length > open.length + close.length
      && inner.startsWith(open) && inner.endsWith(close));
    if (!pair) break;
    inner = inner.slice(pair[0].length, inner.length - pair[1].length).trim();
  }
  if (inner === CANARY_REPLY) return 'wrapped';
  if (CANARY_REPLY.startsWith(trimmed)) return 'truncated';
  if (text.includes(CANARY_REPLY)) return 'contains';
  return 'unrelated';
}

function safeFinishReason(value: unknown): CanaryDiagnostics['finish_reason'] {
  if (typeof value !== 'string') return null;
  return value === 'stop' || value === 'length' || value === 'content_filter' || value === 'tool_calls' ? value : 'other';
}

export type SyntheticChatbotCanary = {
  status: 'success' | 'failure' | 'unknown';
  failure_category: string | null;
  request_id: string;
  provider: 'openai' | 'openrouter' | null;
  model: string | null;
  edge_reached: true;
  upstream_reached: boolean;
  response_valid: boolean;
  canary_valid: boolean;
  duration_ms: number;
};

function safeLabel(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._:/-]{0,119}$/i.test(value) ? value : null;
}

function safeProvider(value: unknown): 'openai' | 'openrouter' | null {
  return value === 'openai' || value === 'openrouter' ? value : null;
}

function failureFor(error: unknown): { status: 'failure' | 'unknown'; category: string } {
  const value = error as { name?: unknown; status?: unknown } | null;
  if (value?.name === 'ChatProviderConfigError') return { status: 'failure', category: 'CONFIGURATION_FAILURE' };
  if (value?.name === 'ChatQuotaError') return { status: 'unknown', category: 'GLOBAL_CAPACITY_LIMITED' };
  if (value?.name === 'ChatQuotaUnavailableError') return { status: 'unknown', category: 'GLOBAL_CAPACITY_UNAVAILABLE' };
  if (['AbortError', 'TimeoutError'].includes(String(value?.name)) || value?.status === 504)
    return { status: 'unknown', category: 'PROVIDER_TIMEOUT' };
  if (typeof value?.status === 'number' && value.status === 429)
    return { status: 'unknown', category: 'PROVIDER_RATE_LIMITED' };
  if (typeof value?.status === 'number' && value.status >= 500)
    return { status: 'failure', category: 'PROVIDER_UNAVAILABLE' };
  if (value?.status === 400 || value?.status === 401 || value?.status === 403)
    return { status: 'failure', category: 'PROVIDER_CONFIGURATION_FAILURE' };
  return { status: 'unknown', category: 'NETWORK_UNCERTAIN' };
}

export async function runSyntheticChatbotCanary(dependencies: {
  createProvider: () => Promise<{ provider: unknown; model: unknown; client: {
    chat: { completions: { create: (params: Record<string, unknown>) => Promise<unknown> } };
  } }> | { provider: unknown; model: unknown; client: {
    chat: { completions: { create: (params: Record<string, unknown>) => Promise<unknown> } };
  } };
  reserveProviderCapacity: () => Promise<void>;
  requestId?: () => string;
  now?: () => number;
  onDiagnostics?: (diagnostics: CanaryDiagnostics) => void;
}): Promise<SyntheticChatbotCanary> {
  const diagnostics: CanaryDiagnostics = { validation: null, finish_reason: null, served_model: null, output_chars: 0 };
  const now = dependencies.now ?? (() => performance.now());
  const startedAt = now();
  const requestId = (dependencies.requestId ?? (() => crypto.randomUUID()))();
  let provider: 'openai' | 'openrouter' | null = null;
  let model: string | null = null;
  let upstreamReached = false;
  let responseValid = false;
  let canaryValid = false;
  let status: SyntheticChatbotCanary['status'] = 'failure';
  let failureCategory: string | null = null;
  try {
    const configured = await dependencies.createProvider();
    provider = safeProvider(configured.provider);
    model = safeLabel(configured.model);
    if (!provider || !model) throw Object.assign(new Error(), { name: 'ChatProviderConfigError' });
    await dependencies.reserveProviderCapacity();
    const response = await configured.client.chat.completions.create({
      model: configured.model,
      messages: [{ role: 'user', content: CANARY_PROMPT }],
      temperature: 0,
      max_tokens: 128,
      stream: false,
    });
    upstreamReached = true;
    if (typeof response !== 'object' || response === null || Array.isArray(response)) {
      failureCategory = 'INVALID_PROVIDER_RESPONSE';
      status = 'failure';
    } else {
      const choices = (response as { choices?: unknown }).choices;
      const content = Array.isArray(choices) && choices.length === 1
        && typeof choices[0] === 'object' && choices[0] !== null
        && typeof (choices[0] as { message?: unknown }).message === 'object'
        && (choices[0] as { message: { content?: unknown } }).message !== null
        ? (choices[0] as { message: { content?: unknown } }).message.content : undefined;
      responseValid = typeof content === 'string' && content.trim().length > 0;
      const validation = classifyCanaryText(content);
      const firstChoice = Array.isArray(choices) ? choices[0] as { finish_reason?: unknown } | null | undefined : undefined;
      diagnostics.validation = validation;
      diagnostics.finish_reason = safeFinishReason(firstChoice?.finish_reason);
      diagnostics.served_model = safeLabel((response as { model?: unknown }).model);
      diagnostics.output_chars = typeof content === 'string' ? Math.min(content.length, 9999) : 0;
      canaryValid = validation === 'exact' || validation === 'wrapped';
      status = canaryValid ? 'success' : 'failure';
      failureCategory = canaryValid ? null : responseValid ? 'CANARY_VALIDATION_FAILURE' : 'INVALID_PROVIDER_RESPONSE';
    }
  } catch (error) {
    const failure = failureFor(error);
    status = failure.status;
    failureCategory = failure.category;
  }
  try { dependencies.onDiagnostics?.(diagnostics); } catch { /* diagnostics must never change the result */ }
  return {
    status, failure_category: failureCategory, request_id: requestId,
    provider, model, edge_reached: true, upstream_reached: upstreamReached,
    response_valid: responseValid, canary_valid: canaryValid,
    duration_ms: Math.max(0, Math.round((now() - startedAt) * 100) / 100),
  };
}
