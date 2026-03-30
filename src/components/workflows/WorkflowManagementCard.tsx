'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Key,
  MousePointer,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  MoreHorizontal,
  Trash2,
  Loader2,
  Unlink,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CredentialIcon from '@/components/credentials/CredentialIcon';

export interface WorkflowCredential {
  type: string;
  name: string;
  connected: boolean;
}

export interface WorkflowWidget {
  id: string;
  name: string;
  type: 'button' | 'form' | 'chatbot';
  form_fields?: any[];
}

export interface ManagedWorkflow {
  id: string;
  name: string;
  active: boolean;
  webhookUrl?: string;
  instanceId: string;
  instanceName: string;
  credentials?: WorkflowCredential[];
  widgets?: WorkflowWidget[];
}

export interface WorkflowManagementCardProps {
  workflow: ManagedWorkflow;
  index?: number;
  isExpanded?: boolean;
  showInstance?: boolean;
  isToggling?: boolean;
  isDeleting?: boolean;
  onToggleExpand?: () => void;
  onToggleActive?: (workflowId: string, instanceId: string, currentActive: boolean) => void;
  onAddComponent?: (workflow: ManagedWorkflow) => void;
  onAddCredential?: (credentialType: string, instanceId: string) => void;
  onConfigureCredential?: (credential: WorkflowCredential, workflow: ManagedWorkflow) => void;
  onEditWidget?: (widget: WorkflowWidget) => void;
  onUnlinkWidget?: (widgetId: string, instanceId: string) => void;
  onDeleteWorkflow?: (workflowId: string, instanceId: string) => void;
  hasConfigurableParams?: (credentialType: string) => boolean;
  onOpenMissingCredentials?: (workflow: ManagedWorkflow) => void;
}

export default function WorkflowManagementCard({
  workflow,
  index = 0,
  isExpanded = false,
  showInstance = false,
  isToggling = false,
  isDeleting = false,
  onToggleExpand,
  onToggleActive,
  onAddComponent,
  onAddCredential,
  onConfigureCredential,
  onEditWidget,
  onUnlinkWidget,
  onDeleteWorkflow,
  hasConfigurableParams,
  onOpenMissingCredentials,
}: WorkflowManagementCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [loadingCredential, setLoadingCredential] = useState<string | null>(null);

  const connectedCredentials = workflow.credentials?.filter(c => c.connected) || [];
  const missingCredentials = workflow.credentials?.filter(c => !c.connected) || [];
  const linkedWidgets = workflow.widgets || [];
  const hasCredentials = (workflow.credentials?.length || 0) > 0;
  const hasWidgets = linkedWidgets.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border border-gray-800/50 rounded-xl hover:border-purple-500/30 transition-all"
    >
      {/* Workflow Header */}
      <div
        className="p-3 sm:p-4 bg-gray-800/20 flex items-center justify-between cursor-pointer gap-2"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Expand/Collapse Chevron */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            className="p-1 -ml-1 rounded hover:bg-gray-700/50 transition-colors"
          >
            <ChevronDown className={cn(
              'h-4 w-4 text-gray-400 transition-transform',
              isExpanded ? '' : '-rotate-90'
            )} />
          </button>
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            workflow.active
              ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20'
              : 'bg-gray-700/50'
          )}>
            <Zap className={cn(
              'h-5 w-5',
              workflow.active ? 'text-green-400' : 'text-gray-500'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-medium truncate">{workflow.name}</p>
              {/* Collapsed state summary icons */}
              {!isExpanded && (
                <div className="flex items-center gap-1.5">
                  {hasWidgets && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-xs text-purple-400">
                      <MousePointer className="h-3 w-3" />
                      <span>{linkedWidgets.length}</span>
                    </div>
                  )}
                  {missingCredentials.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMissingCredentials?.(workflow);
                      }}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400 hover:bg-red-900/30 hover:border-red-700/50 transition-colors"
                      title="Click to add missing credentials"
                    >
                      <Key className="h-3 w-3" />
                      <span>{missingCredentials.length}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                'text-xs',
                workflow.active ? 'text-green-400' : 'text-gray-500'
              )}>
                {workflow.active ? 'Active' : 'Inactive'}
              </span>
              {showInstance && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-xs text-gray-500 truncate max-w-[150px]">{workflow.instanceName}</span>
                </>
              )}
              {hasWidgets && isExpanded && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-xs text-purple-400">{linkedWidgets.length} component{linkedWidgets.length > 1 ? 's' : ''}</span>
                </>
              )}
              {!workflow.webhookUrl && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-xs text-yellow-500">No webhook trigger</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3" onClick={(e) => e.stopPropagation()}>
          {onAddComponent && workflow.webhookUrl && (
            <button
              onClick={() => onAddComponent(workflow)}
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 text-sm text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-all"
              title="Add Component"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Component</span>
            </button>
          )}
          {onToggleActive && (
            <button
              onClick={() => onToggleActive(workflow.id, workflow.instanceId, workflow.active)}
              disabled={isToggling}
              className={cn(
                'relative w-12 h-7 rounded-full transition-all',
                workflow.active
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : 'bg-gray-700'
              )}
            >
              <div className={cn(
                'absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all flex items-center justify-center',
                workflow.active ? 'left-6' : 'left-1'
              )}>
                {isToggling && (
                  <RefreshCw className="h-3 w-3 text-gray-500 animate-spin" />
                )}
              </div>
            </button>
          )}
          {/* 3-dot menu */}
          {onDeleteWorkflow && (
            <div className="relative">
              <button
                onClick={(e) => {
                  if (menuOpen) {
                    setMenuOpen(false);
                    setMenuPosition(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuPosition({
                      top: rect.bottom + 4,
                      left: rect.right - 140,
                    });
                    setMenuOpen(true);
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen && menuPosition && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setMenuOpen(false);
                      setMenuPosition(null);
                    }}
                  />
                  <div
                    className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]"
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                  >
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setMenuPosition(null);
                        onDeleteWorkflow(workflow.id, workflow.instanceId);
                      }}
                      disabled={isDeleting}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-800 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Credentials Tags */}
            {hasCredentials && (
              <div className="px-4 pt-3 pb-0">
                <div className="flex gap-1.5 flex-wrap">
                  {connectedCredentials.map((cred) => {
                    const canConfigure = hasConfigurableParams?.(cred.type);

                    if (canConfigure && onConfigureCredential) {
                      return (
                        <button
                          key={cred.type}
                          onClick={() => onConfigureCredential(cred, workflow)}
                          className="flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-800/50 rounded text-xs text-green-400 hover:bg-green-900/30 hover:border-green-700/50 transition-colors whitespace-nowrap cursor-pointer"
                          title={`${cred.name} - Click to configure`}
                        >
                          <CredentialIcon type={cred.type.replace(/Api$|OAuth2Api$/i, '').toLowerCase()} fallback="none" className="h-3 w-3" />
                          <span>{cred.name}</span>
                          <Settings className="h-3 w-3 opacity-60" />
                        </button>
                      );
                    }

                    return (
                      <div
                        key={cred.type}
                        className="flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-800/50 rounded text-xs text-green-400 whitespace-nowrap"
                        title={`${cred.name} - Connected`}
                      >
                        <CredentialIcon type={cred.type.replace(/Api$|OAuth2Api$/i, '').toLowerCase()} fallback="none" className="h-3 w-3" />
                        <span>{cred.name}</span>
                      </div>
                    );
                  })}
                  {missingCredentials.map((cred) => {
                    const isLoading = loadingCredential === cred.type;
                    return (
                      <button
                        key={cred.type}
                        onClick={() => {
                          setLoadingCredential(cred.type);
                          onAddCredential?.(cred.type, workflow.instanceId);
                          setTimeout(() => setLoadingCredential(null), 500);
                        }}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                        title={`${cred.name} - Click to add`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CredentialIcon type={cred.type.replace(/Api$|OAuth2Api$/i, '').toLowerCase()} fallback="none" className="h-3 w-3" />
                        )}
                        <span>{cred.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Widget Gallery */}
            {hasWidgets && (
              <div className="p-4 bg-gray-900/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {linkedWidgets.map((widget) => (
                    <div
                      key={widget.id}
                      className="group relative p-4 bg-gray-800/30 border border-gray-700/50 hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl text-left transition-all"
                    >
                      <button
                        onClick={() => onEditWidget?.(widget)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center',
                            widget.type === 'button'
                              ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20'
                              : widget.type === 'chatbot'
                              ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20'
                              : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20'
                          )}>
                            {widget.type === 'button' ? (
                              <MousePointer className="h-4 w-4 text-blue-400" />
                            ) : widget.type === 'chatbot' ? (
                              <MessageSquare className="h-4 w-4 text-purple-400" />
                            ) : (
                              <FileText className="h-4 w-4 text-emerald-400" />
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-white font-medium text-sm mb-1 group-hover:text-purple-400 transition-colors">{widget.name}</p>
                        <p className="text-gray-500 text-xs">
                          {widget.type === 'button' ? 'Button' : widget.type === 'chatbot' ? 'Chatbot' : 'Form'}
                          {widget.type === 'form' && widget.form_fields && widget.form_fields.length > 0 && ` · ${widget.form_fields.length} fields`}
                        </p>
                      </button>
                      {/* Unlink button */}
                      {onUnlinkWidget && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Unlink this component from the workflow?')) {
                              onUnlinkWidget(widget.id, workflow.instanceId);
                            }
                          }}
                          title="Unlink from workflow"
                          className="absolute bottom-3 right-3 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty expanded state */}
            {!hasWidgets && missingCredentials.length === 0 && connectedCredentials.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                No components linked to this workflow
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
