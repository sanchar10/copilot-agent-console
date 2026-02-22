import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSessionStore } from '../../stores/sessionStore';
import { useChatStore } from '../../stores/chatStore';
import { useViewedStore } from '../../stores/viewedStore';
import { useTabStore, tabId } from '../../stores/tabStore';
import { getSession, deleteSession, connectSession, getResponseStatus, resumeResponseStream } from '../../api/sessions';
import { ConfirmModal } from '../common/ConfirmModal';
import type { Session } from '../../types/session';

interface SessionItemProps {
  session: Session;
}

export function SessionItem({ session }: SessionItemProps) {
  const { removeSession, setSessions, sessions, refreshMcpServers, updateSessionMcpServers, updateSessionTimestamp, clearNewSession } = useSessionStore();
  const { messagesPerSession, setMessages, clearSessionMessages, setStreaming, appendStreamingContent, addStreamingStep, finalizeStreaming } = useChatStore();
  const { isAgentActive, setAgentActive, markViewed, hasUnread } = useViewedStore();
  const { tabs, activeTabId, openTab: openGenericTab, switchTab, closeTab } = useTabStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  const sessionTabId = tabId.session(session.session_id);
  const isActive = activeTabId === sessionTabId;
  const isOpen = tabs.some((t) => t.id === sessionTabId);
  
  // Check for indicators (only after viewed timestamps are loaded)
  const isRunning = isAgentActive(session.session_id);
  
  // Blue dot: unread if session was modified after we last viewed it
  const hasUnreadMessages = !isActive && hasUnread(session.session_id, session.updated_at, session.created_at);

  // Position popover when shown
  useEffect(() => {
    if (showInfo && infoButtonRef.current) {
      const rect = infoButtonRef.current.getBoundingClientRect();
      setPopoverPosition({
        top: rect.top,
        left: rect.right + 8,
      });
    }
  }, [showInfo]);

  // Close info popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node) &&
          infoButtonRef.current && !infoButtonRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    };
    if (showInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showInfo]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowInfo(false);
    };
    if (showInfo) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showInfo]);

  const handleClick = async () => {
    if (isActive) return;

    // Clear new-session mode when switching to an existing session
    clearNewSession();

    const sessionId = session.session_id;

    // If session is already open as a tab, just switch to it (instant, like tab bar click)
    if (isOpen) {
      switchTab(sessionTabId);
      markViewed(sessionId);
      return;
    }
    
    // Always refresh MCP servers from disk when opening a session
    const freshServers = await refreshMcpServers();

    // Helper to merge MCP servers — keep saved selections that still exist, add new servers
    const mergeMcpServers = (savedSelections: string[] | undefined) => {
      const freshNames = new Set(freshServers.map(s => s.name));
      if (savedSelections !== undefined && savedSelections !== null) {
        // User has configured selections (may be empty = chose none)
        return savedSelections.filter(name => freshNames.has(name));
      }
      // Never configured — default to all servers enabled
      return freshServers.map(s => s.name);
    };

    // Helper to check and resume active response stream
    const checkAndResumeActiveResponse = async () => {
      try {
        await connectSession(sessionId);
        const status = await getResponseStatus(sessionId);
        
        if (status.active) {
          console.log(`[SessionItem] Active response detected for ${sessionId}, resuming stream...`);
          setStreaming(sessionId, true);
          setAgentActive(sessionId, true);
          
          // Resume streaming from where we left off
          await resumeResponseStream(
            sessionId,
            status.chunks_count || 0,
            status.steps_count || 0,
            (content) => appendStreamingContent(sessionId, content),
            (step) => addStreamingStep(sessionId, step),
            () => {
              // On done
              finalizeStreaming(sessionId, '');
              setAgentActive(sessionId, false);
              updateSessionTimestamp(sessionId);
              markViewed(sessionId);
              // Refresh messages to get the saved response from SDK
              getSession(sessionId).then(s => setMessages(sessionId, s.messages)).catch(() => {});
            },
            (error) => {
              console.error('[SessionItem] Resume stream error:', error);
              setStreaming(sessionId, false);
              setAgentActive(sessionId, false);
            }
          );
          return true; // Active response found and resumed
        }
        return false; // No active response
      } catch (err) {
        console.error('Failed to check response status:', err);
        return false;
      }
    };

    // If already cached, just open tab but check for active response
    if (messagesPerSession[sessionId]) {
      const mergedSelections = mergeMcpServers(session.mcp_servers);
      updateSessionMcpServers(sessionId, mergedSelections);
      openGenericTab({ id: sessionTabId, type: 'session', label: session.session_name, sessionId });
      
      // Check if there's an active response we need to resume
      const hasActiveResponse = await checkAndResumeActiveResponse();
      if (!hasActiveResponse) {
        // Only mark as viewed if no active response (otherwise wait for stream to complete)
        markViewed(sessionId);
      }
      return;
    }

    // Open tab immediately for visual feedback, then load in background
    openGenericTab({ id: sessionTabId, type: 'session', label: session.session_name, sessionId });

    try {
      // Load session with messages
      const sessionData = await getSession(sessionId);
      setMessages(sessionId, sessionData.messages);
      
      const mergedSelections = mergeMcpServers(sessionData.mcp_servers);
      
      // Update session in store with adopted data (cwd, model, name, mcp_servers)
      setSessions(sessions.map(s => 
        s.session_id === sessionId 
          ? { ...s, cwd: sessionData.cwd, model: sessionData.model, session_name: sessionData.session_name, mcp_servers: mergedSelections }
          : s
      ));
      
      // Check if there's an active response we need to resume
      const hasActiveResponse = await checkAndResumeActiveResponse();
      if (!hasActiveResponse) {
        // Only mark as viewed if no active response
        markViewed(sessionId);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setMessages(sessionId, [{
        id: 'error',
        role: 'assistant',
        content: `⚠️ Could not load this session.\n\nError: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toISOString(),
      }]);
    }
  };

  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    try {
      await deleteSession(session.session_id);
      // Remove from store BEFORE closing tab — closeTab triggers re-render
      // that may unmount this component, preventing subsequent lines from running
      removeSession(session.session_id);
      clearSessionMessages(session.session_id);
      closeTab(sessionTabId);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(session.session_id);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <>
      <div
        onClick={handleClick}
        className={`group relative flex items-center gap-3 px-3 py-3 cursor-pointer transition-all rounded-lg ${
          isActive
            ? 'bg-blue-50 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:border-blue-700'
            : isOpen
            ? 'bg-gray-50 border border-gray-200 dark:bg-[#2a2a3c] dark:border-gray-700'
            : 'border border-transparent hover:bg-gray-50 hover:border-gray-200 dark:hover:bg-[#32324a] dark:hover:border-gray-700'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {session.session_name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(session.updated_at)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {/* Status indicators */}
          {isRunning ? (
            /* Spinner for active agent */
            <div className="p-1.5" title="Agent is processing...">
              <svg className="w-4 h-4 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : hasUnreadMessages ? (
            /* Blue dot for unread messages */
            <div className="p-1.5" title="New messages">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
            </div>
          ) : null}
          
          {/* Info button */}
          <button
            ref={infoButtonRef}
            onClick={handleInfoClick}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-[#32324a] rounded transition-all"
            title="Session info"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Delete button */}
          <button
            onClick={handleDeleteClick}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-[#32324a] rounded transition-all"
            title="Delete session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info popover - rendered as portal to escape overflow */}
      {showInfo && createPortal(
        <div 
          ref={infoRef}
          style={{ top: popoverPosition.top, left: popoverPosition.left }}
          className="fixed z-[9999] bg-white/95 dark:bg-[#2a2a3c]/95 backdrop-blur-xl border border-gray-200 dark:border-[#3a3a4e] rounded-lg shadow-xl p-3 min-w-[280px] text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Session ID</span>
              <div className="flex items-center gap-2">
                <code className="text-gray-700 dark:text-gray-300 text-xs bg-gray-100 dark:bg-[#1e1e2e] px-2 py-1 rounded break-all">
                  {session.session_id}
                </code>
                <button
                  onClick={handleCopyId}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0"
                  title="Copy ID"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Model</span>
              <p className="text-gray-700 dark:text-gray-300">{session.model || '(not set)'}</p>
            </div>

            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Working Directory</span>
              <p className="text-gray-200 dark:text-gray-400 break-all">{session.cwd || '(not adopted)'}</p>
            </div>

            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Created</span>
              <p className="text-gray-700 dark:text-gray-300">{formatFullDate(session.created_at)}</p>
            </div>

            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Last Updated</span>
              <p className="text-gray-700 dark:text-gray-300">{formatFullDate(session.updated_at)}</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {createPortal(
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete Session"
          message={`Are you sure you want to delete "${session.session_name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />,
        document.body
      )}
    </>
  );
}
