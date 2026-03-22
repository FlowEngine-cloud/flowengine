'use client';

/**
 * AddParameterModal Component
 * Modal for configuring node parameters that are missing in a workflow
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, Settings, ExternalLink, Rss, FileText, Globe, Terminal, Mail, FolderOpen, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { MissingParameterInfo, NodeParameterField } from '@/lib/n8n/nodeParameters';

interface AddParameterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, parameters: Record<string, any>) => Promise<void>;
  parameterInfo: MissingParameterInfo | null;
  workflowName?: string;
  accessToken?: string; // Auth token for fetching dynamic options
}

// Icon mapping for node types
const NodeIcon = ({ type, className }: { type: string; className?: string }) => {
  const iconClass = cn('h-5 w-5', className);
  switch (type) {
    case 'rss':
      return <Rss className={iconClass} />;
    case 'form':
      return <FileText className={iconClass} />;
    case 'api':
      return <Globe className={iconClass} />;
    case 'terminal':
      return <Terminal className={iconClass} />;
    case 'email':
      return <Mail className={iconClass} />;
    case 'ftp':
      return <FolderOpen className={iconClass} />;
    case 'workflow':
      return <Workflow className={iconClass} />;
    default:
      return <Settings className={iconClass} />;
  }
};

export default function AddParameterModal({
  isOpen,
  onClose,
  onSave,
  parameterInfo,
  workflowName,
  accessToken,
}: AddParameterModalProps) {
  // Close on ESC key
  useEscapeKey(isOpen, onClose);

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ name: string; value: string }>>>({});

  // Reset state when modal opens/closes or parameter info changes
  useEffect(() => {
    if (isOpen && parameterInfo) {
      // Initialize with defaults
      const defaults: Record<string, any> = {};
      for (const field of parameterInfo.config.fields) {
        if (field.default !== undefined) {
          defaults[field.name] = field.default;
        }
      }
      setFormData(defaults);
      setError(null);
      setDynamicOptions({});
    } else if (!isOpen) {
      setFormData({});
      setError(null);
      setDynamicOptions({});
    }
  }, [isOpen, parameterInfo]);

  // Fetch dynamic options for fields with optionsUrl
  useEffect(() => {
    if (!isOpen || !parameterInfo) return;

    const fetchDynamicOptions = async () => {
      for (const field of parameterInfo.config.fields) {
        if (field.type === 'select' && (field as any).optionsUrl) {
          try {
            const headers: HeadersInit = {};
            if (accessToken) {
              headers['Authorization'] = `Bearer ${accessToken}`;
            }

            const response = await fetch((field as any).optionsUrl, { headers });
            if (response.ok) {
              const data = await response.json();

              // Transform based on format
              let options: Array<{ name: string; value: string }> = [];

              if ((field as any).optionsFormat === 'openai-models') {
                // OpenAI /v1/models format: { data: [{ id: string, ... }] }
                if (data.data && Array.isArray(data.data)) {
                  options = data.data.map((item: any) => ({
                    name: item.id || item.model_name || item.name,
                    value: item.id || item.model_name || item.value || item.name,
                  }));
                }
              } else {
                // Simple format: [{ name: string, value: string }]
                options = Array.isArray(data) ? data : [];
              }

              setDynamicOptions(prev => ({
                ...prev,
                [field.name]: options,
              }));
            }
          } catch (e) {
            console.error(`Failed to fetch dynamic options for ${field.name}:`, e);
          }
        }
      }
    };

    fetchDynamicOptions();
  }, [isOpen, parameterInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parameterInfo) return;

    // Validate required fields
    for (const field of parameterInfo.config.fields) {
      if (field.required) {
        const value = formData[field.name];
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
          setError(`${field.displayName} is required`);
          return;
        }
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(parameterInfo.nodeId, formData);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save parameters');
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field: NodeParameterField) => {
    const value = formData[field.name] ?? '';
    const fieldAny = field as any;

    // Select field (with dynamic or static options)
    if (field.type === 'select') {
      // Use dynamic options if available, otherwise fall back to static options
      const options = dynamicOptions[field.name] || field.options || [];
      const isLoading = fieldAny.optionsUrl && !dynamicOptions[field.name];

      return (
        <div key={field.name} className="space-y-1.5">
          <label className="block text-sm font-medium text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <select
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-white focus:border-white disabled:opacity-50"
          >
            {isLoading ? (
              <option value="">Loading options...</option>
            ) : options.length === 0 ? (
              <option value="">No options available</option>
            ) : (
              options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.name}
                </option>
              ))
            )}
          </select>
          {field.description && (
            <p className="text-xs text-gray-500">{field.description}</p>
          )}
        </div>
      );
    }

    // Boolean field
    if (field.type === 'boolean') {
      return (
        <div key={field.name} className="flex items-center gap-3">
          <input
            type="checkbox"
            id={field.name}
            checked={formData[field.name] || false}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-white focus:ring-white"
          />
          <label htmlFor={field.name} className="text-sm text-white">
            {field.displayName}
          </label>
        </div>
      );
    }

    // Number field
    if (field.type === 'number') {
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="block text-sm font-medium text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: parseFloat(e.target.value) || 0 })}
            placeholder={field.placeholder}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
          />
          {field.description && (
            <p className="text-xs text-gray-500">{field.description}</p>
          )}
        </div>
      );
    }

    // URL field (with validation styling)
    if (field.type === 'url') {
      const isValidUrl = !value || value.startsWith('http://') || value.startsWith('https://');
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="block text-sm font-medium text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <input
            type="url"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            placeholder={field.placeholder}
            className={cn(
              'w-full px-4 py-3 bg-gray-800/50 border rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white',
              !isValidUrl ? 'border-red-500' : 'border-gray-700'
            )}
          />
          {!isValidUrl && (
            <p className="text-xs text-red-400">URL must start with http:// or https://</p>
          )}
          {field.description && isValidUrl && (
            <p className="text-xs text-gray-500">{field.description}</p>
          )}
        </div>
      );
    }

    // Default: string/text field
    return (
      <div key={field.name} className="space-y-1.5">
        <label className="block text-sm font-medium text-white">
          {field.displayName}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
          placeholder={field.placeholder}
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
        />
        {field.description && (
          <p className="text-xs text-gray-500">{field.description}</p>
        )}
      </div>
    );
  };

  if (!parameterInfo) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-800/50 flex items-center justify-center">
                  <NodeIcon type={parameterInfo.icon} className="text-gray-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Configure {parameterInfo.displayName}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {parameterInfo.nodeName} in {workflowName || 'workflow'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/50 flex items-center gap-2 text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Description */}
              <p className="text-sm text-gray-400">
                {parameterInfo.config.description}
              </p>

              {/* Form fields */}
              {parameterInfo.config.fields.map(renderField)}

              {/* n8n docs link */}
              <a
                href={`https://docs.n8n.io/integrations/builtin/core-nodes/${parameterInfo.nodeType.split('.').pop()?.toLowerCase()}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                View n8n documentation
              </a>
            </form>

            {/* Footer */}
            <div className="p-6 border-t border-gray-800">
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="w-full py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
