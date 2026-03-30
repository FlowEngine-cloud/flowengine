'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { Search, Users, Server, FileText, Layers, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: 'client' | 'instance' | 'template' | 'embed';
  href: string;
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  client: 'Clients',
  instance: 'Instances',
  template: 'Templates',
  embed: 'Embeds',
};

const TYPE_ICONS: Record<SearchResult['type'], React.ComponentType<{ className?: string }>> = {
  client: Users,
  instance: Server,
  template: FileText,
  embed: Layers,
};

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all searchable data when modal opens
  const loadData = useCallback(async () => {
    if (!session?.access_token || allData.length > 0) return;
    setLoading(true);
    try {
      const [clientsRes, templatesRes, widgetsRes] = await Promise.allSettled([
        fetch('/api/client/instances', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch('/api/n8n-templates', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch('/api/widget-studio/templates', { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ]);

      const items: SearchResult[] = [];

      // Clients & instances
      if (clientsRes.status === 'fulfilled' && clientsRes.value.ok) {
        const data = await clientsRes.value.json();
        const seenClients = new Set<string>();
        const seenInstances = new Set<string>();
        for (const inst of (data.instances || [])) {
          if (inst.client_email && !seenClients.has(inst.user_id || inst.client_email)) {
            seenClients.add(inst.user_id || inst.client_email);
            items.push({ id: inst.user_id || inst.client_email, label: inst.client_email, type: 'client', href: `/portal/clients/${inst.user_id || inst.client_email}` });
          }
          if (inst.instance_id && !seenInstances.has(inst.instance_id)) {
            seenInstances.add(inst.instance_id);
            items.push({ id: inst.instance_id, label: inst.instance_name || inst.instance_id, sublabel: inst.client_email, type: 'instance', href: `/portal?instance=${inst.instance_id}` });
          }
        }
      }

      // Templates
      if (templatesRes.status === 'fulfilled' && templatesRes.value.ok) {
        const data = await templatesRes.value.json();
        for (const t of (data.templates || [])) {
          items.push({ id: t.id, label: t.name, sublabel: t.category || undefined, type: 'template', href: `/portal/templates/${t.id}` });
        }
      }

      // Embeds
      if (widgetsRes.status === 'fulfilled' && widgetsRes.value.ok) {
        const data = await widgetsRes.value.json();
        for (const w of (data.templates || [])) {
          items.push({ id: w.id, label: w.name, sublabel: w.widget_type, type: 'embed', href: `/portal/ui-studio` });
        }
      }

      setAllData(items);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [session?.access_token, allData.length]);

  useEffect(() => {
    if (open) {
      loadData();
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open, loadData]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    setResults(allData.filter(r => r.label.toLowerCase().includes(q) || r.sublabel?.toLowerCase().includes(q)).slice(0, 20));
  }, [query, allData]);

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  // Group results by type
  const grouped = Object.entries(TYPE_LABELS).map(([type, label]) => ({
    type: type as SearchResult['type'],
    label,
    items: results.filter(r => r.type === type),
  })).filter(g => g.items.length > 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/80 p-4" onClick={onClose}>
      <div
        className="bg-gray-900/95 border border-gray-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-800">
          <Search className="w-5 h-5 text-white/40 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients, instances, templates, embeds..."
            className="flex-1 bg-transparent text-white placeholder:text-white/30 outline-none text-base"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-white/40 hover:text-white/70">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {loading && (
            <p className="px-4 py-6 text-center text-sm text-white/40">Loading...</p>
          )}
          {!loading && query && grouped.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-white/40">No results for &ldquo;{query}&rdquo;</p>
          )}
          {!loading && !query && (
            <p className="px-4 py-6 text-center text-sm text-white/30">Type to search across all your data</p>
          )}
          {grouped.map(group => {
            const Icon = TYPE_ICONS[group.type];
            return (
              <div key={group.type} className="mb-3">
                <div className="mx-3 px-3 py-1.5 mt-2 mb-1 rounded-lg bg-gray-800/30 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-white/50" />
                  <span className="text-sm font-semibold text-white/60 uppercase tracking-wider">{group.label}</span>
                  <span className="text-sm text-white/30 ml-auto">{group.items.length}</span>
                </div>
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-800/30 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{item.label}</div>
                      {item.sublabel && <div className="text-sm text-white/40 truncate">{item.sublabel}</div>}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-800/50 flex items-center gap-3">
          <span className="text-xs text-white/20">Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}
