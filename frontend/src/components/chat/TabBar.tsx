import { useSessionStore } from '../../stores/sessionStore';
import { useChatStore } from '../../stores/chatStore';
import { useTabStore } from '../../stores/tabStore';
import { useViewedStore } from '../../stores/viewedStore';
import { getSession, disconnectSession } from '../../api/sessions';
import { clearReadySession } from './InputBox';

export function TabBar() {
  const { sessions, isNewSession, clearNewSession } = useSessionStore();
  const { tabs, activeTabId, switchTab, closeTab } = useTabStore();
  const activeAgentIds = useViewedStore((s) => (s as unknown as { activeAgentIds?: Set<string> }).activeAgentIds);

  const handleTabClick = async (tab: { id: string; type: string; sessionId?: string }) => {
    if (tab.id === activeTabId) return;

    // Clear new-session mode when switching to an existing tab
    clearNewSession();

    if (tab.type === 'session' && tab.sessionId) {
      // Load messages if not cached. Read messagesPerSession imperatively from
      // getState() — this view doesn't need a reactive subscription, so avoiding
      // it stops TabBar from re-rendering on every streaming delta.
      const { messagesPerSession, setMessages, setLoadError } = useChatStore.getState();
      if (!messagesPerSession[tab.sessionId]) {
        try {
          const sessionData = await getSession(tab.sessionId);
          setMessages(tab.sessionId, sessionData.messages);
          setLoadError(tab.sessionId, sessionData.load_error || null);
        } catch (err) {
          console.error('Failed to switch tab:', err);
          return;
        }
      }
    }

    switchTab(tab.id);
  };

  const handleTabClose = async (e: React.MouseEvent, tab: { id: string; type: string; sessionId?: string }) => {
    e.stopPropagation();

    // Close tab immediately for instant UI response
    closeTab(tab.id);

    if (tab.type === 'session' && tab.sessionId) {
      useChatStore.getState().clearSessionMessages(tab.sessionId);
      // Disconnect in background — don't block UI
      disconnectSession(tab.sessionId)
        .then(() => clearReadySession(tab.sessionId!))
        .catch(() => {});
    }
  };

  if (tabs.length === 0 && !isNewSession) {
    return null;
  }

  return (
    <div className="flex items-stretch h-[38px] bg-qd-bg border-b border-qd-border-soft pl-1 overflow-x-auto">
      {/* All open tabs */}
      {tabs.map((tab) => {
        const session = tab.type === 'session' ? sessions.find((s) => s.session_id === tab.sessionId) : null;
        const label = session?.session_name || tab.label;
        const isActive = activeTabId === tab.id;
        const isRunning = tab.type === 'session' && tab.sessionId && activeAgentIds?.has(tab.sessionId);

        return (
          <div
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            role="tab"
            aria-selected={isActive}
            className={`group relative flex items-center gap-[7px] pl-3 pr-2 cursor-pointer whitespace-nowrap min-w-0 max-w-[220px] text-[12.5px] border-r border-qd-border-soft transition-colors
              ${isActive
                ? 'bg-qd-bg-elev text-qd-text font-medium'
                : 'text-qd-text-dim hover:bg-qd-panel hover:text-qd-text'}`}
            style={isActive ? { boxShadow: 'inset 0 -2px 0 var(--accent)' } : undefined}
          >
            {/* Only show a dot when it conveys real status (agent running).
                Active/idle are already implied by the tab styling itself, and
                adding a dot there would collide with unread indicators. */}
            {isRunning && (
              <span
                className="qd-status-dot"
                data-status="running"
                style={{ background: 'var(--status-running)' }}
                aria-hidden
                title="Agent is processing"
              />
            )}
            <span className="truncate flex-1 min-w-0">{label}</span>
            <button
              onClick={(e) => handleTabClose(e, tab)}
              className="grid place-items-center w-[18px] h-[18px] rounded text-qd-text-muted opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-qd-panel-deep hover:text-qd-text transition-opacity flex-shrink-0"
              title="Close tab"
              aria-label={`Close tab ${label}`}
            >
              <svg className="w-[11px] h-[11px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}

      {/* New session tab — rendered after existing tabs so it appears on the right */}
      {isNewSession && (
        <div
          onClick={() => {
            // Deactivate all tabs to show new-session view
            useTabStore.setState({ activeTabId: null });
          }}
          role="tab"
          aria-selected={activeTabId === null}
          className={`group flex items-center gap-[7px] pl-3 pr-2 cursor-pointer whitespace-nowrap min-w-0 max-w-[220px] text-[12.5px] border-r border-qd-border-soft transition-colors
            ${activeTabId === null
              ? 'bg-qd-bg-elev text-qd-text font-medium'
              : 'text-qd-text-dim hover:bg-qd-panel hover:text-qd-text'}`}
          style={activeTabId === null ? { boxShadow: 'inset 0 -2px 0 var(--accent)' } : undefined}
        >
          <span className="qd-status-dot" data-status="new" style={{ background: 'var(--status-new)' }} aria-hidden />
          <span className="truncate flex-1">New Session</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearNewSession();
              const { tabs: currentTabs, activeTabId: currentActive } = useTabStore.getState();
              if (!currentActive && currentTabs.length > 0) {
                useTabStore.setState({ activeTabId: currentTabs[currentTabs.length - 1].id });
              }
            }}
            className="grid place-items-center w-[18px] h-[18px] rounded text-qd-text-muted opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-qd-panel-deep hover:text-qd-text transition-opacity flex-shrink-0"
            title="Close tab"
            aria-label="Cancel new session"
          >
            <svg className="w-[11px] h-[11px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
