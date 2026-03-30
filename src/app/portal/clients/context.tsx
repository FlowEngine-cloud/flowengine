'use client';

import { createContext, useContext } from 'react';

export interface ClientInstance {
  instance_id: string;
  user_id: string;
  invite_id?: string;
  instance_name: string;
  instance_url: string;
  status: string;
  client_email: string;
  client_name?: string;
  client_paid: boolean;
  is_external?: boolean;
  service_type?: string | null;
  storage_limit_gb?: number;
  invite_status?: string;
}

export interface GroupedClient {
  userId: string;
  email: string;
  name?: string;
  instances: ClientInstance[];
  bestStatus: 'active' | 'pending' | 'inactive';
}

interface ClientsContextValue {
  rawInstances: ClientInstance[];
  grouped: GroupedClient[];
  loading: boolean;
  refetch: () => Promise<void>;
  openInvite: () => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  agencyInstances: { id: string; name: string }[];
  agencyExternalInstances: { id: string; name: string; url: string | null; service_type: string | null }[];
  agencyServices: { id: string; name: string; phone: string | null }[];
  liveStatus: Record<string, string>;
  statusLoading: boolean;
}

export const ClientsContext = createContext<ClientsContextValue>({
  rawInstances: [],
  grouped: [],
  loading: true,
  refetch: async () => {},
  openInvite: () => {},
  statusFilter: 'all',
  setStatusFilter: () => {},
  agencyInstances: [],
  agencyExternalInstances: [],
  agencyServices: [],
  liveStatus: {},
  statusLoading: true,
});
export function useClientsContext() { return useContext(ClientsContext); }
