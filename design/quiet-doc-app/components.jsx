// ============================================================
// Sidebar — brand, new-session, primary nav, search, sessions list, footer.
// Sole navigation surface; tabs are open *workspaces*, this is the
// catalogue of everything.
// ============================================================

const { useState, useMemo, useRef, useEffect } = React;

const Sidebar = ({
  sessions, activeSessionId, openTabIds,
  onOpenSession, onNewSession, onToggleTheme, theme,
  searchRef,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return sessions;
    const q = query.toLowerCase();
    return sessions.filter(s => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  // Sort: pinned active sessions first, then by lastActivity desc.
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => b.lastActivity - a.lastActivity);
  }, [filtered]);

  return (
    <aside className="sidebar" aria-label="Sessions and navigation">
      <div className="sidebar__brand">
        <div className="sidebar__mark">
          <Icon name="sparkle" size={13} strokeWidth={1.8} />
        </div>
        <div className="sidebar__title">Copilot Console</div>
      </div>

      <button className="sidebar__new" onClick={onNewSession}>
        <Icon name="plus" size={13} strokeWidth={2} />
        New session
        <kbd>⌘N</kbd>
      </button>

      <nav className="sidebar__nav" aria-label="Primary">
        {[
          { icon: 'bot',        label: 'Agents',      count: 18 },
          { icon: 'automation', label: 'Automations', count: 6 },
          { icon: 'runs',       label: 'Runs' },
          { icon: 'flow',       label: 'Workflows',   count: 6 },
        ].map(item => (
          <button key={item.label} className="nav-item">
            <Icon name={item.icon} size={14} />
            <span className="nav-item__label">{item.label}</span>
            {item.count != null && <span className="nav-item__count">{item.count}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar__sessions-header">
        <span className="sidebar__sessions-label">Sessions</span>
        <span className="sidebar__sessions-count">{sessions.length}</span>
      </div>

      <div className="sidebar__search">
        <input
          ref={searchRef}
          type="text"
          className="sidebar__search-input"
          placeholder="Search…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
          }}
        />
        <Icon name="search" size={12} className="sidebar__search-icon" />
        {!query && <span className="sidebar__search-kbd">⌘K</span>}
      </div>

      <div className="sidebar__list">
        {sorted.length === 0 && (
          <div className="session-row__empty">No sessions match "{query}"</div>
        )}
        {sorted.map(s => (
          <button
            key={s.id}
            className="session-row"
            data-active={s.id === activeSessionId}
            onClick={() => onOpenSession(s.id)}
            title={s.title}
          >
            <span
              className="session-row__dot"
              style={{ background: `var(--status-${s.status})` }}
              aria-label={`status: ${s.status}`}
            />
            <div className="session-row__title">{s.title}</div>
            <div className="session-row__time">{s.time}</div>
          </button>
        ))}
      </div>

      <div className="sidebar__footer">
        <div className="sidebar__avatar">MN</div>
        <div className="sidebar__footer-name">Manas</div>
        <button
          className="sidebar__theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={14} />
        </button>
        <button className="sidebar__theme-toggle" aria-label="Settings">
          <Icon name="cog" size={14} />
        </button>
      </div>
    </aside>
  );
};

// ============================================================
// Tab strip — open sessions (workspaces). Switch / close / new.
// ============================================================

const TabStrip = ({
  tabs, activeId, sessionsById,
  onSwitch, onClose, onNewSession, tokenPct = 0.23,
}) => (
  <div className="tabstrip" role="tablist" aria-label="Open sessions">
    {tabs.map(id => {
      const s = sessionsById[id];
      if (!s) return null;
      const active = id === activeId;
      return (
        <button
          key={id}
          className="tab"
          role="tab"
          data-active={active}
          aria-selected={active}
          onClick={() => onSwitch(id)}
          title={s.title}
        >
          <span
            className="tab__dot"
            data-status={s.status}
            style={{ background: `var(--status-${s.status})` }}
          />
          <span className="tab__title">{s.title}</span>
          <span
            className="tab__close"
            role="button"
            tabIndex={-1}
            aria-label={`Close ${s.title}`}
            onClick={e => { e.stopPropagation(); onClose(id); }}
          >
            <Icon name="x" size={11} strokeWidth={1.8} />
          </span>
        </button>
      );
    })}
    <button
      className="tabstrip__add"
      onClick={onNewSession}
      aria-label="New session"
      title="New session (⌘N)"
    >
      <Icon name="plus" size={13} strokeWidth={2} />
    </button>
    <div className="tabstrip__spacer" />
    <div className="tabstrip__token-indicator" title="Context tokens used">
      <span>{Math.round(tokenPct * 100)}%</span>
      <div className="token-bar"><div className="token-bar__fill" style={{ width: `${tokenPct * 100}%` }} /></div>
      <span>125k</span>
    </div>
  </div>
);

// ============================================================
// Header — breadcrumb, editable title, model chip with popover
// ============================================================

const Header = ({ session, model, onChangeModel, onRenameSession }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerWrapRef = useRef(null);

  // Click-outside + Esc to close the popover.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e) => {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  // Editable title: contentEditable, commit on blur or Enter.
  const titleRef = useRef(null);
  const commitTitle = () => {
    const next = titleRef.current?.textContent?.trim();
    if (next && next !== session.title) onRenameSession(session.id, next);
    else if (titleRef.current) titleRef.current.textContent = session.title;
  };

  return (
    <header className="header">
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="header__breadcrumb">
          <Icon name="folder" size={12} />
          <span>Main Project</span>
          <span className="header__breadcrumb-sep">/</span>
          <span style={{ color: 'var(--text-dim)' }}>
            {session.status === 'running' ? 'Running…' : session.status === 'active' ? 'Active' : 'Idle'}
          </span>
        </div>
        <h1
          ref={titleRef}
          className="header__title header__title-editable"
          contentEditable
          suppressContentEditableWarning
          onBlur={commitTitle}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Escape') { e.currentTarget.textContent = session.title; e.currentTarget.blur(); }
          }}
        >{session.title}</h1>
      </div>

      <div ref={pickerWrapRef} style={{ position: 'relative' }}>
        <button
          className="model-chip"
          onClick={() => setPickerOpen(o => !o)}
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
        >
          <span className="model-chip__badge">{model.badge}</span>
          <span className="model-chip__name">{model.name}</span>
          <span className="model-chip__sep" />
          <span>5 tools · 13 MCP · 21 agents</span>
          <Icon name="chevDown" size={12} />
        </button>

        {pickerOpen && (
          <div className="popover" role="menu">
            <div className="popover__group-label">Model</div>
            {MODELS.map(m => (
              <button
                key={m.id}
                className="popover__item"
                data-active={m.id === model.id}
                onClick={() => { onChangeModel(m); setPickerOpen(false); }}
              >
                <span className="model-chip__badge">{m.badge}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span>{m.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.desc}</span>
                </span>
                {m.id === model.id && <Icon name="check" size={13} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
              </button>
            ))}
            <div className="popover__divider" />
            <button className="popover__item">
              <Icon name="cog" size={13} />
              <span>Model settings…</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

Object.assign(window, { Sidebar, TabStrip, Header });
