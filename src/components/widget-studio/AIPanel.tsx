'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Trash2, Loader2, Square } from 'lucide-react';

// Allowed keys for widget updates from AI
const ALLOWED_UPDATE_KEYS = ['chatbotConfig', 'styles', 'fields', 'widgetType'] as const;

type SelectedElement =
  | null
  // Chatbot elements
  | 'bubble'
  | 'header-bg'
  | 'header-text'
  | 'chat-bg'
  | 'user-msg'
  | 'user-text'
  | 'user-avatar'
  | 'bot-msg'
  | 'bot-text'
  | 'bot-avatar'
  | 'input'
  | 'send-button'
  // Form elements
  | 'form-bg'
  | 'form-title'
  | 'form-input'
  | 'form-button'
  // button component
  | 'button-widget';

const ELEMENT_LABELS: Record<string, string> = {
  // Chatbot elements
  'bubble': 'Chat Bubble Button',
  'header-bg': 'Header Background',
  'header-text': 'Header Text',
  'chat-bg': 'Chat Window Background',
  'user-msg': 'User Message Bubble',
  'user-text': 'User Message Text',
  'user-avatar': 'User Avatar',
  'bot-msg': 'Bot Message Bubble',
  'bot-text': 'Bot Message Text',
  'bot-avatar': 'Bot Avatar',
  'input': 'Input Field',
  'send-button': 'Send Button',
  // Form elements
  'form-bg': 'Form Background',
  'form-title': 'Form Title',
  'form-input': 'Form Input Fields',
  'form-button': 'Form Submit Button',
  // button component
  'button-widget': 'Button Component',
};

interface AIPanelProps {
  widgetType: 'chatbot' | 'form' | 'button';
  widgetName: string;
  selectedElement?: SelectedElement;
  widgetContext?: {
    fields?: Array<any>;
    chatbotConfig?: Record<string, any>;
    buttonConfig?: Record<string, any>;
    styles?: Record<string, any>;
  };
  onWidgetUpdate?: (updates: any) => void;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

const QUICK_PROMPTS = [
  'Suggest a color scheme',
  'Make it modern',
  'Create a warm design',
  'Design for dark mode',
];

export function AIPanel({ widgetType, widgetName, selectedElement, widgetContext, onWidgetUpdate }: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      content: `Hi! I can help you design your ${widgetType}. What would you like to create today?`,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Abort any previous request
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Prepare conversation history (limit to prevent token overflow)
      const conversationHistory = messages
        .filter(m => m.role !== 'ai' || !m.content.includes('Hi! I can help')) // Skip initial greeting
        .slice(-10) // Keep last 10 messages to prevent context overflow
        .map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content.slice(0, 2000), // Limit message length
        }));

      // Build enhanced prompt with selected element context
      const elementContext = selectedElement
        ? `\n[Currently editing: ${ELEMENT_LABELS[selectedElement] || selectedElement}]`
        : '';
      const enhancedPrompt = elementContext ? `${elementContext}\n\n${inputValue}` : inputValue;

      // Call AI API with streaming
      const response = await fetch('/api/widget-studio/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt.slice(0, 2000), // Limit prompt length
          widgetContext: {
            type: widgetType,
            selectedElement,
            selectedElementLabel: selectedElement ? ELEMENT_LABELS[selectedElement] : null,
            ...widgetContext,
          },
          conversationHistory,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to get AI response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = ''; // Full raw content for parsing updates
      const aiMessageId = (Date.now() + 1).toString();

      // Helper to clean content for display (remove WIDGET_UPDATE blocks in real-time)
      const cleanForDisplay = (content: string): string => {
        // Remove complete WIDGET_UPDATE blocks
        let cleaned = content.replace(/<WIDGET_UPDATE>[\s\S]*?<\/WIDGET_UPDATE>/g, '');
        // Also remove incomplete opening tags during streaming
        // Check if we're in the middle of a component_UPDATE block
        const openTagIndex = cleaned.lastIndexOf('<WIDGET_UPDATE>');
        if (openTagIndex !== -1) {
          // We have an open tag without a close, remove everything from it
          cleaned = cleaned.substring(0, openTagIndex);
        }
        // Also catch partial tag starts like "<WIDGET_", "<WIDGET_U", etc.
        cleaned = cleaned.replace(/<WIDGET_UPDATE[\s\S]*$/g, '');
        cleaned = cleaned.replace(/<WIDGET_[\s\S]*$/g, '');
        cleaned = cleaned.replace(/<WIDGET[\s\S]*$/g, '');
        return cleaned.trim();
      };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  // Show cleaned content (without WIDGET_UPDATE blocks) during streaming
                  const displayContent = cleanForDisplay(fullContent);
                  setMessages((prev) => {
                    const existing = prev.find(m => m.id === aiMessageId);
                    if (existing) {
                      return prev.map(m =>
                        m.id === aiMessageId ? { ...m, content: displayContent || 'Applying changes...' } : m
                      );
                    } else {
                      return [...prev, { id: aiMessageId, role: 'ai', content: displayContent || 'Applying changes...' }];
                    }
                  });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        // Check for widget updates in the full response
        const updateMatch = fullContent.match(/<WIDGET_UPDATE>([\s\S]*?)<\/WIDGET_UPDATE>/);
        let updateApplied = false;
        let updateError = '';

        if (updateMatch && onWidgetUpdate) {
          try {
            // Clean up the JSON - remove markdown code fences if present
            let jsonStr = updateMatch[1].trim();

            // Remove ```json and ``` if AI wrapped the JSON in markdown
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
            jsonStr = jsonStr.trim();

            const updates = JSON.parse(jsonStr);

            // Just apply the updates - we trust the parsed JSON structure
            // Only allow known update keys
            const safeUpdates: Record<string, unknown> = {};
            for (const key of ALLOWED_UPDATE_KEYS) {
              if (key in updates) {
                safeUpdates[key] = updates[key];
              }
            }

            if (Object.keys(safeUpdates).length > 0) {
              onWidgetUpdate(safeUpdates);
              updateApplied = true;
            } else {
              updateError = `No valid keys found. Got: ${Object.keys(updates).join(', ')}`;
            }
          } catch (e) {
            updateError = `Parse error: ${e instanceof Error ? e.message : 'unknown'}`;
            console.error('[AI Assistant] Failed to parse component update:', e);
          }
        }

        // Final cleanup - ensure display shows clean content with status
        const finalDisplayContent = cleanForDisplay(fullContent);
        let statusSuffix = '';
        if (updateMatch) {
          if (updateApplied) {
            statusSuffix = '\n\n✅ Changes applied!';
          } else if (updateError) {
            statusSuffix = `\n\n⚠️ ${updateError}`;
          }
        }
        setMessages((prev) =>
          prev.map(m =>
            m.id === aiMessageId
              ? { ...m, content: (finalDisplayContent || 'Done!') + statusSuffix }
              : m
          )
        );
      }
    } catch (error) {
      // Don't show error for aborted requests
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('AI Assistant error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
  };

  const handleStop = () => {
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
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
    <div className="w-full h-full flex flex-col">
      {/* Header - aligned with toolbar h-16 */}
      <div className="h-16 px-4 border-b border-gray-800 flex items-center">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-white" />
          <h3 className="text-sm font-medium text-white">AI Assistant</h3>
          {selectedElement && (
            <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-white/10 border border-white/20 rounded-md">
              <Bot className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-white truncate max-w-[100px]">
                {ELEMENT_LABELS[selectedElement] || selectedElement}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'ai' ? 'bg-white text-black' : 'bg-gray-700 text-white'
              }`}
            >
              {message.role === 'ai' ? <Bot className="w-3.5 h-3.5" /> : '👤'}
            </div>
            <div
              className={`px-3 py-2 rounded-xl max-w-[75%] ${
                message.role === 'ai'
                  ? 'bg-gray-800/30 text-white'
                  : 'bg-white text-black'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white text-black">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="px-3 py-2 rounded-xl bg-gray-800/30 text-white">
              <p className="text-xs leading-relaxed text-gray-400">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 border-t border-gray-800">
        <p className="text-xs text-gray-500 mb-2">Quick Actions:</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handleQuickPrompt(prompt)}
              className="px-2.5 py-1.5 bg-gray-800/30 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder={selectedElement ? `Describe changes for ${ELEMENT_LABELS[selectedElement]}...` : "Ask AI for suggestions..."}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white transition-colors disabled:opacity-50"
          />
          {isLoading ? (
            <button
              onClick={handleStop}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              title="Stop generating"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="px-3 py-2 bg-white text-black rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={clearConversation}
          className="w-full px-3 py-1.5 border border-gray-700 hover:bg-gray-800/30 text-gray-400 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3 h-3" />
          Clear Conversation
        </button>
      </div>
    </div>
  );
}
