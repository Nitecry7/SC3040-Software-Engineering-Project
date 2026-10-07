import {
  createOpenRouterClient, OpenRouterError,
  type ChatCompletionCreateParams, type OpenRouterClient,
} from './openrouter.ts';

export class OpenAIError extends OpenRouterError {
  constructor(message: string, status: number, responseBody?: unknown) {
    super(message, status, responseBody);
    this.name = 'OpenAIError';
  }
}

interface OpenAIClientOptions {
  apiKey: string;
  timeoutMs?: number;
}

// OpenAI and OpenRouter share the Chat Completions response/stream contract.
// Reuse the existing HTTP transport without altering its OpenRouter behavior.
export function createOpenAIClient(options: OpenAIClientOptions): OpenRouterClient {
  const transport = createOpenRouterClient({ ...options, baseURL: 'https://api.openai.com/v1' });
  return { chat: { completions: { create: async (params: ChatCompletionCreateParams) => {
    const { provider: _provider, max_tokens, ...request } = params;
    if (max_tokens !== undefined && request.max_completion_tokens === undefined) {
      request.max_completion_tokens = max_tokens;
    }
    // GPT-6 Luna/Sol permit Chat Completions function calling only without reasoning.
    // This is transport configuration; prompts, history and tool schemas pass unchanged.
    if (/^gpt-6-(?:luna|sol)(?:-|$)/.test(request.model)) {
      request.reasoning_effort = 'none';
    } else if (/^gpt-6(?:\.|-)/.test(request.model) && request.tools !== undefined) {
      throw new OpenAIError('This GPT-6 model requires Responses API for tools. Use gpt-6-luna or gpt-6-sol with this Chat Completions adapter.', 400);
    } else if (/^(?:gpt-5(?:\.|-|$)|o[134](?:-|$))/.test(request.model)) {
      // Reasoning models may reject sampling parameters inherited from OpenRouter.
      delete request.temperature;
      delete request.top_p;
    }
    try {
      return await transport.chat.completions.create(request);
    } catch (error) {
      if (error instanceof OpenRouterError) {
        throw new OpenAIError(error.message.replace(/^OpenRouter/, 'OpenAI'), error.status, error.responseBody);
      }
      throw error;
    }
  } } } };
}
