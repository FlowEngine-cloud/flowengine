'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, ExternalLink, Zap, MousePointer, FileText, MessageSquare, Code2, Braces, Globe, QrCode, Unlink, Power, ChevronDown, Link, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { WidgetInlinePreview } from '@/components/widgets/WidgetInlinePreview';

// =============================================================================
// Types
// =============================================================================

interface Widget {
  id: string;
  name: string;
  widget_type: 'button' | 'form' | 'chatbot';
  webhook_url?: string | null;
  form_fields?: any[];
  chatbot_config?: Record<string, any>;
  is_active: boolean;
  workflow_id?: string | number | null;
  workflow_name?: string | null;
  instance_id?: string | null;
  instance?: { id: string; instance_name: string } | null;
  styles?: Record<string, any> | null;
}

interface WidgetPreviewModalProps {
  isOpen: boolean;
  widget: Widget | null;
  onClose: () => void;
  onToggleStatus?: (widgetId: string, isActive: boolean) => Promise<void>;
  onLinkWorkflow?: (widget: Widget) => void;
  onUnlinkWorkflow?: (widgetId: string) => Promise<void>;
  onAssignToClient?: (widgetId: string) => void;
  onRemoveFromClient?: (widgetId: string) => Promise<void>;
  showAssignToClient?: boolean;
  showRemoveFromClient?: boolean;
  isProcessing?: boolean;
  // For the UI Embeds page: assign to a specific instance
  instances?: Array<{ id: string; instance_name: string }>;
  onAssignToInstance?: (widgetId: string, instanceId: string) => Promise<void>;
  onDuplicate?: (widgetId: string) => Promise<void>;
  onDelete?: (widgetId: string) => Promise<void>;
}

// =============================================================================
// Main Component
// =============================================================================

export default function WidgetPreviewModal({
  isOpen,
  widget,
  onClose,
  onToggleStatus,
  onLinkWorkflow,
  onUnlinkWorkflow,
  onAssignToClient,
  onRemoveFromClient,
  showAssignToClient = false,
  showRemoveFromClient = false,
  isProcessing = false,
  instances,
  onAssignToInstance,
  onDuplicate,
  onDelete,
}: WidgetPreviewModalProps) {
  useEscapeKey(isOpen, onClose);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [expandedShare, setExpandedShare] = useState<string | null>(null);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [assigningInstance, setAssigningInstance] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen || !widget) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const widgetLink = `${origin}/w/${widget.id}`;
  const iframeCode = `<iframe src="${widgetLink}" style="border:none;width:100%;height:600px;" allow="clipboard-write"></iframe>`;
  const jsCode = `<div id="fe-widget-${widget.id}"></div>\n<script src="${origin}/widget.js" data-id="${widget.id}"></script>`;
  const htmlLink = `<a href="${widgetLink}" target="_blank" rel="noopener noreferrer">${widget.name}</a>`;

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleToggleStatus = async () => {
    if (!onToggleStatus) return;
    setIsTogglingStatus(true);
    try {
      await onToggleStatus(widget.id, !widget.is_active);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleAssignToInstance = async (instanceId: string) => {
    if (!onAssignToInstance) return;
    setAssigningInstance(instanceId);
    try {
      await onAssignToInstance(widget.id, instanceId);
      setShowAssignPicker(false);
    } finally {
      setAssigningInstance(null);
    }
  };

  const toggleShare = (key: string) => setExpandedShare(prev => prev === key ? null : key);

  const typeConfig = {
    button: { icon: MousePointer, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    form: { icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    chatbot: { icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  };
  const config = typeConfig[widget.widget_type] || typeConfig.button;
  const TypeIcon = config.icon;

  const currentInstance = widget.instance || (
    instances && widget.instance_id
      ? instances.find(i => i.id === widget.instance_id) || null
      : null
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex items-center justify-center"
            onClick={onClose}
          >
            <div
              className="w-full h-full max-w-5xl bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-gray-800 bg-black/40">
                <div className="flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
                    <TypeIcon className={cn('h-[18px] w-[18px]', config.color)} />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-base leading-tight">{widget.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 capitalize">{widget.widget_type}</span>
                      {widget.workflow_id && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <Zap className="h-2.5 w-2.5" />
                            {widget.workflow_name || 'Linked'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body: preview + sidebar */}
              <div className="flex-1 overflow-hidden flex">
                {/* Inline preview — renders widget components directly (no iframe) */}
                <div className="flex-1 overflow-hidden">
                  <WidgetInlinePreview widget={widget} />
                </div>

                {/* Right sidebar */}
                <div className="w-72 flex-shrink-0 border-l border-gray-800 flex flex-col overflow-y-auto bg-black/20">

                  {/* Component Status */}
                  {onToggleStatus && (
                    <div className="p-4 border-b border-gray-800">
                      <div className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Power className={cn('h-4 w-4', widget.is_active ? 'text-green-400' : 'text-gray-500')} />
                          <span className="text-sm text-gray-300">Component Status</span>
                        </div>
                        <button
                          onClick={handleToggleStatus}
                          disabled={isTogglingStatus || isProcessing}
                          className={cn(
                            'relative w-11 h-6 rounded-full transition-colors',
                            widget.is_active ? 'bg-green-500' : 'bg-gray-600',
                            (isTogglingStatus || isProcessing) && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <span className={cn(
                            'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                            widget.is_active ? 'left-6' : 'left-1'
                          )} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Share */}
                  <div className="border-b border-gray-800">
                    <p className="px-4 pt-4 pb-2 text-xs text-gray-500 font-medium uppercase tracking-wide">Share</p>

                    {/* Direct Link — always expanded */}
                    <div className="px-4 pb-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Link className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs text-white">Direct Link</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-400 truncate">
                          {widgetLink}
                        </span>
                        <button
                          onClick={() => copyToClipboard(widgetLink, 'link')}
                          className={cn('px-2 py-1.5 rounded text-xs transition-all', copiedField === 'link' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')}
                        >
                          {copiedField === 'link' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>

                    {/* iFrame Embed — expandable */}
                    <div>
                      <button
                        onClick={() => toggleShare('iframe')}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Code2 className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-xs text-white">iFrame Embed</span>
                        </div>
                        <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 transition-transform', expandedShare === 'iframe' && 'rotate-180')} />
                      </button>
                      {expandedShare === 'iframe' && (
                        <div className="px-4 pb-3">
                          <div className="flex gap-1.5">
                            <pre className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                              {iframeCode}
                            </pre>
                            <button
                              onClick={() => copyToClipboard(iframeCode, 'iframe')}
                              className={cn('px-2 py-1.5 rounded text-xs transition-all self-start', copiedField === 'iframe' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')}
                            >
                              {copiedField === 'iframe' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* JavaScript — expandable */}
                    <div>
                      <button
                        onClick={() => toggleShare('js')}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Braces className="h-3.5 w-3.5 text-yellow-400" />
                          <span className="text-xs text-white">JavaScript</span>
                        </div>
                        <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 transition-transform', expandedShare === 'js' && 'rotate-180')} />
                      </button>
                      {expandedShare === 'js' && (
                        <div className="px-4 pb-3">
                          <div className="flex gap-1.5">
                            <pre className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                              {jsCode}
                            </pre>
                            <button
                              onClick={() => copyToClipboard(jsCode, 'js')}
                              className={cn('px-2 py-1.5 rounded text-xs transition-all self-start', copiedField === 'js' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')}
                            >
                              {copiedField === 'js' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* HTML Link — expandable */}
                    <div>
                      <button
                        onClick={() => toggleShare('html')}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-xs text-white">HTML Link</span>
                        </div>
                        <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 transition-transform', expandedShare === 'html' && 'rotate-180')} />
                      </button>
                      {expandedShare === 'html' && (
                        <div className="px-4 pb-3">
                          <div className="flex gap-1.5">
                            <pre className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                              {htmlLink}
                            </pre>
                            <button
                              onClick={() => copyToClipboard(htmlLink, 'html')}
                              className={cn('px-2 py-1.5 rounded text-xs transition-all self-start', copiedField === 'html' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')}
                            >
                              {copiedField === 'html' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* QR Code — expandable */}
                    <div className="mb-1">
                      <button
                        onClick={() => toggleShare('qr')}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <QrCode className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs text-white">QR Code</span>
                        </div>
                        <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 transition-transform', expandedShare === 'qr' && 'rotate-180')} />
                      </button>
                      {expandedShare === 'qr' && (
                        <div className="px-4 pb-3">
                          <button
                            onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(widgetLink)}`, '_blank')}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-all"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open QR Code
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assign to Instance (instance picker) */}
                  {instances && onAssignToInstance && (
                    <div className="p-4 border-b border-gray-800">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Assigned Instance</p>
                      {currentInstance ? (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-purple-400 font-medium truncate">{currentInstance.instance_name}</span>
                          <button
                            onClick={() => setShowAssignPicker(!showAssignPicker)}
                            className="text-xs text-gray-500 hover:text-white ml-2 flex-shrink-0"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAssignPicker(!showAssignPicker)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-gray-700 hover:border-purple-500/50 hover:bg-purple-500/5 text-gray-400 hover:text-purple-400 rounded-lg text-xs font-medium transition-all"
                        >
                          Assign to Instance
                        </button>
                      )}
                      {showAssignPicker && (
                        <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden">
                          {instances.length === 0 ? (
                            <p className="px-3 py-2.5 text-xs text-gray-500">No instances available</p>
                          ) : (
                            instances.map(inst => (
                              <button
                                key={inst.id}
                                onClick={() => handleAssignToInstance(inst.id)}
                                disabled={assigningInstance === inst.id}
                                className={cn(
                                  'w-full px-3 py-2.5 text-left text-xs transition-all border-b border-gray-800 last:border-0',
                                  widget.instance_id === inst.id || currentInstance?.id === inst.id
                                    ? 'text-purple-400 bg-purple-500/10'
                                    : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                                  assigningInstance === inst.id && 'opacity-50'
                                )}
                              >
                                {assigningInstance === inst.id ? 'Assigning…' : inst.instance_name}
                                {(widget.instance_id === inst.id || currentInstance?.id === inst.id) && ' ✓'}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Legacy assign to client button */}
                  {showAssignToClient && onAssignToClient && !instances && (
                    <div className="p-4 border-b border-gray-800">
                      <button
                        onClick={() => onAssignToClient(widget.id)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-gray-700 hover:border-purple-500/50 hover:bg-purple-500/5 text-gray-400 hover:text-purple-400 rounded-lg text-xs font-medium transition-all"
                      >
                        Assign to Client
                      </button>
                    </div>
                  )}

                  {/* Edit in Studio */}
                  <div className="p-4 border-b border-gray-800">
                    <a
                      href={`/portal/ui-studio/editor?widget=${widget.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/[0.03] border border-purple-500/30 hover:bg-purple-500/10 text-purple-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Edit in Studio
                    </a>
                  </div>

                  {/* Unlink Workflow */}
                  {widget.workflow_id && onUnlinkWorkflow && (
                    <div className="p-4 border-b border-gray-800">
                      <button
                        onClick={() => onUnlinkWorkflow(widget.id)}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                      >
                        <Unlink className="h-4 w-4" />
                        Unlink Workflow
                      </button>
                    </div>
                  )}

                  {/* Remove from client */}
                  {showRemoveFromClient && onRemoveFromClient && (
                    <div className="p-4 border-b border-gray-800">
                      <button
                        onClick={() => onRemoveFromClient(widget.id)}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        Remove from Client
                      </button>
                    </div>
                  )}

                  {/* Duplicate */}
                  {onDuplicate && (
                    <div className="p-4 border-b border-gray-800">
                      <button
                        onClick={async () => {
                          setIsDuplicating(true);
                          try { await onDuplicate(widget.id); } finally { setIsDuplicating(false); }
                        }}
                        disabled={isDuplicating || isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 hover:text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                      >
                        {isDuplicating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                        {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                      </button>
                    </div>
                  )}

                  {/* Delete */}
                  {onDelete && (
                    <div className="p-4 border-b border-gray-800">
                      {showDeleteConfirm ? (
                        <div className="space-y-2">
                          <p className="text-sm text-white/60 text-center">Delete this component?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowDeleteConfirm(false)}
                              className="flex-1 px-3 py-2 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={async () => {
                                setIsDeleting(true);
                                try { await onDelete(widget.id); } finally { setIsDeleting(false); setShowDeleteConfirm(false); }
                              }}
                              disabled={isDeleting}
                              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-lg text-sm font-medium transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Component
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
