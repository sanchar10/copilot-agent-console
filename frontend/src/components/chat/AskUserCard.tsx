import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AskUserRequest } from '../../api/sessions';
import { respondToUserInput } from '../../api/sessions';
import { useChatStore } from '../../stores/chatStore';
import { useToastStore } from '../../stores/toastStore';

interface AskUserCardProps {
  sessionId: string;
  data: AskUserRequest;
}

export function AskUserCard({ sessionId, data }: AskUserCardProps) {
  const { clearAskUser } = useChatStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [freeformText, setFreeformText] = useState('');
  const [useFreeform, setUseFreeform] = useState(!data.choices || data.choices.length === 0);
  const [submitting, setSubmitting] = useState(false);

  const answer = useFreeform ? freeformText : (selected || '');
  const canSubmit = answer.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await respondToUserInput(sessionId, data.request_id, answer, useFreeform);
      clearAskUser(sessionId);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        useToastStore.getState().addToast(
          'This request expired (session was idle too long). Continue in the message box below.',
          'warning',
          { duration: 6000, id: `ask-user-expired-${data.request_id}` },
        );
        clearAskUser(sessionId);
      } else {
        useToastStore.getState().addToast(
          'Failed to send your answer. Please try again.',
          'error',
          { duration: 5000 },
        );
        console.error('Failed to respond to ask_user:', err);
      }
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, data.request_id, answer, useFreeform, canSubmit, clearAskUser]);

  const handleSkip = useCallback(async () => {
    setSubmitting(true);
    try {
      await respondToUserInput(sessionId, data.request_id, '', true, true);
      clearAskUser(sessionId);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        // Card already expired server-side; user wanted it gone anyway.
        clearAskUser(sessionId);
      } else {
        useToastStore.getState().addToast(
          'Failed to skip this request. Please try again.',
          'error',
          { duration: 5000 },
        );
        console.error('Failed to skip ask_user:', err);
      }
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, data.request_id, clearAskUser]);

  return (
    <div className="my-2 ml-11 border-l-3 border-emerald-500 bg-emerald-100/80 dark:bg-emerald-950/70 rounded-r-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">💬</span>
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Agent is asking</span>
      </div>

      <div className="text-sm text-qd-text-dim mb-3 prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.question}</ReactMarkdown>
      </div>

      {/* Choice buttons */}
      {data.choices && data.choices.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {data.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => { setSelected(choice); setUseFreeform(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm rounded-md border transition-colors ${
                selected === choice && !useFreeform
                  ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300'
                  : 'border-qd-border text-qd-text-dim hover:bg-qd-panel-deep dark:hover:bg-qd-panel'
              }`}
            >
              {selected === choice && !useFreeform ? '◉' : '○'} {choice}
            </button>
          ))}
          {/* Other / freeform option */}
          {data.allowFreeform && (
            <button
              type="button"
              onClick={() => setUseFreeform(true)}
              className={`w-full text-left px-3 py-1.5 text-sm rounded-md border transition-colors ${
                useFreeform
                  ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300'
                  : 'border-qd-border text-qd-text-dim hover:bg-qd-panel-deep dark:hover:bg-qd-panel'
              }`}
            >
              {useFreeform ? '◉' : '○'} Other (type your answer)
            </button>
          )}
        </div>
      )}

      {/* Freeform text input */}
      {(useFreeform || (!data.choices || data.choices.length === 0)) && (
        <div className="mb-3">
          <input
            type="text"
            value={freeformText}
            onChange={e => setFreeformText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
            placeholder="Type your answer..."
            autoFocus
            className="w-full px-3 py-1.5 text-sm rounded-md border border-qd-border bg-qd-bg text-qd-text focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleSkip}
          disabled={submitting}
          className="px-3 py-1.5 text-xs text-qd-text-muted hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="px-3 py-1.5 text-xs rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sending...' : 'Submit ✓'}
        </button>
      </div>
    </div>
  );
}
