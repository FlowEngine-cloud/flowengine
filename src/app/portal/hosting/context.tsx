'use client';

import { createContext, useContext } from 'react';
import type { PortalInstance } from '@/components/portal/usePortalInstances';

interface HostingContextValue {
  /** All portal instances (same data as usePortalInstances) */
  instances: PortalInstance[];
  instancesLoading: boolean;
  /** Maps instanceId → live deployment status string */
  liveStatus: Record<string, string>;
  statusLoading: boolean;
  openDeployModal: () => void;
  /** Refetch instances list (e.g. after deletion) */
  refetchInstances: () => Promise<void>;
  /** Whether the FlowEngine API key is configured */
  flowEngineConnected: boolean;
}

export const HostingContext = createContext<HostingContextValue>({ instances: [], instancesLoading: true, liveStatus: {}, statusLoading: true, openDeployModal: () => {}, refetchInstances: async () => {}, flowEngineConnected: false });
export function useHostingContext() { return useContext(HostingContext); }
