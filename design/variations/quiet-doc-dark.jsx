// Direction 6 — "Quiet Doc · Dark twin"
// Same structural decisions as Quiet Doc (light) but on a soft warm-dark palette.
// Lets you compare theme treatment of the same direction directly.

const QDD = {
  bg: 'oklch(0.165 0.005 270)',
  panel: 'oklch(0.205 0.006 270)',
  panelDeep: 'oklch(0.245 0.007 270)',
  border: 'oklch(0.28 0.007 270)',
  borderSoft: 'oklch(0.235 0.006 270)',
  text: 'oklch(0.95 0.005 270)',
  textDim: 'oklch(0.72 0.008 270)',
  textMuted: 'oklch(0.52 0.008 270)',
  accent: 'oklch(0.74 0.13 268)',
  accentSoft: 'oklch(0.30 0.07 268)',
  accentText: 'oklch(0.80 0.10 268)',
  agentMark: 'oklch(0.74 0.12 158)',
};

const QuietDocDarkVariation = () => {
  return (
    <div style={{
      width: '100%', height: '100%', background: QDD.bg, color: QDD.text,
      fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
      fontSize: 13, letterSpacing: '-0.005em', display: 'flex', overflow: 'hidden',
    }}>
      <aside style={{
        width: 260, flexShrink: 0, borderRight: `1px solid ${QDD.borderSoft}`,
        background: 'oklch(0.145 0.005 270)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, background: QDD.accent, color: QDD.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="sparkle" size={13} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-0.01em' }}>Copilot Console</div>
          <div style={{ marginLeft: 'auto' }}>
            <button style={{
              width: 24, height: 24, borderRadius: 5, border: 0, background: 'transparent',
              color: QDD.textDim, display: 'grid', placeItems: 'center', cursor: 'pointer',
            }}><Icon name="search" size={14} /></button>
          </div>
        </div>

        <div style={{ padding: '4px 10px 10px' }}>
          <button style={{
            width: '100%', height: 32, borderRadius: 7,
            background: QDD.text, color: QDD.bg, border: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500, letterSpacing: '-0.005em',
          }}>
            <Icon name="plus" size={13} strokeWidth={2} />New session
            <span style={{ marginLeft: 8, opacity: 0.55, fontSize: 11, fontFamily: 'Geist Mono' }}>⌘N</span>
          </button>
        </div>

        <nav style={{ padding: '2px 6px 12px' }}>
          {[
            { icon: 'bot', label: 'Agents', count: 18 },
            { icon: 'automation', label: 'Automations', count: 6 },
            { icon: 'runs', label: 'Runs' },
            { icon: 'flow', label: 'Workflows', count: 6 },
          ].map(n => (
            <div key={n.label} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px',
              borderRadius: 6, color: QDD.textDim, cursor: 'pointer', fontSize: 13,
            }}>
              <Icon name={n.icon} size={14} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.count && <span style={{ fontSize: 11, color: QDD.textMuted, fontFamily: 'Geist Mono' }}>{n.count}</span>}
            </div>
          ))}
        </nav>

        <div style={{
          padding: '10px 12px 6px', borderTop: `1px solid ${QDD.borderSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: QDD.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Sessions</span>
          <span style={{ fontSize: 11, color: QDD.textMuted, fontFamily: 'Geist Mono' }}>212</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '2px 6px 10px' }}>
          {SESSIONS.slice(0, 11).map((s) => {
            const active = s.id === ACTIVE_TAB;
            return (
              <div key={s.id} style={{
                position: 'relative', padding: '7px 10px 7px 18px', borderRadius: 6,
                marginBottom: 1, cursor: 'pointer',
                background: active ? QDD.panel : 'transparent',
                color: active ? QDD.text : QDD.textDim,
              }}>
                <div style={{
                  position: 'absolute', left: 7, top: 13, width: 5, height: 5, borderRadius: '50%',
                  background: s.status === 'running' ? 'oklch(0.74 0.16 145)'
                    : s.status === 'active' ? QDD.accent
                    : s.status === 'error' ? 'oklch(0.72 0.18 25)'
                    : s.status === 'new' ? 'oklch(0.74 0.13 250)'
                    : 'transparent',
                }} />
                <div style={{
                  fontSize: 13, fontWeight: active ? 500 : 400, lineHeight: 1.35,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  letterSpacing: '-0.005em',
                }}>{s.title}</div>
                <div style={{
                  fontSize: 11, color: QDD.textMuted, marginTop: 1,
                  fontFamily: 'Geist Mono', letterSpacing: '0.01em',
                }}>{s.time}</div>
              </div>
            );
          })}
        </div>

        <div style={{
          padding: '10px 14px', borderTop: `1px solid ${QDD.borderSoft}`,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: QDD.textMuted,
        }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: QDD.accent, color: QDD.bg,
            display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600 }}>MN</div>
          <div style={{ flex: 1 }}>Manas</div>
          <Icon name="cog" size={13} />
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          padding: '20px 36px 16px', borderBottom: `1px solid ${QDD.borderSoft}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, color: QDD.textMuted,
              fontSize: 11.5, marginBottom: 6, fontFamily: 'Geist Mono',
            }}>
              <Icon name="folder" size={12} /><span>Main Project</span>
              <span style={{ opacity: 0.5 }}>/</span>
              <span style={{ color: QDD.textDim }}>Active</span>
            </div>
            <h1 style={{
              margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em',
              color: QDD.text, lineHeight: 1.2,
            }}>Give feedback on this LinkedIn profile</h1>
          </div>

          <button style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 8px',
            background: QDD.panel, border: `1px solid ${QDD.border}`, borderRadius: 8,
            color: QDD.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4, background: QDD.accentSoft, color: QDD.accentText,
              display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 600, fontFamily: 'Geist Mono',
            }}>G5</span>
            <span style={{ color: QDD.text, fontWeight: 500 }}>GPT-5.5</span>
            <span style={{ width: 1, height: 12, background: QDD.border }} />
            <span>5 tools · 13 MCP · 21 agents</span>
            <Icon name="chevDown" size={12} style={{ marginLeft: 2 }} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px 40px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
            {THREAD.map((m, i) => <QDDMessage key={i} m={m} />)}
          </div>
        </div>

        <div style={{ padding: '12px 36px 20px', borderTop: `1px solid ${QDD.borderSoft}` }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{
              border: `1px solid ${QDD.border}`, borderRadius: 12, background: QDD.panel,
              padding: '12px 12px 8px',
            }}>
              <div style={{ color: QDD.textMuted, fontSize: 13.5, padding: '2px 4px 14px', minHeight: 28 }}>
                Reply to Copilot…
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button style={qddGhost}><Icon name="paperclip" size={13} /></button>
                <button style={qddGhost}>Interactive <Icon name="chevDown" size={11} /></button>
                <div style={{ flex: 1 }} />
                <div style={{ color: QDD.textMuted, fontSize: 11, fontFamily: 'Geist Mono' }}>23% · 125k</div>
                <button style={{
                  width: 28, height: 28, borderRadius: 7, border: 0,
                  background: QDD.text, color: QDD.bg, cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                }}><Icon name="arrowUp" size={14} strokeWidth={2} /></button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const qddGhost = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
  border: 0, background: 'transparent', color: QDD.textDim, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12,
};

const QDDMessage = ({ m }) => {
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{
          background: QDD.accent, color: QDD.bg, padding: '9px 14px', borderRadius: 14,
          borderBottomRightRadius: 4, maxWidth: '70%', fontSize: 13.5, lineHeight: 1.5,
        }}>{m.body}</div>
        <div style={{ fontSize: 11, color: QDD.textMuted, fontFamily: 'Geist Mono' }}>{m.time}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8, background: QDD.bg,
        border: `1px solid ${QDD.border}`, color: QDD.agentMark,
        display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2,
      }}>
        <Icon name="sparkle" size={13} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Copilot</span>
          <span style={{ fontSize: 11, color: QDD.textMuted, fontFamily: 'Geist Mono' }}>{m.time}</span>
          {m.steps && (
            <button style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '2px 7px 2px 6px',
              borderRadius: 5, border: 0, background: QDD.panel, color: QDD.textDim,
              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Icon name="chevRight" size={10} />
              {m.steps} steps
              {m.userInput && <span style={{ color: QDD.accentText, marginLeft: 2 }}>· 1 input</span>}
            </button>
          )}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: QDD.text, textWrap: 'pretty' }}>{m.body}</div>
        {m.highestPriority && (
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 8,
            background: QDD.accentSoft, border: `1px solid oklch(0.38 0.08 268)`,
            fontSize: 13.5, lineHeight: 1.55, color: QDD.text,
          }}>
            <span style={{ fontWeight: 600, color: QDD.accentText }}>Highest-priority fix: </span>
            <span style={{ color: QDD.textDim }}>{m.highestPriority}</span>
          </div>
        )}
        {m.table && (
          <div style={{
            marginTop: 14, border: `1px solid ${QDD.border}`, borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 0,
              fontSize: 11, color: QDD.textMuted, padding: '8px 12px',
              background: QDD.panel, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              <div>Area</div><div>Feedback</div><div>Suggested change</div>
            </div>
            {m.table.map((row, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 0,
                padding: '10px 12px', fontSize: 12.5, lineHeight: 1.5,
                borderTop: `1px solid ${QDD.borderSoft}`,
              }}>
                <div style={{ fontWeight: 500 }}>{row.area}</div>
                <div style={{ color: QDD.textDim, paddingRight: 12 }}>{row.feedback}</div>
                <div style={{ color: QDD.text, paddingRight: 4 }}>{row.change}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

window.QuietDocDarkVariation = QuietDocDarkVariation;
