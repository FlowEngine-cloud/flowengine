'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, MousePointer, FileText, Check } from 'lucide-react';

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  widget_type: 'button' | 'form' | 'chatbot';
  form_fields: FormField[] | null;
  default_webhook_path: string | null;
  category_id: string | null;
  category: Category | null;
  instance_id: string | null;
  instance: { id: string; instance_name: string } | null;
}

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: Template, webhookUrl?: string) => void;
  templates: Template[];
  categories: Category[];
  instanceUrl?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  prefilledWebhook?: string;
  workflowName?: string;
}

export default function TemplatePicker({
  isOpen,
  onClose,
  onSelect,
  templates,
  categories,
  instanceUrl,
  isLoading = false,
  isSaving = false,
  prefilledWebhook,
  workflowName,
}: TemplatePickerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplate(null);
      setWebhookUrl(prefilledWebhook || '');
      setSearchQuery('');
      setSelectedCategory(null);
      setError('');
    }
  }, [isOpen, prefilledWebhook]);

  // Auto-fill webhook URL when template is selected (only if no prefilled webhook)
  useEffect(() => {
    if (prefilledWebhook) return;

    if (selectedTemplate?.default_webhook_path && instanceUrl) {
      const baseUrl = instanceUrl.replace(/\/$/, '');
      const path = selectedTemplate.default_webhook_path.startsWith('/')
        ? selectedTemplate.default_webhook_path
        : '/' + selectedTemplate.default_webhook_path;
      setWebhookUrl(baseUrl + path);
    } else if (selectedTemplate) {
      setWebhookUrl('');
    }
  }, [selectedTemplate, instanceUrl, prefilledWebhook]);

  const handleConfirm = () => {
    if (!selectedTemplate) return;

    const finalWebhook = prefilledWebhook || webhookUrl.trim();

    if (!finalWebhook) {
      setError('Webhook URL is required');
      return;
    }

    try {
      new URL(finalWebhook);
    } catch {
      setError('Invalid URL format');
      return;
    }

    onSelect(selectedTemplate, finalWebhook);
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !selectedCategory ||
      (selectedCategory === 'uncategorized' ? !t.category_id : t.category_id === selectedCategory);

    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          handleClose();
        }
      }}
    >
      <div className="w-full max-w-xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-white">Add Component</h2>
              {workflowName && (
                <p className="text-sm text-white/40 mt-1">
                  for <span className="text-white/60">{workflowName}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="p-2 -mr-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="px-6 py-4 border-b border-white/5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-white/5 flex items-center justify-center">
                <FileText className="w-7 h-7 text-white/20" />
              </div>
              <p className="text-white/40 text-sm">No templates found</p>
              <p className="text-white/30 text-xs mt-1">
                Create templates in UI Studio first
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'bg-white/5 border-white/20'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      template.widget_type === 'button'
                        ? 'bg-blue-500/10'
                        : 'bg-emerald-500/10'
                    }`}>
                      {template.widget_type === 'button' ? (
                        <MousePointer className="w-5 h-5 text-blue-400" />
                      ) : (
                        <FileText className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-white text-sm">{template.name}</span>
                        {template.category && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: `${template.category.color}15`,
                              color: template.category.color,
                            }}
                          >
                            {template.category.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <span className={template.widget_type === 'button' ? 'text-blue-400/70' : 'text-emerald-400/70'}>
                          {template.widget_type === 'button' ? 'Button' : 'Form'}
                        </span>
                        {template.widget_type === 'form' && template.form_fields && (
                          <span>
                            {template.form_fields.length} field{template.form_fields.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {selectedTemplate?.id === template.id && (
                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Webhook URL Input - only show if NOT coming from workflow */}
        {selectedTemplate && !prefilledWebhook && (
          <div className="px-6 py-4 border-t border-white/5">
            <label className="block text-sm text-white/40 mb-2">
              Webhook URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setError('');
              }}
              placeholder={`${instanceUrl}/webhook/...`}
              className={`w-full px-4 py-3 bg-white/[0.03] border rounded-xl text-white placeholder:text-white/20 focus:outline-none transition-colors ${
                error ? 'border-red-500/50 focus:border-red-500/50' : 'border-white/10 focus:border-white/20'
              }`}
            />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="flex-1 py-3 text-white/50 hover:text-white rounded-xl text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving || !selectedTemplate}
            className="flex-1 py-3 bg-white text-black rounded-xl text-sm font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <span>Add Component</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
