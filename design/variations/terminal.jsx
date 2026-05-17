// Direction 3 — "Terminal"
// Dense power-user. Monochrome. Mono-typography for chrome.
// Inline streaming steps. ⌘K driven. Both sidebar + tabs kept, both compressed.

const TR = {
  bg: 'oklch(0.13 0.003 240)',
  panel: 'oklch(0.165 0.004 240)',
  panelDeep: 'oklch(0.205 0.005 240)',
  border: 'oklch(0.245 0.006 240)',
  borderSoft: 'oklch(0.20 0.005 240)',
  text: 'oklch(0.94 0.005 240)',
  textDim: 'oklch(0.72 0.006 240)',
  textMuted: 'oklch(0.50 0.007 240)',
  accent: 'oklch(0.85 0.04 145)',
  ok: 'oklch(0.78 0.14 145)',
  warn: 'oklch(0.80 0.13 80)',
  err: 'oklch(0.74 0.16 25)',
  user: 'oklch(0.78 0.12 250)',
};

const TerminalVariation = () => {
  return (
    <div style={{
      width: '100%', height: '100%', background: TR.bg, color: TR.text,
      fontFamily: '"Geist Mono", ui-monospace, monospace',
      fontSize: 12, display: 'flex', overflow: 'hidden',
    }}>
      {/* Sidebar — compact list */}
      <aside style={{
        width: 232, flexShrink: 0, borderRight: `1px solid ${TR.borderSoft}`,
        background: TR.bg, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: `1px solid ${TR.borderSoft}`,
        }}>
          <span style={{ color: TR.accent, fontSize: 13 }}>▲</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>copilot.console</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: TR.textMuted }}>v0.9.2</span>
        </div>

        {/* Hot row — keyboard hints */}
        <div style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
          {[
            { label: 'new', key: '⌘N' },
            { label: 'find', key: '⌘K' },
            { label: 'agents', key: '⌘A' },
          ].map(b => (
            <button key={b.label} style={{
              flex: 1, padding: '5px 6px', borderRadius: 4, border: `1px solid ${TR.border}`,
              background: TR.panel, color: TR.textDim, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 10.5, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
            }}>
              <span style={{ color: TR.text }}>{b.label}</span>
              <span style={{ color: TR.textMuted }}>{b.key}</span>
            </button>
          ))}
        </div>

        <div style={{
          padding: '6px 12px', fontSize: 10, color: TR.textMuted, letterSpacing: '0.06em',
          textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>sessions · 212</span>
          <span style={{ color: TR.accent }}>14 today</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
          {SESSIONS.map(s => {
            const active = s.id === ACTIVE_TAB;
            const statusGlyph = {
              running: '►', active: '◆', error: '✕', new: '+', idle: '·',
            }[s.status] || '·';
            const statusCol = {
              running: TR.ok, active: TR.accent, error: TR.err, new: TR.user, idle: TR.textMuted,
            }[s.status] || TR.textMuted;
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px',
                borderRadius: 4, cursor: 'pointer', fontSize: 11.5,
                background: active ? TR.panelDeep : 'transparent',
              }}>
                <span style={{ color: statusCol, width: 8, textAlign: 'center' }}>{statusGlyph}</span>
                <span style={{
                  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: active ? TR.text : TR.textDim,
                }}>{s.title}</span>
                <span style={{ color: TR.textMuted, fontSize: 10 }}>{s.time.replace(/ [AP]M/, '').replace(':', '')}</span>
              </div>
            );
          })}
        </div>

        <div style={{
          padding: '8px 12px', borderTop: `1px solid ${TR.borderSoft}`,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: TR.textMuted,
        }}>
          <span style={{ color: TR.ok }}>●</span>
          <span>online</span>
          <span style={{ marginLeft: 'auto' }}>~manas</span>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tabs strip */}
        <div style={{
          display: 'flex', alignItems: 'stretch', height: 28, borderBottom: `1px solid ${TR.borderSoft}`,
          background: TR.bg, fontSize: 10.5,
        }}>
          {OPEN_TABS.map(id => {
            const s = SESSIONS.find(x => x.id === id);
            const active = id === ACTIVE_TAB;
            return (
              <div key={id} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
                borderRight: `1px solid ${TR.borderSoft}`,
                background: active ? TR.bg : TR.panel,
                color: active ? TR.text : TR.textMuted, cursor: 'pointer',
                position: 'relative', minWidth: 0, maxWidth: 200,
              }}>
                {active && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: TR.accent }} />}
                <span style={{ color: TR.textMuted }}>0{OPEN_TABS.indexOf(id) + 1}</span>
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s.title}</span>
                <span style={{ color: TR.textMuted, marginLeft: 4 }}>×</span>
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', alignItems: 'center', padding: '0 10px', color: TR.textMuted,
            gap: 12, fontSize: 10.5,
          }}>
            <span>tok <span style={{ color: TR.accent }}>23%</span></span>
            <span>mcp 1/13</span>
            <span>sub 0/21</span>
          </div>
        </div>

        {/* Status bar / "command palette ghost" */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
          background: TR.panel, borderBottom: `1px solid ${TR.borderSoft}`,
          fontSize: 11, color: TR.textDim,
        }}>
          <span style={{ color: TR.accent }}>$</span>
          <span style={{ color: TR.text }}>session</span>
          <span style={{ color: TR.textMuted }}>—</span>
          <span style={{ color: TR.text }}>"Give feedback on this LinkedIn profile"</span>
          <span style={{ marginLeft: 'auto', color: TR.textMuted, fontSize: 10 }}>--model</span>
          <span style={{ color: TR.text }}>gpt-5.5</span>
          <span style={{ color: TR.textMuted, fontSize: 10 }}>--profile</span>
          <span style={{ color: TR.text }}>xhigh</span>
          <span style={{ color: TR.textMuted, fontSize: 10 }}>--mode</span>
          <span style={{ color: TR.user }}>interactive</span>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px 0' }}>
          <div style={{ maxWidth: 880, fontSize: 12.5, lineHeight: 1.55 }}>
            {THREAD.map((m, i) => <TRMessage key={i} m={m} />)}
            <div style={{
              padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8,
              color: TR.textMuted, fontSize: 11,
            }}>
              <span style={{ color: TR.ok }}>●</span>
              streaming · waiting for next prompt
              <span style={{
                display: 'inline-block', width: 7, height: 12, background: TR.accent,
                animation: 'tr-blink 1s steps(1) infinite',
              }} />
            </div>
          </div>
        </div>

        {/* Composer with prompt prefix */}
        <div style={{
          padding: '10px 14px 14px', borderTop: `1px solid ${TR.borderSoft}`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: TR.panel, border: `1px solid ${TR.border}`, borderRadius: 4,
            padding: '8px 12px',
          }}>
            <span style={{ color: TR.accent, fontWeight: 600, marginTop: 1 }}>›</span>
            <span style={{ color: TR.textMuted, flex: 1, fontSize: 12 }}>type message · enter to send · shift+enter for newline</span>
            <span style={{ color: TR.textMuted, fontSize: 10.5 }}>⌘K palette</span>
            <span style={{ color: TR.textMuted, fontSize: 10.5 }}>·</span>
            <span style={{ color: TR.textMuted, fontSize: 10.5 }}>@ agent</span>
            <span style={{ color: TR.textMuted, fontSize: 10.5 }}>·</span>
            <span style={{ color: TR.textMuted, fontSize: 10.5 }}>/ tool</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes tr-blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
};

const TRMessage = ({ m }) => {
  const isUser = m.role === 'user';
  return (
    <div style={{ padding: '8px 0', borderTop: '1px dashed transparent' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <span style={{
          color: isUser ? TR.user : TR.accent, fontWeight: 600, minWidth: 70,
        }}>{isUser ? 'manas@' : 'copilot@'}</span>
        <span style={{ color: TR.textMuted, fontSize: 10.5 }}>{m.time}</span>
        {m.steps && (
          <span style={{ color: TR.textMuted, fontSize: 10.5 }}>
            ↳ {m.steps} steps{m.userInput && ' · 1 input'}
          </span>
        )}
        {m.final && (
          <span style={{
            padding: '0 6px', background: TR.ok, color: TR.bg, fontSize: 9.5,
            fontWeight: 600, letterSpacing: '0.06em',
          }}>FINAL</span>
        )}
      </div>

      {m.steps && !isUser && <TRSteps n={m.steps} />}

      <div style={{
        color: isUser ? TR.user : TR.text, paddingLeft: 80,
        fontFamily: 'Geist, ui-sans-serif, system-ui', fontSize: 13.5, lineHeight: 1.55,
      }}>
        {m.body}
      </div>

      {m.highestPriority && (
        <div style={{
          marginLeft: 80, marginTop: 8, padding: '8px 10px',
          background: TR.panel, borderLeft: `2px solid ${TR.warn}`,
          fontFamily: 'Geist, sans-serif', fontSize: 13, lineHeight: 1.5,
        }}>
          <span style={{ color: TR.warn, fontFamily: 'inherit', fontWeight: 600 }}>highest-priority fix · </span>
          <span style={{ color: TR.textDim }}>{m.highestPriority}</span>
        </div>
      )}

      {m.table && (
        <div style={{
          marginLeft: 80, marginTop: 10, fontFamily: 'inherit', fontSize: 11,
          border: `1px solid ${TR.border}`, borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 1fr', background: TR.panel,
            padding: '5px 10px', color: TR.textMuted, letterSpacing: '0.06em', fontSize: 10,
            textTransform: 'uppercase', gap: 12,
          }}>
            <div>area</div><div>feedback</div><div>change</div>
          </div>
          {m.table.map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 12,
              padding: '8px 10px', borderTop: i ? `1px solid ${TR.borderSoft}` : 'none',
              fontFamily: 'Geist, sans-serif', fontSize: 12.5, lineHeight: 1.45,
            }}>
              <div style={{ color: TR.accent, fontFamily: '"Geist Mono"' }}>{row.area}</div>
              <div style={{ color: TR.textDim }}>{row.feedback}</div>
              <div>{row.change}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TRSteps = ({ n }) => {
  // Inline streaming step log — compressed
  const sample = [
    ['tool', 'web_fetch', 'linkedin.com/in/manas'],
    ['200', '', '4.2 KB'],
    ['tool', 'browser.open', 'sign-in'],
    ['ok', '', ''],
    ['tool', 'browser.extract', 'profile.sections[8]'],
    ['ok', '', '12.4 KB'],
    ['think', '', 'drafting report'],
  ].slice(0, Math.min(n, 4));
  return (
    <div style={{
      marginLeft: 80, marginBottom: 6, padding: '4px 10px',
      background: TR.panel, borderLeft: `1px solid ${TR.border}`,
      fontFamily: 'inherit', fontSize: 10.5, color: TR.textMuted, lineHeight: 1.6,
    }}>
      {sample.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 10 }}>
          <span style={{
            color: row[0] === 'tool' ? TR.user
              : row[0] === '200' || row[0] === 'ok' ? TR.ok
              : TR.textMuted,
            width: 36,
          }}>{row[0]}</span>
          <span style={{ color: TR.textDim, width: 110 }}>{row[1]}</span>
          <span>{row[2]}</span>
        </div>
      ))}
      {n > 4 && <div style={{ color: TR.textMuted }}>… +{n - 4} more</div>}
    </div>
  );
};

window.TerminalVariation = TerminalVariation;
