'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import type { TeamRole } from '@/lib/teamUtils';

export interface TeamContextState {
  ownerId: string | null;
  isTeamMember: boolean;
  role: TeamRole;
  loading: boolean;
}

export function useTeamContext(): TeamContextState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<TeamContextState>({
    ownerId: null,
    isTeamMember: false,
    role: 'owner',
    loading: true,
  });

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading && !user) setState(s => ({ ...s, loading: false }));
      return;
    }

    supabase
      .from('team_members')
      .select('owner_id, role')
      .eq('member_id', user.id)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setState({ ownerId: user.id, isTeamMember: false, role: 'owner', loading: false });
          return;
        }
        setState({
          ownerId: data.owner_id,
          isTeamMember: true,
          role: data.role as TeamRole,
          loading: false,
        });
      });
  }, [user, authLoading]);

  return state;
}
