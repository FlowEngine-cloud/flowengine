'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useTeamContext } from '@/hooks/useTeamContext';
import { supabase } from '@/lib/supabase';
import { usePortalRoleContext } from '@/app/portal/context';
import SecondaryPanel, { SecondaryPanelSection } from '@/components/portal/SecondaryPanel';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Plus, Code, MessageSquare, X } from 'lucide-react';
import Link from 'next/link';
import AddServiceModal from '@/components/AddServiceModal';
import { ServicesContext } from './context';
import type { ServiceConnection } from './context';

// Module-level cache — survives route navigations within the SPA session
let _connectionsCache: ServiceConnection[] | null = null;
let _liveStatusCache: Record<string, string> | null = null;

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();
  const { ownerId, loading: teamLoading } = useTeamContext();
  const { role, allowFullAccess, loading: roleLoading } = usePortalRoleContext();
  const router = useRouter();
  const pathname = usePathname();

  // Route guard: simplified clients (no full access) cannot access services
  useEffect(() => {
    if (!roleLoading && role === 'client' && !allowFullAccess) {
      router.replace('/portal');
    }
  }, [role, allowFullAccess, roleLoading, router]);

  const [connections, setConnections] = useState<ServiceConnection[]>(_connectionsCache ?? []);
  const [loading, setLoading] = useState(_connectionsCache === null);
  const [liveStatus, setLiveStatus] = useState<Record<string, string>>(_liveStatusCache ?? {});
  const [statusLoading, setStatusLoading] = useState(_liveStatusCache === null);
  const fetchedLiveRef = useRef(_liveStatusCache !== null);

  // Add service modal
  const [showAddModal, setShowAddModal] = useState(false);

  // Client filter
  const [clientsByInstance, setClientsByInstance] = useState<Record<string, string>>({});
  const [clientEmails, setClientEmails] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState('all');

  const segments = pathname?.split('/portal/services/') || [];
  const selectedId = segments[1] || undefined;

  // Find selected connection for header
  const selectedConnection = selectedId ? connections.find((c) => c.id === selectedId) : null;

  const fetchConnections = useCallback(async () => {
    if (!user || !ownerId) return;
    // Use ownerId (resolves to team owner for team members)
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, display_name, phone_number, status, server_url, linked_instance_id')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false });

    const localConnections: ServiceConnection[] = data || [];

    // Merge FlowEngine WhatsApp sessions
    let merged = localConnections;
    if (session?.access_token) {
      try {
        const feRes = await fetch('/api/flowengine/whatsapp', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (feRes.ok) {
          const feData = await feRes.json();
          const existingNames = new Set(localConnections.map(c => c.instance_name));
          const feSessions: ServiceConnection[] = (feData.sessions || [])
            .filter((s: any) => !existingNames.has(s.instance_name))
            .map((s: any) => ({
              id: `fe_${s.instance_name}`,
              instance_name: s.instance_name,
              display_name: s.display_name || null,
              phone_number: s.phone_number || null,
              status: s.status,
              server_url: null,
              linked_instance_id: s.n8n_instance_id || null,
            }));
          merged = [...localConnections, ...feSessions];
        }
      } catch {
        // Ignore FlowEngine errors — show local sessions only
      }
    }

    _connectionsCache = merged;
    setConnections(merged);
    setLoading(false);
  }, [user, ownerId, session]);

  useEffect(() => {
    if (!authLoading && !teamLoading && user) fetchConnections();
  }, [authLoading, teamLoading, user, fetchConnections]);

  // Fetch client→instance mapping for filter
  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/client/instances', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json())
      .then(data => {
        const map: Record<string, string> = {};
        const emails = new Set<string>();
        for (const inst of data.instances || []) {
          if (inst.instance_id && inst.client_email) {
            map[inst.instance_id] = inst.client_email;
            emails.add(inst.client_email);
          }
        }
        setClientsByInstance(map);
        setClientEmails(Array.from(emails).sort());
      })
      .catch(() => {});
  }, [session?.access_token]);

  // Fetch live WhatsApp statuses from Evolution API
  useEffect(() => {
    if (loading || !session?.access_token || fetchedLiveRef.current) return;
    if (connections.length === 0) { setStatusLoading(false); return; }
    fetchedLiveRef.current = true;

    const token = session.access_token;
    Promise.allSettled(
      connections.map(async (conn) => {
        try {
          const res = await fetch(`/api/whatsapp/${conn.instance_name}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return { id: conn.id, status: conn.status };
          const data = await res.json();
          const state = data.liveState?.instance?.state;
          // If API says 'close' but DB says pending/connecting, keep the DB status
          // (Evolution API returns 'close' for instances awaiting QR scan)
          const isPending = conn.status === 'pending_scan' || conn.status === 'connecting' || conn.status === 'pending';
          if (state && !(state === 'close' && isPending)) return { id: conn.id, status: state };
          return { id: conn.id, status: conn.status };
        } catch {
          return { id: conn.id, status: conn.status };
        }
      })
    ).then((results) => {
      const map: Record<string, string> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          map[r.value.id] = r.value.status;
        }
      }
      _liveStatusCache = map;
      setLiveStatus(map);
      setStatusLoading(false);
    });
  }, [loading, connections, session?.access_token]);

  if (role === 'client' && !allowFullAccess) return null;

  const handleSelect = (id: string) => {
    router.push(`/portal/services/${id}`);
  };

  const mapWhatsAppStatus = (id: string, dbStatus: string) => {
    if (statusLoading) return 'loading' as const;
    const live = liveStatus[id];
    const s = live || dbStatus;
    const dbIsPending = dbStatus === 'connecting' || dbStatus === 'pending' || dbStatus === 'pending_scan';
    if (s === 'open' || s === 'connected') return 'active' as const;
    if (s === 'connecting' || s === 'pending' || s === 'pending_scan') return 'warning' as const;
    if (dbIsPending) return 'warning' as const;
    if (s === 'close' || s === 'error' || s === 'disconnected') return 'error' as const;
    return 'inactive' as const;
  };

  const sections: SecondaryPanelSection[] = [];
  if (connections.length > 0) {
    const filtered = clientFilter === 'all'
      ? connections
      : connections.filter(c => c.linked_instance_id && clientsByInstance[c.linked_instance_id] === clientFilter);
    const sorted = [...filtered].sort((a, b) =>
      (a.display_name || a.instance_name).localeCompare(b.display_name || b.instance_name)
    );
    if (sorted.length > 0) {
      sections.push({
        title: 'WhatsApp',
        onTitleClick: () => router.push('/portal/services'),
        items: sorted.map((c) => ({
          id: c.id,
          label: c.display_name || c.instance_name,
          sublabel: c.phone_number || 'No number',
          status: mapWhatsAppStatus(c.id, c.status),
        })),
      });
    }
  }

  const showSkeleton = loading && connections.length === 0;

  // Header content
  const headerTitle = selectedConnection
    ? (selectedConnection.display_name || selectedConnection.instance_name)
    : pathname === '/portal/services/api-builder'
      ? 'API Builder'
      : 'Services';

  const headerSublabel = selectedConnection?.phone_number || null;

  // Show WhatsApp-specific buttons on the services list and individual WhatsApp pages
  const isWhatsAppPage = pathname === '/portal/services' || pathname === '/portal/services/api-builder' || !!selectedId;

  return (
    <ServicesContext.Provider value={{ connections, loading, liveStatus, statusLoading, refetch: fetchConnections }}>
    <>
      <div className="hidden md:flex">
        {showSkeleton ? (
          <div className="w-[280px] flex-shrink-0 h-full bg-black border-r border-gray-800 flex flex-col">
            <div className="h-[64px] border-b border-gray-800 px-3 flex items-center">
              <div className="h-9 w-full bg-gray-800/30 rounded-lg animate-pulse" />
            </div>
            <div className="px-2 space-y-1 pt-2">
              <div className="px-3 py-2">
                <div className="h-3 w-16 bg-gray-800/30 rounded animate-pulse" />
              </div>
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-28 bg-gray-800/30 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-gray-800/30 rounded animate-pulse" />
                  </div>
                  <div className="w-2 h-2 bg-gray-800/30 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SecondaryPanel
            sections={sections}
            selectedId={selectedId}
            onSelect={handleSelect}
            searchPlaceholder="Search connections..."
            action={
              <div className="space-y-2">
                <SearchableSelect
                  value={clientFilter}
                  onChange={setClientFilter}
                  options={[{ value: 'all', label: 'All Clients' }, ...clientEmails.map(e => ({ value: e, label: e }))]}
                />
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            }
          />
        )}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header bar — breadcrumb */}
        <div className="flex-shrink-0 border-b border-gray-800 px-6 h-[64px] flex items-center gap-3 min-w-0">
          {selectedConnection && (
            <button
              onClick={() => router.push('/portal/services')}
              className="text-sm text-white/40 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              Services
            </button>
          )}
          {selectedConnection && (
            <span className="text-white/20 shrink-0">/</span>
          )}
          <h1 className="text-lg font-semibold text-white truncate">{headerTitle}</h1>
        </div>
        {/* Sub-header — API Builder */}
        {isWhatsAppPage && (
          <div className="flex-shrink-0 border-b border-gray-800 px-6 py-3 flex items-center gap-2">
            <Link
              href="/portal/services/api-builder"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
            >
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">API Builder</span>
            </Link>
          </div>
        )}

        {/* Content */}
        {showSkeleton ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6 space-y-4">
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
                <div className="h-5 w-32 bg-gray-800/30 rounded animate-pulse" />
                <div className="h-24 bg-gray-800/30 rounded-lg animate-pulse" />
                <div className="h-10 w-40 bg-gray-800/30 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
      <AddServiceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        accessToken={session?.access_token}
        onSuccess={() => {
          _connectionsCache = null;
          fetchConnections();
        }}
      />
    </>
    </ServicesContext.Provider>
  );
}
