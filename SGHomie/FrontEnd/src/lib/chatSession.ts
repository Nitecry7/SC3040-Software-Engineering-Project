import type { ListingSearchResult, SellerContext, SellerDraftCard } from './chat.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  recommendations?: ListingSearchResult;
  draft?: SellerDraftCard;
}

// Only temporary conversation data belongs here. No auth or persistent storage.
export function emptyChatSession() {
  return { messages: [] as ChatMessage[], input: '', search: undefined as ListingSearchResult['filters'] | undefined,
    seller: undefined as SellerContext | undefined, loading: false, followStream: true };
}

export function createChatLifecycle() {
  let generation = 0;
  let active: { generation: number; controller: AbortController } | undefined;
  return {
    begin() {
      if (active) return undefined;
      active = { generation, controller: new AbortController() };
      return active;
    },
    isCurrent(request: { generation: number; controller: AbortController }) {
      return active === request && request.generation === generation && !request.controller.signal.aborted;
    },
    finish(request: { generation: number; controller: AbortController }) {
      if (active !== request || request.generation !== generation) return false;
      active = undefined;
      return true;
    },
    reset() {
      generation++;
      const previous = active;
      active = undefined;
      previous?.controller.abort();
      return emptyChatSession();
    },
  };
}
