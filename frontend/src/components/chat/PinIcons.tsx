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

/** Classic pushpin emoji — 📌 */
export function UnpinnedIcon({ className = '', size = 18 }: PinIconProps) {
  return (
    <span className={className} style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label="Pin">📌</span>
  );
}

/** Pushpin emoji vertical — 📌 rotated to show "pushed in" */
export function PinnedIcon({ className = '', size = 18 }: PinIconProps) {
  return (
    <span className={className} style={{ fontSize: size, lineHeight: 1, display: 'inline-block', transform: 'rotate(-45deg)' }} role="img" aria-label="Pinned">📌</span>
  );
}
