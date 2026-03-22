'use client';

import React from 'react';
import { Upload, X } from 'lucide-react';

// ============================================
// Shared Form Field Types
// ============================================

export interface FormField {
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
}

export interface FormStyles {
  backgroundColor?: string;
  textColor?: string;
  primaryColor?: string;
  buttonTextColor?: string;
  inputBackgroundColor?: string;
  inputBorderColor?: string;
  borderRadius?: number;
  formTitle?: string;
  formDescription?: string;
  showDescription?: boolean;
  buttonText?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export const DEFAULT_FORM_STYLES: FormStyles = {
  backgroundColor: '#0a0a0a',
  textColor: '#ffffff',
  primaryColor: '#ffffff',
  buttonTextColor: '#000000',
  inputBackgroundColor: '#111111',
  inputBorderColor: '#333333',
  borderRadius: 12,
};

// ============================================
// Utility Functions
// ============================================

export function getFieldWidthStyle(width?: string): string {
  switch (width) {
    case '25': return 'calc(25% - 12px)';
    case '33': return 'calc(33.333% - 11px)';
    case '50': return 'calc(50% - 8px)';
    default: return '100%';
  }
}

export function getAlignmentClass(alignment?: string): string {
  switch (alignment) {
    case 'center': return 'justify-center';
    case 'right': return 'justify-end';
    default: return 'justify-start';
  }
}

// ============================================
// Single Field Renderer Component
// ============================================

interface FieldRendererProps {
  field: FormField;
  value: string | string[] | File | File[] | null;
  onChange?: (value: string | string[] | File | File[] | null) => void;
  onToggleCheckbox?: (option: string) => void;
  onBlur?: () => void; // For real-time validation
  error?: string;
  styles?: FormStyles;
  previewMode?: boolean; // Read-only mode for previews
}

export function FieldRenderer({
  field,
  value,
  onChange,
  onToggleCheckbox,
  onBlur,
  error,
  styles = DEFAULT_FORM_STYLES,
  previewMode = false,
}: FieldRendererProps) {
  const s = styles;

  const baseStyle: React.CSSProperties = {
    backgroundColor: s.inputBackgroundColor,
    border: `1px solid ${error ? '#ef4444' : s.inputBorderColor}`,
    borderRadius: '8px',
    color: s.textColor,
  };

  const baseClasses = `w-full px-4 py-3 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 ${
    previewMode ? 'pointer-events-none' : ''
  }`;

  const alignmentClass = getAlignmentClass(field.alignment);

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          value={(value as string) || ''}
          onChange={previewMode ? undefined : (e) => onChange?.(e.target.value)}
          onBlur={previewMode ? undefined : onBlur}
          placeholder={field.placeholder || field.name}
          rows={3}
          className={baseClasses}
          style={baseStyle}
          readOnly={previewMode}
        />
      );

    case 'select':
      return (
        <select
          value={(value as string) || ''}
          onChange={previewMode ? undefined : (e) => onChange?.(e.target.value)}
          onBlur={previewMode ? undefined : onBlur}
          className={baseClasses}
          style={baseStyle}
          disabled={previewMode}
        >
          <option value="">Select {field.name.toLowerCase()}...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case 'date':
    case 'time':
      return (
        <input
          type={field.type}
          value={(value as string) || ''}
          onChange={previewMode ? undefined : (e) => onChange?.(e.target.value)}
          onBlur={previewMode ? undefined : onBlur}
          className={baseClasses}
          style={baseStyle}
          readOnly={previewMode}
        />
      );

    case 'file':
      // Handle both single file and multiple files
      const files = field.multiple
        ? (Array.isArray(value) ? value as File[] : value ? [value as File] : [])
        : (value as File | null);
      const hasFiles = field.multiple
        ? (files as File[]).length > 0
        : files !== null;

      if (previewMode) {
        return (
          <div
            className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed rounded-lg"
            style={{
              backgroundColor: s.inputBackgroundColor,
              borderColor: s.inputBorderColor,
            }}
          >
            <Upload className="w-4 h-4" style={{ color: s.textColor, opacity: 0.5 }} />
            <span style={{ color: s.textColor, opacity: 0.5 }} className="text-sm">
              {field.multiple ? 'Upload files' : 'Upload file'}
            </span>
          </div>
        );
      }

      // Handle removing a file (for multiple files)
      const handleRemoveFile = (indexToRemove: number) => {
        if (field.multiple && Array.isArray(files)) {
          const newFiles = (files as File[]).filter((_, i) => i !== indexToRemove);
          onChange?.(newFiles.length > 0 ? newFiles : null);
        } else {
          onChange?.(null);
        }
      };

      // Handle file selection
      const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        if (field.multiple) {
          // Add to existing files
          const existingFiles = Array.isArray(files) ? files as File[] : [];
          const newFiles = [...existingFiles, ...Array.from(selectedFiles)];
          onChange?.(newFiles);
        } else {
          onChange?.(selectedFiles[0]);
        }
      };

      return (
        <div className="space-y-2">
          {/* Show selected files */}
          {hasFiles && (
            <div className="space-y-1">
              {field.multiple ? (
                // Multiple files - show each with remove button
                (files as File[]).map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between px-4 py-2 rounded-lg"
                    style={baseStyle}
                  >
                    <span className="text-sm truncate mr-2" style={{ color: s.textColor }}>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="p-1 hover:opacity-70 rounded text-red-400 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                // Single file
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-lg"
                  style={baseStyle}
                >
                  <span className="text-sm truncate mr-2" style={{ color: s.textColor }}>{(files as File).name}</span>
                  <button
                    type="button"
                    onClick={() => onChange?.(null)}
                    className="p-1 hover:opacity-70 rounded text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upload button - always show for multiple, hide when file selected for single */}
          {(field.multiple || !hasFiles) && (
            <label
              className="flex items-center justify-center gap-2 px-4 py-3 border-dashed rounded-lg cursor-pointer hover:opacity-80 transition-all"
              style={{
                backgroundColor: s.inputBackgroundColor,
                border: `1px dashed ${error ? '#ef4444' : s.inputBorderColor}`,
              }}
            >
              <Upload className="h-4 w-4" style={{ color: s.textColor, opacity: 0.5 }} />
              <span className="text-sm" style={{ color: s.textColor, opacity: 0.5 }}>
                {field.multiple
                  ? (hasFiles ? 'Add more files' : 'Click to upload files')
                  : 'Click to upload'}
              </span>
              <input
                type="file"
                onChange={handleFileChange}
                accept={field.accept}
                multiple={field.multiple}
                className="hidden"
              />
            </label>
          )}
        </div>
      );

    case 'checkbox':
      return (
        <div className={`space-y-2 flex flex-col ${alignmentClass}`}>
          {(field.options || ['Option 1']).map((option) => (
            <label key={option} className={`flex items-center gap-3 ${previewMode ? '' : 'cursor-pointer group'}`}>
              <input
                type="checkbox"
                checked={((value as string[]) || []).includes(option)}
                onChange={previewMode ? undefined : () => onToggleCheckbox?.(option)}
                className={`w-4 h-4 rounded focus:ring-white/30 ${previewMode ? 'pointer-events-none' : ''}`}
                style={{
                  borderColor: s.inputBorderColor,
                  backgroundColor: s.inputBackgroundColor,
                  accentColor: s.primaryColor,
                }}
                disabled={previewMode}
              />
              <span
                className={previewMode ? '' : 'transition-colors'}
                style={{ color: s.textColor, opacity: 0.8 }}
              >
                {option}
              </span>
            </label>
          ))}
        </div>
      );

    case 'radio':
      return (
        <div className={`space-y-2 flex flex-col ${alignmentClass}`}>
          {(field.options || ['Option 1']).map((option) => (
            <label key={option} className={`flex items-center gap-3 ${previewMode ? '' : 'cursor-pointer group'}`}>
              <input
                type="radio"
                name={field.name}
                checked={(value as string) === option}
                onChange={previewMode ? undefined : () => onChange?.(option)}
                className={`w-4 h-4 focus:ring-white/30 ${previewMode ? 'pointer-events-none' : ''}`}
                style={{
                  borderColor: s.inputBorderColor,
                  backgroundColor: s.inputBackgroundColor,
                  accentColor: s.primaryColor,
                }}
                disabled={previewMode}
              />
              <span
                className={previewMode ? '' : 'transition-colors'}
                style={{ color: s.textColor, opacity: 0.8 }}
              >
                {option}
              </span>
            </label>
          ))}
        </div>
      );

    case 'phone':
      return (
        <input
          type="tel"
          value={(value as string) || ''}
          onChange={previewMode ? undefined : (e) => onChange?.(e.target.value)}
          onBlur={previewMode ? undefined : onBlur}
          placeholder="+1 (555) 123-4567"
          className={baseClasses}
          style={baseStyle}
          readOnly={previewMode}
        />
      );

    case 'url':
      return (
        <input
          type="url"
          value={(value as string) || ''}
          onChange={previewMode ? undefined : (e) => onChange?.(e.target.value)}
          onBlur={previewMode ? undefined : onBlur}
          placeholder="https://example.com"
          className={baseClasses}
          style={baseStyle}
          readOnly={previewMode}
        />
      );

    default:
      return (
        <input
          type={field.type}
          value={(value as string) || ''}
          onChange={previewMode ? undefined : (e) => onChange?.(e.target.value)}
          onBlur={previewMode ? undefined : onBlur}
          placeholder={field.placeholder || field.name}
          className={baseClasses}
          style={baseStyle}
          readOnly={previewMode}
        />
      );
  }
}

// ============================================
// Form Fields List Component
// ============================================

interface FormFieldsListProps {
  fields: FormField[];
  values: Record<string, string | string[] | File | File[] | null>;
  onChange?: (name: string, value: string | string[] | File | File[] | null) => void;
  onToggleCheckbox?: (name: string, option: string) => void;
  errors?: Record<string, string>;
  styles?: FormStyles;
  previewMode?: boolean;
  className?: string;
}

export function FormFieldsList({
  fields,
  values,
  onChange,
  onToggleCheckbox,
  errors = {},
  styles = DEFAULT_FORM_STYLES,
  previewMode = false,
  className = '',
}: FormFieldsListProps) {
  const s = styles;

  return (
    <div className={`flex flex-wrap gap-4 ${className}`}>
      {fields.map((field) => (
        <div
          key={field.name}
          style={{ width: getFieldWidthStyle(field.width), minWidth: '80px' }}
        >
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: s.textColor, opacity: 0.8 }}
          >
            {field.name}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <FieldRenderer
            field={field}
            value={values[field.name]}
            onChange={previewMode ? undefined : (val) => onChange?.(field.name, val)}
            onToggleCheckbox={previewMode ? undefined : (opt) => onToggleCheckbox?.(field.name, opt)}
            error={errors[field.name]}
            styles={styles}
            previewMode={previewMode}
          />
          {errors[field.name] && (
            <p className="text-red-400 text-xs mt-1">{errors[field.name]}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Complete Form Container Component
// ============================================

interface FormContainerProps {
  title?: string;
  description?: string;
  showDescription?: boolean;
  fields: FormField[];
  values: Record<string, string | string[] | File | File[] | null>;
  onChange?: (name: string, value: string | string[] | File | File[] | null) => void;
  onToggleCheckbox?: (name: string, option: string) => void;
  onSubmit?: () => void;
  errors?: Record<string, string>;
  styles?: FormStyles;
  previewMode?: boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
  className?: string;
}

export function FormContainer({
  title,
  description,
  showDescription,
  fields,
  values,
  onChange,
  onToggleCheckbox,
  onSubmit,
  errors = {},
  styles = DEFAULT_FORM_STYLES,
  previewMode = false,
  isSubmitting = false,
  submitLabel,
  className = '',
}: FormContainerProps) {
  const s = styles;
  const displayTitle = title || s.formTitle || 'Form';
  const displayDescription = description || s.formDescription;
  const shouldShowDescription = showDescription ?? s.showDescription;
  const buttonText = submitLabel || s.buttonText || 'Submit';

  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        backgroundColor: s.backgroundColor,
        borderRadius: `${s.borderRadius || 12}px`,
        border: `1px solid ${s.inputBorderColor || '#333333'}`,
        padding: '32px',
        textAlign: s.textAlign || 'left',
      }}
    >
      {/* Title */}
      <h3
        className="text-xl font-bold mb-2"
        style={{ color: s.textColor || '#ffffff' }}
      >
        {displayTitle}
      </h3>

      {/* Description */}
      {shouldShowDescription && displayDescription ? (
        <p className="text-sm mb-6" style={{ color: s.textColor, opacity: 0.6 }}>
          {displayDescription}
        </p>
      ) : (
        <div className="mb-4" />
      )}

      {/* Fields */}
      <FormFieldsList
        fields={fields}
        values={values}
        onChange={onChange}
        onToggleCheckbox={onToggleCheckbox}
        errors={errors}
        styles={styles}
        previewMode={previewMode}
      />

      {/* Submit Button */}
      <button
        type={previewMode ? 'button' : 'submit'}
        onClick={previewMode ? undefined : onSubmit}
        disabled={isSubmitting}
        className="w-full mt-4 py-3 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
        style={{
          backgroundColor: s.primaryColor || '#ffffff',
          borderRadius: `${s.borderRadius || 12}px`,
          color: s.buttonTextColor || '#000000',
        }}
      >
        {isSubmitting ? 'Submitting...' : buttonText}
      </button>
    </div>
  );
}

export default FormContainer;
