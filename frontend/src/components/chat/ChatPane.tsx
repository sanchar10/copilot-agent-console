import { useRef, useEffect, useCallback, useState, memo } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useTabStore } from '../../stores/tabStore';
import { MessageBubble } from './MessageBubble';
import { StreamingMessage } from './StreamingMessage';
import { InputBox, clearReadySession } from './InputBox';
import { TabBar } from './TabBar';
import { Header } from '../layout/Header';
import { RalphMonitor } from '../ralph/RalphMonitor';
import { AgentLibrary } from '../agents/AgentLibrary';
import { AgentEditor } from '../agents/AgentEditor';
import { ScheduleManager } from '../schedules/ScheduleManager';
import { TaskBoard } from '../taskboard/TaskBoard';
import { TaskRunDetail } from '../taskboard/TaskRunDetail';
import { updateSession, getSession } from '../../api/sessions';
import type { AgentTools, SystemMessage } from '../../types/agent';

/**
 * Per-session tab content — owns its own scroll position, header, messages, and input.
 * Stays mounted when hidden so scroll position and DOM are preserved.
 */
const SessionTabContent = memo(function SessionTabContent({ sessionId, isActive }: { sessionId: string; isActive: boolean }) {
  const { sessions, availableMcpServers, availableTools, setSessions, updateSessionMcpServers, updateSessionTools } = useSessionStore();
  const { messagesPerSession, getStreamingState, getTokenUsage } = useChatStore();
  const { availableModels } = useUIStore();
  const { tabs, openTab: openGenericTab, switchTab: switchGenericTab } = useTabStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [cwdError, setCwdError] = useState<string | null>(null);

  const session = sessions.find((s) => s.session_id === sessionId);
  const messages = messagesPerSession[sessionId] || [];
  const { content: streamingContent, steps: streamingSteps, isStreaming } = getStreamingState(sessionId);
  const tokenUsage = getTokenUsage(sessionId);

  // Check if scroll container is near bottom (within threshold)
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  // Handle user scroll — detect if they scrolled away from bottom
  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const nearBottom = isNearBottom();
    userScrolledUpRef.current = !nearBottom;
    setShowScrollButton(!nearBottom && isStreaming);
  }, [isNearBottom, isStreaming]);

  // Auto-scroll: only when user hasn't scrolled up
  useEffect(() => {
    if (isActive && !userScrolledUpRef.current) {
      isProgrammaticScrollRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      // Reset flag after scroll event fires
      requestAnimationFrame(() => { isProgrammaticScrollRef.current = false; });
    }
  }, [messages, streamingContent, streamingSteps, isActive]);

  // Re-engage auto-scroll when streaming stops
  useEffect(() => {
    if (!isStreaming) {
      userScrolledUpRef.current = false;
      setShowScrollButton(false);
    }
  }, [isStreaming]);

  // Scroll-to-bottom handler for the button
  const scrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false;
    setShowScrollButton(false);
    isProgrammaticScrollRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    requestAnimationFrame(() => { isProgrammaticScrollRef.current = false; });
  }, []);

  // Handlers
  const handleNameChange = useCallback(async (newName: string) => {
    try {
      const updatedSession = await updateSession(sessionId, { name: newName });
      setSessions(sessions.map(s =>
        s.session_id === sessionId ? { ...s, session_name: updatedSession.session_name } : s
      ));
    } catch (error) {
      console.error('Failed to update name:', error);
    }
  }, [sessionId, sessions, setSessions]);

  const handleCwdChange = useCallback(async (newCwd: string) => {
    setCwdError(null);
    try {
      const updatedSession = await updateSession(sessionId, { cwd: newCwd });
      setSessions(sessions.map(s =>
        s.session_id === sessionId ? { ...s, cwd: updatedSession.cwd } : s
      ));
      // Backend destroys SessionClient on CWD change — mark session as not ready
      clearReadySession(sessionId);
    } catch (error) {
      console.error('Failed to update CWD:', error);
      setCwdError('Directory does not exist');
      setTimeout(() => setCwdError(null), 3000);
    }
  }, [sessionId, sessions, setSessions]);

  const handleMcpSelectionsChange = useCallback(async (mcpServers: string[]) => {
    try {
      await updateSession(sessionId, { mcp_servers: mcpServers });
      updateSessionMcpServers(sessionId, mcpServers);
      // Backend destroys SessionClient on MCP change — mark session as not ready
      clearReadySession(sessionId);
    } catch (error) {
      console.error('Failed to update MCP servers:', error);
    }
  }, [sessionId, updateSessionMcpServers]);

  const handleToolSelectionsChange = useCallback(async (tools: AgentTools) => {
    try {
      await updateSession(sessionId, { tools });
      updateSessionTools(sessionId, tools);
      // Backend destroys SessionClient on tools change — mark session as not ready
      clearReadySession(sessionId);
    } catch (error) {
      console.error('Failed to update tools:', error);
    }
  }, [sessionId, updateSessionTools]);

  const handleSystemMessageChange = useCallback(async (systemMessage: SystemMessage | null) => {
    try {
      await updateSession(sessionId, { system_message: systemMessage });
      setSessions(sessions.map(s => 
        s.session_id === sessionId ? { ...s, system_message: systemMessage } : s
      ));
      clearReadySession(sessionId);
    } catch (error) {
      console.error('Failed to update system message:', error);
    }
  }, [sessionId, sessions, setSessions]);

  const handleRelatedSessionClick= useCallback(async (targetSessionId: string) => {
    const { messagesPerSession, setMessages } = useChatStore.getState();
    const targetTabId = `session:${targetSessionId}`;
    if (useTabStore.getState().isTabOpen(targetTabId)) {
      switchGenericTab(targetTabId);
      return;
    }
    try {
      if (!messagesPerSession[targetSessionId]) {
        const sessionData = await getSession(targetSessionId);
        setMessages(targetSessionId, sessionData.messages);
      }
      openGenericTab({ id: targetTabId, type: 'session', label: 'Session', sessionId: targetSessionId });
    } catch (err) {
      console.error('Failed to open related session:', err);
    }
  }, [openGenericTab, switchGenericTab]);

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      <Header
        sessionName={session?.session_name}
        model={session?.model}
        cwd={session?.cwd}
        isNewSession={false}
        availableModels={availableModels}
        availableMcpServers={availableMcpServers}
        mcpSelections={session?.mcp_servers || []}
        availableTools={availableTools}
        toolSelections={session?.tools || { custom: [], builtin: [], excluded_builtin: [] }}
        systemMessage={session?.system_message}
        tokenUsage={tokenUsage}
        hasActiveResponse={isStreaming}
        sessions={sessions}
        currentSessionId={sessionId}
        openTabs={tabs.filter((t) => t.type === 'session' && t.sessionId).map((t) => t.sessionId!)}
        onRelatedSessionClick={handleRelatedSessionClick}
        onNameChange={handleNameChange}
        onCwdChange={handleCwdChange}
        onMcpSelectionsChange={handleMcpSelectionsChange}
        onToolSelectionsChange={handleToolSelectionsChange}
        onSystemMessageChange={handleSystemMessageChange}
        cwdError={cwdError}
      />

      {/* Messages Area */}
      <div className="relative flex-1 min-h-0">
        <div ref={scrollContainerRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && !isStreaming ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>Start a conversation...</p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isStreaming && <StreamingMessage content={streamingContent} steps={streamingSteps} />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        {/* Scroll-to-bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur text-gray-700 px-3 py-1.5 rounded-full shadow-lg border border-white/40 text-sm flex items-center gap-1.5 hover:bg-white/90 transition-colors z-10"
          >
            ↓ New messages
          </button>
        )}
      </div>

      {/* Input Area */}
      <InputBox sessionId={sessionId} />
    </div>
  );
});

export function ChatPane() {
  const { sessions, isNewSession, newSessionSettings, availableMcpServers, availableTools, updateNewSessionSettings } = useSessionStore();
  const { availableModels } = useUIStore();
  const { tabs, activeTabId, openTab: openGenericTab, switchTab: switchGenericTab } = useTabStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeSessionId = activeTab?.type === 'session' ? activeTab.sessionId || null : null;
  const openSessionIds = tabs.filter((t) => t.type === 'session' && t.sessionId).map((t) => t.sessionId!);

  // Handle new session settings changes (before first message)
  const handleNewSessionNameChange = useCallback((name: string) => {
    updateNewSessionSettings({ name });
  }, [updateNewSessionSettings]);

  const handleNewSessionModelChange = useCallback((model: string) => {
    updateNewSessionSettings({ model });
  }, [updateNewSessionSettings]);

  const handleNewSessionCwdChange = useCallback((cwd: string) => {
    updateNewSessionSettings({ cwd });
  }, [updateNewSessionSettings]);

  const handleNewSessionMcpChange = useCallback((mcpServers: string[]) => {
    updateNewSessionSettings({ mcpServers });
  }, [updateNewSessionSettings]);

  const handleNewSessionToolsChange = useCallback((tools: AgentTools) => {
    updateNewSessionSettings({ tools });
  }, [updateNewSessionSettings]);

  const handleNewSessionSystemMessageChange = useCallback((systemMessage: SystemMessage | null) => {
    updateNewSessionSettings({ systemMessage });
  }, [updateNewSessionSettings]);

  const handleNewSessionRelatedClick = useCallback(async (targetSessionId: string) => {
    const { messagesPerSession, setMessages } = useChatStore.getState();
    const targetTabId = `session:${targetSessionId}`;
    if (useTabStore.getState().isTabOpen(targetTabId)) {
      switchGenericTab(targetTabId);
      return;
    }
    try {
      if (!messagesPerSession[targetSessionId]) {
        const sessionData = await getSession(targetSessionId);
        setMessages(targetSessionId, sessionData.messages);
      }
      openGenericTab({ id: targetTabId, type: 'session', label: 'Session', sessionId: targetSessionId });
    } catch (err) {
      console.error('Failed to open related session:', err);
    }
  }, [openGenericTab, switchGenericTab]);

  // Whether the new-session view is the active content
  const showNewSession = isNewSession && newSessionSettings && !activeTabId;

  // No tabs open and not creating new session
  if (tabs.length === 0 && !isNewSession) {
    return (
      <div className="flex-1 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-lg font-medium">No session selected</p>
            <p className="text-sm mt-1">Select a session or create a new one to start chatting</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <TabBar />
      {/* New session view — shown when isNewSession and no tab is active */}
      {showNewSession && newSessionSettings && (
        <div className="flex-1 flex flex-col">
          <Header
            sessionName={newSessionSettings.name}
            model={newSessionSettings.model}
            cwd={newSessionSettings.cwd}
            isNewSession={true}
            availableModels={availableModels}
            availableMcpServers={availableMcpServers}
            mcpSelections={newSessionSettings.mcpServers}
            availableTools={availableTools}
            toolSelections={newSessionSettings.tools}
            systemMessage={newSessionSettings.systemMessage}
            sessions={sessions}
            openTabs={openSessionIds}
            onRelatedSessionClick={handleNewSessionRelatedClick}
            onNameChange={handleNewSessionNameChange}
            onModelChange={handleNewSessionModelChange}
            onCwdChange={handleNewSessionCwdChange}
            onMcpSelectionsChange={handleNewSessionMcpChange}
            onToolSelectionsChange={handleNewSessionToolsChange}
            onSystemMessageChange={handleNewSessionSystemMessageChange}
          />
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-lg font-medium">How can I help you today?</p>
                <p className="text-sm mt-1 text-gray-400">Type a message to start a new session</p>
              </div>
            </div>
          </div>
          <InputBox />
        </div>
      )}
      {!showNewSession && activeTab?.type === 'ralph-monitor' && <RalphMonitor />}
      {!showNewSession && activeTab?.type === 'agent-library' && <AgentLibrary />}
      {!showNewSession && activeTab?.type === 'agent-detail' && activeTab.agentId && (
        <AgentEditor agentId={activeTab.agentId} />
      )}
      {!showNewSession && activeTab?.type === 'schedule-manager' && (
        <ScheduleManager agentId={activeTab.agentId} />
      )}
      {!showNewSession && activeTab?.type === 'task-board' && (
        <TaskBoard scheduleId={activeTab.scheduleId} scheduleName={activeTab.scheduleId ? activeTab.label.replace('Runs: ', '') : undefined} />
      )}
      {!showNewSession && activeTab?.type === 'task-run-detail' && activeTab.runId && (
        <TaskRunDetail runId={activeTab.runId} />
      )}
      {openSessionIds.map((sessionId) => (
        <SessionTabContent
          key={sessionId}
          sessionId={sessionId}
          isActive={!showNewSession && sessionId === activeSessionId}
        />
      ))}
    </div>
  );
}
