// Direction 2 — "Studio"
// Warm dark. Tabs only (slim icon rail on left for primary nav, no permanent
// session list — sessions are accessed via ⌘K or the rail's "All Sessions" pane).
// Per-session accent dots. Right-side drawer streams live steps.

const ST = {
  bg: 'oklch(0.16 0.005 60)',
  panel: 'oklch(0.20 0.006 60)',
  panelDeep: 'oklch(0.235 0.007 60)',
  border: 'oklch(0.275 0.006 60)',
  borderSoft: 'oklch(0.235 0.005 60)',
  text: 'oklch(0.93 0.01 60)',
  textDim: 'oklch(0.70 0.008 60)',
  textMuted: 'oklch(0.55 0.008 60)',
  accent: 'oklch(0.78 0.13 70)',
  accentSoft: 'oklch(0.30 0.08 70)',
};

const SESSION_ACCENTS = {
  s1: 70,   // amber (active)
  s2: 25,   // red-orange
  s3: 250,  // blue
  s4: 145,  // green
  s5: 295,  // violet
  s6: 200,  // teal
};

const StudioVariation = () => {
  return (
    <div style={{
      width: '100%', height: '100%', background: ST.bg, color: ST.text,
      fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
      fontSize: 13, letterSpacing: '-0.005em', display: 'flex', overflow: 'hidden',
    }}>
      {/* Slim icon rail */}
      <aside style={{
        width: 52, flexShrink: 0, borderRight: `1px solid ${ST.borderSoft}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 0', gap: 4, background: ST.bg,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: ST.accent,
          color: ST.bg, display: 'grid', placeItems: 'center', marginBottom: 8,
        }}>
          <Icon name="sparkle" size={15} strokeWidth={2} />
        </div>
        {[
          { icon: 'bot', active: true, badge: 18 },
          { icon: 'automation', badge: 6 },
          { icon: 'runs' },
          { icon: 'flow', badge: 6 },
          { icon: 'layers' },
        ].map((r, i) => (
          <button key={i} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 8, border: 0, cursor: 'pointer',
            background: r.active ? ST.panel : 'transparent',
            color: r.active ? ST.text : ST.textMuted,
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name={r.icon} size={16} />
            {r.badge && (
              <span style={{
                position: 'absolute', top: 4, right: 4, minWidth: 6, height: 6, borderRadius: 3,
                background: ST.accent,
              }} />
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{
          width: 36, height: 36, borderRadius: 8, border: 0, cursor: 'pointer',
          background: 'transparent', color: ST.textMuted, display: 'grid', placeItems: 'center',
        }}>
          <Icon name="cog" size={16} />
        </button>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', background: 'oklch(0.4 0.06 70)',
          color: ST.text, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600,
          marginTop: 4,
        }}>MN</div>
      </aside>

      {/* Main column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'stretch', height: 40, borderBottom: `1px solid ${ST.borderSoft}`,
          paddingRight: 8,
        }}>
          {OPEN_TABS.map(id => {
            const s = SESSIONS.find(x => x.id === id);
            const active = id === ACTIVE_TAB;
            const hue = SESSION_ACCENTS[id] || 60;
            return (
              <div key={id} style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
                padding: '0 14px 0 16px', cursor: 'pointer', minWidth: 0, maxWidth: 220,
                borderRight: `1px solid ${ST.borderSoft}`,
                background: active ? ST.panel : 'transparent',
              }}>
                {active && <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: `oklch(0.78 0.14 ${hue})`,
                }} />}
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: `oklch(0.78 0.14 ${hue})`, flexShrink: 0,
                  boxShadow: s.status === 'running' ? `0 0 0 3px oklch(0.78 0.14 ${hue} / 0.2)` : 'none',
                }} />
                <span style={{
                  fontSize: 12.5, color: active ? ST.text : ST.textDim, fontWeight: active ? 500 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s.title}</span>
                <Icon name="x" size={12} style={{ color: ST.textMuted, opacity: active ? 0.7 : 0, marginLeft: 4 }} />
              </div>
            );
          })}
          <button style={{
            width: 36, display: 'grid', placeItems: 'center', border: 0, background: 'transparent',
            color: ST.textMuted, cursor: 'pointer',
          }}><Icon name="plus" size={14} /></button>
          <div style={{ flex: 1 }} />
          <button style={{
            alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 9px', borderRadius: 6, border: `1px solid ${ST.border}`,
            background: ST.panel, color: ST.textDim, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5,
          }}>
            <Icon name="search" size={11} /> Find session
            <span style={{ fontFamily: 'Geist Mono', color: ST.textMuted, marginLeft: 6 }}>⌘K</span>
          </button>
        </div>

        {/* Content area split into thread + drawer */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Thread */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{
              padding: '16px 28px 12px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                width: 9, height: 9, borderRadius: '50%', background: `oklch(0.78 0.14 70)`,
                boxShadow: `0 0 0 4px oklch(0.78 0.14 70 / 0.18)`,
              }} />
              <h2 style={{
                margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em',
                flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>Give feedback on this LinkedIn profile</h2>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                color: ST.textMuted, fontFamily: 'Geist Mono',
              }}>
                <Icon name="pulse" size={12} /> 23% · 125k
              </div>
              <button style={stIconBtn}><Icon name="extLink" size={13} /></button>
              <button style={stIconBtn}><Icon name="more" size={13} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 28px 0' }}>
              <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {THREAD.map((m, i) => <STMessage key={i} m={m} />)}
              </div>
            </div>

            {/* Composer */}
            <div style={{ padding: '12px 28px 18px' }}>
              <div style={{ maxWidth: 680, margin: '0 auto' }}>
                <div style={{
                  background: ST.panel, border: `1px solid ${ST.border}`, borderRadius: 12,
                  padding: 10,
                }}>
                  <div style={{ color: ST.textMuted, fontSize: 13, padding: '4px 6px 16px' }}>
                    Reply to Copilot…
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button style={stChip}><Icon name="paperclip" size={12} /></button>
                    <button style={stChip}>
                      <span style={{
                        width: 14, height: 14, borderRadius: 4, background: ST.accentSoft,
                        color: ST.accent, display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 600,
                        fontFamily: 'Geist Mono',
                      }}>G5</span>
                      GPT-5.5
                    </button>
                    <button style={stChip}>Interactive <Icon name="chevDown" size={10} /></button>
                    <div style={{ flex: 1 }} />
                    <button style={{
                      width: 28, height: 28, borderRadius: 7, border: 0,
                      background: ST.accent, color: ST.bg, cursor: 'pointer',
                      display: 'grid', placeItems: 'center',
                    }}><Icon name="arrowUp" size={13} strokeWidth={2.2} /></button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right drawer — live steps */}
          <aside style={{
            width: 280, flexShrink: 0, borderLeft: `1px solid ${ST.borderSoft}`,
            background: ST.bg, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: `1px solid ${ST.borderSoft}`,
            }}>
              <Icon name="pulse" size={13} style={{ color: ST.accent }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Activity</span>
              <span style={{ fontSize: 11, color: ST.textMuted, fontFamily: 'Geist Mono', marginLeft: 'auto' }}>26 steps</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              <STActivityRail />
            </div>

            <div style={{
              padding: '10px 16px', borderTop: `1px solid ${ST.borderSoft}`,
              fontSize: 11, color: ST.textMuted, fontFamily: 'Geist Mono',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Sub-agents 0/21</span>
              <span>MCP 1/13</span>
              <span>Tools 0/5</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

const stIconBtn = {
  width: 26, height: 26, borderRadius: 6, border: 0, background: 'transparent',
  color: ST.textMuted, cursor: 'pointer', display: 'grid', placeItems: 'center',
};

const stChip = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 6,
  border: `1px solid ${ST.borderSoft}`, background: ST.panelDeep, color: ST.textDim,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5,
};

const STMessage = ({ m }) => {
  if (m.role === 'user') {
    return (
      <div style={{
        alignSelf: 'flex-end', maxWidth: '78%',
        background: ST.accentSoft, color: ST.text,
        borderRadius: 14, borderTopRightRadius: 4,
        padding: '10px 14px', fontSize: 13.5, lineHeight: 1.5,
        border: `1px solid ${ST.border}`,
      }}>{m.body}</div>
    );
  }
  return (
    <div style={{
      background: ST.panel, border: `1px solid ${ST.borderSoft}`, borderRadius: 12,
      padding: '12px 14px', position: 'relative',
    }}>
      {m.final && (
        <span style={{
          position: 'absolute', top: -7, left: 14,
          padding: '2px 7px', borderRadius: 4, background: ST.accent, color: ST.bg,
          fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
          fontFamily: 'Geist Mono',
        }}>Final</span>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        fontSize: 11, color: ST.textMuted, fontFamily: 'Geist Mono',
      }}>
        <span style={{ color: ST.text, fontFamily: 'Geist', fontWeight: 600, fontSize: 12 }}>Copilot</span>
        <span>{m.time}</span>
        {m.steps && <><span>·</span><span>{m.steps} steps</span></>}
        {m.userInput && <span style={{ color: ST.accent }}>· 1 input</span>}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, textWrap: 'pretty' }}>{m.body}</div>
      {m.highestPriority && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 8,
          background: 'oklch(0.25 0.06 70)', borderLeft: `2px solid ${ST.accent}`,
          fontSize: 12.5, lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 600, color: ST.accent }}>Highest-priority fix · </span>
          <span style={{ color: ST.textDim }}>{m.highestPriority}</span>
        </div>
      )}
      {m.table && (
        <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
          {m.table.map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '88px 1fr 1fr', gap: 12,
              padding: '8px 0', borderTop: i ? `1px solid ${ST.borderSoft}` : 'none',
            }}>
              <div style={{ color: ST.accent, fontWeight: 500 }}>{row.area}</div>
              <div style={{ color: ST.textDim }}>{row.feedback}</div>
              <div>{row.change}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Activity rail showing recent agent steps as a vertical timeline
const STActivityRail = () => {
  const steps = [
    { type: 'tool', name: 'web_fetch', meta: 'linkedin.com/in/…', t: '9:08' },
    { type: 'thought', body: 'Checking public access', t: '9:09' },
    { type: 'tool', name: 'web_search', meta: '"profile snippet"', t: '9:10' },
    { type: 'input', body: 'Awaiting credentials', t: '9:10' },
    { type: 'tool', name: 'browser.open', meta: 'sign-in page', t: '9:11' },
    { type: 'thought', body: 'Profile reachable', t: '9:12' },
    { type: 'tool', name: 'browser.scroll', meta: 'About → Experience', t: '9:13' },
    { type: 'tool', name: 'browser.extract', meta: 'Headline + Featured', t: '9:14' },
    { type: 'thought', body: 'Drafting feedback', t: '9:16' },
    { type: 'final', body: 'Delivered report', t: '9:17' },
  ];
  return (
    <div style={{ position: 'relative', padding: '4px 16px 4px 22px' }}>
      <div style={{
        position: 'absolute', left: 28, top: 12, bottom: 12, width: 1,
        background: `linear-gradient(to bottom, transparent, ${ST.border} 12%, ${ST.border} 88%, transparent)`,
      }} />
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', position: 'relative' }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3,
            background: s.type === 'final' ? ST.accent : ST.panel,
            border: `1px solid ${s.type === 'final' ? ST.accent : ST.border}`,
            display: 'grid', placeItems: 'center',
            boxShadow: s.type === 'final' ? `0 0 0 3px oklch(0.78 0.14 70 / 0.2)` : 'none',
          }}>
            {s.type === 'tool' && <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'oklch(0.7 0.1 200)' }} />}
            {s.type === 'thought' && <span style={{ width: 4, height: 4, borderRadius: '50%', background: ST.textMuted }} />}
            {s.type === 'input' && <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'oklch(0.7 0.13 295)' }} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
              {s.type === 'tool' && <><span style={{ color: ST.textMuted }}>tool · </span><span style={{ fontFamily: 'Geist Mono', fontSize: 11.5 }}>{s.name}</span></>}
              {s.type === 'thought' && <span style={{ color: ST.textDim, fontStyle: 'italic' }}>{s.body}</span>}
              {s.type === 'input' && <span style={{ color: 'oklch(0.78 0.12 295)' }}>{s.body}</span>}
              {s.type === 'final' && <span style={{ color: ST.accent, fontWeight: 500 }}>{s.body}</span>}
            </div>
            {s.meta && <div style={{ fontSize: 11, color: ST.textMuted, fontFamily: 'Geist Mono', marginTop: 2 }}>{s.meta}</div>}
          </div>
          <span style={{ fontSize: 10.5, color: ST.textMuted, fontFamily: 'Geist Mono', marginTop: 3 }}>{s.t}</span>
        </div>
      ))}
    </div>
  );
};

window.StudioVariation = StudioVariation;
