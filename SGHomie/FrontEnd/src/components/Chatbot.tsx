// Import React and its hooks for state management, referencing, and side-effects.
import React, { useState, useRef, useEffect } from 'react';
// Import icons from the lucide-react library to use in the UI.
import { MessageCircle, X, Send, ChevronDown, ChevronUp } from 'lucide-react';
// Import ReactMarkdown to render Markdown content in the chat messages.
import ReactMarkdown from 'react-markdown';
// Import the Supabase client for making API requests.
import { chatbotSupabase, supabase } from '../lib/supabase';

// Define a TypeScript interface for a chat message.
// Each message has a 'role' (either 'user' or 'assistant')
// and a 'content' string.
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
  }>;
}

// Keep the initial chatbot menu focused on the two supported journeys.
const SUGGESTED_PROMPTS = [
  { label: "Buy", message: "I want to buy a property" },
  { label: "Sell", message: "I want to sell my unit" },
];

const MAX_HISTORY_MESSAGES = 20;

// Main functional component for the Chatbot.
const Chatbot: React.FC = () => {
  // State to manage whether the chat window is open.
  const [isOpen, setIsOpen] = useState(false);
  // State to manage if the chat window is minimized.
  const [isMinimized, setIsMinimized] = useState(true);
  // State to manage the current message input by the user.
  const [message, setMessage] = useState('');
  // State to store the list of messages exchanged in the chat.
  const [messages, setMessages] = useState<Message[]>([]);
  // State to indicate if the chatbot is waiting for a response (i.e. loading state).
  const [isLoading, setIsLoading] = useState(false);
  // Reference to the end of the messages list, used to scroll into view.
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Reference to the chatbox container (useful for any future adjustments).
  const chatboxRef = useRef<HTMLDivElement>(null);

  // useEffect hook to automatically scroll the chat view to the bottom when a new message is added.
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  const streamAssistantResponse = async (response: Response): Promise<string> => {
    if (!response.body) {
      throw new Error('The chatbot returned an empty response stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantContent = '';
    let streamComplete = false;

    const processEvent = (event: string) => {
      const data = event
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n')
        .trim();

      if (!data || data === '[DONE]') return;

      const chunk = JSON.parse(data) as ChatCompletionChunk;
      const content = chunk.choices?.[0]?.delta?.content;

      if (typeof content === 'string' && content !== '') {
        assistantContent += content;
        updateLastAssistantMessage(assistantContent);
      }
    };

    while (!streamComplete) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';
      events.forEach(processEvent);

      streamComplete = done;
    }

    if (buffer.trim()) processEvent(buffer);

    if (!assistantContent) {
      throw new Error('The chatbot returned no text');
    }

    return assistantContent;
  };

  const sendMessage = async (value: string) => {
    const userMessage = value.trim();
    if (!userMessage || isLoading) return;

    // Clear the input field.
    setMessage('');

    // Keep the current message within the backend's history limit.
    const nextMessages = [...messages, { role: 'user' as const, content: userMessage }];
    const requestMessages = [
      ...messages.slice(-(MAX_HISTORY_MESSAGES - 1)),
      { role: 'user' as const, content: userMessage },
    ];
    // Add the user's message to the messages state.
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    // Set the loading state to true while waiting for the assistant response.
    setIsLoading(true);

    try {
      // The chatbot Edge Function uses the same session to enforce the
      // login/seller gates and to create a draft owned by the current seller.
      const { data: sessionData } = await supabase.auth.getSession();
      chatbotSupabase.functions.setAuth(sessionData.session?.access_token ?? '');

      // Ask the Supabase Edge Function for an OpenAI-style streamed response.
      const { data, error } = await chatbotSupabase.functions.invoke<Response>('chatbot', {
        body: {
          messages: requestMessages,
          stream: true,
        },
      });

      // If an error occurs during the request, throw the error.
      if (error) throw error;
      if (!(data instanceof Response)) {
        throw new Error('The chatbot returned an invalid response');
      }

      const assistantResponse = await streamAssistantResponse(data);
      if (/created a draft listing|already have a draft listing/i.test(assistantResponse)) {
        window.dispatchEvent(new CustomEvent('seller-dashboard-refresh'));
      }
    } catch (error) {
      // Log the error and add a fallback error message for the user.
      console.error('Error getting response:', error);
      updateLastAssistantMessage("I'm sorry, I'm having trouble responding right now. Please try again later.");
    } finally {
      // Turn off the loading indicator when the request is complete.
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
    void sendMessage(prompt);
  };

  // Function to toggle the chat window's open/minimized state.
  const toggleChat = () => {
    if (!isOpen) {
      // Open the chat window and set it to full view.
      setIsOpen(true);
      setIsMinimized(false);
    } else {
      // Toggle the minimized state if already open.
      setIsMinimized(!isMinimized);
    }
  };

  // Handler to close the chat window completely.
  const closeChat = () => {
    setIsOpen(false);
    setIsMinimized(true);
  };

  return (
    // The chatbot is a fixed component located at the bottom-right of the window.
    <div className="fixed bottom-4 right-4 z-50">
      {/* Render a floating button when the chat is not open */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <MessageCircle className="h-6 w-6" />
          <span>Any questions? Ask chatbot</span>
        </button>
      )}

      {/* Render the chat window when it is open */}
      {isOpen && (
        <div
          ref={chatboxRef}
          className={`bg-white rounded-lg shadow-xl transition-all duration-300 ease-in-out ${
            isMinimized ? 'h-14' : 'h-[500px]'
          } w-[380px] flex flex-col`}
        >
          {/* Chat header containing the title, icon, and minimize/close buttons */}
          <div
            className="flex items-center justify-between p-4 bg-blue-600 text-white rounded-t-lg cursor-pointer"
            onClick={toggleChat}
          >
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">SG Homie Assistant</span>
            </div>
            <div className="flex items-center space-x-2">
              {/* Display toggle icons based on whether the chat window is minimized or not */}
              {isMinimized ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <>
                  <ChevronDown className="h-5 w-5" />
                  {/* Button to close the chat window. Stop propagation to avoid toggling the chat */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeChat();
                    }}
                    className="hover:bg-blue-700 rounded-full p-1"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Render chat messages and input only when the chat window is not minimized */}
          {!isMinimized && (
            <>
              {/* Container for chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* If there are no messages, display a greeting and suggested prompts */}
                {messages.length === 0 && (
                  <div className="space-y-4">
                    <div className="text-center text-gray-500">
                      👋 Hi! I'm your SG Homie Assistant. What would you like to do?
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Map over suggested prompts and display them as clickable buttons */}
                      {SUGGESTED_PROMPTS.map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => handlePromptClick(prompt.message)}
                          disabled={isLoading}
                          className="p-3 text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          {prompt.label}
                        </button>
                      ))}
                    </div>
                    <div className="text-center text-sm text-gray-500">
                      Choose Buy or Sell, or type your question below.
                    </div>
                  </div>
                )}
                {/* Render chat messages */}
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      // Align user messages to the right and assistant messages to the left.
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        // Style user messages with a blue background and white text,
                        // and assistant messages with a gray background and dark text.
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {/* Render the message content as Markdown for enhanced formatting */}
                      <ReactMarkdown
                        components={{
                          // Customize paragraph and link rendering.
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          a: ({ href, children }) => (
                            <a href={href} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
                {/* Display a loading animation when waiting for a response */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg p-3 text-gray-800">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                {/* Invisible element to automatically scroll to the end of messages */}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat input form */}
              <form onSubmit={handleSubmit} className="p-4 border-t">
                <div className="flex space-x-2">
                  {/* Input field for user's message */}
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading} // Disable input while waiting for a response.
                  />
                  {/* Submit button with a send icon */}
                  <button
                    type="submit"
                    disabled={isLoading || !message.trim()}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Export the Chatbot component as the default export.
export default Chatbot;
