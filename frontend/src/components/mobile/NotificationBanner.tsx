import { useEffect } from 'react';

interface Props {
  message: string;
  onDismiss: () => void;
  onTap?: () => void;
}

export function NotificationBanner({ message, onDismiss, onTap }: Props) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      onClick={onTap}
      className={`bg-emerald-600 text-white px-4 py-2.5 text-sm flex items-center justify-between ${
        onTap ? 'cursor-pointer active:bg-emerald-700' : ''
      } animate-slide-down`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span>✓</span>
        <span className="truncate">{message}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="text-emerald-200 hover:text-white ml-3 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
