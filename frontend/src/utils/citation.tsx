import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { Components } from 'react-markdown';
import { useToastStore } from '../stores/toastStore';

/**
 * Unified citation pipeline.
 *
 * The agent emits text that may reference local files (relative, absolute, or
 * bare names) or web URLs. We classify each candidate synchronously without
 * doing any I/O, then resolve on click via the server's /api/filesystem/open
 * endpoint, which knows the session's cwd.
 *
 * Frontend rules:
 *   - "web"            -> render native <a target="_blank">
 *   - "file-candidate" -> render clickable span; click POSTs to /open with
 *                          { path, session_id }; non-2xx -> single toast.
 *   - "plain"          -> render as text.
 *
 * No filesystem checks. No batching. No caching. Server returns 404 if the
 * candidate doesn't resolve to an existing file in session scope.
 */

export type CitationKind = 'web' | 'file-candidate' | 'plain';

const WEB_SCHEME_RE = /^[a-z][a-z0-9+.\-]*:\/\//i;
const KNOWN_NON_FILE_SCHEME_RE = /^(?:https?|mailto|tel|sms|data|ftp|file):/i;
const WINDOWS_DRIVE_RE = /^[a-z]:[\\/]/i;
const UNC_RE = /^\\\\[^\\]+\\/;

/** Known file extensions used as a fast positive signal. Not exhaustive on purpose
 *  — extension-less files (Makefile, Dockerfile, .envrc) are caught via
 *  separator-shape rules below. */
const FILE_EXTENSIONS = new Set([
  'md', 'mdx', 'txt', 'log', 'csv', 'tsv', 'json', 'jsonl', 'yaml', 'yml',
  'toml', 'cfg', 'ini', 'env', 'xml', 'html', 'htm', 'css', 'scss', 'less',
  'svg', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'pyw', 'ipynb', 'rb',
  'rs', 'go', 'java', 'kt', 'scala', 'c', 'cpp', 'h', 'hpp', 'cs', 'sh',
  'bash', 'zsh', 'ps1', 'psm1', 'bat', 'cmd', 'sql', 'graphql', 'proto',
  'dockerfile', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'pptx', 'rtf', 'odt',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'mp3', 'wav', 'mp4',
  'mov', 'avi', 'mkv', 'zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'lock',
  'editorconfig', 'gitignore', 'gitattributes', 'eslintrc', 'prettierrc',
]);

/** Bare filenames without extensions that are still files. */
const BARE_FILE_NAMES = new Set([
  'Makefile', 'Dockerfile', 'Rakefile', 'Gemfile', 'Procfile', 'Vagrantfile',
  'CHANGELOG', 'LICENSE', 'README', 'AUTHORS', 'CONTRIBUTORS', 'NOTICE',
  'COPYING', 'INSTALL', 'TODO', 'VERSION',
]);

function getExtension(s: string): string {
  const lastSlash = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  const tail = lastSlash >= 0 ? s.slice(lastSlash + 1) : s;
  const dot = tail.lastIndexOf('.');
  if (dot <= 0) return '';
  return tail.slice(dot + 1).toLowerCase();
}

/** Looks like a file path that we want the server to try opening.
 *
 *  Tightened to avoid false positives on identifiers that contain slashes
 *  (`application/json`, `http/2`, `org/repo`, `/api/foo`, `/settings`).
 *  Returns true only when the shape is unambiguously file-ish.
 */
export function looksLikeFileCandidate(raw: string): boolean {
  const s = (raw || '').trim();
  if (!s) return false;
  if (s.length > 1024) return false;
  if (/[\r\n\t]/.test(s)) return false;

  // Glob/wildcard patterns are not real files.
  if (/[*?]/.test(s)) return false;

  // Web URLs are not file candidates.
  if (WEB_SCHEME_RE.test(s)) return false;
  if (KNOWN_NON_FILE_SCHEME_RE.test(s)) return false;
  if (s.startsWith('//')) return false;
  if (/^www\./i.test(s)) return false;
  if (s.startsWith('#')) return false;

  // Strong absolute-path shapes.
  if (s.startsWith('./') || s.startsWith('../')) return true;
  if (s.startsWith('~/') || s === '~') return true;
  if (WINDOWS_DRIVE_RE.test(s)) return true;
  if (UNC_RE.test(s)) return true;

  // Trailing separator => folder reference (e.g. "expense-tracker\", "Hello/").
  // Accept when every segment is a sensible filename token.
  if (s.endsWith('/') || s.endsWith('\\')) {
    const stripped = s.replace(/[/\\]+$/, '');
    if (!stripped) return false;
    const segs = stripped.split(/[/\\]/);
    if (segs.length >= 1 && segs.every((seg) => /^[A-Za-z0-9._\-]+$/.test(seg))) return true;
    return false;
  }

  const lastSegment = (() => {
    const parts = s.split(/[/\\]/);
    return parts[parts.length - 1] || '';
  })();

  // Bare filenames we recognise without an extension.
  if (BARE_FILE_NAMES.has(lastSegment)) return true;
  if (/^\.[a-z][a-z0-9_-]*$/i.test(lastSegment)) return true; // .envrc, .gitignore

  const ext = getExtension(s);
  const hasKnownExt = ext.length > 0 && FILE_EXTENSIONS.has(ext);
  const segCount = s.split(/[/\\]/).filter(Boolean).length;

  // POSIX absolute path: at least 2 segments and either a known extension or a
  // file-shaped tail. Excludes "/api/foo", "/settings".
  if (s.startsWith('/')) {
    if (hasKnownExt) return true;
    if (segCount >= 2 && /\.[a-z0-9]{1,8}$/i.test(lastSegment)) return true;
    // Well-known Unix system directories — treat as file candidates even
    // without an extension (e.g. /etc/hosts, /usr/bin/ls, /var/log/syslog).
    const POSIX_SYSTEM_ROOTS = new Set([
      'etc', 'var', 'usr', 'opt', 'home', 'root', 'tmp',
      'bin', 'sbin', 'proc', 'sys', 'dev', 'mnt', 'media', 'srv', 'boot',
      // macOS-specific roots
      'Users', 'Applications', 'Library', 'System', 'Volumes', 'private',
    ]);
    const firstSeg = s.split('/').filter(Boolean)[0];
    if (firstSeg && POSIX_SYSTEM_ROOTS.has(firstSeg) && segCount >= 2) return true;
    return false;
  }

  // Relative path with separators.
  if (segCount >= 2) {
    if (hasKnownExt) return true;
    if (/\.[a-z0-9]{1,8}$/i.test(lastSegment)) return true;
    // Windows-style separator (backslash) is rare in prose, so multi-segment
    // backslash paths without an extension are accepted (e.g. workspace\ai-strategy-deck).
    if (s.includes('\\')) return true;
    return false;
  }

  // Bare single token: needs a known extension to be considered a file.
  return hasKnownExt;
}

export function classifyCitation(raw: string | undefined | null): CitationKind {
  const s = (raw || '').trim();
  if (!s) return 'plain';

  // Web URL signals — short-circuit.
  if (WEB_SCHEME_RE.test(s)) return 'web';
  if (KNOWN_NON_FILE_SCHEME_RE.test(s)) return 'web';
  if (s.startsWith('//')) return 'web';
  if (/^www\./i.test(s)) return 'web';
  if (s.startsWith('#')) return 'web'; // anchors

  // "/something" without a file extension and without enough shape to look
  // like a file is treated as a web/app route.
  if (s.startsWith('/') && !looksLikeFileCandidate(s)) return 'web';

  if (looksLikeFileCandidate(s)) return 'file-candidate';
  return 'plain';
}

// ---------------------------------------------------------------------------
// CitationContext + click handler
// ---------------------------------------------------------------------------

interface CitationContextValue {
  sessionId?: string;
  cwd?: string | null;
}

const CitationContext = createContext<CitationContextValue>({});

export function CitationProvider({
  sessionId,
  cwd,
  children,
}: {
  sessionId?: string;
  cwd?: string | null;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ sessionId, cwd }), [sessionId, cwd]);
  return <CitationContext.Provider value={value}>{children}</CitationContext.Provider>;
}

export function useCitationContext(): CitationContextValue {
  return useContext(CitationContext);
}

let lastToastAt = 0;

async function postOpen(path: string, sessionId?: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/filesystem/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, session_id: sessionId ?? null }),
    });
  } catch (err) {
    showFailToast();
    console.error('citation open: network error', err);
    return;
  }
  if (!res.ok) {
    showFailToast();
    try {
      const body = await res.json();
      console.warn('citation open failed:', res.status, body);
    } catch {
      console.warn('citation open failed:', res.status);
    }
  }
}

function showFailToast() {
  // Throttle to one toast per 1.5s — clicks may come fast.
  const now = Date.now();
  if (now - lastToastAt < 1500) return;
  lastToastAt = now;
  useToastStore.getState().addToast(
    "Couldn't open this citation — file not found in this session's working directory.",
    'warning',
    4000,
  );
}

/** React event-delegation handler. Walks up to find [data-citation], and if
 *  present POSTs to /open. Web links (rendered as native <a>) are not
 *  intercepted. */
export function handleCitationClick(e: React.MouseEvent<HTMLElement>) {
  const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-citation]');
  if (!el) return;
  const path = el.dataset.citation;
  if (!path) return;
  // Allow modifier-clicks to fall through (no-op for file paths anyway).
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  e.stopPropagation();
  const sessionId = el.dataset.citationSession || undefined;
  void postOpen(path, sessionId);
}

// ---------------------------------------------------------------------------
// Markdown component factory used by both MessageBubble and StreamingMessage
// ---------------------------------------------------------------------------

interface FactoryOptions {
  /** Optional custom renderer for fenced code blocks. MessageBubble uses
   *  syntax highlighting + mermaid; StreamingMessage uses a plain <pre>. */
  renderFencedCode?: (args: { language: string | undefined; codeContent: string }) => React.ReactNode;
}

function FileCitation({ path, children }: { path: string; children: React.ReactNode }) {
  const { sessionId } = useCitationContext();
  return (
    <span
      data-citation={path}
      data-citation-session={sessionId || ''}
      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
      title={`Click to open: ${path}`}
    >
      📄 {children}
    </span>
  );
}

function FileCitationCode({ path, children }: { path: string; children: React.ReactNode }) {
  const { sessionId } = useCitationContext();
  return (
    <code
      data-citation={path}
      data-citation-session={sessionId || ''}
      className="bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded text-[0.9rem] font-mono cursor-pointer hover:underline"
      title={`Click to open: ${path}`}
    >
      📄 {children}
    </code>
  );
}

/** Scan a plain text node for inline file references (Windows/UNC/POSIX) and
 *  wrap them as citations. */
function scanTextForCitations(text: string, keyPrefix: string): React.ReactNode {
  // Each alternative captures an unambiguous file-shape signal.
  // The order/structure matters less than the set of allowed shapes,
  // because looksLikeFileCandidate is the final gate.
  //
  //  1. Windows drive absolute: C:\foo\bar
  //  2. UNC: \\server\share\...
  //  3. POSIX absolute under a known sysroot: /etc/hosts, /usr/bin/ls
  //  4. POSIX absolute with extension: /home/me/notes.md
  //  5. ~/path
  //  6. Windows-style relative path with backslash separator and 2+ segments
  //     (with or without extension, optional trailing backslash). Backslashes
  //     are rare in prose so this is safe to be aggressive.
  //  7. POSIX relative with 2+ segments **AND** an extension
  //     (e.g. workspace/ai-strategy-deck/slide1.html). Two-seg POSIX without
  //     extension is too ambiguous (if/else, application/json) — excluded.
  //  8. Bare filename with extension (Hello.txt, package.json). The classifier
  //     rejects unknown extensions so "Mr.Smith" or "v1.2" become plain text.
  //
  // The `(?<![\w./:\\])` lookbehind on relative branches prevents matching
  // mid-URL fragments like the "foo/" inside "https://example.com/foo/bar".
  const re = /(?:[A-Za-z]:[\\/][^\s<>"'|?*]+|\\\\[^\s<>"'|?*]+(?:\\[^\s<>"'|?*]+)+|(?<![\w./:\\])\/(?:etc|var|usr|opt|home|root|tmp|bin|sbin|proc|sys|dev|mnt|media|srv|boot|Users|Applications|Library|System|Volumes|private)\/[^\s<>"'|?*]+|(?<![\w./:\\])\/(?:[^\s/<>"'|?*]+\/)+[^\s/<>"'|?*]+\.[A-Za-z0-9]{1,8}|(?<![\w./:\\])~\/[^\s<>"'|?*]*|(?<![\w./:\\])[A-Za-z][A-Za-z0-9_\-.]*(?:\\[A-Za-z0-9_\-.]+)+\\?|(?<![\w./:\\])[A-Za-z][A-Za-z0-9_\-.]*(?:\/[A-Za-z0-9_\-.]+)+\.[A-Za-z0-9]{1,8}|(?<![\w./:\\])[A-Za-z][A-Za-z0-9_\-]*\.[A-Za-z0-9]{1,8})/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const candidate = match[0];
    if (looksLikeFileCandidate(candidate)) {
      parts.push(
        <FileCitation key={`${keyPrefix}-${i++}`} path={candidate}>
          {candidate}
        </FileCitation>,
      );
    } else {
      parts.push(candidate);
    }
    lastIndex = match.index + candidate.length;
  }
  if (lastIndex === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function processChildrenForCitations(
  children: React.ReactNode,
  keyPrefix = 'cit',
): React.ReactNode {
  return React.Children.map(children, (child, idx) => {
    if (typeof child === 'string') {
      return scanTextForCitations(child, `${keyPrefix}-${idx}`);
    }
    if (React.isValidElement(child)) {
      // If this element already provides citation handling, don't re-scan inside.
      const props = child.props as { 'data-citation'?: unknown; children?: React.ReactNode } | undefined;
      if (props && props['data-citation'] != null) return child;
      const innerChildren = props?.children;
      if (innerChildren == null) return child;
      const newChildren = processChildrenForCitations(innerChildren, `${keyPrefix}-${idx}`);
      return React.cloneElement(child, undefined, newChildren);
    }
    return child;
  });
}

/** Build the shared markdown components for citation-aware rendering.
 *  Callers pass a custom fenced-code renderer (syntax highlighting vs streaming).
 *  Inline code, links, and paragraphs are unified here. */
export function createCitationMarkdownComponents(opts: FactoryOptions = {}): Components {
  const { renderFencedCode } = opts;

  return {
    pre({ children }) {
      // Strip the <pre> wrapper — fenced-code renderer manages its own container.
      return <>{children}</>;
    },
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : undefined;
      const codeContent = String(children).replace(/\n$/, '');
      const isInline = !match && !String(children).includes('\n');

      if (isInline) {
        const text = String(children);
        const kind = classifyCitation(text);
        if (kind === 'file-candidate') {
          return <FileCitationCode path={text}>{children}</FileCitationCode>;
        }
        return (
          <code className="bg-gray-100 dark:bg-qd-bg text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded text-[0.9rem] font-mono">
            {children}
          </code>
        );
      }

      if (renderFencedCode) {
        return <>{renderFencedCode({ language, codeContent })}</>;
      }
      return (
        <pre className="my-3 p-3 bg-gray-900 text-gray-100 text-sm rounded overflow-auto">
          <code>{codeContent}</code>
        </pre>
      );
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-3">
          <table className="min-w-full border-collapse border border-qd-border">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-gray-100 dark:bg-qd-bg-elev">{children}</thead>;
    },
    th({ children }) {
      return (
        <th className="border border-qd-border px-3 py-2 text-left font-semibold text-sm">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="border border-qd-border px-3 py-2 text-sm">
          {processChildrenForCitations(children, 'td')}
        </td>
      );
    },
    a({ href, children }) {
      const kind = classifyCitation(href);
      if (kind === 'web' && href) {
        const safeHref = /^www\./i.test(href) ? `https://${href}` : href;
        return (
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {children}
          </a>
        );
      }
      // Anything else (file-candidate or plain) — treat as a file reference.
      // Markdown link authors writing [text](relative-path) overwhelmingly mean
      // a file, not a relative URL; we never want to navigate the SPA.
      if (href) {
        return <FileCitation path={href}>{children}</FileCitation>;
      }
      return <span>{children}</span>;
    },
    ul({ children }) {
      return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>;
    },
    li({ children }) {
      return <li>{processChildrenForCitations(children, 'li')}</li>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-qd-border pl-4 italic text-qd-text-dim my-3">
          {children}
        </blockquote>
      );
    },
    h1({ children }) {
      return <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-base font-bold mt-3 mb-1">{children}</h3>;
    },
    p({ children }) {
      return <p className="my-2">{processChildrenForCitations(children)}</p>;
    },
    hr() {
      return <hr className="my-4 border-qd-border" />;
    },
  };
}

/** Hook variant for callers that want a stable handler reference. */
export function useCitationClickHandler() {
  return useCallback(handleCitationClick, []);
}
