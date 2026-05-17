import { useState, useRef, useEffect } from 'react';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Agents & Robots',
    emojis: ['🤖', '🧠', '⚡', '🔧', '🛠️', '🎯', '🚀', '💡', '🔬', '🧪', '🔮', '🎲'],
  },
  {
    label: 'People & Roles',
    emojis: ['👤', '👨‍💻', '👩‍💻', '🧑‍🔬', '🧑‍🏫', '🧑‍💼', '🦸', '🧙', '🥷', '🕵️', '👷', '🧑‍🚀'],
  },
  {
    label: 'Development',
    emojis: ['💻', '🖥️', '⌨️', '🔗', '🐛', '🧬', '📦', '🏗️', '🔀', '📋', '🧰', '🔌'],
  },
  {
    label: 'Objects & Symbols',
    emojis: ['📝', '📊', '📁', '🗂️', '💬', '📡', '🔑', '🔒', '⚙️', '🧩', '🎨', '📌'],
  },
  {
    label: 'Nature & Weather',
    emojis: ['🌟', '🌍', '🌈', '🔥', '💧', '❄️', '🌀', '⚡', '☀️', '🌙', '🌸', '🍀'],
  },
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-white/40 dark:border-gray-600 rounded-lg text-lg leading-tight text-center hover:bg-white/40 dark:hover:bg-qd-panel focus:ring-2 focus:ring-blue-500/50 focus:border-transparent h-[38px]"
        title="Pick an icon"
      >
        {value}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 bg-white/80 dark:bg-qd-bg-elev/80 backdrop-blur-xl border border-white/40 dark:border-qd-border rounded-lg shadow-lg p-3 w-72 max-h-64 overflow-y-auto">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="text-xs font-medium text-gray-400 mb-1">{group.label}</div>
              <div className="grid grid-cols-6 gap-1">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onChange(emoji);
                      setIsOpen(false);
                    }}
                    className={`text-xl p-1 rounded hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition-colors ${
                      value === emoji ? 'bg-blue-100/80 dark:bg-blue-900/40 ring-1 ring-blue-400' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
