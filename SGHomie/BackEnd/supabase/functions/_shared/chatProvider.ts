import { createOpenRouterClient, type OpenRouterClient } from './openrouter.ts';
import { createOpenAIClient } from './openai.ts';

export class ChatProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatProviderConfigError';
  }
}

export function createChatProvider(
  getEnv: (name: string) => string | undefined,
  origin?: string,
): { client: OpenRouterClient; model: string; provider: 'openrouter' | 'openai' } {
  const provider = getEnv('CHAT_PROVIDER')?.trim().toLowerCase() || 'openrouter';
  if (provider !== 'openrouter' && provider !== 'openai') {
    throw new ChatProviderConfigError('CHAT_PROVIDER must be openrouter or openai');
  }
  const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'OPENROUTER_API_KEY';
  const apiKey = getEnv(keyName)?.trim();
  if (!apiKey) throw new ChatProviderConfigError(`${keyName} is not configured`);

  if (provider === 'openai') {
    return { provider, model: getEnv('OPENAI_MODEL')?.trim() || 'gpt-6-luna',
      client: createOpenAIClient({ apiKey }) };
  }
  return { provider, model: getEnv('OPENROUTER_MODEL')?.trim() || 'openrouter/free',
    client: createOpenRouterClient({ apiKey,
      httpReferer: getEnv('OPENROUTER_SITE_URL') ?? origin,
      appTitle: getEnv('OPENROUTER_SITE_NAME') ?? 'SG Homie',
    }) };
}
