'use client';

import { RotateCw, Download, RefreshCw, Play } from 'lucide-react';
import { InstanceStatus } from './StatusBadge';

interface StorageUsage {
  usageGb: string;
  limitGb: number;
  percentageUsed: string;
  cached: boolean;
  lastUpdated: string;
}

interface QuickActionsProps {
  status: InstanceStatus;
  storageUsage: StorageUsage | null;
  fetchingStorage: boolean;
  onStart: () => void;
  onRestart: () => void;
  onUpdateVersion: () => void;
  onRefreshStorage: () => void;
}

export default function QuickActions({
  status,
  storageUsage,
  fetchingStorage,
  onStart,
  onRestart,
  onUpdateVersion,
  onRefreshStorage,
}: QuickActionsProps) {
  // Derive ALL state from status - single source of truth
  const isStarting = status === 'starting';
  const isRestarting = status === 'restarting';
  const isUpdating = status === 'updating';
  const isStopped = status === 'stopped';
  const isRunning = status === 'running';
  const isTransitioning = isStarting || isRestarting || isUpdating || status === 'provisioning';

  return (
    <div className='space-y-3'>
      <label className='text-white text-sm font-medium'>Quick Actions</label>

      <div className='grid grid-cols-2 gap-3'>
        {/* Start/Restart button - changes based on status */}
        {isStopped ? (
          // STOPPED: Show Start button
          <button
            onClick={onStart}
            className='flex items-center justify-center gap-2 px-4 py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-all cursor-pointer group'
          >
            <Play className='w-4 h-4 text-white' />
            <span>Start</span>
          </button>
        ) : isStarting ? (
          // STARTING: Show disabled Starting button
          <button
            disabled
            className='flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-900 text-white rounded-lg text-sm font-medium border border-gray-700 opacity-50 cursor-not-allowed'
          >
            <RotateCw className='w-4 h-4 text-blue-400 animate-spin' />
            <span>Starting...</span>
          </button>
        ) : isRestarting ? (
          // RESTARTING: Show disabled Restarting button
          <button
            disabled
            className='flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-900 text-white rounded-lg text-sm font-medium border border-gray-700 opacity-50 cursor-not-allowed'
          >
            <RotateCw className='w-4 h-4 text-yellow-400 animate-spin' />
            <span>Restarting...</span>
          </button>
        ) : (
          // RUNNING/OTHER: Show Restart button
          <button
            onClick={onRestart}
            disabled={!isRunning}
            className='flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium border border-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group'
          >
            <RotateCw className='w-4 h-4 text-yellow-400 transition-transform group-hover:rotate-180' />
            <span>Restart</span>
          </button>
        )}

        {/* Update version button */}
        {isUpdating ? (
          <button
            disabled
            className='flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-900 text-white rounded-lg text-sm font-medium border border-gray-700 opacity-50 cursor-not-allowed'
          >
            <Download className='w-4 h-4 text-purple-400 animate-bounce' />
            <span>Updating...</span>
          </button>
        ) : (
          <button
            onClick={onUpdateVersion}
            disabled={!isRunning || isTransitioning}
            className='flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium border border-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group'
          >
            <Download className='w-4 h-4 text-green-400 group-hover:translate-y-0.5 transition-transform' />
            <span>Update n8n Version</span>
          </button>
        )}
      </div>

      {/* Storage Usage - Compact */}
      <div className='bg-black/30 border border-gray-700 rounded-lg p-3'>
        {fetchingStorage ? (
          <div className='flex items-center gap-2 text-white/60 text-xs'>
            <RefreshCw className='w-3 h-3 animate-spin' />
            <span>Loading storage...</span>
          </div>
        ) : storageUsage ? (
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-white text-xs font-medium'>
                Storage: {storageUsage.usageGb}GB / {storageUsage.limitGb}GB
              </span>
              <button
                onClick={onRefreshStorage}
                className='p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors'
                title='Refresh storage usage'
              >
                <RefreshCw className='w-3 h-3' />
              </button>
            </div>
            <div className='w-full bg-gray-800 rounded-full h-1.5 overflow-hidden'>
              <div
                className={`h-full transition-all duration-300 ${
                  parseFloat(storageUsage.percentageUsed) > 90
                    ? 'bg-red-500'
                    : parseFloat(storageUsage.percentageUsed) > 75
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(parseFloat(storageUsage.percentageUsed), 100)}%` }}
              />
            </div>
            <div className='text-xs text-white/50'>
              {storageUsage.percentageUsed}% used
              {storageUsage.cached && <span className='ml-2'>(cached)</span>}
            </div>
          </div>
        ) : (
          <div className='text-white/60 text-xs'>Storage usage unavailable</div>
        )}
      </div>
    </div>
  );
}
