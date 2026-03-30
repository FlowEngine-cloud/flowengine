'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, RefreshCw, ArrowRight, Upload, Link as LinkIcon, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Instance {
  id: string;
  instance_name: string;
  instance_url: string;
  status: string;
  type: 'dedicated' | 'pay-per-instance';
}

interface MigrationImportSectionProps {
  instanceId: string;
  accessToken: string;
  isExpanded?: boolean;
}

export function MigrationImportSection({
  instanceId,
  accessToken,
  isExpanded: initialExpanded = false,
}: MigrationImportSectionProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [activeFeature, setActiveFeature] = useState<'migrate' | 'import'>('migrate');

  // Migration state
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);

  // Import state
  const [importMethod, setImportMethod] = useState<'url' | 'upload'>('url');
  const [s3Url, setS3Url] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      setError(null);

      const response = await fetch('/api/user/instances', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        const otherInstances = (data.instances || []).filter(
          (inst: Instance) => inst.id !== instanceId
        );
        setInstances(otherInstances);
      }
    } catch (err: any) {
      console.error('Failed to fetch instances:', err);
      setError('Failed to load instances');
    } finally {
      setLoadingInstances(false);
    }
  }, [accessToken, instanceId]);

  useEffect(() => {
    if (isExpanded && activeFeature === 'migrate') {
      fetchInstances();
    }
  }, [isExpanded, activeFeature, fetchInstances]);

  // Migration handlers
  const handleMigrate = () => {
    if (!selectedTargetId) {
      setError('Please select a target instance');
      return;
    }
    setShowMigrateConfirm(true);
  };

  const confirmMigration = async () => {
    try {
      setMigrating(true);
      setShowMigrateConfirm(false);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/n8n/backup/migrate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceInstanceId: instanceId,
          targetInstanceId: selectedTargetId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      setSuccess('Migration completed successfully! The target instance is restarting.');

      // Reload to show fake provisioning status
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setMigrating(false);
    }
  };

  // Import handlers
  const handleImport = () => {
    if (importMethod === 'url' && !s3Url) {
      setError('Please enter a URL');
      return;
    }

    if (importMethod === 'upload' && !selectedFile) {
      setError('Please select a file');
      return;
    }

    setShowImportConfirm(true);
  };

  const confirmImport = async () => {
    try {
      setImporting(true);
      setShowImportConfirm(false);
      setError(null);
      setSuccess(null);

      let response: Response;

      if (importMethod === 'url') {
        response = await fetch('/api/n8n/backup/import', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instanceId,
            url: s3Url,
          }),
        });
      } else {
        const formData = new FormData();
        formData.append('instanceId', instanceId);
        formData.append('file', selectedFile!);

        response = await fetch('/api/n8n/backup/import', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formData,
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setSuccess('Backup imported successfully! Your instance is restarting.');

      // Reload to show fake provisioning status
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.dump', '.sql', '.backup'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (!validExtensions.includes(fileExtension)) {
        setError('Please select a valid backup file (.dump, .sql, or .backup)');
        return;
      }

      setSelectedFile(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectedInstance = instances.find(inst => inst.id === selectedTargetId);

  return (
    <div className="border-t border-gray-700 pt-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors !cursor-pointer"
      >
        <div className="flex items-center gap-3 !cursor-pointer">
          <div className="p-2 bg-blue-900/30 rounded-lg !cursor-pointer">
            <ArrowRight className="w-5 h-5 text-blue-400 !cursor-pointer" />
          </div>
          <div className="text-left !cursor-pointer">
            <p className="text-blue-400 text-sm font-medium !cursor-pointer">Migration & Import</p>
            <p className="text-white/50 text-xs !cursor-pointer">Migrate or import backups</p>
          </div>
        </div>
        <ChevronDown className="w-5 h-5 text-gray-400 transition-transform !cursor-pointer" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Feature Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveFeature('migrate')}
              disabled={migrating || importing}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeFeature === 'migrate'
                  ? 'bg-gray-700 text-white border-2 border-white'
                  : 'bg-gray-800/30 text-gray-400 border border-gray-700 hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4" />
                <span>Migrate Instance</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveFeature('import')}
              disabled={migrating || importing}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeFeature === 'import'
                  ? 'bg-gray-700 text-white border-2 border-white'
                  : 'bg-gray-800/30 text-gray-400 border border-gray-700 hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                <span>Import Backup</span>
              </div>
            </button>
          </div>

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

          {/* Migration Content */}
          {activeFeature === 'migrate' && (
            <div className="bg-black/30 border border-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-4">
                Copy your last backup to another instance. The target instance will be overwritten.
              </p>

              {loadingInstances ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Loading instances...</span>
                </div>
              ) : instances.length === 0 ? (
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm">No other instances available for migration.</p>
                  <p className="text-gray-500 text-xs mt-1">Create another instance to enable migration.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-gray-400 text-xs mb-2">Select Target Instance</label>

                  <div className="flex gap-3">
                    <select
                      value={selectedTargetId}
                      onChange={(e) => setSelectedTargetId(e.target.value)}
                      disabled={migrating}
                      className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white text-sm focus:ring-2 focus:ring-white focus:border-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Choose an instance...</option>
                      {instances.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.instance_name} ({inst.type === 'dedicated' ? 'Dedicated' : 'Pay-per-instance'})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleMigrate}
                      disabled={!selectedTargetId || migrating}
                      className="flex-1 px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {migrating ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Migrating...</span>
                        </div>
                      ) : (
                        'Migrate Instance'
                      )}
                    </button>
                  </div>

                  {selectedTargetId && (
                    <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-400 text-xs font-medium">Warning</p>
                        <p className="text-yellow-400/80 text-xs mt-1">
                          This will replace all data in the target instance with your last backup. This cannot be undone.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import Content */}
          {activeFeature === 'import' && (
            <div className="bg-black/30 border border-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-4">
                Import a backup from S3, a URL, or upload a file directly. Supports PostgreSQL dump files (.dump, .sql).
              </p>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMethod('url')}
                    disabled={importing}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      importMethod === 'url'
                        ? 'bg-gray-700 text-white border-2 border-white'
                        : 'bg-gray-800/30 text-gray-400 border border-gray-700 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      <span>URL</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMethod('upload')}
                    disabled={importing}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      importMethod === 'upload'
                        ? 'bg-gray-700 text-white border-2 border-white'
                        : 'bg-gray-800/30 text-gray-400 border border-gray-700 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Upload className="w-4 h-4" />
                      <span>Upload File</span>
                    </div>
                  </button>
                </div>

                {importMethod === 'url' && (
                  <div>
                    <label className="block text-gray-400 text-xs mb-2">S3 URL or Public URL</label>
                    <input
                      type="url"
                      value={s3Url}
                      onChange={(e) => setS3Url(e.target.value)}
                      disabled={importing}
                      placeholder="https://s3.amazonaws.com/bucket/backup.dump"
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white text-sm placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white disabled:opacity-50"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Enter a publicly accessible URL to your backup file
                    </p>
                  </div>
                )}

                {importMethod === 'upload' && (
                  <div>
                    <label className="block text-gray-400 text-xs mb-2">Upload Backup File</label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".dump,.sql,.backup"
                        onChange={handleFileChange}
                        disabled={importing}
                        className="hidden"
                        id="backup-file-upload"
                      />
                      <label
                        htmlFor="backup-file-upload"
                        className={`flex items-center justify-center gap-2 px-4 py-8 bg-gray-900/50 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800/50 hover:border-gray-600 transition-all ${
                          importing ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {selectedFile ? (
                          <div className="text-center">
                            <p className="text-white text-sm">{selectedFile.name}</p>
                            <p className="text-gray-500 text-xs mt-1">{formatFileSize(selectedFile.size)}</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">Click to select a backup file</p>
                            <p className="text-gray-500 text-xs mt-1">Supports .dump, .sql, .backup</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 text-xs font-medium">Warning</p>
                    <p className="text-yellow-400/80 text-xs mt-1">
                      This will replace all current data in this instance with the imported backup. Make sure you have a backup if needed.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleImport}
                  disabled={
                    importing ||
                    (importMethod === 'url' && !s3Url) ||
                    (importMethod === 'upload' && !selectedFile)
                  }
                  className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </div>
                  ) : (
                    'Import Backup'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Migration Confirmation Modal */}
      {showMigrateConfirm && selectedInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6">
            <h3 className="text-white text-lg font-medium mb-3">Confirm Migration</h3>

            <div className="space-y-3 mb-6">
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Source (this instance)</p>
                <p className="text-white text-sm">Current Instance</p>
              </div>

              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-gray-500" />
              </div>

              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Target (will be overwritten)</p>
                <p className="text-white text-sm">{selectedInstance.instance_name}</p>
                <p className="text-gray-500 text-xs">{selectedInstance.instance_url}</p>
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-xs">
                ⚠️ This will permanently replace all data in <strong>{selectedInstance.instance_name}</strong> with your last backup. Make sure you have a backup of the target instance if needed.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowMigrateConfirm(false)}
                disabled={migrating}
                className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMigration}
                disabled={migrating}
                className="flex-1 px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {migrating ? 'Migrating...' : 'Confirm Migration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Modal */}
      {showImportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6">
            <h3 className="text-white text-lg font-medium mb-3">Confirm Import</h3>

            <div className="space-y-3 mb-6">
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Import Source</p>
                {importMethod === 'url' ? (
                  <p className="text-white text-sm break-all">{s3Url}</p>
                ) : (
                  <div>
                    <p className="text-white text-sm">{selectedFile?.name}</p>
                    <p className="text-gray-500 text-xs">{selectedFile && formatFileSize(selectedFile.size)}</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Target Instance</p>
                <p className="text-white text-sm">Current Instance</p>
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-xs">
                ⚠️ This will permanently replace all data in this instance with the imported backup. This cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowImportConfirm(false)}
                disabled={importing}
                className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={importing}
                className="flex-1 px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
