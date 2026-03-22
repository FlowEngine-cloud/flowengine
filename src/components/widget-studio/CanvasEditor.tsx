'use client';

import React, { useState } from 'react';
import {
  MessageCircle, Palette, Type, Layout, Sparkles,
  Copy, Download, Eye, Maximize2, Plus, ChevronDown,
  Layers, Settings, Wand2, Image as ImageIcon
} from 'lucide-react';
import { GradientBuilder } from './GradientBuilder';
import { EnhancedColorInput } from './EnhancedColorInput';

interface ChatbotConfig {
  bubbleColor: string;
  bubbleGradient?: string;
  bubbleIcon: string;
  bubbleSize: string;
  headerColor: string;
  headerGradient?: string;
  headerTextColor: string;
  chatbotName: string;
  chatBackgroundColor: string;
  chatBackgroundGradient?: string;
  userMessageColor: string;
  userMessageGradient?: string;
  userMessageTextColor: string;
  botMessageColor: string;
  botMessageGradient?: string;
  botMessageTextColor: string;
  welcomeMessage: string;
  placeholder: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  borderRadius: string;
  fontSize: string;
  fontFamily: string;
}

interface CanvasEditorProps {
  config: ChatbotConfig;
  onChange: (config: ChatbotConfig) => void;
}

type SelectedElement =
  | 'bubble'
  | 'header'
  | 'chat-bg'
  | 'user-msg'
  | 'bot-msg'
  | 'input'
  | null;

const QUICK_THEMES = [
  {
    name: 'Modern Dark',
    preview: '#1a1a1a',
    config: {
      bubbleColor: '#ffffff',
      headerColor: '#1a1a1a',
      headerTextColor: '#ffffff',
      chatBackgroundColor: '#0a0a0a',
      userMessageColor: '#ffffff',
      userMessageTextColor: '#000000',
      botMessageColor: '#2a2a2a',
      botMessageTextColor: '#ffffff',
    }
  },
  {
    name: 'Purple Gradient',
    preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    config: {
      bubbleGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      headerTextColor: '#ffffff',
      chatBackgroundColor: '#0f0f1a',
      userMessageGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      userMessageTextColor: '#ffffff',
      botMessageColor: '#1a1a2e',
      botMessageTextColor: '#ffffff',
    }
  },
  {
    name: 'Ocean Blue',
    preview: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    config: {
      bubbleGradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      headerGradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      headerTextColor: '#ffffff',
      chatBackgroundColor: '#0a1929',
      userMessageGradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      userMessageTextColor: '#ffffff',
      botMessageColor: '#1a2332',
      botMessageTextColor: '#4facfe',
    }
  },
  {
    name: 'Minimalist',
    preview: '#000000',
    config: {
      bubbleColor: '#000000',
      headerColor: '#ffffff',
      headerTextColor: '#000000',
      chatBackgroundColor: '#ffffff',
      userMessageColor: '#000000',
      userMessageTextColor: '#ffffff',
      botMessageColor: '#f5f5f5',
      botMessageTextColor: '#000000',
    }
  },
];

export function CanvasEditor({ config, onChange }: CanvasEditorProps) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement>('bubble');
  const [activeTab, setActiveTab] = useState<'design' | 'content' | 'settings'>('design');

  const handleElementClick = (element: SelectedElement) => {
    setSelectedElement(element);
  };

  const updateConfig = (updates: Partial<ChatbotConfig>) => {
    onChange({ ...config, ...updates });
  };

  const applyTheme = (theme: typeof QUICK_THEMES[0]) => {
    onChange({ ...config, ...theme.config });
  };

  const getBackground = (color: string, gradient?: string) => {
    return gradient || color;
  };

  return (
    <div className="flex h-full bg-black">
      {/* Left Sidebar - Quick Actions */}
      <div className="w-20 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-6 gap-4">
        <button
          onClick={() => setActiveTab('design')}
          className={`p-3 rounded-lg transition-colors ${
            activeTab === 'design'
              ? 'bg-white text-black'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Design"
        >
          <Palette className="w-5 h-5" />
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`p-3 rounded-lg transition-colors ${
            activeTab === 'content'
              ? 'bg-white text-black'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Content"
        >
          <Type className="w-5 h-5" />
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`p-3 rounded-lg transition-colors ${
            activeTab === 'settings'
              ? 'bg-white text-black'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        {/* Quick Actions */}
        <button
          className="p-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Preview"
        >
          <Eye className="w-5 h-5" />
        </button>
        <button
          className="p-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Export"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* Center - Canvas Preview */}
      <div className="flex-1 flex flex-col bg-gray-950">
        {/* Top Toolbar */}
        <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-medium">Chatbot Editor</h2>
            <div className="h-6 w-px bg-gray-700" />
            <span className="text-sm text-gray-400">
              {selectedElement ? selectedElement.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Select an element'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
              <button className="px-2 py-1 text-xs text-gray-400 hover:text-white">50%</button>
              <button className="px-2 py-1 text-xs text-white bg-gray-700 rounded">100%</button>
              <button className="px-2 py-1 text-xs text-gray-400 hover:text-white">150%</button>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-12 overflow-auto">
          <div className="relative" style={{ width: '380px', height: '580px' }}>
            {/* Selection Indicator */}
            {selectedElement && (
              <div className="absolute -top-12 left-0 bg-white text-black px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Editing: {selectedElement.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
            )}

            {/* Chat Bubble */}
            <button
              className={`absolute bottom-6 right-6 w-20 h-20 rounded-full shadow-2xl cursor-pointer transition-all group ${
                selectedElement === 'bubble'
                  ? 'ring-4 ring-white ring-offset-4 ring-offset-gray-950 scale-110'
                  : 'hover:scale-105 hover:ring-2 hover:ring-white/50'
              }`}
              style={{ background: getBackground(config.bubbleColor, config.bubbleGradient) }}
              onClick={() => handleElementClick('bubble')}
            >
              <div className="w-full h-full flex items-center justify-center text-4xl">
                {config.bubbleIcon || '💬'}
              </div>

              {/* Edit hint */}
              <div className={`absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 px-3 py-1.5 rounded-lg text-xs text-white whitespace-nowrap transition-opacity ${
                selectedElement === 'bubble' ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
              }`}>
                Click to edit
              </div>
            </button>

            {/* Chat Window */}
            <div className="absolute bottom-32 right-6 w-80 h-[500px] rounded-2xl overflow-hidden shadow-2xl bg-black">
              {/* Header */}
              <button
                className={`w-full h-20 px-6 flex items-center cursor-pointer transition-all group relative ${
                  selectedElement === 'header'
                    ? 'ring-4 ring-white ring-inset'
                    : 'hover:ring-2 hover:ring-white/50 hover:ring-inset'
                }`}
                style={{ background: getBackground(config.headerColor, config.headerGradient) }}
                onClick={() => handleElementClick('header')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <MessageCircle className="w-6 h-6" style={{ color: config.headerTextColor }} />
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-semibold" style={{ color: config.headerTextColor }}>
                      {config.chatbotName || 'Chatbot'}
                    </div>
                    <div className="text-xs opacity-75" style={{ color: config.headerTextColor }}>
                      Online
                    </div>
                  </div>
                </div>
              </button>

              {/* Chat Background */}
              <button
                className={`w-full flex-1 p-5 cursor-pointer transition-all relative overflow-hidden ${
                  selectedElement === 'chat-bg'
                    ? 'ring-4 ring-white ring-inset'
                    : 'hover:ring-2 hover:ring-white/50 hover:ring-inset'
                }`}
                style={{
                  background: getBackground(config.chatBackgroundColor, config.chatBackgroundGradient),
                  height: '340px'
                }}
                onClick={() => handleElementClick('chat-bg')}
              >
                <div className="space-y-4 pointer-events-none">
                  {/* Bot Message */}
                  <div className="flex gap-2 items-start">
                    <div className="w-8 h-8 rounded-full bg-gray-600/50 flex-shrink-0" />
                    <button
                      className={`px-4 py-3 rounded-2xl text-sm max-w-[75%] pointer-events-auto transition-all ${
                        selectedElement === 'bot-msg'
                          ? 'ring-4 ring-white scale-105'
                          : 'hover:ring-2 hover:ring-white/50 hover:scale-[1.02]'
                      }`}
                      style={{
                        background: getBackground(config.botMessageColor, config.botMessageGradient),
                        color: config.botMessageTextColor,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleElementClick('bot-msg');
                      }}
                    >
                      {config.welcomeMessage || 'Hi! How can I help you today?'}
                    </button>
                  </div>

                  {/* User Message */}
                  <div className="flex gap-2 justify-end items-start">
                    <button
                      className={`px-4 py-3 rounded-2xl text-sm max-w-[75%] pointer-events-auto transition-all ${
                        selectedElement === 'user-msg'
                          ? 'ring-4 ring-white scale-105'
                          : 'hover:ring-2 hover:ring-white/50 hover:scale-[1.02]'
                      }`}
                      style={{
                        background: getBackground(config.userMessageColor, config.userMessageGradient),
                        color: config.userMessageTextColor,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleElementClick('user-msg');
                      }}
                    >
                      I need help with something
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gray-600/50 flex-shrink-0" />
                  </div>

                  {/* Another bot message */}
                  <div className="flex gap-2 items-start">
                    <div className="w-8 h-8 rounded-full bg-gray-600/50 flex-shrink-0" />
                    <div
                      className="px-4 py-3 rounded-2xl text-sm max-w-[75%]"
                      style={{
                        background: getBackground(config.botMessageColor, config.botMessageGradient),
                        color: config.botMessageTextColor,
                      }}
                    >
                      I'd be happy to help! What can I assist you with?
                    </div>
                  </div>
                </div>
              </button>

              {/* Input Area */}
              <button
                className={`w-full h-20 px-5 flex items-center border-t border-gray-700/50 cursor-pointer transition-all ${
                  selectedElement === 'input'
                    ? 'ring-4 ring-white ring-inset'
                    : 'hover:ring-2 hover:ring-white/50 hover:ring-inset'
                }`}
                style={{ background: getBackground(config.chatBackgroundColor, config.chatBackgroundGradient) }}
                onClick={() => handleElementClick('input')}
              >
                <div className="flex-1 px-4 py-3 bg-black/20 rounded-xl text-sm text-gray-400">
                  {config.placeholder || 'Type a message...'}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Properties */}
      <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
        {/* Panel Header */}
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-white font-semibold text-lg mb-1">
            {selectedElement ? selectedElement.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Quick Start'}
          </h3>
          <p className="text-sm text-gray-400">
            {selectedElement ? 'Customize appearance and behavior' : 'Choose a theme to get started'}
          </p>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedElement && (
            /* Quick Start - Themes */
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-medium text-white">Quick Themes</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {QUICK_THEMES.map((theme) => (
                    <button
                      key={theme.name}
                      onClick={() => applyTheme(theme)}
                      className="group relative overflow-hidden rounded-xl transition-all hover:scale-105 hover:shadow-xl"
                    >
                      <div
                        className="aspect-square rounded-xl"
                        style={{ background: theme.preview }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                        <span className="text-xs font-medium text-white">{theme.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-800 pt-6">
                <p className="text-sm text-gray-400 text-center">
                  👆 Click on any element in the preview to customize it
                </p>
              </div>
            </div>
          )}

          {selectedElement === 'bubble' && (
            <div className="space-y-6">
              <GradientBuilder
                label="Background"
                value={config.bubbleGradient || ''}
                solidColor={config.bubbleColor}
                onChange={(gradient) => updateConfig({ bubbleGradient: gradient })}
                onSolidColorChange={(color) => updateConfig({ bubbleColor: color, bubbleGradient: undefined })}
              />

              <div>
                <label className="block text-sm text-gray-400 mb-3">Icon</label>
                <div className="grid grid-cols-5 gap-2">
                  {['💬', '🤖', '👋', '💭', '✨', '🎯', '⚡', '🚀', '💡', '🎨'].map((icon) => (
                    <button
                      key={icon}
                      onClick={() => updateConfig({ bubbleIcon: icon })}
                      className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-all ${
                        config.bubbleIcon === icon
                          ? 'bg-white scale-110'
                          : 'bg-gray-800 hover:bg-gray-700 hover:scale-105'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-3">Size: {config.bubbleSize || '64'}px</label>
                <input
                  type="range"
                  min="48"
                  max="96"
                  step="8"
                  value={config.bubbleSize || '64'}
                  onChange={(e) => updateConfig({ bubbleSize: e.target.value })}
                  className="w-full accent-white"
                />
              </div>
            </div>
          )}

          {selectedElement === 'header' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-3">Chatbot Name</label>
                <input
                  type="text"
                  value={config.chatbotName || ''}
                  onChange={(e) => updateConfig({ chatbotName: e.target.value })}
                  placeholder="AI Assistant"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                />
              </div>

              <GradientBuilder
                label="Background"
                value={config.headerGradient || ''}
                solidColor={config.headerColor}
                onChange={(gradient) => updateConfig({ headerGradient: gradient })}
                onSolidColorChange={(color) => updateConfig({ headerColor: color, headerGradient: undefined })}
              />

              <EnhancedColorInput
                label="Text Color"
                value={config.headerTextColor}
                onChange={(color) => updateConfig({ headerTextColor: color })}
                description="Color of the chatbot name and status"
              />
            </div>
          )}

          {selectedElement === 'chat-bg' && (
            <div className="space-y-6">
              <GradientBuilder
                label="Background"
                value={config.chatBackgroundGradient || ''}
                solidColor={config.chatBackgroundColor}
                onChange={(gradient) => updateConfig({ chatBackgroundGradient: gradient })}
                onSolidColorChange={(color) => updateConfig({ chatBackgroundColor: color, chatBackgroundGradient: undefined })}
              />
            </div>
          )}

          {selectedElement === 'user-msg' && (
            <div className="space-y-6">
              <GradientBuilder
                label="Background"
                value={config.userMessageGradient || ''}
                solidColor={config.userMessageColor}
                onChange={(gradient) => updateConfig({ userMessageGradient: gradient })}
                onSolidColorChange={(color) => updateConfig({ userMessageColor: color, userMessageGradient: undefined })}
              />

              <EnhancedColorInput
                label="Text Color"
                value={config.userMessageTextColor}
                onChange={(color) => updateConfig({ userMessageTextColor: color })}
                description="Color of text in your messages"
              />
            </div>
          )}

          {selectedElement === 'bot-msg' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-3">Welcome Message</label>
                <textarea
                  value={config.welcomeMessage || ''}
                  onChange={(e) => updateConfig({ welcomeMessage: e.target.value })}
                  placeholder="Hi! How can I help you today?"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white resize-none"
                />
              </div>

              <GradientBuilder
                label="Background"
                value={config.botMessageGradient || ''}
                solidColor={config.botMessageColor}
                onChange={(gradient) => updateConfig({ botMessageGradient: gradient })}
                onSolidColorChange={(color) => updateConfig({ botMessageColor: color, botMessageGradient: undefined })}
              />

              <EnhancedColorInput
                label="Text Color"
                value={config.botMessageTextColor}
                onChange={(color) => updateConfig({ botMessageTextColor: color })}
                description="Color of text in bot messages"
              />
            </div>
          )}

          {selectedElement === 'input' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-3">Placeholder Text</label>
                <input
                  type="text"
                  value={config.placeholder || ''}
                  onChange={(e) => updateConfig({ placeholder: e.target.value })}
                  placeholder="Type a message..."
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
