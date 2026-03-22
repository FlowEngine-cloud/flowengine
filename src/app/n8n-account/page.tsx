'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExternalLink, Loader2, Server } from 'lucide-react';

interface N8nAccountPageProps {
  embedded?: boolean;
  focusInstanceId?: string;
  onInstanceDeleted?: () => void;
}

interface InstanceData {
  id: string;
  instance_name: string;
  instance_url: string | null;
  status: string;
  storage_limit_gb: number | null;
  created_at: string;
  service_type: string | null;
}

export default function N8nAccountPage({ focusInstanceId }: N8nAccountPageProps) {
  const [instance, setInstance] = useState<InstanceData | null>(null);
  const [loading, setLoading] = useState(!!focusInstanceId);

  useEffect(() => {
    if (!focusInstanceId) { setLoading(false); return; }
    supabase
      .from('pay_per_instance_deployments')
      .select('id, instance_name, instance_url, status, storage_limit_gb, created_at, service_type')
      .eq('id', focusInstanceId)
      .maybeSingle()
      .then(({ data }) => {
        setInstance(data);
        setLoading(false);
      });
  }, [focusInstanceId]);

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

  const statusMap: Record<string, { label: string; cls: string }> = {
    running: { label: 'Running', cls: 'text-green-400 bg-green-900/20 border-green-800' },
    active: { label: 'Running', cls: 'text-green-400 bg-green-900/20 border-green-800' },
    stopped: { label: 'Stopped', cls: 'text-red-400 bg-red-900/20 border-red-800' },
    error: { label: 'Error', cls: 'text-red-400 bg-red-900/20 border-red-800' },
    deploying: { label: 'Deploying', cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
    provisioning: { label: 'Provisioning', cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
    starting: { label: 'Starting', cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
  };
  const s = statusMap[instance.status] ?? { label: instance.status, cls: 'text-gray-400 bg-gray-800/30 border-gray-700' };
  const created = instance.created_at ? new Date(instance.created_at).toLocaleDateString() : null;
  const iconSrc = instance.service_type === 'openclaw' ? '/logos/openclaw.png' : '/logos/n8n.svg';
  const iconStyle = instance.service_type === 'openclaw'
    ? undefined
    : { filter: 'brightness(0) invert(1) opacity(0.7)' } as React.CSSProperties;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {/* Header */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-gray-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <img src={iconSrc} className="w-5 h-5 object-contain" alt="" style={iconStyle} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{instance.instance_name}</p>
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 ${s.cls}`}>{s.label}</span>
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

        <div className="grid grid-cols-2 gap-3">
          {(instance.storage_limit_gb ?? 0) > 0 && (
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
        </div>
      </div>

      {/* URL */}
      {instance.instance_url && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-white/40 mb-2">Instance URL</p>
          <a
            href={instance.instance_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/70 font-mono hover:text-white transition-colors break-all"
          >
            {instance.instance_url}
          </a>
        </div>
      )}
    </div>
  );
}
