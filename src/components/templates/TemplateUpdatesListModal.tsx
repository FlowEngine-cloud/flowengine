'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowUpCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface TemplateUpdate {
  importId: string;
  workflowId: string;
  workflowName: string;
  templateId: string;
  templateName: string;
  installedVersion: number;
  latestVersion: number;
  changelog: string | null;
  updatedAt?: string;
}

interface UpdateStatus {
  importId: string;
  status: 'pending' | 'updating' | 'success' | 'error';
  error?: string;
}

interface TemplateUpdatesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  updates: TemplateUpdate[];
  accessToken: string;
  onUpdateComplete?: () => void;
}

export default function TemplateUpdatesListModal({
  isOpen,
  onClose,
  updates,
  accessToken,
  onUpdateComplete,
}: TemplateUpdatesListModalProps) {
  const [updateStatuses, setUpdateStatuses] = useState<Map<string, UpdateStatus>>(new Map());
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  const handleUpdateSingle = async (update: TemplateUpdate) => {
    setUpdateStatuses(prev => {
      const next = new Map(prev);
      next.set(update.importId, { importId: update.importId, status: 'updating' });
      return next;
    });

    try {
      const res = await fetch(`/api/client/template-updates/${update.importId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setUpdateStatuses(prev => {
          const next = new Map(prev);
          next.set(update.importId, {
            importId: update.importId,
            status: 'error',
            error: data.message || data.error || 'Update failed',
          });
          return next;
        });
        return false;
      }

      setUpdateStatuses(prev => {
        const next = new Map(prev);
        next.set(update.importId, { importId: update.importId, status: 'success' });
        return next;
      });
      return true;
    } catch (e) {
      setUpdateStatuses(prev => {
        const next = new Map(prev);
        next.set(update.importId, {
          importId: update.importId,
          status: 'error',
          error: 'Failed to connect to server',
        });
        return next;
      });
      return false;
    }
  };

  const handleUpdateAll = async () => {
    setIsUpdatingAll(true);

    // Update all pending ones sequentially
    for (const update of updates) {
      const status = updateStatuses.get(update.importId);
      if (!status || status.status === 'pending' || status.status === 'error') {
        await handleUpdateSingle(update);
      }
    }

    setIsUpdatingAll(false);

    // Check if all succeeded
    const allSucceeded = updates.every(u => {
      const status = updateStatuses.get(u.importId);
      return status?.status === 'success';
    });

    if (allSucceeded) {
      setTimeout(() => {
        onUpdateComplete?.();
        onClose();
      }, 1000);
    }
  };

  const handleClose = () => {
    // Check if any updates succeeded
    const anySucceeded = Array.from(updateStatuses.values()).some(s => s.status === 'success');
    if (anySucceeded) {
      onUpdateComplete?.();
    }
    onClose();
  };

  // Close on ESC key
  useEscapeKey(isOpen, handleClose);

  const getStatusIcon = (importId: string) => {
    const status = updateStatuses.get(importId);
    if (!status || status.status === 'pending') {
      return <ArrowUpCircle className="h-4 w-4 text-green-400" />;
    }
    if (status.status === 'updating') {
      return <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />;
    }
    if (status.status === 'success') {
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    }
    return <AlertCircle className="h-4 w-4 text-red-400" />;
  };

  const pendingCount = updates.filter(u => {
    const status = updateStatuses.get(u.importId);
    return !status || status.status === 'pending' || status.status === 'error';
  }).length;

  const successCount = updates.filter(u => {
    const status = updateStatuses.get(u.importId);
    return status?.status === 'success';
  }).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        onClick={handleClose}
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
                <h3 className="text-lg font-semibold text-white">Available Updates</h3>
                <p className="text-sm text-gray-400">
                  {successCount > 0
                    ? `${successCount} of ${updates.length} updated`
                    : `${updates.length} workflow${updates.length === 1 ? '' : 's'} can be updated`}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(90vh-180px)]">
            {updates.map((update, index) => {
              const status = updateStatuses.get(update.importId);
              const isUpdating = status?.status === 'updating';
              const isSuccess = status?.status === 'success';
              const isError = status?.status === 'error';

              return (
                <div
                  key={update.importId}
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    isSuccess
                      ? 'bg-green-900/20 border-green-800'
                      : isError
                      ? 'bg-red-900/20 border-red-800'
                      : 'bg-gray-800/30 border-gray-700'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">{getStatusIcon(update.importId)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {update.workflowName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          v{update.installedVersion} → v{update.latestVersion}
                          {update.templateName !== update.workflowName && (
                            <span className="text-gray-500"> · from {update.templateName}</span>
                          )}
                        </p>
                        {update.changelog && (
                          <div className="mt-2 p-2 bg-gray-800/30 rounded border border-gray-700">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-xs font-medium text-gray-400">What's new:</span>
                              {update.updatedAt && (
                                <span className="text-xs text-gray-500">{new Date(update.updatedAt).toLocaleDateString()}</span>
                              )}
                            </div>
                            <span className="text-xs text-white/60 whitespace-pre-wrap">{update.changelog}</span>
                          </div>
                        )}
                        {isError && status?.error && (
                          <p className="text-xs text-red-400 mt-1">{status.error}</p>
                        )}
                      </div>
                    </div>
                    {!isSuccess && (
                      <button
                        onClick={() => handleUpdateSingle(update)}
                        disabled={isUpdating || isUpdatingAll}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                          isUpdating || isUpdatingAll
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400'
                        )}
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Updating
                          </>
                        ) : (
                          'Update'
                        )}
                      </button>
                    )}
                    {isSuccess && (
                      <span className="text-xs text-green-400 font-medium">Updated</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-4 border-t border-gray-800">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
              disabled={isUpdatingAll}
            >
              {successCount === updates.length ? 'Done' : 'Close'}
            </button>
            {pendingCount > 0 && (
              <button
                onClick={handleUpdateAll}
                disabled={isUpdatingAll}
                className={cn(
                  'flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                  isUpdatingAll
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-gray-100'
                )}
              >
                {isUpdatingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Update All ({pendingCount})
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
