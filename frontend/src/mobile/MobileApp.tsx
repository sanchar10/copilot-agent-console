import { useState, useEffect, useCallback, Component, type ReactNode } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { MobileSessionList } from './components/MobileSessionList';
import { MobileChatView } from './components/MobileChatView';
import { MobileAgentMonitor } from './components/MobileAgentMonitor';
import { MobileSettings } from './components/MobileSettings';
import { NotificationBanner } from './components/NotificationBanner';
import { mobileApiClient, setStoredToken, setStoredBaseUrl, getStoredToken, clearStoredCredentials, onAuthErrorChange, clearAuthError, getAuthError } from './mobileClient';
import { useTheme } from '../hooks/useTheme';

// Error boundary to catch render crashes and show a recovery UI
class MobileErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[MobileErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-[#fafafa] dark:bg-[#1e1e2e]">
          <p className="text-4xl mb-3">💥</p>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 max-w-xs break-all">{this.state.error.message}</p>
          <button
            onClick={() => { this.setState({ error: null }); this.props.onReset(); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg"
          >
            Back to Sessions
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type TabId = 'sessions' | 'agents' | 'settings';

export function MobileApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<'unauthorized' | 'network' | null>(getAuthError());
  const [notification, setNotification] = useState<{ message: string; sessionId?: string } | null>(null);

  useTheme();

  // Extract token/baseUrl from URL params SYNCHRONOUSLY before any child effects fire.
  // This prevents a race where child components make API calls with a stale token.
  const urlToken = searchParams.get('token');
  const urlBaseUrl = searchParams.get('baseUrl');
  if (urlToken) {
    setStoredToken(urlToken);
    clearAuthError();
  }
  if (urlBaseUrl) {
    setStoredBaseUrl(urlBaseUrl);
  }

  // Clean URL after extracting params (must be in effect for navigation)
  useEffect(() => {
    if (urlToken || urlBaseUrl) {
      navigate('/mobile', { replace: true });
    }
  }, [urlToken, urlBaseUrl, navigate]);

  // Test connection on mount and when returning to app
  const [, forceRender] = useState(0);
  const handleConnectionChange = useCallback(async () => {
    // Force immediate re-render so the token check re-evaluates
    forceRender((n) => n + 1);
    const ok = await mobileApiClient.testConnection();
    setConnected(ok);
  }, []);

  useEffect(() => {
    handleConnectionChange();
    const interval = setInterval(handleConnectionChange, 30000);
    return () => clearInterval(interval);
  }, [handleConnectionChange]);

  // Subscribe to global auth errors from mobileClient
  useEffect(() => {
    return onAuthErrorChange(setAuthError);
  }, []);

  // On localhost, no token is needed (backend skips auth for localhost)
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Show setup screen if no token configured AND not on localhost
  if (!isLocalhost && !getStoredToken() && !searchParams.get('token')) {
    return (
      <div className="h-screen bg-[#fafafa] dark:bg-[#1e1e2e] flex flex-col">
        <MobileSettings onConnectionChange={handleConnectionChange} />
      </div>
    );
  }

  // Show re-auth screen when token is invalid or connection lost
  if (authError) {
    return (
      <div className="h-screen bg-[#fafafa] dark:bg-[#1e1e2e] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">{authError === 'unauthorized' ? '🔑' : '📡'}</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {authError === 'unauthorized' ? 'Session Expired' : 'Connection Lost'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xs">
          {authError === 'unauthorized'
            ? 'Your API token has been regenerated. Please scan the QR code again from the desktop Settings.'
            : 'Unable to reach the server. The tunnel URL may have changed. Please scan the QR code again from the desktop Settings.'}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              clearAuthError();
              clearStoredCredentials();
              navigate('/mobile/settings', { replace: true });
            }}
            className="bg-blue-600 text-white rounded-lg py-3 px-4 font-medium"
          >
            Re-configure Connection
          </button>
          <button
            onClick={() => {
              clearAuthError();
              handleConnectionChange();
            }}
            className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg py-3 px-4 font-medium"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Determine active tab from URL
  const getActiveTab = (): TabId => {
    const path = location.pathname;
    if (path.includes('/agents')) return 'agents';
    if (path.includes('/settings')) return 'settings';
    return 'sessions';
  };
  const activeTab = getActiveTab();

  return (
    <div className="h-screen bg-[#fafafa] dark:bg-[#1e1e2e] flex flex-col">
      {/* Connection indicator */}
      {connected === false && (
        <div className="bg-red-500 text-white text-center text-xs py-1">
          Disconnected — check your connection
        </div>
      )}

      {/* Notification banner */}
      {notification && (
        <NotificationBanner
          message={notification.message}
          onDismiss={() => setNotification(null)}
          onTap={notification.sessionId ? () => {
            navigate(`/mobile/chat/${notification.sessionId}`);
            setNotification(null);
          } : undefined}
        />
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <MobileErrorBoundary onReset={() => navigate('/mobile')}>
        <Routes>
          <Route index element={<MobileSessionList onNotification={setNotification} />} />
          <Route path="chat/:sessionId" element={<MobileChatView />} />
          <Route path="agents" element={<MobileAgentMonitor />} />
          <Route path="settings" element={<MobileSettings onConnectionChange={handleConnectionChange} />} />
        </Routes>
        </MobileErrorBoundary>
      </div>

      {/* Bottom tab navigation — hidden when in chat view */}
      {!location.pathname.includes('/chat/') && (
        <nav className="bg-white dark:bg-[#252536] border-t border-gray-200 dark:border-[#3a3a4e] flex safe-bottom">
          <TabButton
            icon="💬"
            label="Sessions"
            active={activeTab === 'sessions'}
            onClick={() => navigate('/mobile')}
          />
          <TabButton
            icon="🤖"
            label="Agents"
            active={activeTab === 'agents'}
            onClick={() => navigate('/mobile/agents')}
          />
          <TabButton
            icon="⚙️"
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => navigate('/mobile/settings')}
          />
        </nav>
      )}
    </div>
  );
}

function TabButton({ icon, label, active, onClick, badge }: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
        active
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-gray-500 dark:text-gray-400'
      }`}
    >
      <span className="text-xl relative">
        {icon}
        {badge && badge > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
