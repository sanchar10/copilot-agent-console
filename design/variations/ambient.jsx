// Direction 4 — "Ambient"
// Status-driven color. Icon rail (collapsed sidebar) + a hover-out "Sessions"
// drawer with sparklines and tokens-used bars. Tabs prominent, each with a
// live activity dot. Adaptive — chrome quiets when thread is the focus.

const AM = {
  bg: 'oklch(0.155 0.005 270)',
  panel: 'oklch(0.195 0.006 270)',
  panelDeep: 'oklch(0.225 0.007 270)',
  border: 'oklch(0.265 0.007 270)',
  borderSoft: 'oklch(0.225 0.006 270)',
  text: 'oklch(0.95 0.005 270)',
  textDim: 'oklch(0.72 0.008 270)',
  textMuted: 'oklch(0.52 0.008 270)',
  ok: 'oklch(0.78 0.16 145)',
  warn: 'oklch(0.78 0.14 70)',
  err: 'oklch(0.72 0.18 25)',
  user: 'oklch(0.74 0.13 270)',
};

const AmbientVariation = () => {
  return (
    <div style={{
      width: '100%', height: '100%', background: AM.bg, color: AM.text,
      fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
      fontSize: 13, letterSpacing: '-0.005em', display: 'flex', overflow: 'hidden',
    }}>
      {/* Icon rail */}
      <aside style={{
        width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 0', gap: 4, background: 'oklch(0.135 0.005 270)',
        borderRight: `1px solid ${AM.borderSoft}`,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: AM.user, color: AM.bg,
          display: 'grid', placeItems: 'center', marginBottom: 8,
        }}>
          <Icon name="sparkle" size={15} strokeWidth={2} />
        </div>
        {[
          { icon: 'bot', active: true, status: 'running' },
          { icon: 'automation', status: 'idle' },
          { icon: 'runs', status: 'idle' },
          { icon: 'flow', status: 'idle' },
        ].map((r, i) => (
          <button key={i} style={{
            position: 'relative', width: 32, height: 32, borderRadius: 7, border: 0, cursor: 'pointer',
            background: r.active ? AM.panel : 'transparent',
            color: r.active ? AM.text : AM.textMuted,
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name={r.icon} size={15} />
            {r.status === 'running' && (
              <span style={{
                position: 'absolute', bottom: 3, right: 3, width: 6, height: 6, borderRadius: '50%',
                background: AM.ok, boxShadow: `0 0 0 2px oklch(0.78 0.16 145 / 0.25)`,
              }} />
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={amRailBtn}><Icon name="search" size={14} /></button>
        <button style={amRailBtn}><Icon name="cog" size={14} /></button>
      </aside>

      {/* Sessions drawer — sticky open at left */}
      <aside style={{
        width: 268, flexShrink: 0, background: AM.bg,
        borderRight: `1px solid ${AM.borderSoft}`,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 14px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Sessions</span>
            <span style={{ fontSize: 11, color: AM.textMuted, fontFamily: 'Geist Mono' }}>212</span>
            <button style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
              background: AM.panel, border: `1px solid ${AM.border}`, borderRadius: 6,
              color: AM.text, fontFamily: 'inherit', fontSize: 11.5, cursor: 'pointer',
            }}><Icon name="plus" size={11} strokeWidth={2} /> New</button>
          </div>

          {/* "Now" filter row */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[
              { label: 'Live', dot: AM.ok, n: 2 },
              { label: 'Active', dot: AM.warn, n: 1 },
              { label: 'New', dot: AM.user, n: 2 },
              { label: 'Issue', dot: AM.err, n: 1 },
            ].map(c => (
              <div key={c.label} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 7px',
                background: AM.panel, borderRadius: 5, fontSize: 11, color: AM.textDim,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />
                {c.label}<span style={{ color: AM.textMuted, fontFamily: 'Geist Mono' }}>{c.n}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {SESSIONS.slice(0, 10).map((s, i) => {
            const active = s.id === ACTIVE_TAB;
            const col = statusColor(s.status, false);
            return (
              <div key={s.id} style={{
                padding: '9px 10px', borderRadius: 8, marginBottom: 2,
                background: active ? AM.panel : 'transparent', cursor: 'pointer',
                border: `1px solid ${active ? AM.border : 'transparent'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0,
                    boxShadow: s.status === 'running' || s.status === 'active'
                      ? `0 0 0 3px ${col.replace(')', ' / 0.18)')}` : 'none',
                  }} />
                  <span style={{
                    fontSize: 12.5, fontWeight: active ? 500 : 400,
                    color: active ? AM.text : AM.textDim, flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{s.title}</span>
                  <span style={{ fontSize: 10.5, color: AM.textMuted, fontFamily: 'Geist Mono' }}>{s.time}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14 }}>
                  <div style={{ flex: 1, height: 3, background: AM.panel, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${s.tokens * 100}%`, height: '100%', background: col, opacity: 0.55 }} />
                  </div>
                  <span style={{ color: col, opacity: 0.85 }}>
                    <Sparkline data={s.sparkline} w={44} h={10} color="currentColor" />
                  </span>
                  {s.agents > 0 && (
                    <span style={{
                      fontSize: 10, color: AM.textMuted, fontFamily: 'Geist Mono',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <Icon name="bot" size={10} />{s.agents}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tab bar — sleek, with status pulses */}
        <div style={{
          display: 'flex', alignItems: 'stretch', height: 38, borderBottom: `1px solid ${AM.borderSoft}`,
          background: AM.bg, padding: '0 8px',
        }}>
          {OPEN_TABS.map(id => {
            const s = SESSIONS.find(x => x.id === id);
            const active = id === ACTIVE_TAB;
            const col = statusColor(s.status, false);
            return (
              <div key={id} style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 7,
                padding: '0 12px', cursor: 'pointer', minWidth: 0, maxWidth: 200,
                margin: '6px 2px 0', borderRadius: '8px 8px 0 0',
                background: active ? AM.panel : 'transparent',
                color: active ? AM.text : AM.textDim,
              }}>
                {active && <div style={{
                  position: 'absolute', top: 0, left: 8, right: 8, height: 2,
                  background: col, borderRadius: 2,
                }} />}
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: col,
                  boxShadow: s.status === 'running' ? `0 0 0 3px ${col.replace(')', ' / 0.2)')}` : 'none',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: active ? 500 : 400,
                }}>{s.title}</span>
              </div>
            );
          })}
          <button style={{
            alignSelf: 'center', marginLeft: 4, width: 26, height: 26, borderRadius: 6,
            border: 0, background: 'transparent', color: AM.textMuted, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}><Icon name="plus" size={13} /></button>
          <div style={{ flex: 1 }} />
        </div>

        {/* Adaptive sub-header — collapsed by default to a single ambient line */}
        <div style={{
          padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 14,
          background: AM.panel, borderBottom: `1px solid ${AM.borderSoft}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: AM.warn,
              boxShadow: `0 0 0 4px oklch(0.78 0.14 70 / 0.18)`,
            }} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>Give feedback on this LinkedIn profile</span>
          </div>
          <span style={{ color: AM.textMuted }}>·</span>
          <span style={{ fontSize: 12, color: AM.textDim }}>active for 9m</span>
          <span style={{ color: AM.textMuted }}>·</span>
          <span style={{ fontSize: 12, color: AM.textDim }}>26 steps</span>
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: AM.textDim,
            padding: '4px 9px', borderRadius: 6, background: AM.panelDeep,
          }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: 'oklch(0.32 0.08 270)',
              color: AM.user, display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 600,
              fontFamily: 'Geist Mono' }}>G5</span>
            GPT-5.5 · xhigh
            <Icon name="chevDown" size={11} />
          </div>
          <div style={{ fontSize: 11, color: AM.textMuted, fontFamily: 'Geist Mono', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="pulse" size={11} /> 23%
          </div>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 0' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {THREAD.map((m, i) => <AMMessage key={i} m={m} />)}
          </div>
        </div>

        {/* Composer */}
        <div style={{ padding: '12px 24px 18px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{
              background: AM.panel, border: `1px solid ${AM.border}`, borderRadius: 14,
              padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ color: AM.textMuted, fontSize: 13.5, padding: '2px 4px', minHeight: 24 }}>
                Continue the conversation…
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={amChip}><Icon name="paperclip" size={12} /></button>
                <div style={{ display: 'flex', gap: 4, padding: '2px', background: AM.panelDeep, borderRadius: 6 }}>
                  {['Chat', 'Interactive', 'Auto'].map((m, i) => (
                    <button key={m} style={{
                      padding: '3px 9px', borderRadius: 4, border: 0,
                      background: i === 1 ? AM.bg : 'transparent',
                      color: i === 1 ? AM.text : AM.textMuted,
                      fontFamily: 'inherit', fontSize: 11.5, cursor: 'pointer',
                    }}>{m}</button>
                  ))}
                </div>
                <div style={{ flex: 1 }} />
                <button style={{
                  width: 30, height: 30, borderRadius: 8, border: 0,
                  background: AM.warn, color: AM.bg, cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                  boxShadow: '0 0 18px oklch(0.78 0.14 70 / 0.25)',
                }}><Icon name="arrowUp" size={14} strokeWidth={2.2} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const amRailBtn = {
  width: 32, height: 32, borderRadius: 7, border: 0, background: 'transparent',
  color: 'oklch(0.6 0.008 270)', cursor: 'pointer', display: 'grid', placeItems: 'center',
};

const amChip = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 6,
  border: 0, background: AM.panelDeep, color: AM.textDim, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 11.5,
};

const AMMessage = ({ m }) => {
  if (m.role === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>
        <div style={{
          background: 'oklch(0.28 0.07 270)', color: AM.text,
          padding: '9px 13px', borderRadius: 12, borderTopRightRadius: 4,
          fontSize: 13.5, lineHeight: 1.5,
        }}>{m.body}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: AM.panel,
        border: `1px solid ${AM.borderSoft}`, color: AM.ok,
        display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1,
        boxShadow: m.final ? `0 0 0 3px oklch(0.78 0.16 145 / 0.15)` : 'none',
      }}>
        <Icon name="sparkle" size={13} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Copilot</span>
          <span style={{ fontSize: 11, color: AM.textMuted, fontFamily: 'Geist Mono' }}>{m.time}</span>
          {m.steps && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: AM.textMuted,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: AM.textMuted }} />
              <span>{m.steps} steps</span>
              {m.userInput && <span style={{ color: AM.user }}>· 1 input</span>}
            </div>
          )}
          {m.final && (
            <span style={{
              padding: '1px 7px', borderRadius: 4, background: 'oklch(0.30 0.08 145)',
              color: AM.ok, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'Geist Mono',
            }}>Final</span>
          )}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, textWrap: 'pretty' }}>{m.body}</div>
        {m.highestPriority && (
          <div style={{
            marginTop: 12, padding: '11px 13px', borderRadius: 10,
            background: 'oklch(0.22 0.04 70)',
            fontSize: 13, lineHeight: 1.5,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: AM.warn, letterSpacing: '0.05em',
              textTransform: 'uppercase', fontFamily: 'Geist Mono', marginBottom: 4,
            }}>Highest-priority fix</div>
            <div style={{ color: AM.textDim }}>{m.highestPriority}</div>
          </div>
        )}
        {m.table && (
          <div style={{
            marginTop: 12, background: AM.panel, borderRadius: 10,
            border: `1px solid ${AM.borderSoft}`, overflow: 'hidden',
          }}>
            {m.table.map((row, i) => (
              <div key={i} style={{
                padding: '10px 12px', borderTop: i ? `1px solid ${AM.borderSoft}` : 'none',
                display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12,
                fontSize: 12.5, lineHeight: 1.5,
              }}>
                <div style={{ color: AM.warn, fontWeight: 500 }}>{row.area}</div>
                <div>
                  <div style={{ color: AM.textDim, marginBottom: 4 }}>{row.feedback}</div>
                  <div>{row.change}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

window.AmbientVariation = AmbientVariation;
