'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { usePortalRoleContext } from '@/app/portal/context';
import SecondaryPanel, { SecondaryPanelSection } from '@/components/portal/SecondaryPanel';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { Upload, Loader2, Plus } from 'lucide-react';
import { TemplatesContext } from './context';
import type { TemplateItem } from './context';

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = usePortalRoleContext();
  const router = useRouter();
  const pathname = usePathname();

  // Route guard: clients access templates through instance tabs, not top-level
  useEffect(() => {
    if (!roleLoading && role === 'client') {
      router.replace('/portal');
    }
  }, [role, roleLoading, router]);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Client filter
  const [clientFilter, setClientFilter] = useState('all');
  const [clientEmails, setClientEmails] = useState<string[]>([]);

  const segments = pathname?.split('/portal/templates/') || [];
  const selectedId = segments[1] || undefined;

  const selectedTemplate = selectedId ? templates.find((t) => t.id === selectedId) : null;

  const fetchTemplates = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/n8n-templates', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
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
        const emails = [...new Set<string>(
          (data.instances || []).map((i: { client_email: string }) => i.client_email).filter(Boolean)
        )];
        setClientEmails(emails as string[]);
      }
    } catch { /* silent */ }
  }, [session]);

  useEffect(() => {
    if (!authLoading && session) {
      fetchTemplates();
      fetchClients();
    }
  }, [authLoading, session, fetchTemplates, fetchClients]);

  if (role === 'client') return null;

  const handleSelect = (id: string) => {
    router.push(`/portal/templates/${id}`);
  };

  // Group templates by category
  const sections: SecondaryPanelSection[] = [];
  if (templates.length > 0) {
    const byCategory: Record<string, TemplateItem[]> = {};
    for (const t of templates) {
      const cat = t.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t);
    }
    for (const [category, items] of Object.entries(byCategory)) {
      sections.push({
        title: category,
        collapsible: true,
        defaultCollapsed: true,
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({
          id: t.id,
          label: t.name,
          sublabel: `${t.import_count} imports`,
          icon: <span className="text-sm">{t.icon || '⚡'}</span>,
        })),
      });
    }
  }

  // Add template modal
  const [showAddModal, setShowAddModal] = useState(false);

  // Bulk upload
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !session) return;

    setBulkUploading(true);
    setBulkProgress({ current: 0, total: files.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBulkProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        const content = await file.text();
        const workflow = JSON.parse(content);
        const name = workflow.name || file.name.replace(/\.json$/i, '');

        const res = await fetch('/api/n8n-templates', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, description: null, category: null, icon: '⚡', workflow_json: workflow }),
        });

        if (res.ok) successCount++;
        else failedCount++;
      } catch {
        failedCount++;
      }

      setBulkProgress(prev => ({ ...prev, success: successCount, failed: failedCount }));
    }

    setBulkUploading(false);
    setToast({
      type: failedCount === 0 ? 'success' : 'error',
      message: failedCount === 0
        ? `Successfully uploaded ${successCount} templates`
        : `Uploaded ${successCount}, failed ${failedCount}`,
    });
    setTimeout(() => setToast(null), 4000);
    fetchTemplates();

    if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
  };

  const showSkeleton = loading && templates.length === 0;

  const headerTitle = selectedTemplate ? selectedTemplate.name : 'Templates';
  const headerSublabel = selectedTemplate?.category || null;

  return (
    <TemplatesContext.Provider value={{ templates, loading, refetch: fetchTemplates, showAddModal, setShowAddModal }}>
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
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SecondaryPanel
            sections={sections}
            selectedId={selectedId}
            onSelect={handleSelect}
            searchPlaceholder="Search templates..."
            action={
              <div className="space-y-2">
                {clientEmails.length > 0 && (
                  <SearchableSelect
                    value={clientFilter}
                    onChange={setClientFilter}
                    options={[{ value: 'all', label: 'All Clients' }, ...clientEmails.map(e => ({ value: e, label: e }))]}
                  />
                )}
                <div className="flex gap-2">
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept=".json"
                    multiple
                    onChange={handleBulkUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New
                  </button>
                  <button
                    onClick={() => bulkFileInputRef.current?.click()}
                    disabled={bulkUploading}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {bulkUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {bulkUploading ? `${bulkProgress.current}/${bulkProgress.total}` : 'Bulk'}
                  </button>
                </div>
              </div>
            }
          />
        )}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header bar — breadcrumb */}
        <div className="flex-shrink-0 border-b border-gray-800 px-6 h-[64px] flex items-center">
          <div className="flex items-center gap-3 min-w-0">
            {selectedTemplate && (
              <button
                onClick={() => router.push('/portal/templates')}
                className="text-sm text-white/40 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                Templates
              </button>
            )}
            {selectedTemplate && (
              <span className="text-white/20 shrink-0">/</span>
            )}
            <h1 className="text-lg font-semibold text-white truncate">{headerTitle}</h1>
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
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-900/90 text-green-400 border border-green-800' : 'bg-red-900/90 text-red-400 border border-red-800'
        }`}>
          {toast.message}
        </div>
      )}
    </>
    </TemplatesContext.Provider>
  );
}
