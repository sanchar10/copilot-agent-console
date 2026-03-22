/**
 * Pin icons for pinnable / pinned messages and the drawer toggle.
 *
 * Unpinned: 📌 classic tilted pushpin (side view, ready to push)
 * Pinned:   Top-view pushpin — two concentric red circles (Concept B)
 */

interface PinIconProps {
  className?: string;
  size?: number;
}

/** Tilted pushpin — side view, not yet pinned */
export function UnpinnedIcon({ className = '', size = 18 }: PinIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="rotate(-45, 12, 12)">
        <circle cx="12" cy="7" r="4.5" fill="#ef4444" />
        <rect x="11.2" y="10" width="1.6" height="10" rx="0.8" fill="#9ca3af" />
      </g>
    </svg>
  );
}

/** Top-view pushpin — pushed into board, two concentric circles (Concept B) */
export function PinnedIcon({ className = '', size = 18 }: PinIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" fill="#ef4444" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#dc2626" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="3" fill="#dc2626" />
    </svg>
  );
}
