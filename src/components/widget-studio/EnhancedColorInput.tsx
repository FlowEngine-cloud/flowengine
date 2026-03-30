'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { ColorPickerPopover, ColorSwatch } from './ColorPickerPopover';

interface EnhancedColorInputProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  description?: string;
  showPresets?: boolean;
  presets?: string[];
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}

const DEFAULT_PRESETS = [
  '#ffffff', '#000000', '#6366f1', '#ec4899',
  '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6',
];

export function EnhancedColorInput({
  label,
  value,
  onChange,
  description,
  showPresets = false,
  presets = DEFAULT_PRESETS,
  size = 'md',
  inline = false,
}: EnhancedColorInputProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (inline) {
    // Compact inline mode: label + swatch on same row
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm text-gray-400 truncate">{label}</span>
          {description && (
            <div className="relative flex-shrink-0">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="p-0.5 rounded-full hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <HelpCircle className="w-3 h-3" />
              </button>
              {showTooltip && (
                <div className="absolute left-0 top-6 z-10 w-48 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 shadow-lg">
                  {description}
                </div>
              )}
            </div>
          )}
        </div>
        <ColorPickerPopover
          color={value}
          onChange={onChange}
          side="left"
          trigger={<ColorSwatch color={value} size={size} />}
        />
      </div>
    );
  }

  // Full mode with label above swatch
  return (
    <div className="space-y-2">
      {/* Label with tooltip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">{label}</label>
          {description && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="p-0.5 rounded-full hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              {showTooltip && (
                <div className="absolute left-0 top-6 z-10 w-48 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 shadow-lg">
                  {description}
                </div>
              )}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500 font-mono uppercase">{value}</span>
      </div>

      {/* Canva-style circular swatch with popover */}
      <div className="flex items-center gap-3">
        <ColorPickerPopover
          color={value}
          onChange={onChange}
          trigger={<ColorSwatch color={value} size="lg" />}
        />

        {/* Quick Presets (only if enabled) */}
        {showPresets && (
          <div className="flex gap-1.5 flex-wrap flex-1">
            {presets.slice(0, 6).map((preset) => (
              <button
                key={preset}
                onClick={() => onChange(preset)}
                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                  value.toLowerCase() === preset.toLowerCase()
                    ? 'border-white scale-110'
                    : 'border-gray-700 hover:border-gray-500'
                }`}
                style={{ background: preset }}
                title={preset}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
