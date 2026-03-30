'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, ChevronRight, X, Server, Users, FileText, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export interface SecondaryPanelItem {
  id: string;
  label: string;
  sublabel?: string;
  status?: 'active' | 'inactive' | 'error' | 'connecting' | 'external' | 'loading' | 'warning';
  icon?: React.ReactNode;
}

export interface SecondaryPanelSection {
  title: string;
  icon?: React.ReactNode;
  items: SecondaryPanelItem[];
  onTitleClick?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

interface SecondaryPanelProps {
  sections: SecondaryPanelSection[];
  selectedId?: string;
  onSelect: (id: string) => void;
  searchPlaceholder?: string;
  /** Action button rendered below the search bar, above the item list */
  action?: React.ReactNode;
  /** Custom search component to replace the built-in global search */
  customSearch?: React.ReactNode;
}

interface GlobalResult {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  type: 'instance' | 'client' | 'template' | 'embed';
}

interface GlobalResults {
  instances: GlobalResult[];
  clients: GlobalResult[];
  templates: GlobalResult[];
  embeds: GlobalResult[];
}

function StatusDot({ status }: { status?: SecondaryPanelItem['status'] }) {
  if (!status) return null;
  if (status === 'loading' || status === 'connecting') {
    return <Loader2 className="w-3 h-3 text-gray-400 animate-spin flex-shrink-0" />;
  }
  const colors: Record<string, string> = {
    active: 'bg-green-400',
    inactive: 'bg-gray-500',
    error: 'bg-red-400',
    external: 'bg-gray-400',
    warning: 'bg-yellow-400',
  };
  return <div className={cn('w-2 h-2 rounded-full flex-shrink-0', colors[status] || 'bg-gray-500')} />;
}

const CATEGORY_LABELS: Record<string, string> = {
  instances: 'Hosting',
  clients: 'Clients',
  templates: 'Templates',
  embeds: 'UI Embeds',
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instances: Server,
  clients: Users,
  templates: FileText,
  embeds: Layers,
};

export default function SecondaryPanel({ sections, selectedId, onSelect, action, customSearch }: SecondaryPanelProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of sections) {
      if (s.collapsible && s.defaultCollapsed) initial[s.title] = true;
    }
    return initial;
  });
  const [globalResults, setGlobalResults] = useState<GlobalResults | null>(null);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setGlobalResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSearching(false); return; }

      const pattern = `%${q}%`;

      const [instRes, clientRes, tmplRes, embedRes] = await Promise.allSettled([
        supabase
          .from('pay_per_instance_deployments')
          .select('id, instance_name, instance_url')
          .or(`user_id.eq.${user.id},invited_by_user_id.eq.${user.id}`)
          .ilike('instance_name', pattern)
          .is('deleted_at', null)
          .limit(10),
        supabase
          .from('client_invites')
          .select('id, email, name, accepted_by')
          .eq('invited_by', user.id)
          .or(`email.ilike.${pattern},name.ilike.${pattern}`)
          .limit(10),
        supabase
          .from('workflow_templates')
          .select('id, name, category')
          .or(`team_id.eq.${user.id},created_by.eq.${user.id}`)
          .ilike('name', pattern)
          .limit(10),
        supabase
          .from('client_widgets')
          .select('id, name, widget_type')
          .or(`user_id.eq.${user.id},team_id.eq.${user.id}`)
          .ilike('name', pattern)
          .limit(10),
      ]);

      const results: GlobalResults = {
        instances: instRes.status === 'fulfilled' && instRes.value.data
          ? instRes.value.data.map((i: { id: string; instance_name: string; instance_url?: string }) => ({
              id: i.id, label: i.instance_name, sublabel: i.instance_url?.replace('https://', ''),
              href: `/portal/hosting/${i.id}`, type: 'instance' as const,
            }))
          : [],
        clients: clientRes.status === 'fulfilled' && clientRes.value.data
          ? clientRes.value.data.map((c: { id: string; email: string; name?: string; accepted_by?: string }) => ({
              id: c.accepted_by || c.id, label: c.name || c.email, sublabel: c.name ? c.email : undefined,
              href: c.accepted_by ? `/portal/clients/${c.accepted_by}` : '/portal/clients',
              type: 'client' as const,
            }))
          : [],
        templates: tmplRes.status === 'fulfilled' && tmplRes.value.data
          ? tmplRes.value.data.map((t: { id: string; name: string; category?: string }) => ({
              id: t.id, label: t.name, sublabel: t.category,
              href: `/portal/templates/${t.id}`, type: 'template' as const,
            }))
          : [],
        embeds: embedRes.status === 'fulfilled' && embedRes.value.data
          ? embedRes.value.data.map((e: { id: string; name: string; widget_type?: string }) => ({
              id: e.id, label: e.name, sublabel: e.widget_type,
              href: `/portal/ui-studio`, type: 'embed' as const,
            }))
          : [],
      };

      setGlobalResults(results);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [search]);

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const filteredSections = sections.filter((section) => section.items.length > 0);

  const isSearching = search.trim().length > 0;
  const totalResults = globalResults
    ? globalResults.instances.length + globalResults.clients.length + globalResults.templates.length + globalResults.embeds.length
    : 0;

  return (
    <div className="w-[280px] flex-shrink-0 h-full bg-black border-r border-gray-800 flex flex-col">
      {/* Top bar — h-[64px] aligns with content header border */}
      {customSearch ? (
        <div className="flex-shrink-0 h-[64px] border-b border-gray-800 px-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {customSearch}
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 h-[64px] border-b border-gray-800 px-3 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            {searching ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search everything..."
              className="w-full pl-9 pr-7 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-base text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none"
            />
            {isSearching && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action button — below search, above list (hidden while searching) */}
      {action && !isSearching && (
        <div className="flex-shrink-0 px-3 pt-3 relative z-10">
          {action}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-4">
        {isSearching && !customSearch ? (
          /* Global search results */
          searching ? (
            <div className="px-3 py-8 text-center text-base text-gray-400">Searching...</div>
          ) : globalResults ? (
            <>
              {(['instances', 'clients', 'templates', 'embeds'] as const).map((type) => {
                const items = globalResults[type];
                if (items.length === 0) return null;
                const Icon = CATEGORY_ICONS[type];
                return (
                  <div key={type} className="mb-3">
                    <div className="mx-1 px-2 py-1.5 mt-2 mb-1 rounded-lg bg-gray-800/30 flex items-center gap-2">
                      {Icon && <Icon className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm font-semibold text-white/60 uppercase tracking-wider">{CATEGORY_LABELS[type]}</span>
                      <span className="text-sm text-gray-500 ml-auto">{items.length}</span>
                    </div>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setSearch(''); router.push(item.href); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer text-white/60 hover:bg-gray-800/30 hover:text-white"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-medium truncate">{item.label}</div>
                          {item.sublabel && <div className="text-sm text-gray-400 truncate">{item.sublabel}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
              {totalResults === 0 && (
                <div className="px-3 py-8 text-center text-base text-gray-400">No results found</div>
              )}
            </>
          ) : null
        ) : (
          /* Normal panel sections */
          <>
            {filteredSections.map((section) => {
              const isCollapsed = section.collapsible ? !!collapsedSections[section.title] : false;
              const titleInteractive = section.collapsible || section.onTitleClick;
              return (
                <div key={section.title || `section-${section.items[0]?.id}`} className="mb-4">
                  {section.title && (titleInteractive ? (
                    <button
                      onClick={() => section.collapsible ? toggleSection(section.title) : section.onTitleClick?.()}
                      className="w-full px-3 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5 hover:text-white/80 transition-colors cursor-pointer text-left"
                    >
                      {section.collapsible && (
                        <ChevronRight className={cn('w-3 h-3 transition-transform flex-shrink-0', !isCollapsed && 'rotate-90')} />
                      )}
                      {section.icon && <span className="flex-shrink-0 opacity-60">{section.icon}</span>}
                      {section.title}
                      <span className="text-xs text-gray-500 font-normal">{section.items.length}</span>
                    </button>
                  ) : (
                    <div className="px-3 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                      {section.icon && <span className="flex-shrink-0 opacity-60">{section.icon}</span>}
                      {section.title}
                      <span className="text-xs text-gray-500 font-normal">{section.items.length}</span>
                    </div>
                  ))}
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {(() => {
                        const rendered: React.ReactNode[] = [];
                        let i = 0;
                        while (i < section.items.length) {
                          const item = section.items[i];
                          const isSubItem = !item.icon && item.id.includes('#');

                          if (isSubItem) {
                            // Collect consecutive sub-items into a group
                            const subItems: typeof section.items = [];
                            while (i < section.items.length && !section.items[i].icon && section.items[i].id.includes('#')) {
                              subItems.push(section.items[i]);
                              i++;
                            }
                            rendered.push(
                              <nav key={`sub-${subItems[0].id}`} className="flex flex-col gap-0.5 ml-4 mt-1 mb-2 pl-3 border-l border-gray-800">
                                {subItems.map((sub) => (
                                  <button
                                    key={sub.id}
                                    onClick={() => onSelect(sub.id)}
                                    className="px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-gray-800/30 rounded-lg transition-colors cursor-pointer text-left"
                                  >
                                    {sub.label}
                                  </button>
                                ))}
                              </nav>
                            );
                          } else {
                            rendered.push(
                              <button
                                key={item.id}
                                onClick={() => onSelect(item.id)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors cursor-pointer',
                                  selectedId === item.id
                                    ? 'bg-gray-800/30 text-white'
                                    : 'text-white/60 hover:bg-gray-800/30 hover:text-white'
                                )}
                              >
                                {item.icon && <div className="flex-shrink-0 w-5 h-5 text-white/60">{item.icon}</div>}
                                <div className="flex-1 min-w-0">
                                  <div className="text-base font-medium truncate">{item.label}</div>
                                  {item.sublabel && <div className="text-sm text-white/60 truncate mt-0.5">{item.sublabel}</div>}
                                </div>
                                <StatusDot status={item.status} />
                              </button>
                            );
                            i++;
                          }
                        }
                        return rendered;
                      })()}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="px-3 py-8 text-center text-base text-white/60">
                No items
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
