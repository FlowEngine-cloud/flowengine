'use client';

import { motion } from 'framer-motion';
import { Download, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifiedSkeleton } from '@/components/ui/skeletons';
import TemplateCard from '@/components/templates/TemplateCard';
import type { WorkflowTemplate } from '../types';

interface TemplatesTabProps {
  templates: WorkflowTemplate[];
  loading: boolean;
  refreshing?: boolean;
  agencyLogoUrl?: string | null;
  mode: 'agency' | 'client';
  importingTemplate?: boolean;
  importingTemplateId?: string | null;
  onRefresh: () => void;
  onSelectTemplate: (template: WorkflowTemplate) => void;
  onImportTemplate?: (template: WorkflowTemplate) => void;
}

export default function TemplatesTab({
  templates,
  loading,
  refreshing = false,
  agencyLogoUrl,
  mode,
  importingTemplate = false,
  importingTemplateId = null,
  onRefresh,
  onSelectTemplate,
  onImportTemplate,
}: TemplatesTabProps) {
  const handleTemplateClick = (template: WorkflowTemplate) => {
    if (template.can_import && onImportTemplate) {
      // Direct import without modal
      onImportTemplate(template);
    } else {
      // Show modal for missing credentials info
      onSelectTemplate(template);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Workflow Templates</h2>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'client'
              ? 'Pre-built workflows ready to import to your instance'
              : 'Pre-built workflows ready to import to this instance'}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', (loading || refreshing) && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <UnifiedSkeleton count={6} />
      ) : templates.length === 0 ? (
        <div className="bg-gray-900/50 border border-dashed border-gray-800 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
            <Download className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No templates available</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {mode === 'client'
              ? "Your agency hasn't added any workflow templates yet. Check back later!"
              : 'No workflow templates have been added yet. Check back later!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <TemplateCard
                template={template}
                onClick={() => handleTemplateClick(template)}
                disabled={importingTemplate}
                loading={importingTemplateId === template.id}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
