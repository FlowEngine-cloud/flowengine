'use client';

import { createContext, useContext } from 'react';

export interface WidgetItem {
  id: string;
  name: string;
  widget_type: 'button' | 'form' | 'chatbot';
  is_active: boolean;
  instance: { id: string; instance_name: string } | null;
  created_at?: string;
}

interface UIStudioContextValue {
  widgets: WidgetItem[];
  loading: boolean;
  refetch: () => Promise<void>;
  openWidget: (id: string) => void;
}

export const UIStudioContext = createContext<UIStudioContextValue>({
  widgets: [],
  loading: true,
  refetch: async () => {},
  openWidget: () => {},
});
export function useUIStudioContext() { return useContext(UIStudioContext); }
