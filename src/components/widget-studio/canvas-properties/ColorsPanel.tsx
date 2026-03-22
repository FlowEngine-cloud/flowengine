'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Palette, Sparkles, Layers, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { SelectedElement } from '../UnifiedCanvasEditor';
import { ColorPickerPopover } from '../ColorPickerPopover';
import { AVATAR_ICONS } from '@/components/widgets/chatbot';
import { DEFAULT_CHATBOT_CONFIG, DEFAULT_STYLES } from '../types';

// Extract all unique hex colors from an object (including nested)
function extractColorsFromConfig(config: Record<string, unknown>): string[] {
  const colors = new Set<string>();

  const extractFromValue = (value: unknown) => {
    if (typeof value === 'string') {
      // Match hex colors (#rgb, #rrggbb, #rrggbbaa)
      const hexMatches = value.match(/#[a-fA-F0-9]{3,8}/g);
      if (hexMatches) {
        hexMatches.forEach(c => colors.add(c.toLowerCase()));
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively extract from nested objects
      Object.values(value as Record<string, unknown>).forEach(extractFromValue);
    }
  };

  if (config && typeof config === 'object') {
    Object.values(config).forEach(extractFromValue);
  }

  return Array.from(colors).filter(c => c.length >= 4); // At least #rgb
}

type ChatbotConfig = Record<string, any>;

interface ColorsPanelProps {
  selectedElement: SelectedElement;
  widgetType: 'chatbot' | 'form' | 'button';
  chatbotConfig: ChatbotConfig;
  styles: Record<string, any>;
  isCompact?: boolean;
  onChatbotConfigChange: (config: ChatbotConfig) => void;
  onStylesChange: (styles: Record<string, any>) => void;
}

// Accessible color row with keyboard support
function ColorRow({
  label,
  color,
  onChange,
  description,
  widgetColors,
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
  description?: string;
  widgetColors?: string[];
}) {
  return (
    <div className="flex items-center justify-between py-2 group">
      <div className="flex-1">
        <span className="text-sm text-gray-300">{label}</span>
        {description && (
          <span className="text-xs text-gray-500 ml-2">{description}</span>
        )}
      </div>
      <ColorPickerPopover
        color={color}
        onChange={onChange}
        widgetColors={widgetColors}
        trigger={
          <button
            className="w-8 h-8 rounded-full border-2 border-gray-600 hover:border-gray-400 hover:scale-110 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
            style={{ background: color }}
            aria-label={`Change ${label} color, currently ${color}`}
          />
        }
      />
    </div>
  );
}

// Accessible toggle with keyboard support
function Toggle({
  label,
  checked,
  onChange,
  id,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  id?: string;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <label htmlFor={id} className="text-sm text-gray-300 cursor-pointer">{label}</label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${label}: ${checked ? 'enabled' : 'disabled'}`}
        onClick={() => onChange(!checked)}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900 ${
          checked ? 'bg-white' : 'bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
            checked ? 'translate-x-5 bg-black' : 'translate-x-1 bg-gray-400'
          }`}
        />
      </button>
    </div>
  );
}

// Slider with proper number handling
function Slider({
  label,
  value,
  onChange,
  min,
  max,
  unit = 'px',
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  unit?: string;
}) {
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-xs text-gray-400 font-mono">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white focus:outline-none focus:ring-2 focus:ring-white"
        aria-label={`${label}: ${value}${unit}`}
      />
    </div>
  );
}

// Gradient builder component
function GradientInput({
  label,
  gradient,
  fallbackColor,
  onGradientChange,
  onColorChange,
  widgetColors,
}: {
  label: string;
  gradient?: string;
  fallbackColor: string;
  onGradientChange: (gradient: string) => void;
  onColorChange: (color: string) => void;
  widgetColors?: string[];
}) {
  const [showGradient, setShowGradient] = useState(!!gradient);
  const [gradientType, setGradientType] = useState<'linear' | 'radial'>('linear');
  const [gradientAngle, setGradientAngle] = useState(135);
  const [color1, setColor1] = useState(gradient ? extractColors(gradient)[0] || fallbackColor : fallbackColor);
  const [color2, setColor2] = useState(gradient ? extractColors(gradient)[1] || '#764ba2' : '#764ba2');

  function extractColors(gradientStr: string): string[] {
    const matches = gradientStr.match(/#[a-fA-F0-9]{6}/g);
    return matches || [];
  }

  const updateGradient = useCallback((c1: string, c2: string, angle: number, type: 'linear' | 'radial') => {
    const gradientStr = type === 'linear'
      ? `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)`
      : `radial-gradient(circle, ${c1} 0%, ${c2} 100%)`;
    onGradientChange(gradientStr);
  }, [onGradientChange]);

  const handleColor1Change = (c: string) => {
    setColor1(c);
    if (showGradient) {
      updateGradient(c, color2, gradientAngle, gradientType);
    } else {
      onColorChange(c);
    }
  };

  const handleColor2Change = (c: string) => {
    setColor2(c);
    updateGradient(color1, c, gradientAngle, gradientType);
  };

  const handleAngleChange = (angle: number) => {
    setGradientAngle(angle);
    updateGradient(color1, color2, angle, gradientType);
  };

  const handleTypeChange = (type: 'linear' | 'radial') => {
    setGradientType(type);
    updateGradient(color1, color2, gradientAngle, type);
  };

  const toggleGradient = () => {
    if (showGradient) {
      // Switching to solid color
      onGradientChange('');
      onColorChange(color1);
    } else {
      // Switching to gradient
      updateGradient(color1, color2, gradientAngle, gradientType);
    }
    setShowGradient(!showGradient);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">{label}</span>
        <button
          onClick={toggleGradient}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            showGradient
              ? 'bg-white text-black'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Layers className="w-3 h-3 inline mr-1" />
          {showGradient ? 'Gradient' : 'Solid'}
        </button>
      </div>

      {!showGradient ? (
        <div className="flex items-center gap-3">
          <ColorPickerPopover
            color={color1}
            onChange={handleColor1Change}
            widgetColors={widgetColors}
            trigger={
              <button
                className="w-10 h-10 rounded-full border-2 border-gray-600 hover:border-gray-400 hover:scale-110 transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg"
                style={{ background: color1 }}
                aria-label={`${label} color: ${color1}`}
              />
            }
          />
          <span className="text-xs text-gray-400 font-mono uppercase">{color1}</span>
        </div>
      ) : (
        <div className="space-y-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
          {/* Preview */}
          <div
            className="w-full h-12 rounded-full border border-gray-600"
            style={{
              background: gradientType === 'linear'
                ? `linear-gradient(${gradientAngle}deg, ${color1} 0%, ${color2} 100%)`
                : `radial-gradient(circle, ${color1} 0%, ${color2} 100%)`
            }}
          />

          {/* Color stops */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <ColorPickerPopover
                color={color1}
                onChange={handleColor1Change}
                widgetColors={widgetColors}
                trigger={
                  <button
                    className="w-10 h-10 rounded-full border-2 border-gray-600 hover:border-gray-400 hover:scale-110 transition-all focus:outline-none focus:ring-2 focus:ring-white shadow-lg"
                    style={{ background: color1 }}
                    aria-label={`Gradient start color: ${color1}`}
                  />
                }
              />
              <span className="text-[10px] text-gray-500">Start</span>
            </div>
            <div className="w-8 h-px bg-gradient-to-r from-gray-600 to-gray-600" />
            <div className="flex flex-col items-center gap-1">
              <ColorPickerPopover
                color={color2}
                onChange={handleColor2Change}
                widgetColors={widgetColors}
                trigger={
                  <button
                    className="w-10 h-10 rounded-full border-2 border-gray-600 hover:border-gray-400 hover:scale-110 transition-all focus:outline-none focus:ring-2 focus:ring-white shadow-lg"
                    style={{ background: color2 }}
                    aria-label={`Gradient end color: ${color2}`}
                  />
                }
              />
              <span className="text-[10px] text-gray-500">End</span>
            </div>
          </div>

          {/* Gradient type */}
          <div className="flex gap-2">
            <button
              onClick={() => handleTypeChange('linear')}
              className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                gradientType === 'linear' ? 'bg-white text-black' : 'bg-gray-700 text-gray-300'
              }`}
            >
              Linear
            </button>
            <button
              onClick={() => handleTypeChange('radial')}
              className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                gradientType === 'radial' ? 'bg-white text-black' : 'bg-gray-700 text-gray-300'
              }`}
            >
              Radial
            </button>
          </div>

          {/* Angle (only for linear) */}
          {gradientType === 'linear' && (
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Angle</span>
                <span>{gradientAngle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={gradientAngle}
                onChange={(e) => handleAngleChange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const QUICK_THEMES = [
  {
    id: 'modern-dark',
    name: 'Dark',
    colors: {
      bubbleColor: '#6366f1',
      bubbleGradient: '',
      headerColor: '#1e293b',
      headerGradient: '',
      headerTextColor: '#ffffff',
      chatBackgroundColor: '#0f172a',
      chatBackgroundGradient: '',
      userMessageColor: '#6366f1',
      userMessageGradient: '',
      userMessageTextColor: '#ffffff',
      botMessageColor: '#1e293b',
      botMessageGradient: '',
      botMessageTextColor: '#e2e8f0',
      inputBackgroundColor: '#1e293b',
      inputTextColor: '#ffffff',
      inputPlaceholderColor: '#64748b',
      sendButtonColor: '#6366f1',
    },
  },
  {
    id: 'purple',
    name: 'Purple',
    colors: {
      bubbleColor: '#8b5cf6',
      bubbleGradient: '',
      headerColor: '#8b5cf6',
      headerGradient: '',
      headerTextColor: '#ffffff',
      chatBackgroundColor: '#1a1625',
      chatBackgroundGradient: '',
      userMessageColor: '#8b5cf6',
      userMessageGradient: '',
      userMessageTextColor: '#ffffff',
      botMessageColor: '#2d2438',
      botMessageGradient: '',
      botMessageTextColor: '#e9d5ff',
      inputBackgroundColor: '#2d2438',
      inputTextColor: '#ffffff',
      inputPlaceholderColor: '#a78bfa',
      sendButtonColor: '#8b5cf6',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      bubbleColor: '#06b6d4',
      bubbleGradient: '',
      headerColor: '#0e7490',
      headerGradient: '',
      headerTextColor: '#ffffff',
      chatBackgroundColor: '#0c1e2e',
      chatBackgroundGradient: '',
      userMessageColor: '#06b6d4',
      userMessageGradient: '',
      userMessageTextColor: '#ffffff',
      botMessageColor: '#164e63',
      botMessageGradient: '',
      botMessageTextColor: '#cffafe',
      inputBackgroundColor: '#164e63',
      inputTextColor: '#ffffff',
      inputPlaceholderColor: '#67e8f9',
      sendButtonColor: '#06b6d4',
    },
  },
  {
    id: 'light',
    name: 'Light',
    colors: {
      bubbleColor: '#ffffff',
      bubbleGradient: '',
      bubbleIconColor: '#000000',
      headerColor: '#ffffff',
      headerGradient: '',
      headerTextColor: '#000000',
      chatBackgroundColor: '#f9fafb',
      chatBackgroundGradient: '',
      userMessageColor: '#000000',
      userMessageGradient: '',
      userMessageTextColor: '#ffffff',
      botMessageColor: '#e5e7eb',
      botMessageGradient: '',
      botMessageTextColor: '#111827',
      inputBackgroundColor: '#ffffff',
      inputTextColor: '#000000',
      inputPlaceholderColor: '#6b7280',
      sendButtonColor: '#000000',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      bubbleColor: '#f97316',
      bubbleGradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
      headerColor: '#f97316',
      headerGradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
      headerTextColor: '#ffffff',
      chatBackgroundColor: '#1c1917',
      chatBackgroundGradient: '',
      userMessageColor: '#f97316',
      userMessageGradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
      userMessageTextColor: '#ffffff',
      botMessageColor: '#292524',
      botMessageGradient: '',
      botMessageTextColor: '#fef3c7',
      inputBackgroundColor: '#292524',
      inputTextColor: '#ffffff',
      inputPlaceholderColor: '#a8a29e',
      sendButtonColor: '#f97316',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      bubbleColor: '#10b981',
      bubbleGradient: '',
      headerColor: '#059669',
      headerGradient: '',
      headerTextColor: '#ffffff',
      chatBackgroundColor: '#0f1f17',
      chatBackgroundGradient: '',
      userMessageColor: '#10b981',
      userMessageGradient: '',
      userMessageTextColor: '#ffffff',
      botMessageColor: '#14532d',
      botMessageGradient: '',
      botMessageTextColor: '#dcfce7',
      inputBackgroundColor: '#14532d',
      inputTextColor: '#ffffff',
      inputPlaceholderColor: '#86efac',
      sendButtonColor: '#10b981',
    },
  },
];

export function ColorsPanel({
  selectedElement,
  widgetType,
  chatbotConfig,
  styles,
  onChatbotConfigChange,
  onStylesChange,
}: ColorsPanelProps) {
  const [showAllColors, setShowAllColors] = useState(false);

  const updateConfig = useCallback((updates: Partial<ChatbotConfig>) => {
    onChatbotConfigChange({ ...chatbotConfig, ...updates });
  }, [chatbotConfig, onChatbotConfigChange]);

  const updateStyles = useCallback((updates: Partial<typeof styles>) => {
    onStylesChange({ ...styles, ...updates });
  }, [styles, onStylesChange]);

  const applyTheme = useCallback((theme: typeof QUICK_THEMES[0]) => {
    // Apply theme and clear any gradients to ensure clean theme application
    onChatbotConfigChange({ ...chatbotConfig, ...theme.colors });
  }, [chatbotConfig, onChatbotConfigChange]);

  const resetColors = useCallback(() => {
    const defaultColors = QUICK_THEMES[0].colors;
    onChatbotConfigChange({ ...chatbotConfig, ...defaultColors });
  }, [chatbotConfig, onChatbotConfigChange]);

  // Extract only colors currently in use in the component (not defaults)
  const widgetColors = useMemo(() => {
    // Only extract colors from actual user config, not merged with defaults
    // This gives us only the colors the user has explicitly set or modified
    const chatbotColors = extractColorsFromConfig(chatbotConfig as Record<string, unknown>);
    const styleColors = extractColorsFromConfig(styles as Record<string, unknown>);
    // Combine and deduplicate
    const allColors = new Set([...chatbotColors, ...styleColors]);
    return Array.from(allColors);
  }, [chatbotConfig, styles]);

  // Button color themes
  const BUTTON_THEMES = [
    { id: 'dark', name: 'Dark', colors: { primaryColor: '#ffffff', buttonTextColor: '#000000', buttonHoverColor: '#e5e5e5' } },
    { id: 'purple', name: 'Purple', colors: { primaryColor: '#8b5cf6', buttonTextColor: '#ffffff', buttonHoverColor: '#7c3aed' } },
    { id: 'blue', name: 'Blue', colors: { primaryColor: '#3b82f6', buttonTextColor: '#ffffff', buttonHoverColor: '#2563eb' } },
    { id: 'green', name: 'Green', colors: { primaryColor: '#22c55e', buttonTextColor: '#ffffff', buttonHoverColor: '#16a34a' } },
    { id: 'orange', name: 'Orange', colors: { primaryColor: '#f97316', buttonTextColor: '#ffffff', buttonHoverColor: '#ea580c' } },
    { id: 'red', name: 'Red', colors: { primaryColor: '#ef4444', buttonTextColor: '#ffffff', buttonHoverColor: '#dc2626' } },
  ];

  // Form color themes
  const FORM_THEMES = [
    {
      id: 'dark',
      name: 'Dark',
      colors: { backgroundColor: '#0a0a0a', textColor: '#ffffff', inputBackgroundColor: '#111111', inputBorderColor: '#333333', primaryColor: '#ffffff', buttonTextColor: '#000000' },
    },
    {
      id: 'purple',
      name: 'Purple',
      colors: { backgroundColor: '#1a1625', textColor: '#ffffff', inputBackgroundColor: '#2d2438', inputBorderColor: '#4c3d5e', primaryColor: '#8b5cf6', buttonTextColor: '#ffffff' },
    },
    {
      id: 'blue',
      name: 'Blue',
      colors: { backgroundColor: '#0f172a', textColor: '#ffffff', inputBackgroundColor: '#1e293b', inputBorderColor: '#334155', primaryColor: '#3b82f6', buttonTextColor: '#ffffff' },
    },
    {
      id: 'green',
      name: 'Green',
      colors: { backgroundColor: '#0f1f17', textColor: '#ffffff', inputBackgroundColor: '#1a2e23', inputBorderColor: '#2d4a3a', primaryColor: '#22c55e', buttonTextColor: '#ffffff' },
    },
    {
      id: 'light',
      name: 'Light',
      colors: { backgroundColor: '#ffffff', textColor: '#1f2937', inputBackgroundColor: '#f3f4f6', inputBorderColor: '#d1d5db', primaryColor: '#000000', buttonTextColor: '#ffffff' },
    },
    {
      id: 'orange',
      name: 'Orange',
      colors: { backgroundColor: '#1c1410', textColor: '#ffffff', inputBackgroundColor: '#2a1f18', inputBorderColor: '#4a3426', primaryColor: '#f97316', buttonTextColor: '#ffffff' },
    },
  ];

  // Form colors - element-specific when selected
  if (widgetType === 'form') {
    // Element-specific controls for form
    const formTitles: Record<string, string> = {
      'form-bg': 'Form Background',
      'form-title': 'Form Title',
      'form-input': 'Form Inputs',
      'form-button': 'Submit Button',
    };

    // Show element-specific controls when an element is selected
    if (selectedElement && selectedElement.startsWith('form-')) {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-800">
            <Palette className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium text-white">{formTitles[selectedElement] || 'Colors'}</h3>
          </div>

          <div className="space-y-1">
            {selectedElement === 'form-bg' && (
              <>
                <ColorRow label="Background" color={styles.backgroundColor || '#0a0a0a'} onChange={(c) => updateStyles({ backgroundColor: c })} widgetColors={widgetColors} />
                <ColorRow label="Text Color" color={styles.textColor || '#ffffff'} onChange={(c) => updateStyles({ textColor: c })} widgetColors={widgetColors} />
              </>
            )}

            {selectedElement === 'form-input' && (
              <>
                <ColorRow label="Background" color={styles.inputBackgroundColor || '#111111'} onChange={(c) => updateStyles({ inputBackgroundColor: c })} widgetColors={widgetColors} />
                <ColorRow label="Border" color={styles.inputBorderColor || '#333333'} onChange={(c) => updateStyles({ inputBorderColor: c })} widgetColors={widgetColors} />
                <ColorRow label="Text" color={styles.textColor || '#ffffff'} onChange={(c) => updateStyles({ textColor: c })} widgetColors={widgetColors} />
              </>
            )}

            {selectedElement === 'form-button' && (
              <>
                <ColorRow label="Button Color" color={styles.primaryColor || '#ffffff'} onChange={(c) => updateStyles({ primaryColor: c })} widgetColors={widgetColors} />
                <ColorRow label="Button Text" color={styles.buttonTextColor || '#000000'} onChange={(c) => updateStyles({ buttonTextColor: c })} widgetColors={widgetColors} />
              </>
            )}
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 mt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs text-gray-400">Click other elements to edit their colors</p>
            </div>
          </div>
        </div>
      );
    }

    // No element selected - show themes
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium text-white">Form Themes</h3>
          </div>
          <button
            onClick={() => updateStyles({
              backgroundColor: '#0a0a0a',
              textColor: '#ffffff',
              inputBackgroundColor: '#111111',
              inputBorderColor: '#333333',
              primaryColor: '#ffffff',
              buttonTextColor: '#000000',
            })}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Theme Grid */}
        <div className="grid grid-cols-3 gap-2">
          {FORM_THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => updateStyles(theme.colors)}
              className="p-2 bg-gray-800/30 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={`Apply ${theme.name} theme`}
            >
              <div className="h-8 rounded overflow-hidden border border-gray-700 mb-1.5" style={{ background: theme.colors.backgroundColor }}>
                <div className="h-3 mx-1 mt-1 rounded" style={{ background: theme.colors.inputBackgroundColor, border: `1px solid ${theme.colors.inputBorderColor}` }} />
                <div className="h-2.5 mx-1 mt-1 rounded" style={{ background: theme.colors.primaryColor }} />
              </div>
              <div className="text-xs text-white text-center">{theme.name}</div>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-800 pt-4 space-y-1">
          <ColorRow label="Background" color={styles.backgroundColor || '#0a0a0a'} onChange={(c) => updateStyles({ backgroundColor: c })} widgetColors={widgetColors} />
          <ColorRow label="Text" color={styles.textColor || '#ffffff'} onChange={(c) => updateStyles({ textColor: c })} widgetColors={widgetColors} />
          <ColorRow label="Input Background" color={styles.inputBackgroundColor || '#111111'} onChange={(c) => updateStyles({ inputBackgroundColor: c })} widgetColors={widgetColors} />
          <ColorRow label="Input Border" color={styles.inputBorderColor || '#333333'} onChange={(c) => updateStyles({ inputBorderColor: c })} widgetColors={widgetColors} />
          <ColorRow label="Button" color={styles.primaryColor || '#ffffff'} onChange={(c) => updateStyles({ primaryColor: c })} widgetColors={widgetColors} />
          <ColorRow label="Button Text" color={styles.buttonTextColor || '#000000'} onChange={(c) => updateStyles({ buttonTextColor: c })} widgetColors={widgetColors} />
        </div>

        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-400">Click elements in preview to edit colors</p>
          </div>
        </div>
      </div>
    );
  }

  // Button colors
  if (widgetType === 'button') {
    // Show element-specific controls when button is selected
    if (selectedElement === 'button-widget') {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-800">
            <Palette className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium text-white">Button Colors</h3>
          </div>

          <div className="space-y-1">
            <ColorRow label="Button Color" color={styles.primaryColor || '#ffffff'} onChange={(c) => updateStyles({ primaryColor: c })} widgetColors={widgetColors} />
            <ColorRow label="Text Color" color={styles.buttonTextColor || '#000000'} onChange={(c) => updateStyles({ buttonTextColor: c })} widgetColors={widgetColors} />
            <ColorRow label="Hover Color" color={styles.buttonHoverColor || '#e5e5e5'} onChange={(c) => updateStyles({ buttonHoverColor: c })} widgetColors={widgetColors} />
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 mt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs text-gray-400">Editing button colors</p>
            </div>
          </div>
        </div>
      );
    }

    // No element selected - show themes
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium text-white">Button Themes</h3>
          </div>
          <button
            onClick={() => updateStyles({
              primaryColor: '#ffffff',
              buttonTextColor: '#000000',
              buttonHoverColor: '#e5e5e5',
            })}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Button Theme Grid */}
        <div className="grid grid-cols-3 gap-2">
          {BUTTON_THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => updateStyles(theme.colors)}
              className="p-2 bg-gray-800/30 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={`Apply ${theme.name} theme`}
            >
              <div className="h-6 rounded mx-auto mb-1.5" style={{ background: theme.colors.primaryColor, width: '80%' }} />
              <div className="text-xs text-white text-center">{theme.name}</div>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-800 pt-4 space-y-1">
          <ColorRow label="Button" color={styles.primaryColor || '#ffffff'} onChange={(c) => updateStyles({ primaryColor: c })} widgetColors={widgetColors} />
          <ColorRow label="Text" color={styles.buttonTextColor || '#000000'} onChange={(c) => updateStyles({ buttonTextColor: c })} widgetColors={widgetColors} />
          <ColorRow label="Hover" color={styles.buttonHoverColor || '#e5e5e5'} onChange={(c) => updateStyles({ buttonHoverColor: c })} widgetColors={widgetColors} />
        </div>

        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-400">Click button in preview to edit colors</p>
          </div>
        </div>
      </div>
    );
  }

  // Chatbot: No element selected - show quick themes
  if (!selectedElement && widgetType === 'chatbot') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-white" />
            <h3 className="text-sm font-medium text-white">Themes</h3>
          </div>
          <button
            onClick={resetColors}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {QUICK_THEMES.map((theme, index) => (
            <button
              key={theme.id}
              onClick={() => applyTheme(theme)}
              className="p-2 bg-gray-800/30 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-white"
              tabIndex={0}
              aria-label={`Apply ${theme.name} theme`}
            >
              <div className="h-10 rounded overflow-hidden border border-gray-700 mb-2">
                <div
                  className="h-4"
                  style={{ background: theme.colors.headerGradient || theme.colors.headerColor }}
                />
                <div className="h-6 p-1 flex gap-0.5" style={{ background: theme.colors.chatBackgroundColor }}>
                  <div className="h-2 w-6 rounded" style={{ background: theme.colors.botMessageColor }} />
                  <div
                    className="h-2 w-5 rounded ml-auto"
                    style={{ background: theme.colors.userMessageGradient || theme.colors.userMessageColor }}
                  />
                </div>
              </div>
              <div className="text-xs text-white text-center">{theme.name}</div>
            </button>
          ))}
        </div>

        {/* Quick access to all colors */}
        <button
          onClick={() => setShowAllColors(!showAllColors)}
          className="w-full flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-400">Edit all colors</span>
          </div>
          {showAllColors ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showAllColors && (
          <div className="space-y-3 pt-2">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Bubble</div>
            <GradientInput
              label="Bubble"
              gradient={chatbotConfig.bubbleGradient}
              fallbackColor={chatbotConfig.bubbleColor || '#667eea'}
              onGradientChange={(g) => updateConfig({ bubbleGradient: g })}
              onColorChange={(c) => updateConfig({ bubbleColor: c })}
              widgetColors={widgetColors}
            />

            <div className="text-xs text-gray-500 uppercase tracking-wide pt-2">Header</div>
            <GradientInput
              label="Header"
              gradient={chatbotConfig.headerGradient}
              fallbackColor={chatbotConfig.headerColor || '#667eea'}
              onGradientChange={(g) => updateConfig({ headerGradient: g })}
              onColorChange={(c) => updateConfig({ headerColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="Header Text"
              color={chatbotConfig.headerTextColor || '#ffffff'}
              onChange={(c) => updateConfig({ headerTextColor: c })}
              widgetColors={widgetColors}
            />

            <div className="text-xs text-gray-500 uppercase tracking-wide pt-2">Chat Area</div>
            <GradientInput
              label="Background"
              gradient={chatbotConfig.chatBackgroundGradient}
              fallbackColor={chatbotConfig.chatBackgroundColor || '#0a0a0a'}
              onGradientChange={(g) => updateConfig({ chatBackgroundGradient: g })}
              onColorChange={(c) => updateConfig({ chatBackgroundColor: c })}
              widgetColors={widgetColors}
            />

            <div className="text-xs text-gray-500 uppercase tracking-wide pt-2">User Messages</div>
            <GradientInput
              label="User Bubble"
              gradient={chatbotConfig.userMessageGradient}
              fallbackColor={chatbotConfig.userMessageColor || '#667eea'}
              onGradientChange={(g) => updateConfig({ userMessageGradient: g })}
              onColorChange={(c) => updateConfig({ userMessageColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="User Text"
              color={chatbotConfig.userMessageTextColor || '#ffffff'}
              onChange={(c) => updateConfig({ userMessageTextColor: c })}
              widgetColors={widgetColors}
            />

            <div className="text-xs text-gray-500 uppercase tracking-wide pt-2">Bot Messages</div>
            <GradientInput
              label="Bot Bubble"
              gradient={chatbotConfig.botMessageGradient}
              fallbackColor={chatbotConfig.botMessageColor || '#1a1a1a'}
              onGradientChange={(g) => updateConfig({ botMessageGradient: g })}
              onColorChange={(c) => updateConfig({ botMessageColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="Bot Text"
              color={chatbotConfig.botMessageTextColor || '#ffffff'}
              onChange={(c) => updateConfig({ botMessageTextColor: c })}
              widgetColors={widgetColors}
            />

            <div className="text-xs text-gray-500 uppercase tracking-wide pt-2">Input Area</div>
            <ColorRow
              label="Input Background"
              color={chatbotConfig.inputBackgroundColor || '#1a1a1a'}
              onChange={(c) => updateConfig({ inputBackgroundColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="Input Text"
              color={chatbotConfig.inputTextColor || '#ffffff'}
              onChange={(c) => updateConfig({ inputTextColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="Send Button"
              color={chatbotConfig.sendButtonColor || '#ffffff'}
              onChange={(c) => updateConfig({ sendButtonColor: c })}
              widgetColors={widgetColors}
            />
          </div>
        )}

        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-400">Click elements in preview to edit colors</p>
          </div>
        </div>
      </div>
    );
  }

  // Element-specific controls
  const titles: Record<string, string> = {
    'bubble': 'Bubble',
    'header-bg': 'Header',
    'header-text': 'Header Text',
    'chat-bg': 'Chat Background',
    'user-msg': 'Your Messages',
    'user-text': 'Your Text',
    'user-avatar': 'User Avatar',
    'bot-msg': 'Bot Messages',
    'bot-text': 'Bot Text',
    'bot-avatar': 'Bot Avatar',
    'input': 'Input Area',
    'send-button': 'Send Button',
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-800">
        <Palette className="w-4 h-4 text-white" />
        <h3 className="text-sm font-medium text-white">{titles[selectedElement || ''] || 'Colors'}</h3>
      </div>

      <div className="space-y-1">
        {/* Bubble */}
        {selectedElement === 'bubble' && (
          <>
            <GradientInput
              label="Color"
              gradient={chatbotConfig.bubbleGradient}
              fallbackColor={chatbotConfig.bubbleColor || '#667eea'}
              onGradientChange={(g) => updateConfig({ bubbleGradient: g })}
              onColorChange={(c) => updateConfig({ bubbleColor: c })}
              widgetColors={widgetColors}
            />
            <Toggle
              label="Glow"
              checked={chatbotConfig.bubbleGlow || false}
              onChange={(v) => updateConfig({ bubbleGlow: v })}
              id="bubble-glow-toggle"
            />
            {chatbotConfig.bubbleGlow && (
              <ColorRow
                label="Glow Color"
                color={chatbotConfig.bubbleGlowColor || '#667eea'}
                onChange={(c) => updateConfig({ bubbleGlowColor: c })}
                widgetColors={widgetColors}
              />
            )}
            <Slider
              label="Size"
              value={Number(chatbotConfig.bubbleSize) || 60}
              onChange={(v) => updateConfig({ bubbleSize: v })}
              min={48}
              max={96}
            />
          </>
        )}

        {/* Header Background */}
        {selectedElement === 'header-bg' && (
          <GradientInput
            label="Background"
            gradient={chatbotConfig.headerGradient}
            fallbackColor={chatbotConfig.headerColor || '#667eea'}
            onGradientChange={(g) => updateConfig({ headerGradient: g })}
            onColorChange={(c) => updateConfig({ headerColor: c })}
            widgetColors={widgetColors}
          />
        )}

        {/* Header Text */}
        {selectedElement === 'header-text' && (
          <ColorRow
            label="Text Color"
            color={chatbotConfig.headerTextColor || '#ffffff'}
            onChange={(c) => updateConfig({ headerTextColor: c })}
            widgetColors={widgetColors}
          />
        )}

        {/* Chat Background */}
        {selectedElement === 'chat-bg' && (
          <GradientInput
            label="Background"
            gradient={chatbotConfig.chatBackgroundGradient}
            fallbackColor={chatbotConfig.chatBackgroundColor || '#0a0a0a'}
            onGradientChange={(g) => updateConfig({ chatBackgroundGradient: g })}
            onColorChange={(c) => updateConfig({ chatBackgroundColor: c })}
            widgetColors={widgetColors}
          />
        )}

        {/* User Message */}
        {selectedElement === 'user-msg' && (
          <>
            <GradientInput
              label="Background"
              gradient={chatbotConfig.userMessageGradient}
              fallbackColor={chatbotConfig.userMessageColor || '#667eea'}
              onGradientChange={(g) => updateConfig({ userMessageGradient: g })}
              onColorChange={(c) => updateConfig({ userMessageColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="Text"
              color={chatbotConfig.userMessageTextColor || '#ffffff'}
              onChange={(c) => updateConfig({ userMessageTextColor: c })}
              widgetColors={widgetColors}
            />
            <Toggle
              label="Glow"
              checked={chatbotConfig.userMessageGlow || false}
              onChange={(v) => updateConfig({ userMessageGlow: v })}
              id="user-msg-glow-toggle"
            />
            {chatbotConfig.userMessageGlow && (
              <ColorRow
                label="Glow Color"
                color={chatbotConfig.userMessageGlowColor || '#667eea'}
                onChange={(c) => updateConfig({ userMessageGlowColor: c })}
                widgetColors={widgetColors}
              />
            )}
          </>
        )}

        {/* User Text (separate) */}
        {selectedElement === 'user-text' && (
          <ColorRow
            label="Text Color"
            color={chatbotConfig.userMessageTextColor || '#ffffff'}
            onChange={(c) => updateConfig({ userMessageTextColor: c })}
            widgetColors={widgetColors}
          />
        )}

        {/* Bot Message */}
        {selectedElement === 'bot-msg' && (
          <>
            <GradientInput
              label="Background"
              gradient={chatbotConfig.botMessageGradient}
              fallbackColor={chatbotConfig.botMessageColor || '#1a1a1a'}
              onGradientChange={(g) => updateConfig({ botMessageGradient: g })}
              onColorChange={(c) => updateConfig({ botMessageColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="Text"
              color={chatbotConfig.botMessageTextColor || '#ffffff'}
              onChange={(c) => updateConfig({ botMessageTextColor: c })}
              widgetColors={widgetColors}
            />
            <Toggle
              label="Glow"
              checked={chatbotConfig.botMessageGlow || false}
              onChange={(v) => updateConfig({ botMessageGlow: v })}
              id="bot-msg-glow-toggle"
            />
            {chatbotConfig.botMessageGlow && (
              <ColorRow
                label="Glow Color"
                color={chatbotConfig.botMessageGlowColor || '#000000'}
                onChange={(c) => updateConfig({ botMessageGlowColor: c })}
                widgetColors={widgetColors}
              />
            )}
          </>
        )}

        {/* Bot Text (separate) */}
        {selectedElement === 'bot-text' && (
          <ColorRow
            label="Text Color"
            color={chatbotConfig.botMessageTextColor || '#ffffff'}
            onChange={(c) => updateConfig({ botMessageTextColor: c })}
            widgetColors={widgetColors}
          />
        )}

        {/* User Avatar */}
        {selectedElement === 'user-avatar' && (
          <>
            <ColorRow
              label="Background"
              color={chatbotConfig.userAvatarColor || '#667eea'}
              onChange={(c) => updateConfig({ userAvatarColor: c })}
              widgetColors={widgetColors}
            />
            <div className="py-2">
              <label className="text-sm text-gray-300 block mb-2">Icon</label>
              <div className="grid grid-cols-4 gap-1.5">
                {AVATAR_ICONS.map((avatarIcon) => {
                  const IconComponent = avatarIcon.icon;
                  const isSelected = (chatbotConfig.userAvatarIcon || 'user') === avatarIcon.id && !chatbotConfig.userAvatarCustom;
                  return (
                    <button
                      key={avatarIcon.id}
                      onClick={() => updateConfig({ userAvatarIcon: avatarIcon.id, userAvatarCustom: undefined })}
                      className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 ${
                        isSelected
                          ? 'bg-white text-black ring-2 ring-white'
                          : 'bg-gray-800 text-white hover:bg-gray-700'
                      }`}
                      title={avatarIcon.label}
                    >
                      <IconComponent className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
              {/* Custom emoji/URL input */}
              <div className="mt-3">
                <label className="text-xs text-gray-400 mb-1.5 block">Custom emoji or image URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatbotConfig.userAvatarCustom || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateConfig({
                        userAvatarCustom: value || undefined,
                        userAvatarIcon: value ? 'custom' : 'user'
                      });
                    }}
                    placeholder="🚀 or https://..."
                    className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                  />
                  {chatbotConfig.userAvatarCustom && (
                    <button
                      onClick={() => updateConfig({ userAvatarCustom: undefined, userAvatarIcon: 'user' })}
                      className="px-3 py-2 text-xs text-gray-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Bot Avatar */}
        {selectedElement === 'bot-avatar' && (
          <>
            <ColorRow
              label="Background"
              color={chatbotConfig.botAvatarColor || '#374151'}
              onChange={(c) => updateConfig({ botAvatarColor: c })}
              widgetColors={widgetColors}
            />
            <div className="py-2">
              <label className="text-sm text-gray-300 block mb-2">Icon</label>
              <div className="grid grid-cols-4 gap-1.5">
                {AVATAR_ICONS.map((avatarIcon) => {
                  const IconComponent = avatarIcon.icon;
                  const isSelected = (chatbotConfig.botAvatarIcon || 'bot') === avatarIcon.id && !chatbotConfig.botAvatarCustom;
                  return (
                    <button
                      key={avatarIcon.id}
                      onClick={() => updateConfig({ botAvatarIcon: avatarIcon.id, botAvatarCustom: undefined })}
                      className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 ${
                        isSelected
                          ? 'bg-white text-black ring-2 ring-white'
                          : 'bg-gray-800 text-white hover:bg-gray-700'
                      }`}
                      title={avatarIcon.label}
                    >
                      <IconComponent className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
              {/* Custom emoji/URL input */}
              <div className="mt-3">
                <label className="text-xs text-gray-400 mb-1.5 block">Custom emoji or image URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatbotConfig.botAvatarCustom || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateConfig({
                        botAvatarCustom: value || undefined,
                        botAvatarIcon: value ? 'custom' : 'bot'
                      });
                    }}
                    placeholder="🤖 or https://..."
                    className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                  />
                  {chatbotConfig.botAvatarCustom && (
                    <button
                      onClick={() => updateConfig({ botAvatarCustom: undefined, botAvatarIcon: 'bot' })}
                      className="px-3 py-2 text-xs text-gray-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Input Area */}
        {selectedElement === 'input' && (
          <>
            <ColorRow
              label="Background"
              color={chatbotConfig.inputBackgroundColor || '#1a1a1a'}
              onChange={(c) => updateConfig({ inputBackgroundColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="Text"
              color={chatbotConfig.inputTextColor || '#ffffff'}
              onChange={(c) => updateConfig({ inputTextColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="Placeholder"
              color={chatbotConfig.inputPlaceholderColor || '#666666'}
              onChange={(c) => updateConfig({ inputPlaceholderColor: c })}
              widgetColors={widgetColors}
            />
            <ColorRow
              label="Send Button"
              color={chatbotConfig.sendButtonColor || '#ffffff'}
              onChange={(c) => updateConfig({ sendButtonColor: c })}
              widgetColors={widgetColors}
            />
          </>
        )}

        {/* Send Button */}
        {selectedElement === 'send-button' && (
          <ColorRow
            label="Button Color"
            color={chatbotConfig.sendButtonColor || '#ffffff'}
            onChange={(c) => updateConfig({ sendButtonColor: c })}
            widgetColors={widgetColors}
          />
        )}
      </div>
    </div>
  );
}
