'use client';

import { createContext, useContext } from 'react';

export type SettingsTab = 'account' | 'company' | 'connections' | 'oauth' | 'api';

export interface SettingsContextValue {
  activeTab: SettingsTab;
  isTeams: boolean;
  loading: boolean;
}

export const SettingsContext = createContext<SettingsContextValue>({
  activeTab: 'account',
  isTeams: false,
  loading: true,
});

export function useSettingsContext() {
  return useContext(SettingsContext);
}
