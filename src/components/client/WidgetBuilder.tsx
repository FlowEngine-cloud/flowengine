'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, RefreshCw, Zap, Palette, FileText } from 'lucide-react';

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'file' | 'checkbox' | 'radio' | 'phone' | 'url';
  required: boolean;
  options?: string[]; // For select/checkbox/radio types
  accept?: string; // For file type: accepted file types
  maxSize?: number; // For file type: max size in MB
  multiple?: boolean; // For file/checkbox/select: allow multiple
}

// Preset color options
const COLOR_PRESETS = [
  { name: 'White', bg: '#FFFFFF', text: '#000000' },
  { name: 'Black', bg: '#000000', text: '#FFFFFF' },
  { name: 'Blue', bg: '#3B82F6', text: '#FFFFFF' },
  { name: 'Green', bg: '#22C55E', text: '#FFFFFF' },
  { name: 'Red', bg: '#EF4444', text: '#FFFFFF' },
  { name: 'Purple', bg: '#8B5CF6', text: '#FFFFFF' },
  { name: 'Orange', bg: '#F97316', text: '#FFFFFF' },
  { name: 'Teal', bg: '#14B8A6', text: '#FFFFFF' },
];

interface Workflow {
  id: string;
  name: string;
  webhookUrl?: string | null;
}

interface Template {
  id: string;
  name: string;
  widget_type: 'button' | 'form';
  form_fields?: FormField[];
  styles?: {
    buttonColor?: string;
    textColor?: string;
  };
}

interface WidgetBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (widget: {
    name: string;
    widgetType: 'button' | 'form';
    webhookUrl: string;
    formFields?: FormField[];
    workflowId?: string;
    workflowName?: string;
    buttonColor?: string;
    textColor?: string;
  }) => void;
  isSaving?: boolean;
  workflows?: Workflow[];
  templates?: Template[];
  onLoadTemplates?: () => void;
}

export default function WidgetBuilder({
  isOpen,
  onClose,
  onSave,
  isSaving = false,
  workflows = [],
  templates = [],
  onLoadTemplates,
}: WidgetBuilderProps) {
  const [name, setName] = useState('');
  const [widgetType, setWidgetType] = useState<'button' | 'form'>('button');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [formFields, setFormFields] = useState<FormField[]>([
    { name: '', type: 'text', required: true },
  ]);
  const [buttonColor, setButtonColor] = useState('#FFFFFF');
  const [textColor, setTextColor] = useState('#000000');
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load templates when modal opens
  useEffect(() => {
    if (isOpen && onLoadTemplates) {
      onLoadTemplates();
    }
  }, [isOpen, onLoadTemplates]);

  // Apply template when selected
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const template = templates.find(t => t.id === templateId);
    if (template) {
      setName(template.name);
      setWidgetType(template.widget_type);
      if (template.form_fields && template.form_fields.length > 0) {
        setFormFields(template.form_fields);
      }
      if (template.styles?.buttonColor) {
        setButtonColor(template.styles.buttonColor);
      }
      if (template.styles?.textColor) {
        setTextColor(template.styles.textColor);
      }
    }
  };

  // Auto-fill webhook URL when workflow is selected
  const handleWorkflowSelect = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    const workflow = workflows.find(w => w.id === workflowId);
    if (workflow?.webhookUrl) {
      setWebhookUrl(workflow.webhookUrl);
    }
  };

  const addField = () => {
    setFormFields([...formFields, { name: '', type: 'text', required: false }]);
  };

  const removeField = (index: number) => {
    setFormFields(formFields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFormFields(
      formFields.map((field, i) => (i === index ? { ...field, ...updates } : field))
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (workflows.length > 0 && !selectedWorkflowId) {
      newErrors.workflow = 'Please select a workflow';
    }

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!webhookUrl.trim()) {
      newErrors.webhookUrl = 'Webhook URL is required';
    } else {
      try {
        new URL(webhookUrl);
      } catch {
        newErrors.webhookUrl = 'Invalid URL format';
      }
    }

    if (widgetType === 'form') {
      const hasValidFields = formFields.some(f => f.name.trim());
      if (!hasValidFields) {
        newErrors.fields = 'At least one field with a name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);
    const widget: any = {
      name: name.trim(),
      widgetType,
      webhookUrl: webhookUrl.trim(),
      workflowId: selectedWorkflowId || undefined,
      workflowName: selectedWorkflow?.name || undefined,
      buttonColor,
      textColor,
    };

    if (widgetType === 'form') {
      widget.formFields = formFields.filter(f => f.name.trim());
    }

    onSave(widget);
  };

  const handleClose = () => {
    if (!isSaving) {
      setName('');
      setWidgetType('button');
      setWebhookUrl('');
      setSelectedWorkflowId('');
      setSelectedTemplateId('');
      setFormFields([{ name: '', type: 'text', required: true }]);
      setButtonColor('#FFFFFF');
      setTextColor('#000000');
      setShowCustomColor(false);
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          handleClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg bg-gray-900/90 rounded-lg border border-gray-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg">
              <Zap className="h-5 w-5 text-white/60" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Add Quick Action</h2>
              <p className="text-white/60 text-sm mt-0.5">
                Create a button or form for your client
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Template Selector (if templates available) */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Start from Template
                </span>
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
              >
                <option value="">Create from scratch...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.widget_type})
                  </option>
                ))}
              </select>
              <p className="text-gray-500 text-xs mt-1">
                Select a template from UI Studio to pre-fill fields
              </p>
            </div>
          )}

          {/* component type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWidgetType('button')}
                className={`p-4 rounded-lg border transition-all cursor-pointer text-left ${
                  widgetType === 'button'
                    ? 'border-white/30 bg-white/5'
                    : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                }`}
              >
                <div className="text-white font-medium">Button</div>
                <div className="text-gray-400 text-xs mt-0.5">
                  Single click triggers webhook
                </div>
              </button>
              <button
                type="button"
                onClick={() => setWidgetType('form')}
                className={`p-4 rounded-lg border transition-all cursor-pointer text-left ${
                  widgetType === 'form'
                    ? 'border-white/30 bg-white/5'
                    : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                }`}
              >
                <div className="text-white font-medium">Form</div>
                <div className="text-gray-400 text-xs mt-0.5">
                  Collect data before trigger
                </div>
              </button>
            </div>
          </div>

          {/* Workflow Selector (only when workflows are available) */}
          {workflows.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Workflow</label>
              <select
                value={selectedWorkflowId}
                onChange={(e) => handleWorkflowSelect(e.target.value)}
                className={`w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white ${
                  errors.workflow ? 'border-red-500' : 'border-gray-800'
                }`}
              >
                <option value="">Select a workflow...</option>
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                    {workflow.webhookUrl ? ' (has webhook)' : ''}
                  </option>
                ))}
              </select>
              {errors.workflow && <p className="text-red-400 text-sm mt-1">{errors.workflow}</p>}
              <p className="text-gray-500 text-xs mt-1">
                Quick actions are associated with specific workflows
              </p>
            </div>
          )}

          {/* Widget Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={widgetType === 'button' ? 'e.g., Run Report' : 'e.g., Submit Request'}
              className={`w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white ${
                errors.name ? 'border-red-500' : 'border-gray-800'
              }`}
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Webhook URL</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-instance.example.com/webhook/..."
              className={`w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white ${
                errors.webhookUrl ? 'border-red-500' : 'border-gray-800'
              }`}
            />
            {errors.webhookUrl && (
              <p className="text-red-400 text-sm mt-1">{errors.webhookUrl}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Get this URL from your n8n webhook node
            </p>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <span className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Button Color
              </span>
            </label>

            {/* Color Presets */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setButtonColor(preset.bg);
                    setTextColor(preset.text);
                    setShowCustomColor(false);
                  }}
                  className={`p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                    buttonColor === preset.bg && textColor === preset.text
                      ? 'border-white/50 ring-1 ring-white/30'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full border border-gray-600"
                    style={{ backgroundColor: preset.bg }}
                  />
                  <span className="text-xs text-gray-400">{preset.name}</span>
                </button>
              ))}
            </div>

            {/* Custom Color Toggle */}
            <button
              type="button"
              onClick={() => setShowCustomColor(!showCustomColor)}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showCustomColor ? '− Hide' : '+ Custom'} colors
            </button>

            {/* Custom Color Inputs */}
            {showCustomColor && (
              <div className="mt-3 p-3 bg-gray-800/30 border border-gray-700 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 w-20">Background</label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="color"
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-600 bg-transparent"
                    />
                    <input
                      type="text"
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      placeholder="#FFFFFF"
                      className="flex-1 px-3 py-1.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-white"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 w-20">Text</label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-600 bg-transparent"
                    />
                    <input
                      type="text"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      placeholder="#000000"
                      className="flex-1 px-3 py-1.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1.5">Preview</label>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: buttonColor, color: textColor }}
              >
                {name || 'Button Preview'}
              </button>
            </div>
          </div>

          {/* Form Fields (only for form type) */}
          {widgetType === 'form' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Form Fields
              </label>
              {errors.fields && (
                <p className="text-red-400 text-sm mb-2">{errors.fields}</p>
              )}
              <div className="space-y-3">
                {formFields.map((field, index) => (
                  <div key={index} className="space-y-2">
                  <div
                    className="flex items-start gap-2 p-3 bg-gray-800/30 border border-gray-700 rounded-lg"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => updateField(index, { name: e.target.value })}
                        placeholder="Field name"
                        className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                      />
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateField(index, { type: e.target.value as FormField['type'] })
                        }
                        className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-white"
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="number">Number</option>
                        <option value="phone">Phone</option>
                        <option value="url">URL</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Dropdown</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="radio">Radio</option>
                        <option value="date">Date</option>
                        <option value="time">Time</option>
                        <option value="file">File Upload</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap pt-2">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                        className="rounded border-gray-600 bg-gray-800 accent-white"
                      />
                      Required
                    </label>
                    {formFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {/* Options input for select/checkbox/radio */}
                  {['select', 'checkbox', 'radio'].includes(field.type) && (
                    <div className="ml-2">
                      <input
                        type="text"
                        value={(field.options || []).join(', ')}
                        onChange={(e) => updateField(index, {
                          options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                        })}
                        placeholder="Options (comma separated, e.g., Option 1, Option 2)"
                        className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                      />
                    </div>
                  )}
                  {/* File upload settings */}
                  {field.type === 'file' && (
                    <div className="ml-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={field.accept || ''}
                          onChange={(e) => updateField(index, { accept: e.target.value })}
                          placeholder="Accepted types (e.g., image/*,.pdf)"
                          className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                        />
                        <input
                          type="number"
                          value={field.maxSize || ''}
                          onChange={(e) => updateField(index, { maxSize: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="Max size (MB)"
                          className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-white"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={field.multiple || false}
                          onChange={(e) => updateField(index, { multiple: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-900/50 text-white focus:ring-white focus:ring-offset-0"
                        />
                        Allow multiple files
                      </label>
                    </div>
                  )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addField}
                className="mt-3 flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-white hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 text-black rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Component</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
