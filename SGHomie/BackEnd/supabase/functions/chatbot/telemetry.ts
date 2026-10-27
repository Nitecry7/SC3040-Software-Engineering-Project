import type { ChatCompletionCreateParams, ChatCompletionResponse, OpenRouterClient } from '../_shared/openrouter.ts';
import type { ChatQuotaSnapshot } from './quota.ts';

export const CHAT_PROMPT_VERSION = 'chatbot-v2';
export const SENSITIVE_INPUT_WARNING = 'This message may contain sensitive information. Please remove passwords, API keys, NRIC/FIN, payment-card details, authentication tokens, or other sensitive information before sending it.';
export const CONTACT_INPUT_REPLY = "You don't need to share personal contact details with the AI assistant. How can I help with your HDB search?";
const SINGAPORE_PHONE = /(?<![\dA-Za-z$])(?:\+?65[ -]?)?[689]\d{3}[ -]?\d{4}(?![\dA-Za-z])/g;
const LABELED_PHONE = /\b(?:phone|mobile|telephone|tel|contact number)\b[^0-9]{0,24}\+?\d(?:[\d ().-]{5,}\d)/i;

export type SensitiveCategory = 'credential' | 'nric_fin' | 'payment_card';
export type InteractionStatus = 'success' | 'quota_denied' | 'provider_error' | 'tool_error' | 'internal_error' | 'aborted';

export type ProviderCallRecord = {
  interaction_id: string;
  sequence: number;
  provider: 'openrouter' | 'openai';
  requested_model: string;
  resolved_model: string | null;
  started_at: string;
  completed_at: string;
  latency_ms: number;
  input_token_count: number | null;
  output_token_count: number | null;
  total_token_count: number | null;
  status: 'success' | 'provider_error' | 'capacity_denied';
  error_code: string | null;
};

export type InteractionFinal = {
  status: InteractionStatus;
  error_code?: string | null;
  fallback_used?: boolean;
  assistant_message?: string | null;
};

export type TelemetryStore = {
  start: (record: Record<string, unknown>) => Promise<unknown>;
  finish: (interactionId: string, record: Record<string, unknown>) => Promise<unknown>;
  providerCalls: (records: ProviderCallRecord[]) => Promise<unknown>;
};

type ToolSnapshot = { name: string; called: boolean; success: boolean | null; resultCount: number | null; latencyMs: number };

function luhnValid(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

const CARD_CANDIDATE = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
const SENSITIVE_PATTERNS: Array<[SensitiveCategory, RegExp]> = [
  ['credential', /(?:\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b|\bBearer\s+[A-Za-z0-9._~+\/-]{16,}=*|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b|\b(?:api[_ -]?key|access[_ -]?token|auth[_ -]?token|password|passcode|secret)\s*(?::|=|\bis\b)\s*\S+)/i],
  ['nric_fin', /\b[STFG]\d{7}[A-Z]\b/i],
];

export function detectSensitiveInput(text: string): SensitiveCategory | null {
  for (const [category, pattern] of SENSITIVE_PATTERNS) if (pattern.test(text)) return category;
  for (const match of text.matchAll(CARD_CANDIDATE)) if (luhnValid(match[0])) return 'payment_card';
  return null;
}

export function containsContactInformation(text: string): boolean {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)
    || new RegExp(SINGAPORE_PHONE.source, 'i').test(text)
    || LABELED_PHONE.test(text);
}

export function redactTelemetryText(text: string): string {
  return text
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/gi, '[TOKEN_REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{16,}=*/gi, '[TOKEN_REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[TOKEN_REDACTED]')
    .replace(/\b[STFG]\d{7}[A-Z]\b/gi, '[NRIC_REDACTED]')
    .replace(CARD_CANDIDATE, candidate => luhnValid(candidate) ? '[CARD_REDACTED]' : candidate)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL_REDACTED]')
    .replace(SINGAPORE_PHONE, '[PHONE_REDACTED]')
    .replace(/\b(?:api[_ -]?key|access[_ -]?token|auth[_ -]?token|password|passcode|secret)\s*(?::|=|\bis\b)\s*\S+/gi, '[CREDENTIAL_REDACTED]');
}

function safeModelName(value: string | null | undefined): string | null {
  if (!value || value.length > 160 || detectSensitiveInput(value)) return null;
  const redacted = redactTelemetryText(value).trim();
  return redacted.includes('_REDACTED]') ? null : redacted;
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code.slice(0, 80);
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') return `provider_http_${error.status}`;
  return 'provider_error';
}

function completion(value: unknown): ChatCompletionResponse | undefined {
  return value && typeof value === 'object' && !(value instanceof ReadableStream)
    ? value as ChatCompletionResponse : undefined;
}

export function createChatTelemetry(options: {
  store?: TelemetryStore;
  interactionId: string;
  conversationId: string;
  userId: string;
  provider?: 'openrouter' | 'openai';
  model?: string;
  streaming: boolean;
  messages: Array<{ role: string; content: string }>;
  includeUserContent?: boolean;
  now?: () => number;
  isoNow?: () => string;
}) {
  const now = options.now ?? (() => performance.now());
  const isoNow = options.isoNow ?? (() => new Date().toISOString());
  let started = now();
  let startedAt = isoNow();
  let startCalled = false;
  let databaseStarted = false;
  let finalized = false;
  let outputAt: number | null = null;
  let quota: ChatQuotaSnapshot | undefined;
  let quotaResult: string | null = null;
  let requestedProvider = options.provider;
  let requestedModel = options.model;
  let tool: ToolSnapshot | null = null;
  let fallbackUsed = false;
  let failure: { status: InteractionStatus; code: string } | null = null;
  let assistantText: string | null = null;
  const providerRows: ProviderCallRecord[] = [];

  const logWrite = (operation: 'start' | 'provider_calls' | 'finalize', outcome: 'retrying' | 'retry_succeeded' | 'failed', attempt: number) => {
    try {
      console.warn('Chat telemetry write', {
        event: 'chat_telemetry_write',
        interaction_id: options.interactionId,
        operation,
        outcome,
        attempt,
      });
    } catch { /* logging must not affect the chatbot */ }
  };

  const bestEffort = async (operation: 'start' | 'provider_calls' | 'finalize', write: () => Promise<unknown>): Promise<boolean> => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await write();
        if (attempt > 1) logWrite(operation, 'retry_succeeded', attempt);
        return true;
      } catch {
        logWrite(operation, attempt === 1 ? 'retrying' : 'failed', attempt);
      }
    }
    return false;
  };

  const start = async () => {
    if (startCalled) return;
    startCalled = true;
    started = now();
    startedAt = isoNow();
    if (!options.store) return;
    databaseStarted = await bestEffort('start', () => options.store!.start({
      interaction_id: options.interactionId,
      request_id: options.interactionId,
      conversation_id: options.conversationId,
      user_id: options.userId,
      created_at: startedAt,
      status: 'started',
      provider: requestedProvider ?? null,
      requested_model: requestedModel ?? null,
      prompt_version: CHAT_PROMPT_VERSION,
      streaming: options.streaming,
      tool_called: false,
      quota_result: null,
      user_message_redacted: options.includeUserContent === false
        ? null : redactTelemetryText(options.messages.filter(message => message.role === 'user').at(-1)?.content ?? ''),
      content_expires_at: new Date(Date.parse(startedAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  };

  const setQuota = (snapshot: ChatQuotaSnapshot | undefined, result = 'allowed') => {
    quota = snapshot;
    quotaResult = ({
      CHAT_USER_BURST_LIMIT: 'user_burst_limited',
      CHAT_USER_DAILY_LIMIT: 'user_daily_limited',
      CHAT_COOLDOWN_ACTIVE: 'cooldown_active',
      CHAT_GLOBAL_CAPACITY: 'global_capacity_limited',
    } as Record<string, string>)[result] ?? result;
  };

  const setProvider = (provider: 'openrouter' | 'openai', model: string) => {
    requestedProvider = provider;
    requestedModel = safeModelName(model) ?? undefined;
  };

  const setFallback = () => { fallbackUsed = true; };
  const markFailure = (status: InteractionStatus, code: string) => { failure = { status, code }; };
  const setAssistant = (text: string) => { assistantText = redactTelemetryText(text); };
  const noteOutput = () => { if (outputAt === null) outputAt = now(); };

  const recordTool = async <T>(name: string, operation: () => Promise<T>, getCount?: (value: T) => number | null,
    isSuccess?: (value: T) => boolean): Promise<T> => {
    const toolStarted = now();
    try {
      const result = await operation();
      const success = isSuccess?.(result) ?? true;
      tool = { name, called: true, success, resultCount: getCount?.(result) ?? null, latencyMs: Math.max(0, Math.round(now() - toolStarted)) };
      return result;
    } catch (error) {
      tool = { name, called: true, success: false, resultCount: null, latencyMs: Math.max(0, Math.round(now() - toolStarted)) };
      failure = { status: 'tool_error', code: errorCode(error) };
      throw error;
    }
  };

  const providerClient = (client: OpenRouterClient, reservePermit: () => Promise<void>): OpenRouterClient => ({
    chat: { completions: { create: async (params: ChatCompletionCreateParams) => {
      try { await reservePermit(); } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') quotaResult = 'global_capacity_limited';
        throw error;
      }
      const callStarted = now();
      const callStartedAt = isoNow();
      try {
        const result = await client.chat.completions.create(params);
        const response = completion(result);
        const usage = response?.usage;
        providerRows.push({
          interaction_id: options.interactionId,
          sequence: providerRows.length + 1,
          provider: requestedProvider ?? 'openrouter',
          requested_model: safeModelName(params.model) ?? 'unknown',
          resolved_model: safeModelName(response?.model),
          started_at: callStartedAt,
          completed_at: isoNow(),
          latency_ms: Math.max(0, Math.round(now() - callStarted)),
          input_token_count: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
          output_token_count: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null,
          total_token_count: typeof usage?.total_tokens === 'number' ? usage.total_tokens : null,
          status: 'success',
          error_code: null,
        });
        return result;
      } catch (error) {
        failure = { status: 'provider_error', code: errorCode(error) };
        providerRows.push({
          interaction_id: options.interactionId,
          sequence: providerRows.length + 1,
          provider: requestedProvider ?? 'openrouter',
          requested_model: safeModelName(params.model) ?? 'unknown',
          resolved_model: null,
          started_at: callStartedAt,
          completed_at: isoNow(),
          latency_ms: Math.max(0, Math.round(now() - callStarted)),
          input_token_count: null,
          output_token_count: null,
          total_token_count: null,
          status: 'provider_error',
          error_code: errorCode(error),
        });
        throw error;
      }
    } } },
  });

  const finish = async (final: InteractionFinal) => {
    if (finalized) return;
    finalized = true;
    if (!options.store || !databaseStarted) return;
    const providerLatency = providerRows.reduce((total, call) => total + call.latency_ms, 0);
    const known = (field: 'input_token_count' | 'output_token_count' | 'total_token_count') => {
      const values = providerRows.map(row => row[field]);
      return values.length && values.every(value => value !== null) ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
    };
    const lastResolved = [...providerRows].reverse().find(row => row.resolved_model)?.resolved_model ?? null;
    const completedAt = isoNow();
    const finalStatus = final.status === 'success' && failure && !fallbackUsed ? failure.status : final.status;
    if (providerRows.length) await bestEffort('provider_calls', () => options.store!.providerCalls(providerRows));
    await bestEffort('finalize', () => options.store!.finish(options.interactionId, {
        completed_at: completedAt,
        status: finalStatus,
        error_code: final.error_code ?? (finalStatus !== 'success' ? failure?.code ?? null : null),
        resolved_model: lastResolved,
        provider: requestedProvider ?? null,
        requested_model: requestedModel ?? null,
        tool_name: tool?.name ?? null,
        tool_called: tool?.called ?? false,
        tool_success: tool?.success ?? null,
        tool_result_count: tool?.resultCount ?? null,
        input_token_count: known('input_token_count'),
        output_token_count: known('output_token_count'),
        total_token_count: known('total_token_count'),
        total_latency_ms: Math.max(0, Math.round(now() - started)),
        provider_latency_ms: providerRows.length ? providerLatency : null,
        tool_latency_ms: tool?.called ? tool.latencyMs : null,
        first_output_event_ms: outputAt === null ? null : Math.max(0, Math.round(outputAt - started)),
        quota_tier: quota?.tier ?? null,
        quota_result: quotaResult ?? 'not_reserved',
        fallback_used: fallbackUsed,
        user_message_redacted: finalStatus === 'success' ? undefined : null,
        assistant_message_redacted: finalStatus === 'success' && options.includeUserContent !== false
          ? (assistantText ?? (final.assistant_message ? redactTelemetryText(final.assistant_message) : null)) : null,
      }));
  };

  return { start, setQuota, setProvider, setFallback, markFailure, setAssistant, noteOutput, recordTool, providerClient,
    isStarted: () => startCalled, feedbackEligible: () => databaseStarted && (!failure || fallbackUsed), finish };
}

export function createTelemetryStore(client: { from: (table: string) => any }): TelemetryStore {
  return {
    async start(record) {
      const { error } = await client.from('chat_interactions').upsert(record, { onConflict: 'interaction_id' });
      if (error) throw error;
    },
    async finish(interactionId, record) {
      const { error } = await client.from('chat_interactions').update(record).eq('interaction_id', interactionId);
      if (error) throw error;
    },
    async providerCalls(records) {
      const { error } = await client.from('chat_provider_calls').upsert(records, { onConflict: 'interaction_id,sequence' });
      if (error) throw error;
    },
  };
}

export function observeChatStream(stream: ReadableStream<Uint8Array>, telemetry: ReturnType<typeof createChatTelemetry>): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let complete = false;
  let streamFailure: { status: InteractionStatus; code: string } | null = null;
  const process = (event: string) => {
    const kind = event.split(/\r?\n/).find(line => line.startsWith('event:'))?.slice(6).trim();
    if (kind === 'error') streamFailure = { status: 'internal_error', code: 'stream_error' };
    const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    try {
      const payload = JSON.parse(data);
      const text = payload.choices?.[0]?.delta?.content;
      if (typeof text === 'string' && text) telemetry.noteOutput();
    } catch { /* non-JSON SSE events do not contribute output timing */ }
  };
  const finalize = async (status: InteractionStatus, errorCode?: string) => {
    if (complete) return;
    complete = true;
    await telemetry.finish({ status: streamFailure?.status ?? status, error_code: streamFailure?.code ?? errorCode });
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? '';
          events.forEach(process);
          controller.enqueue(value);
        }
        if (done) {
          if (buffer.trim()) process(buffer);
          await finalize('success');
          controller.close();
        }
      } catch {
        await finalize('internal_error', 'stream_error');
        controller.error(new Error('Chat response interrupted'));
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined);
      await finalize('aborted', 'client_cancelled');
    },
  });
}
