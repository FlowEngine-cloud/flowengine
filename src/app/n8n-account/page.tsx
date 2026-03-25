'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import { ExternalLink, Loader2, Server, RefreshCw, CheckCircle, XCircle, Info } from 'lucide-react';

interface N8nAccountPageProps {
  embedded?: boolean;
  focusInstanceId?: string;
  onInstanceDeleted?: () => void;
  /** Live status from hosting layout polling (overrides stale DB status) */
  liveStatus?: string;
}

interface InstanceData {
  id: string;
  instance_name: string;
  instance_url: string | null;
  status: string;
  storage_limit_gb: number | null;
  created_at: string;
  service_type: string | null;
  n8n_api_key?: string | null;
  is_external?: boolean;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  running:      { label: 'Running',      cls: 'text-green-400 bg-green-900/20 border-green-800' },
  active:       { label: 'Running',      cls: 'text-green-400 bg-green-900/20 border-green-800' },
  stopped:      { label: 'Stopped',      cls: 'text-red-400 bg-red-900/20 border-red-800' },
  error:        { label: 'Error',        cls: 'text-red-400 bg-red-900/20 border-red-800' },
  deploying:    { label: 'Deploying',    cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
  provisioning: { label: 'Provisioning', cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
  starting:     { label: 'Starting',     cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
};

export default function N8nAccountPage({ focusInstanceId, liveStatus: liveStatusProp }: N8nAccountPageProps) {
  const { session } = useAuth();
  const [instance, setInstance] = useState<InstanceData | null>(null);
  const [loading, setLoading] = useState(!!focusInstanceId);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!focusInstanceId) { setLoading(false); return; }
    supabase
      .from('pay_per_instance_deployments')
      .select('id, instance_name, instance_url, status, storage_limit_gb, created_at, service_type, n8n_api_key, is_external')
      .eq('id', focusInstanceId)
      .maybeSingle()
      .then(({ data }) => {
        setInstance(data);
        setLoading(false);
      });
  }, [focusInstanceId]);

  const checkConnection = useCallback(async () => {
    if (!instance?.instance_url || !session?.access_token) return;
    setChecking(true);
    try {
      const res = await fetch('/api/client-panel/' + instance.id, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setReachable(res.ok);
    } catch {
      setReachable(false);
    } finally {
      setChecking(false);
    }
  }, [instance, session?.access_token]);

  // Auto-check on mount
  useEffect(() => {
    if (instance?.instance_url) checkConnection();
  }, [instance?.instance_url]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center">
          <Server className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">Instance not found</p>
        </div>
      </div>
    );
  }

  const effectiveStatus = liveStatusProp || instance.status;
  const s = STATUS_MAP[effectiveStatus] ?? { label: effectiveStatus, cls: 'text-gray-400 bg-gray-800/30 border-gray-700' };
  const created = instance.created_at ? new Date(instance.created_at).toLocaleDateString() : null;
  const iconSrc = instance.service_type === 'openclaw' ? '/logos/openclaw.png' : '/logos/n8n.svg';
  const iconStyle = instance.service_type === 'openclaw'
    ? undefined
    : { filter: 'brightness(0) invert(1) opacity(0.7)' } as React.CSSProperties;
  const isExternal = !instance.instance_url?.includes(window?.location?.hostname ?? 'localhost');

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

      {/* Header card */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-gray-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <img src={iconSrc} className="w-5 h-5 object-contain" alt="" style={iconStyle} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{instance.instance_name}</p>
            {instance.is_external ? (
              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 text-gray-400 bg-gray-800/30 border-gray-700">External</span>
            ) : (
              <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 ${s.cls}`}>{s.label}</span>
            )}
          </div>
          {instance.instance_url && (
            <a
              href={instance.instance_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              Open <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {!instance.is_external && (instance.storage_limit_gb ?? 0) > 0 && (
            <div className="bg-gray-800/30 rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">Storage</p>
              <p className="text-white font-medium">{instance.storage_limit_gb} GB</p>
            </div>
          )}
          {created && (
            <div className="bg-gray-800/30 rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">Created</p>
              <p className="text-white font-medium">{created}</p>
            </div>
          )}
          {instance.n8n_api_key && (
            <div className="bg-gray-800/30 rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">API Key</p>
              <p className="text-white font-medium text-xs font-mono">••••••••</p>
            </div>
          )}
        </div>
      </div>

      {/* Connection status */}
      {instance.instance_url && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-white">Connection Status</p>
            <button
              onClick={checkConnection}
              disabled={checking}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
              Test
            </button>
          </div>
          <div className="flex items-center gap-2">
            {checking ? (
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            ) : reachable === true ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : reachable === false ? (
              <XCircle className="w-4 h-4 text-red-400" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gray-600" />
            )}
            <span className="text-sm text-white/60">
              {checking ? 'Checking…' : reachable === true ? 'Reachable' : reachable === false ? 'Unreachable' : 'Not checked'}
            </span>
          </div>
          <a
            href={instance.instance_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-xs text-white/40 font-mono hover:text-white/70 transition-colors break-all"
          >
            {instance.instance_url}
          </a>
        </div>
      )}

      {/* External instance info */}
      {isExternal && (
        <div className="bg-blue-900/10 border border-blue-800/40 rounded-lg p-4 flex gap-3">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-300 mb-1">Self-hosted Instance</p>
            <p className="text-xs text-white/50">
              This is a self-hosted n8n instance connected to the portal. Use the <strong className="text-white/70">Manage</strong> tab to manage workflows, widgets, and credentials. Infrastructure controls (start/stop) are managed directly on your server.
            </p>
          </div>
        </div>
      )}

      {!instance.instance_url && (
        <div className="bg-yellow-900/10 border border-yellow-800/40 rounded-lg p-4">
          <p className="text-sm text-yellow-400 font-medium mb-1">No URL configured</p>
          <p className="text-xs text-white/50">
            This instance does not have a URL configured. Go to your n8n server and connect it via the hosting setup.
          </p>
        </div>
      )}
    </div>
  );
}
