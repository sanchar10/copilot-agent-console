import React from 'react';

const FILE_PATH_RE = /^(?:[A-Z]:\\|\\\\)/;

/**
 * Scan React children for Windows file paths and mark them as clickable.
 * Uses data-filepath attribute for event delegation (handled by parent container).
 */
export function processFileLinks(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child !== 'string') return child;

    // Split on Windows paths (C:\...) and UNC paths (\\server\...)
    const parts = child.split(/((?:[A-Z]:\\|\\\\[^\s<>"'|?*\\]+\\)(?:[^\s<>"'|?*\\]+\\)*[^\s<>"'|?*\\.]+(?:\.\w{1,10})?)/g);
    if (parts.length === 1) return child;

    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <span
          key={i}
          data-filepath={part}
          className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          title={`Click to open: ${part}`}
        >
          📄 {part}
        </span>
      ) : (
        part
      ),
    );
  });
}

/** Check if a string looks like a Windows/UNC file path */
export function isFilePath(text: string): boolean {
  return FILE_PATH_RE.test(text);
}

/** Handle clicks on elements with data-filepath (event delegation) */
export function handleFilePathClick(e: React.MouseEvent<HTMLElement>) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-filepath]');
  if (!el) return;
  const path = el.dataset.filepath;
  if (!path) return;
  e.preventDefault();
  e.stopPropagation();
  fetch('/api/filesystem/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  }).catch(console.error);
}
