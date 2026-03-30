'use client';

import React from 'react';
import { Layout, RotateCcw } from 'lucide-react';

// Custom select class with proper dropdown arrow
const selectClassName = "w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-white focus:border-white transition-colors appearance-none bg-no-repeat bg-[length:16px_16px] bg-[position:right_12px_center] pr-10 cursor-pointer";
const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
};

// ChatbotConfig matches the interface from page.tsx
type ChatbotConfig = Record<string, any>;

interface DesignPanelProps {
  widgetType: 'chatbot' | 'form' | 'button';
  styles: Record<string, any>;
  chatbotConfig: ChatbotConfig;
  isCompact?: boolean;
  onStylesChange: (styles: Record<string, any>) => void;
  onChatbotConfigChange: (config: ChatbotConfig) => void;
}

const FONT_FAMILIES = [
  { value: 'system-ui', label: 'System Default' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
];

const FONT_SIZES = ['12', '13', '14', '15', '16', '18'];
const FONT_WEIGHTS = [
  { value: '400', label: 'Normal' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
];

const BOX_SHADOWS = [
  { value: 'none', label: 'None' },
  { value: '0 2px 8px rgba(0, 0, 0, 0.1)', label: 'Small' },
  { value: '0 4px 16px rgba(0, 0, 0, 0.15)', label: 'Medium' },
  { value: '0 8px 32px rgba(0, 0, 0, 0.2)', label: 'Large' },
  { value: '0 20px 60px rgba(0, 0, 0, 0.3)', label: 'Extra Large' },
];

const BORDER_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

export function DesignPanel({
  widgetType,
  styles,
  chatbotConfig,
  isCompact = false,
  onStylesChange,
  onChatbotConfigChange,
}: DesignPanelProps) {
  // Responsive grid class helper - use static classes for Tailwind purging
  const getGridClass = (cols: number) => {
    if (isCompact) return 'grid-cols-1';
    // Use static classes that Tailwind can detect
    switch (cols) {
      case 2: return 'grid-cols-2';
      case 3: return 'grid-cols-3';
      case 4: return 'grid-cols-4';
      default: return 'grid-cols-1';
    }
  };

  // Helpers for updating state
  const updateChatbotConfig = (updates: Partial<ChatbotConfig>) => {
    onChatbotConfigChange({ ...chatbotConfig, ...updates });
  };

  const updateStyles = (updates: Partial<typeof styles>) => {
    onStylesChange({ ...styles, ...updates });
  };

  // Get current values based on component type
  const fontFamily = widgetType === 'chatbot' ? chatbotConfig.fontFamily : styles.fontFamily;
  const fontSize = widgetType === 'chatbot' ? chatbotConfig.fontSize : styles.inputFontSize;
  const fontWeight = widgetType === 'chatbot' ? chatbotConfig.fontWeight : styles.labelFontWeight;
  const borderRadius = widgetType === 'chatbot' ? chatbotConfig.borderRadius : styles.borderRadius;
  const boxShadow = widgetType === 'chatbot' ? chatbotConfig.boxShadow : styles.formShadow;
  const borderStyle = widgetType === 'chatbot' ? chatbotConfig.borderStyle : 'solid';
  const borderWidth = widgetType === 'chatbot' ? chatbotConfig.borderWidth : styles.inputBorderWidth;

  // Handler functions
  const handleFontFamilyChange = (value: string) => {
    if (widgetType === 'chatbot') {
      updateChatbotConfig({ fontFamily: value });
    } else {
      updateStyles({ fontFamily: value });
    }
  };

  const handleFontSizeChange = (value: string) => {
    if (widgetType === 'chatbot') {
      updateChatbotConfig({ fontSize: value });
    } else {
      updateStyles({ inputFontSize: value, labelFontSize: value });
    }
  };

  const handleFontWeightChange = (value: string) => {
    if (widgetType === 'chatbot') {
      updateChatbotConfig({ fontWeight: value });
    } else {
      updateStyles({ labelFontWeight: value });
    }
  };

  const handleBorderRadiusChange = (value: string) => {
    if (widgetType === 'chatbot') {
      updateChatbotConfig({ borderRadius: value });
    } else {
      updateStyles({ borderRadius: value });
    }
  };

  const handleBoxShadowChange = (value: string) => {
    if (widgetType === 'chatbot') {
      updateChatbotConfig({ boxShadow: value });
    } else {
      updateStyles({ formShadow: value });
    }
  };

  const handleBorderStyleChange = (value: string) => {
    if (widgetType === 'chatbot') {
      updateChatbotConfig({ borderStyle: value });
    }
  };

  const handleBorderWidthChange = (value: string) => {
    if (widgetType === 'chatbot') {
      updateChatbotConfig({ borderWidth: value });
    } else {
      updateStyles({ inputBorderWidth: value });
    }
  };

  // Reset to defaults
  const resetDesign = () => {
    if (widgetType === 'chatbot') {
      updateChatbotConfig({
        fontFamily: 'system-ui',
        fontSize: '14',
        fontWeight: '400',
        lineHeight: '1.5',
        letterSpacing: '0',
        borderRadius: '20',
        borderWidth: '1',
        borderStyle: 'solid',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        messagePadding: '12',
        messageSpacing: '12',
      });
    } else {
      updateStyles({
        fontFamily: 'system-ui',
        inputFontSize: '14',
        labelFontSize: '14',
        labelFontWeight: '500',
        borderRadius: '12',
        inputBorderWidth: '1',
        formShadow: 'none',
        inputPadding: '12',
        fieldSpacing: '20',
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-white" />
            <h3 className="text-lg font-medium text-white">Design Settings</h3>
          </div>
          <button
            onClick={resetDesign}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-400">Customize typography, spacing, and layout</p>
      </div>

      {/* Typography Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white">Typography</h4>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Font Family</label>
          <select
            value={fontFamily || 'system-ui'}
            onChange={(e) => handleFontFamilyChange(e.target.value)}
            className={selectClassName}
            style={selectStyle}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>

        <div className={`grid ${getGridClass(2)} gap-3`}>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Font Size</label>
            <select
              value={fontSize || '14'}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              className={selectClassName}
              style={selectStyle}
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Font Weight</label>
            <select
              value={fontWeight || '400'}
              onChange={(e) => handleFontWeightChange(e.target.value)}
              className={selectClassName}
              style={selectStyle}
            >
              {FONT_WEIGHTS.map((weight) => (
                <option key={weight.value} value={weight.value}>
                  {weight.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chatbot-specific typography options */}
        {widgetType === 'chatbot' && (
          <>
            <div className={`grid ${getGridClass(2)} gap-3`}>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Line Height</label>
                <select
                  value={chatbotConfig.lineHeight || '1.5'}
                  onChange={(e) => updateChatbotConfig({ lineHeight: e.target.value })}
                  className={selectClassName}
                  style={selectStyle}
                >
                  <option value="1.25">Tight (1.25)</option>
                  <option value="1.5">Normal (1.5)</option>
                  <option value="1.75">Relaxed (1.75)</option>
                  <option value="2">Loose (2)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Letter Spacing</label>
                <select
                  value={chatbotConfig.letterSpacing || '0'}
                  onChange={(e) => updateChatbotConfig({ letterSpacing: e.target.value })}
                  className={selectClassName}
                  style={selectStyle}
                >
                  <option value="-0.5">Tight (-0.5px)</option>
                  <option value="0">Normal (0)</option>
                  <option value="0.5">Wide (0.5px)</option>
                  <option value="1">Wider (1px)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Text Transform</label>
              <select
                value={chatbotConfig.textTransform || 'none'}
                onChange={(e) => updateChatbotConfig({ textTransform: e.target.value })}
                className={selectClassName}
                style={selectStyle}
              >
                <option value="none">None</option>
                <option value="uppercase">UPPERCASE</option>
                <option value="lowercase">lowercase</option>
                <option value="capitalize">Capitalize</option>
              </select>
            </div>
          </>
        )}

        {/* Text Alignment - All component types */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Text Alignment</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'left', label: 'Left', icon: '⫷' },
              { value: 'center', label: 'Center', icon: '⫿' },
              { value: 'right', label: 'Right', icon: '⫸' },
            ].map((align) => {
              const currentAlign = widgetType === 'chatbot'
                ? chatbotConfig.textAlign
                : styles.textAlign;
              const isSelected = currentAlign === align.value || (!currentAlign && align.value === 'left');
              return (
                <button
                  key={align.value}
                  onClick={() => {
                    if (widgetType === 'chatbot') {
                      updateChatbotConfig({ textAlign: align.value });
                    } else {
                      updateStyles({ textAlign: align.value });
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-black'
                      : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                >
                  {align.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Layout Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white">Layout</h4>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Border Radius</label>
            <span className="text-sm text-white font-mono">{borderRadius || '12'}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="32"
            value={borderRadius || '12'}
            onChange={(e) => handleBorderRadiusChange(e.target.value)}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>

        {widgetType === 'chatbot' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Message Padding</label>
                <span className="text-sm text-white font-mono">{chatbotConfig.messagePadding || '12'}px</span>
              </div>
              <input
                type="range"
                min="8"
                max="24"
                value={chatbotConfig.messagePadding || '12'}
                onChange={(e) => updateChatbotConfig({ messagePadding: e.target.value })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Message Spacing</label>
                <span className="text-sm text-white font-mono">{chatbotConfig.messageSpacing || '12'}px</span>
              </div>
              <input
                type="range"
                min="4"
                max="24"
                value={chatbotConfig.messageSpacing || '12'}
                onChange={(e) => updateChatbotConfig({ messageSpacing: e.target.value })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </>
        )}

        {(widgetType === 'form' || widgetType === 'button') && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Input Padding</label>
                <span className="text-sm text-white font-mono">{styles.inputPadding || '12'}px</span>
              </div>
              <input
                type="range"
                min="8"
                max="24"
                value={styles.inputPadding || '12'}
                onChange={(e) => updateStyles({ inputPadding: e.target.value })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Field Spacing</label>
                <span className="text-sm text-white font-mono">{styles.fieldSpacing || '20'}px</span>
              </div>
              <input
                type="range"
                min="8"
                max="32"
                value={styles.fieldSpacing || '20'}
                onChange={(e) => updateStyles({ fieldSpacing: e.target.value })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </>
        )}
      </div>

      {/* Advanced Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white">Advanced</h4>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Box Shadow</label>
          <select
            value={boxShadow || 'none'}
            onChange={(e) => handleBoxShadowChange(e.target.value)}
            className={selectClassName}
            style={selectStyle}
          >
            {BOX_SHADOWS.map((shadow) => (
              <option key={shadow.value} value={shadow.value}>
                {shadow.label}
              </option>
            ))}
          </select>
        </div>

        {widgetType === 'chatbot' && (
          <>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Border Style</label>
              <select
                value={borderStyle || 'solid'}
                onChange={(e) => handleBorderStyleChange(e.target.value)}
                className={selectClassName}
                style={selectStyle}
              >
                {BORDER_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">Border Width</label>
                <span className="text-sm text-white font-mono">{borderWidth || '1'}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                value={borderWidth || '1'}
                onChange={(e) => handleBorderWidthChange(e.target.value)}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
