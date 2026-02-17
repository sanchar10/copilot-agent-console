import { useEffect, useState, Component } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import mermaid from 'mermaid';

// Initialize mermaid once at module load
let mermaidInitialized = false;
function initializeMermaid(isDark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  });
  mermaidInitialized = true;
}

interface MermaidDiagramProps {
  code: string;
  className?: string;
}

// Error Boundary to catch rendering errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class MermaidErrorBoundary extends Component<{ children: ReactNode; code: string }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; code: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border-b border-red-200 text-red-600 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Failed to render Mermaid diagram</span>
          </div>
          <pre className="p-3 bg-gray-900 text-gray-100 text-sm overflow-x-auto">
            <code>{this.props.code}</code>
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Hook to detect system dark mode preference
function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isDark;
}

// Inner component that does the actual rendering
function MermaidDiagramInner({ code, className = '' }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [modalZoom, setModalZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isDarkMode = useDarkMode();

  // Mermaid rendering effect
  useEffect(() => {
    let cancelled = false;
    // Generate a unique ID for each render to avoid mermaid ID conflicts
    const renderId = `mermaid-${Math.random().toString(36).substring(2, 11)}`;

    async function renderDiagram() {
      if (!code || !code.trim()) {
        setError('Empty diagram');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Initialize mermaid if not already done
        if (!mermaidInitialized) {
          initializeMermaid(isDarkMode);
        }
        
        // Create a hidden container for mermaid to render into.
        // Mermaid inserts a temporary element into the DOM for measurement,
        // which can cause page-level layout shifts and scrollbar flicker.
        // By providing an offscreen container, we prevent that.
        let hiddenContainer = document.getElementById('mermaid-render-container');
        if (!hiddenContainer) {
          hiddenContainer = document.createElement('div');
          hiddenContainer.id = 'mermaid-render-container';
          hiddenContainer.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:1px;height:1px;overflow:hidden;visibility:hidden;';
          document.body.appendChild(hiddenContainer);
        }
        
        // Validate and render the diagram with unique ID
        const { svg: renderedSvg } = await mermaid.render(renderId, code.trim(), hiddenContainer);
        
        if (!cancelled) {
          // Process SVG to make it responsive - remove fixed width/height, add viewBox if missing
          const processedSvg = renderedSvg
            .replace(/(<svg[^>]*)\s+width="[^"]*"/gi, '$1')
            .replace(/(<svg[^>]*)\s+height="[^"]*"/gi, '$1')
            .replace(/(<svg[^>]*)\s+style="[^"]*"/gi, '$1')
            .replace(/<svg([^>]*)>/i, '<svg$1 style="width:100%;height:auto;max-width:100%;display:block;">');
          setSvg(processedSvg);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to render diagram';
          console.error('Mermaid render error:', err);
          setError(message);
          setIsLoading(false);
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
      // Clean up any mermaid-generated elements
      try {
        const el = document.getElementById(renderId);
        if (el) el.remove();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [code, isDarkMode]);

  // Handle Escape key to close modal - MUST be before any conditional returns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Loading state - match streaming placeholder style for seamless transition
  if (isLoading) {
    return (
      <div className={`overflow-hidden not-prose rounded-md ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <span>Rendering diagram...</span>
          <span className="ml-1 inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        </div>
        <pre className="p-3 bg-gray-900 text-gray-400 text-xs overflow-hidden"><code>{code}</code></pre>
      </div>
    );
  }

  // Error state - show raw code with error message
  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 overflow-hidden ${className}`}>
        <div className="flex items-center justify-between px-3 py-2 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Invalid Mermaid syntax</span>
          </div>
        </div>
        <pre className="p-3 bg-gray-900 text-gray-100 text-sm overflow-x-auto">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  // Fullscreen modal component
  const FullscreenModal = () => {
    if (!isFullscreen) return null;
    
    return createPortal(
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setIsFullscreen(false)}
      >
        <div 
          className={`relative w-[95vw] h-[95vh] rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 z-10">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <span>Mermaid Diagram (Fullscreen)</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Modal zoom controls */}
              <div className="flex items-center gap-1 mr-2 border-r border-gray-300 pr-2">
                <button
                  onClick={() => setModalZoom(z => Math.max(0.25, z - 0.25))}
                  disabled={modalZoom <= 0.25}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
                  title="Zoom out"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <span className="text-sm text-gray-500 min-w-[3.5rem] text-center">{Math.round(modalZoom * 100)}%</span>
                <button
                  onClick={() => setModalZoom(z => Math.min(4, z + 0.25))}
                  disabled={modalZoom >= 4}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
                  title="Zoom in"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </button>
                <button
                  onClick={() => setModalZoom(1)}
                  disabled={modalZoom === 1}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-40"
                  title="Reset zoom"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              {/* Close button */}
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                title="Close (Esc)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          {/* Modal content */}
          <div 
            className={`w-full h-full pt-14 pb-4 px-4 flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-white'} ${modalZoom > 1 ? 'overflow-auto' : 'overflow-hidden'}`}
          >
            <div 
              className="mermaid-fullscreen w-full h-full flex items-center justify-center"
              style={{ 
                transform: `scale(${modalZoom})`, 
                transformOrigin: 'center center', 
                transition: 'transform 0.2s ease',
                ...(modalZoom > 1 ? {
                  minWidth: `${100 * modalZoom}%`,
                  minHeight: `${100 * modalZoom}%`,
                } : {}),
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <FullscreenModal />
      <div className={`overflow-hidden not-prose ${className}`}>
        {/* Header with toggle and zoom controls */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-gray-100 rounded-t-md text-xs">
          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            <span>Mermaid Diagram</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Zoom controls */}
            {!showRaw && (
              <div className="flex items-center gap-1 mr-2 border-r border-gray-300 pr-2">
                <button
                  onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                  disabled={zoom <= 0.25}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Zoom out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <span className="text-xs text-gray-500 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  disabled={zoom >= 3}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Zoom in"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </button>
                <button
                  onClick={() => setZoom(1)}
                  disabled={zoom === 1}
                  className="p-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Reset zoom"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            )}
            {/* Fullscreen button */}
            {!showRaw && (
              <button
                onClick={() => { setModalZoom(1); setIsFullscreen(true); }}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors mr-1"
                title="Open fullscreen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            )}
            {/* Toggle button */}
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
            >
              {showRaw ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Show Diagram
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Show Code
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Content - responsive container */}
        {showRaw ? (
          <pre className="p-3 bg-gray-900 text-gray-100 text-sm overflow-x-auto rounded-b-md">
            <code>{code}</code>
          </pre>
        ) : (
          <div 
            className={`overflow-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-b-md`}
          >
            <div 
              className="w-full"
              style={{ 
                transform: `scale(${zoom})`, 
                transformOrigin: 'top center', 
                transition: 'transform 0.2s ease',
                minWidth: zoom > 1 ? `${100 * zoom}%` : '100%',
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        )}
      </div>
    </>
  );
}

// Main export wrapped with error boundary
export function MermaidDiagram({ code, className = '' }: MermaidDiagramProps) {
  // Guard against undefined/null code
  if (!code) {
    return (
      <div className={`rounded-lg border border-gray-200 p-4 bg-gray-50 text-gray-500 text-sm ${className}`}>
        No diagram code provided
      </div>
    );
  }

  return (
    <MermaidErrorBoundary code={code}>
      <MermaidDiagramInner code={code} className={className} />
    </MermaidErrorBoundary>
  );
}

// Helper to detect if content is a mermaid diagram
export function isMermaidCode(language: string | undefined): boolean {
  return language?.toLowerCase() === 'mermaid';
}
