import { useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatStep } from '../../types/message';
import {
  createCitationMarkdownComponents,
  handleCitationClick,
} from '../../utils/citation';

interface StreamingMessageProps {
  content: string;
  steps?: ChatStep[];
  cwd?: string | null;
}

// --- Segment splitting: extract code fences before ReactMarkdown sees them ---

interface TextSegment {
  type: 'text';
  content: string;
}

interface CodeSegment {
  type: 'code';
  language: string;
  content: string;
  closed: boolean; // whether the closing ``` was received
}

type Segment = TextSegment | CodeSegment;

/**
 * Parse streaming content into alternating text and code segments.
 * Code fences are extracted so ReactMarkdown never sees backticks,
 * eliminating parse oscillation during streaming.
 *
 * This is language-agnostic — it handles ALL fenced code blocks the same way.
 * Specific viewer components (mermaid, 3D, graph, etc.) are only relevant
 * in MessageBubble after streaming completes.
 */
function splitSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  const lines = content.split('\n');
  let currentText = '';
  let currentCode = '';
  let codeLang = '';
  let insideFence = false;

  for (const line of lines) {
    const fenceMatch = /^(`{3,})(\w*)/.exec(line.trimStart());

    if (fenceMatch && !insideFence) {
      // Opening fence — flush text segment
      if (currentText) {
        segments.push({ type: 'text', content: currentText });
        currentText = '';
      }
      codeLang = fenceMatch[2] || '';
      currentCode = '';
      insideFence = true;
    } else if (insideFence && /^`{3,}\s*$/.test(line.trimStart())) {
      // Closing fence — flush code segment
      segments.push({ type: 'code', language: codeLang, content: currentCode, closed: true });
      currentCode = '';
      codeLang = '';
      insideFence = false;
    } else if (insideFence) {
      // Inside code block
      currentCode += (currentCode ? '\n' : '') + line;
    } else {
      // Regular text
      currentText += (currentText ? '\n' : '') + line;
    }
  }

  // Flush remaining
  if (insideFence) {
    // Unclosed fence (still streaming)
    segments.push({ type: 'code', language: codeLang, content: currentCode, closed: false });
  } else if (currentText) {
    segments.push({ type: 'text', content: currentText });
  }

  return segments;
}

// --- Markdown components for text segments only (no fenced code blocks) ---
//
// Fenced code blocks are extracted by splitSegments and rendered separately
// via StreamingCodeBlock, so the factory's default <pre> renderer never gets
// reached. Inline code, links, and paragraphs go through the unified citation
// pipeline.
function createStreamingMarkdownComponents(): import('react-markdown').Components {
  return createCitationMarkdownComponents();
}

// --- Code segment renderer (stable <pre> — no heavy components) ---

function StreamingCodeBlock({ segment }: { segment: CodeSegment }) {
  const lang = segment.language || 'code';
  return (
    <div className="my-3 not-prose overflow-hidden rounded-md">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-400 text-xs">
        <span>{lang}</span>
        {!segment.closed && (
          <span className="ml-auto inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        )}
      </div>
      <pre className="p-3 bg-gray-900 text-gray-100 text-sm overflow-hidden whitespace-pre-wrap break-words"><code>{segment.content}</code></pre>
    </div>
  );
}

// --- Main component ---

export function StreamingMessage({ content, steps }: StreamingMessageProps) {
  const stepsRef = useRef<HTMLDivElement>(null);
  const stepsUserScrolledRef = useRef(false);
  const stepsIsProgrammaticRef = useRef(false);
  const mdComponents = useMemo(() => createStreamingMarkdownComponents(), []);

  // Auto-scroll steps only if user hasn't manually scrolled up
  useEffect(() => {
    if (stepsRef.current && !stepsUserScrolledRef.current) {
      stepsIsProgrammaticRef.current = true;
      stepsRef.current.scrollTop = stepsRef.current.scrollHeight;
      requestAnimationFrame(() => { stepsIsProgrammaticRef.current = false; });
    }
  }, [steps?.length]);

  const handleStepsScroll = useCallback(() => {
    if (stepsIsProgrammaticRef.current) return;
    const el = stepsRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    stepsUserScrolledRef.current = !nearBottom;
  }, []);

  const segments = useMemo(() => splitSegments(content), [content]);

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium bg-emerald-600">
        <span className="text-sm leading-none">🤖</span>
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {/* Label */}
        <div className="text-sm font-medium mb-1 text-emerald-600">
          Copilot
          <span className="ml-2 inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        </div>

        {/* Message body */}
        <div onClick={handleCitationClick} className="rounded-lg px-4 py-3 bg-white dark:bg-[#2a2a3c] border border-gray-200 dark:border-gray-700">
          {steps && steps.length > 0 && (
            <div className="mb-2 text-sm">
              <div className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                Steps ({steps.length})
              </div>
              <div ref={stepsRef} onScroll={handleStepsScroll} className="text-gray-700 dark:text-gray-300 max-h-[300px] overflow-y-auto pr-1">
                {steps.map((s, idx) => (
                  <div key={idx}>
                    {idx > 0 && <hr className="border-gray-200 dark:border-gray-700/50 mx-3 my-1.5" />}
                    <div className="border-l-2 border-emerald-300 pl-3 py-1">
                      <div className="font-medium">{s.title}</div>
                      {s.detail && <pre className="mt-1 whitespace-pre-wrap break-words text-xs">{s.detail}</pre>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="prose prose-sm max-w-none prose-gray dark:prose-invert">
            {segments.map((seg, i) =>
              seg.type === 'text' ? (
                <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {seg.content}
                </ReactMarkdown>
              ) : (
                <StreamingCodeBlock key={i} segment={seg} />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
