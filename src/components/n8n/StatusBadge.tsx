'use client';

import { Download, Package, Play, Loader2 } from 'lucide-react';

// Status now includes action states - single source of truth
export type InstanceStatus =
  | 'running'
  | 'stopped'
  | 'stopping'           // During stop action (5s fake)
  | 'starting'           // During start action (60s fake)
  | 'restarting'         // During restart action (60s fake)
  | 'downloading'        // Update phase 1: downloading new version (0-50s)
  | 'installing'         // Update phase 2: installing (50-110s)
  | 'update_starting'    // Update phase 3: starting (110-160s)
  | 'updating'           // Legacy - keep for compatibility
  | 'provisioning'
  | 'unknown'
  | null;

interface StatusBadgeProps {
  status: InstanceStatus;
}

// Helper to check if status is an "in progress" action
export function isActionInProgress(status: InstanceStatus): boolean {
  return ['stopping', 'starting', 'restarting', 'downloading', 'installing', 'update_starting', 'updating', 'provisioning'].includes(status || '');
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'running') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-2'>
        <span className='w-2 h-2 bg-green-400 rounded-full animate-pulse' />
        Active
      </span>
    );
  }

  if (status === 'stopped') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2'>
        <span className='w-2 h-2 bg-red-400 rounded-full' />
        Offline
      </span>
    );
  }

  if (status === 'stopping') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-2'>
        <Loader2 className='w-3 h-3 animate-spin' />
        Stopping
      </span>
    );
  }

  if (status === 'starting') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-white/[0.06] text-white/50 border border-white/10 flex items-center gap-2'>
        <Loader2 className='w-3 h-3 animate-spin' />
        Starting
      </span>
    );
  }

  if (status === 'restarting') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-white/[0.06] text-white/50 border border-white/10 flex items-center gap-2'>
        <Loader2 className='w-3 h-3 animate-spin' />
        Restarting
      </span>
    );
  }

  if (status === 'downloading') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-2'>
        <Download className='w-3 h-3 animate-bounce' />
        Downloading
      </span>
    );
  }

  if (status === 'installing') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-2'>
        <Package className='w-3 h-3 animate-pulse' />
        Installing
      </span>
    );
  }

  if (status === 'update_starting') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-2'>
        <Play className='w-3 h-3 animate-pulse' />
        Starting
      </span>
    );
  }

  if (status === 'updating') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-2'>
        <Loader2 className='w-3 h-3 animate-spin' />
        Updating
      </span>
    );
  }

  if (status === 'provisioning') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2'>
        <Loader2 className='w-3 h-3 animate-spin' />
        Provisioning
      </span>
    );
  }

  if (status === 'unknown') {
    return (
      <span className='px-3 py-1 text-xs rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-2'>
        <span className='w-2 h-2 bg-orange-400 rounded-full' />
        Unknown
      </span>
    );
  }

  // Default: checking status (null or undefined) - use blue instead of gray
  return (
    <span className='px-3 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2'>
      <Loader2 className='w-3 h-3 animate-spin' />
      Checking...
    </span>
  );
}
