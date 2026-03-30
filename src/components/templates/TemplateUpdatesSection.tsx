'use client';

import { ArrowUpCircle } from 'lucide-react';

export interface TemplateUpdate {
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

interface TemplateUpdatesSectionProps {
  updates: TemplateUpdate[];
  onViewAllClick: () => void;
}

/**
 * Simple notification banner for template updates
 * Shows ONE notification max - click to see details in modal
 */
export default function TemplateUpdatesSection({
  updates,
  onViewAllClick,
}: TemplateUpdatesSectionProps) {
  if (updates.length === 0) return null;

  return (
    <button
      onClick={onViewAllClick}
      className="w-full p-4 bg-gray-900/50 border border-green-500/40 rounded-xl flex items-center justify-between gap-3 hover:bg-gray-800/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
          <ArrowUpCircle className="h-4 w-4 text-green-400" />
        </div>
        <div className="text-left">
          <p className="text-white text-sm font-medium">
            {updates.length === 1
              ? 'Template Update Available'
              : `${updates.length} Template Updates Available`}
          </p>
          <p className="text-gray-400 text-xs">
            Click to view and apply updates
          </p>
        </div>
      </div>
      <span className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-xs font-medium">
        View
      </span>
    </button>
  );
}
