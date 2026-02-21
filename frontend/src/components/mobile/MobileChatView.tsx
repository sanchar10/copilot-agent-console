import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mobileApiClient } from '../../api/mobileClient';
import type { Message, ChatStep } from '../../types/session';

interface SessionData {
  session_id: string;
  session_name: string;
  model: string;
  messages: Message[];
}

interface ResponseStatus {
  has_active_response: boolean;
  status: string;
  chunks_count: number;
  steps_count: number;
}

export function MobileChatView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSteps, setStreamingSteps] = useState<ChatStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load session data
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const data = await mobileApiClient.get<SessionData>(`/sessions/${sessionId}`);
        setSession(data);
        setMessages(data.messages);

        // Check if there's an active response to resume
        const status = await mobileApiClient.get<ResponseStatus>(`/sessions/${sessionId}/response-status`);
        if (status.has_active_response) {
          resumeStream(status.chunks_count, status.steps_count);
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      } finally {
        setLoading(false);
      }
    })();
    // Mark as viewed
    mobileApiClient.post(`/viewed/${sessionId}`).catch(() => {});
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages, streamingContent]);

  // Cleanup event source
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const resumeStream = useCallback((fromChunk = 0, fromStep = 0) => {
    if (!sessionId) return;
    eventSourceRef.current?.close();

    const es = mobileApiClient.createEventSource(
      `/sessions/${sessionId}/response-stream`,
      { from_chunk: String(fromChunk), from_step: String(fromStep) }
    );
    eventSourceRef.current = es;
    setIsStreaming(true);

    es.addEventListener('delta', (event) => {
      const data = JSON.parse(event.data);
      setStreamingContent(prev => prev + data.content);
    });

    es.addEventListener('step', (event) => {
      const step = JSON.parse(event.data);
      setStreamingSteps(prev => [...prev, step]);
    });

    es.addEventListener('done', () => {
      es.close();
      setIsStreaming(false);
      // Reload messages to get final state
      if (sessionId) {
        mobileApiClient.get<SessionData>(`/sessions/${sessionId}`)
          .then(data => {
            setMessages(data.messages);
            setStreamingContent('');
            setStreamingSteps([]);
          })
          .catch(() => {});
      }
    });

    es.addEventListener('error', () => {
      es.close();
      setIsStreaming(false);
      // Reload messages
      if (sessionId) {
        mobileApiClient.get<SessionData>(`/sessions/${sessionId}`)
          .then(data => {
            setMessages(data.messages);
            setStreamingContent('');
            setStreamingSteps([]);
          })
          .catch(() => {});
      }
    });

    es.onerror = () => {
      // EventSource will try to reconnect automatically
    };
  }, [sessionId]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    // Optimistic UI: add user message
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setStreamingContent('');
    setStreamingSteps([]);

    try {
      // Check if agent is active — enqueue if so, otherwise send new message
      const status = await mobileApiClient.get<ResponseStatus>(`/sessions/${sessionId}/response-status`);

      if (status.has_active_response) {
        // Enqueue to running agent
        await mobileApiClient.post(`/sessions/${sessionId}/enqueue`, {
          content,
          is_new_session: false,
        });
        // Resume the existing stream
        resumeStream(status.chunks_count, status.steps_count);
      } else {
        // Connect session first
        await mobileApiClient.post(`/sessions/${sessionId}/connect`);

        // Send message — this returns an SSE stream
        eventSourceRef.current?.close();
        const es = mobileApiClient.createEventSource(
          `/sessions/${sessionId}/response-stream`,
          { from_chunk: '0', from_step: '0' }
        );
        eventSourceRef.current = es;

        // Fire the message (the SSE stream from /messages won't work with EventSource
        // since it's a POST, so we use the fire-and-poll approach)
        await mobileApiClient.post(`/sessions/${sessionId}/messages`, {
          content,
          is_new_session: false,
        });

        setIsStreaming(true);

        es.addEventListener('delta', (event) => {
          const data = JSON.parse(event.data);
          setStreamingContent(prev => prev + data.content);
        });

        es.addEventListener('step', (event) => {
          const step = JSON.parse(event.data);
          setStreamingSteps(prev => [...prev, step]);
        });

        es.addEventListener('done', () => {
          es.close();
          setIsStreaming(false);
          mobileApiClient.get<SessionData>(`/sessions/${sessionId}`)
            .then(data => {
              setMessages(data.messages);
              setStreamingContent('');
              setStreamingSteps([]);
            })
            .catch(() => {});
        });

        es.addEventListener('error', () => {
          es.close();
          setIsStreaming(false);
          mobileApiClient.get<SessionData>(`/sessions/${sessionId}`)
            .then(data => {
              setMessages(data.messages);
              setStreamingContent('');
              setStreamingSteps([]);
            })
            .catch(() => {});
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleAbort = async () => {
    if (!sessionId) return;
    try {
      await mobileApiClient.post(`/sessions/${sessionId}/abort`);
      setIsStreaming(false);
      eventSourceRef.current?.close();
      // Reload
      const data = await mobileApiClient.get<SessionData>(`/sessions/${sessionId}`);
      setMessages(data.messages);
      setStreamingContent('');
      setStreamingSteps([]);
    } catch (err) {
      console.error('Failed to abort:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#fafafa] dark:bg-[#1e1e2e]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#252536] border-b border-gray-200 dark:border-[#3a3a4e]">
        <button
          onClick={() => navigate('/mobile')}
          className="p-2 -ml-1 text-gray-600 dark:text-gray-400"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {session?.session_name || 'Session'}
          </h2>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {session?.model}
            {isStreaming && ' · Agent running...'}
          </div>
        </div>
        {isStreaming && (
          <button
            onClick={handleAbort}
            className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg"
          >
            Stop
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-3 max-w-2xl mx-auto">
          {messages.map(msg => (
            <MobileMessageBubble key={msg.id} message={msg} />
          ))}
          {isStreaming && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-white dark:bg-[#2a2a3c] rounded-2xl rounded-bl-md px-3 py-2 shadow-sm border border-gray-100 dark:border-[#3a3a4e]">
                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans break-words">
                  {streamingContent}
                </pre>
                {streamingSteps.length > 0 && (
                  <StepsAccordion steps={streamingSteps} />
                )}
              </div>
            </div>
          )}
          {isStreaming && !streamingContent && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-[#2a2a3c] rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-[#3a3a4e]">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-3 py-2 bg-white dark:bg-[#252536] border-t border-gray-200 dark:border-[#3a3a4e] safe-bottom">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isStreaming ? 'Agent is working... (enqueue a follow-up)' : 'Type a message...'}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-[#3a3a4e] bg-gray-50 dark:bg-[#2a2a3c] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2.5 bg-blue-600 text-white rounded-xl disabled:opacity-40 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileMessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-md'
          : 'bg-white dark:bg-[#2a2a3c] text-gray-800 dark:text-gray-200 rounded-bl-md border border-gray-100 dark:border-[#3a3a4e]'
      }`}>
        <pre className="text-sm whitespace-pre-wrap font-sans break-words">{message.content}</pre>
        {message.steps && message.steps.length > 0 && !isUser && (
          <StepsAccordion steps={message.steps} />
        )}
      </div>
    </div>
  );
}

function StepsAccordion({ steps }: { steps: ChatStep[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 border-t border-gray-200 dark:border-[#3a3a4e] pt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"
      >
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {steps.length} step{steps.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {steps.map((step, i) => (
            <div key={i} className="text-xs text-gray-500 dark:text-gray-400 pl-4">
              • {step.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
