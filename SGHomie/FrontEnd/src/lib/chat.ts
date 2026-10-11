import type { ListingSearchResult } from '../../../BackEnd/supabase/functions/_shared/listings.ts';
import { visibleAssistantText } from '../../../BackEnd/supabase/functions/_shared/chatOutput.ts';
import { parseSellerContext, type SellerFlowEvent } from '../../../BackEnd/supabase/functions/_shared/sellerFlow.ts';
export type { SellerContext, SellerDraftCard, SellerFlowEvent } from '../../../BackEnd/supabase/functions/_shared/sellerFlow.ts';
export type { ListingSearchResult } from '../../../BackEnd/supabase/functions/_shared/listings.ts';

export const BUY_MESSAGE = 'I want to buy a house';

export function chatFailureText(status?: number, code?: string): string {
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
): Promise<string> {
  if (!response.body) throw new Error('The chatbot returned an empty response stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let completed = false;
  const processEvent = (event: string) => {
    const lines = event.split(/\r?\n/);
    const kind = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!data) return;
    if (data === '[DONE]') { completed = true; return; }
    const payload = JSON.parse(data);
    if (kind === 'error' || payload.error) throw new Error('The chatbot response was interrupted');
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
    while (!completed) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      events.forEach(processEvent);
      if (done) { if (buffer.trim()) processEvent(buffer); break; }
    }
    const visible = visibleAssistantText(content);
    if (!completed || !visible.trim()) throw new Error('The chatbot returned an incomplete response');
    return visible;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
