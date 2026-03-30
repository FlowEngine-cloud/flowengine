'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowUpCircle,
  CheckCircle,
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface NodeDetail {
  name: string;
  type: string;
  hasCredentials: boolean;
  hasParameters: boolean;
  parameterCount: number;
}

interface NodeChangeDetail {
  nodeName: string;
  oldType?: string;
  newType?: string;
  changeType: 'removed' | 'type_changed';
}

interface TemplateUpdatePreview {
  preserved: string[];
  needsConfig: string[];
  warnings: string[];
  currentNodeCount?: number;
  newNodeCount?: number;
  // New detailed info
  preservedNodes?: NodeDetail[];
  addedNodes?: NodeDetail[];
  changedNodes?: NodeChangeDetail[];
}

interface UpdateDetails {
  workflowName?: string | null;
  templateName?: string;
}

interface TemplateUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  importId: string;
  workflowId: string;
  workflowName: string;
  templateName: string;
  installedVersion: number;
  latestVersion: number;
  changelog?: string | null;
  instanceId: string;
  accessToken: string;
  onUpdateComplete?: () => void;
}

export default function TemplateUpdateModal({
  isOpen,
  onClose,
  importId,
  workflowId: _workflowId,
  workflowName,
  templateName,
  installedVersion,
  latestVersion,
  changelog,
  instanceId: _instanceId,
  accessToken,
  onUpdateComplete,
}: TemplateUpdateModalProps) {
  // Close on ESC key
  useEscapeKey(isOpen, onClose);

  const [preview, setPreview] = useState<TemplateUpdatePreview | null>(null);
  const [updateDetails, setUpdateDetails] = useState<UpdateDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch preview when modal opens
  useEffect(() => {
    if (isOpen && importId) {
      fetchPreview();
    }
  }, [isOpen, importId]);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/client/template-updates/${importId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch update details');
        return;
      }

      if (data.preview) {
        setPreview(data.preview);
      }
      // Store workflow name and template name from API
      setUpdateDetails({
        workflowName: data.workflowName,
        templateName: data.templateName,
      });
    } catch (e) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setError(null);

    try {
      const res = await fetch(`/api/client/template-updates/${importId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific error codes
        if (data.code === 'WORKFLOW_NOT_FOUND') {
          setError('This workflow was deleted from n8n. Please re-import the template to get the latest version.');
        } else if (data.message) {
          setError(data.message);
        } else {
          setError(data.error || 'Failed to update workflow');
        }
        return;
      }

      setSuccess(true);

      // Call callback after short delay for UI feedback
      setTimeout(() => {
        onUpdateComplete?.();
        onClose();
      }, 1500);
    } catch (e) {
      setError('Failed to connect to server');
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  // Helper to format node type for display
  const formatNodeType = (type: string) => {
    // Remove 'n8n-nodes-base.' prefix if present
    return type.replace(/^n8n-nodes-base\./, '');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <ArrowUpCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Template Update Available</h3>
                <p className="text-sm text-gray-400">
                  v{installedVersion} → v{latestVersion}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Workflow & Template Names */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 space-y-2">
              <div>
                <p className="text-sm text-gray-400">Your Workflow</p>
                <p className="text-white font-medium">
                  {/* Prefer API data (fresh) over props data (may be stale) */}
                  {updateDetails?.workflowName || workflowName || templateName}
                </p>
              </div>
              {templateName && templateName !== workflowName && (
                <div className="pt-2 border-t border-gray-700">
                  <p className="text-sm text-gray-400">From Template</p>
                  <p className="text-white/80 text-sm">{templateName}</p>
                </div>
              )}
            </div>

            {/* Changelog */}
            {changelog && (
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                <p className="text-sm text-gray-400 mb-1">What's New</p>
                <p className="text-white text-sm whitespace-pre-wrap">{changelog}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
              </div>
            )}

            {/* Preview */}
            {preview && !loading && (
              <div className="space-y-3">
                {/* Preserved Nodes */}
                {preview.preservedNodes && preview.preservedNodes.length > 0 && (
                  <div className="bg-green-900/20 border border-green-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <p className="text-sm font-medium text-green-400">
                        Configuration Preserved ({preview.preservedNodes.length})
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {preview.preservedNodes.slice(0, 6).map((node, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-2 py-1.5 bg-green-900/30 border border-green-800/50 rounded text-green-300"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{node.name}</p>
                            <p className="text-xs text-green-400/60 truncate">{formatNodeType(node.type)}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            {node.hasCredentials && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-900/40 border border-green-800/60 rounded text-green-300">
                                Creds
                              </span>
                            )}
                            {node.hasParameters && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-900/40 border border-green-800/60 rounded text-green-300">
                                {node.parameterCount} params
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {preview.preservedNodes.length > 6 && (
                        <p className="text-xs text-green-400 text-center pt-1">
                          +{preview.preservedNodes.length - 6} more nodes preserved
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* New Nodes Added */}
                {preview.addedNodes && preview.addedNodes.length > 0 && (
                  <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Plus className="h-4 w-4 text-gray-400" />
                      <p className="text-sm font-medium text-gray-400">
                        Nodes Added ({preview.addedNodes.length})
                      </p>
                    </div>
                    <p className="text-xs text-white/60 mb-2">
                      These new nodes were added in this template version
                    </p>
                    <div className="space-y-1.5">
                      {preview.addedNodes.map((node, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-2 py-1.5 bg-gray-800/30 border border-gray-700 rounded text-white/60"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{node.name}</p>
                            <p className="text-xs text-gray-400/60 truncate">{formatNodeType(node.type)}</p>
                          </div>
                          {(node.hasCredentials || node.parameterCount > 0) && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-800/30 border border-gray-700 rounded text-white/60 ml-2 flex-shrink-0">
                              Needs config
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Changed/Removed Nodes */}
                {preview.changedNodes && preview.changedNodes.length > 0 && (
                  <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-yellow-400" />
                      <p className="text-sm font-medium text-yellow-400">
                        Nodes Removed or Changed ({preview.changedNodes.length})
                      </p>
                    </div>
                    <p className="text-xs text-yellow-300/70 mb-2">
                      These nodes were removed or had their type changed - configuration cannot be preserved
                    </p>
                    <div className="space-y-1.5">
                      {preview.changedNodes.map((change, i) => (
                        <div
                          key={i}
                          className="px-2 py-1.5 bg-yellow-900/30 border border-yellow-900/50 rounded"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-yellow-300 truncate">{change.nodeName}</p>
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-900/40 border border-yellow-900/60 rounded text-yellow-300 ml-2 flex-shrink-0">
                              {change.changeType === 'removed' ? 'Deleted' : 'Type Changed'}
                            </span>
                          </div>
                          {change.changeType === 'removed' ? (
                            <p className="text-xs text-yellow-400/60 mt-0.5 truncate">
                              {formatNodeType(change.oldType || '')} → Removed
                            </p>
                          ) : (
                            <p className="text-xs text-yellow-400/60 mt-0.5 truncate">
                              {formatNodeType(change.oldType || '')} → {formatNodeType(change.newType || '')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 text-center">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">Update Complete!</p>
                <p className="text-xs text-green-300/70 mt-1">
                  Your workflow has been updated to v{latestVersion}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {!success && (
            <div className="flex gap-3 p-4 border-t border-gray-800">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
                disabled={updating}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={loading || updating || !!error}
                className={cn(
                  'flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                  loading || updating || error
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-gray-100'
                )}
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Update Workflow
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
