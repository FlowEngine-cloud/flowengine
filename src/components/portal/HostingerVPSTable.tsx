'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthContext';
import { ChevronDown, ChevronUp, RefreshCw, Server, AlertTriangle, Check, X, Pencil } from 'lucide-react';

interface ServerItem {
  id: string;
  source: 'coolify' | 'hostinger';
  hostname: string;
  ip: string | null;
  domain: string | null;
  state: string;
  cpus: number;
  memory_gb: number;
  disk_gb: number;
  cpu_percent: number | null;
  ram_percent: number | null;
  disk_percent: number | null;
  metrics_updated_at: string | null;
  is_active: boolean | null;
  provider: string | null;
  provider_plan: string | null;
  provider_region: string | null;
  custom_name: string | null;
  alert_cpu_threshold: number;
  alert_ram_threshold: number;
  alert_disk_threshold: number;
}

function MetricBar({ label, value, threshold }: { label: string; value: number; threshold: number }) {
  const isAlert = value >= threshold;
  const barColor = isAlert ? 'bg-red-500' : value >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  const textColor = isAlert ? 'text-red-400' : value >= 70 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-white/60 text-sm w-10 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-sm font-medium w-10 text-right shrink-0 ${textColor}`}>
        {value}%
      </span>
      {isAlert && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
    </div>
  );
}

function StatusBadge({ state, isActive }: { state: string; isActive: boolean | null }) {
  if (state === 'running') {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        Running
      </span>
    );
  }
  if (state === 'unreachable') {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
        Unreachable
      </span>
    );
  }
  if (state === 'stopped') {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
        Stopped
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 inline-flex items-center gap-1">
      {state}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === 'coolify') {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800/30 text-gray-400 border border-gray-700">
        Coolify
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800/30 text-gray-400 border border-gray-700">
      Hostinger
    </span>
  );
}

function ServerRow({ server, token }: { server: ServerItem; token: string }) {
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(server.custom_name || '');
  const [saving, setSaving] = useState(false);
  const [currentName, setCurrentName] = useState(server.custom_name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const saveName = async () => {
    const trimmed = nameValue.trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/hostinger/vps/${server.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customName: trimmed || null }),
      });
      if (res.ok) {
        setCurrentName(trimmed || null);
      }
    } catch { /* ignore */ }
    setSaving(false);
    setEditing(false);
  };

  const cancelEdit = () => {
    setNameValue(currentName || '');
    setEditing(false);
  };

  const displayName = currentName || server.hostname;
  const hasCpuMetrics = server.cpu_percent !== null;
  const hasAlert = hasCpuMetrics && (
    (server.cpu_percent ?? 0) >= server.alert_cpu_threshold ||
    (server.ram_percent ?? 0) >= server.alert_ram_threshold ||
    (server.disk_percent ?? 0) >= server.alert_disk_threshold
  );

  const metricsAge = server.metrics_updated_at
    ? Math.round((Date.now() - new Date(server.metrics_updated_at).getTime()) / 60000)
    : null;

  return (
    <div className={`bg-gray-800/30 border rounded-lg p-4 space-y-3 transition-colors ${hasAlert ? 'border-red-800/60' : 'border-gray-700'}`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${hasAlert ? 'bg-red-900/30' : 'bg-gray-700/50'}`}>
            <Server className={`w-4 h-4 ${hasAlert ? 'text-red-400' : 'text-white/60'}`} />
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  placeholder={server.hostname}
                  className="px-2 py-1 bg-gray-900/50 border border-gray-600 rounded text-sm text-white placeholder:text-gray-500 focus:ring-1 focus:ring-white focus:border-white outline-none w-full max-w-[200px]"
                  disabled={saving}
                />
                <button onClick={saveName} disabled={saving} className="p-1 rounded hover:bg-gray-700 text-green-400 cursor-pointer">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={cancelEdit} className="p-1 rounded hover:bg-gray-700 text-gray-400 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">{displayName}</span>
                <button onClick={() => { setNameValue(currentName || ''); setEditing(true); }} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white/60 cursor-pointer">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-white/40 mt-0.5 flex-wrap">
              {server.ip && <span>{server.ip}</span>}
              {server.domain && <><span className="text-white/20">·</span><span>{server.domain}</span></>}
              {server.provider_plan && <><span className="text-white/20">·</span><span>{server.provider_plan}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SourceBadge source={server.source} />
          <StatusBadge state={server.state} isActive={server.is_active} />
        </div>
      </div>

      {/* Specs row */}
      <div className="flex items-center gap-4 text-sm text-white/40">
        {server.cpus > 0 && <span>{server.cpus} vCPU</span>}
        {server.memory_gb > 0 && <span>{server.memory_gb} GB RAM</span>}
        {server.disk_gb > 0 && <span>{server.disk_gb} GB Disk</span>}
        {metricsAge !== null && (
          <span className="text-white/20">
            updated {metricsAge < 1 ? 'just now' : metricsAge < 60 ? `${metricsAge}m ago` : `${Math.round(metricsAge / 60)}h ago`}
          </span>
        )}
      </div>

      {/* Metrics from DB (already collected by admin cron) */}
      {hasCpuMetrics && (
        <div className="space-y-2">
          <MetricBar label="CPU" value={Math.round(server.cpu_percent ?? 0)} threshold={server.alert_cpu_threshold} />
          <MetricBar label="RAM" value={Math.round(server.ram_percent ?? 0)} threshold={server.alert_ram_threshold} />
          <MetricBar label="Disk" value={Math.round(server.disk_percent ?? 0)} threshold={server.alert_disk_threshold} />
        </div>
      )}

      {/* Alert banner */}
      {hasAlert && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>High load detected - resource usage exceeds 90% threshold</span>
        </div>
      )}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map(i => (
        <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-700/50 rounded-lg animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-32 bg-gray-700/50 rounded animate-pulse" />
              <div className="h-3 w-48 bg-gray-700/30 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map(j => (
              <div key={j} className="h-2 bg-gray-700/30 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HostingerVPSTable() {
  const { session } = useAuth();
  const [managed, setManaged] = useState<ServerItem[]>([]);
  const [other, setOther] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('hostinger-vps-expanded') !== 'false'; } catch { return true; }
  });

  const fetchServers = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hostinger/vps', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setManaged(data.managed || []);
      setOther(data.other || []);
    } catch {
      setError('Could not load server list');
    }
    setLoading(false);
  }, [session?.access_token]);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem('hostinger-vps-expanded', String(next)); } catch {}
  };

  const allServers = [...managed, ...other];
  const totalCount = allServers.length;
  const alertCount = allServers.filter(s =>
    s.cpu_percent !== null && (
      (s.cpu_percent ?? 0) >= s.alert_cpu_threshold ||
      (s.ram_percent ?? 0) >= s.alert_ram_threshold ||
      (s.disk_percent ?? 0) >= s.alert_disk_threshold
    )
  ).length;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-white/60" />
          <span className="text-sm font-semibold text-white">Infrastructure (VPS Servers)</span>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-white/60 border border-gray-700">
              {totalCount}
            </span>
          )}
          {alertCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-900/30 text-red-400 border border-red-800/40">
              {alertCount} alert{alertCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {loading ? (
            <SectionSkeleton />
          ) : error ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
              <button onClick={fetchServers} className="ml-auto text-sm underline hover:no-underline cursor-pointer">Retry</button>
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              No servers found.
            </div>
          ) : (
            <>
              {/* Managed Servers (n8n / WhatsApp deployment servers) */}
              {managed.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Deployment Servers</h3>
                  {managed.map(server => (
                    <ServerRow key={server.id} server={server} token={session!.access_token} />
                  ))}
                </div>
              )}

              {/* Other Servers (Coolify / Hostinger not used for deployments) */}
              {other.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Other Servers</h3>
                  {other.map(server => (
                    <ServerRow key={server.id} server={server} token={session!.access_token} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Refresh all */}
          {!loading && totalCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={fetchServers}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-gray-800/30 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
