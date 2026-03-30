'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  RotateCw,
  Download,
  FileText,
  Trash2,
  Edit,
} from 'lucide-react';
import { BackupSection } from './BackupSection';
import { ResourceGauges } from './ResourceGauges';

// Types
interface InstanceData {
  id: string;
  instance_name?: string;
  instance_url: string;
  coolify_service_id?: string;
  server_domain?: string;
  status?: string;
  storage_limit_gb?: number;
  billing_cycle?: string;
  postgres_user?: string;
  postgres_password?: string;
  postgres_database?: string;
  deleted_at?: string | null;
  backup_interval_days?: number;
}

interface ServiceStatus {
  status: 'running' | 'stopped' | 'restarting' | 'provisioning' | 'unknown';
  coolifyStatus?: string;
  message?: string;
}

interface StorageUsage {
  usageGb: string;
  limitGb: string;
  percentageUsed: string;
  cached?: boolean;
}

interface InstanceMetrics {
  cpu: { usagePercent: number; limitCores: number };
  ram: { usageMb: number; limitMb: number };
  storage: { usageMb: number; limitGb: number };
  history?: { cpu_percent: number; ram_usage_mb: number; disk_usage_mb: number; recorded_at: string }[];
  cached: boolean;
  lastUpdated: string;
}

interface InstancePanelProps {
  instance: InstanceData;
  instanceStatus: ServiceStatus | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onInstanceAction: (action: 'restart' | 'stop' | 'start', instanceId: string) => Promise<void>;
  onUpdateVersion: (instanceId: string) => Promise<void>;
  onRefreshLogs: (instanceId: string) => Promise<void>;
  onSyncFromCoolify: (instanceId: string) => Promise<void>;
  onChangeDomain: (instanceId: string) => void;
  onRenameInstance?: (instanceId: string, newName: string) => Promise<void>;
  onDeleteInstance?: (instanceId: string, instanceName: string) => Promise<void>;
  onManualProvision?: (instanceId: string) => Promise<void>;
  executeTerminalCommand: (command: string, instanceId: string) => Promise<void>;
  fetchStorageUsage: (instanceId: string) => Promise<void>;
  // State
  actionLoading: string | null;
  checkingStatus: boolean;
  syncing: boolean;
  storageUsage: StorageUsage | null;
  fetchingStorage: boolean;
  terminalInput: string;
  setTerminalInput: (value: string) => void;
  terminalOutput: string[];
  setTerminalOutput: (value: string[] | ((prev: string[]) => string[])) => void;
  terminalLoading: boolean;
  // UI state
  showTerminalSection: boolean;
  setShowTerminalSection: (value: boolean) => void;
  showDatabaseSection: boolean;
  setShowDatabaseSection: (value: boolean) => void;
  showWebhookSection: boolean;
  setShowWebhookSection: (value: boolean) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  refreshingCredentials: boolean;
  onRefreshCredentials: () => void;
  // Metrics (new — replaces storage bar)
  metrics?: InstanceMetrics | null;
  fetchingMetrics?: boolean;
  onRefreshMetrics?: () => void;
  // Display options
  title?: string;
  showDeleteButton?: boolean;
  showRenameButton?: boolean;
  isPayPerInstance?: boolean;
  manualProvisionLoading?: boolean;
  accessToken?: string;
}

export function InstancePanel({
  instance,
  instanceStatus,
  isExpanded,
  onToggleExpand,
  onInstanceAction,
  onUpdateVersion,
  onRefreshLogs,
  onSyncFromCoolify,
  onChangeDomain,
  onRenameInstance,
  onDeleteInstance,
  onManualProvision,
  executeTerminalCommand,
  fetchStorageUsage,
  actionLoading,
  checkingStatus,
  syncing,
  storageUsage,
  fetchingStorage,
  terminalInput,
  setTerminalInput,
  terminalOutput,
  setTerminalOutput,
  terminalLoading,
  showTerminalSection,
  setShowTerminalSection,
  showDatabaseSection,
  setShowDatabaseSection,
  showWebhookSection,
  setShowWebhookSection,
  showPassword,
  setShowPassword,
  refreshingCredentials,
  onRefreshCredentials,
  metrics,
  fetchingMetrics,
  onRefreshMetrics,
  title,
  showDeleteButton = false,
  showRenameButton = false,
  isPayPerInstance = false,
  manualProvisionLoading = false,
  accessToken = '',
}: InstancePanelProps) {
  // Use instance.status for pay-per-instance, instanceStatus for dedicated
  const currentStatus = isPayPerInstance ? instance.status : instanceStatus?.status;
  const isRunning = currentStatus === 'running';
  const isStopped = currentStatus === 'stopped';
  const isRestarting = currentStatus === 'restarting';
  const isProvisioning = currentStatus === 'provisioning';

  // Status badge component
  const StatusBadge = () => {
    if (checkingStatus && !instanceStatus) {
      return (
        <span className='px-3 py-1 text-xs rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-2'>
          <RefreshCw className='w-3 h-3 animate-spin' />
          Checking...
        </span>
      );
    }
    if (isRunning) {
      return (
        <span className='px-3 py-1 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-2'>
          <span className='w-2 h-2 bg-green-400 rounded-full animate-pulse' />
          Active
        </span>
      );
    }
    if (isStopped) {
      return (
        <span className='px-3 py-1 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2'>
          <span className='w-2 h-2 bg-red-400 rounded-full' />
          Offline
        </span>
      );
    }
    if (isRestarting) {
      return (
        <span className='px-3 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-2'>
          <RefreshCw className='w-3 h-3 animate-spin' />
          Restarting
        </span>
      );
    }
    if (isProvisioning) {
      return (
        <span className='px-3 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2'>
          <RefreshCw className='w-3 h-3 animate-spin' />
          Provisioning
        </span>
      );
    }
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-2'>
        <span className='w-2 h-2 bg-gray-400 rounded-full' />
        {currentStatus || 'Unknown'}
      </span>
    );
  };

  return (
    <div className='bg-gray-900 border border-gray-800 rounded-lg overflow-hidden'>
      {/* Collapsed header - always visible, fully clickable */}
      <button
        onClick={onToggleExpand}
        className='w-full p-6 flex items-center justify-between hover:bg-gray-800/50 transition-colors cursor-pointer'
      >
        <div className='flex items-center gap-3'>
          {isExpanded ? (
            <ChevronUp className='h-5 w-5 text-white/50' />
          ) : (
            <ChevronDown className='h-5 w-5 text-white/50' />
          )}
          <div className='text-left'>
            <div className='flex items-center gap-2'>
              <h3 className='text-white font-semibold text-lg'>
                {title || instance.instance_name || 'n8n Instance'}
              </h3>
              {showRenameButton && isExpanded && onRenameInstance && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newName = prompt('Enter new instance name:', instance.instance_name);
                    if (newName && newName.trim() && newName !== instance.instance_name) {
                      onRenameInstance(instance.id, newName.trim());
                    }
                  }}
                  className='p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 cursor-pointer'
                  title='Rename instance'
                >
                  <Edit className='h-4 w-4' />
                </button>
              )}
            </div>
            {isPayPerInstance && (
              <div className='text-white/60 text-sm'>
                {instance.storage_limit_gb}GB * {instance.billing_cycle}
              </div>
            )}
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <StatusBadge />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className='p-6 pt-0 space-y-5'>
          {/* Instance URL & Actions */}
          <div className='space-y-3'>
            <label className='text-white text-sm font-medium'>Instance URL</label>

            {/* URL and icon buttons row */}
            <div className='flex flex-wrap items-center gap-2'>
              <a
                href={instance.instance_url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex-1 min-w-0 px-4 py-3 bg-black/50 rounded-lg text-white hover:text-white/80 text-sm border border-gray-700 hover:border-gray-600 transition-colors font-mono cursor-pointer overflow-hidden truncate'
              >
                {instance.instance_url?.replace('https://', '') || 'Provisioning...'}
              </a>
              <button
                onClick={() => instance.instance_url && navigator.clipboard.writeText(instance.instance_url)}
                className='p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 cursor-pointer transition-colors shrink-0'
                title='Copy URL'
                disabled={!instance.instance_url}
              >
                <Copy className='w-4 h-4' />
              </button>
              <button
                onClick={() => onSyncFromCoolify(instance.id)}
                disabled={syncing}
                className='p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 cursor-pointer disabled:opacity-50 transition-colors shrink-0'
                title='Sync Status'
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Action button row - full width on mobile */}
            <button
              onClick={() => onChangeDomain(instance.id)}
              className='w-full px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium border border-gray-700 cursor-pointer transition-colors'
            >
              Change Domain
            </button>
          </div>

          {/* Open n8n Button */}
          <div>
            <a
              href={instance.instance_url}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center justify-center w-full btn-minimal-filled px-6 py-3.5 rounded-lg text-base font-semibold hover:scale-[1.02] transition-all duration-200 cursor-pointer'
            >
              <svg
                fill='currentColor'
                fillRule='evenodd'
                height='1.25em'
                style={{ flex: 'none', lineHeight: 1 }}
                viewBox='0 0 24 24'
                width='1.25em'
                xmlns='http://www.w3.org/2000/svg'
                className='mr-2.5'
              >
                <title>n8n</title>
                <path
                  clipRule='evenodd'
                  d='M24 8.4c0 1.325-1.102 2.4-2.462 2.4-1.146 0-2.11-.765-2.384-1.8h-3.436c-.602 0-1.115.424-1.214 1.003l-.101.592a2.38 2.38 0 01-.8 1.405c.412.354.704.844.8 1.405l.1.592A1.222 1.222 0 0015.719 15h.975c.273-1.035 1.237-1.8 2.384-1.8 1.36 0 2.461 1.075 2.461 2.4S20.436 18 19.078 18c-1.147 0-2.11-.765-2.384-1.8h-.975c-1.204 0-2.23-.848-2.428-2.005l-.101-.592a1.222 1.222 0 00-1.214-1.003H10.97c-.308.984-1.246 1.7-2.356 1.7-1.11 0-2.048-.716-2.355-1.7H4.817c-.308.984-1.246 1.7-2.355 1.7C1.102 14.3 0 13.225 0 11.9s1.102-2.4 2.462-2.4c1.183 0 2.172.815 2.408 1.9h1.337c.236-1.085 1.225-1.9 2.408-1.9 1.184 0 2.172.815 2.408 1.9h.952c.601 0 1.115-.424 1.213-1.003l.102-.592c.198-1.157 1.225-2.005 2.428-2.005h3.436c.274-1.035 1.238-1.8 2.384-1.8C22.898 6 24 7.075 24 8.4zm-1.23 0c0 .663-.552 1.2-1.232 1.2-.68 0-1.23-.537-1.23-1.2 0-.663.55-1.2 1.23-1.2.68 0 1.231.537 1.231 1.2zM2.461 13.1c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm6.153 0c.68 0 1.231-.537 1.231-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm10.462 3.7c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.23.537-1.23 1.2 0 .663.55 1.2 1.23 1.2z'
                ></path>
              </svg>
              <span>Open n8n Instance</span>
            </a>
          </div>

          {/* Manual Provision Button for Stuck Instances */}
          {isProvisioning && !instance.coolify_service_id && onManualProvision && (
            <div className='space-y-3'>
              <label className='text-white text-sm font-medium'>Instance Stuck</label>
              <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 space-y-3'>
                <p className='text-yellow-300 text-sm'>
                  This instance is stuck in provisioning state without a Docker container. Click below to manually provision it.
                </p>
                <button
                  onClick={() => onManualProvision(instance.id)}
                  disabled={manualProvisionLoading}
                  className='w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                >
                  {manualProvisionLoading ? 'Provisioning...' : 'Manual Provision Docker Instance'}
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className='space-y-3'>
            <label className='text-white text-sm font-medium'>Quick Actions</label>

            <div className='grid grid-cols-2 gap-3'>
              {/* Start/Restart button */}
              <button
                onClick={() => onInstanceAction(isStopped ? 'start' : 'restart', instance.id)}
                disabled={actionLoading === 'restart' || actionLoading === 'start' || isRestarting}
                className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group ${
                  isStopped
                    ? 'bg-green-600 hover:bg-green-500 text-white border-0'
                    : 'bg-gray-900 hover:bg-gray-800 text-white border border-gray-700'
                }`}
              >
                <RotateCw className={`w-4 h-4 transition-transform group-hover:rotate-180 ${
                  actionLoading === 'restart' || actionLoading === 'start' || isRestarting
                    ? 'animate-spin text-yellow-400'
                    : isStopped
                    ? 'text-white'
                    : 'text-yellow-400'
                }`} />
                <span>
                  {actionLoading === 'restart' || isRestarting ? 'Restarting...' :
                   actionLoading === 'start' ? 'Starting...' :
                   isStopped ? 'Start' : 'Restart'}
                </span>
              </button>

              {/* Update version button */}
              <button
                onClick={() => onUpdateVersion(instance.id)}
                disabled={actionLoading === 'update' || !isRunning}
                className='flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium border border-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group'
              >
                <Download className={`w-4 h-4 text-green-400 group-hover:translate-y-0.5 transition-transform ${actionLoading === 'update' ? 'animate-bounce' : ''}`} />
                <span>{actionLoading === 'update' ? 'Updating...' : 'Update n8n Version'}</span>
              </button>
            </div>

            {/* Resource Metrics (CPU / RAM / Disk) */}
            {metrics || fetchingMetrics ? (
              <ResourceGauges
                cpu={metrics?.cpu ?? null}
                ram={metrics?.ram ?? null}
                storage={metrics?.storage ?? null}
                history={metrics?.history}
                loading={fetchingMetrics ?? false}
                cached={metrics?.cached}
                onRefresh={onRefreshMetrics ?? (() => fetchStorageUsage(instance.id))}
                instanceId={instance.id}
              />
            ) : (
              <div className='bg-black/30 border border-gray-700 rounded-lg p-3'>
                {fetchingStorage ? (
                  <div className='flex items-center gap-2 text-white/60 text-xs'>
                    <RefreshCw className='w-3 h-3 animate-spin' />
                    <span>Loading storage...</span>
                  </div>
                ) : (
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-white text-xs font-medium'>
                        Storage: {storageUsage?.usageGb || '0.00'}GB / {instance.storage_limit_gb || 5}GB
                      </span>
                      <button
                        onClick={() => fetchStorageUsage(instance.id)}
                        className='p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors cursor-pointer'
                        title='Refresh storage usage'
                      >
                        <RefreshCw className='w-3 h-3' />
                      </button>
                    </div>
                    <div className='w-full bg-gray-800 rounded-full h-1.5 overflow-hidden'>
                      <div
                        className={`h-full transition-all duration-300 ${
                          storageUsage && parseFloat(storageUsage.percentageUsed) > 90
                            ? 'bg-red-500'
                            : storageUsage && parseFloat(storageUsage.percentageUsed) > 75
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${storageUsage ? Math.min(parseFloat(storageUsage.percentageUsed), 100) : 0}%` }}
                      />
                    </div>
                    <div className='text-xs text-white/50'>
                      {storageUsage?.percentageUsed || '0'}% used
                      {storageUsage?.cached && <span className='ml-2'>(cached)</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced Section */}
          <div className='space-y-3'>
            <label className='text-white text-sm font-medium'>Advanced</label>

            <div className='bg-black/30 border border-gray-700 rounded-lg p-5 space-y-4'>
              {/* Terminal - Expandable */}
              <div>
                <button
                  type='button'
                  onClick={() => setShowTerminalSection(!showTerminalSection)}
                  className='w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors !cursor-pointer'
                >
                  <div className='flex items-center gap-3 !cursor-pointer'>
                    <div className='p-2 bg-green-900/30 rounded-lg !cursor-pointer'>
                      <svg className='w-5 h-5 text-green-400 !cursor-pointer' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
                      </svg>
                    </div>
                    <div className='text-left !cursor-pointer'>
                      <p className='text-green-400 text-sm font-medium !cursor-pointer'>Terminal</p>
                      <p className='text-white/50 text-xs !cursor-pointer'>Execute SQL commands directly</p>
                    </div>
                  </div>
                  <ChevronDown className='w-5 h-5 text-gray-400 transition-transform !cursor-pointer' style={{ transform: showTerminalSection ? 'rotate(180deg)' : 'none' }} />
                </button>

                {showTerminalSection && (
                  <div className='mt-3'>
                    <div className='bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-2xl'>
                      <div className='bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700'>
                        <div className='flex items-center gap-2'>
                          <div className='flex gap-1.5'>
                            <div className='w-3 h-3 rounded-full bg-red-500/80'></div>
                            <div className='w-3 h-3 rounded-full bg-yellow-500/80'></div>
                            <div className='w-3 h-3 rounded-full bg-green-500/80'></div>
                          </div>
                          <span className='text-gray-400 text-xs font-mono ml-2'>psql - PostgreSQL Terminal</span>
                        </div>
                        {terminalOutput.length > 0 && (
                          <button
                            onClick={() => setTerminalOutput([])}
                            className='text-gray-400 hover:text-white text-xs transition-colors'
                            title='Clear terminal'
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div className='bg-black p-4'>
                        {terminalOutput.length === 0 && (
                          <div className='font-mono text-xs text-gray-500 mb-3'>
                            <div>PostgreSQL interactive terminal</div>
                            <div className='mt-1'>Type SQL commands and press Enter to execute.</div>
                            <div className='mt-1'>Example: <span className='text-green-400'>SELECT version();</span></div>
                          </div>
                        )}

                        <div className='max-h-64 overflow-y-auto mb-3 font-mono text-xs'>
                          {terminalOutput.map((line, index) => (
                            <div key={index} className='mb-1'>
                              {line.startsWith('postgres>') ? (
                                <div className='text-green-400'>{line}</div>
                              ) : line.startsWith('Error:') ? (
                                <div className='text-red-400'>{line}</div>
                              ) : (
                                <div className='text-gray-300 whitespace-pre-wrap'>{line}</div>
                              )}
                            </div>
                          ))}
                          {terminalLoading && (
                            <div className='text-gray-500 animate-pulse'>Executing...</div>
                          )}
                        </div>

                        <div className='flex items-center gap-2 font-mono text-sm'>
                          <span className='text-green-400'>postgres={'>'}</span>
                          <input
                            type='text'
                            value={terminalInput}
                            onChange={(e) => setTerminalInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && terminalInput.trim() && !terminalLoading) {
                                executeTerminalCommand(terminalInput.trim(), instance.id);
                              }
                            }}
                            placeholder='enter SQL command...'
                            disabled={terminalLoading || !instance.postgres_password}
                            className='flex-1 bg-transparent text-gray-100 placeholder:text-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
                            autoComplete='off'
                            spellCheck='false'
                          />
                        </div>

                        {!instance.postgres_password && (
                          <div className='mt-3 pt-3 border-t border-gray-800'>
                            <p className='text-yellow-400/80 text-xs font-mono'>
                              No credentials found. Expand "Database Access & Credentials" below and click refresh.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Database Credentials - Expandable */}
              <div className='border-t border-gray-700 pt-4'>
                <button
                  type='button'
                  onClick={() => setShowDatabaseSection(!showDatabaseSection)}
                  className='w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors !cursor-pointer'
                >
                  <div className='flex items-center gap-3 !cursor-pointer'>
                    <div className='p-2 bg-blue-900/30 rounded-lg !cursor-pointer'>
                      <svg className='w-5 h-5 text-blue-400 !cursor-pointer' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' />
                      </svg>
                    </div>
                    <div className='text-left !cursor-pointer'>
                      <p className='text-blue-400 text-sm font-medium !cursor-pointer'>Database Access & Credentials</p>
                      <p className='text-white/50 text-xs !cursor-pointer'>Direct PostgreSQL access for advanced users</p>
                    </div>
                  </div>
                  <ChevronDown className='w-5 h-5 text-gray-400 transition-transform !cursor-pointer' style={{ transform: showDatabaseSection ? 'rotate(180deg)' : 'none' }} />
                </button>

                {showDatabaseSection && (
                  <div className='mt-3 space-y-3'>
                    <div className='bg-black/30 border border-gray-700/50 rounded-lg p-4'>
                      <p className='text-white/70 text-xs mb-3'>
                        Connect external tools like pgAdmin, TablePlus, or DBeaver to your PostgreSQL database.
                      </p>

                      <div className='flex items-center justify-end mb-3'>
                        <button
                          onClick={onRefreshCredentials}
                          disabled={refreshingCredentials}
                          className='p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                          title='Refresh database credentials'
                        >
                          <RefreshCw className={`w-4 h-4 ${refreshingCredentials ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      <div className='bg-black/50 rounded-lg p-4 space-y-3'>
                        {/* Username */}
                        <div className='flex items-center justify-between'>
                          <div className='flex-1'>
                            <p className='text-white/60 text-xs mb-1'>Username</p>
                            <code className='text-white text-sm font-mono'>{instance.postgres_user || 'n8n'}</code>
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(instance.postgres_user || 'n8n')}
                            className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors'
                            title='Copy username'
                          >
                            <Copy className='w-4 h-4' />
                          </button>
                        </div>

                        {/* Database Name */}
                        <div className='flex items-center justify-between'>
                          <div className='flex-1'>
                            <p className='text-white/60 text-xs mb-1'>Database Name</p>
                            <code className='text-white text-sm font-mono'>{instance.postgres_database || 'n8n'}</code>
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(instance.postgres_database || 'n8n')}
                            className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors'
                            title='Copy database name'
                          >
                            <Copy className='w-4 h-4' />
                          </button>
                        </div>

                        {/* Password */}
                        <div className='flex items-center justify-between'>
                          <div className='flex-1'>
                            <p className='text-white/60 text-xs mb-1'>Password</p>
                            <code className='text-white text-sm font-mono break-all'>
                              {refreshingCredentials ? (
                                <span className='text-white/50'>Loading...</span>
                              ) : showPassword ? (
                                instance.postgres_password || <span className='text-white/50'>Click refresh to fetch</span>
                              ) : instance.postgres_password ? (
                                '**************'
                              ) : (
                                <span className='text-white/50'>Click refresh to fetch</span>
                              )}
                            </code>
                          </div>
                          <div className='flex gap-1'>
                            <button
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={!instance.postgres_password || refreshingCredentials}
                              className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                              title={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? (
                                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' />
                                </svg>
                              ) : (
                                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                if (instance.postgres_password) {
                                  navigator.clipboard.writeText(instance.postgres_password);
                                  alert('Password copied to clipboard!');
                                }
                              }}
                              disabled={!instance.postgres_password || refreshingCredentials}
                              className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                              title='Copy password'
                            >
                              <Copy className='w-4 h-4' />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Deployment Webhook - Expandable */}
              <div className='border-t border-gray-700 pt-4'>
                <button
                  type='button'
                  onClick={() => setShowWebhookSection(!showWebhookSection)}
                  className='w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors !cursor-pointer'
                >
                  <div className='flex items-center gap-3 !cursor-pointer'>
                    <div className='p-2 bg-purple-900/30 rounded-lg !cursor-pointer'>
                      <svg className='w-5 h-5 text-purple-400 !cursor-pointer' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 10V3L4 14h7v7l9-11h-7z' />
                      </svg>
                    </div>
                    <div className='text-left !cursor-pointer'>
                      <p className='text-purple-400 text-sm font-medium !cursor-pointer'>Deployment Webhook</p>
                      <p className='text-white/50 text-xs !cursor-pointer'>Trigger deployments from CI/CD pipelines</p>
                    </div>
                  </div>
                  <ChevronDown className='w-5 h-5 text-gray-400 transition-transform !cursor-pointer' style={{ transform: showWebhookSection ? 'rotate(180deg)' : 'none' }} />
                </button>

                {showWebhookSection && (
                  <div className='mt-3'>
                    <div className='bg-black/30 border border-gray-700/50 rounded-lg p-4'>
                      <p className='text-white/70 text-xs mb-3'>
                        Automate your deployment workflow by triggering this webhook from GitHub Actions, GitLab CI, Jenkins, or any other CI/CD tool.
                      </p>

                      <div className='bg-black/50 rounded-lg p-4 space-y-2'>
                        <div className='flex items-center gap-2'>
                          <code className='text-white text-sm font-mono break-all flex-1'>
                            {instance.coolify_service_id && instance.server_domain
                              ? `https://${instance.server_domain}/api/v1/deploy?uuid=${instance.coolify_service_id}&force=false`
                              : 'Loading...'}
                          </code>
                          <button
                            onClick={() => {
                              if (instance.coolify_service_id && instance.server_domain) {
                                const webhook = `https://${instance.server_domain}/api/v1/deploy?uuid=${instance.coolify_service_id}&force=false`;
                                navigator.clipboard.writeText(webhook);
                              }
                            }}
                            disabled={!instance.coolify_service_id || !instance.server_domain}
                            className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                            title='Copy webhook URL'
                          >
                            <Copy className='w-4 h-4' />
                          </button>
                        </div>
                        <p className='text-white/50 text-xs'>
                          Send a POST request to this URL to trigger a deployment
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Database Backups Section */}
              <BackupSection
                instanceId={instance.id}
                accessToken={accessToken}
                backupIntervalDays={instance.backup_interval_days || 7}
              />

              {/* View Logs Button */}
              <div className='border-t border-gray-700 pt-4'>
                <button
                  onClick={() => onRefreshLogs(instance.id)}
                  disabled={actionLoading === 'logs'}
                  className='w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group'
                >
                  <FileText className='w-4 h-4 group-hover:scale-110 transition-transform' />
                  <span>{actionLoading === 'logs' ? 'Loading Logs...' : 'View Logs'}</span>
                </button>
              </div>

              {/* Delete Instance Button */}
              {showDeleteButton && onDeleteInstance && (
                <div className='border-t border-gray-700 pt-4'>
                  <button
                    onClick={() => onDeleteInstance(instance.id, instance.instance_name || 'Instance')}
                    disabled={actionLoading === 'delete'}
                    className='w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-lg text-sm font-medium border border-red-900/50 hover:border-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group'
                  >
                    <Trash2 className={`w-4 h-4 group-hover:scale-110 transition-transform ${actionLoading === 'delete' ? 'animate-pulse' : ''}`} />
                    <span>{actionLoading === 'delete' ? 'Deleting...' : 'Delete Instance'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
