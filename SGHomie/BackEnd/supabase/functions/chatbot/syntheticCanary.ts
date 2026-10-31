const CANARY_PROMPT = 'Reply with exactly this text and nothing else: SGHOMIE_CANARY_OK';
const CANARY_REPLY = 'SGHOMIE_CANARY_OK';

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
}): Promise<SyntheticChatbotCanary> {
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
      max_tokens: 16,
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
      canaryValid = responseValid && content!.trim() === CANARY_REPLY;
      status = canaryValid ? 'success' : 'failure';
      failureCategory = canaryValid ? null : responseValid ? 'CANARY_VALIDATION_FAILURE' : 'INVALID_PROVIDER_RESPONSE';
    }
  } catch (error) {
    const failure = failureFor(error);
    status = failure.status;
    failureCategory = failure.category;
  }
  return {
    status, failure_category: failureCategory, request_id: requestId,
    provider, model, edge_reached: true, upstream_reached: upstreamReached,
    response_valid: responseValid, canary_valid: canaryValid,
    duration_ms: Math.max(0, Math.round((now() - startedAt) * 100) / 100),
  };
}
