// Import React and its hooks for state management, referencing, and side-effects.
import React, { useState, useRef, useEffect } from 'react';
// Import icons from the lucide-react library to use in the UI.
import { MessageCircle, X, Send, Maximize2, Minimize2, GripVertical, MoveDiagonal2 } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
// Import the Supabase client for making API requests.
import { chatbotSupabase, supabase } from '../lib/supabase';
import { BUY_MESSAGE, chatFailureText, consumeChatStream, type ListingSearchResult, type SellerContext, type SellerDraftCard } from '../lib/chat';
import ListingRecommendations from './ListingRecommendations';
import SellerDraft from './SellerDraft';
import { useAuth } from '../contexts/AuthContext';
import ChatMarkdown from './ChatMarkdown';
import useChatWindow from '../hooks/useChatWindow';
import { LAUNCHER_SIZE, WINDOW_MARGIN } from '../lib/chatWindow';
import './Chatbot.css';

// Define a TypeScript interface for a chat message.
// Each message has a 'role' (either 'user' or 'assistant')
// and a 'content' string.
interface Message {
  role: 'user' | 'assistant';
  content: string;
  recommendations?: ListingSearchResult;
  draft?: SellerDraftCard;
}

// Keep the initial chatbot menu focused on the two supported journeys.
const SUGGESTED_PROMPTS = [
  { label: "Buy", message: BUY_MESSAGE, intent: 'buy' as const },
  { label: "Sell", message: "I want to sell my unit", intent: 'sell' as const },
];

const MAX_HISTORY_MESSAGES = 20;

// Main functional component for the Chatbot.
const Chatbot: React.FC = () => {
  const { user } = useAuth();
  // State to manage whether the chat window is open.
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const chatWindow = useChatWindow();
  // State to manage the current message input by the user.
  const [message, setMessage] = useState('');
  // State to store the list of messages exchanged in the chat.
  const [messages, setMessages] = useState<Message[]>([]);
  // State to indicate if the chatbot is waiting for a response (i.e. loading state).
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const hasOpenedRef = useRef(false);
  const followStreamRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const searchContextRef = useRef<ListingSearchResult['filters']>();
  const sellerContextRef = useRef<SellerContext>();
  const currentUserIdRef = useRef(user?.id);

  useEffect(() => {
    // Never carry another account's listing intake or private details forward.
    currentUserIdRef.current = user?.id;
    sellerContextRef.current = undefined;
    searchContextRef.current = undefined;
    setMessages([]);
  }, [user?.id]);

  useEffect(() => {
    const container = messagesRef.current;
    if (container && followStreamRef.current) container.scrollTop = container.scrollHeight;
  }, [messages, isOpen, chatWindow.mode]);

  useEffect(() => {
    if (isOpen) {
      hasOpenedRef.current = true;
      moveButtonRef.current?.focus({ preventScroll: true });
    } else if (hasOpenedRef.current) {
      launcherRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isClosing) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    const timer = window.setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [isClosing]);

  const updateLastAssistantMessage = (content: string) => {
    setMessages(prev => {
      const next = [...prev];
      const lastMessage = next[next.length - 1];

      if (!lastMessage || lastMessage.role !== 'assistant') {
        next.push({ role: 'assistant', content });
      } else {
        next[next.length - 1] = { ...lastMessage, content };
      }

      return next;
    });
  };

  const sendMessage = async (value: string, intent?: 'buy' | 'sell') => {
    const userMessage = value.trim();
    if (!userMessage || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    const requestUserId = user?.id;
    const isCurrentAccount = () => currentUserIdRef.current === requestUserId;
    followStreamRef.current = true;
    if (intent) {
      searchContextRef.current = undefined;
      sellerContextRef.current = undefined;
    }

    // Clear the input field.
    setMessage('');

    // Keep the current message within the backend's history limit.
    const nextMessages = [...messages, { role: 'user' as const, content: userMessage }];
    const requestMessages = [
      ...messages.filter(msg => msg.content.trim()).slice(-(MAX_HISTORY_MESSAGES - 1)).map(({ role, content }) => ({
        role, content: content.slice(0, 4000),
      })),
      { role: 'user' as const, content: userMessage },
    ];
    // Add the user's message to the messages state.
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    // Set the loading state to true while waiting for the assistant response.
    setIsLoading(true);

    let hasRecommendations = false;
    let hasSavedDraft = false;
    try {
      // The chatbot Edge Function uses the same session to enforce the
      // login/seller gates and to create a draft owned by the current seller.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!isCurrentAccount()) return;
      chatbotSupabase.functions.setAuth(sessionData.session?.access_token ?? '');

      // Ask the Supabase Edge Function for an OpenAI-style streamed response.
      const { data, error } = await chatbotSupabase.functions.invoke<Response>('chatbot', {
        body: {
          messages: requestMessages,
          stream: true,
          ...(intent ? { intent } : {}),
          ...(searchContextRef.current ? { search_context: searchContextRef.current } : {}),
          ...(sellerContextRef.current ? { seller_context: sellerContextRef.current } : {}),
        },
      });

      // If an error occurs during the request, throw the error.
      if (error) throw error;
      if (!(data instanceof Response)) {
        throw new Error('The chatbot returned an invalid response');
      }

      await consumeChatStream(data, content => {
        if (isCurrentAccount()) updateLastAssistantMessage(content);
      }, (recommendations) => {
        if (!isCurrentAccount()) return;
        hasRecommendations = recommendations.listings.length > 0;
        searchContextRef.current = recommendations.filters;
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, recommendations };
          return next;
        });
      }, (event) => {
        if (!isCurrentAccount()) return;
        sellerContextRef.current = event.context ?? undefined;
        searchContextRef.current = undefined;
        if (event.draft) {
          hasSavedDraft = true;
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') next[next.length - 1] = { ...last, draft: event.draft };
            return next;
          });
          window.dispatchEvent(new CustomEvent('seller-dashboard-refresh'));
        }
      });
    } catch (error) {
      if (!isCurrentAccount()) return;
      let failureText = chatFailureText();
      // Surface the Edge Function status and response body in the browser
      // console during local development to help diagnose backend failures.
      if (error instanceof FunctionsHttpError) {
        const responseBody = await error.context.clone().text().catch(() => '');
        let parsedBody: unknown = responseBody;
        try {
          parsedBody = JSON.parse(responseBody);
        } catch {
          // Keep the raw response text when the function did not return JSON.
        }
        const code = typeof parsedBody === 'object' && parsedBody !== null && 'code' in parsedBody && typeof parsedBody.code === 'string' ? parsedBody.code : undefined;
        failureText = chatFailureText(error.context.status, code);
        if (import.meta.env.DEV) console.error('Chatbot Edge Function failed:', {
          status: error.context.status,
          statusText: error.context.statusText,
          body: parsedBody,
        });
      } else {
        console.error('Error getting response:', error);
      }
      updateLastAssistantMessage(hasSavedDraft
        ? 'Your draft is saved. Click the draft card below to continue, or open the [Seller Dashboard](/seller).'
        : hasRecommendations
        ? "I couldn't finish the explanation. You can open the matching listings below or try again."
        : failureText);
    } finally {
      // Turn off the loading indicator when the request is complete.
      requestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  // Event handler for form submission (i.e., when the user sends a message).
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(message);
  };

  // Handler for when a suggested prompt is clicked.
  const handlePromptClick = (prompt: string) => {
    void sendMessage(prompt, SUGGESTED_PROMPTS.find(item => item.message === prompt)?.intent);
  };

  const minimise = () => {
    if (!isOpen || isClosing) return;
    setIsClosing(true);
  };

  const handleListingOpen: React.MouseEventHandler<HTMLAnchorElement> = event => {
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) minimise();
  };

  return (
    <>
      {!isOpen && (
        <button
          ref={launcherRef}
          onClick={() => setIsOpen(true)}
          aria-label="Open SG Homie chat"
          aria-expanded={isOpen}
          title="Open chat"
          className="chat-launcher fixed z-50 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          style={{ right: WINDOW_MARGIN, bottom: WINDOW_MARGIN, width: LAUNCHER_SIZE, height: LAUNCHER_SIZE }}
        >
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
          {isLoading && <span className="absolute right-0 top-0 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-amber-400" />}
        </button>
      )}
      {isOpen && (
        <section
          aria-label="SG Homie chat window"
          className={`chat-window fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl ${chatWindow.interacting ? 'select-none' : ''}`}
          data-closing={isClosing}
          data-interacting={chatWindow.interacting}
          style={{ left: chatWindow.bounds.x, top: chatWindow.bounds.y, width: chatWindow.bounds.width, height: chatWindow.bounds.height }}
          onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); minimise(); } }}
        >
          <header className="flex shrink-0 items-center gap-1 bg-blue-600 px-3 py-2 text-white">
            <button
              ref={moveButtonRef}
              {...chatWindow.gestureProps('window')}
              type="button"
              aria-label="Move chat window"
              title="Drag to move · Arrow keys move · Shift moves faster"
              className="flex min-w-0 flex-1 touch-none cursor-grab items-center gap-2 rounded-lg py-1.5 text-left active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <GripVertical className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">SG Homie Assistant</span>
                <span className="block text-[11px] text-blue-100">{chatWindow.mode === 'compact' ? 'Compact chat' : 'Expanded chat'}</span>
              </span>
            </button>
            <button type="button"
              onClick={() => chatWindow.setMode(chatWindow.mode === 'compact' ? 'expanded' : 'compact')}
              aria-label={chatWindow.mode === 'compact' ? 'Expand chat' : 'Use compact chat'}
              title={chatWindow.mode === 'compact' ? 'Expand chat' : 'Use compact chat'}
              className="rounded-lg p-2 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              {chatWindow.mode === 'compact' ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
            <button type="button" onClick={minimise} aria-label="Close chat" title="Close chat"
              className="rounded-lg p-2 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
            onScroll={event => {
              const container = event.currentTarget;
              followStreamRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
            }}>
            <div className={`mx-auto space-y-4 ${chatWindow.mode === 'expanded' ? 'max-w-3xl' : ''}`}>
              {messages.length === 0 && (
                <div className="space-y-4 py-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><MessageCircle className="h-6 w-6" /></div>
                  <p className="text-center font-medium text-gray-900">How can I help with your home?</p>
                  <p className="text-center text-sm text-gray-500">Choose Buy or Sell, or ask a question.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUGGESTED_PROMPTS.map(prompt => (
                      <button key={prompt.label} onClick={() => handlePromptClick(prompt.message)} disabled={isLoading}
                        className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">{prompt.label}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${msg.recommendations || msg.draft ? 'w-full' : 'max-w-[92%]'} min-w-0 rounded-2xl px-3 py-2.5 text-sm ${msg.role === 'user' ? 'chat-user-message bg-blue-600 text-white' : 'bg-gray-50 text-gray-800'}`}>
                    {msg.content && <ChatMarkdown content={msg.content} onListingOpen={handleListingOpen} />}
                    {msg.recommendations && <ListingRecommendations result={msg.recommendations} compact={chatWindow.mode === 'compact'} onListingOpen={handleListingOpen} />}
                    {msg.draft && <SellerDraft draft={msg.draft} onListingOpen={handleListingOpen} />}
                    {!msg.content && !msg.recommendations && isLoading && index === messages.length - 1 && <span className="text-gray-500">Thinking…</span>}
                  </div>
                </div>
              ))}
              {isLoading && <p role="status" className="text-xs text-gray-500">SG Homie is responding…</p>}
            </div>
          </div>
          <form onSubmit={handleSubmit} className="shrink-0 border-t border-gray-100 bg-white px-3 pb-3 pt-3">
            <div className="flex gap-2">
              <input type="text" value={message} onChange={event => setMessage(event.target.value)}
                placeholder="Type your message…" aria-label="Message SG Homie Assistant" maxLength={4000}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" disabled={isLoading} />
              <button type="submit" aria-label="Send message" disabled={isLoading || !message.trim()}
                className="rounded-xl bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
              <span>Drag the header to move</span>
              <button {...chatWindow.gestureProps('resize')} type="button" aria-label="Resize chat window"
                title="Drag to resize · Arrow keys resize · Shift resizes faster"
                className="-mb-1 -mr-1 flex h-5 w-5 touch-none cursor-nwse-resize items-center justify-center rounded text-gray-400 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                <MoveDiagonal2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
};

export default Chatbot;
