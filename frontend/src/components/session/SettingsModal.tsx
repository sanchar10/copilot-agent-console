import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { useUIStore } from '../../stores/uiStore';
import { updateSettings } from '../../api/settings';
import { apiClient } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';

export function SettingsModal() {
  const { 
    isSettingsModalOpen, 
    closeSettingsModal, 
    availableModels, 
    defaultModel, 
    setDefaultModel,
    defaultCwd,
    setDefaultCwd 
  } = useUIStore();
  
  const { theme, setTheme } = useTheme();
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [selectedCwd, setSelectedCwd] = useState(defaultCwd);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedCwd(defaultCwd);
    setError(null);
  }, [defaultModel, defaultCwd, isSettingsModalOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateSettings({ 
        default_model: selectedModel,
        default_cwd: selectedCwd || undefined
      });
      setDefaultModel(selectedModel);
      if (selectedCwd) {
        setDefaultCwd(selectedCwd);
      }
      closeSettingsModal();
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings. Check that the directory exists.');
    } finally {
      setIsSaving(false);
    }
  };

  const modelOptions = availableModels.map((model) => ({
    value: model.id,
    label: model.name,
  }));

  return (
    <Modal
      isOpen={isSettingsModalOpen}
      onClose={closeSettingsModal}
      title="Settings"
      footer={
        <>
          <Button variant="secondary" onClick={closeSettingsModal}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Theme
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                theme === 'light'
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-400'
                  : 'bg-white/50 border-white/40 text-gray-600 hover:bg-gray-50 dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-400 dark:hover:bg-[#32324a]'
              }`}
            >
              ☀️ Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                theme === 'dark'
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-400'
                  : 'bg-white/50 border-white/40 text-gray-600 hover:bg-gray-50 dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-400 dark:hover:bg-[#32324a]'
              }`}
            >
              🌙 Dark
            </button>
          </div>
        </div>

        <Select
          label="Default Model"
          options={modelOptions}
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This model will be used for all new sessions.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default Working Directory
          </label>
          <input
            type="text"
            value={selectedCwd}
            onChange={(e) => setSelectedCwd(e.target.value)}
            className="w-full px-3 py-2 border border-white/40 bg-white/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent text-sm dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., C:\Users\you\projects"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            New sessions will start in this directory. Can be changed per-session.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Mobile Companion */}
        <MobileCompanionSection />
      </div>
    </Modal>
  );
}

function MobileCompanionSection() {
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [exposeMode, setExposeMode] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch mobile companion info (token, tunnel URL, expose status)
  useEffect(() => {
    apiClient.get<{ api_token: string; tunnel_url: string; expose: boolean }>('/settings/mobile-companion')
      .then(data => {
        setApiToken(data.api_token);
        if (data.tunnel_url) setTunnelUrl(data.tunnel_url);
        setExposeMode(data.expose);
      })
      .catch(() => {
        // Fallback: just get token
        apiClient.get<{ api_token: string }>('/settings/api-token')
          .then(data => setApiToken(data.api_token))
          .catch(() => {});
      });
  }, []);

  const handleRegenerate = async () => {
    try {
      const data = await apiClient.post<{ api_token: string }>('/settings/api-token/regenerate');
      setApiToken(data.api_token);
    } catch (err) {
      console.error('Failed to regenerate token:', err);
    }
  };

  const qrValue = tunnelUrl && apiToken
    ? `${tunnelUrl.replace(/\/$/, '')}/mobile?token=${encodeURIComponent(apiToken)}&baseUrl=${encodeURIComponent(tunnelUrl)}`
    : null;

  const handleCopy = () => {
    if (apiToken) {
      navigator.clipboard.writeText(apiToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-[#3a3a4e] pt-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        📱 Mobile Companion
      </h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Tunnel URL
          </label>
          <input
            type="url"
            value={tunnelUrl}
            onChange={(e) => setTunnelUrl(e.target.value)}
            placeholder="https://your-id.devtunnels.ms"
            className="w-full px-3 py-1.5 text-sm border border-white/40 bg-white/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:bg-[#1e1e2e] dark:border-gray-600 dark:text-gray-100"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {exposeMode
              ? 'Auto-detected from devtunnel. Edit if needed.'
              : <>Run with <code className="bg-gray-100 dark:bg-[#1e1e2e] px-1 py-0.5 rounded">--expose</code> to auto-start a tunnel, or enter a URL manually.</>
            }
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            API Token
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-100 dark:bg-[#1e1e2e] px-2 py-1.5 rounded font-mono truncate">
              {showToken ? apiToken : '••••••••••••••••'}
            </code>
            <button
              onClick={() => setShowToken(!showToken)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={handleCopy}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
          <button
            onClick={handleRegenerate}
            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 mt-1"
          >
            Regenerate token
          </button>
        </div>

        {qrValue && (
          <div className="flex flex-col items-center pt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Scan with your phone to connect:
            </p>
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG value={qrValue} size={180} />
            </div>
          </div>
        )}

        {!qrValue && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
            {exposeMode
              ? 'Waiting for tunnel URL... It should appear automatically.'
              : <>Start with <code className="bg-gray-100 dark:bg-[#1e1e2e] px-1 py-0.5 rounded">npm run dev -- --expose</code> to auto-generate a QR code</>
            }
          </p>
        )}
      </div>
    </div>
  );
}
