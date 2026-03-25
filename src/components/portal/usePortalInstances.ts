'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTeamContext } from '@/hooks/useTeamContext';

export interface PortalInstance {
  id: string;
  instance_name: string;
  instance_url: string;
  status: string;
  storage_limit_gb: number;
  created_at: string;
  source: 'pay_per_instance' | 'membership';
  is_external?: boolean;
  access: 'owner' | 'manager' | 'client';
  deleted_at?: string | null;
  service_type?: 'n8n' | 'openclaw' | 'website' | 'other' | null;
  stripe_subscription_id?: string | null;
  platform?: 'flowengine';
}

const CACHE_KEY = 'portal-hosting-instances-v2';
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCache(): PortalInstance[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCache(data: PortalInstance[]) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export function usePortalInstances() {
  const { user, loading: authLoading } = useAuth();
  const { ownerId, loading: teamLoading } = useTeamContext();
  const [instances, setInstances] = useState<PortalInstance[]>(() => getCache() || []);
  const [loading, setLoading] = useState(!getCache());
  const [flowEngineError, setFlowEngineError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!user || !ownerId) return;

    // Use ownerId for queries — if team member, fetches owner's data
    const effectiveId = ownerId;

    try {
    const [payPerResult, membershipResult, clientResult] = await Promise.all([
      // Instances owned/managed by effective owner
      // Include deleted instances (deleted_at set) — they still have active subscriptions and can be redeployed
      supabase
        .from('pay_per_instance_deployments')
        .select('id, instance_name, instance_url, status, storage_limit_gb, created_at, is_external, user_id, invited_by_user_id, deleted_at, stripe_subscription_id, service_type')
        .or(`user_id.eq.${effectiveId},invited_by_user_id.eq.${effectiveId}`)
        .neq('subscription_status', 'canceled')
        .order('created_at', { ascending: false }),
      // Membership instances
      supabase
        .from('n8n_instances')
        .select('id, subdomain, instance_url, status, storage_limit_gb, created_at')
        .eq('user_id', effectiveId)
        .neq('status', 'deleted')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      // Instances with client access (still use user.id — these are personal)
      supabase
        .from('client_instances')
        .select('instance_id, pay_per_instance_deployments(id, instance_name, instance_url, status, storage_limit_gb, created_at, is_external, service_type)')
        .eq('user_id', user.id),
    ]);

    if (payPerResult.error) console.error('[usePortalInstances] pay_per query error:', payPerResult.error);

    const seenIds = new Set<string>();

    const payPer: PortalInstance[] = (payPerResult.data || []).map((d: any) => {
      seenIds.add(d.id);
      return {
        id: d.id,
        instance_name: d.instance_name,
        instance_url: d.instance_url,
        status: d.status,
        storage_limit_gb: d.storage_limit_gb,
        created_at: d.created_at,
        source: 'pay_per_instance' as const,
        is_external: d.is_external || false,
        access: d.user_id === effectiveId ? 'owner' as const : 'manager' as const,
        deleted_at: d.deleted_at,
        service_type: d.service_type === 'docker' ? 'website' : (d.service_type || null),
        stripe_subscription_id: d.stripe_subscription_id || null,
      };
    });

    const membership: PortalInstance[] = (membershipResult.data || []).map((d: any) => {
      seenIds.add(d.id);
      return {
        id: d.id,
        instance_name: d.subdomain || 'Dedicated Instance',
        instance_url: d.instance_url,
        status: d.status,
        storage_limit_gb: d.storage_limit_gb || 50,
        created_at: d.created_at,
        source: 'membership' as const,
        is_external: false,
        access: 'owner' as const,
        service_type: 'n8n' as const,
      };
    });

    // Client-access instances (only add if not already seen as owner/manager)
    const clientAccess: PortalInstance[] = (clientResult.data || [])
      .filter((d: any) => d.pay_per_instance_deployments && !seenIds.has(d.instance_id))
      .map((d: any) => {
        const inst = d.pay_per_instance_deployments;
        seenIds.add(d.instance_id);
        return {
          id: inst.id,
          instance_name: inst.instance_name,
          instance_url: inst.instance_url,
          status: inst.status,
          storage_limit_gb: inst.storage_limit_gb,
          created_at: inst.created_at,
          source: 'pay_per_instance' as const,
          is_external: inst.is_external || false,
          access: 'client' as const,
          service_type: inst.service_type === 'docker' ? 'website' : (inst.service_type || null),
        };
      });

    const localMerged = [...payPer, ...membership, ...clientAccess];

    // Show local instances immediately — don't block on FlowEngine API
    setInstances(localMerged);
    setCache(localMerged);
    setLoading(false);

    // Merge FlowEngine-hosted instances in the background (non-blocking)
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (!authSession?.access_token) return;
      fetch('/api/flowengine/instances', {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      })
        .then(async (feRes) => {
          if (!feRes.ok) {
            const errData = await feRes.json().catch(() => ({}));
            const msg = errData.error || errData.message || `FlowEngine API error (${feRes.status})`;
            console.warn('[usePortalInstances] FlowEngine fetch failed:', msg);
            setFlowEngineError(msg);
            return;
          }
          setFlowEngineError(null);
          const feData = await feRes.json();

          // Only FlowEngine-managed instances (not user-connected external ones)
          const feManagedInstances: any[] = (feData.instances || []).filter((i: any) => !i.is_external);
          const feNameSet = new Set<string>(feManagedInstances.map((i: any) => i.instance_name));

          setInstances(prev => {
            let merged = prev.filter(i => !i.is_external || !feNameSet.has(i.instance_name));
            const localManagedNames = new Set(merged.filter(i => !i.is_external).map(i => i.instance_name));
            const feInstances: PortalInstance[] = feManagedInstances
              .filter((i: any) => !localManagedNames.has(i.instance_name))
              .map((i: any) => ({
                id: i.id,
                instance_name: i.instance_name,
                instance_url: i.instance_url,
                status: i.status,
                storage_limit_gb: i.storage_gb,
                created_at: i.created_at,
                source: 'pay_per_instance' as const,
                is_external: false,
                access: 'owner' as const,
                service_type: (i.service_type || 'n8n') as PortalInstance['service_type'],
                platform: 'flowengine' as const,
              }));
            const final = [...merged, ...feInstances];
            setCache(final);
            return final;
          });
        })
        .catch((err) => {
          console.warn('[usePortalInstances] FlowEngine unreachable:', err);
          setFlowEngineError('FlowEngine unreachable');
        });
    });
    } catch (err) {
      console.error('[usePortalInstances] fetch failed:', err);
      setLoading(false);
    }
  }, [user, ownerId]);

  useEffect(() => {
    if (!authLoading && !teamLoading && user && ownerId) fetch_();
  }, [authLoading, teamLoading, user, ownerId, fetch_]);

  // Re-fetch when the FlowEngine API key is saved (dispatched by PlatformSettings)
  useEffect(() => {
    const handler = () => {
      try { sessionStorage.removeItem('portal-hosting-instances-v2'); } catch {}
      if (!authLoading && !teamLoading && user && ownerId) fetch_();
    };
    window.addEventListener('flowengine-key-updated', handler);
    return () => window.removeEventListener('flowengine-key-updated', handler);
  }, [authLoading, teamLoading, user, ownerId, fetch_]);

  return { instances, loading, flowEngineError, refetch: fetch_ };
}
