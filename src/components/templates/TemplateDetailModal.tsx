'use client';

/**
 * TemplateDetailModal Component
 * Shows template details with credential status and import button
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Zap, Loader2, ChevronDown, History } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import CredentialIcon from '@/components/credentials/CredentialIcon';

interface CredentialOption {
  id: string;
  name: string;
}

interface CredentialStatus {
  type: string;
  name: string;
  icon: string;
  status: 'available' | 'missing';
  docUrl?: string;
  existingCredentialId?: string;
  existingCredentialName?: string;
  availableCredentials?: CredentialOption[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  required_credentials: CredentialStatus[];
  can_import: boolean;
  // Optional fields from extended template types
  agency_name?: string;
  import_count?: number;
  created_at?: string;
  updated_at?: string;
  version?: number;
  changelog?: string | null;
}

interface TemplateDetailModalProps {
  template: Template | null;
  isOpen: boolean;
  onClose: () => void;
  onImport: (template: Template, credentialSelections?: Record<string, string>) => Promise<void>;
  isImporting?: boolean;
}

export default function TemplateDetailModal({
  template,
  isOpen,
  onClose,
  onImport,
  isImporting = false,
}: TemplateDetailModalProps) {
  // Track credential selections when multiple options exist
  const [credentialSelections, setCredentialSelections] = useState<Record<string, string>>({});
  // Track version history expansion
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Close on ESC key
  useEscapeKey(isOpen, onClose);

  // Initialize selections when template changes
  useEffect(() => {
    if (template) {
      const initialSelections: Record<string, string> = {};
      template.required_credentials.forEach(cred => {
        if (cred.existingCredentialId) {
          initialSelections[cred.type] = cred.existingCredentialId;
        }
      });
      setCredentialSelections(initialSelections);
    }
  }, [template]);

  if (!template) return null;

  const missingCredentials = template.required_credentials.filter(c => c.status === 'missing');
  const availableCredentials = template.required_credentials.filter(c => c.status === 'available');

  const handleCredentialSelect = (credType: string, credId: string) => {
    setCredentialSelections(prev => ({ ...prev, [credType]: credId }));
  };

  const handleImport = async () => {
    await onImport(template, credentialSelections);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gray-800/50 border border-gray-700 flex items-center justify-center text-3xl">
                  {template.icon || '⚡'}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{template.name}</h2>
                  {template.category && (
                    <span className="text-sm text-gray-500">{template.category}</span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Description */}
              {template.description && (
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                  <p className="text-gray-300 text-sm leading-relaxed">{template.description}</p>
                </div>
              )}

              {/* Version Info */}
              {template.version && (
                <div>
                  <button
                    onClick={() => setShowVersionHistory(!showVersionHistory)}
                    className="flex items-center justify-between w-full p-3 rounded-lg bg-gray-800/30 border border-gray-700 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-white">Version {template.version}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showVersionHistory ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showVersionHistory && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 p-3 bg-gray-800/20 border border-gray-700/50 rounded-lg">
                          {template.changelog ? (
                            <>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-gray-500">Changelog:</p>
                                {(template.updated_at || template.created_at) && (
                                  <p className="text-xs text-gray-500">{new Date(template.updated_at || template.created_at!).toLocaleDateString()}</p>
                                )}
                              </div>
                              <p className="text-sm text-gray-400 whitespace-pre-wrap">{template.changelog}</p>
                            </>
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-500 italic">Initial version - no changelog available</p>
                              {template.created_at && (
                                <p className="text-xs text-gray-500">{new Date(template.created_at).toLocaleDateString()}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Required Integrations */}
              {template.required_credentials.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Required Integrations</h3>
                  <div className="space-y-2">
                    {/* Available Credentials */}
                    {availableCredentials.map((cred) => (
                      <div
                        key={cred.type}
                        className="flex items-center justify-between p-3 rounded-lg bg-green-900/20 border border-green-800/50"
                      >
                        <div className="flex items-center gap-3">
                          <CredentialIcon type={cred.icon} fallback="none" className="w-5 h-5 text-green-400" />
                          <span className="text-white">{cred.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Show dropdown if multiple credentials available */}
                          {cred.availableCredentials && cred.availableCredentials.length > 1 ? (
                            <select
                              value={credentialSelections[cred.type] || cred.existingCredentialId}
                              onChange={(e) => handleCredentialSelect(cred.type, e.target.value)}
                              className="bg-green-900/30 border border-green-800 rounded px-2 py-1 text-xs text-green-300 focus:outline-none focus:ring-1 focus:ring-green-500"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {cred.availableCredentials.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5 text-green-400" />
                              <span className="text-xs text-green-400">Connected</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Missing Credentials */}
                    {missingCredentials.map((cred) => (
                      <div
                        key={cred.type}
                        className="flex items-center justify-between p-3 rounded-lg bg-red-900/20 border border-red-800/50"
                      >
                        <div className="flex items-center gap-3">
                          <CredentialIcon type={cred.icon} fallback="none" className="w-5 h-5 text-red-400" />
                          <span className="text-white">{cred.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-red-400">Missing</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No credentials needed */}
              {template.required_credentials.length === 0 && (
                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                  <p className="text-sm text-gray-400 text-center">
                    This workflow doesn&apos;t require any external credentials.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-800 space-y-3">
              {missingCredentials.length > 0 && (
                <p className="text-xs text-gray-400 text-center">
                  You can add missing credentials in the Workflows section after importing
                </p>
              )}
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Import Workflow
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
