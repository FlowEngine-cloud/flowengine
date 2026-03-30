'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { X, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  trigger: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  widgetColors?: string[]; // Colors currently in use in the component
}

const PRESET_COLORS = [
  // Row 1: Grayscale
  '#ffffff', '#f3f4f6', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#1f2937', '#000000',
  // Row 2: Colors
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  // Row 3: More colors
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

const RECENT_COLORS_KEY = 'widget-studio-recent-colors';
const MAX_RECENT_COLORS = 8;

function getRecentColors(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_COLORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentColor(color: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const recent = getRecentColors();
    const normalized = color.toLowerCase();
    const filtered = recent.filter(c => c.toLowerCase() !== normalized);
    const updated = [normalized, ...filtered].slice(0, MAX_RECENT_COLORS);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function ColorPickerPopover({
  color,
  onChange,
  trigger,
  side = 'right',
  align = 'start',
  widgetColors = [],
}: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [localColor, setLocalColor] = useState(color);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [originalColor] = useState(color);
  const [showPresets, setShowPresets] = useState(false);

  // Load recent colors on mount
  useEffect(() => {
    setRecentColors(getRecentColors());
  }, []);

  // Sync local color when prop changes
  useEffect(() => {
    setLocalColor(color);
  }, [color]);

  const handleColorChange = useCallback((newColor: string) => {
    setLocalColor(newColor);
    onChange(newColor);
  }, [onChange]);

  const handleApply = useCallback(() => {
    const updated = saveRecentColor(localColor);
    setRecentColors(updated);
    setOpen(false);
  }, [localColor]);

  const handleReset = useCallback(() => {
    setLocalColor(originalColor);
    onChange(originalColor);
  }, [originalColor, onChange]);

  const handlePresetClick = useCallback((preset: string) => {
    handleColorChange(preset);
  }, [handleColorChange]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[9999] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-[280px] animate-in fade-in-0 zoom-in-95"
          side={side}
          align={align}
          sideOffset={8}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white">Choose Color</span>
            <Popover.Close asChild>
              <button className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Popover.Close>
          </div>

          {/* Color Picker */}
          <div className="mb-4">
            <HexColorPicker
              color={localColor}
              onChange={handleColorChange}
              style={{ width: '100%', height: '160px' }}
            />
          </div>

          {/* Hex Input */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-10 h-10 rounded-full border-2 border-gray-600 flex-shrink-0"
              style={{ background: localColor }}
            />
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">#</span>
              <HexColorInput
                color={localColor}
                onChange={handleColorChange}
                prefixed={false}
                className="w-full pl-7 pr-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-white focus:border-white uppercase"
              />
            </div>
          </div>

          {/* Component Colors - Colors currently in use */}
          {widgetColors.length > 0 && (
            <div className="mb-4">
              <span className="text-xs text-gray-400 mb-2 block">Component Colors</span>
              <div className="flex gap-2 flex-wrap">
                {widgetColors.map((widgetColor, index) => (
                  <button
                    key={`widget-${widgetColor}-${index}`}
                    onClick={() => handlePresetClick(widgetColor)}
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                      localColor.toLowerCase() === widgetColor.toLowerCase()
                        ? 'border-white scale-110 ring-2 ring-white/30'
                        : 'border-blue-500/50 hover:border-blue-400'
                    }`}
                    style={{ background: widgetColor }}
                    title={widgetColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent Colors */}
          {recentColors.length > 0 && (
            <div className="mb-4">
              <span className="text-xs text-gray-400 mb-2 block">Recent</span>
              <div className="flex gap-2 flex-wrap">
                {recentColors.map((recentColor, index) => (
                  <button
                    key={`${recentColor}-${index}`}
                    onClick={() => handlePresetClick(recentColor)}
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                      localColor.toLowerCase() === recentColor.toLowerCase()
                        ? 'border-white scale-110 ring-2 ring-white/30'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ background: recentColor }}
                    title={recentColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Preset Colors - Collapsible */}
          <div className="mb-4">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 mb-2 transition-colors"
            >
              {showPresets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showPresets ? 'Hide presets' : 'More colors'}
            </button>
            {showPresets && (
              <div className="grid grid-cols-8 gap-1.5">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetClick(preset)}
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                      localColor.toLowerCase() === preset.toLowerCase()
                        ? 'border-white scale-110 ring-2 ring-white/30'
                        : 'border-gray-700 hover:border-gray-500'
                    }`}
                    style={{ background: preset }}
                    title={preset}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 px-3 py-2 border border-gray-700 hover:bg-gray-800 text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-3 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Apply
            </button>
          </div>

          <Popover.Arrow className="fill-gray-700" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Canva-style circular color swatch trigger
interface ColorSwatchProps {
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ColorSwatch({ color, size = 'md', className = '' }: ColorSwatchProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-2 border-gray-600 cursor-pointer hover:border-gray-400 hover:scale-105 transition-all shadow-inner ${className}`}
      style={{ background: color }}
    />
  );
}
