'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/AuthContext';
import { usePortalRoleContext } from '@/app/portal/context';
import { useUIStudioContext } from './context';
import {
  Layers, Plus, Search, MousePointer, FileText, MessageCircle, ChevronRight,
  CheckSquare, HelpCircle, Palette, ExternalLink, X, Trash2, Check, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const typeConfig: Record<string, { icon: typeof MousePointer; color: string; bg: string; label: string }> = {
  button: { icon: MousePointer, color: 'text-white/60', bg: 'bg-gray-800/30', label: 'Button' },
  form: { icon: FileText, color: 'text-white/60', bg: 'bg-gray-800/30', label: 'Form' },
  chatbot: { icon: MessageCircle, color: 'text-white/60', bg: 'bg-gray-800/30', label: 'Chatbot' },
};

export default function PortalUIStudioPage() {
  const { session } = useAuth();
  const { role } = usePortalRoleContext();
  const { widgets, loading, refetch, openWidget } = useUIStudioContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstanceFilter, setSelectedInstanceFilter] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Get unique instances for filter pills
  const instances = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of widgets) {
      if (w.instance) {
        map.set(w.instance.id, w.instance.instance_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, instance_name: name }));
  }, [widgets]);

  // Filter widgets
  const filtered = widgets.filter(w => {
    if (selectedInstanceFilter && w.instance?.id !== selectedInstanceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        w.widget_type.toLowerCase().includes(q) ||
        w.instance?.instance_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map(w => w.id)));
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!session || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/widget-studio/templates/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        )
      );
      await refetch();
      setShowBulkDeleteConfirm(false);
      exitSelectMode();
    } catch {
      // silent
    } finally {
      setIsBulkDeleting(false);
    }
  };

  if (loading) return null; // Layout handles skeleton

  if (widgets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-900/50 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-white/40" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {role === 'client' ? 'No components available' : 'No components yet'}
          </h3>
          <p className="text-white/60 text-base mb-6 max-w-sm">
            {role === 'client'
              ? 'Your agency hasn\'t created any UI embeds yet.'
              : 'Create chatbots, forms, and buttons for your clients.'}
          </p>
          {role !== 'client' && (
            <Link
              href="/portal/ui-studio/editor?editor=new"
              className="px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors inline-block"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create Component
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-4">
        {/* Select Mode Bar */}
        {isSelectMode && (
          <div className="flex items-center justify-between gap-3 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-sm text-white font-medium">
                {selectedIds.size} selected
              </span>
              <button
                onClick={selectAll}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Select all
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-800 hover:border-red-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={exitSelectMode}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Instance Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedInstanceFilter(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                !selectedInstanceFilter
                  ? 'bg-white text-black'
                  : 'bg-gray-900/50 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              All
            </button>
            {instances.map((inst) => (
              <button
                key={inst.id}
                onClick={() => setSelectedInstanceFilter(inst.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedInstanceFilter === inst.id
                    ? 'bg-white text-black'
                    : 'bg-gray-900/50 text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {inst.instance_name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none"
              />
            </div>
            <button
              onClick={() => isSelectMode ? exitSelectMode() : setIsSelectMode(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm",
                isSelectMode
                  ? "bg-white text-black font-medium"
                  : "text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700"
              )}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Select</span>
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg transition-all text-sm"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </button>
          </div>
        </div>

        {/* Widget Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No components match your search</p>
            <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(widget => {
              const config = typeConfig[widget.widget_type] || typeConfig.button;
              const TypeIcon = config.icon;
              const isSelected = selectedIds.has(widget.id);
              return (
                <div
                  key={widget.id}
                  onClick={() => {
                    if (isSelectMode) {
                      toggleSelection(widget.id);
                    } else {
                      openWidget(widget.id);
                    }
                  }}
                  className={cn(
                    "group bg-gray-900/50 border rounded-xl p-5 text-left transition-all cursor-pointer",
                    isSelected
                      ? "border-white bg-gray-800/30"
                      : "border-gray-800 hover:border-gray-600"
                  )}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {isSelectMode && (
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5",
                          isSelected
                            ? "bg-white border-white"
                            : "border-gray-600 hover:border-gray-500"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-black" />}
                      </div>
                    )}
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', config.bg)}>
                      <TypeIcon className={cn('w-5 h-5', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate group-hover:text-white/90">
                        {widget.name}
                      </h3>
                      <span className="text-sm text-white/40">{config.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {!widget.is_active && (
                        <span className="px-2.5 py-0.5 text-xs rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 inline-flex items-center gap-1.5">
                          Draft
                        </span>
                      )}
                      {widget.instance && (
                        <span className="px-2.5 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 inline-flex items-center gap-1.5">
                          {widget.instance.instance_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">
                      {widget.created_at ? new Date(widget.created_at).toLocaleDateString() : ''}
                    </span>
                    {!isSelectMode && (
                      <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setShowBulkDeleteConfirm(false)}>
          <div
            className="w-full max-w-sm bg-gray-900/70 border border-gray-800 rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white text-center mb-2">
              Delete {selectedIds.size} Component{selectedIds.size !== 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-white/60 text-center mb-6">
              These components will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isBulkDeleting}
                className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setShowHelpModal(false)}>
          <div
            className="w-full max-w-lg bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-800/30 border border-gray-700 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium">How UI Studio Works</h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium mb-1">Create UI Embed Templates</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Build form or button UI embeds here with custom fields, colors, fonts, and styling.
                    These are reusable templates you can assign to multiple clients.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium mb-1">Link to Client Workflows</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Go to <span className="text-white font-medium">Client Panel</span> → select a client →
                    choose a workflow → assign your component template. The component will connect to that workflow&apos;s webhook.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium mb-1">Clients Use the Component</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    When clients submit the form or click the button, their data automatically flows
                    to the linked n8n workflow for processing.
                  </p>
                </div>
              </div>

              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Palette className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-white/60">
                      <span className="font-medium text-white">Pro tip:</span> Use the Style tab to customize
                      text sizes, colors, spacing, and more. You can create different themes for different clients!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-800 flex justify-between items-center">
              <Link
                href="/docs#ui-studio"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Full Docs
                <ExternalLink className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
