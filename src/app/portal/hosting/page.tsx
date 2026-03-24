'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePortalInstances, PortalInstance } from '@/components/portal/usePortalInstances';
import { useAuth } from '@/components/AuthContext';
import { Server, ExternalLink, Loader2, Plus, Globe, CreditCard, Link2 } from 'lucide-react';
import { useHostingContext } from './context';

// ─── Service icons (module-level, stable references) ─────────────────────────

const N8N_PATH = 'M24 8.4c0 1.325-1.102 2.4-2.462 2.4-1.146 0-2.11-.765-2.384-1.8h-3.436c-.602 0-1.115.424-1.214 1.003l-.101.592a2.38 2.38 0 01-.8 1.405c.412.354.704.844.8 1.405l.1.592A1.222 1.222 0 0015.719 15h.975c.273-1.035 1.237-1.8 2.384-1.8 1.36 0 2.461 1.075 2.461 2.4S20.436 18 19.078 18c-1.147 0-2.11-.765-2.384-1.8h-.975c-1.204 0-2.23-.848-2.428-2.005l-.101-.592a1.222 1.222 0 00-1.214-1.003H10.97c-.308.984-1.246 1.7-2.356 1.7-1.11 0-2.048-.716-2.355-1.7H4.817c-.308.984-1.246 1.7-2.355 1.7C1.102 14.3 0 13.225 0 11.9s1.102-2.4 2.462-2.4c1.183 0 2.172.815 2.408 1.9h1.337c.236-1.085 1.225-1.9 2.408-1.9 1.184 0 2.172.815 2.408 1.9h.952c.601 0 1.115-.424 1.213-1.003l.102-.592c.198-1.157 1.225-2.005 2.428-2.005h3.436c.274-1.035 1.238-1.8 2.384-1.8C22.898 6 24 7.075 24 8.4zm-1.23 0c0 .663-.552 1.2-1.232 1.2-.68 0-1.23-.537-1.23-1.2 0-.663.55-1.2 1.23-1.2.68 0 1.231.537 1.231 1.2zM2.461 13.1c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm6.153 0c.68 0 1.231-.537 1.231-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm10.462 3.7c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.23.537-1.23 1.2 0 .663.55 1.2 1.23 1.2z';

function n8nSvg(cls: string) {
  return (
    <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" className={cls}>
      <path clipRule="evenodd" d={N8N_PATH} />
    </svg>
  );
}
function openclawImg(cls: string) {
  return <img src="/logos/openclaw.png" className={`${cls} object-contain rounded`} alt="OpenClaw" />;
}

function serviceCardIcon(serviceType: string | null | undefined) {
  if (!serviceType) return <Server className="w-4 h-4 text-white/30" />;
  if (serviceType === 'openclaw') return openclawImg('w-6 h-6');
  if (serviceType === 'docker' || serviceType === 'website') return <Globe className="w-5 h-5 text-white/60" />;
  if (serviceType === 'other') return <Link2 className="w-5 h-5 text-white/60" />;
  return n8nSvg('w-5 h-5');
}

function sectionIcon(key: string) {
  if (key === 'n8n') return n8nSvg('w-4 h-4');
  if (key === 'openclaw') return openclawImg('w-4 h-4');
  if (key === 'website') return <Globe className="w-4 h-4" />;
  if (key === 'other') return <Link2 className="w-4 h-4" />;
  return <Server className="w-4 h-4" />;
}

export default function HostingPage() {
  const { instances, loading } = usePortalInstances();
  const { liveStatus, openDeployModal } = useHostingContext();
  const { session } = useAuth();
  const router = useRouter();
  const [loadingPortal, setLoadingPortal] = useState<string | null>(null);

  const openBillingPortal = async (e: React.MouseEvent, subscriptionId: string, instanceId: string) => {
    e.stopPropagation();
    if (!session?.access_token || loadingPortal) return;
    setLoadingPortal(instanceId);
    try {
      const res = await fetch('/api/stripe/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ subscription_id: subscriptionId, return_url: `${window.location.origin}/portal/hosting` }),
      });
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank');
    } catch {}
    setLoadingPortal(null);
  };

  if (loading) return null;

  if (instances.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-900/50 border border-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <Server className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No instances yet</h3>
          <p className="text-white/60 text-base mb-6 max-w-sm">Deploy your first instance to get started.</p>
          <button
            onClick={() => openDeployModal()}
            className="px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Deploy Instance
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (inst: PortalInstance) => {
    if (inst.deleted_at || inst.status === 'pending_deploy') {
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 inline-flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
          {inst.status === 'pending_deploy' ? 'Pending' : 'Not deployed'}
        </span>
      );
    }
    const s = liveStatus[inst.id] || inst.status;
    if (s === 'running' || s === 'active') return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20 inline-flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        Active
      </span>
    );
    if (s === 'stopped' || s === 'error' || s === 'failed' || s === 'exited') return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
        Offline
      </span>
    );
    const label = ['deploying', 'provisioning', 'starting', 'restarting', 'updating', 'stopping'].includes(s)
      ? s.charAt(0).toUpperCase() + s.slice(1)
      : 'Checking';
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-900/20 text-yellow-400 border border-yellow-800 inline-flex items-center gap-1.5 shrink-0">
        <Loader2 className="w-3 h-3 animate-spin" />
        {label}
      </span>
    );
  };

  const renderCard = (inst: PortalInstance) => (
    <button
      key={inst.id}
      onClick={() => router.push(`/portal/hosting/${inst.id}`)}
      className="group bg-gray-900/50 border border-gray-800 hover:border-gray-600 rounded-xl p-4 text-left transition-all cursor-pointer w-full"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-800/30 flex items-center justify-center shrink-0">
          {inst.deleted_at || inst.status === 'pending_deploy'
            ? <Server className="w-4 h-4 text-white/30" />
            : serviceCardIcon(inst.service_type)
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{inst.instance_name}</p>
          {inst.instance_url && !inst.deleted_at && inst.status !== 'pending_deploy' ? (
            <p className="flex items-center gap-1 text-sm text-white/60 truncate mt-0.5">
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">{inst.instance_url.replace('https://', '')}</span>
            </p>
          ) : (
            <p className="text-xs text-white/30 mt-0.5">
              {inst.status === 'pending_deploy' ? 'Choose service to deploy' : 'Ready to redeploy'}
            </p>
          )}
        </div>
        {getStatusBadge(inst)}
      </div>

      {inst.access && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
          <span className="text-xs text-white/30">
            {inst.access === 'owner' ? 'You pay' : inst.access === 'manager' ? 'You manage' : 'Client pays'}
          </span>
          {inst.stripe_subscription_id && inst.access === 'owner' && (
            <button
              onClick={(e) => openBillingPortal(e, inst.stripe_subscription_id!, inst.id)}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              {loadingPortal === inst.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
              Billing
            </button>
          )}
        </div>
      )}
    </button>
  );

  const notDeployed = instances.filter(i => !i.service_type || i.deleted_at || i.status === 'pending_deploy');
  const n8nInstances = instances.filter(i => i.service_type === 'n8n' && !i.deleted_at && i.status !== 'pending_deploy');
  const openclawInstances = instances.filter(i => i.service_type === 'openclaw' && !i.deleted_at && i.status !== 'pending_deploy');
  const websiteInstances = instances.filter(i => (i.service_type === 'docker' || i.service_type === 'website') && !i.deleted_at && i.status !== 'pending_deploy');
  const otherInstances = instances.filter(i => i.service_type === 'other' && !i.deleted_at && i.status !== 'pending_deploy');

  const sections = [
    { key: 'n8n',          title: 'n8n',          items: n8nInstances },
    { key: 'openclaw',     title: 'OpenClaw',      items: openclawInstances },
    { key: 'website',      title: 'Website',       items: websiteInstances },
    { key: 'other',        title: 'Other',         items: otherInstances },
    { key: 'not-deployed', title: 'Not deployed',  items: notDeployed },
  ].filter(s => s.items.length > 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-8">
        {sections.map(section => (
          <div key={section.key}>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex-shrink-0 text-white/50">{sectionIcon(section.key)}</span>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{section.title}</span>
              <span className="text-xs text-white/25 font-normal">{section.items.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.items.map(inst => renderCard(inst))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
