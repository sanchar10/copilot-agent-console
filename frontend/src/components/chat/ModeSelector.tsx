import { useCallback, useState, useRef, useEffect } from 'react';

export type AgentMode = 'interactive' | 'plan' | 'autopilot';

const MODES: { value: AgentMode; label: string; icon: string }[] = [
  { value: 'interactive', label: 'Interactive', icon: '💬' },
  { value: 'plan', label: 'Plan', icon: '📋' },
  { value: 'autopilot', label: 'Autopilot', icon: '🚀' },
];

interface ModeSelectorProps {
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ mode, onModeChange, disabled }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = useCallback(
    (newMode: AgentMode) => {
      if (newMode !== mode && !disabled) {
        onModeChange(newMode);
      }
      setOpen(false);
    },
    [mode, onModeChange, disabled]
  );

  const current = MODES.find((m) => m.value === mode) ?? MODES[0];

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
          open
            ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/25 dark:text-blue-100 dark:border-blue-400/30'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#33334a]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title={`Mode: ${current.label}`}
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-40 bg-white dark:bg-[#2a2a3c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
          {MODES.map((m) => {
            const isActive = m.value === mode;
            return (
              <button
                key={m.value}
                onClick={() => handleSelect(m.value)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/20 dark:text-blue-100'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#33334a]'
                }`}
              >
                <span>{m.icon}</span>
                <span className="font-medium">{m.label}</span>
                {isActive && <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
