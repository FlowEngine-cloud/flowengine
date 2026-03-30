'use client';

import { createContext, useContext } from 'react';

export interface TemplateItem {
  id: string;
  name: string;
  description?: string | null;
  category: string | null;
  icon: string | null;
  import_count: number;
  version?: number;
}

interface TemplatesContextValue {
  templates: TemplateItem[];
  loading: boolean;
  refetch: () => Promise<void>;
  showAddModal: boolean;
  setShowAddModal: (v: boolean) => void;
}

export const TemplatesContext = createContext<TemplatesContextValue>({ templates: [], loading: true, refetch: async () => {}, showAddModal: false, setShowAddModal: () => {} });
export function useTemplatesContext() { return useContext(TemplatesContext); }
