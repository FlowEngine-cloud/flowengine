'use client';

import React, { useState } from 'react';
import { Bot, Send, Trash2, Sparkles } from 'lucide-react';

interface AIAssistantPanelProps {
  widgetType: 'chatbot' | 'form' | 'button';
  widgetName: string;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

const QUICK_PROMPTS = [
  'Suggest a color scheme for a professional chatbot',
  'Make it modern and minimalist',
  'Create a warm and friendly design',
  'Design for dark mode',
];

export function AIAssistantPanel({ widgetType, widgetName }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      content: `Hi! I can help you design your ${widgetType}. What would you like to create today?`,
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    setMessages([...messages, userMessage]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: "I'd be happy to help with that! This is a placeholder response. The AI assistant feature will be connected to the actual AI service soon.",
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
  };

  const clearConversation = () => {
    setMessages([
      {
        id: '1',
        role: 'ai',
        content: `Hi! I can help you design your ${widgetType}. What would you like to create today?`,
      },
    ]);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-5 h-5 text-white" />
          <h3 className="text-lg font-medium text-white">AI Assistant</h3>
        </div>
        <p className="text-sm text-gray-400">Get AI-powered design suggestions</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'ai' ? 'bg-white text-black' : 'bg-gray-700 text-white'
              }`}
            >
              {message.role === 'ai' ? <Sparkles className="w-4 h-4" /> : '👤'}
            </div>
            <div
              className={`px-4 py-2.5 rounded-xl max-w-[75%] ${
                message.role === 'ai'
                  ? 'bg-gray-800/50 text-white'
                  : 'bg-white text-black'
              }`}
            >
              <p className="text-sm">{message.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Prompts */}
      <div className="px-6 py-3 border-t border-gray-800">
        <p className="text-xs text-gray-500 mb-2">Quick Actions:</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handleQuickPrompt(prompt)}
              className="px-3 py-1.5 bg-gray-800/30 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-gray-800">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI for design suggestions..."
            className="flex-1 px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="px-4 py-3 bg-white text-black rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={clearConversation}
          className="w-full px-4 py-2 border border-gray-700 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear Conversation
        </button>
      </div>
    </div>
  );
}
