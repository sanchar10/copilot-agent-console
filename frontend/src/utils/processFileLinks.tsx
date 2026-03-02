import React from 'react';

const FILE_PATH_RE = /^(?:[A-Z]:\\|\\\\)/;

/** Known file extensions that indicate a local file rather than a web URL */
const FILE_EXTENSIONS = new Set([
  'md', 'txt', 'log', 'csv', 'tsv', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'cfg', 'ini', 'env',
  'xml', 'html', 'htm', 'css', 'scss', 'less', 'svg',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'py', 'pyw', 'ipynb', 'rb', 'rs', 'go', 'java', 'kt', 'scala', 'c', 'cpp', 'h', 'hpp', 'cs',
  'sh', 'bash', 'zsh', 'ps1', 'psm1', 'bat', 'cmd',
  'sql', 'graphql', 'proto', 'dockerfile',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'pptx', 'rtf', 'odt',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico',
  'mp3', 'wav', 'mp4', 'mov', 'avi', 'mkv',
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
  'lock', 'editorconfig', 'gitignore', 'gitattributes', 'eslintrc', 'prettierrc',
]);

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
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
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

/**
 * Check if an href from a markdown link points to a local file rather than a web URL.
 * Returns the resolved absolute path if it's a file, or null if it's a web link.
 */
export function resolveFileHref(href: string | undefined, cwd: string | null | undefined): string | null {
  if (!href) return null;

  // Absolute Windows path — use directly
  if (isFilePath(href)) return href;

  // Has protocol — web link
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(href)) return null;

  // Starts with www. — web link
  if (/^www\./i.test(href)) return null;

  // Anchor or absolute web path
  if (href.startsWith('#') || href.startsWith('/')) return null;

  // mailto, tel, etc.
  if (/^(mailto|tel|sms|data):/.test(href)) return null;

  // Check for a known file extension
  const lastDot = href.lastIndexOf('.');
  if (lastDot === -1) return null; // no extension — ambiguous, treat as web
  const ext = href.slice(lastDot + 1).toLowerCase();
  if (!FILE_EXTENSIONS.has(ext)) return null;

  // It looks like a file reference — resolve against CWD
  if (!cwd) return null; // no CWD available, can't resolve

  // Normalize separators and join with CWD
  const normalized = href.replace(/\//g, '\\');
  // If it's already absolute somehow (shouldn't be given checks above), use as-is
  if (/^[A-Z]:\\/i.test(normalized)) return normalized;
  return `${cwd.replace(/\\$/, '')}\\${normalized}`;
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
