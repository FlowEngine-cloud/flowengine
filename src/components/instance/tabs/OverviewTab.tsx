'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Workflow, Execution, ExecutionMetrics } from '../types';

interface OverviewTabProps {
  workflows: Workflow[];
  archivedWorkflows: Workflow[];
  executions: Execution[];
  executionMetrics: ExecutionMetrics | null;
  onExecutionClick?: (execution: Execution) => void;
  onWorkflowClick?: (workflow: Workflow) => void;
  onExecutionFilterChange?: (filter: 'all' | 'success' | 'error') => void;
}

export default function OverviewTab({
  workflows,
  archivedWorkflows,
  executions,
  executionMetrics,
  onExecutionClick,
  onWorkflowClick,
  onExecutionFilterChange,
}: OverviewTabProps) {
  const [workflowViewTab, setWorkflowViewTab] = useState<'active' | 'archived'>('active');
  const [executionFilter, setExecutionFilter] = useState<'all' | 'success' | 'error'>('all');

  const activeWorkflows = workflows.filter(w => !archivedWorkflows.some(a => a.id === w.id));
  const displayedWorkflows = workflowViewTab === 'active' ? activeWorkflows : archivedWorkflows;

  const filteredExecutions = executions.filter(exec => {
    if (executionFilter !== 'all' && exec.status !== executionFilter) return false;
    return true;
  });

  const handleFilterChange = (filter: 'all' | 'success' | 'error') => {
    setExecutionFilter(filter);
    onExecutionFilterChange?.(filter);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-white/40" />
            <span className="text-white/40 text-xs">Total</span>
          </div>
          <p className="text-white font-semibold text-lg">{executionMetrics?.total || 0}</p>
        </div>
        <div
          className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-green-800 transition-colors"
          onClick={() => handleFilterChange('success')}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-400/60" />
            <span className="text-white/40 text-xs">Success</span>
          </div>
          <p className="text-green-400 font-semibold text-lg">{executionMetrics?.success || 0}</p>
        </div>
        <div
          className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-red-800 transition-colors"
          onClick={() => handleFilterChange('error')}
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-400/60" />
            <span className="text-white/40 text-xs">Failed</span>
          </div>
          <p className="text-red-400 font-semibold text-lg">{executionMetrics?.error || 0}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-gray-400/60" />
            <span className="text-white/40 text-xs">Success Rate</span>
          </div>
          <p className="text-gray-400 font-semibold text-lg">
            {executionMetrics?.successRate?.toFixed(1) || 0}%
          </p>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Workflows */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-gray-400" />
              Workflows
              <span className="text-gray-500 font-normal text-sm">
                ({displayedWorkflows.length})
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWorkflowViewTab('active')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  workflowViewTab === 'active'
                    ? 'bg-gray-800/30 text-white'
                    : 'text-gray-500 hover:text-white/60'
                )}
              >
                Active
              </button>
              <button
                onClick={() => setWorkflowViewTab('archived')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  workflowViewTab === 'archived'
                    ? 'bg-gray-800/30 text-white'
                    : 'text-gray-500 hover:text-white/60'
                )}
              >
                Archived
              </button>
            </div>
          </div>

          {/* Workflow list */}
          <div className="space-y-2">
            {displayedWorkflows.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
                <Zap className="h-8 w-8 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">
                  {workflowViewTab === 'active' ? 'No active workflows' : 'No archived workflows'}
                </p>
              </div>
            ) : (
              displayedWorkflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all cursor-pointer"
                  onClick={() => onWorkflowClick?.(workflow)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        workflow.active ? 'bg-green-400' : 'bg-gray-500'
                      )} />
                      <span className="text-white font-medium">{workflow.name}</span>
                      {workflow.tags && workflow.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {workflow.tags.slice(0, 2).map(tag => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded',
                        workflow.active
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-gray-800 text-gray-500'
                      )}>
                        {workflow.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Executions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-400" />
              Recent Activity
            </h2>
            {executionFilter !== 'all' && (
              <button
                onClick={() => handleFilterChange('all')}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear filter
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredExecutions.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center">
                <Activity className="h-6 w-6 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No executions yet</p>
              </div>
            ) : (
              filteredExecutions.slice(0, 10).map((exec) => (
                <div
                  key={exec.id}
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-all cursor-pointer"
                  onClick={() => onExecutionClick?.(exec)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {exec.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : exec.status === 'error' ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-400" />
                      )}
                      <span className="text-white text-sm truncate max-w-[150px]">
                        {exec.workflowName || 'Unknown'}
                      </span>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {new Date(exec.startedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
