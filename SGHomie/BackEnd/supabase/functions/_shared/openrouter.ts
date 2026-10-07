const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

export type ChatCompletionRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatCompletionMessageParam {
  role: ChatCompletionRole;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ChatCompletionToolCall[];
}

export interface ChatCompletionToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatCompletionCreateParams {
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    refusal?: string | null;
    tool_calls?: ChatCompletionToolCall[];
  };
  finish_reason: string | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  [key: string]: unknown;
}

export type ChatCompletionStream = ReadableStream<Uint8Array>;

export class OpenRouterError extends Error {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(message: string, status: number, responseBody?: unknown) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

interface OpenRouterClientOptions {
  apiKey: string;
  baseURL?: string;
  httpReferer?: string;
  appTitle?: string;
  timeoutMs?: number;
}

export interface OpenRouterClient {
  chat: {
    completions: {
      create: (params: ChatCompletionCreateParams) => Promise<ChatCompletionResponse | ChatCompletionStream>;
    };
  };
}

function getErrorMessage(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return 'OpenRouter request failed';
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;

  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }

  return 'OpenRouter request failed';
}

function isChatCompletionResponse(payload: unknown): payload is ChatCompletionResponse {
  if (typeof payload !== 'object' || payload === null) return false;

  const response = payload as Partial<ChatCompletionResponse>;
  return (
    typeof response.id === 'string' &&
    typeof response.model === 'string' &&
    Array.isArray(response.choices)
  );
}

export function createOpenRouterClient(options: OpenRouterClientOptions): OpenRouterClient {
  const baseURL = (options.baseURL ?? OPENROUTER_API_URL).replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? 30_000;

  return {
    chat: {
      completions: {
        create: async (params) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const headers: Record<string, string> = {
              Authorization: `Bearer ${options.apiKey}`,
              Accept: params.stream ? 'text/event-stream' : 'application/json',
              'Content-Type': 'application/json',
            };

            if (options.httpReferer) {
              headers['HTTP-Referer'] = options.httpReferer;
            }

            if (options.appTitle) {
              headers['X-Title'] = options.appTitle;
            }

            const response = await fetch(`${baseURL}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify(params),
              signal: controller.signal,
            });

            if (!response.ok) {
              let payload: unknown;
              try {
                payload = await response.json();
              } catch {
                payload = undefined;
              }

              throw new OpenRouterError(
                getErrorMessage(payload),
                response.status,
                payload,
              );
            }

            if (params.stream) {
              if (!response.body) {
                throw new OpenRouterError('OpenRouter returned an empty stream', 502);
              }

              return response.body;
            }

            let payload: unknown;
            try {
              payload = await response.json();
            } catch {
              payload = undefined;
            }

            if (!isChatCompletionResponse(payload)) {
              throw new OpenRouterError(
                'OpenRouter returned an unexpected response',
                502,
                payload,
              );
            }

            return payload;
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              throw new OpenRouterError('OpenRouter request timed out', 504);
            }
            throw error;
          } finally {
            clearTimeout(timeoutId);
          }
        },
      },
    },
  };
}

export function getAssistantText(completion: ChatCompletionResponse): string {
  const content = completion.choices[0]?.message.content;

  if (typeof content !== 'string' || content.trim() === '') {
    throw new OpenRouterError('The model returned no text', 502, completion);
  }

  return content.trim();
}
