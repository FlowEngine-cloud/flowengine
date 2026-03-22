'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, RefreshCw, Download, CheckCircle, XCircle, Plus, ArrowRight, Trash2 } from 'lucide-react';

interface Backup {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  backupType: 'manual' | 'scheduled';
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  fileExists: boolean;
}

interface BackupSectionProps {
  instanceId: string;
  accessToken: string;
  backupIntervalDays: number;
  onRestoreStart?: () => void;
  isExpanded?: boolean;
}

export function BackupSection({
  instanceId,
  accessToken,
  backupIntervalDays,
  onRestoreStart,
  isExpanded: initialExpanded = false,
}: BackupSectionProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  const fetchBackups = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/n8n/backup/list?instanceId=${instanceId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setBackups(data.backups || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setLoading(false);
    }
  }, [instanceId, accessToken]);

  useEffect(() => {
    if (isExpanded) {
      fetchBackups();
    }
  }, [isExpanded, fetchBackups]);

  const createBackup = async () => {
    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/n8n/backup/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instanceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Backup failed');
      }

      setSuccess('Backup created successfully!');
      setTimeout(() => setSuccess(null), 5000);
      fetchBackups();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backupId: string, fileName: string) => {
    const confirmed = window.confirm(
      `Restore from "${fileName}"?\n\nThis will replace your current database with the backup data. Your instance will restart after the restore. This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setRestoring(backupId);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/n8n/backup/restore', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instanceId, backupId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Restore failed');
      }

      // Set localStorage action block for restarting status (persists across page refresh)
      // Uses same pattern as n8n-account page for consistency
      const actionBlocks = JSON.parse(localStorage.getItem('n8n_action_blocks') || '{}');
      actionBlocks[instanceId] = {
        expiry: Date.now() + 120000, // 2 minutes for restart
        fakeStatus: 'restarting',
      };
      localStorage.setItem('n8n_action_blocks', JSON.stringify(actionBlocks));

      setSuccess('Database restored! Your instance is restarting... Page will refresh shortly.');

      // Notify parent about restore start (triggers restarting state)
      if (onRestoreStart) {
        onRestoreStart();
      }

      // Auto-refresh page after 2 seconds to show restarting state
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setRestoring(null);
    }
  };

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      setError(null);

      const response = await fetch('/api/n8n/backup/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instanceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start upgrade');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpgrading(false);
    }
  };

  const deleteBackup = async (backupId: string, fileName: string) => {
    const confirmed = window.confirm(
      `Delete backup "${fileName}"?\n\nThis will permanently remove this backup. This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(backupId);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/n8n/backup/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instanceId, backupId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      setSuccess('Backup deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      fetchBackups();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getNextBackupDate = () => {
    const lastBackup = backups.find(b => b.status === 'completed' && b.fileExists);
    if (!lastBackup) return null;

    const lastDate = new Date(lastBackup.createdAt);
    const nextDate = new Date(lastDate.getTime() + backupIntervalDays * 24 * 60 * 60 * 1000);
    return nextDate;
  };

  const getIntervalText = () => {
    if (backupIntervalDays === 1) return 'daily';
    if (backupIntervalDays === 7) return 'every 7 days';
    return `every ${backupIntervalDays} days`;
  };

  // Get last successful backup
  const lastBackup = backups.find(b => b.status === 'completed' && b.fileExists);
  const nextBackupDate = getNextBackupDate();
  const isDaily = backupIntervalDays === 1;

  // All completed backups - split into restorable (file exists) and expired (file deleted)
  const allCompletedBackups = backups.filter(b => b.status === 'completed');
  const restorableBackups = allCompletedBackups.filter(b => b.fileExists);

  return (
    <div className="border-t border-gray-700 pt-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors !cursor-pointer"
      >
        <div className="flex items-center gap-3 !cursor-pointer">
          <div className="p-2 bg-orange-900/30 rounded-lg !cursor-pointer">
            <Download className="w-5 h-5 text-orange-400 !cursor-pointer" />
          </div>
          <div className="text-left !cursor-pointer">
            <p className="text-orange-400 text-sm font-medium !cursor-pointer">Database Backups</p>
            <p className="text-white/50 text-xs !cursor-pointer">Automatic backups {getIntervalText()}</p>
          </div>
        </div>
        <ChevronDown className="w-5 h-5 text-gray-400 transition-transform !cursor-pointer" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Status Messages */}
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Backup Info & Actions */}
          <div className="bg-black/30 border border-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-sm font-medium">Backup Status</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchBackups();
                }}
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 disabled:opacity-50 transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading && !lastBackup ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Last Backup / Next Backup info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Last Backup</p>
                    {lastBackup ? (
                      <p className="text-white">{formatDate(lastBackup.createdAt)}</p>
                    ) : (
                      <p className="text-gray-500">No backups yet</p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Next Backup</p>
                    {nextBackupDate ? (
                      <p className="text-white">{formatDate(nextBackupDate.toISOString())}</p>
                    ) : (
                      <p className="text-gray-500">After first backup</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      createBackup();
                    }}
                    disabled={creating || restoring !== null}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {creating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Backup Now</span>
                      </>
                    )}
                  </button>

                  {/* Only show upgrade button if not already on daily backups */}
                  {!isDaily && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpgrade();
                      }}
                      disabled={upgrading}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {upgrading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <span>Daily Backups</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* All Backups List */}
          {allCompletedBackups.length > 0 && (
            <div className="bg-black/30 border border-gray-700/50 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
                <p className="text-gray-300 text-xs font-medium">
                  All Backups ({allCompletedBackups.length})
                </p>
                {restorableBackups.length > 0 && (
                  <p className="text-green-400/60 text-xs">
                    {restorableBackups.length} restorable
                  </p>
                )}
              </div>
              <div className="divide-y divide-gray-700/50 max-h-64 overflow-y-auto custom-scrollbar">
                {allCompletedBackups.map((backup) => (
                  <div key={backup.id} className={`p-3 flex items-center justify-between ${backup.fileExists ? 'hover:bg-gray-800/30' : 'opacity-60'}`}>
                    <div className="flex items-center gap-2">
                      {backup.fileExists ? (
                        <CheckCircle className="w-4 h-4 text-green-400/60" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-500" />
                      )}
                      <div>
                        <p className={`text-sm ${backup.fileExists ? 'text-gray-300' : 'text-gray-500'}`}>
                          {formatDate(backup.createdAt)}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {formatSize(backup.fileSizeBytes)}
                          {backup.backupType === 'manual' && ' • manual'}
                          {!backup.fileExists && ' • expired'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreBackup(backup.id, backup.fileName);
                        }}
                        disabled={restoring !== null || deleting !== null || !backup.fileExists}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer disabled:cursor-not-allowed ${
                          backup.fileExists
                            ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50'
                            : 'bg-gray-800 text-gray-500'
                        }`}
                        title={backup.fileExists ? 'Restore this backup' : 'Backup file expired'}
                      >
                        {restoring === backup.id ? 'Restoring...' : backup.fileExists ? 'Restore' : 'Expired'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBackup(backup.id, backup.fileName);
                        }}
                        disabled={restoring !== null || deleting !== null}
                        className="p-1.5 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete backup"
                      >
                        {deleting === backup.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer info */}
          <p className="text-gray-500 text-xs px-1">
            Up to 30 backups stored. Backups older than 4 weeks are automatically deleted.
          </p>
        </div>
      )}
    </div>
  );
}
