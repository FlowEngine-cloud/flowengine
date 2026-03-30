'use client';

import React, { useState } from 'react';
import { Settings, Code, ChevronDown, ChevronUp, Eye, Shield } from 'lucide-react';

type ChatbotConfig = Record<string, any>;
type WidgetStyles = Record<string, any>;

interface AdvancedPanelProps {
  widgetType: 'chatbot' | 'form' | 'button';
  chatbotConfig: ChatbotConfig;
  onChatbotConfigChange: (config: ChatbotConfig) => void;
  styles?: WidgetStyles;
  onStylesChange?: (styles: WidgetStyles) => void;
  canHideWatermark?: boolean; // Pro+ feature
}

export function AdvancedPanel({
  widgetType,
  chatbotConfig,
  onChatbotConfigChange,
  styles = {},
  onStylesChange,
  canHideWatermark = false,
}: AdvancedPanelProps) {
  const [showCSSEditor, setShowCSSEditor] = useState(false);

  const updateConfig = (updates: Partial<ChatbotConfig>) => {
    onChatbotConfigChange({ ...chatbotConfig, ...updates });
  };

  const updateStyles = (updates: Partial<WidgetStyles>) => {
    if (onStylesChange) {
      onStylesChange({ ...styles, ...updates });
    }
  };

  // Get the appropriate customCSS and setter based on component type
  const getCustomCSS = () => {
    if (widgetType === 'chatbot') {
      return chatbotConfig.customCSS || '';
    }
    return styles.customCSS || '';
  };

  const setCustomCSS = (css: string) => {
    if (widgetType === 'chatbot') {
      updateConfig({ customCSS: css });
    } else {
      updateStyles({ customCSS: css });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5 text-white" />
          <h3 className="text-lg font-medium text-white">Advanced Settings</h3>
        </div>
        <p className="text-sm text-gray-400">Custom CSS and branding options</p>
      </div>

      {/* Branding Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-400" />
          <h4 className="text-sm font-medium text-white">Branding</h4>
        </div>

        {/* Watermark Toggle */}
        <div className={`flex items-center justify-between gap-4 p-4 bg-gray-800/30 border border-gray-700 rounded-lg ${!canHideWatermark ? 'opacity-60' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white mb-1 flex items-center gap-2">
              Show Watermark
              {!canHideWatermark && (
                <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded font-medium">PRO+</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {canHideWatermark
                ? 'Displays "Powered by FlowEngine" badge'
                : 'Upgrade to Max to hide the watermark'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={chatbotConfig.showWatermark !== false}
            onClick={() => canHideWatermark && updateConfig({ showWatermark: chatbotConfig.showWatermark === false })}
            disabled={!canHideWatermark}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              !canHideWatermark
                ? 'bg-gray-700 cursor-not-allowed'
                : chatbotConfig.showWatermark !== false
                  ? 'bg-white cursor-pointer'
                  : 'bg-gray-700 cursor-pointer'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                chatbotConfig.showWatermark !== false ? 'translate-x-6 bg-black' : 'translate-x-1 bg-gray-400'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Rate Limit Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          <h4 className="text-sm font-medium text-white">
            {widgetType === 'chatbot' ? 'Message Limit' : 'Submission Limit'}
          </h4>
        </div>

        <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Max per session</span>
            <span className="text-xs text-gray-400">
              {widgetType === 'chatbot'
                ? (chatbotConfig.maxMessagesPerSession || 0 ? chatbotConfig.maxMessagesPerSession : 'Unlimited')
                : (styles.maxSubmissionsPerSession || 0 ? styles.maxSubmissionsPerSession : 'Unlimited')
              }
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={widgetType === 'chatbot' ? '100' : '50'}
            step={widgetType === 'chatbot' ? '5' : '1'}
            value={widgetType === 'chatbot'
              ? (chatbotConfig.maxMessagesPerSession || 0)
              : (styles.maxSubmissionsPerSession || 0)
            }
            onChange={(e) => {
              if (widgetType === 'chatbot') {
                updateConfig({ maxMessagesPerSession: parseInt(e.target.value) });
              } else {
                updateStyles({ maxSubmissionsPerSession: parseInt(e.target.value) });
              }
            }}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <p className="text-xs text-gray-500">0 = unlimited. For stricter limits, configure in n8n.</p>
        </div>
      </div>

      {/* Custom CSS Section */}
      <div className="space-y-4">
        <button
          onClick={() => setShowCSSEditor(!showCSSEditor)}
          className="w-full flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-white">Custom CSS</span>
            {getCustomCSS() && (
              <span className="px-1.5 py-0.5 text-[10px] bg-white/10 rounded text-gray-400">Active</span>
            )}
          </div>
          {showCSSEditor ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showCSSEditor && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Add custom CSS to style your {widgetType}. Use <code className="text-gray-400">.widget-container</code> as the root selector.
            </p>
            <textarea
              value={getCustomCSS()}
              onChange={(e) => setCustomCSS(e.target.value)}
              placeholder={widgetType === 'chatbot'
                ? `.widget-container {
  /* Your custom styles */
}

.widget-container .message-user {
  /* User message styles */
}

.widget-container .message-bot {
  /* Bot message styles */
}`
                : widgetType === 'form'
                ? `.widget-container {
  /* Form container styles */
}

.widget-container input,
.widget-container textarea {
  /* Input field styles */
}

.widget-container button[type="submit"] {
  /* Submit button styles */
}`
                : `.widget-container {
  /* Button container styles */
}

.widget-container .widget-button {
  /* Button styles */
}

.widget-container .widget-button:hover {
  /* Hover state styles */
}`
              }
              className="w-full h-40 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white font-mono text-xs placeholder:text-gray-600 focus:ring-2 focus:ring-white focus:border-white resize-none"
              spellCheck={false}
            />
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-gray-600">
                {(getCustomCSS().length || 0).toLocaleString()} / 10,000 chars
              </p>
              {getCustomCSS() && (
                <button
                  onClick={() => setCustomCSS('')}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear CSS
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
