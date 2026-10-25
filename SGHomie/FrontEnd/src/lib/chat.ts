import type { ListingSearchResult } from '../../../BackEnd/supabase/functions/_shared/listings.ts';
import { visibleAssistantText } from '../../../BackEnd/supabase/functions/_shared/chatOutput.ts';
import { parseSellerContext, type SellerFlowEvent } from '../../../BackEnd/supabase/functions/_shared/sellerFlow.ts';
export type { SellerContext, SellerDraftCard, SellerFlowEvent } from '../../../BackEnd/supabase/functions/_shared/sellerFlow.ts';
export type { ListingSearchResult } from '../../../BackEnd/supabase/functions/_shared/listings.ts';

export type ChatInteractionMetadata = { interaction_id: string; request_id: string; conversation_id: string; feedback_eligible: boolean };

export const BUY_MESSAGE = 'I want to buy a house';

type ChatFailurePayload = {
  retry_after_seconds?: unknown;
  retry_at?: unknown;
  quota?: { daily_reset_at?: unknown };
};

function singaporeTime(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', minute: '2-digit' });
}

export function chatFailureText(status?: number, code?: string, payload?: ChatFailurePayload): string {
  if (code === 'CHAT_USER_BURST_LIMIT') {
    const seconds = typeof payload?.retry_after_seconds === 'number' && Number.isFinite(payload.retry_after_seconds)
      ? Math.max(1, Math.ceil(payload.retry_after_seconds)) : undefined;
    return `You're sending messages a little too quickly. Please wait${seconds ? ` ${seconds} seconds` : ''} and try again.`;
  }
  if (code === 'CHAT_USER_DAILY_LIMIT') {
    const reset = singaporeTime(payload?.quota?.daily_reset_at) ?? singaporeTime(payload?.retry_at);
    return `You've reached today's SG Homie AI allowance.${reset ? ` Your AI chat access resets at ${reset} Singapore time.` : ' Your AI chat access resets at the next Singapore day.'}`;
  }
  if (code === 'CHAT_COOLDOWN_ACTIVE') {
    const retry = singaporeTime(payload?.retry_at);
    return `AI chat has been temporarily paused for this account because of repeated rapid requests.${retry ? ` You can try again at ${retry}.` : ' Please try again later.'}`;
  }
  if (code === 'CHAT_GLOBAL_CAPACITY') {
    const retry = singaporeTime(payload?.retry_at);
    return `SG Homie's AI service has reached its current capacity.${retry ? ` Please try again at ${retry}.` : ' Please try again later.'} The rest of SG Homie remains available.`;
  }
  if (code === 'provider_rate_limited') return 'The AI service has reached its request limit. You can use the [listing search](/search) to browse homes while the chat service recovers.';
  if (status === 503) return 'The chat service is temporarily unavailable. You can still browse the [listing search](/search), or try again later.';
  return "I'm sorry, I'm having trouble responding right now. Please try again later.";
}

// Supports both the existing sell-flow SSE and buyer recommendation metadata.
export async function consumeChatStream(
  response: Response,
  onText: (content: string) => void,
  onRecommendations: (result: ListingSearchResult) => void,
  onSellerFlow?: (event: SellerFlowEvent) => void,
  signal?: AbortSignal,
  onInteraction?: (metadata: ChatInteractionMetadata) => void,
): Promise<string> {
  signal?.throwIfAborted();
  if (!response.body) throw new Error('The chatbot returned an empty response stream');
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', cancel, { once: true });
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let completed = false;
  let streamDone = false;
  const processEvent = (event: string) => {
    const lines = event.split(/\r?\n/);
    const kind = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!data) return;
    if (data === '[DONE]') { completed = true; return; }
    const payload = JSON.parse(data);
    if (kind === 'error' || payload.error) throw new Error('The chatbot response was interrupted');
    if (kind === 'interaction') {
      if (typeof payload.interaction_id === 'string' && typeof payload.request_id === 'string'
        && typeof payload.conversation_id === 'string' && typeof payload.feedback_eligible === 'boolean') onInteraction?.(payload as ChatInteractionMetadata);
      return;
    }
    if (kind === 'recommendations') { onRecommendations(payload as ListingSearchResult); return; }
    if (kind === 'seller_flow') {
      const context = payload.context === null ? null : parseSellerContext(payload.context);
      const draft = payload.draft;
      if (draft && (typeof draft.id !== 'string' || draft.id !== context?.draft_id
        || typeof draft.title !== 'string' || typeof draft.location !== 'string'
        || (draft.price !== null && (typeof draft.price !== 'number' || !Number.isFinite(draft.price) || draft.price <= 0))
        || !Array.isArray(draft.missing_fields) || !draft.missing_fields.every((field: unknown) => typeof field === 'string')
        || context?.stage !== 'complete')) throw new Error('Invalid saved draft response');
      onSellerFlow?.({ context, ...(draft ? { draft } : {}) });
      return;
    }
    const delta = payload.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) { content += delta; onText(visibleAssistantText(content)); }
  };
  try {
    while (!streamDone) {
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      events.forEach(processEvent);
      if (done) { if (buffer.trim()) processEvent(buffer); streamDone = true; }
    }
    const visible = visibleAssistantText(content);
    if (!completed || !visible.trim()) throw new Error('The chatbot returned an incomplete response');
    return visible;
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
