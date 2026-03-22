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

    supabase.rpc('get_effective_owner_id').then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        setState({ ownerId: user.id, isTeamMember: false, role: 'owner', loading: false });
        return;
      }
      const row = data[0];
      setState({
        ownerId: row.owner_id,
        isTeamMember: row.is_team_member,
        role: row.team_role as TeamRole,
        loading: false,
      });
    });
  }, [user, authLoading]);

  return state;
}
