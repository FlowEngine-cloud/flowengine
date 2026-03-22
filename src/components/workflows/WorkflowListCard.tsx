'use client';

import { motion } from 'framer-motion';
import {
  Zap,
  Key,
  MousePointer,
  FileText,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  ArrowUpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CredentialIcon from '@/components/credentials/CredentialIcon';
import Link from 'next/link';

export interface WorkflowCredentialStatus {
  type: string;
  name: string;
  connected: boolean;
}

export interface WorkflowWidgetInfo {
  id: string;
  name: string;
  type: 'button' | 'form' | 'chatbot';
}

export interface WorkflowUpdateInfo {
  importId: string;
  installedVersion: number;
  latestVersion: number;
  changelog?: string | null;
}

export interface WorkflowListCardProps {
  workflow: {
    id: string;
    name: string;
    active: boolean;
    instanceId?: string;
    instanceName?: string;
    credentials?: WorkflowCredentialStatus[];
    widgets?: WorkflowWidgetInfo[];
    updateInfo?: WorkflowUpdateInfo;
  };
  index?: number;
  href?: string;
  showInstance?: boolean;
  onClick?: () => void;
  onUpdateClick?: (updateInfo: WorkflowUpdateInfo) => void;
}

export default function WorkflowListCard({
  workflow,
  index = 0,
  href,
  showInstance = false,
  onClick,
  onUpdateClick,
}: WorkflowListCardProps) {
  const hasCredentials = workflow.credentials && workflow.credentials.length > 0;
  const hasWidgets = workflow.widgets && workflow.widgets.length > 0;
  const hasUpdate = workflow.updateInfo && workflow.updateInfo.latestVersion > workflow.updateInfo.installedVersion;
  const connectedCredentials = workflow.credentials?.filter(c => c.connected) || [];
  const missingCredentials = workflow.credentials?.filter(c => !c.connected) || [];

  const handleUpdateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (workflow.updateInfo && onUpdateClick) {
      onUpdateClick(workflow.updateInfo);
    }
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        'bg-gray-900/50 border border-gray-800 rounded-xl hover:border-purple-500/30 transition-all',
        (href || onClick) && 'cursor-pointer group'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            workflow.active
              ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20'
              : 'bg-gray-700/50'
          )}>
            <Zap className={cn(
              'h-5 w-5',
              workflow.active ? 'text-green-400' : 'text-gray-500'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-medium truncate group-hover:text-purple-400 transition-colors">
                {workflow.name}
              </p>
              {/* Summary badges */}
              <div className="flex items-center gap-1.5">
                {hasUpdate && (
                  <button
                    onClick={handleUpdateClick}
                    className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-500/20 transition-colors"
                    title={`Update available: v${workflow.updateInfo!.installedVersion} → v${workflow.updateInfo!.latestVersion}`}
                  >
                    <ArrowUpCircle className="h-3 w-3" />
                    <span>Update</span>
                  </button>
                )}
                {hasWidgets && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-xs text-purple-400">
                    <MousePointer className="h-3 w-3" />
                    <span>{workflow.widgets!.length}</span>
                  </div>
                )}
                {missingCredentials.length > 0 && (
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400">
                    <Key className="h-3 w-3" />
                    <span>{missingCredentials.length}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                'text-xs',
                workflow.active ? 'text-green-400' : 'text-gray-500'
              )}>
                {workflow.active ? 'Active' : 'Inactive'}
              </span>
              {showInstance && workflow.instanceName && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className="text-xs text-gray-500 truncate max-w-[150px]">{workflow.instanceName}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {(href || onClick) && (
          <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-purple-400 flex-shrink-0 transition-colors" />
        )}
      </div>

      {/* Credentials and Widgets */}
      {(hasCredentials || hasWidgets) && (
        <div className="px-4 pb-4 space-y-3">
          {/* Credentials */}
          {hasCredentials && (
            <div className="flex gap-1.5 flex-wrap">
              {connectedCredentials.slice(0, 4).map((cred, i) => (
                <div
                  key={`connected-${i}`}
                  className="flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-800/50 rounded text-xs text-green-400"
                  title={`${cred.name}: Connected`}
                >
                  <CredentialIcon type={cred.type.replace(/Api$|OAuth2Api$/i, '').toLowerCase()} fallback="none" className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">{cred.name}</span>
                </div>
              ))}
              {missingCredentials.slice(0, 3).map((cred, i) => (
                <div
                  key={`missing-${i}`}
                  className="flex items-center gap-1 px-2 py-1 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400"
                  title={`${cred.name}: Not connected`}
                >
                  <CredentialIcon type={cred.type.replace(/Api$|OAuth2Api$/i, '').toLowerCase()} fallback="none" className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">{cred.name}</span>
                </div>
              ))}
              {(workflow.credentials?.length || 0) > 7 && (
                <span className="text-[10px] text-gray-500 self-center">
                  +{(workflow.credentials?.length || 0) - 7}
                </span>
              )}
            </div>
          )}

          {/* Widgets */}
          {hasWidgets && (
            <div className="flex gap-1.5 flex-wrap">
              {workflow.widgets?.slice(0, 4).map((widget) => (
                <div
                  key={widget.id}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-900/30 border border-purple-800/50 rounded text-xs text-purple-400"
                  title={`${widget.name} (${widget.type})`}
                >
                  {widget.type === 'button' && <MousePointer className="h-3 w-3" />}
                  {widget.type === 'form' && <FileText className="h-3 w-3" />}
                  {widget.type === 'chatbot' && <MessageSquare className="h-3 w-3" />}
                  <span className="truncate max-w-[80px]">{widget.name}</span>
                </div>
              ))}
              {(workflow.widgets?.length || 0) > 4 && (
                <span className="text-[10px] text-gray-500 self-center">
                  +{(workflow.widgets?.length || 0) - 4}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
