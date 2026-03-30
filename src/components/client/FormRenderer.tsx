'use client';

import React, { useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import {
  FieldRenderer,
  getFieldWidthStyle,
  FormField as SharedFormField,
  FormStyles,
  DEFAULT_FORM_STYLES,
} from '@/components/shared/FormFieldRenderer';

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'file' | 'checkbox' | 'radio' | 'phone' | 'url';
  required: boolean;
  options?: string[];
  accept?: string; // For file type
  maxSize?: number; // For file type (in MB)
  width?: '25' | '33' | '50' | '100';
  alignment?: 'left' | 'center' | 'right';
  multiple?: boolean; // For file/select: allow multiple selections
  placeholder?: string;
}

interface FormRendererProps {
  fields: FormField[];
  onSubmit: (data: Record<string, string | string[] | File | File[] | null>) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  styles?: FormStyles;
}

// Default styles for the client panel - dark theme
const CLIENT_FORM_STYLES: FormStyles = {
  ...DEFAULT_FORM_STYLES,
  backgroundColor: 'rgba(17, 24, 39, 0.5)', // bg-gray-900/50
  inputBackgroundColor: 'rgba(17, 24, 39, 0.5)',
  inputBorderColor: '#374151', // border-gray-700
  textColor: '#ffffff',
  primaryColor: '#ffffff',
  buttonTextColor: '#000000',
};

export default function FormRenderer({
  fields,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Submit',
  styles = CLIENT_FORM_STYLES,
}: FormRendererProps) {
  const [formData, setFormData] = useState<Record<string, string | string[] | File | File[] | null>>(() =>
    fields.reduce((acc, field) => {
      if (field.type === 'checkbox') {
        return { ...acc, [field.name]: [] as string[] };
      }
      if (field.type === 'file') {
        return { ...acc, [field.name]: null };
      }
      return { ...acc, [field.name]: '' };
    }, {})
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (name: string, value: string | string[] | File | File[] | null) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const { [name]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const toggleCheckbox = (fieldName: string, option: string) => {
    const current = (formData[fieldName] as string[]) || [];
    const updated = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option];
    updateField(fieldName, updated);
  };

  // Validate a single field (for real-time validation on blur)
  const validateField = (field: FormField) => {
    const value = formData[field.name];
    let fieldError = '';

    // Required check
    if (field.required) {
      if (field.type === 'checkbox') {
        if (!value || (value as string[]).length === 0) {
          fieldError = `Please select at least one ${field.name}`;
        }
      } else if (field.type === 'file') {
        if (!value) {
          fieldError = `${field.name} is required`;
        }
      } else if (!value || !(value as string).trim()) {
        fieldError = `${field.name} is required`;
      }
    }

    // Type-specific validation
    if (!fieldError && value && typeof value === 'string' && value.trim()) {
      switch (field.type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            fieldError = 'Invalid email format';
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            fieldError = 'Must be a number';
          }
          break;
        case 'phone':
          const phoneRegex = /^[\d\s\-\+\(\)\.]+$/;
          if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 7) {
            fieldError = 'Invalid phone number';
          }
          break;
        case 'url':
          try {
            new URL(value);
          } catch {
            fieldError = 'Invalid URL format';
          }
          break;
      }
    }

    // File size validation
    if (!fieldError && field.type === 'file' && value instanceof File && field.maxSize) {
      const maxBytes = field.maxSize * 1024 * 1024;
      if (value.size > maxBytes) {
        fieldError = `File must be smaller than ${field.maxSize}MB`;
      }
    }

    // Update errors state
    if (fieldError) {
      setErrors(prev => ({ ...prev, [field.name]: fieldError }));
    } else {
      setErrors(prev => {
        const { [field.name]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    fields.forEach(field => {
      const value = formData[field.name];

      // Required check
      if (field.required) {
        if (field.type === 'checkbox') {
          if (!value || (value as string[]).length === 0) {
            newErrors[field.name] = `Please select at least one ${field.name}`;
          }
        } else if (field.type === 'file') {
          if (!value) {
            newErrors[field.name] = `${field.name} is required`;
          }
        } else if (!value || !(value as string).trim()) {
          newErrors[field.name] = `${field.name} is required`;
        }
      }

      // Type-specific validation
      if (value && typeof value === 'string' && value.trim()) {
        switch (field.type) {
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              newErrors[field.name] = 'Invalid email format';
            }
            break;

          case 'number':
            if (isNaN(Number(value))) {
              newErrors[field.name] = 'Must be a number';
            }
            break;

          case 'phone':
            // Allow formats: +1234567890, (123) 456-7890, 123-456-7890, etc.
            const phoneRegex = /^[\d\s\-\+\(\)\.]+$/;
            if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 7) {
              newErrors[field.name] = 'Invalid phone number';
            }
            break;

          case 'url':
            try {
              new URL(value);
            } catch {
              newErrors[field.name] = 'Invalid URL format';
            }
            break;
        }
      }

      // File size validation
      if (field.type === 'file' && value instanceof File && field.maxSize) {
        const maxBytes = field.maxSize * 1024 * 1024;
        if (value.size > maxBytes) {
          newErrors[field.name] = `File must be smaller than ${field.maxSize}MB`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-4">
      {fields.map((field) => (
        <div
          key={field.name}
          style={{ width: getFieldWidthStyle(field.width), minWidth: '80px' }}
        >
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {field.name}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <FieldRenderer
            field={field as SharedFormField}
            value={formData[field.name]}
            onChange={(val) => updateField(field.name, val)}
            onToggleCheckbox={(opt) => toggleCheckbox(field.name, opt)}
            onBlur={() => validateField(field)}
            error={errors[field.name]}
            styles={styles}
            previewMode={false}
          />
          {errors[field.name] && (
            <p className="text-red-400 text-xs mt-1">{errors[field.name]}</p>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={isSubmitting}
        style={{ width: '100%' }}
        className="px-4 py-3 bg-white hover:bg-gray-100 disabled:bg-gray-400 text-black font-medium rounded-lg transition-colors flex items-center justify-center gap-2 hover:scale-[1.02]"
      >
        {isSubmitting ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            {submitLabel}
          </>
        )}
      </button>
    </form>
  );
}
