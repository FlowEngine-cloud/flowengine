'use client';

import React from 'react';
import { Play, MessageSquare } from 'lucide-react';

// Custom select styles with proper dropdown arrow
const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
};

type ChatbotConfig = Record<string, any>;

interface AnimationsPanelProps {
  chatbotConfig: ChatbotConfig;
  onChatbotConfigChange: (config: ChatbotConfig) => void;
}

// Continuous animations (loop forever)
const BUBBLE_LOOP_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'shake', label: 'Shake' },
];

// One-time animations (play once when chat opens)
const WINDOW_OPEN_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'slideUp', label: 'Slide Up' },
  { value: 'fadeIn', label: 'Fade In' },
  { value: 'scaleIn', label: 'Scale In' },
];

// Toggle component
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
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

// Select row component
function SelectRow({ label, value, options, onChange, hint }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-white appearance-none bg-no-repeat bg-[length:14px_14px] bg-[position:right_8px_center] pr-8 cursor-pointer"
          style={selectArrowStyle}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function AnimationsPanel({ chatbotConfig, onChatbotConfigChange }: AnimationsPanelProps) {
  const updateConfig = (updates: Partial<ChatbotConfig>) => {
    onChatbotConfigChange({ ...chatbotConfig, ...updates });
  };

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-800">
        <Play className="w-4 h-4 text-white" />
        <h3 className="text-sm font-medium text-white">Animations & Behavior</h3>
      </div>

      {/* Bubble Animation - Loops continuously */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-400 uppercase tracking-wide">Continuous</span>
        </div>
        <SelectRow
          label="Bubble Animation"
          value={chatbotConfig.bubbleAnimation || 'none'}
          options={BUBBLE_LOOP_ANIMATIONS}
          onChange={(v) => updateConfig({ bubbleAnimation: v })}
          hint="Loops continuously to attract attention"
        />
      </div>

      {/* Window Animation - One time */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-400 uppercase tracking-wide">One-time</span>
        </div>
        <SelectRow
          label="Window Open"
          value={chatbotConfig.windowAnimation || 'slideUp'}
          options={WINDOW_OPEN_ANIMATIONS}
          onChange={(v) => updateConfig({ windowAnimation: v })}
          hint="Plays once when chat window opens"
        />
      </div>

      {/* Notification Message */}
      <div className="space-y-3 pt-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-white" />
          <span className="text-sm font-medium text-white">Greeting Message</span>
        </div>

        <Toggle
          label="Show greeting bubble"
          checked={chatbotConfig.showGreeting || false}
          onChange={(v) => updateConfig({ showGreeting: v })}
        />

        {chatbotConfig.showGreeting && (
          <>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Message</label>
              <input
                type="text"
                value={chatbotConfig.greetingMessage || 'Hi! How can I help you?'}
                onChange={(e) => updateConfig({ greetingMessage: e.target.value })}
                placeholder="Hi! How can I help you?"
                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Show after</span>
                <span className="text-xs text-gray-400">{chatbotConfig.greetingDelay || 2}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={chatbotConfig.greetingDelay || 2}
                onChange={(e) => updateConfig({ greetingDelay: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <Toggle
              label="Auto-hide after 10s"
              checked={chatbotConfig.greetingAutoHide || false}
              onChange={(v) => updateConfig({ greetingAutoHide: v })}
            />
          </>
        )}
      </div>

      {/* Auto Open */}
      <div className="space-y-3 pt-3 border-t border-gray-800">
        <span className="text-sm font-medium text-white">Auto Open</span>

        <Toggle
          label="Open chat automatically"
          checked={chatbotConfig.autoOpen || false}
          onChange={(v) => updateConfig({ autoOpen: v })}
        />

        {chatbotConfig.autoOpen && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Delay</span>
              <span className="text-xs text-gray-400">{chatbotConfig.autoOpenDelay || 5}s</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              value={chatbotConfig.autoOpenDelay || 5}
              onChange={(e) => updateConfig({ autoOpenDelay: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}
