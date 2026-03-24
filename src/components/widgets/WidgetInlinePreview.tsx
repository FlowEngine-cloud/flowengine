'use client';

import React from 'react';
import { RefreshCw, MousePointer } from 'lucide-react';
import { ChatbotRenderer } from '@/components/widgets/ChatbotRenderer';
import { FieldRenderer, getFieldWidthStyle, FormStyles, FormField } from '@/components/shared/FormFieldRenderer';
import { ChatbotConfig } from '@/components/widget-studio/types';

interface Widget {
  id: string;
  name: string;
  widget_type: 'button' | 'form' | 'chatbot';
  form_fields?: any[];
  chatbot_config?: Record<string, any>;
  styles?: Record<string, any> | null;
}

const DEFAULT_STYLES = {
  primaryColor: '#ffffff',
  backgroundColor: '#0a0a0a',
  textColor: '#ffffff',
  borderRadius: '12',
  buttonText: 'Submit',
  inputBorderColor: '#333333',
  inputBackgroundColor: '#111111',
};

export function WidgetInlinePreview({ widget }: { widget: Widget }) {
  const styles: Record<string, any> = { ...DEFAULT_STYLES, ...(widget.styles || {}) };
  const borderRadius = typeof styles.borderRadius === 'string'
    ? parseInt(styles.borderRadius)
    : (styles.borderRadius || 12);

  const formStyles: FormStyles = {
    backgroundColor: styles.backgroundColor,
    textColor: styles.textColor,
    primaryColor: styles.primaryColor,
    buttonTextColor: styles.primaryColor === '#ffffff' ? '#000000' : '#ffffff',
    inputBackgroundColor: styles.inputBackgroundColor,
    inputBorderColor: styles.inputBorderColor,
    borderRadius,
    formTitle: styles.formTitle,
    formDescription: styles.formDescription,
    showDescription: styles.showDescription,
    buttonText: styles.buttonText,
    textAlign: styles.textAlign,
  };

  // Chatbot — full interactive preview via ChatbotRenderer's previewMode
  if (widget.widget_type === 'chatbot') {
    const config = (widget.chatbot_config || {}) as Partial<ChatbotConfig>;
    const isEmbedded = config.displayMode === 'embedded';

    return (
      <div className="w-full h-full flex items-center justify-center bg-black p-4">
        <ChatbotRenderer
          config={config}
          widgetName={widget.name}
          width={isEmbedded ? '100%' : '320px'}
          height={isEmbedded ? '100%' : '500px'}
          previewMode={true}
          showCloseButton={false}
          showWatermark={false}
        />
      </div>
    );
  }

  // Form / Button — static preview (no submission)
  return (
    <div
      className="w-full h-full flex items-center justify-center p-8"
      style={{ backgroundColor: '#000000' }}
    >
      <div
        className="w-full max-w-md"
        style={{
          backgroundColor: styles.backgroundColor,
          borderRadius: `${borderRadius}px`,
          border: `1px solid ${styles.inputBorderColor}`,
          padding: '32px',
          textAlign: styles.textAlign || 'left',
        }}
      >
        <h1 className="text-xl font-bold mb-4" style={{ color: styles.textColor }}>
          {styles.formTitle || widget.name}
        </h1>

        {styles.showDescription && styles.formDescription && (
          <p className="text-sm mb-6" style={{ color: styles.textColor, opacity: 0.6 }}>
            {styles.formDescription}
          </p>
        )}

        {widget.widget_type === 'button' && (
          <button
            disabled
            className="w-full px-8 py-3 font-medium flex items-center justify-center gap-2 opacity-90 cursor-default"
            style={{
              backgroundColor: styles.primaryColor,
              borderRadius: `${borderRadius}px`,
              color: styles.primaryColor === '#ffffff' ? '#000' : '#fff',
            }}
          >
            <MousePointer className="h-4 w-4" />
            {styles.buttonText || widget.name}
          </button>
        )}

        {widget.widget_type === 'form' && (
          <div className="flex flex-wrap gap-4">
            {(widget.form_fields || []).map((field: FormField, i: number) => (
              <div key={field.name ?? i} style={{ width: getFieldWidthStyle(field.width), minWidth: '80px' }}>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: styles.textColor, opacity: 0.8 }}
                >
                  {field.name}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <FieldRenderer
                  field={field}
                  value={field.type === 'checkbox' ? [] : ''}
                  onChange={() => {}}
                  onToggleCheckbox={() => {}}
                  styles={formStyles}
                  previewMode={true}
                />
              </div>
            ))}

            <button
              disabled
              className="mt-4 w-full py-3 font-medium flex items-center justify-center gap-2 opacity-90 cursor-default"
              style={{
                backgroundColor: styles.primaryColor,
                borderRadius: `${borderRadius}px`,
                color: styles.primaryColor === '#ffffff' ? '#000' : '#fff',
              }}
            >
              <RefreshCw className="h-4 w-4" />
              {styles.buttonText || 'Submit'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WidgetInlinePreview;
