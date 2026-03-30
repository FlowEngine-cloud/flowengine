'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';

export type PortalRole = 'agency' | 'client' | 'free';

export interface PortalRoleInfo {
  role: PortalRole;
  agencyId: string | null;
  clientInstanceIds: string[];
  allowFullAccess: boolean;
  loading: boolean;
}

const CACHE_KEY = 'portal-role';
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCache(): Omit<PortalRoleInfo, 'loading'> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCache(data: Omit<PortalRoleInfo, 'loading'>) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export function usePortalRole(): PortalRoleInfo {
  const { user, session, loading: authLoading } = useAuth();
  const cached = getCache();
  const [info, setInfo] = useState<Omit<PortalRoleInfo, 'loading'>>(() => cached || {
    role: 'free',
    agencyId: null,
    clientInstanceIds: [],
    allowFullAccess: false,
  });
  const [loading, setLoading] = useState(!cached);

  const detect = useCallback(async () => {
    if (!user || !session?.access_token) return;

    const [ownedResult, membershipResult, clientCheckRes, teamResult] = await Promise.all([
      // Check if user owns any pay-per-instance
      supabase
        .from('pay_per_instance_deployments')
        .select('id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .limit(1),
      // Check if user owns any membership instance
      supabase
        .from('n8n_instances')
        .select('id')
        .eq('user_id', user.id)
        .neq('status', 'deleted')
        .limit(1),
      // Check if user is a client — uses server-side route to bypass client_instances RLS
      fetch('/api/portal/client-check', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then(r => r.json()).catch(() => ({ isClient: false, allowFullAccess: false, instances: [] })),
      // Check if user is a team member of an agency owner
      supabase
        .from('team_members')
        .select('owner_id')
        .eq('member_id', user.id)
        .eq('status', 'accepted')
        .limit(1),
    ]);

    const ownsInstances = (ownedResult.data?.length ?? 0) > 0 || (membershipResult.data?.length ?? 0) > 0;
    const isTeamMember = (teamResult.data?.length ?? 0) > 0;
    const clientLinks: { instance_id: string; invited_by: string }[] = clientCheckRes.instances || [];
    const isClient = clientCheckRes.isClient === true;

    let role: PortalRole = 'free';
    let agencyId: string | null = null;
    const clientInstanceIds: string[] = [];
    let allowFullAccess = false;

    if (ownsInstances || isTeamMember) {
      // User owns instances or is a team member of an agency — treat as agency
      role = 'agency';
    } else if (isClient) {
      role = 'client';
      agencyId = clientLinks[0].invited_by;
      for (const link of clientLinks) {
        clientInstanceIds.push(link.instance_id);
      }
      allowFullAccess = clientCheckRes.allowFullAccess === true;
    }

    const result = { role, agencyId, clientInstanceIds, allowFullAccess };
    setInfo(result);
    setCache(result);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) detect();
  }, [authLoading, user, detect]);

  return { ...info, loading };
}
