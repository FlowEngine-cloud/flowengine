'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  Plus,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Lock,
  HelpCircle,
  Settings,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifiedSkeleton } from '@/components/ui/skeletons';
import CredentialCard from '@/components/credentials/CredentialCard';
import CredentialIcon from '@/components/credentials/CredentialIcon';
import type { N8nCredential, WorkflowTemplate } from '../types';

interface MissingCredential {
  type: string;
  name: string;
  workflows: Array<{ id: string; name: string }>;
}

interface CredentialsTabProps {
  credentials: N8nCredential[];
  loading: boolean;
  refreshing?: boolean;
  warning?: string | null;
  missingCredentials?: MissingCredential[];
  templatesNeedingCredentials?: WorkflowTemplate[];
  agencyLogoUrl?: string | null;
  instanceUrl?: string; // Instance URL for workflow navigation
  hasApiKey?: boolean; // Whether API key is configured
  allowFullAccess?: boolean; // Whether user has permission to access instance directly
  hasWorkflows?: boolean; // Whether user has imported any workflows
  isClientOwned?: boolean; // Whether client owns/pays for their instance
  onRefresh: () => void;
  onAddCredential: (type?: string | null) => void;
  onDeleteCredential: (id: string, type: string) => Promise<void>;
  onNavigateToSettings?: () => void; // Navigate to settings tab
  onNavigateToTemplates?: () => void; // Navigate to templates tab
}

export default function CredentialsTab({
  credentials,
  loading,
  refreshing = false,
  warning,
  missingCredentials = [],
  templatesNeedingCredentials = [],
  agencyLogoUrl,
  instanceUrl,
  hasApiKey = true,
  allowFullAccess = false,
  hasWorkflows = true,
  isClientOwned = false,
  onRefresh,
  onAddCredential,
  onDeleteCredential,
  onNavigateToSettings,
  onNavigateToTemplates,
}: CredentialsTabProps) {
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);
  const [showWorkflowRequired, setShowWorkflowRequired] = useState(false);
  const [loadingCredentialType, setLoadingCredentialType] = useState<string | null>(null);

  // Wrapper to check for workflows before allowing credential add
  const handleAddCredential = (type?: string | null) => {
    if (!hasWorkflows) {
      setShowWorkflowRequired(true);
      setTimeout(() => setShowWorkflowRequired(false), 3000);
      return;
    }
    // Set loading state for the specific credential type
    setLoadingCredentialType(type || '__general__');
    onAddCredential(type);
    // Clear loading after a short delay (modal should be open by then)
    setTimeout(() => setLoadingCredentialType(null), 500);
  };

  // Show skeleton while loading - BEFORE showing any other state
  if (loading) {
    return <UnifiedSkeleton count={6} />;
  }

  // Show locked state when no API key is configured
  if (!hasApiKey) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {isClientOwned ? "n8n API Key Required" : "API Key Required"}
          </h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            To manage credentials, you need to add your API key first. This connects FlowEngine to your instance.
          </p>

          {/* Help Section */}
          <div className="mb-6">
            <button
              onClick={() => setShowApiKeyHelp(!showApiKeyHelp)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              {isClientOwned ? "How do I get my n8n API key?" : "How do I get my API key?"}
            </button>

            {showApiKeyHelp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-4 bg-gray-800/30 border border-gray-700 rounded-lg text-left max-w-lg mx-auto"
              >
                <ol className="text-sm text-white/60 space-y-2 list-decimal list-inside">
                  <li>Open your instance dashboard</li>
                  <li>Click on your profile icon in the bottom left</li>
                  <li>Select <span className="text-white font-medium">Settings</span></li>
                  <li>Navigate to <span className="text-white font-medium">API</span> section</li>
                  <li>Click <span className="text-white font-medium">Create an API key</span></li>
                  <li>Copy the generated key and paste it in FlowEngine settings</li>
                </ol>
                {/* Only show link if user has permission to access the instance */}
                {instanceUrl && allowFullAccess && (
                  <a
                    href={`${instanceUrl}/settings/api`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white/60 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {isClientOwned ? "Open n8n API Settings" : "Open API Settings"}
                  </a>
                )}
              </motion.div>
            )}
          </div>

          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
              <Settings className="h-4 w-4" />
              Go to Settings
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-white">Credentials</h2>
            <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-white text-black border border-white rounded-full">Beta</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Credentials that are not in use in your workflows will not appear here.
            <br />
            Some credentials might not be synced correctly. Please contact us if you have any error: <a href="mailto:hi@flowengie.cloud" className="text-gray-400 hover:text-white transition-colors">hi@flowengie.cloud</a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800/30 hover:bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-white/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', (loading || refreshing) && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={() => handleAddCredential(null)}
            disabled={loadingCredentialType === '__general__'}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-100 disabled:bg-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            {loadingCredentialType === '__general__' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Credential
          </button>
        </div>
      </div>

      {/* Workflow Required Warning */}
      <AnimatePresence>
        {showWorkflowRequired && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
                <p className="text-sm text-yellow-400">
                  Import a workflow first before adding credentials
                </p>
              </div>
              {onNavigateToTemplates && (
                <button
                  onClick={onNavigateToTemplates}
                  className="px-4 py-2 bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-800 rounded-lg text-sm text-yellow-400 font-medium transition-colors whitespace-nowrap"
                >
                  Go to Templates
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credentials API Warning */}
      {warning && (
        <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-yellow-400 mb-1">
                {isClientOwned ? "n8n Credentials Access Limited" : "Credentials Access Limited"}
              </h3>
              <p className="text-xs text-gray-400">{warning}</p>
              <p className="text-xs text-gray-500 mt-2">
                You can still add and manage credentials by clicking "Add Credential" above.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <>
          {/* Missing Credentials Section - Show loading skeleton while workflows are still loading */}
          {refreshing && missingCredentials.length === 0 ? (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Missing Credentials</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <UnifiedSkeleton count={3} />
              </div>
            </div>
          ) : missingCredentials.length > 0 ? (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Missing Credentials</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {missingCredentials.map((missing, index) => (
                  <div
                    key={missing.type}
                    className="h-full bg-gray-900/50 border border-red-900/30 rounded-xl p-4 hover:border-red-800/50 transition-colors flex flex-col"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-red-900/20 flex items-center justify-center shrink-0">
                          <CredentialIcon type={missing.type.replace(/Api$|OAuth2Api$/i, '').toLowerCase()} fallback="none" className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-medium truncate">{missing.name}</h4>
                          <p className="text-xs text-gray-500 truncate">
                            {missing.type.replace(/OAuth2Api$/i, '').replace(/Api$/i, '').replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-red-900/30 border border-red-800/50 rounded text-xs text-red-400 shrink-0">
                        Missing
                      </span>
                    </div>
                    {missing.workflows.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-800">
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                          {missing.workflows.slice(0, 4).map((wf) => (
                            <span
                              key={wf.id}
                              className="px-2 py-0.5 bg-red-900/20 border border-red-800/40 rounded text-[10px] text-red-400 whitespace-nowrap shrink-0"
                              title={wf.name}
                            >
                              {wf.name.length > 20 ? wf.name.slice(0, 20) + '...' : wf.name}
                            </span>
                          ))}
                          {missing.workflows.length > 4 && (
                            <span className="px-2 py-0.5 text-[10px] text-gray-500 whitespace-nowrap shrink-0">
                              +{missing.workflows.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => handleAddCredential(missing.type)}
                      disabled={loadingCredentialType === missing.type}
                      className="w-full mt-3 px-3 py-2 bg-white text-black hover:bg-gray-100 disabled:bg-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {loadingCredentialType === missing.type ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Add Credential
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Templates Needing Credentials Section (optional, used by client-dashboard) */}
          {templatesNeedingCredentials.length > 0 && (
            <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
                <h3 className="text-sm font-medium text-yellow-400">Templates needing credentials</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {templatesNeedingCredentials.map((template) => {
                  const missingCreds = template.required_credentials.filter(c => c.status === 'missing');
                  return (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg shrink-0">{template.icon || '⚡'}</span>
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{template.name}</p>
                          <p className="text-xs text-gray-500">{missingCreds.length} credential{missingCreds.length !== 1 ? 's' : ''} needed</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        {missingCreds.slice(0, 3).map((cred) => (
                          <button
                            key={cred.type}
                            onClick={() => handleAddCredential(cred.type)}
                            disabled={loadingCredentialType === cred.type}
                            className="w-7 h-7 rounded-lg bg-red-900/30 border border-red-800/50 flex items-center justify-center hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                            title={`Add ${cred.name}`}
                          >
                            {loadingCredentialType === cred.type ? (
                              <Loader2 className="h-3.5 w-3.5 text-red-400 animate-spin" />
                            ) : (
                              <CredentialIcon type={cred.icon} fallback="none" className="h-3.5 w-3.5 text-red-400" />
                            )}
                          </button>
                        ))}
                        {missingCreds.length > 3 && (
                          <span className="text-xs text-gray-500 self-center ml-1">+{missingCreds.length - 3}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Existing Credentials */}
          {credentials.length > 0 && (
            <>
              {missingCredentials.length > 0 && (
                <h3 className="text-lg font-semibold text-white mb-4">Your Credentials</h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {credentials.map((credential, index) => (
                  <div key={credential.id} className="h-full">
                    <CredentialCard
                      credential={credential}
                      onDelete={onDeleteCredential}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Empty State */}
          {credentials.length === 0 && !warning && missingCredentials.length === 0 && (
            <div className="bg-gray-900/50 border border-dashed border-gray-800 rounded-2xl p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-800/30 flex items-center justify-center mx-auto mb-4">
                <Key className="h-8 w-8 text-gray-500" />
              </div>
              {hasWorkflows ? (
                <>
                  <h3 className="text-lg font-semibold text-white mb-2">No credentials yet</h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-6">
                    Add API keys and authentication to connect your integrations
                  </p>
                  <button
                    onClick={() => handleAddCredential(null)}
                    disabled={loadingCredentialType === '__general__'}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    {loadingCredentialType === '__general__' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add Your First Credential
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-white mb-2">Import a workflow first</h3>
                  <p className="text-gray-500 max-w-md mx-auto mb-6">
                    You need to import a workflow template before you can add credentials
                  </p>
                  {onNavigateToTemplates && (
                    <button
                      onClick={onNavigateToTemplates}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      Go to Templates
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Warning State (no credentials loaded due to API issue) */}
          {credentials.length === 0 && warning && missingCredentials.length === 0 && (
            <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-yellow-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Unable to Load Credentials</h3>
              <p className="text-yellow-400/80 max-w-md mx-auto">
                {warning}
              </p>
            </div>
          )}
      </>
    </motion.div>
  );
}
