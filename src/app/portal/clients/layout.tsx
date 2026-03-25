'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useTeamContext } from '@/hooks/useTeamContext';
import { supabase } from '@/lib/supabase';
import { usePortalRoleContext } from '@/app/portal/context';
import SecondaryPanel, { SecondaryPanelSection } from '@/components/portal/SecondaryPanel';
import { Plus, Search, Users, UsersRound, X, LayoutList, Coins, Wallet, LayoutDashboard, ArrowLeft } from 'lucide-react';
import InviteClientModal, { InviteConfig } from '@/components/client/InviteClientModal';
import { cn } from '@/lib/utils';
import { ClientsContext } from './context';
import type { ClientInstance, GroupedClient } from './context';

function groupByClient(instances: ClientInstance[]): GroupedClient[] {
  const map = new Map<string, ClientInstance[]>();
  for (const inst of instances) {
    // For pending invites (user_id starts with "pending:"), group by email so
    // they merge with any existing records for the same email and produce a
    // stable userId that survives invite acceptance.
    const isPending = inst.user_id?.startsWith('pending:');
    const isNameOnly = inst.user_id?.startsWith('ni_');
    const key = isPending
      ? (inst.client_email || inst.user_id)
      : isNameOnly
        ? inst.user_id  // stable key — no email to group by
        : (inst.user_id || inst.client_email);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(inst);
  }

  return Array.from(map.entries()).map(([key, insts]) => {
    // Client status is based on invite status, not instance health
    const hasAccepted = insts.some(i => i.invite_status === 'accepted');
    const hasPending = insts.some(i => i.invite_status === 'pending');

    const bestStatus = hasAccepted
      ? 'active' as const
      : hasPending
        ? 'pending' as const
        : 'inactive' as const;

    // Prefer the real user_id (UUID) over pending/email/nameonly keys
    const realUser = insts.find(i => i.user_id && !i.user_id.startsWith('pending:') && !i.user_id.startsWith('ni_'));
    const userId = realUser?.user_id || key;

    // Determine display name: use client_name if present, else email (skip placeholder emails)
    const clientName = insts[0].client_name;
    const clientEmail = insts[0].client_email;
    const isPlaceholder = clientEmail?.startsWith('noemail-') && clientEmail?.endsWith('@portal.local');
    const displayName = clientName || (!isPlaceholder ? clientEmail : null) || 'Unknown client';

    return {
      userId,
      email: displayName,
      name: clientName || undefined,
      instances: insts,
      bestStatus,
    };
  });
}

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const { ownerId, loading: teamLoading } = useTeamContext();
  const { role, loading: roleLoading } = usePortalRoleContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rawInstances, setRawInstances] = useState<ClientInstance[]>([]);
  const [agencyInstances, setAgencyInstances] = useState<{ id: string; name: string; storage_limit_gb: number }[]>([]);
  const [agencyServices, setAgencyServices] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Live hosting status (instanceId → deployment status)
  const [liveStatus, setLiveStatus] = useState<Record<string, string>>({});
  const [statusLoading, setStatusLoading] = useState(true);

  // Client search dropdown state
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  const segments = pathname?.split('/portal/clients/') || [];
  const selectedId = segments[1]?.split('/')[0] || undefined;

  const fetchClients = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/client/instances', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRawInstances(data.instances || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  const fetchAgencyInstances = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/user/instances', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const instances = (data.instances || [])
          .filter((i: { status: string }) => i.status === 'active' || i.status === 'running')
          .map((i: { id: string; instance_name: string; storage_limit_gb?: number }) => ({
            id: i.id,
            name: i.instance_name || 'Instance',
            storage_limit_gb: i.storage_limit_gb || 0,
          }));
        setAgencyInstances(instances);
      }
    } catch {
      // silently fail
    }
  }, [session?.access_token]);

  const fetchAgencyServices = useCallback(async () => {
    if (!ownerId) return;
    try {
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('id, display_name, instance_name, phone_number, status')
        .eq('user_id', ownerId)
        .is('deleted_at', null)
        .in('status', ['connected', 'pending_scan', 'connecting']);

      if (data) {
        setAgencyServices(data.map(s => ({
          id: s.id,
          name: s.display_name || s.instance_name,
          phone: s.phone_number,
        })));
      }
    } catch {
      // silently fail
    }
  }, [ownerId]);

  useEffect(() => {
    if (!authLoading && !teamLoading && session) {
      fetchClients();
      fetchAgencyInstances();
      fetchAgencyServices();
    }
  }, [authLoading, teamLoading, session, fetchClients, fetchAgencyInstances, fetchAgencyServices]);

  // Poll live hosting status for all real instances — runs immediately then every 30 s
  useEffect(() => {
    if (loading || rawInstances.length === 0 || !session?.access_token) return;

    const token = session.access_token;
    const realInsts = rawInstances.filter(i =>
      !i.instance_id.startsWith('invite:') && !i.is_external && i.service_type !== 'other'
    );

    if (realInsts.length === 0) {
      setStatusLoading(false);
      return;
    }

    const doFetch = () => {
      Promise.allSettled(
        realInsts.map(async (inst) => {
          const isOpenClaw = inst.service_type === 'openclaw';
          const isDocker = inst.service_type === 'website';
          const url = isOpenClaw
            ? `/api/openclaw/${inst.instance_id}/status`
            : isDocker
              ? `/api/docker/status?instanceId=${inst.instance_id}`
              : `/api/n8n/status?instanceId=${inst.instance_id}`;
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) return { id: inst.instance_id, status: inst.status };
          const data = await res.json();
          const status = (isOpenClaw || isDocker)
            ? (data.containerStatus || data.instance?.status || inst.status)
            : (data.status || inst.status);
          return { id: inst.instance_id, status };
        })
      ).then((results) => {
        const map: Record<string, string> = {};
        for (const r of results) {
          if (r.status === 'fulfilled') map[r.value.id] = r.value.status;
        }
        setLiveStatus(prev => ({ ...prev, ...map }));
        setStatusLoading(false);
      });
    };

    doFetch();
    const intervalId = setInterval(doFetch, 30_000);
    return () => clearInterval(intervalId);
  }, [loading, rawInstances, session?.access_token]);

  // Route guard: clients cannot access client management
  useEffect(() => {
    if (!roleLoading && role === 'client') {
      router.replace('/portal');
    }
  }, [role, roleLoading, router]);

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
        setClientSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (role === 'client') return null;

  const handleSelect = (id: string) => {
    if (id.startsWith('tab:')) {
      const raw = id.replace('tab:', '');
      const [tabId, anchor] = raw.split('#');
      if (anchor) {
        // Scroll to anchor within current tab
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const url = pathname + (tabId !== 'overview' ? `?tab=${tabId}` : '');
      router.replace(url);
      return;
    }
    router.push(`/portal/clients/${id}`);
  };

  const handleInvite = async (config: InviteConfig): Promise<string | null> => {
    if (!session?.access_token) return 'Not signed in';
    setSending(true);
    try {
      const res = await fetch('/api/agency/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: config.name,
          email: config.email,
          existingInstanceIds: config.existingInstanceIds,
          linkedServiceIds: config.linkedServiceIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || 'Failed to create client';
      return null;
    } catch {
      return 'Something went wrong. Please try again.';
    } finally {
      setSending(false);
    }
  };

  const grouped = groupByClient(rawInstances);
  const selectedClient = selectedId ? grouped.find((g) => g.userId === selectedId) : null;
  const showSkeleton = loading && rawInstances.length === 0;

  // Detect view type
  const pathParts = segments[1]?.split('/') || [];
  const isInstanceView = pathParts.length >= 2;
  const isClientDetailView = selectedId !== undefined && !isInstanceView;
  const activeInstanceId = isInstanceView ? pathParts[1] : null;

  // Instance view - redirect to main portal
  if (isInstanceView) {
    if (activeInstanceId) {
      router.replace(`/portal?instance=${activeInstanceId}`);
    }
    return null;
  }

  const activeClientTab = searchParams?.get('tab') || 'overview';

  // Build sidebar sections
  const sections: SecondaryPanelSection[] = [];

  // When a client is selected, show tabs with icons + properties sub-items
  if (isClientDetailView && selectedClient) {
    // Main tabs
    sections.push({
      title: '',
      items: [
        { id: 'tab:overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
        { id: 'tab:properties', label: 'Properties', icon: <LayoutList className="w-4 h-4" /> },
        ...(activeClientTab === 'properties' ? [
          { id: 'tab:properties#hosting', label: 'Instances', sublabel: '' },
          { id: 'tab:properties#services', label: 'Services', sublabel: '' },
          { id: 'tab:properties#external', label: 'External', sublabel: '' },
        ] : []),
        { id: 'tab:ai_tokens', label: 'AI Tokens', icon: <Coins className="w-4 h-4" /> },
        { id: 'tab:team', label: 'Team Members', icon: <UsersRound className="w-4 h-4" /> },
        { id: 'tab:payments', label: 'Payments', icon: <Wallet className="w-4 h-4" /> },
        ...(activeClientTab === 'payments' ? [
          { id: 'tab:payments#billing', label: 'Billing', sublabel: '' },
          { id: 'tab:payments#transactions', label: 'Transactions', sublabel: '' },
          { id: 'tab:payments#manual', label: 'Manual Payments', sublabel: '' },
          { id: 'tab:payments#settings', label: 'Settings', sublabel: '' },
          { id: 'tab:payments#platform', label: 'Platform Costs', sublabel: '' },
        ] : []),
      ],
    });
  } else {
    // Main clients list view - show client list in sidebar
    if (grouped.length > 0) {
      const filtered = statusFilter === 'all'
        ? grouped
        : grouped.filter(c => c.bestStatus === statusFilter);
      const sorted = [...filtered].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
      if (sorted.length > 0) {
        sections.push({
          title: '',
          items: sorted.map((client) => {
            const realInsts = client.instances.filter(i => !i.instance_id.startsWith('invite:'));
            const instanceNames = realInsts.map((i) => i.instance_name).filter(Boolean);
            const instanceSublabel = instanceNames.length === 0
              ? 'No instances'
              : instanceNames.length <= 2
                ? instanceNames.join(', ')
                : `${instanceNames.slice(0, 2).join(', ')} +${instanceNames.length - 2} more`;

            return {
              id: client.userId,
              label: client.name || client.email,
              sublabel: client.name ? client.email : instanceSublabel,
            };
          }),
        });
      }
    }
  }

  // Header content
  const headerTitle = selectedClient ? (selectedClient.name || selectedClient.email) : 'Clients';
  const headerSublabel = selectedClient
    ? (() => {
        const realCount = selectedClient.instances.filter(i => !i.instance_id.startsWith('invite:')).length;
        return realCount === 0 ? 'No instances' : `${realCount} instance${realCount !== 1 ? 's' : ''}`;
      })()
    : null;

  // Client search dropdown - filters clients and navigates
  const filteredClients = clientSearch.trim()
    ? grouped.filter(c => {
        const q = clientSearch.toLowerCase();
        return c.email.toLowerCase().includes(q) ||
          (c.name || '').toLowerCase().includes(q) ||
          c.instances.some(i => i.instance_name.toLowerCase().includes(q));
      })
    : grouped;

  const ClientSearchDropdown = (
    <div ref={clientDropdownRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
        <input
          type="text"
          value={clientSearch}
          onChange={(e) => {
            setClientSearch(e.target.value);
            setClientDropdownOpen(true);
          }}
          onFocus={() => setClientDropdownOpen(true)}
          placeholder="Search clients..."
          className="w-full pl-9 pr-7 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-base text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none"
        />
        {clientSearch && (
          <button
            onClick={() => { setClientSearch(''); setClientDropdownOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {clientDropdownOpen && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredClients.length === 0 ? (
              <p className="px-3 py-3 text-sm text-white/40">No clients found</p>
            ) : (
              filteredClients.map(c => (
                <button
                  key={c.userId}
                  onClick={() => {
                    router.push(`/portal/clients/${c.userId}`);
                    setClientSearch('');
                    setClientDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-800/30 transition-colors cursor-pointer",
                    selectedId === c.userId && "bg-gray-800/30"
                  )}
                >
                  <Users className="w-4 h-4 text-white/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{c.name || c.email}</div>
                    {c.name && <div className="text-xs text-white/40 truncate">{c.email}</div>}
                    <div className="text-xs text-white/40 truncate">
                      {c.instances.length} instance{c.instances.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ClientsContext.Provider value={{
      rawInstances,
      grouped,
      loading,
      refetch: fetchClients,
      openInvite: () => setInviteOpen(true),
      statusFilter,
      setStatusFilter,
      agencyInstances: agencyInstances.map(i => ({ id: i.id, name: i.name })),
      agencyServices,
      liveStatus,
      statusLoading,
    }}>
    <>
      {/* Secondary panel */}
      <div className="hidden md:flex">
        {showSkeleton ? (
          <div className="w-[280px] flex-shrink-0 h-full bg-black border-r border-gray-800 flex flex-col">
            <div className="h-[64px] border-b border-gray-800 px-3 flex items-center">
              <div className="h-9 w-full bg-gray-800/30 rounded-lg animate-pulse" />
            </div>
            <div className="px-2 space-y-1 pt-2">
              <div className="px-3 py-2">
                <div className="h-3 w-12 bg-gray-800/30 rounded animate-pulse" />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-32 bg-gray-800/30 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-gray-800/30 rounded animate-pulse" />
                  </div>
                  <div className="w-2 h-2 bg-gray-800/30 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SecondaryPanel
            sections={sections}
            selectedId={isClientDetailView ? `tab:${activeClientTab}` : selectedId}
            onSelect={handleSelect}
            action={isClientDetailView && selectedClient ? (
              <div className="space-y-1">
                <button
                  onClick={() => router.push('/portal/clients')}
                  className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  All Clients
                </button>
                <p className="text-sm font-medium text-white truncate">{selectedClient.name || selectedClient.email}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ClientSearchDropdown}
                <button
                  onClick={() => setInviteOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-white text-black hover:bg-gray-100 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Client
                </button>
              </div>
            )}
          />
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header bar - breadcrumb */}
        <div className="flex-shrink-0 border-b border-gray-800 px-6 h-[64px] flex items-center gap-3 min-w-0">
          {isClientDetailView && (
            <>
              <button
                onClick={() => router.push('/portal/clients')}
                className="text-sm text-white/40 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                Clients
              </button>
              <span className="text-white/20 shrink-0">/</span>
            </>
          )}
          <h1 className="text-lg font-semibold text-white truncate">{headerTitle}</h1>
        </div>

        {/* Content */}
        {showSkeleton && !isClientDetailView ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6 space-y-4">
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-800/30 rounded-full animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-36 bg-gray-800/30 rounded animate-pulse" />
                        <div className="h-3 w-24 bg-gray-800/30 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </div>

      <InviteClientModal
        isOpen={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          fetchClients();
        }}
        onInvite={handleInvite}
        isSending={sending}
        agencyInstances={agencyInstances}
        agencyServices={agencyServices}
      />
    </>
    </ClientsContext.Provider>
  );
}
