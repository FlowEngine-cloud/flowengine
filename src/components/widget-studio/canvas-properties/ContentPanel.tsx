'use client';

import React, { useState, useCallback } from 'react';
import { Type, MessageSquare, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, MousePointerClick, MessageCircle, MessagesSquare, Bot, HelpCircle, Headphones, AlertCircle, CheckCircle2, Sparkles, Heart, Star, Zap, Send, Coffee, Settings, User, Link, Paperclip } from 'lucide-react';

// Validation helper types
interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rules?: ValidationRule[];
  maxLength?: number;
  showCharCount?: boolean;
}

// Reusable validated input component
function ValidatedInput({
  label,
  value,
  onChange,
  rules = [],
  maxLength,
  showCharCount = false,
  className = '',
  ...props
}: ValidatedInputProps) {
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);

  const charCount = value?.length || 0;
  const isNearLimit = maxLength && charCount > maxLength * 0.8;

  // Only show validation after blur (not during typing)
  const showValidation = touched && !focused;
  const errors = showValidation ? rules.filter(rule => !rule.validate(value)).map(r => r.message) : [];
  const hasError = errors.length > 0;
  const isValid = showValidation && !hasError && value.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-400">{label}</label>
        {showCharCount && maxLength && (
          <span className={`text-xs ${isNearLimit ? 'text-yellow-400' : 'text-gray-500'}`}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={onChange}
          onBlur={() => { setTouched(true); setFocused(false); }}
          onFocus={() => setFocused(true)}
          maxLength={maxLength}
          className={`w-full px-4 py-3 bg-gray-800/30 border rounded-lg text-white placeholder:text-gray-500 transition-colors pr-10 ${
            hasError
              ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
              : isValid
                ? 'border-green-600 focus:ring-2 focus:ring-green-500 focus:border-green-500'
                : 'border-gray-700 focus:ring-2 focus:ring-white focus:border-white'
          } ${className}`}
          {...props}
        />
        {/* Validation icon - only show after blur */}
        {showValidation && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {hasError ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : isValid ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : null}
          </div>
        )}
      </div>
      {/* Error messages */}
      {hasError && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {errors[0]}
        </p>
      )}
    </div>
  );
}

// Validated textarea component
interface ValidatedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rules?: ValidationRule[];
  maxLength?: number;
  showCharCount?: boolean;
}

function ValidatedTextarea({
  label,
  value,
  onChange,
  rules = [],
  maxLength,
  showCharCount = false,
  rows = 3,
  className = '',
  ...props
}: ValidatedTextareaProps) {
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);

  const charCount = value?.length || 0;
  const isNearLimit = maxLength && charCount > maxLength * 0.8;

  // Only show validation after blur (not during typing)
  const showValidation = touched && !focused;
  const errors = showValidation ? rules.filter(rule => !rule.validate(value)).map(r => r.message) : [];
  const hasError = errors.length > 0;
  const isValid = showValidation && !hasError && value.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-400">{label}</label>
        {showCharCount && maxLength && (
          <span className={`text-xs ${isNearLimit ? 'text-yellow-400' : 'text-gray-500'}`}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
      <div className="relative">
        <textarea
          value={value}
          onChange={onChange}
          onBlur={() => { setTouched(true); setFocused(false); }}
          onFocus={() => setFocused(true)}
          rows={rows}
          maxLength={maxLength}
          className={`w-full px-4 py-3 pb-5 bg-gray-800/30 border rounded-lg text-white placeholder:text-gray-500 transition-colors resize-y min-h-[100px] ${
            hasError
              ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
              : isValid
                ? 'border-green-600 focus:ring-2 focus:ring-green-500 focus:border-green-500'
                : 'border-gray-700 focus:ring-2 focus:ring-white focus:border-white'
          } ${className}`}
          {...props}
        />
        {/* Resize handle indicator */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 pointer-events-none opacity-40">
          <div className="w-6 h-1 bg-gray-500 rounded-full" />
        </div>
      </div>
      {hasError && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {errors[0]}
        </p>
      )}
    </div>
  );
}

// Bubble icon options - expanded list
const BUBBLE_ICONS = [
  { id: 'message-circle', icon: MessageCircle, label: 'Chat' },
  { id: 'message-square', icon: MessageSquare, label: 'Message' },
  { id: 'messages-square', icon: MessagesSquare, label: 'Messages' },
  { id: 'bot', icon: Bot, label: 'Bot' },
  { id: 'headphones', icon: Headphones, label: 'Support' },
  { id: 'help-circle', icon: HelpCircle, label: 'Help' },
  { id: 'sparkles', icon: Sparkles, label: 'AI' },
  { id: 'heart', icon: Heart, label: 'Heart' },
  { id: 'star', icon: Star, label: 'Star' },
  { id: 'zap', icon: Zap, label: 'Zap' },
  { id: 'send', icon: Send, label: 'Send' },
  { id: 'coffee', icon: Coffee, label: 'Coffee' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'user', icon: User, label: 'User' },
];

// ChatbotConfig matches the interface from page.tsx
type ChatbotConfig = Record<string, any>;

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'file' | 'checkbox' | 'radio' | 'phone' | 'url';
  required: boolean;
  options?: string[];
  placeholder?: string;
  width?: '25' | '33' | '50' | '100';
  alignment?: 'left' | 'center' | 'right';
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  customBorderRadius?: string;
  customPadding?: string;
  customFontSize?: string;
  customHeight?: string;
}

interface ContentPanelProps {
  widgetType: 'chatbot' | 'form' | 'button';
  formFields: FormField[];
  chatbotConfig: ChatbotConfig;
  isCompact?: boolean;
  onFormFieldsChange: (fields: FormField[]) => void;
  onChatbotConfigChange: (config: ChatbotConfig) => void;
}

const POSITION_OPTIONS = [
  { id: 'bottom-right', label: 'Bottom Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'top-left', label: 'Top Left' },
];

const DISPLAY_MODES = [
  { id: 'popup', label: 'Popup', description: 'Opens as a floating window' },
  { id: 'embedded', label: 'Embedded', description: 'Embedded in page' },
];

export function ContentPanel({
  widgetType,
  formFields,
  chatbotConfig,
  isCompact = false,
  onFormFieldsChange,
  onChatbotConfigChange,
}: ContentPanelProps) {
  // State for expanded form field - moved to top level to avoid conditional hook
  const [expandedFieldIndex, setExpandedFieldIndex] = useState<number | null>(null);

  // Responsive grid class helper - use static classes for Tailwind purging
  const getGridClass = (cols: number) => {
    if (isCompact) return 'grid-cols-1';
    switch (cols) {
      case 2: return 'grid-cols-2';
      case 3: return 'grid-cols-3';
      case 4: return 'grid-cols-4';
      default: return 'grid-cols-1';
    }
  };

  const updateChatbotConfig = (updates: Partial<ChatbotConfig>) => {
    onChatbotConfigChange({
      ...chatbotConfig,
      ...updates,
    });
  };

  // Chatbot Content
  if (widgetType === 'chatbot') {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5 text-white" />
            <h3 className="text-lg font-medium text-white">Chatbot Content</h3>
          </div>
          <p className="text-sm text-gray-400">Configure chatbot text and behavior</p>
        </div>

        {/* Chatbot Name */}
        <ValidatedInput
          label="Chatbot Name"
          value={chatbotConfig.chatbotName || ''}
          onChange={(e) => updateChatbotConfig({ chatbotName: e.target.value })}
          placeholder="Chatbot"
          maxLength={50}
          showCharCount
          rules={[
            { validate: (v) => v.length > 0, message: 'Name is required' },
            { validate: (v) => v.length >= 2, message: 'Name must be at least 2 characters' },
          ]}
        />

        {/* Welcome Message */}
        <ValidatedTextarea
          label="Welcome Message"
          value={chatbotConfig.welcomeMessage || ''}
          onChange={(e) => updateChatbotConfig({ welcomeMessage: e.target.value })}
          placeholder="Hi! How can I help you today?"
          maxLength={500}
          showCharCount
          rows={3}
          rules={[
            { validate: (v) => v.length > 0, message: 'Welcome message is required' },
          ]}
        />

        {/* Input Placeholder */}
        <ValidatedInput
          label="Input Placeholder"
          value={chatbotConfig.placeholder || ''}
          onChange={(e) => updateChatbotConfig({ placeholder: e.target.value })}
          placeholder="Type your message..."
          maxLength={100}
          showCharCount
        />

        {/* Position Selector */}
        <div className="space-y-3">
          <label className="text-sm text-gray-400">Position</label>
          <div className={`grid ${getGridClass(2)} gap-2`}>
            {POSITION_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => updateChatbotConfig({ position: option.id })}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors truncate ${
                  chatbotConfig.position === option.id
                    ? 'bg-white text-black'
                    : 'bg-gray-800/30 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Display Mode */}
        <div className="space-y-3">
          <label className="text-sm text-gray-400">Display Mode</label>
          <div className="space-y-2">
            {DISPLAY_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => updateChatbotConfig({ displayMode: mode.id })}
                className={`w-full p-4 rounded-lg text-left transition-colors ${
                  chatbotConfig.displayMode === mode.id
                    ? 'bg-white text-black'
                    : 'bg-gray-800/30 border border-gray-700 hover:bg-gray-700'
                }`}
              >
                <div className="text-sm font-medium mb-1">{mode.label}</div>
                <div
                  className={`text-xs ${
                    chatbotConfig.displayMode === mode.id ? 'text-black/60' : 'text-gray-500'
                  }`}
                >
                  {mode.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bubble Icon Selector */}
        <div className="space-y-3">
          <label className="text-sm text-gray-400">Bubble Icon</label>
          {/* Icon Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {BUBBLE_ICONS.map((iconOption) => {
              const IconComponent = iconOption.icon;
              const isSelected = chatbotConfig.bubbleIcon === iconOption.id ||
                (!chatbotConfig.bubbleIcon && iconOption.id === 'message-circle');
              return (
                <button
                  key={iconOption.id}
                  onClick={() => updateChatbotConfig({ bubbleIcon: iconOption.id, bubbleIconCustom: undefined })}
                  className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-white text-black'
                      : 'bg-gray-800/30 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title={iconOption.label}
                >
                  <IconComponent className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          {/* Custom emoji/URL input */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center gap-2">
              <Link className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500">Or use custom emoji/URL</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatbotConfig.bubbleIconCustom || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  updateChatbotConfig({
                    bubbleIconCustom: value,
                    bubbleIcon: value ? 'custom' : 'message-circle'
                  });
                }}
                placeholder="🚀 or https://..."
                className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
              />
              {chatbotConfig.bubbleIconCustom && (
                <button
                  onClick={() => updateChatbotConfig({ bubbleIconCustom: undefined, bubbleIcon: 'message-circle' })}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-600">
              Paste an emoji or image URL for a custom bubble icon
            </p>
          </div>
        </div>

        {/* File Uploads */}
        <div className="space-y-3 pt-2 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-gray-400" />
            <label className="text-sm text-gray-400">File Uploads</label>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={chatbotConfig.allowFileUploads || false}
              onChange={(e) => updateChatbotConfig({ allowFileUploads: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-white"
            />
            <span className="text-sm text-gray-300">Enable File Uploads</span>
          </label>
          <p className="text-xs text-gray-500 ml-7">Let users attach files to their messages</p>

          {chatbotConfig.allowFileUploads && (
            <div className="space-y-2 ml-7">
              <label className="text-xs text-gray-400">Allowed File Types</label>
              <input
                type="text"
                value={chatbotConfig.allowedFileMimeTypes || ''}
                onChange={(e) => updateChatbotConfig({ allowedFileMimeTypes: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                placeholder="image/*,application/pdf,.doc,.docx"
              />
              <p className="text-[10px] text-gray-600">
                Comma-separated MIME types or extensions (leave empty for all types)
              </p>
            </div>
          )}
        </div>

      </div>
    );
  }

  // Form Content
  if (widgetType === 'form') {
    const FIELD_TYPES = [
      { id: 'text', label: 'Text' },
      { id: 'email', label: 'Email' },
      { id: 'number', label: 'Number' },
      { id: 'textarea', label: 'Text Area' },
      { id: 'select', label: 'Dropdown' },
      { id: 'date', label: 'Date' },
      { id: 'phone', label: 'Phone' },
      { id: 'checkbox', label: 'Checkbox' },
      { id: 'radio', label: 'Radio' },
      { id: 'file', label: 'File Upload' },
    ];

    const addField = (type: FormField['type']) => {
      const newField: FormField = {
        name: type.charAt(0).toUpperCase() + type.slice(1) + ' Field',
        type,
        required: false,
        placeholder: '',
        options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
      };
      onFormFieldsChange([...formFields, newField]);
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
      const updated = [...formFields];
      updated[index] = { ...updated[index], ...updates };
      onFormFieldsChange(updated);
    };

    const removeField = (index: number) => {
      onFormFieldsChange(formFields.filter((_, i) => i !== index));
      setExpandedFieldIndex(null);
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= formFields.length) return;
      const updated = [...formFields];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      onFormFieldsChange(updated);
      setExpandedFieldIndex(newIndex);
    };

    return (
      <div className="p-6 space-y-6">
        <div className="border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Type className="w-5 h-5 text-white" />
            <h3 className="text-lg font-medium text-white">Form Fields</h3>
          </div>
          <p className="text-sm text-gray-400">{formFields.length} fields configured</p>
        </div>

        {/* Field List */}
        <div className="space-y-2">
          {formFields.map((field, index) => (
            <div
              key={index}
              className={`border rounded-lg transition-all ${
                expandedFieldIndex === index
                  ? 'border-white bg-gray-800/50'
                  : 'border-gray-700 bg-gray-800/30'
              }`}
            >
              {/* Field Header */}
              <button
                onClick={() => setExpandedFieldIndex(expandedFieldIndex === index ? null : index)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left"
              >
                <GripVertical className="w-4 h-4 text-gray-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{field.name}</div>
                  <div className="text-xs text-gray-500">{field.type}{field.required ? ' • required' : ''}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedFieldIndex === index ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded Field Editor */}
              {expandedFieldIndex === index && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-700">
                  <div className="pt-3 space-y-2">
                    <label className="text-xs text-gray-400">Field Name</label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(index, { name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Placeholder</label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={(e) => updateField(index, { placeholder: e.target.value })}
                      placeholder="Enter placeholder text..."
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500"
                    />
                  </div>

                  {/* Options for select/checkbox/radio */}
                  {(field.type === 'select' || field.type === 'checkbox' || field.type === 'radio') && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Options (comma separated)</label>
                      <input
                        type="text"
                        value={field.options?.join(', ') || ''}
                        onChange={(e) => updateField(index, { options: e.target.value.split(',').map(s => s.trim()) })}
                        className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white"
                      />
                    </div>
                  )}

                  {/* File upload options */}
                  {field.type === 'file' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Accepted file types</label>
                        <input
                          type="text"
                          value={field.accept || ''}
                          onChange={(e) => updateField(index, { accept: e.target.value })}
                          placeholder="e.g., .pdf,.doc,.jpg"
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Max file size (MB)</label>
                        <input
                          type="number"
                          value={field.maxSize || ''}
                          onChange={(e) => updateField(index, { maxSize: e.target.value ? parseInt(e.target.value) : undefined })}
                          placeholder="10"
                          min="1"
                          max="100"
                          className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.multiple || false}
                          onChange={(e) => updateField(index, { multiple: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600"
                        />
                        <span className="text-sm text-gray-300">Allow multiple files</span>
                      </label>
                    </>
                  )}

                  {/* Width options */}
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Field Width</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { value: '25', label: '25%' },
                        { value: '33', label: '33%' },
                        { value: '50', label: '50%' },
                        { value: '100', label: '100%' },
                      ].map((w) => (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => updateField(index, { width: w.value as FormField['width'] })}
                          className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                            (field.width || '100') === w.value
                              ? 'bg-white text-black'
                              : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-white'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alignment for checkbox/radio */}
                  {(field.type === 'checkbox' || field.type === 'radio') && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Alignment</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { value: 'left', label: 'Left' },
                          { value: 'center', label: 'Center' },
                          { value: 'right', label: 'Right' },
                        ].map((a) => (
                          <button
                            key={a.value}
                            type="button"
                            onClick={() => updateField(index, { alignment: a.value as FormField['alignment'] })}
                            className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                              (field.alignment || 'left') === a.value
                                ? 'bg-white text-black'
                                : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-white'
                            }`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">Required field</span>
                  </label>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => moveField(index, 'up')}
                      disabled={index === 0}
                      className="p-2 rounded-lg bg-gray-800/30 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveField(index, 'down')}
                      disabled={index === formFields.length - 1}
                      className="p-2 rounded-lg bg-gray-800/30 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeField(index)}
                      className="p-2 rounded-lg bg-red-900/20 border border-red-800 text-red-400 hover:bg-red-900/30 ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Field */}
        <div className="space-y-3">
          <label className="text-sm text-gray-400">Add Field</label>
          <div className={`grid ${getGridClass(2)} gap-2`}>
            {FIELD_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => addField(type.id as FormField['type'])}
                className="px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Button Content - need styles prop passed to update button styles
  // For now, button content uses chatbotConfig for consistency
  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <MousePointerClick className="w-5 h-5 text-white" />
          <h3 className="text-lg font-medium text-white">Button Content</h3>
        </div>
        <p className="text-sm text-gray-400">Configure button text and behavior</p>
      </div>

      {/* Button Text */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Button Text</label>
        <input
          type="text"
          value={chatbotConfig.buttonText || 'Click Me'}
          onChange={(e) => updateChatbotConfig({ buttonText: e.target.value })}
          placeholder="Click Me"
          className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white transition-colors"
        />
      </div>

      {/* Button Size */}
      <div className="space-y-3">
        <label className="text-sm text-gray-400">Button Size</label>
        <div className={`grid ${getGridClass(3)} gap-2`}>
          {[
            { id: 'small', label: 'Small' },
            { id: 'medium', label: 'Medium' },
            { id: 'large', label: 'Large' },
          ].map((size) => (
            <button
              key={size.id}
              onClick={() => updateChatbotConfig({ buttonSize: size.id })}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                (chatbotConfig.buttonSize || 'medium') === size.id
                  ? 'bg-white text-black'
                  : 'bg-gray-800/30 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      {/* Button Width */}
      <div className="space-y-3">
        <label className="text-sm text-gray-400">Button Width</label>
        <div className={`grid ${getGridClass(2)} gap-2`}>
          {[
            { id: 'auto', label: 'Auto' },
            { id: 'full', label: 'Full Width' },
          ].map((width) => (
            <button
              key={width.id}
              onClick={() => updateChatbotConfig({ buttonWidth: width.id })}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors truncate ${
                (chatbotConfig.buttonWidth || 'auto') === width.id
                  ? 'bg-white text-black'
                  : 'bg-gray-800/30 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {width.label}
            </button>
          ))}
        </div>
      </div>

      {/* Button Icon */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Button Icon (emoji)</label>
        <input
          type="text"
          value={chatbotConfig.buttonIcon || ''}
          onChange={(e) => updateChatbotConfig({ buttonIcon: e.target.value })}
          placeholder="Optional icon..."
          className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-xl text-center"
          maxLength={2}
        />
      </div>

      {/* Hover Effect */}
      <div className="space-y-3">
        <label className="text-sm text-gray-400">Hover Effect</label>
        <div className="space-y-2">
          {[
            { id: 'none', label: 'None', description: 'No animation' },
            { id: 'scale', label: 'Scale', description: 'Grows slightly on hover' },
            { id: 'glow', label: 'Glow', description: 'Adds glow effect' },
          ].map((effect) => (
            <button
              key={effect.id}
              onClick={() => updateChatbotConfig({ buttonHoverEffect: effect.id })}
              className={`w-full p-3 rounded-lg text-left transition-colors ${
                (chatbotConfig.buttonHoverEffect || 'scale') === effect.id
                  ? 'bg-white text-black'
                  : 'bg-gray-800/30 border border-gray-700 hover:bg-gray-700'
              }`}
            >
              <div className="text-sm font-medium">{effect.label}</div>
              <div className={`text-xs ${
                (chatbotConfig.buttonHoverEffect || 'scale') === effect.id ? 'text-black/60' : 'text-gray-500'
              }`}>{effect.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
