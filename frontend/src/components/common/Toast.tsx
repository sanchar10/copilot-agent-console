/**
 * Toast notification container.
 * Renders a stack of toasts in the top-right corner.
 * Mount once in App.tsx.
 */

import { useEffect, useState } from 'react';
import { useToastStore, type Toast, type ToastType } from '../../stores/toastStore';

const TYPE_STYLES: Record<ToastType, string> = {
  info: 'bg-blue-600 dark:bg-blue-700 text-white',
  success: 'bg-emerald-600 dark:bg-emerald-700 text-white',
  warning: 'bg-amber-500 dark:bg-amber-600 text-white',
  error: 'bg-red-600 dark:bg-red-700 text-white',
};

const TYPE_LABELS: Record<ToastType, string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

const TYPE_ICONS: Record<ToastType, string> = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠',
  error: '❗',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true));

    // Start exit animation before removal
    if (toast.duration > 0) {
      const exitTimer = setTimeout(() => setExiting(true), toast.duration - 300);
      return () => clearTimeout(exitTimer);
    }
  }, [toast.duration]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startDx = drag?.dx ?? 0;
    const startDy = drag?.dy ?? 0;
    const onMove = (ev: PointerEvent) =>
      setDrag({ dx: startDx + ev.clientX - startX, dy: startDy + ev.clientY - startY });
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      style={drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, transition: 'none' } : undefined}
      className={`
        flex flex-col rounded-lg shadow-lg overflow-hidden
        text-sm font-medium max-w-sm
        transition-all duration-300 ease-out
        ${TYPE_STYLES[toast.type]}
        ${visible && !exiting ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
      role="alert"
    >
      {/* Title bar — drag handle */}
      <div
        onPointerDown={onPointerDown}
        title="Drag to move"
        className="flex items-center gap-2 px-3 py-1.5 cursor-move select-none border-b border-white/20 bg-black/20"
      >
        <span className="text-base leading-none flex-shrink-0">{TYPE_ICONS[toast.type]}</span>
        <span className="flex-1 min-w-0 text-xs uppercase tracking-wider font-semibold opacity-90">
          {TYPE_LABELS[toast.type]}
        </span>
        {toast.action && (
          <a
            href={toast.action.href}
            target={toast.action.href ? '_blank' : undefined}
            rel={toast.action.href ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              toast.action?.onClick?.();
            }}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-semibold whitespace-nowrap"
          >
            {toast.action.label}
          </a>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Dismiss"
          className="flex-shrink-0 text-white/80 hover:text-white text-base leading-none"
        >
          ×
        </button>
      </div>
      {/* Message body — selectable */}
      <div className="px-3 py-2 whitespace-pre-line select-text">{toast.message}</div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  );
}
