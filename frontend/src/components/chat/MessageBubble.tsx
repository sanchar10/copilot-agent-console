import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message, MessageAttachment } from '../../types/message';
import type { Components } from 'react-markdown';
import { MermaidDiagram, isMermaidCode } from './MermaidDiagram';

interface MessageBubbleProps {
  message: Message;
}

function fileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return '🖼️';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return '🎬';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return '🎵';
  if (['pdf'].includes(ext)) return '📑';
  if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext)) return '📊';
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return '📝';
  if (['ppt', 'pptx'].includes(ext)) return '📽️';
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return '📦';
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'rs', 'go', 'rb', 'cs', 'sh', 'json', 'yaml', 'yml', 'xml', 'html', 'css'].includes(ext)) return '💻';
  if (['md', 'txt', 'log'].includes(ext)) return '📃';
  return '📄';
}

function AttachmentChips({ attachments }: { attachments: MessageAttachment[] }) {
  const handleClick = async (path: string) => {
    try {
      await fetch('/api/filesystem/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {attachments.map((att, idx) => {
        const name = att.displayName || att.path?.split(/[/\\]/).pop() || 'file';
        const hasPath = !!att.path;
        return (
          <button
            key={idx}
            onClick={hasPath ? () => handleClick(att.path!) : undefined}
            disabled={!hasPath}
            className={`inline-flex items-center gap-1 bg-white/50 backdrop-blur border border-white/40 rounded px-2 py-0.5 text-xs text-gray-600 ${hasPath ? 'hover:bg-blue-50/80 hover:border-blue-300 hover:text-blue-700 cursor-pointer' : 'cursor-default'}`}
            title={hasPath ? `Open ${name}` : name}
          >
            {fileIcon(name)}
            <span className="max-w-[180px] truncate">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

// Markdown components for rich rendering
const markdownComponents: Components = {
  // Strip the <pre> wrapper — each code type handles its own container:
  // SyntaxHighlighter uses PreTag="div", MermaidDiagram has its own wrapper
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : undefined;
    const codeContent = String(children).replace(/\n$/, '');
    const isInline = !match && !String(children).includes('\n');
    
    // Render mermaid diagrams
    if (isMermaidCode(language)) {
      return <MermaidDiagram code={codeContent} className="my-3" />;
    }
    
    if (isInline) {
      return (
        <code className="bg-blue-50/80 text-blue-700 px-1.5 py-0.5 rounded text-[0.9rem] font-mono">
          {children}
        </code>
      );
    }
    
    return (
      <SyntaxHighlighter
        style={oneDark as any}
        language={language || 'text'}
        PreTag="div"
        className="rounded-lg !my-3"
        customStyle={{ fontSize: '0.9rem', lineHeight: '1.5' }}
      >
        {codeContent}
      </SyntaxHighlighter>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse border border-white/40">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-white/50">{children}</thead>;
  },
  th({ children }) {
    return (
      <th className="border border-white/40 px-3 py-2 text-left font-semibold text-sm">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-white/40 px-3 py-2 text-sm">
        {children}
      </td>
    );
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline">
        {children}
      </a>
    );
  },
  ul({ children }) {
    return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-blue-300 pl-4 italic text-gray-600 my-3">
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
    return <p className="my-2">{children}</p>;
  },
  hr() {
    return <hr className="my-4 border-gray-300" />;
  },
};

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isEnqueued = isUser && message.mode === 'enqueue';

  // System messages render as compact inline notifications
  if (isSystem) {
    return (
      <div className="flex items-center justify-center gap-2 py-1.5">
        <div className="h-px flex-1 bg-gray-200/50" />
        <span className="text-xs text-gray-400 px-2 whitespace-nowrap">{message.content}</span>
        <div className="h-px flex-1 bg-gray-200/50" />
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
      isUser ? 'bg-blue-600' : 'bg-emerald-500'
      }`}>
        {isUser ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
          </svg>
        )}
      </div>
      
      {/* Message content */}
      <div className="flex-1 min-w-0">
        {/* Label */}
        <div className={`text-sm font-medium mb-1 ${isUser ? 'text-blue-600' : 'text-emerald-600'}`}>
          {isUser ? 'You' : 'Copilot'}
          {isEnqueued && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
              <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Queued
            </span>
          )}
        </div>
        
        {/* Message body */}
        <div className={`rounded-lg px-4 py-3 ${
          isEnqueued
            ? 'bg-amber-50/80 backdrop-blur border border-amber-200/50'
            : isUser 
              ? 'bg-blue-50/80 backdrop-blur border border-blue-200/50' 
              : 'bg-white/60 backdrop-blur border border-gray-200/40'
        }`}>
          {!isUser && message.steps && message.steps.length > 0 && (
            <details className="mb-2 text-sm">
              <summary className="cursor-pointer text-gray-600 select-none">
                Steps ({message.steps.length})
              </summary>
              <div className="mt-2 space-y-2 text-gray-700 max-h-[300px] overflow-y-auto pr-1">
                {message.steps.map((s, idx) => (
                  <div key={idx} className="border-l-2 border-gray-300 pl-3">
                    <div className="font-medium">{s.title}</div>
                    {s.detail && <pre className="mt-1 whitespace-pre-wrap break-words text-xs">{s.detail}</pre>}
                  </div>
                ))}
              </div>
            </details>
          )}
          {isUser ? (
            <>
              <div className="whitespace-pre-wrap break-words text-gray-900">{message.content || (message.attachments?.length ? '' : message.content)}</div>
              {message.attachments && message.attachments.length > 0 && <AttachmentChips attachments={message.attachments} />}
            </>
          ) : (
            <div className="prose prose-sm max-w-none prose-gray">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
