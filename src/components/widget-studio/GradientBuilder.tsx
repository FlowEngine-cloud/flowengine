'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, ChevronDown } from 'lucide-react';

interface GradientBuilderProps {
  label: string;
  value: string; // Can be gradient string or solid color
  solidColor?: string; // The solid color fallback
  onChange: (gradient: string | undefined) => void;
  onSolidColorChange?: (color: string) => void;
  description?: string;
}

const GRADIENT_PRESETS = [
  { name: 'Purple Dream', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Fire', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)' },
  { name: 'Neon', value: 'linear-gradient(135deg, #ff006a 0%, #d500f9 100%)' },
  { name: 'Cyberpunk', value: 'linear-gradient(135deg, #fcff00 0%, #00ffff 100%)' },
  { name: 'Royal', value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
];

export function GradientBuilder({
  label,
  value,
  solidColor,
  onChange,
  onSolidColorChange,
  description
}: GradientBuilderProps) {
  const [mode, setMode] = useState<'solid' | 'gradient'>(value && value.includes('gradient') ? 'gradient' : 'solid');
  const [startColor, setStartColor] = useState('#667eea');
  const [endColor, setEndColor] = useState('#764ba2');
  const [angle, setAngle] = useState(135);
  const [showPresets, setShowPresets] = useState(false);

  // Parse existing gradient value
  useEffect(() => {
    if (value && value.includes('linear-gradient')) {
      const angleMatch = value.match(/(\d+)deg/);
      const colorMatches = value.match(/#[0-9a-fA-F]{6}/g);

      if (angleMatch) setAngle(parseInt(angleMatch[1]));
      if (colorMatches && colorMatches.length >= 2) {
        setStartColor(colorMatches[0]);
        setEndColor(colorMatches[1]);
      }
    }
  }, [value]);

  const generateGradient = (start: string, end: string, deg: number) => {
    return `linear-gradient(${deg}deg, ${start} 0%, ${end} 100%)`;
  };

  const handleModeChange = (newMode: 'solid' | 'gradient') => {
    setMode(newMode);
    if (newMode === 'solid') {
      onChange(undefined); // Clear gradient
    } else {
      const gradient = generateGradient(startColor, endColor, angle);
      onChange(gradient);
    }
  };

  const handleColorChange = (type: 'start' | 'end', color: string) => {
    if (type === 'start') {
      setStartColor(color);
      if (mode === 'gradient') {
        onChange(generateGradient(color, endColor, angle));
      }
    } else {
      setEndColor(color);
      if (mode === 'gradient') {
        onChange(generateGradient(startColor, color, angle));
      }
    }
  };

  const handleAngleChange = (newAngle: number) => {
    setAngle(newAngle);
    if (mode === 'gradient') {
      onChange(generateGradient(startColor, endColor, newAngle));
    }
  };

  const applyPreset = (preset: typeof GRADIENT_PRESETS[0]) => {
    onChange(preset.value);
    setMode('gradient');

    // Parse preset colors
    const colorMatches = preset.value.match(/#[0-9a-fA-F]{6}/g);
    if (colorMatches && colorMatches.length >= 2) {
      setStartColor(colorMatches[0]);
      setEndColor(colorMatches[1]);
    }

    const angleMatch = preset.value.match(/(\d+)deg/);
    if (angleMatch) setAngle(parseInt(angleMatch[1]));
  };

  const currentGradient = mode === 'gradient'
    ? generateGradient(startColor, endColor, angle)
    : solidColor || '#000000';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-400">{label}</label>
        {description && (
          <span className="text-xs text-gray-500">{description}</span>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => handleModeChange('solid')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
            mode === 'solid'
              ? 'bg-white text-black'
              : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
          }`}
        >
          Solid Color
        </button>
        <button
          onClick={() => handleModeChange('gradient')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
            mode === 'gradient'
              ? 'bg-white text-black'
              : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
          }`}
        >
          Gradient
        </button>
      </div>

      {/* Preview */}
      <div
        className="h-16 rounded-lg border-2 border-gray-700 shadow-inner"
        style={{ background: currentGradient }}
      />

      {mode === 'solid' ? (
        /* Solid Color Picker */
        <div className="flex gap-2">
          <input
            type="color"
            value={solidColor || '#000000'}
            onChange={(e) => onSolidColorChange?.(e.target.value)}
            className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-700"
          />
          <input
            type="text"
            value={solidColor || '#000000'}
            onChange={(e) => onSolidColorChange?.(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white font-mono text-sm"
            placeholder="#000000"
          />
        </div>
      ) : (
        /* Gradient Controls */
        <div className="space-y-4">
          {/* Color Stops */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-2">Start Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={startColor}
                  onChange={(e) => handleColorChange('start', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-700"
                />
                <input
                  type="text"
                  value={startColor}
                  onChange={(e) => handleColorChange('start', e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">End Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={endColor}
                  onChange={(e) => handleColorChange('end', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-700"
                />
                <input
                  type="text"
                  value={endColor}
                  onChange={(e) => handleColorChange('end', e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Angle Control */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Direction</label>
              <span className="text-xs text-white font-mono">{angle}°</span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="360"
                value={angle}
                onChange={(e) => handleAngleChange(parseInt(e.target.value))}
                className="w-full accent-white"
              />
              {/* Visual direction indicator */}
              <div className="mt-2 flex items-center justify-center">
                <div
                  className="w-8 h-8 rounded-full border-2 border-gray-600 relative"
                >
                  <div
                    className="absolute top-1/2 left-1/2 w-3 h-0.5 bg-white origin-left transition-transform"
                    style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preset Gradients */}
          <div>
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center justify-between w-full text-xs text-gray-400 hover:text-white transition-colors mb-2"
            >
              <span>Quick Presets</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
            </button>

            {showPresets && (
              <div className="grid grid-cols-4 gap-2">
                {GRADIENT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="group relative h-12 rounded-lg border-2 border-gray-700 hover:border-white transition-all overflow-hidden"
                    style={{ background: preset.value }}
                    title={preset.name}
                  >
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] text-white font-medium">{preset.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
