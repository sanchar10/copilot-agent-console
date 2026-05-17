// Direction 5 — "Composer"
// Cursor/Linear hybrid. All config lives INSIDE the message composer — no top
// action bar. Document-style thread. Sage accent. Quiet sidebar. Light.

const CO = {
  bg: 'oklch(0.99 0.003 150)',
  paper: 'oklch(0.985 0.005 150)',
  panel: 'oklch(0.965 0.006 150)',
  panelDeep: 'oklch(0.94 0.008 150)',
  border: 'oklch(0.91 0.006 150)',
  borderSoft: 'oklch(0.95 0.005 150)',
  text: 'oklch(0.20 0.01 150)',
  textDim: 'oklch(0.46 0.01 150)',
  textMuted: 'oklch(0.62 0.008 150)',
  accent: 'oklch(0.52 0.10 158)',
  accentSoft: 'oklch(0.94 0.04 158)',
};

const ComposerVariation = () => {
  return (
    <div style={{
      width: '100%', height: '100%', background: CO.bg, color: CO.text,
      fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
      fontSize: 13, letterSpacing: '-0.005em', display: 'flex', overflow: 'hidden',
    }}>
      {/* Quiet sidebar — collapsed by default, no session list visible at rest */}
      <aside style={{
        width: 56, flexShrink: 0, borderRight: `1px solid ${CO.borderSoft}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '14px 0', background: CO.paper,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: CO.accent, color: 'white',
          display: 'grid', placeItems: 'center', marginBottom: 6,
        }}>
          <Icon name="sparkle" size={15} strokeWidth={2} />
        </div>
        {[
          { icon: 'plus', primary: true },
          { icon: 'search' },
          { icon: 'bot', active: true },
          { icon: 'automation' },
          { icon: 'runs' },
          { icon: 'flow' },
        ].map((r, i) => (
          <button key={i} style={{
            width: 36, height: 34, borderRadius: 8, border: 0, cursor: 'pointer',
            background: r.primary ? CO.text : r.active ? CO.panel : 'transparent',
            color: r.primary ? CO.bg : r.active ? CO.text : CO.textMuted,
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name={r.icon} size={r.primary ? 13 : 14} strokeWidth={r.primary ? 2 : 1.5} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: CO.accent, color: 'white',
          display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600,
        }}>MN</div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tabs — slim */}
        <div style={{
          display: 'flex', alignItems: 'stretch', height: 36, borderBottom: `1px solid ${CO.borderSoft}`,
          paddingLeft: 6,
        }}>
          {OPEN_TABS.slice(0, 6).map(id => {
            const s = SESSIONS.find(x => x.id === id);
            const active = id === ACTIVE_TAB;
            return (
              <div key={id} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px',
                fontSize: 12, color: active ? CO.text : CO.textDim,
                cursor: 'pointer', minWidth: 0, maxWidth: 200, position: 'relative',
                fontWeight: active ? 500 : 400,
              }}>
                {active && <div style={{
                  position: 'absolute', bottom: -1, left: 12, right: 12, height: 2,
                  background: CO.accent, borderRadius: 1,
                }} />}
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: s.status === 'running' ? 'oklch(0.62 0.16 145)'
                    : s.status === 'active' ? CO.accent
                    : s.status === 'error' ? 'oklch(0.58 0.18 25)' : CO.textMuted,
                  opacity: active ? 1 : 0.7, flexShrink: 0,
                }} />
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s.title}</span>
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <button style={{
            alignSelf: 'center', marginRight: 12, display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 9px', borderRadius: 6, border: `1px solid ${CO.border}`,
            background: CO.paper, color: CO.textDim, fontSize: 11.5,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Icon name="search" size={11} /> Jump to…
            <span style={{ fontFamily: 'Geist Mono', color: CO.textMuted, marginLeft: 4 }}>⌘K</span>
          </button>
        </div>

        {/* Header — title + breadcrumb only */}
        <div style={{ padding: '24px 36px 14px', maxWidth: 760, width: '100%', margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 11, color: CO.textMuted, fontFamily: 'Geist Mono', marginBottom: 8,
          }}>
            <Icon name="folder" size={12} /><span>Main Project</span>
            <span style={{ opacity: 0.4 }}>·</span><span>9:08 PM</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: 'oklch(0.55 0.13 60)' }}>active</span>
          </div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
            color: CO.text, lineHeight: 1.2,
          }}>Give feedback on this LinkedIn profile</h1>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 36px 0' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {THREAD.map((m, i) => <COMessage key={i} m={m} />)}
          </div>
        </div>

        {/* Composer — the centerpiece. All config lives here. */}
        <div style={{ padding: '16px 36px 24px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{
              background: CO.paper, border: `1px solid ${CO.border}`, borderRadius: 14,
              padding: 0, boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 10px 30px -20px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}>
              {/* Context pills — only ones that need explicit toggle */}
              <div style={{
                padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: `1px solid ${CO.borderSoft}`,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 6px',
                  background: CO.accentSoft, color: CO.accent, borderRadius: 5, fontSize: 11.5, fontWeight: 500,
                }}>
                  <Icon name="folder" size={11} /> Main Project
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 7px',
                  background: CO.panel, color: CO.textDim, borderRadius: 5, fontSize: 11.5,
                }}>
                  <Icon name="extLink" size={10} /> linkedin.com/in/manas
                </span>
                <button style={{
                  padding: '3px 7px', background: 'transparent', border: `1px dashed ${CO.border}`,
                  borderRadius: 5, color: CO.textMuted, fontSize: 11.5, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>+ Add context</button>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: CO.textMuted, fontFamily: 'Geist Mono' }}>23% · 125k</span>
              </div>

              {/* Textarea zone */}
              <div style={{ padding: '14px 14px 6px', color: CO.textMuted, fontSize: 14, lineHeight: 1.5, minHeight: 44 }}>
                Ask Copilot to refine, expand, or apply the feedback…
              </div>

              {/* Bottom toolbar */}
              <div style={{
                padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 4,
                borderTop: `1px solid ${CO.borderSoft}`, background: CO.paper,
              }}>
                <button style={coTool}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, background: CO.accentSoft, color: CO.accent,
                    display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 600, fontFamily: 'Geist Mono',
                  }}>G5</span>
                  GPT-5.5
                  <Icon name="chevDown" size={11} />
                </button>
                <button style={coTool}>
                  Interactive
                  <Icon name="chevDown" size={11} />
                </button>
                <button style={coTool}>
                  <Icon name="tools" size={12} /> 5
                </button>
                <button style={coTool}>
                  <Icon name="mcp" size={12} /> 13
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'oklch(0.62 0.16 145)' }} />
                </button>
                <button style={coTool}>
                  <Icon name="bot" size={12} /> 21
                </button>
                <button style={coTool}>
                  <Icon name="paperclip" size={12} />
                </button>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: CO.textMuted, fontFamily: 'Geist Mono', marginRight: 6 }}>↵ to send</span>
                <button style={{
                  width: 30, height: 28, borderRadius: 7, border: 0,
                  background: CO.text, color: CO.bg, cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                }}><Icon name="arrowUp" size={13} strokeWidth={2.2} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const coTool = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6,
  border: 0, background: 'transparent', color: CO.textDim, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 11.5,
};

const COMessage = ({ m }) => {
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{
          background: CO.accent, color: 'white', padding: '9px 14px',
          borderRadius: 14, borderBottomRightRadius: 4, maxWidth: '76%',
          fontSize: 13.5, lineHeight: 1.5,
        }}>{m.body}</div>
        <div style={{ fontSize: 11, color: CO.textMuted, fontFamily: 'Geist Mono' }}>{m.time}</div>
      </div>
    );
  }
  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: CO.textMuted,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: CO.accent,
        }} />
        <span style={{ color: CO.text, fontWeight: 600, fontSize: 12.5, fontFamily: 'Geist' }}>Copilot</span>
        <span style={{ fontFamily: 'Geist Mono' }}>{m.time}</span>
        {m.steps && (
          <button style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '1px 7px 1px 6px',
            borderRadius: 4, border: `1px solid ${CO.border}`, background: 'transparent',
            color: CO.textMuted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Icon name="chevRight" size={9} /> {m.steps} steps
            {m.userInput && <span style={{ color: CO.accent }}>· input</span>}
          </button>
        )}
        {m.final && (
          <span style={{
            padding: '1px 7px', borderRadius: 4, background: CO.accentSoft, color: CO.accent,
            fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            fontFamily: 'Geist Mono',
          }}>Report</span>
        )}
      </div>
      <div style={{
        fontSize: 14.5, lineHeight: 1.6, color: CO.text, textWrap: 'pretty',
        paddingLeft: 12, borderLeft: `2px solid ${CO.borderSoft}`,
      }}>
        {m.body}
        {m.highestPriority && (
          <div style={{ marginTop: 14, fontSize: 13.5 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: CO.accent, fontFamily: 'Geist Mono', marginBottom: 4,
            }}>Highest-priority fix</div>
            <div style={{ color: CO.textDim }}>{m.highestPriority}</div>
          </div>
        )}
        {m.table && (
          <div style={{ marginTop: 16, fontSize: 13 }}>
            {m.table.map((row, i) => (
              <div key={i} style={{
                padding: '10px 0', borderTop: i ? `1px solid ${CO.borderSoft}` : `1px solid ${CO.border}`,
                display: 'grid', gridTemplateColumns: '92px 1fr', gap: 14, lineHeight: 1.5,
              }}>
                <div style={{ color: CO.accent, fontWeight: 500, fontSize: 12 }}>{row.area}</div>
                <div>
                  <div style={{ color: CO.textDim, marginBottom: 4 }}>{row.feedback}</div>
                  <div>{row.change}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
};

window.ComposerVariation = ComposerVariation;
