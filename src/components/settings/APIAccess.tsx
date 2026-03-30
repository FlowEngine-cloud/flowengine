'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Copy, Check, RefreshCw, Key, AlertTriangle, Terminal } from 'lucide-react';

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'xs' | 'sm' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const cls = size === 'xs'
    ? 'flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-xs font-medium transition-colors border border-gray-700'
    : 'flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md text-xs font-medium transition-colors border border-gray-700';
  return (
    <button onClick={copy} className={cls}>
      {copied ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3 h-3" />Copy</>}
    </button>
  );
}

export function APIAccess() {
  const { user } = useAuth();
  const [keyPrefix, setKeyPrefix] = useState<string | null>(null);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('https://your-portal-url');

  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string>('');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);

  useEffect(() => { setBaseUrl(window.location.origin); }, []);

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

  const copyText = (text: string, setCopied: (v: boolean) => void) => {
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

  const mcpConfig = (key: string) => JSON.stringify({
    mcpServers: {
      flowengine: {
        command: 'npx',
        args: ['-y', 'flowengine-mcp-app'],
        env: {
          FLOWENGINE_API_KEY: key,
          PORTAL_BASE_URL: baseUrl,
        },
      },
    },
  }, null, 2);

  if (loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-1/4 mb-6" />
        <div className="h-3 bg-gray-800 rounded w-2/3 mb-2" />
        <div className="h-3 bg-gray-800 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div id="api-access" className="scroll-mt-24">
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">

        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-gray-800">
          <h3 className="text-white text-base font-semibold">API Access & MCP</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            Authenticate REST requests and connect AI assistants via MCP.
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* ── Base URL ── */}
        <div className="px-6 py-4 border-b border-gray-800/60">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Base URL</p>
          <div className="flex items-center gap-2 bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2">
            <code className="text-gray-300 text-sm font-mono flex-1 truncate">{baseUrl}</code>
            <CopyButton text={baseUrl} size="xs" />
          </div>
        </div>

        {/* ── API Key ── */}
        <div className="px-6 py-4 border-b border-gray-800/60">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">API Key</p>
            {keyPrefix && (
              <span className="text-gray-600 text-xs">Created {formatDate(createdAt)}</span>
            )}
          </div>

          {keyPrefix ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2">
                <Key className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                <code className="text-gray-300 text-sm font-mono flex-1">{keyPrefix}</code>
                <span className="text-gray-600 text-xs whitespace-nowrap">Used {formatTimeAgo(lastUsedAt)}</span>
              </div>
              <p className="text-gray-600 text-xs">
                Full key shown once at generation. Regenerate to get a new one.
              </p>

              {confirming ? (
                <div className="bg-yellow-900/15 border border-yellow-700/40 rounded-lg p-3">
                  <p className="text-yellow-300 text-xs font-medium mb-1">This will invalidate your current key.</p>
                  <p className="text-gray-400 text-xs mb-3">Any integrations using it will stop working immediately.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateKey}
                      disabled={regenerating}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-medium disabled:opacity-50 transition-colors"
                    >
                      {regenerating ? 'Regenerating…' : 'Yes, regenerate'}
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-white rounded-md font-medium transition-colors border border-gray-700/60"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate key
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 bg-gray-950/40 border border-gray-800 rounded-lg px-4 py-4">
              <Key className="w-8 h-8 text-gray-700 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-gray-400 text-sm font-medium">No API key</p>
                <p className="text-gray-600 text-xs mt-0.5">Generate a key to access the REST API and MCP tools.</p>
              </div>
              <button
                onClick={handleGenerateKey}
                disabled={regenerating}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-black text-xs rounded-md font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {regenerating ? 'Generating…' : 'Generate Key'}
              </button>
            </div>
          )}
        </div>

        {/* ── MCP Config (only when key exists) ── */}
        {keyPrefix && (
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">MCP Server</p>
            </div>
            <p className="text-gray-500 text-sm mb-3">
              Add to your Claude Desktop or Cursor <code className="text-gray-400 bg-gray-800/60 px-1 py-0.5 rounded text-xs">mcp.json</code> to control your portal from any AI assistant.
            </p>

            <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/80">
                <span className="text-gray-600 text-xs font-mono">mcp.json</span>
                <button
                  onClick={() => copyText(mcpConfig('YOUR_API_KEY_HERE'), setMcpCopied)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-xs font-medium transition-colors border border-gray-700"
                >
                  {mcpCopied ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3 h-3" />Copy</>}
                </button>
              </div>
              <pre className="p-4 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed">{`{
  "mcpServers": {
    "flowengine": {
      "command": "npx",
      "args": ["-y", "flowengine-mcp-app"],
      "env": {
        "FLOWENGINE_API_KEY": "${keyPrefix}...",
        "PORTAL_BASE_URL": "${baseUrl}"
      }
    }
  }
}`}</pre>
            </div>
            <p className="text-gray-600 text-xs mt-2">
              Replace <code className="text-gray-500">{keyPrefix}...</code> with your full key. Regenerate above to reveal it.
            </p>
          </div>
        )}
      </div>

      {/* ── New Key Modal ── */}
      {showNewKeyModal && newApiKey && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowNewKeyModal(false); setNewApiKey(''); } }}
        >
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <h3 className="text-white text-base font-semibold">API Key Generated</h3>
                <p className="text-gray-500 text-xs">Save it now — you won't see the full key again.</p>
              </div>
            </div>

            {/* Key */}
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 mb-4">
              <p className="text-gray-500 text-xs mb-2 font-medium">Your API Key</p>
              <div className="flex items-center gap-2">
                <code className="text-green-400 text-sm break-all select-all flex-1 font-mono">{newApiKey}</code>
                <button
                  onClick={() => copyText(newApiKey, setKeyCopied)}
                  className="px-3 py-1.5 text-xs bg-white hover:bg-gray-200 text-black rounded font-medium whitespace-nowrap transition-colors flex-shrink-0"
                >
                  {keyCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* MCP Config */}
            <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden mb-4">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                <span className="text-gray-600 text-xs font-mono">mcp.json (with your key)</span>
                <button
                  onClick={() => copyText(mcpConfig(newApiKey), setMcpCopied)}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-xs font-medium transition-colors border border-gray-700"
                >
                  {mcpCopied ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3 h-3" />Copy</>}
                </button>
              </div>
              <pre className="p-3 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed">{mcpConfig(newApiKey)}</pre>
            </div>

            {/* Quick test */}
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 mb-5">
              <p className="text-gray-500 text-xs mb-1.5 font-medium">Quick test</p>
              <code className="text-gray-400 text-xs block font-mono break-all">
                {`curl ${baseUrl}/api/v1/me \\\n  -H "Authorization: Bearer ${newApiKey}"`}
              </code>
            </div>

            <button
              onClick={() => { setShowNewKeyModal(false); setNewApiKey(''); }}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 font-medium text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
