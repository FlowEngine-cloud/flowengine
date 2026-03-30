'use client';

/**
 * Hosting Instance Detail Page
 * - For pending_deploy instances: shows service selection + deploy button
 * - For all other instances: renders N8nAccountPage (handles both n8n and OpenClaw)
 */
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { PortalInstance } from '@/components/portal/usePortalInstances';
import N8nAccountPage from '@/app/n8n-account/page';
import { useHostingContext } from '../context';
import { Server, Loader2, ChevronRight, ExternalLink, Play, Square, RotateCcw, Trash2, Globe, RefreshCw, Terminal, History, Pencil, Check, X, Link2, Users, Plus, Cloud } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

function ServiceIcon({ serviceType, className = 'w-5 h-5' }: { serviceType?: string | null; className?: string }) {
  if (serviceType === 'openclaw') return <img src="/logos/openclaw.png" className={`${className} object-contain rounded`} alt="OpenClaw" />;
  if (serviceType === 'website') return <Globe className={className + ' text-white/60'} />;
  if (serviceType === 'n8n') return <img src="/logos/n8n.svg" className={className + ' object-contain'} alt="n8n" style={{ filter: 'brightness(0) invert(1) opacity(0.7)' }} />;
  if (serviceType === 'other') return <Link2 className={className + ' text-white/60'} />;
  return <Server className={className + ' text-white/30'} />;
}

// Shared inline name editor used by multiple detail components
function InlineNameEditor({
  name,
  onSave,
  saving,
}: {
  name: string;
  onSave: (newName: string) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const handleSave = async () => {
    if (!draft.trim() || draft.trim() === name) { setEditing(false); return; }
    await onSave(draft.trim());
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-white font-semibold truncate">{name}</p>
        <button
          onClick={() => { setDraft(name); setEditing(true); }}
          className="p-1 rounded hover:bg-gray-700 text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        maxLength={50}
        className="flex-1 min-w-0 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-white"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="p-1 rounded hover:bg-gray-700 text-green-400 hover:text-green-300 transition-colors flex-shrink-0 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="p-1 rounded hover:bg-gray-700 text-white/40 hover:text-white/60 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}


// ─── Shared Client Assignment Section ────────────────────────────────────────

type ClientAssignment = { user_id: string; client_email: string; client_name?: string };

function ClientAssignmentSection({ instanceId, access }: { instanceId: string; access: string | undefined }) {
  const { session } = useAuth();
  const [clientAssignments, setClientAssignments] = useState<ClientAssignment[]>([]);
  const [allAgencyClients, setAllAgencyClients] = useState<ClientAssignment[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token || clientsLoaded || access !== 'owner') return;
    const load = async () => {
      try {
        const res = await fetch('/api/client/instances', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list: any[] = data.instances || [];
        const seenIds = new Set<string>();
        const all: ClientAssignment[] = [];
        for (const ci of list) {
          if (!ci.user_id || ci.user_id.startsWith('pending:') || ci.user_id.startsWith('ni_')) continue;
          if (seenIds.has(ci.user_id)) continue;
          seenIds.add(ci.user_id);
          all.push({ user_id: ci.user_id, client_email: ci.client_email || ci.user_id, client_name: ci.client_name });
        }
        setAllAgencyClients(all);
        const assigned = list
          .filter(ci => ci.instance_id === instanceId && !ci.user_id?.startsWith('pending:') && !ci.client_paid)
          .map(ci => ({ user_id: ci.user_id, client_email: ci.client_email || ci.user_id, client_name: ci.client_name }));
        setClientAssignments(assigned);
      } catch { /* silent */ } finally {
        setClientsLoaded(true);
      }
    };
    load();
  }, [session?.access_token, clientsLoaded, instanceId, access]);

  const handleAssign = async () => {
    if (!session?.access_token || !selectedClientId) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_id: instanceId, client_user_id: selectedClientId }),
      });
      const data = await res.json();
      if (!res.ok) { setAssignError(data.error || 'Failed to assign client'); return; }
      const client = allAgencyClients.find(c => c.user_id === selectedClientId);
      if (client) setClientAssignments(prev => [...prev, client]);
      setShowForm(false);
      setSelectedClientId('');
    } catch {
      setAssignError('Failed to assign client');
    } finally {
      setAssigning(false);
    }
  };

  const handleRevoke = async (clientUserId: string) => {
    if (!session?.access_token) return;
    setRevokingId(clientUserId);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_id: instanceId, user_id: clientUserId }),
      });
      if (res.ok) setClientAssignments(prev => prev.filter(c => c.user_id !== clientUserId));
    } catch { /* silent */ } finally {
      setRevokingId(null);
    }
  };

  if (access !== 'owner') return null;

  const available = allAgencyClients.filter(c => !clientAssignments.some(a => a.user_id === c.user_id));

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Assigned Clients</p>
        {clientsLoaded && !showForm && clientAssignments.length === 0 && available.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
          >
            <Plus className="w-3 h-3" /> Assign
          </button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3">
          <SearchableSelect
            value={selectedClientId}
            onChange={setSelectedClientId}
            placeholder="Select a client..."
            options={[
              { value: '', label: 'Select a client...' },
              ...available.map(c => ({ value: c.user_id, label: c.client_name ? `${c.client_name} (${c.client_email})` : c.client_email })),
            ]}
          />
          {assignError && <p className="text-xs text-red-400">{assignError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAssign}
              disabled={!selectedClientId || assigning}
              className="px-3 py-2 bg-white text-black hover:bg-gray-100 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
            <button
              onClick={() => { setShowForm(false); setSelectedClientId(''); setAssignError(null); }}
              className="px-3 py-2 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!clientsLoaded ? (
        <Loader2 className="w-4 h-4 animate-spin text-white/30" />
      ) : clientAssignments.length === 0 ? (
        <p className="text-sm text-white/40">No clients assigned</p>
      ) : (
        <div className="space-y-2">
          {clientAssignments.map(c => (
            <div key={c.user_id} className="flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-800 rounded-lg">
              <Users className="w-4 h-4 text-white/30 shrink-0" />
              <div className="flex-1 min-w-0">
                {c.client_name && <p className="text-sm font-medium text-white truncate">{c.client_name}</p>}
                <p className="text-sm text-white/60 truncate">{c.client_email}</p>
              </div>
              <button
                onClick={() => handleRevoke(c.user_id)}
                disabled={revokingId === c.user_id}
                className="p-1.5 rounded-lg hover:bg-red-900/30 text-white/20 hover:text-red-400 transition-colors disabled:opacity-50"
                title="Revoke access"
              >
                {revokingId === c.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FlowEngine Instance Detail ──────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; spin?: boolean; pulse?: boolean }> = {
  running:      { label: 'Running',      cls: 'text-green-400 bg-green-900/20 border-green-800', pulse: true },
  active:       { label: 'Running',      cls: 'text-green-400 bg-green-900/20 border-green-800', pulse: true },
  unhealthy:    { label: 'Unhealthy',    cls: 'text-orange-400 bg-orange-900/20 border-orange-800', pulse: true },
  stopped:      { label: 'Stopped',      cls: 'text-red-400 bg-red-900/20 border-red-800' },
  exited:       { label: 'Stopped',      cls: 'text-red-400 bg-red-900/20 border-red-800' },
  error:        { label: 'Error',        cls: 'text-red-400 bg-red-900/20 border-red-800' },
  failed:       { label: 'Error',        cls: 'text-red-400 bg-red-900/20 border-red-800' },
  provisioning: { label: 'Provisioning', cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
  deploying:    { label: 'Deploying',    cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
  starting:     { label: 'Starting',     cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
  stopping:     { label: 'Stopping',     cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
  restarting:   { label: 'Restarting',   cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
  updating:     { label: 'Updating',     cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
};

/** Normalize a raw coolify_status (e.g. "running:healthy", "exited:0") to a STATUS_CONFIG key */
function parseCoolifyStatus(raw: string): string {
  if (!raw) return 'stopped';
  const main = raw.split(':')[0];
  const sub  = raw.split(':')[1];
  if (main === 'running' && sub === 'unhealthy') return 'unhealthy';
  if (main === 'exited') return 'exited';
  if (main === 'restarting') return 'restarting';
  return main;
}

/**
 * FlowEngine Cloud Instance Detail
 * Full management UI using FlowEngine API (start/stop/restart, logs, client assignment).
 */
function FlowEngineInstanceDetail(props: { instance: PortalInstance; onDeleted: () => void; onRenamed?: (newName: string) => void }) {
  const { instance, onRenamed } = props;
  const { session } = useAuth();
  const feUrl = `https://flowengine.cloud/portal/hosting/${instance.id}`;

  const [liveStatus, setLiveStatus] = useState(parseCoolifyStatus(instance.status));
  const [actionLoading, setActionLoading] = useState<'start' | 'stop' | 'restart' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [currentName, setCurrentName] = useState(instance.instance_name);

  // Poll live status every 15s — prefer coolify_status (real Coolify value)
  useEffect(() => {
    if (!session?.access_token) return;
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/flowengine/instances/${instance.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok && mounted) {
          const data = await res.json();
          const raw = data.instance?.coolify_status || data.instance?.status;
          if (raw) setLiveStatus(parseCoolifyStatus(raw));
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 15_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [session?.access_token, instance.id]);

  const handleManage = async (action: 'start' | 'stop' | 'restart') => {
    if (!session?.access_token) return;
    setActionLoading(action);
    setActionError(null);
    try {
      const res = await fetch(`/api/flowengine/instances/${instance.id}/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.message || 'Action failed'); return; }
      setLiveStatus(action === 'stop' ? 'stopped' : 'starting');
    } catch {
      setActionError('Request failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRename = async (newName: string) => {
    if (!session?.access_token) return;
    setNameSaving(true);
    try {
      const res = await fetch(`/api/flowengine/instances/${instance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_name: newName }),
      });
      if (res.ok) {
        setCurrentName(newName);
        try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
        onRenamed?.(newName);
      }
    } catch {} finally {
      setNameSaving(false);
    }
  };

  const sc = STATUS_CONFIG[liveStatus] ?? { label: liveStatus, cls: 'text-gray-400 bg-gray-800/30 border-gray-700' };
  const isRunning = liveStatus === 'running' || liveStatus === 'active' || liveStatus === 'unhealthy';
  const isStopped = ['stopped', 'exited', 'error', 'failed'].includes(liveStatus);
  const isTransitioning = ['provisioning', 'deploying', 'starting', 'stopping', 'restarting', 'updating'].includes(liveStatus);
  const created = instance.created_at ? new Date(instance.created_at).toLocaleDateString() : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Header card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-gray-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Cloud className="w-5 h-5 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <InlineNameEditor name={currentName} onSave={handleRename} saving={nameSaving} />
              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border mt-1 ${sc.cls}`}>
                {sc.spin && <Loader2 className="w-3 h-3 animate-spin" />}
                {!sc.spin && sc.pulse && <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />}
                {sc.label}
              </span>
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
            {instance.storage_limit_gb > 0 && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-sm text-white/60 mb-1">Storage</p>
                <p className="text-white font-medium">{instance.storage_limit_gb} GB</p>
              </div>
            )}
            {created && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-sm text-white/60 mb-1">Created</p>
                <p className="text-white font-medium">{created}</p>
              </div>
            )}
            <div className="bg-gray-800/30 rounded-lg p-3">
              <p className="text-sm text-white/60 mb-1">Platform</p>
              <p className="text-white font-medium">FlowEngine Cloud</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <p className="text-sm font-medium text-white mb-4">Controls</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleManage('start')}
              disabled={!!actionLoading || isTransitioning || isRunning}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-900/20 text-green-400 border border-green-800 hover:bg-green-900/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === 'start' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Start
            </button>
            <button
              onClick={() => handleManage('stop')}
              disabled={!!actionLoading || isTransitioning || isStopped}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === 'stop' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              Stop
            </button>
            <button
              onClick={() => handleManage('restart')}
              disabled={!!actionLoading || isTransitioning || isStopped}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-900/20 text-yellow-400 border border-yellow-800 hover:bg-yellow-900/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === 'restart' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Restart
            </button>
            <a
              href={feUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800/30 text-white/60 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in FlowEngine
            </a>
          </div>
          {actionError && <p className="text-sm text-red-400 mt-3">{actionError}</p>}
        </div>

      </div>
    </div>
  );
}

// ─── Website / Docker Instance Detail ────────────────────────────────────────

function WebsiteInstanceDetail({ instance, onDeleted }: { instance: PortalInstance; onDeleted: () => void }) {
  const { session } = useAuth();
  const [openingBilling, setOpeningBilling] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [currentName, setCurrentName] = useState(instance.instance_name);

  // Live status
  const [liveStatus, setLiveStatus] = useState(instance.status);
  const [actionLoading, setActionLoading] = useState<'start' | 'stop' | 'restart' | 'redeploy' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Logs
  const [logs, setLogs] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  // Deployments
  const [deployments, setDeployments] = useState<any[]>([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);
  const [deploymentsOpen, setDeploymentsOpen] = useState(false);

  const created = instance.created_at ? new Date(instance.created_at).toLocaleDateString() : null;

  // Poll status
  useEffect(() => {
    if (!session?.access_token) return;
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/docker/status?instanceId=${instance.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.containerStatus) setLiveStatus(data.containerStatus);
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 10000);
    return () => { mounted = false; clearInterval(iv); };
  }, [session?.access_token, instance.id]);

  const sc = STATUS_CONFIG[liveStatus] ?? { label: liveStatus, cls: 'text-gray-400 bg-gray-800/30 border-gray-700' };
  const isRunning = liveStatus === 'running';
  const isStopped = ['stopped', 'error', 'failed', 'exited'].includes(liveStatus);
  const isTransitioning = ['provisioning', 'starting', 'stopping', 'restarting'].includes(liveStatus);

  const handleManage = async (action: 'start' | 'stop' | 'restart' | 'redeploy') => {
    if (!session?.access_token) return;
    setActionLoading(action);
    setActionError(null);
    try {
      const res = await fetch('/api/docker/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instanceId: instance.id, action }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || 'Action failed'); return; }
      if (action === 'stop') setLiveStatus('stopped');
      else setLiveStatus('provisioning');
    } catch {
      setActionError('Request failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const fetchLogs = async () => {
    if (!session?.access_token) return;
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/docker/logs?instanceId=${instance.id}&lines=300`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setLogs(await res.text());
    } catch {
      setLogs('Failed to fetch logs.');
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchDeployments = async () => {
    if (!session?.access_token) return;
    setDeploymentsLoading(true);
    try {
      const res = await fetch(`/api/docker/deployments?instanceId=${instance.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments || []);
      }
    } catch {}
    setDeploymentsLoading(false);
  };

  const handleOpenBilling = async () => {
    if (!session?.access_token) return;
    setOpeningBilling(true);
    try {
      const res = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: instance.stripe_subscription_id, return_url: window.location.href }),
      });
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, '_blank');
      }
    } catch {} finally {
      setOpeningBilling(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.access_token) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/docker/instance?instanceId=${instance.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || 'Failed to delete instance');
        setDeleting(false);
        return;
      }
      try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
      onDeleted();
    } catch {
      setDeleteError('Delete failed. Please try again.');
      setDeleting(false);
    }
  };

  const handleRename = async (newName: string) => {
    if (!session?.access_token) return;
    setNameSaving(true);
    try {
      const res = await fetch('/api/hosting/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instanceId: instance.id, newName }),
      });
      if (res.ok) {
        setCurrentName(newName);
        try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
      }
    } catch {} finally {
      setNameSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Header card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-gray-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <InlineNameEditor name={currentName} onSave={handleRename} saving={nameSaving} />
              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border mt-1 ${sc.cls}`}>
                {sc.spin && <Loader2 className="w-3 h-3 animate-spin" />}
                {!sc.spin && sc.pulse && <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />}
                {sc.label}
              </span>
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
            {instance.storage_limit_gb > 0 && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-sm text-white/60 mb-1">Storage</p>
                <p className="text-white font-medium">{instance.storage_limit_gb} GB</p>
              </div>
            )}
            {created && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-sm text-white/60 mb-1">Created</p>
                <p className="text-white font-medium">{created}</p>
              </div>
            )}
            {instance.access && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-sm text-white/60 mb-1">Access</p>
                <p className="text-white font-medium capitalize">{instance.access}</p>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <p className="text-sm font-medium text-white mb-4">Controls</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleManage('start')}
              disabled={!!actionLoading || isTransitioning || isRunning}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-900/20 text-green-400 border border-green-800 hover:bg-green-900/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === 'start' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Start
            </button>
            <button
              onClick={() => handleManage('stop')}
              disabled={!!actionLoading || isTransitioning || isStopped}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === 'stop' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              Stop
            </button>
            <button
              onClick={() => handleManage('restart')}
              disabled={!!actionLoading || isTransitioning || !isRunning}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-900/20 text-yellow-400 border border-yellow-800 hover:bg-yellow-900/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === 'restart' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Restart
            </button>
            <button
              onClick={() => handleManage('redeploy')}
              disabled={!!actionLoading || isTransitioning}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-700 hover:bg-gray-800/30 text-white/60 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading === 'redeploy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Redeploy
            </button>
          </div>
          {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
        </div>

        {/* Logs */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => {
              const next = !logsOpen;
              setLogsOpen(next);
              if (next && logs === null) fetchLogs();
            }}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium text-white">Logs</span>
            </div>
            <div className="flex items-center gap-2">
              {logsOpen && (
                <button
                  onClick={e => { e.stopPropagation(); fetchLogs(); }}
                  className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${logsOpen ? 'rotate-90' : ''}`} />
            </div>
          </button>
          {logsOpen && (
            <div className="border-t border-gray-800">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                </div>
              ) : (
                <pre className="p-4 text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto bg-black/30">
                  {logs || '(no logs)'}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Deployment history */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => {
              const next = !deploymentsOpen;
              setDeploymentsOpen(next);
              if (next && deployments.length === 0) fetchDeployments();
            }}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium text-white">Deployment History</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${deploymentsOpen ? 'rotate-90' : ''}`} />
          </button>
          {deploymentsOpen && (
            <div className="border-t border-gray-800">
              {deploymentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                </div>
              ) : deployments.length === 0 ? (
                <p className="px-5 py-4 text-sm text-white/60">No deployment history available.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {deployments.map((d, i) => (
                    <div key={d.id || i} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          d.status?.includes('finish') || d.status === 'running' ? 'bg-green-400' :
                          d.status?.includes('error') || d.status?.includes('fail') ? 'bg-red-400' :
                          'bg-yellow-400'
                        }`} />
                        <span className="text-sm text-white/60 truncate capitalize">{d.status || 'deployed'}</span>
                      </div>
                      <span className="text-sm text-white/60 flex-shrink-0">
                        {d.created_at ? new Date(d.created_at).toLocaleString() : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Billing */}
        {instance.stripe_subscription_id && instance.access === 'owner' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
            <p className="text-sm font-medium text-white mb-3">Subscription</p>
            <button
              onClick={handleOpenBilling}
              disabled={openingBilling}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors disabled:opacity-50"
            >
              {openingBilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              Manage Billing
            </button>
          </div>
        )}

        {/* Assigned Clients */}
        <ClientAssignmentSection instanceId={instance.id} access={instance.access} />

        {/* Delete */}
        {instance.access === 'owner' && (
          !showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-red-400/50 hover:text-red-400 rounded-lg text-sm transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Instance
            </button>
          ) : (
            <div className="bg-gray-900/50 border border-red-900/60 rounded-lg p-4 space-y-3">
              <p className="text-sm text-red-400">
                Permanently delete <span className="font-semibold">{instance.instance_name}</span>? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Yes, Delete
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="px-3 py-2 bg-gray-800 text-white/60 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  Cancel
                </button>
              </div>
              {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
            </div>
          )
        )}

      </div>
    </div>
  );
}

function ExternalInstanceDetail({ instance, onDeleted }: { instance: PortalInstance; onDeleted: () => void }) {
  const { session } = useAuth();

  // Name
  const [nameSaving, setNameSaving] = useState(false);
  const [currentName, setCurrentName] = useState(instance.instance_name);

  // URL
  const [currentUrl, setCurrentUrl] = useState(instance.instance_url || '');
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlSaving, setUrlSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Notes
  const [instanceNotes, setInstanceNotes] = useState<string | null>(null);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const created = instance.created_at ? new Date(instance.created_at).toLocaleDateString() : null;

  // Load notes on mount
  useEffect(() => {
    supabase
      .from('pay_per_instance_deployments')
      .select('notes')
      .eq('id', instance.id)
      .maybeSingle()
      .then(({ data }) => {
        setInstanceNotes((data as any)?.notes || null);
        setNotesLoaded(true);
      });
  }, [instance.id]);

  const handleRename = async (newName: string) => {
    if (!session?.access_token) return;
    setNameSaving(true);
    try {
      const res = await fetch('/api/hosting/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instanceId: instance.id, newName }),
      });
      if (res.ok) {
        setCurrentName(newName);
        try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
      }
    } catch {} finally {
      setNameSaving(false);
    }
  };

  const handleSaveUrl = async () => {
    if (!session?.access_token) return;
    setUrlSaving(true);
    setUrlError(null);
    try {
      const res = await fetch('/api/hosting/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instanceId: instance.id, instanceUrl: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setUrlError(data.error || 'Failed to update URL'); return; }
      setCurrentUrl(data.instance?.instance_url ?? urlInput.trim());
      setEditingUrl(false);
    } catch { setUrlError('Request failed.'); } finally {
      setUrlSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!session?.access_token) return;
    setNotesSaving(true);
    try {
      const res = await fetch('/api/hosting/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instanceId: instance.id, notes: notesDraft.trim() }),
      });
      if (res.ok) {
        setInstanceNotes(notesDraft.trim() || null);
        setEditingNotes(false);
      }
    } catch { /* silent */ } finally {
      setNotesSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.access_token) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/hosting/connect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instanceId: instance.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || 'Failed to remove instance');
        setDeleting(false);
        return;
      }
      try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
      onDeleted();
    } catch {
      setDeleteError('Delete failed. Please try again.');
      setDeleting(false);
    }
  };

  const isOwner = instance.access === 'owner';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Header card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-gray-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Link2 className="w-5 h-5 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              {isOwner
                ? <InlineNameEditor name={currentName} onSave={handleRename} saving={nameSaving} />
                : <p className="text-white font-semibold truncate">{currentName}</p>
              }
              <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border mt-1 text-gray-400 bg-gray-800/30 border-gray-700">
                External
              </span>
            </div>
            {currentUrl && (
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
              >
                Open <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {created && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-xs text-white/40 mb-1">Added</p>
                <p className="text-white font-medium text-sm">{created}</p>
              </div>
            )}
          </div>
        </div>

        {/* URL — editable for owners */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-white/40 mb-2">URL</p>
          {isOwner && editingUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="url"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveUrl(); if (e.key === 'Escape') { setEditingUrl(false); setUrlError(null); } }}
                  placeholder="https://your-service.example.com"
                  className="flex-1 min-w-0 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:border-white"
                />
                <button onClick={handleSaveUrl} disabled={urlSaving} className="p-1.5 rounded hover:bg-gray-700 text-green-400 hover:text-green-300 transition-colors disabled:opacity-50">
                  {urlSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { setEditingUrl(false); setUrlError(null); }} className="p-1.5 rounded hover:bg-gray-700 text-white/40 hover:text-white/60 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {urlError && <p className="text-xs text-red-400">{urlError}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-white font-mono flex-1 truncate">
                {currentUrl || <span className="text-white/30">Not set</span>}
              </p>
              {isOwner && (
                <button
                  onClick={() => { setUrlInput(currentUrl); setEditingUrl(true); }}
                  className="p-1 rounded hover:bg-gray-700 text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40">Notes</p>
            {isOwner && notesLoaded && !editingNotes && (
              <button
                onClick={() => { setNotesDraft(instanceNotes || ''); setEditingNotes(true); }}
                className="p-1 rounded hover:bg-gray-700 text-white/30 hover:text-white/60 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {isOwner && editingNotes ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Add a note about this instance…"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-white resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {notesSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save
                </button>
                <button
                  onClick={() => setEditingNotes(false)}
                  className="px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/70 whitespace-pre-wrap">
              {instanceNotes || <span className="text-white/30">{isOwner ? 'No notes — click the pencil to add one.' : 'No notes.'}</span>}
            </p>
          )}
        </div>

        {/* Assigned Clients */}
        <ClientAssignmentSection instanceId={instance.id} access={instance.access} />

        {/* Remove */}
        {isOwner && (
          !showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-red-400/50 hover:text-red-400 rounded-lg text-sm transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove from Portal
            </button>
          ) : (
            <div className="bg-gray-900/50 border border-red-900/60 rounded-lg p-4 space-y-3">
              <p className="text-sm text-white/60">
                Remove <span className="font-semibold text-white">{currentName}</span> from your portal? This does not affect the actual service.
              </p>
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Yes, Remove
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="px-3 py-2 bg-gray-800 text-white/60 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  Cancel
                </button>
              </div>
              {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
            </div>
          )
        )}

      </div>
    </div>
  );
}

type ServiceType = 'n8n' | 'openclaw' | 'website';

const AI_PROVIDER_URL = process.env.NEXT_PUBLIC_AI_PROVIDER_URL || process.env.NEXT_PUBLIC_AI_BASE_URL || 'https://openrouter.ai/api';

const deploymentTypes = [
  {
    id: 'n8n' as ServiceType,
    label: 'n8n',
    description: 'Workflow automation platform',
    iconSrc: '/logos/n8n.svg',
    iconClass: 'w-6 h-6 object-contain',
    iconStyle: { filter: 'brightness(0) invert(1) opacity(0.7)' } as React.CSSProperties,
    available: true,
  },
  {
    id: 'openclaw' as ServiceType,
    label: 'OpenClaw',
    description: 'Deploy safe AI agents in a sandboxed environment.',
    iconSrc: '/logos/openclaw.png',
    iconClass: 'w-6 h-6 object-contain rounded',
    iconStyle: undefined as React.CSSProperties | undefined,
    available: true,
  },
  {
    id: 'website' as ServiceType,
    label: 'Website',
    description: 'Deploy any Docker image with a public URL.',
    iconSrc: null as string | null,
    iconClass: '',
    iconStyle: undefined as React.CSSProperties | undefined,
    available: true,
  },
];

export default function HostingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session } = useAuth();
  const router = useRouter();
  const { instances, instancesLoading, refetchInstances, liveStatus } = useHostingContext();
  const refetchLocal = refetchInstances;

  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [dockerImage, setDockerImage] = useState('');
  const [dockerPort, setDockerPort] = useState('3000');
  const [openingBilling, setOpeningBilling] = useState(false);
  const [locallyDeleted] = useState(false);
  const [showN8nDeleteConfirm, setShowN8nDeleteConfirm] = useState(false);
  const [n8nDeleting, setN8nDeleting] = useState(false);
  const [n8nDeleteError, setN8nDeleteError] = useState<string | null>(null);

  // When fake status block expires, reload to show real hosting status
  // Handles blocks that exist at mount time (e.g., after deploy or page reload during action)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('n8n_action_blocks');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const block = parsed[id];
      if (!block || block.expiry <= Date.now()) return;
      const remaining = block.expiry - Date.now();
      const timer = setTimeout(() => {
        try {
          const s = localStorage.getItem('n8n_action_blocks');
          if (s) {
            const p = JSON.parse(s);
            delete p[id];
            if (Object.keys(p).length > 0) localStorage.setItem('n8n_action_blocks', JSON.stringify(p));
            else localStorage.removeItem('n8n_action_blocks');
          }
        } catch {}
        try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
        window.location.reload();
      }, remaining);
      return () => clearTimeout(timer);
    } catch {}
  }, [id]);

  // Backup reload for blocks set DURING the session (stop/start/restart/model change)
  // N8nAccountPage dispatches 'n8n-action-block-set' when it creates a new action block.
  // This schedules a backup reload in case N8nAccountPage's own setTimeout doesn't fire
  // (e.g., component remount losing the timer reference).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = () => {
      // Clear previous backup timer if any
      if (timer) clearTimeout(timer);

      try {
        const stored = localStorage.getItem('n8n_action_blocks');
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const block = parsed[id];
        if (!block || block.expiry <= Date.now()) return;
        const remaining = block.expiry - Date.now();
        timer = setTimeout(() => {
          try {
            const s = localStorage.getItem('n8n_action_blocks');
            if (s) {
              const p = JSON.parse(s);
              delete p[id];
              if (Object.keys(p).length > 0) localStorage.setItem('n8n_action_blocks', JSON.stringify(p));
              else localStorage.removeItem('n8n_action_blocks');
            }
          } catch {}
          try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
          window.location.reload();
        }, remaining);
      } catch {}
    };

    window.addEventListener('n8n-action-block-set', handler);
    return () => {
      window.removeEventListener('n8n-action-block-set', handler);
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const handleOpenBilling = async () => {
    if (!session?.access_token) return;
    setOpeningBilling(true);
    try {
      const res = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, '_blank');
      }
    } catch { /* silent */ } finally {
      setOpeningBilling(false);
    }
  };

  const handleInstanceDeleted = useCallback(async () => {
    try {
      sessionStorage.removeItem('portal-hosting-instances-v3');
      await Promise.all([refetchInstances(), refetchLocal()]);
    } catch {}
    router.push('/portal/hosting');
  }, [refetchInstances, refetchLocal, router]);

  const handleFlowEngineDeleted = useCallback(async () => {
    try {
      sessionStorage.removeItem('portal-hosting-instances-v3');
      await Promise.all([refetchInstances(), refetchLocal()]);
    } catch {}
    router.push('/portal/hosting');
  }, [refetchInstances, refetchLocal, router]);

  const handleN8nDelete = async () => {
    if (!session?.access_token) return;
    setN8nDeleting(true);
    setN8nDeleteError(null);
    try {
      let res: Response;
      if (instance?.is_external) {
        res = await fetch('/api/hosting/connect', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ instanceId: id }),
        });
      } else {
        res = await fetch(`/api/flowengine/instances/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setN8nDeleteError(data.error || data.message || 'Failed to delete instance');
        setN8nDeleting(false);
        return;
      }
      try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
      await handleFlowEngineDeleted();
    } catch {
      setN8nDeleteError('Delete failed. Please try again.');
      setN8nDeleting(false);
    }
  };

  const instance = instances.find(i => i.id === id);

  // Check if there's an active fake status block (set after deploy click)
  // If so, skip service picker and render N8nAccountPage to show fake "starting" status
  const hasActiveFakeStatus = (() => {
    try {
      const stored = localStorage.getItem('n8n_action_blocks');
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      const block = parsed[id];
      return block && block.expiry > Date.now();
    } catch { return false; }
  })();

  // Show service picker only for non-external instances in a deployable state
  // External instances always go to their manage page, never the service picker
  const isPending = !hasActiveFakeStatus && !instance?.is_external && (instance?.status === 'pending_deploy' || !!instance?.deleted_at || locallyDeleted);

  const handleDeploy = async () => {
    if (!session?.access_token || !selectedService) return;
    setDeploying(true);
    setDeployError(null);
    try {
      const body: Record<string, any> = {
        instanceId: id,
        serviceType: selectedService,
      };

      if (selectedService === 'openclaw') {
        body.primaryModel = 'claude-sonnet-4-6';
        body.channelTokens = {};
      }

      if (selectedService === 'website') {
        if (!dockerImage.trim()) {
          setDeployError('Docker image is required.');
          setDeploying(false);
          return;
        }
        body.dockerImage = dockerImage.trim();
        body.port = parseInt(dockerPort, 10) || 3000;
      }

      const res = await fetch('/api/n8n/deploy-pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeployError(data.error || 'Deployment failed. Please try again.');
        setDeploying(false);
        return;
      }

      // Set up fake "starting" status — same pattern as N8nAccountPage
      const provisionedId = data.instance?.id || id;
      const isOpenClaw = selectedService === 'openclaw';
      const startingDuration = isOpenClaw ? 350000 : 200000;
      const blockData = { expiry: Date.now() + startingDuration, fakeStatus: 'starting', startedAt: Date.now() };
      try {
        const stored = localStorage.getItem('n8n_action_blocks');
        const parsed = stored ? JSON.parse(stored) : {};
        parsed[provisionedId] = blockData;
        localStorage.setItem('n8n_action_blocks', JSON.stringify(parsed));
      } catch {}

      // Clear cache and reload — N8nAccountPage will pick up fake status
      try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
      setTimeout(() => { window.location.reload(); }, 1500);
    } catch {
      setDeployError('Something went wrong. Please try again.');
      setDeploying(false);
    }
  };

  // Loading state
  if (instancesLoading) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }

  // Instance not found after loading completes — avoid falling through to N8nAccountPage
  if (!instance && !locallyDeleted) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center py-20 gap-3">
        <Server className="w-8 h-8 text-white/20" />
        <p className="text-white/40 text-sm">Instance not found</p>
      </div>
    );
  }

  // FlowEngine-managed instance — full management UI
  if (instance?.platform === 'flowengine') {
    return (
      <FlowEngineInstanceDetail
        instance={instance}
        onDeleted={handleFlowEngineDeleted}
        onRenamed={async () => {
          try { sessionStorage.removeItem('portal-hosting-instances-v3'); } catch {}
          await Promise.all([refetchInstances(), refetchLocal()]);
        }}
      />
    );
  }

  // Website / Docker instances get their own detail component
  if (!isPending && instance?.service_type === 'website') {
    return <WebsiteInstanceDetail instance={instance} onDeleted={handleInstanceDeleted} />;
  }

  // External "other" instances, or any externally-connected instance (n8n/openclaw via "Connect")
  // N8nAccountPage only handles portal-hosted instances; external ones would spin forever
  if (!isPending && (instance?.service_type === 'other' || instance?.is_external)) {
    return <ExternalInstanceDetail instance={instance} onDeleted={handleInstanceDeleted} />;
  }

  // Not pending = show N8nAccountPage which handles everything (loading, status, actions) for n8n + openclaw
  if (!isPending) {
    return (
      <div className="flex-1 overflow-y-auto">
        <N8nAccountPage embedded focusInstanceId={id} onInstanceDeleted={handleInstanceDeleted} liveStatus={liveStatus[id]} access={instance?.access} />

        {/* Danger zone — only for owners */}
        {instance?.access === 'owner' && (
          <div className="max-w-2xl mx-auto px-4 pb-6">
            {!showN8nDeleteConfirm ? (
              <button
                onClick={() => setShowN8nDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-red-400/60 hover:text-red-400 rounded-lg text-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {instance?.is_external ? 'Remove from Portal' : 'Delete Instance'}
              </button>
            ) : (
              <div className="bg-gray-900/50 border border-red-800 rounded-lg p-4 space-y-3">
                <p className="text-sm text-red-400">
                  {instance?.is_external
                    ? <>Remove <span className="font-semibold">{instance.instance_name}</span> from the portal? This does not affect the actual service.</>
                    : <>Permanently delete <span className="font-semibold">{instance.instance_name}</span>? This cannot be undone.</>
                  }
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleN8nDelete}
                    disabled={n8nDeleting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {n8nDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {instance?.is_external ? 'Yes, Remove' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setShowN8nDeleteConfirm(false)}
                    disabled={n8nDeleting}
                    className="px-3 py-2 bg-gray-800 text-white/60 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
                {n8nDeleteError && <p className="text-sm text-red-400">{n8nDeleteError}</p>}
              </div>
            )}
          </div>
        )}

        {instance?.stripe_subscription_id && (
          <div className="max-w-4xl mx-auto px-6 pb-6 flex justify-center">
            <button
              onClick={handleOpenBilling}
              disabled={openingBilling}
              className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors disabled:opacity-50"
            >
              {openingBilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              Manage Subscription
            </button>
          </div>
        )}
      </div>
    );
  }

  // Pending deploy — service selection, then deploy
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">
            {instance?.instance_name || 'Instance'}
          </h2>
          <p className="text-white/60 text-base">
            Choose what to deploy on this instance.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {deploymentTypes.map(dt => {
            const storageLimitGb = instance?.storage_limit_gb ?? 0;
            const needsUpgrade = dt.id === 'openclaw' && dt.available && storageLimitGb < 30;
            const isAvailable = dt.available && !needsUpgrade;
            const isSelected = selectedService === dt.id;
            return (
              <button
                key={dt.id}
                disabled={!isAvailable}
                onClick={() => isAvailable && setSelectedService(dt.id as ServiceType)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left',
                  !isAvailable && 'opacity-40 cursor-not-allowed bg-gray-900/50 border-gray-800',
                  isAvailable && !isSelected && 'bg-gray-900/50 border-gray-700 hover:border-gray-600 cursor-pointer',
                  isAvailable && isSelected && 'bg-gray-900/50 border-white ring-1 ring-white/30 cursor-pointer'
                )}
              >
                <div className="w-10 h-10 bg-gray-800/30 rounded-lg flex items-center justify-center shrink-0">
                  {dt.iconSrc
                    ? <img src={dt.iconSrc} className={dt.iconClass} alt={dt.label} style={dt.iconStyle} />
                    : dt.id === 'website'
                      ? <Globe className="w-5 h-5 text-white/60" />
                      : <Server className="w-5 h-5 text-white/30" />
                  }
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{dt.label}</span>
                    {needsUpgrade && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800/30 text-white/60 border border-gray-700">
                        Requires 30GB storage
                      </span>
                    )}
                    {!dt.available && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800/30 text-gray-500 border border-gray-700">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/60 mt-0.5">{dt.description}</p>
                </div>
                {isAvailable && <ChevronRight className="w-4 h-4 text-white/30" />}
              </button>
            );
          })}
        </div>

        {selectedService === 'website' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Docker Image</label>
              <input
                type="text"
                value={dockerImage}
                onChange={e => setDockerImage(e.target.value)}
                placeholder="e.g. nginx:latest, ghcr.io/myorg/myapp:1.0"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Container Port</label>
              <input
                type="number"
                value={dockerPort}
                onChange={e => setDockerPort(e.target.value)}
                placeholder="3000"
                min={1}
                max={65535}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
              />
            </div>
          </div>
        )}

        {deployError && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
            {deployError}
          </div>
        )}

        {selectedService && (
          <button
            onClick={handleDeploy}
            disabled={deploying || (selectedService === 'website' && !dockerImage.trim())}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deploying ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Deploying...</>
            ) : (
              <>Add {deploymentTypes.find(d => d.id === selectedService)?.label}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
