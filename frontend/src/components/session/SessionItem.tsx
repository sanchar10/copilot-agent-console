import { formatSmartDate, formatDateTime } from '../../utils/formatters';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSessionStore } from '../../stores/sessionStore';
import { useChatStore } from '../../stores/chatStore';
import { useViewedStore } from '../../stores/viewedStore';
import { useTabStore, tabId } from '../../stores/tabStore';
import { deleteSession } from '../../api/sessions';
import { openSessionTab } from '../../utils/openSession';
import { ConfirmModal } from '../common/ConfirmModal';
import type { Session } from '../../types/session';

interface SessionItemProps {
  session: Session;
}

export function SessionItem({ session }: SessionItemProps) {
  const { removeSession } = useSessionStore();
  const { clearSessionMessages } = useChatStore();
  const { isAgentActive, hasUnread } = useViewedStore();
  const { tabs, activeTabId, switchTab, closeTab } = useTabStore();
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

  // Position popover when shown — adjusts if it would overflow viewport
  useEffect(() => {
    if (showInfo && infoButtonRef.current) {
      const rect = infoButtonRef.current.getBoundingClientRect();
      const left = rect.right + 8;
      let top = rect.top;
      setPopoverPosition({ top, left });
    }
  }, [showInfo]);

  // Adjust position after popover renders to keep it in viewport
  useEffect(() => {
    if (!showInfo) return;
    const el = infoRef.current;
    if (!el) return;
    const popoverRect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    if (popoverRect.bottom > viewportHeight - 8) {
      setPopoverPosition(prev => ({ ...prev, top: viewportHeight - popoverRect.height - 8 }));
    }
  });

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

    // If session is already open as a tab, just switch to it (instant, like tab bar click)
    if (isOpen) {
      switchTab(sessionTabId);
      return;
    }

    // Full session open flow: MCP merge, load messages, streaming resume, etc.
    await openSessionTab(session);
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

  return (
    <>
      <div
        onClick={handleClick}
        className={`group relative flex items-center gap-3 px-2.5 py-1.5 cursor-pointer transition-colors rounded-qd-sm mb-px ${
          isActive
            ? 'bg-qd-panel-deep text-qd-text'
            : isOpen
            ? 'bg-qd-panel text-qd-text'
            : 'text-qd-text-dim hover:bg-qd-panel hover:text-qd-text'
        }`}
      >
        <div className="flex-1 min-w-0 pr-4">
          <p className={`text-[13px] leading-tight tracking-[-0.005em] truncate ${isActive ? 'font-medium text-qd-text' : ''}`}>
            {session.session_name}
          </p>
          <p className="text-[11px] font-mono text-qd-text-muted mt-0.5">
            {formatSmartDate(session.updated_at)}
          </p>
        </div>

        {/* Status indicator — absolute right, hides on hover to reveal action buttons */}
        {(isRunning || hasUnreadMessages) && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 group-hover:opacity-0 transition-opacity">
            {isRunning ? (
              <div title="Agent is processing...">
                <span
                  className="qd-status-dot"
                  data-status="running"
                  style={{ background: 'var(--status-running)' }}
                />
              </div>
            ) : (
              <div title="New messages">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
              </div>
            )}
          </div>
        )}

        {/* Hover actions */}
        <div className={`absolute right-0 top-0 bottom-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-qd-sm px-1 ${
          isActive
            ? 'bg-qd-panel-deep'
            : isOpen
            ? 'bg-qd-panel'
            : 'bg-qd-panel'
        }`}>
          <button
            ref={infoButtonRef}
            onClick={handleInfoClick}
            className="p-1.5 text-qd-text-muted hover:text-qd-accent-text hover:bg-qd-panel-deep rounded transition-all"
            title="Session info"
            aria-label="Session info"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-1.5 text-qd-text-muted hover:text-red-500 hover:bg-qd-panel-deep rounded transition-all"
            title="Delete session"
            aria-label="Delete session"
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
          className="fixed z-[9999] bg-qd-bg-elev border border-qd-border rounded-qd-md shadow-qd-pop qd-popover-in p-3 w-[320px] text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div>
              <span className="text-qd-text-muted text-[11px] font-mono uppercase tracking-wider">Session ID</span>
              <div className="flex items-center gap-2">
                <code className="text-qd-text text-xs bg-qd-panel-deep px-2 py-1 rounded-qd-sm break-all font-mono">
                  {session.session_id}
                </code>
                <button
                  onClick={handleCopyId}
                  className="p-1 text-qd-text-muted hover:text-qd-accent-text shrink-0"
                  title="Copy ID"
                  aria-label="Copy session ID"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <span className="text-qd-text-muted text-[11px] font-mono uppercase tracking-wider">Session Name</span>
              <p className="text-qd-text-dim break-words">{session.session_name}</p>
            </div>

            <div>
              <span className="text-qd-text-muted text-[11px] font-mono uppercase tracking-wider">Model</span>
              <p className="text-qd-text-dim">{session.model || '(not set)'}</p>
            </div>

            <div>
              <span className="text-qd-text-muted text-[11px] font-mono uppercase tracking-wider">Working Directory</span>
              <p className="text-qd-text-dim break-all">{session.cwd || '(not adopted)'}</p>
            </div>

            <div>
              <span className="text-qd-text-muted text-[11px] font-mono uppercase tracking-wider">Created</span>
              <p className="text-qd-text-dim">{formatDateTime(session.created_at)}</p>
            </div>

            <div>
              <span className="text-qd-text-muted text-[11px] font-mono uppercase tracking-wider">Last Updated</span>
              <p className="text-qd-text-dim">{formatDateTime(session.updated_at)}</p>
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

