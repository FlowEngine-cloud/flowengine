'use client';

import { Plus } from 'lucide-react';
import InstanceUrlSection from './InstanceUrlSection';
import QuickActions from './QuickActions';
import AdvancedSection from './AdvancedSection';
import { InstanceStatus } from './StatusBadge';

interface StorageUsage {
  usageGb: string;
  limitGb: number;
  percentageUsed: string;
  cached: boolean;
  lastUpdated: string;
}

export interface InstanceManagementProps {
  // Instance data
  instanceId: string;
  instanceUrl: string;
  instanceName: string;
  coolifyServiceId?: string | null;
  serverDomain?: string | null;
  postgresUser?: string;
  postgresDatabase?: string;
  postgresPassword?: string | null;

  // Status
  status: InstanceStatus;

  // Storage
  storageUsage: StorageUsage | null;
  fetchingStorage: boolean;

  // Credentials
  refreshingCredentials: boolean;

  // Section expansion states
  showTerminal: boolean;
  showDatabase: boolean;
  showWebhook: boolean;

  // Terminal state
  terminalOutput: string[];
  terminalInput: string;
  terminalLoading: boolean;

  // Sync state
  syncing: boolean;

  // Operation loading (logs, delete)
  operationLoading: string | null;

  // Stuck instance state (for manual provision)
  isStuck?: boolean;
  manualProvisioning?: boolean;

  // Handlers
  onSync: () => void;
  onChangeDomain: () => void;
  onChangeTimezone: () => void;
  onStart: () => void;
  onRestart: () => void;
  onUpdateVersion: () => void;
  onRefreshStorage: () => void;
  onToggleTerminal: () => void;
  onToggleDatabase: () => void;
  onToggleWebhook: () => void;
  onTerminalInputChange: (value: string) => void;
  onTerminalExecute: (command: string) => void;
  onTerminalClear: () => void;
  onTerminalMaximize?: () => void;
  onRefreshCredentials: () => void;
  onViewLogs: () => void;
  onDelete: () => void;
  onManualProvision?: () => void;
}

export default function InstanceManagement({
  instanceId,
  instanceUrl,
  instanceName,
  coolifyServiceId,
  serverDomain,
  postgresUser = 'n8n',
  postgresDatabase = 'n8n',
  postgresPassword,
  status,
  storageUsage,
  fetchingStorage,
  refreshingCredentials,
  showTerminal,
  showDatabase,
  showWebhook,
  terminalOutput,
  terminalInput,
  terminalLoading,
  syncing,
  operationLoading,
  isStuck,
  manualProvisioning,
  onSync,
  onChangeDomain,
  onChangeTimezone,
  onStart,
  onRestart,
  onUpdateVersion,
  onRefreshStorage,
  onToggleTerminal,
  onToggleDatabase,
  onToggleWebhook,
  onTerminalInputChange,
  onTerminalExecute,
  onTerminalClear,
  onTerminalMaximize,
  onRefreshCredentials,
  onViewLogs,
  onDelete,
  onManualProvision,
}: InstanceManagementProps) {
  return (
    <div className='p-6 pt-0 space-y-5'>
      {/* Instance URL & Actions */}
      <InstanceUrlSection
        instanceUrl={instanceUrl}
        onSync={onSync}
        onChangeDomain={onChangeDomain}
        onChangeTimezone={onChangeTimezone}
        syncing={syncing}
      />

      {/* Manual Provision Button for Stuck Instances */}
      {isStuck && onManualProvision && (
        <div className='space-y-3'>
          <label className='text-white text-sm font-medium'>Instance Stuck</label>
          <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 space-y-3'>
            <p className='text-yellow-300 text-sm'>
              This instance is stuck in provisioning state without a Docker container. Click below to manually
              provision it.
            </p>
            <button
              onClick={onManualProvision}
              disabled={manualProvisioning}
              className='w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
            >
              {manualProvisioning ? 'Provisioning...' : 'Manual Provision Docker Instance'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <QuickActions
        status={status}
        storageUsage={storageUsage}
        fetchingStorage={fetchingStorage}
        onStart={onStart}
        onRestart={onRestart}
        onUpdateVersion={onUpdateVersion}
        onRefreshStorage={onRefreshStorage}
      />

      {/* Advanced Section */}
      <AdvancedSection
        showTerminal={showTerminal}
        onToggleTerminal={onToggleTerminal}
        terminalOutput={terminalOutput}
        terminalInput={terminalInput}
        terminalLoading={terminalLoading}
        hasCredentials={!!postgresPassword}
        onTerminalInputChange={onTerminalInputChange}
        onTerminalExecute={onTerminalExecute}
        onTerminalClear={onTerminalClear}
        onTerminalMaximize={onTerminalMaximize}
        showDatabase={showDatabase}
        onToggleDatabase={onToggleDatabase}
        postgresUser={postgresUser}
        postgresDatabase={postgresDatabase}
        postgresPassword={postgresPassword}
        refreshingCredentials={refreshingCredentials}
        onRefreshCredentials={onRefreshCredentials}
        showWebhook={showWebhook}
        onToggleWebhook={onToggleWebhook}
        coolifyServiceId={coolifyServiceId}
        serverDomain={serverDomain}
        operationLoading={operationLoading}
        onViewLogs={onViewLogs}
        onDelete={onDelete}
        instanceName={instanceName}
      />
    </div>
  );
}

// Also export a component for deleted instances that need to be re-deployed
interface DeletedInstanceCardProps {
  instanceName: string;
  storageGb: number;
  billingCycle: string;
  onDeploy: () => void;
  isDeploying: boolean;
}

export function DeletedInstanceCard({
  instanceName,
  storageGb,
  billingCycle,
  onDeploy,
  isDeploying,
}: DeletedInstanceCardProps) {
  return (
    <div className='p-6'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h4 className='text-white font-medium'>{instanceName || 'n8n Instance'}</h4>
          <p className='text-white/60 text-sm'>
            {storageGb}GB • {billingCycle}
          </p>
        </div>
        <span className='px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-400'>No instance deployed</span>
      </div>
      <button
        onClick={onDeploy}
        disabled={isDeploying}
        className='w-full px-4 py-3 bg-white hover:bg-gray-100 text-black font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
      >
        <Plus className='h-4 w-4' />
        {isDeploying ? 'Deploying...' : 'Deploy Instance'}
      </button>
      <p className='text-white/50 text-xs mt-3 text-center'>Your subscription is active. Deploy a new instance anytime.</p>
    </div>
  );
}
