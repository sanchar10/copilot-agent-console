import { useState, useEffect, useRef, useCallback } from 'react';
import type { SlashCommand } from './slashCommands';
import { filterCommands } from './slashCommands';

interface SlashCommandPaletteProps {
  /** Current text after the '/' (for filtering) */
  query: string;
  /** Called when user selects a command */
  onSelect: (command: SlashCommand) => void;
  /** Called when user dismisses the palette */
  onDismiss: () => void;
}

export function SlashCommandPalette({ query, onSelect, onDismiss }: SlashCommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const commands = filterCommands(query);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onDismiss]);

  // Keyboard navigation — captured by parent via onKeyDown passthrough
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (commands.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % commands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + commands.length) % commands.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(commands[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    },
    [commands, selectedIndex, onSelect, onDismiss],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (commands.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-1 w-56 bg-white dark:bg-[#2a2a3c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 max-h-48 overflow-y-auto"
    >
      <div className="px-2 py-1 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
        Commands
      </div>
      {commands.map((cmd, idx) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => setSelectedIndex(idx)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
            idx === selectedIndex
              ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-800 dark:text-blue-100'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#33334a]'
          }`}
        >
          <span className="text-base flex-shrink-0">{cmd.icon}</span>
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">/{cmd.name}</span>
              {cmd.usage && <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{cmd.usage}</span>}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{cmd.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
