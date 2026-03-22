'use client';

import { createContext, useContext } from 'react';

export interface ServiceConnection {
  id: string;
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: string;
  server_url: string | null;
  linked_instance_id?: string | null;
}

interface ServicesContextValue {
  connections: ServiceConnection[];
  loading: boolean;
  liveStatus: Record<string, string>;
  statusLoading: boolean;
  refetch: () => Promise<void>;
}

export const ServicesContext = createContext<ServicesContextValue>({ connections: [], loading: true, liveStatus: {}, statusLoading: true, refetch: async () => {} });
export function useServicesContext() { return useContext(ServicesContext); }
