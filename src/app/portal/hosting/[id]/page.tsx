'use client';

/**
 * Hosting Instance Detail Page
 * - For pending_deploy instances: shows service selection + deploy button
 * - For all other instances: renders N8nAccountPage (handles both n8n and OpenClaw)
 */
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { usePortalInstances, PortalInstance } from '@/components/portal/usePortalInstances';
import N8nAccountPage from '@/app/n8n-account/page';
import { useHostingContext } from '../context';
import { Server, Loader2, ChevronRight, ExternalLink, Play, Square, RotateCcw, Trash2, Globe, RefreshCw, Terminal, History, Pencil, Check, X, Link2, Users, Plus, Eye, EyeOff, Copy, Database, HardDrive } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { cn } from '@/lib/utils';

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

// ─── Shared Logs Section ─────────────────────────────────────────────────────

function LogsSection({ instanceId, logsUrl, token }: { instanceId: string; logsUrl: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${logsUrl}?lines=300`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(await res.text());
    } catch {
      setLogs('Failed to fetch logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && logs === null) fetchLogs();
        }}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-white/60" />
          <span className="text-sm font-medium text-white">Logs</span>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <button
              onClick={e => { e.stopPropagation(); fetchLogs(); }}
              className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-800">
          {loading ? (
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
  );
}

// ─── FlowEngine Instance Detail ──────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; spin?: boolean; pulse?: boolean }> = {
  running:      { label: 'Running',      cls: 'text-green-400 bg-green-900/20 border-green-800', pulse: true },
  active:       { label: 'Running',      cls: 'text-green-400 bg-green-900/20 border-green-800', pulse: true },
  stopped:      { label: 'Stopped',      cls: 'text-red-400 bg-red-900/20 border-red-800' },
  error:        { label: 'Error',        cls: 'text-red-400 bg-red-900/20 border-red-800' },
  provisioning: { label: 'Provisioning', cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
  starting:     { label: 'Starting',     cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
  stopping:     { label: 'Stopping',     cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
  restarting:   { label: 'Restarting',   cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800', spin: true },
};

function FlowEngineInstanceDetail({ instance, onDeleted, onRenamed }: { instance: PortalInstance; onDeleted: () => void; onRenamed?: (newName: string) => void }) {
  const { session } = useAuth();

  const [detail, setDetail] = useState<{ status: string; billing_cycle?: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<'start' | 'stop' | 'restart' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [currentName, setCurrentName] = useState(instance.instance_name);

  const [fakeStatus, setFakeStatus] = useState<string | null>(null);

  // Database Credentials state (n8n only)
  const [credsOpen, setCredsOpen] = useState(false);
  const [credsRevealed, setCredsRevealed] = useState(false);
  const [credsLoading, setCredsLoading] = useState(false);
  const [creds, setCreds] = useState<{ user: string; password: string; database: string; host: string; port: number } | null>(null);
  const [credsError, setCredsError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // SQL Terminal state (n8n only)
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [sqlInput, setSqlInput] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string | null>(null);
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);

  // Backups state
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [backups, setBackups] = useState<Array<{ id: string; fileName: string; fileSizeBytes: number; status: string; createdAt: string }> | null>(null);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupsError, setBackupsError] = useState<string | null>(null);

  // Client assignment (owner only)
  type ClientAssignment = { user_id: string; client_email: string; client_name?: string };
  const [clientAssignments, setClientAssignments] = useState<ClientAssignment[]>([]);
  const [allAgencyClients, setAllAgencyClients] = useState<ClientAssignment[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [showAssignClientForm, setShowAssignClientForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [assigningClient, setAssigningClient] = useState(false);
  const [assignClientError, setAssignClientError] = useState<string | null>(null);
  const [revokingClientId, setRevokingClientId] = useState<string | null>(null);

  // Read fake action block from localStorage on mount (can't access during SSR)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('n8n_action_blocks');
      if (!stored) return;
      const block = JSON.parse(stored)[instance.id];
      if (block && block.expiry > Date.now()) setFakeStatus(block.fakeStatus);
    } catch {}
  }, [instance.id]);

  // Expire fake status automatically
  useEffect(() => {
    if (!fakeStatus) return;
    try {
      const stored = localStorage.getItem('n8n_action_blocks');
      if (!stored) { setFakeStatus(null); return; }
      const block = JSON.parse(stored)[instance.id];
      if (!block || block.expiry <= Date.now()) { setFakeStatus(null); return; }
      const timer = setTimeout(() => {
        try {
          const s = localStorage.getItem('n8n_action_blocks');
          if (s) {
            const p = JSON.parse(s);
            delete p[instance.id];
            Object.keys(p).length > 0
              ? localStorage.setItem('n8n_action_blocks', JSON.stringify(p))
              : localStorage.removeItem('n8n_action_blocks');
          }
        } catch {}
        setFakeStatus(null);
      }, block.expiry - Date.now());
      return () => clearTimeout(timer);
    } catch { setFakeStatus(null); }
  }, [fakeStatus, instance.id]);

  // Fetch full detail on mount (billing_cycle, etc.)
  useEffect(() => {
    if (!session?.access_token) return;
    let mounted = true;
    fetch(`/api/flowengine/instances/${instance.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.instance && mounted) setDetail(data.instance);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [session?.access_token, instance.id]);

  // Poll live status every 5s when not transitioning
  useEffect(() => {
    if (!session?.access_token || fakeStatus || actionLoading) return;
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/flowengine/instances/${instance.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.instance?.status) setDetail(prev => prev ? { ...prev, status: data.instance.status } : data.instance);
        }
      } catch {}
    };
    const interval = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, [session?.access_token, instance.id, fakeStatus, actionLoading]);

  // Load client assignments (owner only)
  useEffect(() => {
    if (!session?.access_token || clientsLoaded || instance.access !== 'owner') return;
    const load = async () => {
      try {
        const res = await fetch('/api/client/instances', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const instances: any[] = data.instances || [];
        const seenIds = new Set<string>();
        const all: { user_id: string; client_email: string; client_name?: string }[] = [];
        for (const ci of instances) {
          if (!ci.user_id || ci.user_id.startsWith('pending:')) continue;
          if (seenIds.has(ci.user_id)) continue;
          seenIds.add(ci.user_id);
          all.push({ user_id: ci.user_id, client_email: ci.client_email || ci.user_id, client_name: ci.client_name });
        }
        setAllAgencyClients(all);
        const assigned = instances
          .filter(ci => ci.instance_id === instance.id && !ci.user_id?.startsWith('pending:') && !ci.client_paid)
          .map(ci => ({ user_id: ci.user_id, client_email: ci.client_email || ci.user_id, client_name: ci.client_name }));
        setClientAssignments(assigned);
      } catch { /* silent */ } finally {
        setClientsLoaded(true);
      }
    };
    load();
  }, [session?.access_token, clientsLoaded, instance.id, instance.access]);

  const displayStatus = fakeStatus || detail?.status || instance.status;
  const sc = STATUS_CONFIG[displayStatus] ?? { label: displayStatus, cls: 'text-gray-400 bg-gray-800/30 border-gray-700' };
  const isTransitioning = !!(fakeStatus) || ['provisioning', 'starting', 'stopping', 'restarting'].includes(displayStatus);
  const isRunning = displayStatus === 'running';
  const isStopped = ['stopped', 'error'].includes(displayStatus);
  const isN8n = instance.service_type === 'n8n' || !instance.service_type;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }).catch(() => {});
  };

  const handleRevealCredentials = async () => {
    if (creds) { setCredsRevealed(true); return; }
    if (!session?.access_token) return;
    setCredsLoading(true);
    setCredsError(null);
    try {
      const res = await fetch(`/api/flowengine/instances/${instance.id}/credentials`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) { setCredsError(data.message || data.error || 'Failed to fetch credentials'); return; }
      setCreds(data.credentials);
      setCredsRevealed(true);
    } catch {
      setCredsError('Failed to fetch credentials.');
    } finally {
      setCredsLoading(false);
    }
  };

  const handleRunSQL = async () => {
    if (!session?.access_token || !sqlInput.trim()) return;
    setTerminalLoading(true);
    setTerminalError(null);
    setTerminalOutput(null);
    try {
      const res = await fetch(`/api/flowengine/instances/${instance.id}/terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ command: sqlInput }),
      });
      const data = await res.json();
      if (!res.ok) { setTerminalError(data.message || data.error || 'Command failed'); return; }
      setTerminalOutput(data.output ?? '(no output)');
    } catch {
      setTerminalError('Failed to execute command.');
    } finally {
      setTerminalLoading(false);
    }
  };

  const fetchBackups = async () => {
    if (!session?.access_token) return;
    setBackupsLoading(true);
    setBackupsError(null);
    try {
      const res = await fetch(`/api/flowengine/instances/${instance.id}/backups`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) { setBackupsError(data.message || data.error || 'Failed to list backups'); return; }
      setBackups(data.backups ?? []);
    } catch {
      setBackupsError('Failed to fetch backups.');
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!session?.access_token) return;
    setCreatingBackup(true);
    setBackupsError(null);
    try {
      const res = await fetch(`/api/flowengine/instances/${instance.id}/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) { setBackupsError(data.message || data.error || 'Backup failed'); return; }
      // Refresh list
      await fetchBackups();
    } catch {
      setBackupsError('Failed to create backup.');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleAssignClient = async () => {
    if (!session?.access_token || !selectedClientId) return;
    setAssigningClient(true);
    setAssignClientError(null);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_id: instance.id, client_user_id: selectedClientId }),
      });
      const data = await res.json();
      if (!res.ok) { setAssignClientError(data.error || 'Failed to assign client'); return; }
      const client = allAgencyClients.find(c => c.user_id === selectedClientId);
      if (client) setClientAssignments(prev => [...prev, client]);
      setShowAssignClientForm(false);
      setSelectedClientId('');
    } catch {
      setAssignClientError('Failed to assign client');
    } finally {
      setAssigningClient(false);
    }
  };

  const handleRevokeClient = async (clientUserId: string) => {
    if (!session?.access_token) return;
    setRevokingClientId(clientUserId);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_id: instance.id, user_id: clientUserId }),
      });
      if (res.ok) setClientAssignments(prev => prev.filter(c => c.user_id !== clientUserId));
    } catch { /* silent */ } finally {
      setRevokingClientId(null);
    }
  };

  const setFakeBlock = (action: 'start' | 'stop' | 'restart') => {
    const durations = { start: 50_000, stop: 8_000, restart: 30_000 };
    const fakeStatuses = { start: 'starting', stop: 'stopping', restart: 'restarting' };
    const expiry = Date.now() + durations[action];
    try {
      const stored = localStorage.getItem('n8n_action_blocks');
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[instance.id] = { expiry, fakeStatus: fakeStatuses[action] };
      localStorage.setItem('n8n_action_blocks', JSON.stringify(parsed));
    } catch {}
    setFakeStatus(fakeStatuses[action]);
  };

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
      setFakeBlock(action);
    } catch {
      setActionError('Request failed. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!session?.access_token) return;
    setActionLoading('delete');
    setActionError(null);
    try {
      const res = await fetch(`/api/flowengine/instances/${instance.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.message || 'Failed to delete instance');
        setActionLoading(null);
        return;
      }
      try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
      onDeleted();
    } catch {
      setActionError('Delete failed. Please try again.');
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
        try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
        if (onRenamed) onRenamed(newName);
      }
    } catch {} finally {
      setNameSaving(false);
    }
  };

  const created = instance.created_at ? new Date(instance.created_at).toLocaleDateString() : null;
  const billingCycle = detail?.billing_cycle;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Header card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-gray-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <ServiceIcon serviceType={instance.service_type} />
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
            {billingCycle && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-sm text-white/60 mb-1">Billing</p>
                <p className="text-white font-medium capitalize">{billingCycle}</p>
              </div>
            )}
            {created && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-sm text-white/60 mb-1">Created</p>
                <p className="text-white font-medium">{created}</p>
              </div>
            )}
          </div>
        </div>

        {/* URL */}
        {instance.instance_url && (
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
            <p className="text-sm text-white/60 mb-2">Instance URL</p>
            <a
              href={instance.instance_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/60 font-mono hover:text-white transition-colors break-all"
            >
              {instance.instance_url}
            </a>
          </div>
        )}

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
          </div>
          {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
        </div>

        {/* Logs */}
        <LogsSection instanceId={instance.id} logsUrl={`/api/flowengine/instances/${instance.id}/logs`} token={session?.access_token ?? ''} />

        {/* Database Credentials — n8n only */}
        {isN8n && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => {
                const next = !credsOpen;
                setCredsOpen(next);
              }}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-white/60" />
                <span className="text-sm font-medium text-white">Database Credentials</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${credsOpen ? 'rotate-90' : ''}`} />
            </button>
            {credsOpen && (
              <div className="border-t border-gray-800 p-5 space-y-4">
                {!credsRevealed ? (
                  <button
                    onClick={handleRevealCredentials}
                    disabled={credsLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white/80 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {credsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    Reveal Credentials
                  </button>
                ) : creds ? (
                  <div className="space-y-3">
                    {([
                      { label: 'Host', value: creds.host, field: 'host' },
                      { label: 'Port', value: String(creds.port), field: 'port' },
                      { label: 'Database', value: creds.database, field: 'database' },
                      { label: 'User', value: creds.user, field: 'user' },
                    ] as { label: string; value: string; field: string }[]).map(({ label, value, field }) => (
                      <div key={field} className="flex items-center justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
                        <span className="text-xs text-white/50 w-20 shrink-0">{label}</span>
                        <span className="text-sm text-white font-mono flex-1 truncate">{value}</span>
                        <button
                          onClick={() => copyToClipboard(value, field)}
                          className="p-1 rounded hover:bg-gray-700 text-white/30 hover:text-white/60 transition-colors shrink-0"
                          title="Copy"
                        >
                          {copiedField === field ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
                      <span className="text-xs text-white/50 w-20 shrink-0">Password</span>
                      <span className="text-sm text-white font-mono flex-1 truncate">
                        {showPassword ? creds.password : '••••••••••••'}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setShowPassword(p => !p)}
                          className="p-1 rounded hover:bg-gray-700 text-white/30 hover:text-white/60 transition-colors"
                          title={showPassword ? 'Hide' : 'Show'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(creds.password, 'password')}
                          className="p-1 rounded hover:bg-gray-700 text-white/30 hover:text-white/60 transition-colors"
                          title="Copy"
                        >
                          {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {credsError && <p className="text-sm text-red-400">{credsError}</p>}
              </div>
            )}
          </div>
        )}

        {/* SQL Terminal — n8n only */}
        {isN8n && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setTerminalOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-white/60" />
                <span className="text-sm font-medium text-white">SQL Terminal</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${terminalOpen ? 'rotate-90' : ''}`} />
            </button>
            {terminalOpen && (
              <div className="border-t border-gray-800 p-5 space-y-3">
                <textarea
                  value={sqlInput}
                  onChange={e => setSqlInput(e.target.value)}
                  placeholder="SELECT * FROM workflow_entity LIMIT 10;"
                  rows={4}
                  className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-green-400 font-mono placeholder-white/20 focus:outline-none focus:border-gray-500 resize-y"
                />
                <button
                  onClick={handleRunSQL}
                  disabled={terminalLoading || !sqlInput.trim()}
                  className="flex items-center gap-2 px-3 py-2 bg-green-900/20 text-green-400 border border-green-800 hover:bg-green-900/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {terminalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Run
                </button>
                {terminalError && <p className="text-sm text-red-400">{terminalError}</p>}
                {terminalOutput !== null && (
                  <pre className="p-3 text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto bg-black/30 rounded-lg border border-gray-800">
                    {terminalOutput}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* Backups */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => {
              const next = !backupsOpen;
              setBackupsOpen(next);
              if (next && backups === null) fetchBackups();
            }}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium text-white">Backups</span>
            </div>
            <div className="flex items-center gap-2">
              {backupsOpen && (
                <button
                  onClick={e => { e.stopPropagation(); fetchBackups(); }}
                  className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${backupsOpen ? 'rotate-90' : ''}`} />
            </div>
          </button>
          {backupsOpen && (
            <div className="border-t border-gray-800">
              <div className="p-4 flex items-center justify-between">
                <span className="text-xs text-white/50">{backups ? `${backups.length} backup${backups.length !== 1 ? 's' : ''}` : ''}</span>
                <button
                  onClick={handleCreateBackup}
                  disabled={creatingBackup || backupsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/20 text-blue-400 border border-blue-800 hover:bg-blue-900/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {creatingBackup ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Create Backup
                </button>
              </div>
              {backupsError && <p className="px-4 pb-3 text-sm text-red-400">{backupsError}</p>}
              {backupsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                </div>
              ) : backups !== null && backups.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-white/40">No backups yet.</p>
              ) : backups !== null ? (
                <div className="divide-y divide-gray-800">
                  {backups.map(b => (
                    <div key={b.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-mono truncate">{b.fileName}</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {b.fileSizeBytes > 0 ? `${(b.fileSizeBytes / 1024).toFixed(1)} KB · ` : ''}
                          {new Date(b.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                        b.status === 'completed' ? 'text-green-400 bg-green-900/20 border-green-800' :
                        b.status === 'failed' ? 'text-red-400 bg-red-900/20 border-red-800' :
                        'text-yellow-400 bg-yellow-900/20 border-yellow-800'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Assigned Clients — owner only */}
        {instance.access === 'owner' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Assigned Clients</p>
              {clientsLoaded && !showAssignClientForm && allAgencyClients.filter(c => !clientAssignments.some(a => a.user_id === c.user_id)).length > 0 && (
                <button
                  onClick={() => setShowAssignClientForm(true)}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
                >
                  <Plus className="w-3 h-3" /> Assign
                </button>
              )}
            </div>

            {showAssignClientForm && (
              <div className="space-y-3">
                <SearchableSelect
                  value={selectedClientId}
                  onChange={setSelectedClientId}
                  placeholder="Select a client..."
                  options={[
                    { value: '', label: 'Select a client...' },
                    ...allAgencyClients
                      .filter(c => !clientAssignments.some(a => a.user_id === c.user_id))
                      .map(c => ({ value: c.user_id, label: c.client_name ? `${c.client_name} (${c.client_email})` : c.client_email }))
                  ]}
                />
                {assignClientError && <p className="text-xs text-red-400">{assignClientError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleAssignClient}
                    disabled={!selectedClientId || assigningClient}
                    className="px-3 py-2 bg-white text-black hover:bg-gray-100 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    {assigningClient ? 'Assigning...' : 'Assign'}
                  </button>
                  <button
                    onClick={() => { setShowAssignClientForm(false); setSelectedClientId(''); setAssignClientError(null); }}
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
                      onClick={() => handleRevokeClient(c.user_id)}
                      disabled={revokingClientId === c.user_id}
                      className="p-1.5 rounded-lg hover:bg-red-900/30 text-white/20 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Revoke access"
                    >
                      {revokingClientId === c.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Danger zone */}
        <div className="bg-gray-900/50 border border-red-800 rounded-lg p-5">
          <p className="text-sm font-medium text-white mb-1">Danger Zone</p>
          <p className="text-sm text-white/60 mb-4">Permanently delete this instance. This cannot be undone.</p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/30 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Instance
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-400">
                This will permanently delete <span className="font-semibold">{instance.instance_name}</span> and cancel the subscription. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={actionLoading === 'delete'}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'delete' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Yes, Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={actionLoading === 'delete'}
                  className="px-3 py-2 bg-gray-800 text-white/60 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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

  // Client assignment (owner only)
  type ClientAssignment = { user_id: string; client_email: string; client_name?: string };
  const [clientAssignments, setClientAssignments] = useState<ClientAssignment[]>([]);
  const [allAgencyClients, setAllAgencyClients] = useState<ClientAssignment[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [showAssignClientForm, setShowAssignClientForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [assigningClient, setAssigningClient] = useState(false);
  const [assignClientError, setAssignClientError] = useState<string | null>(null);
  const [revokingClientId, setRevokingClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token || clientsLoaded || instance.access !== 'owner') return;
    const load = async () => {
      try {
        const res = await fetch('/api/client/instances', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const instances: any[] = data.instances || [];
        const seenIds = new Set<string>();
        const all: ClientAssignment[] = [];
        for (const ci of instances) {
          if (!ci.user_id || ci.user_id.startsWith('pending:')) continue;
          if (seenIds.has(ci.user_id)) continue;
          seenIds.add(ci.user_id);
          all.push({ user_id: ci.user_id, client_email: ci.client_email || ci.user_id, client_name: ci.client_name });
        }
        setAllAgencyClients(all);
        const assigned = instances
          .filter(ci => ci.instance_id === instance.id && !ci.user_id?.startsWith('pending:') && !ci.client_paid)
          .map(ci => ({ user_id: ci.user_id, client_email: ci.client_email || ci.user_id, client_name: ci.client_name }));
        setClientAssignments(assigned);
      } catch { /* silent */ } finally {
        setClientsLoaded(true);
      }
    };
    load();
  }, [session?.access_token, clientsLoaded, instance.id, instance.access]);

  const handleAssignClient = async () => {
    if (!session?.access_token || !selectedClientId) return;
    setAssigningClient(true);
    setAssignClientError(null);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_id: instance.id, client_user_id: selectedClientId }),
      });
      const data = await res.json();
      if (!res.ok) { setAssignClientError(data.error || 'Failed to assign client'); return; }
      const client = allAgencyClients.find(c => c.user_id === selectedClientId);
      if (client) setClientAssignments(prev => [...prev, client]);
      setShowAssignClientForm(false);
      setSelectedClientId('');
    } catch {
      setAssignClientError('Failed to assign client');
    } finally {
      setAssigningClient(false);
    }
  };

  const handleRevokeClient = async (clientUserId: string) => {
    if (!session?.access_token) return;
    setRevokingClientId(clientUserId);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_id: instance.id, user_id: clientUserId }),
      });
      if (res.ok) setClientAssignments(prev => prev.filter(c => c.user_id !== clientUserId));
    } catch { /* silent */ } finally {
      setRevokingClientId(null);
    }
  };

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
      try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
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
        try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
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

        {/* Assign to Client — owner only */}
        {instance.access === 'owner' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Assigned Clients</p>
              {clientsLoaded && !showAssignClientForm && allAgencyClients.filter(c => !clientAssignments.some(a => a.user_id === c.user_id)).length > 0 && (
                <button
                  onClick={() => setShowAssignClientForm(true)}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
                >
                  <Plus className="w-3 h-3" /> Assign
                </button>
              )}
            </div>

            {showAssignClientForm && (
              <div className="space-y-3">
                <SearchableSelect
                  value={selectedClientId}
                  onChange={setSelectedClientId}
                  placeholder="Select a client..."
                  options={[
                    { value: '', label: 'Select a client...' },
                    ...allAgencyClients
                      .filter(c => !clientAssignments.some(a => a.user_id === c.user_id))
                      .map(c => ({ value: c.user_id, label: c.client_name ? `${c.client_name} (${c.client_email})` : c.client_email }))
                  ]}
                />
                {assignClientError && <p className="text-xs text-red-400">{assignClientError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleAssignClient}
                    disabled={!selectedClientId || assigningClient}
                    className="px-3 py-2 bg-white text-black hover:bg-gray-100 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    {assigningClient ? 'Assigning...' : 'Assign'}
                  </button>
                  <button
                    onClick={() => { setShowAssignClientForm(false); setSelectedClientId(''); setAssignClientError(null); }}
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
                      onClick={() => handleRevokeClient(c.user_id)}
                      disabled={revokingClientId === c.user_id}
                      className="p-1.5 rounded-lg hover:bg-red-900/30 text-white/20 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Revoke access"
                    >
                      {revokingClientId === c.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Danger zone */}
        {instance.access === 'owner' && (
          <div className="bg-gray-900/50 border border-red-800 rounded-lg p-5">
            <p className="text-sm font-medium text-white mb-1">Danger Zone</p>
            <p className="text-sm text-white/60 mb-4">Permanently delete this instance.</p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/30 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Instance
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-400">
                  This will permanently delete <span className="font-semibold">{instance.instance_name}</span>. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-3 py-2 bg-gray-800 text-white/60 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
                {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function ExternalInstanceDetail({ instance, onDeleted }: { instance: PortalInstance; onDeleted: () => void }) {
  const { session } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [currentName, setCurrentName] = useState(instance.instance_name);

  const created = instance.created_at ? new Date(instance.created_at).toLocaleDateString() : null;

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
        try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
      }
    } catch {} finally {
      setNameSaving(false);
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
      try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
      onDeleted();
    } catch {
      setDeleteError('Delete failed. Please try again.');
      setDeleting(false);
    }
  };

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
              <InlineNameEditor name={currentName} onSave={handleRename} saving={nameSaving} />
              <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border mt-1 text-gray-400 bg-gray-800/30 border-gray-700">
                External
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
            {instance.instance_url && (
              <div className="bg-gray-800/30 rounded-lg p-3 col-span-2 sm:col-span-2">
                <p className="text-sm text-white/60 mb-1">URL</p>
                <p className="text-white font-medium text-sm truncate">{instance.instance_url}</p>
              </div>
            )}
            {created && (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <p className="text-sm text-white/60 mb-1">Added</p>
                <p className="text-white font-medium">{created}</p>
              </div>
            )}
          </div>
        </div>

        {/* Danger zone */}
        {instance.access === 'owner' && (
          <div className="bg-gray-900/50 border border-red-800 rounded-lg p-5">
            <p className="text-sm font-medium text-white mb-1">Danger Zone</p>
            <p className="text-sm text-white/60 mb-4">Remove this external service from your portal.</p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/30 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-400">
                  Remove <span className="font-semibold">{currentName}</span> from your portal? This does not affect the actual service.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Yes, Remove
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-3 py-2 bg-gray-800 text-white/60 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
                {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
              </div>
            )}
          </div>
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
  const { refetchInstances } = useHostingContext();
  const { instances, loading: instancesLoading, refetch: refetchLocal } = usePortalInstances();

  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [dockerImage, setDockerImage] = useState('');
  const [dockerPort, setDockerPort] = useState('3000');
  const [openingBilling, setOpeningBilling] = useState(false);
  const [locallyDeleted, setLocallyDeleted] = useState(false);

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
        try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
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
          try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
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
    setLocallyDeleted(true);
    try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
    await Promise.all([refetchInstances(), refetchLocal()]);
  }, [refetchInstances, refetchLocal]);

  const handleFlowEngineDeleted = useCallback(async () => {
    await Promise.all([refetchInstances(), refetchLocal()]);
    router.push('/portal/hosting');
  }, [refetchInstances, refetchLocal, router]);

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

  // Show service picker for ALL deployable states (first deploy + redeploy after destroy)
  // UNLESS there's an active fake status — then show N8nAccountPage for the "starting" UX
  const isPending = !hasActiveFakeStatus && (instance?.status === 'pending_deploy' || !!instance?.deleted_at || locallyDeleted);

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
      try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
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

  // FlowEngine-managed instance — full management UI
  if (instance?.platform === 'flowengine') {
    return <FlowEngineInstanceDetail instance={instance} onDeleted={handleFlowEngineDeleted} />;
  }

  // Website / Docker instances get their own detail component
  if (!isPending && instance?.service_type === 'website') {
    return <WebsiteInstanceDetail instance={instance} onDeleted={handleInstanceDeleted} />;
  }

  // External "other" instances — simple name editor + optional URL + remove
  if (!isPending && instance?.service_type === 'other') {
    return <ExternalInstanceDetail instance={instance} onDeleted={handleInstanceDeleted} />;
  }

  // Not pending = show N8nAccountPage which handles everything (loading, status, actions) for n8n + openclaw
  if (!isPending) {
    return (
      <div className="flex-1 overflow-y-auto">
        <N8nAccountPage embedded focusInstanceId={id} onInstanceDeleted={handleInstanceDeleted} />
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
              <>Deploy {deploymentTypes.find(d => d.id === selectedService)?.label}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
