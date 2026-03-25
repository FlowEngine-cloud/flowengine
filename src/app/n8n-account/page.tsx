'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import { ExternalLink, Loader2, Server, Pencil, Check, X, Plus, Users, Eye, EyeOff } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface N8nAccountPageProps {
  embedded?: boolean;
  focusInstanceId?: string;
  onInstanceDeleted?: () => void;
  /** Live status from hosting layout polling (overrides stale DB status) */
  liveStatus?: string;
  /** 'owner' | 'client' | 'agency' — controls edit/assign UI visibility */
  access?: string;
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

type ClientAssignment = { user_id: string; client_email: string; client_name?: string };

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  running:      { label: 'Running',      cls: 'text-green-400 bg-green-900/20 border-green-800' },
  active:       { label: 'Running',      cls: 'text-green-400 bg-green-900/20 border-green-800' },
  stopped:      { label: 'Stopped',      cls: 'text-red-400 bg-red-900/20 border-red-800' },
  error:        { label: 'Error',        cls: 'text-red-400 bg-red-900/20 border-red-800' },
  deploying:    { label: 'Deploying',    cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
  provisioning: { label: 'Provisioning', cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
  starting:     { label: 'Starting',     cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
};

export default function N8nAccountPage({ focusInstanceId, liveStatus: liveStatusProp, access }: N8nAccountPageProps) {
  const { session } = useAuth();
  const [instance, setInstance] = useState<InstanceData | null>(null);
  const [loading, setLoading] = useState(!!focusInstanceId);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // API key editing
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaving, setApiKeySaving] = useState(false);

  // Client assignment (owner only)
  const [clientAssignments, setClientAssignments] = useState<ClientAssignment[]>([]);
  const [allAgencyClients, setAllAgencyClients] = useState<ClientAssignment[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [showAssignClientForm, setShowAssignClientForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [assigningClient, setAssigningClient] = useState(false);
  const [assignClientError, setAssignClientError] = useState<string | null>(null);
  const [revokingClientId, setRevokingClientId] = useState<string | null>(null);

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

  // Load client assignments (owner only)
  const loadClients = useCallback(async () => {
    if (!session?.access_token || !focusInstanceId) return;
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
        .filter(ci => ci.instance_id === focusInstanceId && !ci.user_id?.startsWith('pending:') && !ci.client_paid)
        .map(ci => ({ user_id: ci.user_id, client_email: ci.client_email || ci.user_id, client_name: ci.client_name }));
      setClientAssignments(assigned);
    } catch { /* silent */ } finally {
      setClientsLoaded(true);
    }
  }, [session?.access_token, focusInstanceId]);

  useEffect(() => {
    if (access === 'owner') loadClients();
  }, [access, loadClients]);

  const handleSaveName = async () => {
    if (!session?.access_token || !nameInput.trim() || !instance) return;
    setNameSaving(true);
    try {
      const res = await fetch('/api/hosting/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instanceId: instance.id, newName: nameInput.trim() }),
      });
      if (res.ok) {
        setInstance({ ...instance, instance_name: nameInput.trim() });
        setEditingName(false);
      }
    } catch { /* silent */ } finally {
      setNameSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim() || !instance) return;
    setApiKeySaving(true);
    try {
      const { error } = await supabase
        .from('pay_per_instance_deployments')
        .update({ n8n_api_key: apiKeyInput.trim() })
        .eq('id', instance.id);
      if (!error) {
        setInstance({ ...instance, n8n_api_key: apiKeyInput.trim() });
        setEditingApiKey(false);
        setApiKeyInput('');
        setShowApiKey(false);
      }
    } catch { /* silent */ } finally {
      setApiKeySaving(false);
    }
  };

  const handleAssignClient = async () => {
    if (!session?.access_token || !selectedClientId || !focusInstanceId) return;
    setAssigningClient(true);
    setAssignClientError(null);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_id: focusInstanceId, client_user_id: selectedClientId }),
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
    if (!session?.access_token || !focusInstanceId) return;
    setRevokingClientId(clientUserId);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_id: focusInstanceId, user_id: clientUserId }),
      });
      if (res.ok) setClientAssignments(prev => prev.filter(c => c.user_id !== clientUserId));
    } catch { /* silent */ } finally {
      setRevokingClientId(null);
    }
  };

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
  const isOwner = access === 'owner';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

      {/* Header card */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-gray-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <img src={iconSrc} className="w-5 h-5 object-contain" alt="" style={iconStyle} />
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm font-semibold focus:outline-none focus:border-white"
                  maxLength={50}
                />
                <button onClick={handleSaveName} disabled={nameSaving} className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50">
                  {nameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditingName(false)} className="p-1 text-white/40 hover:text-white/70">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <p className="text-white font-semibold truncate">{instance.instance_name}</p>
                {isOwner && (
                  <button
                    onClick={() => { setNameInput(instance.instance_name); setEditingName(true); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-white/70 transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
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
          {/* API Key cell */}
          {(instance.n8n_api_key || isOwner) && (
            <div className="bg-gray-800/30 rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">API Key</p>
              {editingApiKey ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    autoFocus
                    type="text"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveApiKey(); if (e.key === 'Escape') { setEditingApiKey(false); setApiKeyInput(''); } }}
                    placeholder="Paste new key…"
                    className="flex-1 min-w-0 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs font-mono focus:outline-none focus:border-white"
                  />
                  <button onClick={handleSaveApiKey} disabled={apiKeySaving || !apiKeyInput.trim()} className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50">
                    {apiKeySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => { setEditingApiKey(false); setApiKeyInput(''); }} className="p-1 text-white/40 hover:text-white/70">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group">
                  <p className="text-white font-medium text-xs font-mono flex-1 truncate">
                    {instance.n8n_api_key
                      ? (showApiKey ? instance.n8n_api_key : '••••••••')
                      : <span className="text-white/30">Not set</span>
                    }
                  </p>
                  {instance.n8n_api_key && (
                    <button onClick={() => setShowApiKey(v => !v)} className="opacity-0 group-hover:opacity-100 p-0.5 text-white/30 hover:text-white/70 transition-all">
                      {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => { setEditingApiKey(true); setApiKeyInput(''); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-white/30 hover:text-white/70 transition-all"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assigned Clients — owner only */}
      {isOwner && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3">
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
            <div className="space-y-2">
              <SearchableSelect
                value={selectedClientId}
                onChange={setSelectedClientId}
                placeholder="Select a client..."
                options={[
                  { value: '', label: 'Select a client...' },
                  ...allAgencyClients
                    .filter(c => !clientAssignments.some(a => a.user_id === c.user_id))
                    .map(c => ({ value: c.user_id, label: c.client_name ? `${c.client_name} (${c.client_email})` : c.client_email })),
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
