// ============================================================
// Thread — list of messages with expandable steps. Auto-scrolls to bottom.
// ============================================================

const { useState: useStateT, useEffect: useEffectT, useRef: useRefT } = React;

const Thread = ({ messages, expandedSteps, onToggleSteps }) => {
  const scrollRef = useRefT(null);

  // Pin scroll to bottom on new message.
  useEffectT(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="thread-wrap" ref={scrollRef}>
      <div className="thread">
        {messages.length === 0 && (
          <div style={{
            padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
          }}>
            New session. Send a message to begin.
          </div>
        )}
        {messages.map(m => (
          <Message
            key={m.id}
            m={m}
            isStepsOpen={expandedSteps.has(m.id)}
            onToggleSteps={() => onToggleSteps(m.id)}
          />
        ))}
      </div>
    </div>
  );
};

const Message = ({ m, isStepsOpen, onToggleSteps }) => {
  if (m.role === 'user') {
    return (
      <div className="msg-user">
        <div className="msg-user__bubble">{m.body}</div>
        <div className="msg-user__time">{m.time}</div>
      </div>
    );
  }

  // assistant
  return (
    <div className="msg-agent">
      <div className="msg-agent__avatar">
        <Icon name="sparkle" size={13} strokeWidth={1.8} />
      </div>
      <div className="msg-agent__body">
        <div className="msg-agent__head">
          <span className="msg-agent__name">Copilot</span>
          <span className="msg-agent__time">{m.time}</span>
          {m.stepsCount > 0 && (
            <button
              className="steps-pill"
              data-open={isStepsOpen}
              onClick={onToggleSteps}
              aria-expanded={isStepsOpen}
            >
              <Icon name="chevRight" size={10} />
              {m.stepsCount} steps
              {m.userInput && <span className="steps-pill__input">· 1 input</span>}
            </button>
          )}
        </div>

        {isStepsOpen && m.steps && m.steps.length > 0 && (
          <StepsDetail steps={m.steps} extra={m.stepsCount - m.steps.length} />
        )}

        <div className="msg-agent__text">{m.body}</div>

        {m.highestPriority && (
          <div className="priority-callout">
            <strong>Highest-priority fix: </strong>{m.highestPriority}
          </div>
        )}

        {m.table && (
          <div className="feedback-table">
            <div className="feedback-table__head">
              <div>Area</div><div>Feedback</div><div>Suggested change</div>
            </div>
            {m.table.map((row, i) => (
              <div key={i} className="feedback-table__row">
                <div>{row.area}</div>
                <div>{row.feedback}</div>
                <div>{row.change}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StepsDetail = ({ steps, extra }) => (
  <div className="steps-detail">
    {steps.map((s, i) => (
      <div key={i} className="step-row">
        <span
          className="step-row__bullet"
          style={{
            background:
              s.kind === 'tool'    ? 'oklch(0.6 0.12 200)' :
              s.kind === 'input'   ? 'var(--accent)' :
              s.kind === 'thought' ? 'var(--text-muted)' : 'var(--text-dim)',
          }}
        />
        <span className="step-row__kind" data-kind={s.kind}>
          {s.kind === 'tool' ? s.name : s.kind}
        </span>
        <span className="step-row__body">{s.body}</span>
        <span className="step-row__time">{s.time}</span>
      </div>
    ))}
    {extra > 0 && (
      <div className="step-row">
        <span />
        <span className="step-row__kind" style={{ color: 'var(--text-muted)' }}>…</span>
        <span style={{ color: 'var(--text-muted)' }}>+{extra} more</span>
      </div>
    )}
  </div>
);

// ============================================================
// Composer — autosizing textarea + send + mode chips. Enter sends,
// Shift+Enter for newline. Sends through onSend(text).
// ============================================================

const Composer = ({ onSend, tokenPct = 0.23, disabled }) => {
  const [text, setText] = useStateT('');
  const [mode, setMode] = useStateT('Interactive');
  const taRef = useRefT(null);

  // Autosize.
  useEffectT(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(200, ta.scrollHeight) + 'px';
  }, [text]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={taRef}
          className="composer__textarea"
          placeholder="Reply to Copilot…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
        />
        <div className="composer__row">
          <button className="composer__ghost" aria-label="Attach">
            <Icon name="paperclip" size={13} />
          </button>
          <button className="composer__ghost">
            {mode}
            <Icon name="chevDown" size={11} />
          </button>
          <span className="composer__token-meta">{Math.round(tokenPct * 100)}% · 125k</span>
          <button
            className="composer__send"
            onClick={send}
            disabled={!text.trim() || disabled}
            aria-label="Send"
            title="Send (Enter)"
          >
            <Icon name="arrowUp" size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// App — top-level state container.
// ============================================================

const App = () => {
  // ---- Theme (persisted) ----
  const [theme, setTheme] = useStateT(() => {
    try { return localStorage.getItem('qd-theme') || 'light'; }
    catch { return 'light'; }
  });
  useEffectT(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('qd-theme', theme); } catch {}
  }, [theme]);

  // ---- Core state ----
  const [sessions, setSessions]   = useStateT(INITIAL_SESSIONS);
  const [openTabs, setOpenTabs]   = useStateT(INITIAL_OPEN_TABS);
  const [activeId, setActiveId]   = useStateT(INITIAL_ACTIVE_TAB);
  const [threads, setThreads]     = useStateT(THREADS_BY_SESSION);
  const [expandedSteps, setExpanded] = useStateT(new Set());
  const [model, setModel]         = useStateT(MODELS[0]);
  const [tokenPct, setTokenPct]   = useStateT(0.23);
  const [pendingReply, setPendingReply] = useStateT(false);

  const searchRef = useRefT(null);

  const sessionsById = useStateT(() => Object.fromEntries(sessions.map(s => [s.id, s])))[0];
  // Recompute when sessions change.
  const sessionsByIdLive = Object.fromEntries(sessions.map(s => [s.id, s]));
  const activeSession = sessionsByIdLive[activeId];
  const activeThread  = threads[activeId] || [];

  // ---- Actions -------------------------------------------------
  const openSession = (id) => {
    setActiveId(id);
    setOpenTabs(tabs => tabs.includes(id) ? tabs : [...tabs, id]);
  };

  const closeTab = (id) => {
    setOpenTabs(tabs => {
      const next = tabs.filter(t => t !== id);
      // If we closed the active tab, switch to the neighbour.
      if (id === activeId) {
        const idx = tabs.indexOf(id);
        const fallback = next[idx] || next[idx - 1] || next[0];
        setActiveId(fallback || null);
      }
      return next;
    });
  };

  const newSession = () => {
    const id = 'new-' + Date.now();
    const s = {
      id,
      title: 'New session',
      time: 'Now',
      status: 'new',
      lastActivity: Date.now(),
    };
    setSessions(prev => [s, ...prev]);
    setOpenTabs(tabs => [...tabs, id]);
    setActiveId(id);
    setThreads(t => ({ ...t, [id]: [] }));
  };

  const renameSession = (id, title) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
  };

  const toggleSteps = (mid) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(mid)) next.delete(mid); else next.add(mid);
      return next;
    });
  };

  const sendMessage = (body) => {
    if (!activeId) return;
    const userMsg = {
      id: 'u-' + Date.now(),
      role: 'user',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      body,
    };
    setThreads(t => ({ ...t, [activeId]: [...(t[activeId] || []), userMsg] }));
    setSessions(prev => prev.map(s => s.id === activeId ? { ...s, status: 'running', lastActivity: Date.now() } : s));
    setTokenPct(p => Math.min(0.99, p + 0.03));
    setPendingReply(true);

    // Mock reply — would be replaced by real streaming agent in app.
    setTimeout(() => {
      const replyMsg = {
        id: 'a-' + Date.now(),
        role: 'assistant',
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        stepsCount: 4,
        body: "Got it — I'll pick that up. (This is a mock reply; wire to your real agent loop.)",
        steps: [
          { kind: 'thought', body: 'Parsing user intent',   time: 'now' },
          { kind: 'tool', name: 'plan.create', body: 'task plan',       time: 'now' },
          { kind: 'thought', body: 'Selecting tools',        time: 'now' },
          { kind: 'tool', name: 'reply.draft', body: 'drafting response', time: 'now' },
        ],
      };
      setThreads(t => ({ ...t, [activeId]: [...(t[activeId] || []), replyMsg] }));
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, status: 'active' } : s));
      setPendingReply(false);
    }, 1200);
  };

  // ---- Keyboard shortcuts -------------------------------------
  useEffectT(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newSession();
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (mod && e.key === 'w' && activeId) {
        e.preventDefault();
        closeTab(activeId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, openTabs]);

  if (!activeSession) {
    return (
      <div className="app">
        <Sidebar
          sessions={sessions}
          activeSessionId={null}
          openTabIds={openTabs}
          onOpenSession={openSession}
          onNewSession={newSession}
          onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          theme={theme}
          searchRef={searchRef}
        />
        <div className="main">
          <div style={{
            margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', maxWidth: 360,
          }}>
            <p>No session open.</p>
            <button className="sidebar__new" style={{ width: 'auto', padding: '0 18px' }} onClick={newSession}>
              <Icon name="plus" size={13} strokeWidth={2} />
              Start one
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeId}
        openTabIds={openTabs}
        onOpenSession={openSession}
        onNewSession={newSession}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        theme={theme}
        searchRef={searchRef}
      />
      <div className="main">
        <TabStrip
          tabs={openTabs}
          activeId={activeId}
          sessionsById={sessionsByIdLive}
          onSwitch={setActiveId}
          onClose={closeTab}
          onNewSession={newSession}
          tokenPct={tokenPct}
        />
        <Header
          session={activeSession}
          model={model}
          onChangeModel={setModel}
          onRenameSession={renameSession}
        />
        <Thread
          messages={activeThread}
          expandedSteps={expandedSteps}
          onToggleSteps={toggleSteps}
        />
        <Composer
          onSend={sendMessage}
          tokenPct={tokenPct}
          disabled={pendingReply}
        />
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
