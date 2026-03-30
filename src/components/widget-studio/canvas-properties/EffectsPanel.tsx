'use client';

import React from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';

// Custom select class with proper dropdown arrow
const selectClassName = "w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-white focus:border-white transition-colors appearance-none bg-no-repeat bg-[length:16px_16px] bg-[position:right_12px_center] pr-10 cursor-pointer";
const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
};

// ChatbotConfig matches the interface from page.tsx
type ChatbotConfig = Record<string, any>;
type WidgetStyles = Record<string, any>;

interface EffectsPanelProps {
  widgetType: 'chatbot' | 'form' | 'button';
  chatbotConfig: ChatbotConfig;
  onChatbotConfigChange: (config: ChatbotConfig) => void;
  styles?: WidgetStyles;
  onStylesChange?: (styles: WidgetStyles) => void;
}

const BACKGROUND_PATTERNS = [
  { value: 'none', label: 'None' },
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'waves', label: 'Waves' },
  { value: 'particles', label: 'Particles' },
];

const TYPING_INDICATOR_OPTIONS = [
  { value: 'dots', label: 'Bouncing Dots' },
  { value: 'pulse', label: 'Pulsing Dots' },
  { value: 'wave', label: 'Wave Dots' },
  { value: 'none', label: 'None (Disabled)' },
];

export function EffectsPanel({ widgetType, chatbotConfig, onChatbotConfigChange }: EffectsPanelProps) {
  const updateConfig = (updates: Partial<ChatbotConfig>) => {
    onChatbotConfigChange({ ...chatbotConfig, ...updates });
  };

  const resetAllEffects = () => {
    updateConfig({
      glassEffect: false,
      backdropBlur: '10',
      chatBackgroundPattern: 'none',
      userMessageShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
      botMessageShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    });
  };

  // Custom toggle component
  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (val: boolean) => void; label: string }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-white' : 'bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
            checked ? 'translate-x-6 bg-black' : 'translate-x-1 bg-gray-400'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white" />
            <h3 className="text-lg font-medium text-white">Visual Effects</h3>
          </div>
          <button
            onClick={resetAllEffects}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Reset all effects"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-400">Add glass, pattern, and shadow effects</p>
      </div>

      {/* Chatbot-specific effects */}
      {widgetType === 'chatbot' && (
        <>
          {/* Glass Effect */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white">Glass Effect</h4>

            <Toggle
              label="Enable Glass Morphism"
              checked={chatbotConfig.glassEffect || false}
              onChange={(val) => updateConfig({ glassEffect: val })}
            />

            {chatbotConfig.glassEffect && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400">Backdrop Blur</label>
                  <span className="text-sm text-white font-mono">{chatbotConfig.backdropBlur || '10'}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={chatbotConfig.backdropBlur || '10'}
                  onChange={(e) => updateConfig({ backdropBlur: e.target.value })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            )}
          </div>

          {/* Background Patterns */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white">Background Pattern</h4>

            <select
              value={chatbotConfig.chatBackgroundPattern || 'none'}
              onChange={(e) => updateConfig({ chatBackgroundPattern: e.target.value })}
              className={selectClassName}
              style={selectStyle}
            >
              {BACKGROUND_PATTERNS.map((pattern) => (
                <option key={pattern.value} value={pattern.value}>
                  {pattern.label}
                </option>
              ))}
            </select>

            {/* Pattern preview hint */}
            {chatbotConfig.chatBackgroundPattern && chatbotConfig.chatBackgroundPattern !== 'none' && (
              <p className="text-xs text-gray-500">
                Pattern will be visible in the chat background area
              </p>
            )}
          </div>

          {/* Shadow Effects */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white">Message Shadows</h4>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">User Message Shadow</label>
              <select
                value={chatbotConfig.userMessageShadow || 'none'}
                onChange={(e) => updateConfig({ userMessageShadow: e.target.value })}
                className={selectClassName}
                style={selectStyle}
              >
                <option value="none">None</option>
                <option value="0 2px 8px rgba(0, 0, 0, 0.1)">Subtle</option>
                <option value="0 4px 14px rgba(102, 126, 234, 0.4)">Default</option>
                <option value="0 8px 24px rgba(102, 126, 234, 0.6)">Strong</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Bot Message Shadow</label>
              <select
                value={chatbotConfig.botMessageShadow || 'none'}
                onChange={(e) => updateConfig({ botMessageShadow: e.target.value })}
                className={selectClassName}
                style={selectStyle}
              >
                <option value="none">None</option>
                <option value="0 2px 8px rgba(0, 0, 0, 0.2)">Default</option>
                <option value="0 4px 16px rgba(0, 0, 0, 0.3)">Strong</option>
              </select>
            </div>
          </div>

          {/* Typing Indicator */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white">Typing Indicator</h4>
            <p className="text-xs text-gray-500">Animation shown while AI is responding</p>

            <select
              value={chatbotConfig.typingIndicator || 'dots'}
              onChange={(e) => updateConfig({ typingIndicator: e.target.value })}
              className={selectClassName}
              style={selectStyle}
            >
              {TYPING_INDICATOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Live Preview */}
            {chatbotConfig.typingIndicator !== 'none' && (
              <div className="mt-3">
                <label className="text-xs text-gray-500 mb-2 block">Preview</label>
                <div className="flex items-center gap-1.5 p-4 bg-gray-800/50 rounded-lg">
                  <style>{`
                    @keyframes typing-dots-effects {
                      0%, 20% { opacity: 0.3; transform: translateY(0); }
                      50% { opacity: 1; transform: translateY(-4px); }
                      80%, 100% { opacity: 0.3; transform: translateY(0); }
                    }
                    @keyframes typing-pulse-effects {
                      0%, 100% { opacity: 0.3; transform: scale(0.8); }
                      50% { opacity: 1; transform: scale(1); }
                    }
                    @keyframes typing-wave-effects {
                      0%, 100% { transform: translateY(0); }
                      50% { transform: translateY(-6px); }
                    }
                  `}</style>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-white"
                      style={{
                        animation: chatbotConfig.typingIndicator === 'dots'
                          ? `typing-dots-effects 1.4s ease-in-out infinite ${i * 0.15}s`
                          : chatbotConfig.typingIndicator === 'pulse'
                          ? `typing-pulse-effects 1.4s ease-in-out infinite ${i * 0.15}s`
                          : `typing-wave-effects 1.2s ease-in-out infinite ${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
