'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Check, Sparkles } from 'lucide-react';
import { GradientBuilder } from './GradientBuilder';

interface ChatbotConfig {
  bubbleColor: string;
  bubbleGradient?: string;
  headerColor: string;
  headerGradient?: string;
  headerTextColor: string;
  chatBackgroundColor: string;
  chatBackgroundGradient?: string;
  userMessageColor: string;
  userMessageGradient?: string;
  userMessageTextColor: string;
  botMessageColor: string;
  botMessageGradient?: string;
  botMessageTextColor: string;
}

interface InteractiveColorEditorProps {
  config: ChatbotConfig;
  onChange: (config: ChatbotConfig) => void;
}

type EditableArea =
  | 'bubble'
  | 'header-bg'
  | 'header-text'
  | 'chat-bg'
  | 'user-msg'
  | 'user-text'
  | 'bot-msg'
  | 'bot-text';

interface ColorPopupPosition {
  x: number;
  y: number;
}

export function InteractiveColorEditor({ config, onChange }: InteractiveColorEditorProps) {
  const [selectedArea, setSelectedArea] = useState<EditableArea | null>(null);
  const [popupPosition, setPopupPosition] = useState<ColorPopupPosition>({ x: 0, y: 0 });
  const [hoveredArea, setHoveredArea] = useState<EditableArea | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAreaClick = (area: EditableArea, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setPopupPosition({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.bottom - containerRect.top + 10,
      });
    }

    setSelectedArea(area);
  };

  const handleColorChange = (area: EditableArea, color: string, isGradient: boolean = false) => {
    const updates: Partial<ChatbotConfig> = {};

    switch (area) {
      case 'bubble':
        if (isGradient) {
          updates.bubbleGradient = color;
        } else {
          updates.bubbleColor = color;
          updates.bubbleGradient = undefined;
        }
        break;
      case 'header-bg':
        if (isGradient) {
          updates.headerGradient = color;
        } else {
          updates.headerColor = color;
          updates.headerGradient = undefined;
        }
        break;
      case 'header-text':
        updates.headerTextColor = color;
        break;
      case 'chat-bg':
        if (isGradient) {
          updates.chatBackgroundGradient = color;
        } else {
          updates.chatBackgroundColor = color;
          updates.chatBackgroundGradient = undefined;
        }
        break;
      case 'user-msg':
        if (isGradient) {
          updates.userMessageGradient = color;
        } else {
          updates.userMessageColor = color;
          updates.userMessageGradient = undefined;
        }
        break;
      case 'user-text':
        updates.userMessageTextColor = color;
        break;
      case 'bot-msg':
        if (isGradient) {
          updates.botMessageGradient = color;
        } else {
          updates.botMessageColor = color;
          updates.botMessageGradient = undefined;
        }
        break;
      case 'bot-text':
        updates.botMessageTextColor = color;
        break;
    }

    onChange({ ...config, ...updates });
  };

  const getBackground = (color: string, gradient?: string) => {
    return gradient || color;
  };

  const getAreaLabel = (area: EditableArea): string => {
    const labels: Record<EditableArea, string> = {
      'bubble': 'Chat Bubble',
      'header-bg': 'Header Background',
      'header-text': 'Header Text',
      'chat-bg': 'Chat Background',
      'user-msg': 'Your Messages',
      'user-text': 'Your Message Text',
      'bot-msg': 'Bot Messages',
      'bot-text': 'Bot Message Text',
    };
    return labels[area];
  };

  const supportsGradient = (area: EditableArea): boolean => {
    return !['header-text', 'user-text', 'bot-text'].includes(area);
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectedArea && !(e.target as HTMLElement).closest('.color-popup')) {
        setSelectedArea(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedArea]);

  return (
    <div ref={containerRef} className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 relative">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-medium text-white">Click to Edit Colors</h3>
        </div>
        <p className="text-sm text-gray-400">
          Click on any part of the preview to change its color
        </p>
      </div>

      {/* Preview */}
      <div className="flex justify-center">
        <div className="relative" style={{ width: '320px', height: '480px' }}>
          {/* Chat Bubble */}
          <button
            className={`absolute bottom-4 right-4 w-16 h-16 rounded-full shadow-xl cursor-pointer transition-all group ${
              hoveredArea === 'bubble' ? 'ring-4 ring-white/50 scale-110' : 'hover:scale-105'
            } ${selectedArea === 'bubble' ? 'ring-4 ring-white' : ''}`}
            style={{ background: getBackground(config.bubbleColor, config.bubbleGradient) }}
            onClick={(e) => handleAreaClick('bubble', e)}
            onMouseEnter={() => setHoveredArea('bubble')}
            onMouseLeave={() => setHoveredArea(null)}
          >
            <div className="w-full h-full flex items-center justify-center text-3xl">
              💬
            </div>
            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 px-3 py-1.5 rounded-lg text-xs text-white whitespace-nowrap transition-opacity ${
              hoveredArea === 'bubble' || selectedArea === 'bubble' ? 'opacity-100' : 'opacity-0'
            }`}>
              Click to edit
            </div>
          </button>

          {/* Chat Window */}
          <div className="absolute bottom-28 right-4 w-72 h-[420px] rounded-2xl overflow-hidden border-2 border-gray-700 shadow-2xl bg-black">
            {/* Header */}
            <button
              className={`w-full h-16 px-5 flex items-center cursor-pointer transition-all group relative ${
                hoveredArea === 'header-bg' || selectedArea === 'header-bg' ? 'ring-2 ring-white ring-inset' : ''
              }`}
              style={{ background: getBackground(config.headerColor, config.headerGradient) }}
              onClick={(e) => handleAreaClick('header-bg', e)}
              onMouseEnter={() => setHoveredArea('header-bg')}
              onMouseLeave={() => setHoveredArea(null)}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" style={{ color: config.headerTextColor }} />
                </div>
                <button
                  className={`text-base font-semibold transition-all ${
                    hoveredArea === 'header-text' || selectedArea === 'header-text'
                      ? 'underline decoration-2 underline-offset-4'
                      : ''
                  }`}
                  style={{ color: config.headerTextColor }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAreaClick('header-text', e);
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredArea('header-text');
                  }}
                  onMouseLeave={() => setHoveredArea(null)}
                >
                  Chatbot
                </button>
              </div>
            </button>

            {/* Chat Background */}
            <button
              className={`w-full flex-1 p-4 space-y-3 cursor-pointer transition-all h-80 overflow-hidden ${
                hoveredArea === 'chat-bg' || selectedArea === 'chat-bg' ? 'ring-2 ring-white ring-inset' : ''
              }`}
              style={{ background: getBackground(config.chatBackgroundColor, config.chatBackgroundGradient) }}
              onClick={(e) => handleAreaClick('chat-bg', e)}
              onMouseEnter={() => setHoveredArea('chat-bg')}
              onMouseLeave={() => setHoveredArea(null)}
            >
              {/* Bot Message */}
              <div className="flex gap-2 items-start pointer-events-none">
                <div className="w-7 h-7 rounded-full bg-gray-600/50 flex-shrink-0" />
                <button
                  className={`px-4 py-2.5 rounded-xl text-sm max-w-[75%] pointer-events-auto transition-all ${
                    hoveredArea === 'bot-msg' || selectedArea === 'bot-msg' ? 'ring-2 ring-white scale-105' : 'hover:scale-[1.02]'
                  }`}
                  style={{
                    background: getBackground(config.botMessageColor, config.botMessageGradient),
                    color: config.botMessageTextColor,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAreaClick('bot-msg', e);
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredArea('bot-msg');
                  }}
                  onMouseLeave={() => setHoveredArea(null)}
                >
                  Hi! How can I help you today?
                </button>
              </div>

              {/* User Message */}
              <div className="flex gap-2 justify-end items-start pointer-events-none">
                <button
                  className={`px-4 py-2.5 rounded-xl text-sm max-w-[75%] pointer-events-auto transition-all ${
                    hoveredArea === 'user-msg' || selectedArea === 'user-msg' ? 'ring-2 ring-white scale-105' : 'hover:scale-[1.02]'
                  }`}
                  style={{
                    background: getBackground(config.userMessageColor, config.userMessageGradient),
                    color: config.userMessageTextColor,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAreaClick('user-msg', e);
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredArea('user-msg');
                  }}
                  onMouseLeave={() => setHoveredArea(null)}
                >
                  I need help with my order
                </button>
                <div className="w-7 h-7 rounded-full bg-gray-600/50 flex-shrink-0" />
              </div>

              {/* Another bot message */}
              <div className="flex gap-2 items-start pointer-events-none">
                <div className="w-7 h-7 rounded-full bg-gray-600/50 flex-shrink-0" />
                <div
                  className="px-4 py-2.5 rounded-xl text-sm max-w-[75%]"
                  style={{
                    background: getBackground(config.botMessageColor, config.botMessageGradient),
                    color: config.botMessageTextColor,
                  }}
                >
                  I'd be happy to help! What's your order number?
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Color Popup Editor */}
      {selectedArea && (
        <div
          className="color-popup absolute z-50 bg-gray-900 border-2 border-white rounded-xl shadow-2xl p-5 w-80"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Popup Header */}
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-white">{getAreaLabel(selectedArea)}</h4>
            <button
              onClick={() => setSelectedArea(null)}
              className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Color Controls */}
          {supportsGradient(selectedArea) ? (
            <GradientBuilder
              label=""
              value={
                selectedArea === 'bubble' ? (config.bubbleGradient || '') :
                selectedArea === 'header-bg' ? (config.headerGradient || '') :
                selectedArea === 'chat-bg' ? (config.chatBackgroundGradient || '') :
                selectedArea === 'user-msg' ? (config.userMessageGradient || '') :
                selectedArea === 'bot-msg' ? (config.botMessageGradient || '') :
                ''
              }
              solidColor={
                selectedArea === 'bubble' ? config.bubbleColor :
                selectedArea === 'header-bg' ? config.headerColor :
                selectedArea === 'chat-bg' ? config.chatBackgroundColor :
                selectedArea === 'user-msg' ? config.userMessageColor :
                selectedArea === 'bot-msg' ? config.botMessageColor :
                '#000000'
              }
              onChange={(gradient) => handleColorChange(selectedArea, gradient || '', !!gradient)}
              onSolidColorChange={(color) => handleColorChange(selectedArea, color, false)}
            />
          ) : (
            /* Simple Color Picker for Text */
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={
                    selectedArea === 'header-text' ? config.headerTextColor :
                    selectedArea === 'user-text' ? config.userMessageTextColor :
                    config.botMessageTextColor
                  }
                  onChange={(e) => handleColorChange(selectedArea, e.target.value)}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-700"
                />
                <input
                  type="text"
                  value={
                    selectedArea === 'header-text' ? config.headerTextColor :
                    selectedArea === 'user-text' ? config.userMessageTextColor :
                    config.botMessageTextColor
                  }
                  onChange={(e) => handleColorChange(selectedArea, e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white font-mono text-sm"
                />
              </div>
            </div>
          )}

          {/* Done Button */}
          <button
            onClick={() => setSelectedArea(null)}
            className="w-full mt-4 px-4 py-2.5 bg-white text-black hover:bg-gray-100 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Done
          </button>
        </div>
      )}
    </div>
  );
}
