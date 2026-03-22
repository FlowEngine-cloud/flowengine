'use client';

import { createContext, useContext } from 'react';

interface HostingContextValue {
  /** Maps instanceId → live deployment status string */
  liveStatus: Record<string, string>;
  statusLoading: boolean;
  openDeployModal: () => void;
  /** Refetch instances list (e.g. after deletion) */
  refetchInstances: () => Promise<void>;
  /** Whether the FlowEngine API key is configured */
  flowEngineConnected: boolean;
}

export const HostingContext = createContext<HostingContextValue>({ liveStatus: {}, statusLoading: true, openDeployModal: () => {}, refetchInstances: async () => {}, flowEngineConnected: false });
export function useHostingContext() { return useContext(HostingContext); }
