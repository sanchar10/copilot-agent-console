import { useState } from 'react';
import {
  getStoredToken,
  getStoredBaseUrl,
  setStoredToken,
  setStoredBaseUrl,
  clearStoredCredentials,
  mobileApiClient,
} from '../../api/mobileClient';

interface Props {
  onConnectionChange: () => void;
}

export function MobileSettings({ onConnectionChange }: Props) {
  const [token, setToken] = useState(getStoredToken() || '');
  const [baseUrl, setBaseUrl] = useState(getStoredBaseUrl() || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (baseUrl.trim()) {
      setStoredBaseUrl(baseUrl.trim());
    }
    if (token.trim()) {
      setStoredToken(token.trim());
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onConnectionChange();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // Temporarily store for testing
    if (baseUrl.trim()) setStoredBaseUrl(baseUrl.trim());
    if (token.trim()) setStoredToken(token.trim());

    const ok = await mobileApiClient.testConnection();
    setTestResult(ok ? 'success' : 'error');
    setTesting(false);
    if (ok) onConnectionChange();
  };

  const handleDisconnect = () => {
    clearStoredCredentials();
    setToken('');
    setBaseUrl('');
    setTestResult(null);
    onConnectionChange();
  };

  const isConfigured = !!getStoredToken();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 bg-white dark:bg-[#252536] border-b border-gray-200 dark:border-[#3a3a4e]">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Connect to your Agent Console
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Connection setup */}
        <section className="bg-white dark:bg-[#2a2a3c] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-[#3a3a4e]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Connection</h2>

          {!isConfigured && (
            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg p-3 mb-4 text-sm">
              <p className="font-medium">Quick Setup</p>
              <p className="text-xs mt-1">
                Scan the QR code in your desktop Agent Console settings, or enter the details manually below.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Server URL
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-tunnel-url.devtunnels.ms"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#3a3a4e] bg-gray-50 dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                API Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your API token"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#3a3a4e] bg-gray-50 dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
            </div>

            {testResult && (
              <div className={`text-xs rounded-lg p-2 ${
                testResult === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}>
                {testResult === 'success' ? '✓ Connected successfully' : '✗ Connection failed — check URL and token'}
              </div>
            )}

            {saved && (
              <div className="text-xs rounded-lg p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
                ✓ Settings saved
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleTest}
                disabled={testing || (!token.trim() && !baseUrl.trim())}
                className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-[#3a3a4e] text-gray-700 dark:text-gray-300 disabled:opacity-40"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
              <button
                onClick={handleSave}
                disabled={!token.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>

            {isConfigured && (
              <button
                onClick={handleDisconnect}
                className="w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800"
              >
                Disconnect
              </button>
            )}
          </div>
        </section>

        {/* Help */}
        <section className="bg-white dark:bg-[#2a2a3c] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-[#3a3a4e]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">How to connect</h2>
          <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
            <li>On your desktop, start Agent Console with <code className="bg-gray-100 dark:bg-[#1e1e2e] px-1 py-0.5 rounded">--expose</code></li>
            <li>Set up a tunnel (e.g., <code className="bg-gray-100 dark:bg-[#1e1e2e] px-1 py-0.5 rounded">devtunnel host -p 8765</code>)</li>
            <li>Open Settings in the desktop UI and scan the QR code</li>
            <li>Or manually enter the tunnel URL and API token above</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
