'use client';

import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';

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

interface VisualColorMapProps {
  config: ChatbotConfig;
  onAreaClick?: (area: keyof ChatbotConfig) => void;
}

interface ColorArea {
  id: keyof ChatbotConfig;
  label: string;
  description: string;
}

const COLOR_AREAS: ColorArea[] = [
  { id: 'bubbleColor', label: 'Chat Bubble', description: 'The button users click to open chat' },
  { id: 'headerColor', label: 'Header Background', description: 'Top section of the chat window' },
  { id: 'headerTextColor', label: 'Header Text', description: 'Chatbot name and header text' },
  { id: 'chatBackgroundColor', label: 'Chat Background', description: 'Main chat area background' },
  { id: 'userMessageColor', label: 'Your Messages', description: 'Background of user messages' },
  { id: 'userMessageTextColor', label: 'Your Text', description: 'Color of user message text' },
  { id: 'botMessageColor', label: 'Bot Messages', description: 'Background of bot messages' },
  { id: 'botMessageTextColor', label: 'Bot Text', description: 'Color of bot message text' },
];

export function VisualColorMap({ config, onAreaClick }: VisualColorMapProps) {
  const [hoveredArea, setHoveredArea] = useState<keyof ChatbotConfig | null>(null);
  const [selectedArea, setSelectedArea] = useState<keyof ChatbotConfig | null>(null);

  const handleAreaClick = (area: keyof ChatbotConfig) => {
    setSelectedArea(area);
    onAreaClick?.(area);
  };

  const getBackground = (color: string, gradient?: string) => {
    return gradient || color;
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Visual Color Guide</h3>
        <span className="text-xs text-gray-500">Click on any area to edit</span>
      </div>

      <div className="flex gap-8">
        {/* Visual Preview */}
        <div className="flex-1">
          <div className="relative mx-auto" style={{ width: '280px', height: '420px' }}>
            {/* Chat Bubble */}
            <div
              className={`absolute bottom-4 right-4 w-14 h-14 rounded-full shadow-lg cursor-pointer transition-all ${
                hoveredArea === 'bubbleColor' || selectedArea === 'bubbleColor'
                  ? 'ring-2 ring-white scale-110'
                  : ''
              }`}
              style={{ background: getBackground(config.bubbleColor, config.bubbleGradient) }}
              onClick={() => handleAreaClick('bubbleColor')}
              onMouseEnter={() => setHoveredArea('bubbleColor')}
              onMouseLeave={() => setHoveredArea(null)}
            >
              <div className="w-full h-full flex items-center justify-center text-2xl">
                💬
              </div>

              {/* Label */}
              {(hoveredArea === 'bubbleColor' || selectedArea === 'bubbleColor') && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap shadow-lg border border-gray-700">
                  Chat Bubble
                </div>
              )}
            </div>

            {/* Chat Window */}
            <div className="absolute bottom-24 right-4 w-64 h-80 rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl">
              {/* Header */}
              <div
                className={`h-14 px-4 flex items-center cursor-pointer transition-all ${
                  hoveredArea === 'headerColor' || selectedArea === 'headerColor'
                    ? 'ring-2 ring-white ring-inset'
                    : ''
                }`}
                style={{ background: getBackground(config.headerColor, config.headerGradient) }}
                onClick={() => handleAreaClick('headerColor')}
                onMouseEnter={() => setHoveredArea('headerColor')}
                onMouseLeave={() => setHoveredArea(null)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4" style={{ color: config.headerTextColor }} />
                  </div>
                  <span
                    className={`text-sm font-medium cursor-pointer ${
                      hoveredArea === 'headerTextColor' || selectedArea === 'headerTextColor'
                        ? 'underline decoration-2'
                        : ''
                    }`}
                    style={{ color: config.headerTextColor }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAreaClick('headerTextColor');
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setHoveredArea('headerTextColor');
                    }}
                    onMouseLeave={() => setHoveredArea(null)}
                  >
                    Chatbot
                  </span>
                </div>
              </div>

              {/* Chat Background */}
              <div
                className={`flex-1 p-3 space-y-3 h-full cursor-pointer transition-all ${
                  hoveredArea === 'chatBackgroundColor' || selectedArea === 'chatBackgroundColor'
                    ? 'ring-2 ring-white ring-inset'
                    : ''
                }`}
                style={{ background: getBackground(config.chatBackgroundColor, config.chatBackgroundGradient) }}
                onClick={() => handleAreaClick('chatBackgroundColor')}
                onMouseEnter={() => setHoveredArea('chatBackgroundColor')}
                onMouseLeave={() => setHoveredArea(null)}
              >
                {/* Bot Message */}
                <div className="flex gap-2 items-start">
                  <div className="w-6 h-6 rounded-full bg-gray-600/50 flex-shrink-0" />
                  <div
                    className={`px-3 py-2 rounded-lg text-xs max-w-[75%] cursor-pointer transition-all ${
                      hoveredArea === 'botMessageColor' || selectedArea === 'botMessageColor'
                        ? 'ring-2 ring-white'
                        : ''
                    }`}
                    style={{
                      background: getBackground(config.botMessageColor, config.botMessageGradient),
                      color: config.botMessageTextColor,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAreaClick('botMessageColor');
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setHoveredArea('botMessageColor');
                    }}
                    onMouseLeave={() => setHoveredArea(null)}
                  >
                    Hi! How can I help you?
                  </div>
                </div>

                {/* User Message */}
                <div className="flex gap-2 justify-end items-start">
                  <div
                    className={`px-3 py-2 rounded-lg text-xs max-w-[75%] cursor-pointer transition-all ${
                      hoveredArea === 'userMessageColor' || selectedArea === 'userMessageColor'
                        ? 'ring-2 ring-white'
                        : ''
                    }`}
                    style={{
                      background: getBackground(config.userMessageColor, config.userMessageGradient),
                      color: config.userMessageTextColor,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAreaClick('userMessageColor');
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      setHoveredArea('userMessageColor');
                    }}
                    onMouseLeave={() => setHoveredArea(null)}
                  >
                    I need help with my order
                  </div>
                  <div className="w-6 h-6 rounded-full bg-gray-600/50 flex-shrink-0" />
                </div>

                {/* Another bot message */}
                <div className="flex gap-2 items-start">
                  <div className="w-6 h-6 rounded-full bg-gray-600/50 flex-shrink-0" />
                  <div
                    className="px-3 py-2 rounded-lg text-xs max-w-[75%]"
                    style={{
                      background: getBackground(config.botMessageColor, config.botMessageGradient),
                      color: config.botMessageTextColor,
                    }}
                  >
                    I'd be happy to help! Can you provide your order number?
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Color Legend */}
        <div className="flex-1 space-y-2">
          <p className="text-xs text-gray-500 mb-3">Click to edit colors:</p>
          {COLOR_AREAS.map((area) => (
            <button
              key={area.id}
              onClick={() => handleAreaClick(area.id)}
              onMouseEnter={() => setHoveredArea(area.id)}
              onMouseLeave={() => setHoveredArea(null)}
              className={`w-full text-left p-2.5 rounded-lg transition-all ${
                selectedArea === area.id
                  ? 'bg-white/10 border border-white/30'
                  : hoveredArea === area.id
                  ? 'bg-gray-800/50 border border-gray-700'
                  : 'bg-gray-800/30 border border-gray-700/50 hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-4 h-4 rounded border border-gray-600"
                  style={{ background: config[area.id] as string }}
                />
                <span className="text-xs font-medium text-white">{area.label}</span>
              </div>
              <p className="text-[10px] text-gray-500 ml-6">{area.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
