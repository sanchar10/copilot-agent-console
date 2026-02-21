import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { MobileSessionList } from './components/mobile/MobileSessionList';
import { MobileChatView } from './components/mobile/MobileChatView';
import { MobileAgentMonitor } from './components/mobile/MobileAgentMonitor';
import { MobileSettings } from './components/mobile/MobileSettings';
import { NotificationBanner } from './components/mobile/NotificationBanner';
import { mobileApiClient, setStoredToken, setStoredBaseUrl, getStoredToken } from './api/mobileClient';
import { useTheme } from './hooks/useTheme';

type TabId = 'sessions' | 'agents' | 'settings';

export function MobileApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [notification, setNotification] = useState<{ message: string; sessionId?: string } | null>(null);

  useTheme();

  // Handle QR code setup: extract token and baseUrl from URL params
  useEffect(() => {
    const token = searchParams.get('token');
    const baseUrl = searchParams.get('baseUrl');
    if (token) {
      setStoredToken(token);
    }
    if (baseUrl) {
      setStoredBaseUrl(baseUrl);
    }
    // Clean URL after extracting params
    if (token || baseUrl) {
      navigate('/mobile', { replace: true });
    }
  }, [searchParams, navigate]);

  // Test connection on mount and when returning to app
  const checkConnection = useCallback(async () => {
    const ok = await mobileApiClient.testConnection();
    setConnected(ok);
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  // On localhost, no token is needed (backend skips auth for localhost)
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Show setup screen if no token configured AND not on localhost
  if (!isLocalhost && !getStoredToken() && !searchParams.get('token')) {
    return (
      <div className="h-screen bg-[#fafafa] dark:bg-[#1e1e2e] flex flex-col">
        <MobileSettings onConnectionChange={checkConnection} />
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
        <Routes>
          <Route index element={<MobileSessionList onNotification={setNotification} />} />
          <Route path="chat/:sessionId" element={<MobileChatView />} />
          <Route path="agents" element={<MobileAgentMonitor />} />
          <Route path="settings" element={<MobileSettings onConnectionChange={checkConnection} />} />
        </Routes>
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
