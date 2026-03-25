'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { usePortalRoleContext } from '@/app/portal/context';
import { usePortalInstances } from '@/components/portal/usePortalInstances';
import SecondaryPanel, { SecondaryPanelSection } from '@/components/portal/SecondaryPanel';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Plus, ExternalLink, Server, Globe, Link2 } from 'lucide-react';
import DeployInstanceModal, { InstanceConfig, ConnectInstanceConfig } from '@/components/DeployInstanceModal';
import { HostingContext } from './context';

export default function HostingLayout({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { role, allowFullAccess, loading: roleLoading } = usePortalRoleContext();
  const { instances, loading, refetch: refetchInstances } = usePortalInstances();
  const router = useRouter();
  const pathname = usePathname();


  const [deployOpen, setDeployOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [flowEngineConnected, setFlowEngineConnected] = useState(false);

  // Check if FlowEngine API key is configured
  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/flowengine/pricing', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.connected) setFlowEngineConnected(true);
      })
      .catch(() => {});
  }, [session?.access_token]);

  // Client filter
  const [clientsByInstance, setClientsByInstance] = useState<Record<string, string>>({});
  const [clientEmails, setClientEmails] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState('all');

  // Real-time status map (instanceId -> live status)
  const [liveStatus, setLiveStatus] = useState<Record<string, string>>({});
  const [statusLoading, setStatusLoading] = useState(true);

  // Fetch client→instance mapping for filter dropdown
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

  // Poll live statuses — runs immediately then every 30 s
  useEffect(() => {
    if (loading || instances.length === 0 || !session?.access_token) return;

    const token = session.access_token;
    // Skip FlowEngine instances (they poll their own status) and 'other' type (no status endpoint)
    const activeInstances = instances.filter((i) => !i.is_external && !i.deleted_at && i.status !== 'pending_deploy' && i.service_type && i.platform !== 'flowengine' && i.service_type !== 'other');

    if (activeInstances.length === 0) {
      setStatusLoading(false);
      return;
    }

    const doFetch = () => {
      Promise.allSettled(
        activeInstances.map(async (inst) => {
          const isOpenClaw = inst.service_type === 'openclaw';
          const isDocker = inst.service_type === 'website';
          const url = isOpenClaw
            ? `/api/openclaw/${inst.id}/status`
            : isDocker
              ? `/api/docker/status?instanceId=${inst.id}`
              : `/api/n8n/status?instanceId=${inst.id}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return { id: inst.id, status: inst.status };
          const data = await res.json();
          const status = (isOpenClaw || isDocker)
            ? (data.containerStatus || data.instance?.status || inst.status)
            : (data.status || inst.status);
          return { id: inst.id, status };
        })
      ).then((results) => {
        const map: Record<string, string> = {};
        for (const r of results) {
          if (r.status === 'fulfilled') {
            map[r.value.id] = r.value.status;
          }
        }
        setLiveStatus(prev => ({ ...prev, ...map }));
        setStatusLoading(false);
      });
    };

    doFetch();
    const intervalId = setInterval(doFetch, 30_000);
    return () => clearInterval(intervalId);
  }, [loading, instances, session?.access_token]);

  const isClient = role === 'client';
  const isSimplifiedClient = isClient && !allowFullAccess;

  // Route guard: simplified clients cannot access hosting
  useEffect(() => {
    if (!roleLoading && isSimplifiedClient) {
      router.replace('/portal');
    }
  }, [roleLoading, isSimplifiedClient, router]);

  if (isSimplifiedClient) return null;

  // Determine selected item from pathname
  const afterHosting = pathname?.split('/portal/hosting/')[1] || '';
  const selectedId = afterHosting || undefined;

  // Find selected instance for header
  const selectedInstance = afterHosting ? instances.find((i) => i.id === afterHosting) : null;

  const handleSelect = (id: string) => {
    router.push(`/portal/hosting/${id}`);
  };

  const handleDeploy = async (config: InstanceConfig) => {
    if (!session?.access_token) return;
    setDeploying(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          planType: 'pay_per_instance',
          billingCycle: config.billingCycle,
          instanceName: config.name,
          storageLimit: config.storageSize,
          cancelUrl: '/portal/hosting',
        }),
      });
      if (!res.ok) throw new Error('Checkout failed');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch {
      // handled by modal
    } finally {
      setDeploying(false);
    }
  };

  const handleConnectInstance = async (config: ConnectInstanceConfig) => {
    if (!session?.access_token) return;
    setDeploying(true);
    try {
      const res = await fetch('/api/hosting/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          instanceName: config.name,
          instanceUrl: config.instanceUrl,
          apiKey: config.apiKey,
          serviceType: config.serviceType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDeployOpen(false);
        try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
        await refetchInstances();
        if (data.instance?.id) {
          router.push(`/portal/hosting/${data.instance.id}`);
        }
      } else {
        alert(data.error || 'Failed to connect instance');
      }
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setDeploying(false);
    }
  };

  const mapStatus = (inst: { id: string; status: string; is_external?: boolean; deleted_at?: string | null; platform?: string; service_type?: string | null }): 'active' | 'inactive' | 'error' | 'connecting' | 'external' | 'loading' => {
    // Deleted or pending instances → show as inactive
    if (inst.deleted_at || inst.status === 'pending_deploy') return 'inactive';
    // 'other' type = external link, show as external
    if (inst.service_type === 'other') return 'external';
    // FlowEngine instances use their actual status, not the generic 'external' marker
    if (inst.is_external && inst.platform !== 'flowengine') return 'external';
    // Check for active fake status (action block) - matches N8nAccountPage behavior
    try {
      const stored = localStorage.getItem('n8n_action_blocks');
      if (stored) {
        const parsed = JSON.parse(stored);
        const block = parsed[inst.id];
        if (block && block.expiry > Date.now()) return 'connecting';
      }
    } catch {}
    // Show spinner while live statuses are being fetched
    if (statusLoading && !liveStatus[inst.id]) return 'loading';
    const s = liveStatus[inst.id] || inst.status;
    if (s === 'running' || s === 'active') return 'active';
    if (s === 'stopped' || s === 'error' || s === 'failed' || s === 'exited') return 'error';
    if (s === 'deploying' || s === 'provisioning' || s === 'starting' || s === 'restarting' || s === 'updating') return 'connecting';
    return 'loading';
  };

  const sections: SecondaryPanelSection[] = [];

  if (instances.length > 0) {
    const filtered = (clientFilter === 'all'
      ? instances
      : instances.filter(i => clientsByInstance[i.id] === clientFilter)
    );

    const KNOWN_TYPES = new Set(['n8n', 'openclaw', 'website', 'other']);
    const pendingInstances = filtered.filter(i => !i.is_external && (!i.service_type || i.deleted_at || i.status === 'pending_deploy' || !KNOWN_TYPES.has(i.service_type!))).sort((a, b) => a.instance_name.localeCompare(b.instance_name));
    const n8nInstances = filtered.filter(i => i.service_type === 'n8n' && !i.deleted_at && i.status !== 'pending_deploy').sort((a, b) => a.instance_name.localeCompare(b.instance_name));
    const openclawInstances = filtered.filter(i => i.service_type === 'openclaw' && !i.deleted_at && i.status !== 'pending_deploy').sort((a, b) => a.instance_name.localeCompare(b.instance_name));
    const websiteInstances = filtered.filter(i => i.service_type === 'website' && !i.deleted_at && i.status !== 'pending_deploy').sort((a, b) => a.instance_name.localeCompare(b.instance_name));
    const otherInstances = filtered.filter(i => i.service_type === 'other' && !i.deleted_at && i.status !== 'pending_deploy').sort((a, b) => a.instance_name.localeCompare(b.instance_name));

    const n8nIcon = (
      <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
        <path clipRule="evenodd" d="M24 8.4c0 1.325-1.102 2.4-2.462 2.4-1.146 0-2.11-.765-2.384-1.8h-3.436c-.602 0-1.115.424-1.214 1.003l-.101.592a2.38 2.38 0 01-.8 1.405c.412.354.704.844.8 1.405l.1.592A1.222 1.222 0 0015.719 15h.975c.273-1.035 1.237-1.8 2.384-1.8 1.36 0 2.461 1.075 2.461 2.4S20.436 18 19.078 18c-1.147 0-2.11-.765-2.384-1.8h-.975c-1.204 0-2.23-.848-2.428-2.005l-.101-.592a1.222 1.222 0 00-1.214-1.003H10.97c-.308.984-1.246 1.7-2.356 1.7-1.11 0-2.048-.716-2.355-1.7H4.817c-.308.984-1.246 1.7-2.355 1.7C1.102 14.3 0 13.225 0 11.9s1.102-2.4 2.462-2.4c1.183 0 2.172.815 2.408 1.9h1.337c.236-1.085 1.225-1.9 2.408-1.9 1.184 0 2.172.815 2.408 1.9h.952c.601 0 1.115-.424 1.213-1.003l.102-.592c.198-1.157 1.225-2.005 2.428-2.005h3.436c.274-1.035 1.238-1.8 2.384-1.8C22.898 6 24 7.075 24 8.4zm-1.23 0c0 .663-.552 1.2-1.232 1.2-.68 0-1.23-.537-1.23-1.2 0-.663.55-1.2 1.23-1.2.68 0 1.231.537 1.231 1.2zM2.461 13.1c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm6.153 0c.68 0 1.231-.537 1.231-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm10.462 3.7c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.23.537-1.23 1.2 0 .663.55 1.2 1.23 1.2z" />
      </svg>
    );
    const openclawIcon = (
      <img src="/logos/openclaw.png" className="w-5 h-5 object-contain rounded" alt="OpenClaw" />
    );
    const websiteIcon = <Globe className="w-5 h-5" />;

    const otherIcon = <Link2 className="w-5 h-5" />;

    const mapItem = (i: typeof filtered[0]) => ({
      id: i.id,
      label: i.instance_name,
      sublabel: i.deleted_at ? 'Not deployed' : i.status === 'pending_deploy' ? 'Choose what to deploy' : i.instance_url?.replace('https://', ''),
      status: mapStatus(i),
      icon: i.service_type === 'openclaw' ? openclawIcon
          : i.service_type === 'website' ? websiteIcon
          : i.service_type === 'other' ? otherIcon
          : n8nIcon,
    });

    const mapPendingItem = (i: typeof filtered[0]) => ({
      ...mapItem(i),
      icon: <Server className="w-5 h-5" />,
    });

    const n8nSectionIcon = <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5"><path clipRule="evenodd" d="M24 8.4c0 1.325-1.102 2.4-2.462 2.4-1.146 0-2.11-.765-2.384-1.8h-3.436c-.602 0-1.115.424-1.214 1.003l-.101.592a2.38 2.38 0 01-.8 1.405c.412.354.704.844.8 1.405l.1.592A1.222 1.222 0 0015.719 15h.975c.273-1.035 1.237-1.8 2.384-1.8 1.36 0 2.461 1.075 2.461 2.4S20.436 18 19.078 18c-1.147 0-2.11-.765-2.384-1.8h-.975c-1.204 0-2.23-.848-2.428-2.005l-.101-.592a1.222 1.222 0 00-1.214-1.003H10.97c-.308.984-1.246 1.7-2.356 1.7-1.11 0-2.048-.716-2.355-1.7H4.817c-.308.984-1.246 1.7-2.355 1.7C1.102 14.3 0 13.225 0 11.9s1.102-2.4 2.462-2.4c1.183 0 2.172.815 2.408 1.9h1.337c.236-1.085 1.225-1.9 2.408-1.9 1.184 0 2.172.815 2.408 1.9h.952c.601 0 1.115-.424 1.213-1.003l.102-.592c.198-1.157 1.225-2.005 2.428-2.005h3.436c.274-1.035 1.238-1.8 2.384-1.8C22.898 6 24 7.075 24 8.4zm-1.23 0c0 .663-.552 1.2-1.232 1.2-.68 0-1.23-.537-1.23-1.2 0-.663.55-1.2 1.23-1.2.68 0 1.231.537 1.231 1.2zM2.461 13.1c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm6.153 0c.68 0 1.231-.537 1.231-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm10.462 3.7c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.23.537-1.23 1.2 0 .663.55 1.2 1.23 1.2z" /></svg>;
    const ocSectionIcon = <img src="/logos/openclaw.png" className="w-3.5 h-3.5 object-contain rounded" alt="" />;

    if (pendingInstances.length > 0) {
      sections.push({ title: 'Not deployed', icon: <Server className="w-3.5 h-3.5" />, items: pendingInstances.map(mapPendingItem) });
    }
    if (n8nInstances.length > 0) {
      sections.push({ title: 'n8n', icon: n8nSectionIcon, items: n8nInstances.map(mapItem) });
    }
    if (openclawInstances.length > 0) {
      sections.push({ title: 'OpenClaw', icon: ocSectionIcon, items: openclawInstances.map(mapItem) });
    }
    if (websiteInstances.length > 0) {
      sections.push({ title: 'Website', icon: <Globe className="w-3.5 h-3.5" />, items: websiteInstances.map(mapItem) });
    }
    if (otherInstances.length > 0) {
      sections.push({ title: 'Other', icon: <Link2 className="w-3.5 h-3.5" />, items: otherInstances.map(mapItem) });
    }
  }

  const showSkeleton = loading && instances.length === 0;

  // Header content
  const headerTitle = selectedInstance
    ? selectedInstance.instance_name
    : 'Hosting';

  const headerSublabel = selectedInstance?.deleted_at
    ? 'Not deployed'
    : selectedInstance?.status === 'pending_deploy'
      ? 'Choose what to deploy'
      : selectedInstance?.instance_url
        ? selectedInstance.instance_url.replace('https://', '')
        : null;

  return (
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
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-28 bg-gray-800/30 rounded animate-pulse" />
                    <div className="h-3 w-36 bg-gray-800/30 rounded animate-pulse" />
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
            searchPlaceholder="Search instances..."
            action={isClient ? undefined : (
              <div className="space-y-2">
                <SearchableSelect
                  value={clientFilter}
                  onChange={setClientFilter}
                  options={[{ value: 'all', label: 'All Clients' }, ...clientEmails.map(e => ({ value: e, label: e }))]}
                />
                <button
                  onClick={() => setDeployOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Deploy
                </button>
              </div>
            )}
          />
        )}
      </div>
      <HostingContext.Provider value={{ liveStatus, statusLoading, openDeployModal: () => setDeployOpen(true), refetchInstances, flowEngineConnected }}>
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header bar — breadcrumb */}
        <div className="flex-shrink-0 border-b border-gray-800 px-6 h-[64px] flex items-center gap-3 min-w-0">
          {selectedInstance && (
            <button
              onClick={() => router.push('/portal/hosting')}
              className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              Hosting
            </button>
          )}
          {selectedInstance && (
            <span className="text-white/20 shrink-0">/</span>
          )}
          <h1 className="text-lg font-semibold text-white truncate">{headerTitle}</h1>
        </div>
        {/* Sub-header — instance URL */}
        {headerSublabel && (
          <div className="flex-shrink-0 border-b border-gray-800 px-6 py-3 flex items-center gap-2">
            {!selectedInstance?.deleted_at && selectedInstance?.status !== 'pending_deploy' ? (
              <a
                href={selectedInstance?.instance_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
              >
                {headerSublabel}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-sm text-gray-400">{headerSublabel}</span>
            )}
          </div>
        )}

        {/* Content */}
        {showSkeleton ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6 space-y-4">
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
                <div className="h-5 w-32 bg-gray-800/30 rounded animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-800/30 rounded-lg animate-pulse" />
                  ))}
                </div>
                <div className="h-32 bg-gray-800/30 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
      </HostingContext.Provider>

      <DeployInstanceModal
        isOpen={deployOpen}
        onClose={() => setDeployOpen(false)}
        onDeploy={handleDeploy}
        onConnectInstance={handleConnectInstance}
        existingInstanceCount={instances.length}
        isDeploying={deploying}
        accessToken={session?.access_token}
        onSuccess={() => {
          try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
          refetchInstances();
        }}
      />
    </>
  );
}
