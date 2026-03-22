'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Copy, Check, RefreshCw, Key, AlertTriangle } from 'lucide-react';

export function APIAccess() {
  const { user } = useAuth();
  const [keyPrefix, setKeyPrefix] = useState<string | null>(null);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate flow
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string>('');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);

  // Copy states
  const [keyCopied, setKeyCopied] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);

  const loadAPIKey = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/user/api-keys/info');
      const data = await res.json();
      if (data.success && data.hasKey) {
        setKeyPrefix(data.key_prefix);
        setLastUsedAt(data.last_used_at);
        setCreatedAt(data.created_at);
      } else {
        setKeyPrefix(null);
      }
    } catch {
      setError('Failed to load API key info.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAPIKey(); }, [loadAPIKey]);

  const handleGenerateKey = async () => {
    try {
      setRegenerating(true);
      setConfirming(false);
      setError(null);
      const res = await fetch('/api/user/api-keys/regenerate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNewApiKey(data.api_key);
        setKeyPrefix(data.key_prefix);
        setLastUsedAt(null);
        setCreatedAt(new Date().toISOString());
        setShowNewKeyModal(true);
      } else {
        setError(data.message || 'Failed to generate API key.');
      }
    } catch {
      setError('Failed to generate API key. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (ts: string | null) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTimeAgo = (ts: string | null) => {
    if (!ts) return 'Never';
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const mcpConfig = (apiKeyValue: string) => JSON.stringify({
    flowengine: {
      command: 'npx',
      args: ['-y', 'flowengine-mcp-app'],
      env: {
        FLOWENGINE_API_KEY: apiKeyValue,
        PORTAL_BASE_URL: typeof window !== 'undefined' ? window.location.origin : 'https://your-portal-url',
      },
    },
  }, null, 2);

  if (loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-5 bg-gray-800 rounded w-1/4 mb-3" />
        <div className="h-4 bg-gray-800 rounded w-2/3" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Key card */}
      <div id="api-access" className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 scroll-mt-24">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-white text-lg font-medium">API Key</h3>
          {keyPrefix && (
            <span className="text-xs text-gray-500">Created {formatDate(createdAt)}</span>
          )}
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Authenticate API requests and MCP tools with your personal API key.
        </p>

        {error && (
          <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/50 rounded-lg p-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {keyPrefix ? (
          <div className="space-y-4">
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-300 text-sm font-medium">Your API Key</span>
                </div>
                <span className="text-gray-500 text-xs">Last used: {formatTimeAgo(lastUsedAt)}</span>
              </div>
              <code className="text-white font-mono text-sm block mb-1">{keyPrefix}</code>
              <p className="text-gray-500 text-xs">
                The full key is only shown once at generation. Regenerate to get a new key.
              </p>
            </div>

            {/* Inline confirm before regenerating */}
            {confirming ? (
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                <p className="text-yellow-300 text-sm font-medium mb-1">Regenerate your API key?</p>
                <p className="text-gray-400 text-xs mb-4">
                  Your current key will stop working immediately. Any integrations using it will break.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateKey}
                    disabled={regenerating}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-medium disabled:opacity-50 transition-colors"
                  >
                    {regenerating ? 'Regenerating...' : 'Yes, regenerate'}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-medium transition-colors border border-gray-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate key
              </button>
            )}

            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
              <p className="text-yellow-400 text-xs font-medium mb-1">Keep it secret</p>
              <p className="text-gray-400 text-xs">
                Never share your key or commit it to version control. Treat it like a password.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-6 text-center">
            <Key className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">No API key yet</p>
            <p className="text-gray-500 text-xs mb-5">Generate a key to start using the API and MCP tools.</p>
            <button
              onClick={handleGenerateKey}
              disabled={regenerating}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-black text-sm rounded font-medium disabled:opacity-50 transition-colors"
            >
              {regenerating ? 'Generating...' : 'Generate API Key'}
            </button>
          </div>
        )}
      </div>

      {/* MCP Server card — only shown once a key exists */}
      {keyPrefix && (
        <div id="mcp" className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 scroll-mt-24">
          <h3 className="text-white text-lg font-medium mb-1">MCP Server</h3>
          <p className="text-gray-400 text-sm mb-5">
            Add this to your AI assistant's MCP config (Claude Desktop, Cursor, etc.) to manage your portal from any AI chat.
          </p>

          <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <span className="text-gray-500 text-xs font-mono">mcp-config.json</span>
              <button
                onClick={() => copy(mcpConfig('YOUR_API_KEY_HERE'), setMcpCopied)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-gray-100 text-black rounded text-xs font-medium transition-colors"
              >
                {mcpCopied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
            </div>
            <pre className="p-4 text-xs text-gray-300 overflow-x-auto font-mono">{`"flowengine": {
  "command": "npx",
  "args": ["-y", "flowengine-mcp-app"],
  "env": {
    "FLOWENGINE_API_KEY": "YOUR_API_KEY_HERE",
    "PORTAL_BASE_URL": "${typeof window !== 'undefined' ? window.location.origin : 'https://your-portal-url'}"
  }
}`}</pre>
          </div>
          <p className="text-gray-500 text-xs mt-3">
            Replace <code className="text-gray-400">YOUR_API_KEY_HERE</code> with your actual key. Regenerate above to get your full key.
          </p>
        </div>
      )}

      {/* New Key Modal */}
      {showNewKeyModal && newApiKey && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowNewKeyModal(false); setNewApiKey(''); } }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-green-400" />
              </div>
              <h3 className="text-white text-lg font-medium">API Key Generated</h3>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 my-4">
              <p className="text-yellow-400 text-xs font-medium mb-1">Save this key now</p>
              <p className="text-gray-300 text-xs">
                This is the only time you'll see the full key. Store it in a password manager or environment variable. We only keep a hash of it.
              </p>
            </div>

            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <code className="text-green-400 text-sm break-all select-all flex-1 font-mono">{newApiKey}</code>
                <button
                  onClick={() => copy(newApiKey, setKeyCopied)}
                  className="px-3 py-1.5 text-xs bg-white hover:bg-gray-200 text-black rounded font-medium whitespace-nowrap transition-colors"
                >
                  {keyCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 mb-5">
              <p className="text-gray-400 text-xs mb-1.5 font-medium">Quick test</p>
              <code className="text-gray-300 text-xs block font-mono whitespace-pre-wrap break-all">
                {`curl ${typeof window !== 'undefined' ? window.location.origin : 'https://your-portal-url'}/api/v1/me \\
  -H "Authorization: Bearer ${newApiKey}"`}
              </code>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => copy(mcpConfig(newApiKey), setMcpCopied)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-100 text-black rounded font-medium text-sm transition-colors"
              >
                {mcpCopied ? <><Check className="w-3.5 h-3.5" /> Copied MCP Config</> : <><Copy className="w-3.5 h-3.5" /> Copy MCP Config</>}
              </button>
              <button
                onClick={() => { setShowNewKeyModal(false); setNewApiKey(''); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 font-medium text-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
