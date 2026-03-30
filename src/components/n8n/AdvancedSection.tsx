'use client';

import { FileText, Trash2 } from 'lucide-react';
import TerminalSection from './TerminalSection';
import DatabaseCredentialsSection from './DatabaseCredentialsSection';
import WebhookSection from './WebhookSection';

interface AdvancedSectionProps {
  // Terminal props
  showTerminal: boolean;
  onToggleTerminal: () => void;
  terminalOutput: string[];
  terminalInput: string;
  terminalLoading: boolean;
  hasCredentials: boolean;
  onTerminalInputChange: (value: string) => void;
  onTerminalExecute: (command: string) => void;
  onTerminalClear: () => void;
  onTerminalMaximize?: () => void;

  // Database props
  showDatabase: boolean;
  onToggleDatabase: () => void;
  postgresUser: string;
  postgresDatabase: string;
  postgresPassword?: string | null;
  refreshingCredentials: boolean;
  onRefreshCredentials: () => void;

  // Webhook props
  showWebhook: boolean;
  onToggleWebhook: () => void;
  coolifyServiceId: string | null | undefined;
  serverDomain: string | null | undefined;

  // Logs props
  operationLoading: string | null;
  onViewLogs: () => void;

  // Delete props
  onDelete: () => void;
  instanceName: string;
}

export default function AdvancedSection({
  showTerminal,
  onToggleTerminal,
  terminalOutput,
  terminalInput,
  terminalLoading,
  hasCredentials,
  onTerminalInputChange,
  onTerminalExecute,
  onTerminalClear,
  onTerminalMaximize,
  showDatabase,
  onToggleDatabase,
  postgresUser,
  postgresDatabase,
  postgresPassword,
  refreshingCredentials,
  onRefreshCredentials,
  showWebhook,
  onToggleWebhook,
  coolifyServiceId,
  serverDomain,
  operationLoading,
  onViewLogs,
  onDelete,
}: AdvancedSectionProps) {
  return (
    <div className='space-y-3'>
      <label className='text-white text-sm font-medium'>Advanced</label>

      <div className='bg-black/30 border border-gray-700 rounded-lg p-5 space-y-4'>
        {/* Terminal */}
        <TerminalSection
          isExpanded={showTerminal}
          onToggle={onToggleTerminal}
          terminalOutput={terminalOutput}
          terminalInput={terminalInput}
          terminalLoading={terminalLoading}
          hasCredentials={hasCredentials}
          onInputChange={onTerminalInputChange}
          onExecute={onTerminalExecute}
          onClear={onTerminalClear}
          onMaximize={onTerminalMaximize}
        />

        {/* Database Credentials */}
        <DatabaseCredentialsSection
          isExpanded={showDatabase}
          onToggle={onToggleDatabase}
          postgresUser={postgresUser}
          postgresDatabase={postgresDatabase}
          postgresPassword={postgresPassword}
          refreshingCredentials={refreshingCredentials}
          onRefreshCredentials={onRefreshCredentials}
        />

        {/* Webhook */}
        <WebhookSection
          isExpanded={showWebhook}
          onToggle={onToggleWebhook}
          coolifyServiceId={coolifyServiceId}
          serverDomain={serverDomain}
        />

        {/* View Logs Button */}
        <div className='border-t border-gray-700 pt-4'>
          <button
            onClick={onViewLogs}
            disabled={operationLoading === 'logs'}
            className='w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group'
          >
            <FileText className='w-4 h-4 group-hover:scale-110 transition-transform' />
            <span>{operationLoading === 'logs' ? 'Loading Logs...' : 'View Logs'}</span>
          </button>
        </div>

        {/* Delete Instance Button */}
        <div className='border-t border-gray-700 pt-4'>
          <button
            onClick={onDelete}
            disabled={operationLoading === 'delete'}
            className='w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-lg text-sm font-medium border border-red-900/50 hover:border-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group'
          >
            <Trash2
              className={`w-4 h-4 group-hover:scale-110 transition-transform ${
                operationLoading === 'delete' ? 'animate-pulse' : ''
              }`}
            />
            <span>{operationLoading === 'delete' ? 'Deleting...' : 'Delete Instance'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
