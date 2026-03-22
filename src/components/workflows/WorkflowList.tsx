'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  Key,
  Plus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Loader2,
  Unlink,
  RefreshCw,
  Settings,
  MousePointer,
  MessageSquare,
  FileText,
  ArrowUpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CredentialIcon from '@/components/credentials/CredentialIcon';
import { hasConfigurableParams } from '@/lib/n8n/credentialNodeParams';

// Shared interfaces
export interface WorkflowCredential {
  type: string;
  name: string;
  connected?: boolean; // Optional - portal/page.tsx pre-computes this
}

export interface WorkflowWidget {
  id: string;
  name: string;
  type?: 'button' | 'form' | 'chatbot'; // portal/page.tsx format
  widget_type?: 'button' | 'form' | 'chatbot'; // database format
  form_fields?: any[];
  workflow_id?: string; // For filtering linked widgets
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  webhookUrl?: string;
  instanceId: string;
  instanceName: string;
  instanceUrl?: string; // For direct n8n workflow link
  clientEmail?: string;
  credentials?: WorkflowCredential[];
  requiredCredentials?: WorkflowCredential[];
  widgets?: WorkflowWidget[];
}

export interface ConnectedCredential {
  id?: string;
  type: string;
  name: string;
}

export interface WorkflowTemplateUpdate {
  importId: string;
  workflowId: string;
  workflowName: string;
  templateId: string;
  templateName: string;
  installedVersion: number;
  latestVersion: number;
  changelog: string | null;
  instanceId?: string; // Added for portal/page.tsx multi-instance support
}

export interface WorkflowListProps {
  workflows: Workflow[];
  // Connected credentials for the instance (portal/[id] passes this)
  // If not provided, uses workflow.credentials with connected flag
  connectedCredentials?: ConnectedCredential[];
  // Widgets for the instance (portal/[id] passes this separately)
  // If not provided, uses workflow.widgets
  widgets?: WorkflowWidget[];
  // Show instance name on each workflow
  showInstance?: boolean;
  // State tracking
  expandedWorkflows: Set<string>;
  togglingWorkflow: string | null;
  deletingWorkflow: string | null;
  // Callbacks
  onToggleExpand: (workflowKey: string) => void;
  onToggleWorkflow: (workflowId: string, instanceId: string, currentActive: boolean) => void;
  onDeleteWorkflow: (workflowId: string, instanceId: string) => void;
  onAddComponent?: (workflow: Workflow) => void;
  onAddCredential?: (credentialType: string, instanceId: string) => void;
  onConfigureCredential?: (credentialType: string, workflow: Workflow, userCredential?: ConnectedCredential) => void;
  onWidgetClick?: (widget: WorkflowWidget, workflow: Workflow) => void;
  onUnlinkWidget?: (widgetId: string, instanceId: string) => void;
  // Template updates - Map keyed by workflowId (or instanceId:workflowId for multi-instance)
  templateUpdates?: Map<string, WorkflowTemplateUpdate>;
  onUpdateTemplate?: (update: WorkflowTemplateUpdate) => void;
  // For portal/page.tsx linking to portal/[id]
  linkToPortal?: boolean;
  // Show direct n8n link button
  showN8nLink?: boolean;
  // Function to get instance URL by ID
  getInstanceUrl?: (instanceId: string) => string | null;
  // Session for API calls
  accessToken?: string;
  // Open missing credentials modal for a workflow
  onOpenMissingCredentials?: (workflow: Workflow) => void;
}

export default function WorkflowList({
  workflows,
  connectedCredentials,
  widgets: instanceWidgets,
  showInstance = false,
  expandedWorkflows,
  togglingWorkflow,
  deletingWorkflow,
  templateUpdates,
  onToggleExpand,
  onToggleWorkflow,
  onDeleteWorkflow,
  onAddComponent,
  onAddCredential,
  onConfigureCredential,
  onWidgetClick,
  onUnlinkWidget,
  onUpdateTemplate,
  linkToPortal = false,
  showN8nLink = false,
  getInstanceUrl,
  onOpenMissingCredentials,
}: WorkflowListProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  // State for credential selection dropdown (key = workflowKey:credType)
  const [credDropdownOpen, setCredDropdownOpen] = useState<string | null>(null);
  const [credDropdownPosition, setCredDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  // Loading state for adding credentials (key = workflowKey:credType)
  const [loadingCredential, setLoadingCredential] = useState<string | null>(null);

  // Get user's connected credential types
  const userCredTypes = new Set(connectedCredentials?.map(c => c.type) || []);

  // Get ALL credentials of a given type (for multiple credentials)
  const getCredentialsOfType = (type: string): ConnectedCredential[] => {
    return connectedCredentials?.filter(c => c.type === type) || [];
  };

  // Get linked widgets for a workflow
  const getLinkedWidgets = (workflow: Workflow): WorkflowWidget[] => {
    // If workflow already has widgets array from API, use it
    if (workflow.widgets && workflow.widgets.length > 0) {
      return workflow.widgets;
    }
    // Otherwise, filter from instance widgets
    if (instanceWidgets) {
      return instanceWidgets.filter(w => w.workflow_id && String(w.workflow_id) === String(workflow.id));
    }
    return [];
  };

  // Get workflow key (includes instanceId for portal/page.tsx)
  const getWorkflowKey = (workflow: Workflow) => {
    return showInstance ? `${workflow.instanceId}:${workflow.id}` : workflow.id;
  };

  // Compute credential status
  const getCredentialStatus = (workflow: Workflow) => {
    // Get all required credentials - check credentials first (has connected status from API)
    // then fall back to requiredCredentials for portal/[id] which uses that field
    const allRequiredCreds = workflow.credentials || workflow.requiredCredentials || [];

    // Filter out internal types (but keep flowEngineApi so users can configure it)
    const filteredCreds = allRequiredCreds.filter(
      c => c.type !== 'none'
    );

    if (filteredCreds.length === 0) {
      return { connected: [], missing: [], all: [] };
    }

    // If we have connectedCredentials prop (portal/[id] style)
    if (connectedCredentials && connectedCredentials.length > 0) {
      // FlowEngine LLM is always available via environment variables
      const connected = filteredCreds.filter(c => c.type === 'flowEngineApi' || userCredTypes.has(c.type));
      const missing = filteredCreds.filter(c => c.type !== 'flowEngineApi' && !userCredTypes.has(c.type));
      return { connected, missing, all: filteredCreds };
    }

    // Otherwise use pre-computed connected flag (portal/page.tsx style)
    const connected = filteredCreds.filter(c => c.connected);
    const missing = filteredCreds.filter(c => !c.connected);
    return { connected, missing, all: filteredCreds };
  };

  // Get widget type (handles both formats)
  const getWidgetType = (widget: WorkflowWidget) => {
    return widget.widget_type || widget.type || 'form';
  };

  return (
    <div className="space-y-4">
      {workflows.map((workflow, index) => {
        const workflowKey = getWorkflowKey(workflow);
        const isExpanded = expandedWorkflows.has(workflowKey);
        const linkedWidgets = getLinkedWidgets(workflow);
        const { connected: connectedCreds, missing: missingCreds, all: allCreds } = getCredentialStatus(workflow);

        return (
          <motion.div
            key={workflowKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="border border-gray-800/50 rounded-xl hover:border-purple-500/30 transition-all"
          >
            {/* Workflow Header */}
            <div
              className="p-3 sm:p-4 bg-gray-800/20 flex items-center justify-between cursor-pointer gap-2"
              onClick={() => onToggleExpand(workflowKey)}
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                {/* Expand/Collapse Chevron */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(workflowKey);
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
                        {linkedWidgets.length > 0 && (
                          <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-xs text-purple-400">
                            <MousePointer className="h-3 w-3" />
                            <span>{linkedWidgets.length}</span>
                          </div>
                        )}
                        {missingCreds.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenMissingCredentials?.(workflow);
                            }}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400 hover:bg-red-900/30 hover:border-red-700/50 transition-colors"
                            title="Click to add missing credentials"
                          >
                            <Key className="h-3 w-3" />
                            <span>{missingCreds.length}</span>
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
                    {linkedWidgets.length > 0 && isExpanded && (
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
                {/* Template Update Button */}
                {templateUpdates?.has(workflowKey) && onUpdateTemplate && (
                  <button
                    onClick={() => {
                      const update = templateUpdates.get(workflowKey);
                      if (update) onUpdateTemplate(update);
                    }}
                    className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 text-sm text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg transition-all"
                    title={`Update available: v${templateUpdates.get(workflowKey)?.installedVersion} → v${templateUpdates.get(workflowKey)?.latestVersion}`}
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Update</span>
                  </button>
                )}
                {/* n8n Direct Link Button - Agency only */}
                {showN8nLink && (() => {
                  const instanceUrl = workflow.instanceUrl || getInstanceUrl?.(workflow.instanceId);
                  if (!instanceUrl) return null;
                  const n8nWorkflowUrl = `${instanceUrl.replace(/\/$/, '')}/workflow/${workflow.id}`;
                  return (
                    <a
                      href={n8nWorkflowUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-orange-400 bg-gray-800/50 hover:bg-orange-500/10 border border-gray-700 hover:border-orange-500/30 rounded-lg transition-all"
                      title="Open in n8n"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg
                        fill="currentColor"
                        fillRule="evenodd"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                      >
                        <title>n8n</title>
                        <path d="M24 8.4c0 1.325-1.102 2.4-2.462 2.4-1.146 0-2.11-.765-2.384-1.8h-3.436c-.602 0-1.115.424-1.214 1.003l-.101.592a2.38 2.38 0 01-.8 1.405c.412.354.704.844.8 1.405l.1.592A1.222 1.222 0 0015.719 15h.975c.273-1.035 1.237-1.8 2.384-1.8 1.36 0 2.461 1.075 2.461 2.4S20.436 18 19.078 18c-1.147 0-2.11-.765-2.384-1.8h-.975c-1.204 0-2.23-.848-2.428-2.005l-.101-.592a1.222 1.222 0 00-1.214-1.003H10.97c-.308.984-1.246 1.7-2.356 1.7-1.11 0-2.048-.716-2.355-1.7H4.817c-.308.984-1.246 1.7-2.355 1.7C1.102 14.3 0 13.225 0 11.9s1.102-2.4 2.462-2.4c1.183 0 2.172.815 2.408 1.9h1.337c.236-1.085 1.225-1.9 2.408-1.9 1.184 0 2.172.815 2.408 1.9h.952c.601 0 1.115-.424 1.213-1.003l.102-.592c.198-1.157 1.225-2.005 2.428-2.005h3.436c.274-1.035 1.238-1.8 2.384-1.8C22.898 6 24 7.075 24 8.4zm-1.23 0c0 .663-.552 1.2-1.232 1.2-.68 0-1.23-.537-1.23-1.2 0-.663.55-1.2 1.23-1.2.68 0 1.231.537 1.231 1.2zM2.461 13.1c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm6.153 0c.68 0 1.231-.537 1.231-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm10.462 3.7c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.23.537-1.23 1.2 0 .663.55 1.2 1.23 1.2z" />
                      </svg>
                    </a>
                  );
                })()}
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
                <button
                  onClick={() => onToggleWorkflow(workflow.id, workflow.instanceId, workflow.active)}
                  disabled={togglingWorkflow === workflowKey}
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
                    {togglingWorkflow === workflowKey && (
                      <RefreshCw className="h-3 w-3 text-gray-500 animate-spin" />
                    )}
                  </div>
                </button>
                {/* 3-dot menu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      if (menuOpen === workflowKey) {
                        setMenuOpen(null);
                        setMenuPosition(null);
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPosition({
                          top: rect.bottom + 4,
                          left: rect.right - 140,
                        });
                        setMenuOpen(workflowKey);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuOpen === workflowKey && menuPosition && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                          setMenuOpen(null);
                          setMenuPosition(null);
                        }}
                      />
                      <div
                        className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]"
                        style={{ top: menuPosition.top, left: menuPosition.left }}
                      >
                        <button
                          onClick={() => {
                            setMenuOpen(null);
                            setMenuPosition(null);
                            onDeleteWorkflow(workflow.id, workflow.instanceId);
                          }}
                          disabled={deletingWorkflow === workflowKey}
                          className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-800 flex items-center gap-2 disabled:opacity-50"
                        >
                          {deletingWorkflow === workflowKey ? (
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
                  {/* Credentials Tags - Show connected (green) and missing (red) */}
                  {allCreds.length > 0 && (
                    <div className="px-4 pt-3 pb-3">
                      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                        {connectedCreds.map((cred) => {
                          const canConfigure = hasConfigurableParams(cred.type);
                          const allCredsOfType = getCredentialsOfType(cred.type);
                          const hasMultiple = allCredsOfType.length > 1;
                          const userCred = allCredsOfType[0]; // Default to first one
                          const dropdownKey = `${workflowKey}:${cred.type}`;

                          if (canConfigure && onConfigureCredential) {
                            return (
                              <div key={cred.type} className="relative">
                                <button
                                  onClick={(e) => {
                                    if (hasMultiple) {
                                      // Show dropdown to select credential
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setCredDropdownPosition({ top: rect.bottom + 4, left: rect.left });
                                      setCredDropdownOpen(dropdownKey);
                                    } else {
                                      onConfigureCredential(cred.type, workflow, userCred);
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-800/50 rounded text-xs text-green-400 hover:bg-green-900/30 hover:border-green-700/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                  title={hasMultiple ? `${cred.name} - ${allCredsOfType.length} accounts available` : `${cred.name} - Click to configure`}
                                >
                                  <CredentialIcon type={cred.type.replace(/Api$|OAuth2Api$/i, '').toLowerCase()} fallback="none" className="h-3 w-3" />
                                  <span>{cred.name}</span>
                                  {hasMultiple && (
                                    <span className="ml-0.5 px-1 py-0 bg-green-700/50 rounded text-[10px] font-medium">{allCredsOfType.length}</span>
                                  )}
                                  <Settings className="h-3 w-3 opacity-60" />
                                </button>
                                {/* Dropdown for multiple credentials */}
                                {credDropdownOpen === dropdownKey && credDropdownPosition && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => { setCredDropdownOpen(null); setCredDropdownPosition(null); }}
                                    />
                                    <div
                                      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[200px]"
                                      style={{ top: credDropdownPosition.top, left: credDropdownPosition.left }}
                                    >
                                      <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-800">Select account</div>
                                      {allCredsOfType.map((c) => (
                                        <button
                                          key={c.id || c.name}
                                          onClick={() => {
                                            setCredDropdownOpen(null);
                                            setCredDropdownPosition(null);
                                            onConfigureCredential(cred.type, workflow, c);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-800 flex items-center gap-2"
                                        >
                                          <CredentialIcon type={cred.type.replace(/Api$|OAuth2Api$/i, '').toLowerCase()} fallback="none" className="h-4 w-4 text-green-400" />
                                          <span className="truncate">{c.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={cred.type}
                              className="flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-800/50 rounded text-xs text-green-400 whitespace-nowrap shrink-0"
                              title={hasMultiple ? `${cred.name} - ${allCredsOfType.length} accounts` : `${cred.name} - Connected`}
                            >
                              <CredentialIcon type={cred.type.replace(/Api$|OAuth2Api$/i, '').toLowerCase()} fallback="none" className="h-3 w-3" />
                              <span>{cred.name}</span>
                              {hasMultiple && (
                                <span className="ml-0.5 px-1 py-0 bg-green-700/50 rounded text-[10px] font-medium">{allCredsOfType.length}</span>
                              )}
                            </div>
                          );
                        })}
                        {missingCreds.map((cred) => {
                          const credKey = `${workflowKey}:${cred.type}`;
                          const isLoading = loadingCredential === credKey;
                          return (
                            <button
                              key={cred.type}
                              onClick={() => {
                                setLoadingCredential(credKey);
                                onAddCredential?.(cred.type, workflow.instanceId);
                                setTimeout(() => setLoadingCredential(null), 500);
                              }}
                              disabled={isLoading}
                              className="flex items-center gap-1 px-2 py-1 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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

                  {/* Template Update Section with Changelog */}
                  {templateUpdates?.has(workflowKey) && (() => {
                    const update = templateUpdates.get(workflowKey);
                    if (!update) return null;
                    return (
                      <div className="px-4 py-3">
                        <div className="p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <ArrowUpCircle className="h-4 w-4 text-green-400" />
                              <span className="text-sm text-green-400 font-medium">
                                Update Available: v{update.installedVersion} → v{update.latestVersion}
                              </span>
                            </div>
                            {onUpdateTemplate && (
                              <button
                                onClick={() => onUpdateTemplate(update)}
                                className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-lg text-xs font-medium transition-colors"
                              >
                                Update Now
                              </button>
                            )}
                          </div>
                          {update.changelog && (
                            <div className="mt-2 pt-2 border-t border-green-800/30">
                              <p className="text-xs text-gray-400 mb-1">What's new:</p>
                              <p className="text-xs text-gray-300 whitespace-pre-wrap">{update.changelog}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Component Gallery */}
                  {linkedWidgets.length > 0 && (
                    <div className="p-4 bg-gray-900/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {linkedWidgets.map((widget) => {
                          const widgetType = getWidgetType(widget);
                          const widgetContent = (
                            <>
                              <div className="flex items-start justify-between mb-3">
                                <div className={cn(
                                  'w-9 h-9 rounded-lg flex items-center justify-center',
                                  widgetType === 'button'
                                    ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20'
                                    : widgetType === 'chatbot'
                                    ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20'
                                    : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20'
                                )}>
                                  {widgetType === 'button' ? (
                                    <MousePointer className="h-4 w-4 text-blue-400" />
                                  ) : widgetType === 'chatbot' ? (
                                    <MessageSquare className="h-4 w-4 text-purple-400" />
                                  ) : (
                                    <FileText className="h-4 w-4 text-emerald-400" />
                                  )}
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                              </div>
                              <p className="text-white font-medium text-sm mb-1 group-hover:text-purple-400 transition-colors">{widget.name}</p>
                              <p className="text-gray-500 text-xs">
                                {widgetType === 'button' ? 'Button' : widgetType === 'chatbot' ? 'Chatbot' : 'Form'}
                                {widgetType === 'form' && widget.form_fields && widget.form_fields.length > 0 && ` · ${widget.form_fields.length} fields`}
                              </p>
                            </>
                          );

                          return (
                            <div
                              key={widget.id}
                              className="group relative p-4 bg-gray-800/30 border border-gray-700/50 hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl text-left transition-all"
                            >
                              {linkToPortal ? (
                                <Link
                                  href={`/portal/${workflow.instanceId}?tab=widgets&widget=${widget.id}`}
                                  className="block"
                                >
                                  {widgetContent}
                                </Link>
                              ) : (
                                <button
                                  onClick={() => onWidgetClick?.(widget, workflow)}
                                  className="w-full text-left"
                                >
                                  {widgetContent}
                                </button>
                              )}
                              {/* Unlink button */}
                              {onUnlinkWidget && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
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
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Empty expanded state */}
                  {linkedWidgets.length === 0 && allCreds.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No components linked to this workflow
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
