'use client';

/**
 * CredentialParameterModal Component
 * Reusable modal for configuring node parameters dynamically from workflow
 * Used across all portals: agency, client, and general
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, Settings, Calendar, Clock, FolderOpen, Mail, Phone, FileText, ChevronDown, ChevronRight, Zap, Copy, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import CredentialIcon from './CredentialIcon';
import type { CredentialParamInfo } from '@/lib/n8n/credentialNodeParams';

/**
 * Common n8n expression templates for dynamic data
 * Organized by category with user-friendly descriptions
 */
const EXPRESSION_TEMPLATES = [
  // === DATA ACCESS ===
  { category: 'Data Access', label: 'Data from previous step', value: '{{ $json.fieldName }}', description: 'Use data that flows into this node' },
  { category: 'Data Access', label: 'Current input item', value: '{{ $input.item.json }}', description: 'Current item being processed' },
  { category: 'Data Access', label: 'First input item', value: '{{ $input.first().json }}', description: 'First item from input' },
  { category: 'Data Access', label: 'Last input item', value: '{{ $input.last().json }}', description: 'Last item from input' },
  { category: 'Data Access', label: 'All input items', value: '{{ $input.all() }}', description: 'All items as array' },
  { category: 'Data Access', label: 'Item count', value: '{{ $input.length }}', description: 'Number of input items' },
  { category: 'Data Access', label: 'Current item index', value: '{{ $itemIndex }}', description: 'Index of current item (0-based)' },
  { category: 'Data Access', label: 'Nested field access', value: '{{ $json.parent.child }}', description: 'Access nested objects' },
  { category: 'Data Access', label: 'Array element', value: '{{ $json.items[0] }}', description: 'Access array by index' },
  { category: 'Data Access', label: 'Default value', value: '{{ $json.field ?? "default" }}', description: 'Provide fallback if null/undefined' },

  // === NODE REFERENCES ===
  { category: 'Node References', label: 'Data from specific node', value: '{{ $("Node Name").item.json }}', description: 'Get data from named node' },
  { category: 'Node References', label: 'First item from node', value: '{{ $("Node Name").first().json }}', description: 'First item from specific node' },
  { category: 'Node References', label: 'All items from node', value: '{{ $("Node Name").all() }}', description: 'All items from specific node' },
  { category: 'Node References', label: 'Current node name', value: '{{ $node.name }}', description: 'This node\'s name' },

  // === DATE & TIME ===
  { category: 'Date & Time', label: 'Current date & time', value: '{{ $now }}', description: 'Current timestamp' },
  { category: 'Date & Time', label: 'Today\'s date', value: '{{ $today }}', description: 'Start of today (midnight)' },
  { category: 'Date & Time', label: 'ISO timestamp', value: '{{ $now.toISO() }}', description: 'ISO 8601 format' },
  { category: 'Date & Time', label: 'Format date', value: '{{ $now.toFormat("yyyy-MM-dd") }}', description: 'Custom date format' },
  { category: 'Date & Time', label: 'Format datetime', value: '{{ $now.toFormat("yyyy-MM-dd HH:mm:ss") }}', description: 'Date and time format' },
  { category: 'Date & Time', label: 'Add days', value: '{{ $now.plus({ days: 7 }).toISO() }}', description: 'Add days to date' },
  { category: 'Date & Time', label: 'Subtract days', value: '{{ $now.minus({ days: 7 }).toISO() }}', description: 'Subtract days from date' },

  // === STRING FUNCTIONS ===
  { category: 'String Functions', label: 'Uppercase', value: '{{ $json.text.toUpperCase() }}', description: 'Convert to UPPERCASE' },
  { category: 'String Functions', label: 'Lowercase', value: '{{ $json.text.toLowerCase() }}', description: 'Convert to lowercase' },
  { category: 'String Functions', label: 'Trim whitespace', value: '{{ $json.text.trim() }}', description: 'Remove leading/trailing spaces' },
  { category: 'String Functions', label: 'Replace text', value: '{{ $json.text.replace("old", "new") }}', description: 'Replace first occurrence' },
  { category: 'String Functions', label: 'Split string', value: '{{ $json.text.split(",") }}', description: 'Split into array' },
  { category: 'String Functions', label: 'Join array', value: '{{ $json.items.join(", ") }}', description: 'Join array to string' },

  // === MATH FUNCTIONS ===
  { category: 'Math Functions', label: 'Round number', value: '{{ Math.round($json.value) }}', description: 'Round to nearest integer' },
  { category: 'Math Functions', label: 'Round to decimals', value: '{{ Number($json.value.toFixed(2)) }}', description: 'Round to 2 decimal places' },
  { category: 'Math Functions', label: 'Sum array', value: '{{ $json.numbers.reduce((a, b) => a + b, 0) }}', description: 'Sum all numbers in array' },

  // === CONDITIONAL LOGIC ===
  { category: 'Conditional Logic', label: 'If/else (ternary)', value: '{{ $json.value ? "yes" : "no" }}', description: 'Simple condition' },
  { category: 'Conditional Logic', label: 'Nullish coalescing', value: '{{ $json.value ?? "default" }}', description: 'Default if null/undefined' },
  { category: 'Conditional Logic', label: 'Or fallback', value: '{{ $json.value || "fallback" }}', description: 'Default if falsy' },

  // === WORKFLOW INFO ===
  { category: 'Workflow Info', label: 'Workflow ID', value: '{{ $workflow.id }}', description: 'Current workflow ID' },
  { category: 'Workflow Info', label: 'Workflow name', value: '{{ $workflow.name }}', description: 'Current workflow name' },
  { category: 'Workflow Info', label: 'Execution ID', value: '{{ $execution.id }}', description: 'Current execution ID' },

  // === ENVIRONMENT ===
  { category: 'Environment', label: 'Environment variable', value: '{{ $env.VAR_NAME }}', description: 'Access env vars' },

  // === TYPE CONVERSION ===
  { category: 'Type Conversion', label: 'To string', value: '{{ String($json.value) }}', description: 'Convert to string' },
  { category: 'Type Conversion', label: 'To number', value: '{{ Number($json.text) }}', description: 'Convert to number' },
  { category: 'Type Conversion', label: 'To JSON string', value: '{{ JSON.stringify($json.obj) }}', description: 'Object to JSON string' },
  { category: 'Type Conversion', label: 'Parse JSON', value: '{{ JSON.parse($json.jsonString) }}', description: 'JSON string to object' },
];

/**
 * Get user-friendly placeholder based on field name
 */
function getFriendlyPlaceholder(field: { name: string; displayName: string; type: string }): string {
  const name = field.name.toLowerCase();

  if (name.includes('folder')) return 'Paste folder URL from your browser';
  if (name.includes('sheet') || name.includes('spreadsheet')) return 'Paste Google Sheet URL';
  if (name.includes('document') || name.includes('doc')) return 'Paste document URL';
  if (name.includes('file')) return 'Paste file URL or select from list';
  if (name.includes('email') || name.includes('recipient')) return 'Enter email address';
  if (name.includes('phone')) return 'Enter phone number';
  if (name.includes('url') || name.includes('link')) return 'Paste URL here';
  if (name.includes('id')) return `Paste ${field.displayName} or URL`;
  if (name.includes('name') || name.includes('title')) return `Enter ${field.displayName.toLowerCase()}`;
  if (name.includes('message') || name.includes('content') || name.includes('body')) return 'Type your message here...';

  return field.displayName ? `Enter ${field.displayName.toLowerCase()}` : 'Enter value';
}

interface CredentialParameterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, parameters: Record<string, any>) => Promise<void>;
  paramInfo: CredentialParamInfo | null;
  workflowName?: string;
  accessToken?: string;
}

export default function CredentialParameterModal({
  isOpen,
  onClose,
  onSave,
  paramInfo,
  workflowName,
  accessToken,
}: CredentialParameterModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    optional: true,
    advanced: true,
  });
  const [activeExpressionField, setActiveExpressionField] = useState<string | null>(null);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ name: string; value: string }>>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});
  const [showExpressionMenu, setShowExpressionMenu] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [expressionSearch, setExpressionSearch] = useState('');
  const expressionMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * Group fields into sections for better organization
   */
  const groupedFields = useMemo(() => {
    if (!paramInfo?.config.fields) {
      return { required: [], basic: [], optional: [], advanced: [] };
    }

    const required: typeof paramInfo.config.fields = [];
    const basic: typeof paramInfo.config.fields = [];
    const optional: typeof paramInfo.config.fields = [];
    const advanced: typeof paramInfo.config.fields = [];

    const basicFieldNames = ['resource', 'operation', 'name', 'title', 'subject', 'message', 'content', 'text', 'description', 'to', 'from', 'email', 'recipient'];
    const advancedTypes = ['json', 'collection', 'textarea'];

    for (const field of paramInfo.config.fields) {
      if (field.required) {
        required.push(field);
      } else if (advancedTypes.includes(field.type)) {
        advanced.push(field);
      } else if (basicFieldNames.some(n => field.name.toLowerCase().includes(n))) {
        basic.push(field);
      } else if (field.name.toLowerCase().includes('option') || field.name.toLowerCase().includes('additional')) {
        optional.push(field);
      } else {
        if (paramInfo.config.fields.length <= 6) {
          basic.push(field);
        } else {
          optional.push(field);
        }
      }
    }

    return { required, basic, optional, advanced };
  }, [paramInfo?.config.fields]);

  // Filter expression templates based on search
  const filteredTemplates = useMemo(() => {
    if (!expressionSearch.trim()) return EXPRESSION_TEMPLATES;
    const search = expressionSearch.toLowerCase();
    return EXPRESSION_TEMPLATES.filter(
      (t) =>
        t.label.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.category.toLowerCase().includes(search) ||
        t.value.toLowerCase().includes(search)
    );
  }, [expressionSearch]);

  // Group filtered templates by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, typeof EXPRESSION_TEMPLATES> = {};
    for (const template of filteredTemplates) {
      if (!groups[template.category]) {
        groups[template.category] = [];
      }
      groups[template.category].push(template);
    }
    return groups;
  }, [filteredTemplates]);

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEscapeKey(isOpen, onClose);

  // Close expression menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (expressionMenuRef.current && !expressionMenuRef.current.contains(event.target as Node)) {
        setShowExpressionMenu(false);
        setActiveExpressionField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Insert expression template into field
  const insertExpression = (fieldName: string, template: string) => {
    const currentValue = formData[fieldName] || '';
    setFormData({ ...formData, [fieldName]: currentValue + template });
    setShowExpressionMenu(false);
    setActiveExpressionField(null);
    setDropdownPosition(null);
    setExpressionSearch('');
  };

  // Handle expression button click - calculate position for fixed dropdown
  const handleExpressionClick = (e: React.MouseEvent, fieldName: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownWidth = 320;
    setDropdownPosition({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - dropdownWidth),
    });
    setActiveExpressionField(fieldName);
    const isOpening = !showExpressionMenu || activeExpressionField !== fieldName;
    setShowExpressionMenu(isOpening);
    if (isOpening) {
      setExpressionSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  useEffect(() => {
    if (isOpen && paramInfo) {
      setFormData({ ...paramInfo.currentValues });
      setError(null);

      // Load dynamic options for fields that have loadOptionsMethod
      const fieldsWithDynamicOptions = paramInfo.config.fields.filter(f => f.loadOptionsMethod);
      for (const field of fieldsWithDynamicOptions) {
        if (field.loadOptionsMethod && !dynamicOptions[field.name]) {
          loadDynamicOptions(field.name, field.loadOptionsMethod);
        }
      }
    } else if (!isOpen) {
      setFormData({});
      setError(null);
      setShowExpressionMenu(false);
      setActiveExpressionField(null);
      setDropdownPosition(null);
      setExpressionSearch('');
      setDynamicOptions({});
      setLoadingOptions({});
    }
  }, [isOpen, paramInfo]);

  // Load dynamic options from API
  const loadDynamicOptions = async (fieldName: string, optionsUrl: string) => {
    setLoadingOptions(prev => ({ ...prev, [fieldName]: true }));
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch(optionsUrl, { headers });
      if (res.ok) {
        const data = await res.json();

        let options: Array<{ name: string; value: string }> = [];

        // OpenAI /v1/models format: { data: [{ id: string }] }
        if (data.data && Array.isArray(data.data)) {
          options = data.data.map((item: any) => ({
            name: item.id || item.model_name || item.name || String(item),
            value: item.id || item.model_name || item.value || String(item),
          }));
        }
        // Simple array format: [{ name: string, value: string }]
        else if (Array.isArray(data)) {
          options = data.map((item: any) => ({
            name: item.name || String(item),
            value: item.value || String(item),
          }));
        }

        setDynamicOptions(prev => ({ ...prev, [fieldName]: options }));
      } else {
        console.error('Failed to load options:', res.status, await res.text().catch(() => ''));
      }
    } catch (e) {
      console.error('Failed to load dynamic options for', fieldName, e);
    } finally {
      setLoadingOptions(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paramInfo) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(paramInfo.nodeId, formData);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save parameters');
    } finally {
      setIsSaving(false);
    }
  };

  const isValueEmpty = (value: any): boolean => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return false;
  };

  const isExpression = (value: any): boolean => {
    return typeof value === 'string' && (value.includes('{{') || value.startsWith('='));
  };

  const renderField = (field: {
    name: string;
    displayName: string;
    type: string;
    placeholder?: string;
    isResourceLocator?: boolean;
    required?: boolean;
    description?: string;
    options?: Array<{ name: string; value: string; description?: string }>;
    loadOptionsMethod?: string;
    minValue?: number;
    maxValue?: number;
  }) => {
    const value = formData[field.name] ?? '';
    const hasExpression = isExpression(value);
    const friendlyPlaceholder = getFriendlyPlaceholder(field);

    // Boolean field
    if (field.type === 'boolean') {
      return (
        <div key={field.name} className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded-lg">
          <div>
            <label htmlFor={field.name} className="text-sm text-white">
              {field.displayName}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, [field.name]: !formData[field.name] })}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              formData[field.name] ? 'bg-green-500' : 'bg-gray-600'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                formData[field.name] ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      );
    }

    // Select field with options (static or dynamic)
    if (field.type === 'select' || field.options || field.loadOptionsMethod) {
      const options = dynamicOptions[field.name] || field.options || [];
      const isLoading = loadingOptions[field.name];

      return (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <div className="relative">
            <select
              value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              disabled={isLoading}
              className="w-full px-4 py-3 pr-10 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-white/20 focus:border-white appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ colorScheme: 'dark' }}
            >
              {isLoading ? (
                <option value="">Loading options...</option>
              ) : options.length === 0 ? (
                <option value="">No options available</option>
              ) : (
                <>
                  <option value="" className="bg-gray-900 text-gray-500">
                    Select {field.displayName.toLowerCase()}...
                  </option>
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-gray-900 text-white py-2">
                      {opt.name}
                    </option>
                  ))}
                </>
              )}
            </select>
            {isLoading ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
            ) : (
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            )}
          </div>
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        </div>
      );
    }

    // Number field
    if (field.type === 'number') {
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <input
            type="number"
            value={typeof value === 'number' ? value : (typeof value === 'string' ? value : '')}
            onChange={(e) => {
              const numVal = e.target.value === '' ? '' : Number(e.target.value);
              setFormData({ ...formData, [field.name]: numVal });
            }}
            placeholder={friendlyPlaceholder}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white/20 focus:border-white"
          />
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        </div>
      );
    }

    // JSON field
    if (field.type === 'json') {
      const jsonValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
            <span className="text-xs text-gray-500">(advanced)</span>
            <button
              type="button"
              onClick={(e) => handleExpressionClick(e, field.name)}
              className="p-1 rounded transition-all ml-auto text-gray-500 hover:text-amber-400 hover:bg-gray-700"
              title="Insert dynamic data"
            >
              <Zap className="h-3.5 w-3.5" />
            </button>
          </label>
          <textarea
            value={jsonValue}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setFormData({ ...formData, [field.name]: parsed });
              } catch {
                setFormData({ ...formData, [field.name]: e.target.value });
              }
            }}
            placeholder={field.placeholder || 'Paste your data here...'}
            rows={3}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white/20 focus:border-white resize-y min-h-[80px] font-mono text-xs"
          />
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
          {hasExpression && (
            <p className="text-xs text-blue-400 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Dynamic expression detected
            </p>
          )}
        </div>
      );
    }

    // Resource Locator field
    if (field.type === 'resourceLocator' || field.isResourceLocator) {
      const isFolder = field.name.toLowerCase().includes('folder');
      const isFile = field.name.toLowerCase().includes('file') || field.name.toLowerCase().includes('document') || field.name.toLowerCase().includes('sheet');
      const Icon = isFolder ? FolderOpen : isFile ? FileText : Settings;

      return (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <div className="relative">
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={typeof value === 'string' ? value : JSON.stringify(value)}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              placeholder={friendlyPlaceholder}
              className={cn(
                'w-full pl-10 pr-10 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white/20 focus:border-white',
                hasExpression && 'font-mono text-xs'
              )}
            />
            <button
              type="button"
              onClick={(e) => handleExpressionClick(e, field.name)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded transition-all text-gray-500 hover:text-amber-400 hover:bg-gray-700"
              title="Insert dynamic data"
            >
              <Zap className="h-4 w-4" />
            </button>
          </div>
          {field.description ? (
            <p className="text-xs text-gray-500">{field.description}</p>
          ) : isFolder ? (
            <p className="text-xs text-gray-500">Paste the folder URL or enter the folder ID from the URL</p>
          ) : isFile ? (
            <p className="text-xs text-gray-500">Paste the file URL or enter the file ID from the URL</p>
          ) : null}
          {hasExpression && (
            <p className="text-xs text-blue-400 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Dynamic expression detected
            </p>
          )}
        </div>
      );
    }

    // Date field
    if (field.type === 'date') {
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={typeof value === 'string' ? value.split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-white/20 focus:border-white cursor-pointer [color-scheme:dark]"
            />
          </div>
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        </div>
      );
    }

    // Datetime field
    if (field.type === 'datetime') {
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="datetime-local"
              value={typeof value === 'string' ? value.slice(0, 16) : ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-white/20 focus:border-white cursor-pointer [color-scheme:dark]"
            />
          </div>
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        </div>
      );
    }

    // Time field
    if (field.type === 'time') {
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="time"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-white/20 focus:border-white cursor-pointer [color-scheme:dark]"
            />
          </div>
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        </div>
      );
    }

    // Folder field
    if (field.type === 'folder') {
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <div className="relative">
            <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={typeof value === 'string' ? value : JSON.stringify(value)}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              placeholder={friendlyPlaceholder}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white/20 focus:border-white"
            />
          </div>
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        </div>
      );
    }

    // Email field
    if (field.type === 'email') {
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="email"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              placeholder={friendlyPlaceholder}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white/20 focus:border-white"
            />
          </div>
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        </div>
      );
    }

    // Phone field
    if (field.type === 'phone') {
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="tel"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              placeholder={friendlyPlaceholder}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white/20 focus:border-white"
            />
          </div>
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        </div>
      );
    }

    // Textarea field
    if (field.type === 'textarea') {
      return (
        <div key={field.name} className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm text-white">
            {field.displayName}
            {field.required && <span className="text-red-400 ml-1">*</span>}
            <button
              type="button"
              onClick={(e) => handleExpressionClick(e, field.name)}
              className="p-1 rounded transition-all ml-auto text-gray-500 hover:text-amber-400 hover:bg-gray-700"
              title="Insert dynamic data"
            >
              <Zap className="h-3.5 w-3.5" />
            </button>
          </label>
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value)}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            placeholder={friendlyPlaceholder}
            rows={4}
            className={cn(
              'w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white/20 focus:border-white resize-y min-h-[100px]',
              hasExpression && 'font-mono text-xs'
            )}
          />
          {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
          {hasExpression && (
            <p className="text-xs text-blue-400 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Dynamic expression detected
            </p>
          )}
        </div>
      );
    }

    // Default: string/text field
    return (
      <div key={field.name} className="space-y-1.5">
        <label className="text-sm text-white">
          {field.displayName}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <div className="relative">
          <input
            type="text"
            value={typeof value === 'string' ? value : JSON.stringify(value)}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            placeholder={friendlyPlaceholder}
            className={cn(
              'w-full px-4 py-3 pr-10 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white/20 focus:border-white',
              hasExpression && 'font-mono text-xs'
            )}
          />
          <button
            type="button"
            onClick={(e) => handleExpressionClick(e, field.name)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded transition-all text-gray-500 hover:text-amber-400 hover:bg-gray-700"
            title="Insert dynamic data"
          >
            <Zap className="h-4 w-4" />
          </button>
        </div>
        {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
        {hasExpression && (
          <p className="text-xs text-blue-400 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Dynamic expression detected
          </p>
        )}
      </div>
    );
  };

  if (!paramInfo) return null;

  const requiredFields = paramInfo.config.fields.filter((f) => f.required);
  const requiredCount = requiredFields.length;
  const filledRequiredCount = requiredFields.filter((f) => {
    const value = formData[f.name];
    return !isValueEmpty(value) || isExpression(value);
  }).length;
  const allRequiredFilled = requiredCount === 0 || filledRequiredCount === requiredCount;

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
            className="w-full max-w-md bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden max-h-[80vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-800/50 flex items-center justify-center">
                  <CredentialIcon type={paramInfo.credentialType} className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{paramInfo.nodeName}</h2>
                  <p className="text-xs text-gray-500">
                    {requiredCount > 0 && !allRequiredFilled
                      ? `Fill in ${requiredCount - filledRequiredCount} required field${requiredCount - filledRequiredCount > 1 ? 's' : ''}`
                      : 'Configure your settings below'}
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
            <form onSubmit={handleSubmit} className="p-6 pb-8 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/50 flex items-center gap-2 text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {paramInfo.config.description && (
                <p className="text-sm text-gray-400">{paramInfo.config.description}</p>
              )}

              {paramInfo.config.fields.length > 0 ? (
                <div className="space-y-5">
                  {groupedFields.required.length > 0 && (
                    <div className="space-y-4">
                      {groupedFields.required.map(renderField)}
                    </div>
                  )}

                  {groupedFields.basic.length > 0 && (
                    <div className="space-y-4">
                      {groupedFields.basic.map(renderField)}
                    </div>
                  )}

                  {(groupedFields.optional.length > 0 || groupedFields.advanced.length > 0) && (
                    <div className="pt-2 border-t border-gray-800">
                      <button
                        type="button"
                        onClick={() => toggleSection('optional')}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full py-2"
                      >
                        {collapsedSections.optional ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        <span>More options ({groupedFields.optional.length + groupedFields.advanced.length})</span>
                      </button>
                      <AnimatePresence>
                        {!collapsedSections.optional && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-4 pt-3">
                              {groupedFields.optional.map(renderField)}
                              {groupedFields.advanced.map(renderField)}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">This node is ready to use!</p>
                  <p className="text-xs text-gray-600 mt-1">No additional configuration needed</p>
                </div>
              )}

              <div className="pt-4 mt-4 border-t border-gray-800/50 text-xs text-gray-500">
                Using credential: <span className="text-gray-400">{paramInfo.credentialName}</span>
              </div>

              <div className="h-4" aria-hidden="true" />
            </form>

            {/* Expression Dropdown - Fixed position outside scroll container */}
            {showExpressionMenu && activeExpressionField && dropdownPosition && (
              <div
                ref={expressionMenuRef}
                className="fixed w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[200] overflow-hidden"
                style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
              >
                {/* Header with search */}
                <div className="p-3 border-b border-gray-800 bg-gray-900">
                  <p className="text-xs text-gray-400 font-medium mb-2">Insert Dynamic Expression</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={expressionSearch}
                      onChange={(e) => setExpressionSearch(e.target.value)}
                      placeholder="Search expressions..."
                      className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-gray-600"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5">{filteredTemplates.length} of {EXPRESSION_TEMPLATES.length} expressions</p>
                </div>
                {/* Categorized list */}
                <div className="max-h-72 overflow-y-auto">
                  {filteredTemplates.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No expressions match "{expressionSearch}"
                    </div>
                  ) : (
                    Object.entries(groupedTemplates).map(([category, templates]) => (
                      <div key={category}>
                        <div className="px-3 py-1.5 bg-gray-800 border-y border-gray-700 sticky top-0">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{category}</p>
                        </div>
                        {templates.map((template) => (
                          <button
                            key={template.label}
                            type="button"
                            onClick={() => insertExpression(activeExpressionField, template.value)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-white">{template.label}</span>
                              <Copy className="h-3 w-3 text-gray-600 group-hover:text-gray-400" />
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">{template.description}</p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">{template.value}</p>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-6 border-t border-gray-800 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={isSaving || paramInfo.config.fields.length === 0}
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
