import type { OpenRouterClient } from '../_shared/openrouter.ts';

export type ChatQuotaSnapshot = {
  tier: 'standard' | 'tester' | 'privileged';
  minute_limit: number;
  minute_remaining: number;
  daily_limit: number | null;
  daily_remaining: number | null;
  daily_reset_at: string;
  cooldown_until: string | null;
};

type RpcClient = {
  rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>;
};

type RpcReservation = {
  allowed?: unknown;
  code?: unknown;
  retry_after_seconds?: unknown;
  retry_at?: unknown;
  quota?: unknown;
};

export class ChatQuotaError extends Error {
  readonly status = 429;
  readonly code: string;
  readonly retryAfterSeconds: number | undefined;
  readonly retryAt: string | undefined;
  readonly quota: ChatQuotaSnapshot | undefined;
  constructor(
    code: string,
    retryAfterSeconds: number | undefined,
    retryAt: string | undefined,
    quota?: ChatQuotaSnapshot,
  ) {
    super(code);
    this.name = 'ChatQuotaError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.retryAt = retryAt;
    this.quota = quota;
  }
}

export class ChatQuotaUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super('Chat quota controls are temporarily unavailable');
    this.name = 'ChatQuotaUnavailableError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseQuota(value: unknown): ChatQuotaSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const tier = value.tier;
  if (tier !== 'standard' && tier !== 'tester' && tier !== 'privileged') return undefined;
  if (typeof value.minute_limit !== 'number' || typeof value.minute_remaining !== 'number'
    || (value.daily_limit !== null && typeof value.daily_limit !== 'number')
    || (value.daily_remaining !== null && typeof value.daily_remaining !== 'number')
    || typeof value.daily_reset_at !== 'string'
    || (value.cooldown_until !== null && typeof value.cooldown_until !== 'string')) return undefined;
  return value as ChatQuotaSnapshot;
}

async function reserve(client: RpcClient, rpcName: string): Promise<{ quota?: ChatQuotaSnapshot }> {
  let response: { data: unknown; error: unknown };
  try {
    response = await client.rpc(rpcName);
  } catch {
    throw new ChatQuotaUnavailableError();
  }
  if (response.error || !isRecord(response.data)) throw new ChatQuotaUnavailableError();

  const data = response.data as RpcReservation;
  const quota = parseQuota(data.quota);
  if (data.allowed !== true) {
    if (typeof data.code !== 'string') throw new ChatQuotaUnavailableError();
    const retryAfterSeconds = typeof data.retry_after_seconds === 'number' ? data.retry_after_seconds : undefined;
    const retryAt = typeof data.retry_at === 'string' ? data.retry_at : undefined;
    throw new ChatQuotaError(data.code, retryAfterSeconds, retryAt, quota);
  }
  return { quota };
}

export async function reserveUserInteraction(client: RpcClient): Promise<ChatQuotaSnapshot> {
  const result = await reserve(client, 'reserve_chat_user_interaction');
  if (!result.quota) throw new ChatQuotaUnavailableError();
  return result.quota;
}

export async function reserveProviderCapacity(client: RpcClient, quota?: ChatQuotaSnapshot): Promise<void> {
  try {
    await reserve(client, 'reserve_chat_provider_call');
  } catch (error) {
    if (error instanceof ChatQuotaError) {
      throw new ChatQuotaError(error.code, error.retryAfterSeconds, error.retryAt, quota);
    }
    throw error;
  }
}

export function withProviderCapacity(
  client: OpenRouterClient,
  reservePermit: () => Promise<void>,
): OpenRouterClient {
  return {
    chat: {
      completions: {
        create: async params => {
          await reservePermit();
          return await client.chat.completions.create(params);
        },
      },
    },
  };
}
