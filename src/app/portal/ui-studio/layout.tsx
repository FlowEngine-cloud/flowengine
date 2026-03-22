'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { usePortalRoleContext } from '@/app/portal/context';
import SecondaryPanel, { SecondaryPanelSection } from '@/components/portal/SecondaryPanel';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Plus, MousePointer, FileText, MessageCircle } from 'lucide-react';
import { UIStudioContext } from './context';
import WidgetPreviewModal from '@/components/widgets/WidgetPreviewModal';
import type { WidgetItem } from './context';

const typeIcon: Record<string, React.ReactNode> = {
  button: <MousePointer className="w-4 h-4 text-white/60" />,
  form: <FileText className="w-4 h-4 text-white/60" />,
  chatbot: <MessageCircle className="w-4 h-4 text-white/60" />,
};

const typeLabel: Record<string, string> = {
  button: 'Button',
  form: 'Form',
  chatbot: 'Chatbot',
};

export default function UIStudioLayout({ children }: { children: React.ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = usePortalRoleContext();
  const router = useRouter();
  const pathname = usePathname();

  // Route guard: clients access UI embeds through instance tabs, not top-level
  useEffect(() => {
    if (!roleLoading && role === 'client') {
      router.replace('/portal');
    }
  }, [role, roleLoading, router]);

  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Client filter
  const [clientFilter, setClientFilter] = useState('all');
  const [clientEmails, setClientEmails] = useState<string[]>([]);
  const [clientInstanceMap, setClientInstanceMap] = useState<Record<string, string[]>>({});

  // Instances for "Assign to Client" in the popup
  const [instances, setInstances] = useState<Array<{ id: string; instance_name: string }>>([]);

  // Widget preview modal state (lifted here so secondary panel can also open it)
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<any>(null);

  const fetchWidgets = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/widget-studio/templates', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWidgets(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch widgets:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const fetchInstances = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/user/instances', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const active = (data.instances || [])
          .filter((i: any) => i.status === 'active' || i.status === 'running')
          .map((i: any) => ({ id: i.id, instance_name: i.instance_name || 'Instance' }));
        setInstances(active);
      }
    } catch {
      // silent
    }
  }, [session]);

  const fetchClients = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/client/instances', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const instances = data.instances || [];
        const emailSet = new Set<string>();
        const map: Record<string, string[]> = {};
        for (const inst of instances) {
          if (!inst.client_email) continue;
          emailSet.add(inst.client_email);
          if (!map[inst.client_email]) map[inst.client_email] = [];
          if (inst.instance_id) map[inst.client_email].push(inst.instance_id);
        }
        setClientEmails([...emailSet]);
        setClientInstanceMap(map);
      }
    } catch { /* silent */ }
  }, [session]);

  useEffect(() => {
    if (!authLoading && session) {
      fetchWidgets();
      fetchInstances();
      fetchClients();
    }
  }, [authLoading, session, fetchWidgets, fetchInstances, fetchClients]);

  const openWidget = useCallback(async (id: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/widget-studio/templates/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedWidget(data.widget);
        setWidgetModalOpen(true);
      }
    } catch {
      // silent
    }
  }, [session]);

  if (role === 'client') return null;

  const handleToggleStatus = async (widgetId: string, isActive: boolean) => {
    if (!session) return;
    await fetch(`/api/widget-studio/templates/${widgetId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    });
    setSelectedWidget((prev: any) => prev ? { ...prev, is_active: isActive } : prev);
    fetchWidgets();
  };

  const handleAssignToInstance = async (widgetId: string, instanceId: string) => {
    if (!session) return;
    const res = await fetch(`/api/client/widgets/${widgetId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId }),
    });
    if (res.ok) {
      // Update selected widget's instance info
      const instance = instances.find(i => i.id === instanceId);
      if (instance) {
        setSelectedWidget((prev: any) => prev ? { ...prev, instance_id: instanceId, instance } : prev);
      }
      fetchWidgets();
    }
  };

  const handleDuplicate = async (widgetId: string) => {
    if (!session) return;
    const res = await fetch(`/api/widget-studio/templates/${widgetId}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      fetchWidgets();
      setWidgetModalOpen(false);
      setSelectedWidget(null);
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (!session) return;
    const res = await fetch(`/api/widget-studio/templates/${widgetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      fetchWidgets();
      setWidgetModalOpen(false);
      setSelectedWidget(null);
    }
  };

  // Secondary panel: clicking an item opens the popup (not a detail page)
  const handleSelect = (id: string) => {
    openWidget(id);
  };

  // Filter widgets by selected client (via instance id)
  const filteredWidgets = clientFilter === 'all'
    ? widgets
    : widgets.filter(w => w.instance?.id && clientInstanceMap[clientFilter]?.includes(w.instance.id));

  // Group by widget type for secondary panel
  const sections: SecondaryPanelSection[] = [];
  if (filteredWidgets.length > 0) {
    const byType: Record<string, WidgetItem[]> = {};
    for (const w of filteredWidgets) {
      const t = w.widget_type || 'button';
      if (!byType[t]) byType[t] = [];
      byType[t].push(w);
    }
    for (const type of ['chatbot', 'form', 'button']) {
      const items = byType[type];
      if (!items || items.length === 0) continue;
      sections.push({
        title: `${typeLabel[type]}s`,
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)).map((w) => ({
          id: w.id,
          label: w.name,
          sublabel: w.instance?.instance_name || 'No instance',
          icon: typeIcon[type],
        })),
      });
    }
  }

  const showSkeleton = loading && widgets.length === 0;

  return (
    <UIStudioContext.Provider value={{ widgets, loading, refetch: fetchWidgets, openWidget }}>
    <>
      <div className="hidden md:block">
        {showSkeleton ? (
          <div className="w-[280px] flex-shrink-0 h-full bg-black border-r border-gray-800 flex flex-col">
            <div className="h-[64px] border-b border-gray-800 px-3 flex items-center">
              <div className="h-9 w-full bg-gray-800/30 rounded-lg animate-pulse" />
            </div>
            <div className="px-2 space-y-1 pt-2">
              <div className="px-3 py-2">
                <div className="h-3 w-16 bg-gray-800/30 rounded animate-pulse" />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-28 bg-gray-800/30 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-gray-800/30 rounded animate-pulse" />
                  </div>
                  <div className="w-2 h-2 bg-gray-800/30 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SecondaryPanel
            sections={sections}
            selectedId={undefined}
            onSelect={handleSelect}
            searchPlaceholder="Search components..."
            action={
              <div className="space-y-2">
                {clientEmails.length > 0 && (
                  <SearchableSelect
                    value={clientFilter}
                    onChange={setClientFilter}
                    options={[{ value: 'all', label: 'All Clients' }, ...clientEmails.map(e => ({ value: e, label: e }))]}
                  />
                )}
                <button
                  onClick={() => router.push('/portal/ui-studio/editor?editor=new')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white text-black hover:bg-gray-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
              </div>
            }
          />
        )}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header bar */}
        <div className="flex-shrink-0 border-b border-gray-800 px-6 h-[64px] flex items-center">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">UI Embeds</h1>
          </div>
        </div>

        {/* Content */}
        {showSkeleton ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6 space-y-4">
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
                <div className="h-5 w-32 bg-gray-800/30 rounded animate-pulse" />
                <div className="h-24 bg-gray-800/30 rounded-lg animate-pulse" />
                <div className="h-10 w-40 bg-gray-800/30 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Widget Preview Modal — shared, opened from both grid and secondary panel */}
      <WidgetPreviewModal
        isOpen={widgetModalOpen}
        widget={selectedWidget}
        onClose={() => { setWidgetModalOpen(false); setSelectedWidget(null); }}
        onToggleStatus={handleToggleStatus}
        instances={instances}
        onAssignToInstance={handleAssignToInstance}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteWidget}
      />
    </>
    </UIStudioContext.Provider>
  );
}
