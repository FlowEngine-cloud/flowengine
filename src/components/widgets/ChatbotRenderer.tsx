'use client';

import React, { useId, useMemo, useRef } from 'react';
import { MessageCircle, Send, X, Paperclip, File } from 'lucide-react';
import { DEFAULT_CHATBOT_CONFIG, ChatbotConfig } from '@/components/widget-studio/types';
import { AvatarIcon, animationStyles, getTypingDotStyle } from '@/components/widgets/chatbot';
import { sanitizeCSS } from '@/lib/validation';

// =============================================================================
// Types
// =============================================================================

export interface ChatFileAttachment {
  name: string;
  type: string;
  size: number;
  data?: string; // base64 data URL
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot' | 'error';
  content: string;
  files?: ChatFileAttachment[];
}

export interface ChatbotRendererProps {
  // Config from database - will be merged with defaults
  config: Partial<ChatbotConfig>;
  // Widget name fallback for header
  widgetName?: string;
  // Messages to display (for interactive mode)
  messages?: ChatMessage[];
  // Input state (for interactive mode)
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSend?: () => void;
  isSending?: boolean;
  // File upload state (for interactive mode)
  selectedFiles?: File[];
  onFileSelect?: (files: File[]) => void;
  onRemoveFile?: (index: number) => void;
  // Sizing
  width?: string;
  height?: string;
  // Preview mode - uses static sample messages
  previewMode?: boolean;
  // Ref for scrolling
  messagesEndRef?: React.RefObject<HTMLDivElement>;
  // Close button (for popup mode)
  onClose?: () => void;
  showCloseButton?: boolean;
  // Clear chat
  onClearChat?: () => void;
  // Watermark
  showWatermark?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Merge config with defaults - single source of truth
 */
export function mergeWithDefaults(config: Partial<ChatbotConfig>): ChatbotConfig {
  return {
    ...DEFAULT_CHATBOT_CONFIG,
    ...config,
  } as ChatbotConfig;
}

/**
 * Get background - supports gradients. Since we merge with defaults first,
 * color should always have a value, but gradient takes priority if set.
 */
function getBackground(color: string, gradient?: string): string {
  return gradient || color;
}

/**
 * Get background pattern styles for the messages area
 */
function getBackgroundPattern(pattern: string | undefined, baseColor: string): React.CSSProperties {
  if (!pattern || pattern === 'none') return {};
  const patternColor = 'rgba(255,255,255,0.05)';

  switch (pattern) {
    case 'dots':
      return {
        backgroundImage: `radial-gradient(${patternColor} 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      };
    case 'grid':
      return {
        backgroundImage: `
          linear-gradient(${patternColor} 1px, transparent 1px),
          linear-gradient(90deg, ${patternColor} 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      };
    case 'waves':
      return {
        backgroundImage: `
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            ${patternColor} 10px,
            ${patternColor} 11px
          )
        `,
      };
    default:
      return {};
  }
}

// Avatar renderer that supports icons, emojis, and URLs
const MessageAvatar = ({
  icon,
  customIcon,
  type,
  backgroundColor,
}: {
  icon?: string;
  customIcon?: string;
  type: 'bot' | 'user';
  backgroundColor: string;
}) => {
  // If custom icon is provided (emoji or URL), use that
  const iconToUse = customIcon || icon;

  return (
    <AvatarIcon
      icon={iconToUse}
      type={type}
      backgroundColor={backgroundColor}
      iconColor="#ffffff"
      sizeClass="w-7 h-7"
      iconSizeClass="w-4 h-4"
    />
  );
};

// =============================================================================
// Static Preview Messages (for preview mode)
// =============================================================================

const PREVIEW_MESSAGES: ChatMessage[] = [
  { id: '1', role: 'bot', content: '' }, // Will use welcomeMessage
  { id: '2', role: 'user', content: 'I need help with my order' },
  { id: '3', role: 'bot', content: "I'd be happy to help! What's your order number?" },
];

// =============================================================================
// ChatbotRenderer Component
// =============================================================================

export function ChatbotRenderer({
  config: inputConfig,
  widgetName,
  messages: externalMessages,
  inputValue = '',
  onInputChange,
  onSend,
  isSending = false,
  selectedFiles = [],
  onFileSelect,
  onRemoveFile,
  width = '320px',
  height = '500px',
  previewMode = false,
  messagesEndRef,
  onClose,
  showCloseButton = false,
  onClearChat,
  showWatermark = false,
}: ChatbotRendererProps) {
  // Merge with defaults - this is the key to consistency
  const c = mergeWithDefaults(inputConfig);
  const widgetId = useId().replace(/:/g, '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFileSelect) {
      // Validate against allowed mime types if specified
      const allowedTypes = c.allowedFileMimeTypes?.split(',').map(t => t.trim()).filter(Boolean) || [];
      const validFiles: File[] = [];

      for (const file of Array.from(files)) {
        if (allowedTypes.length === 0 || allowedTypes.some(type => {
          if (type.startsWith('.')) {
            // Extension check (e.g., ".pdf")
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          } else if (type.endsWith('/*')) {
            // Wildcard mime type (e.g., "image/*")
            return file.type.startsWith(type.replace('/*', '/'));
          } else {
            // Exact mime type
            return file.type === type;
          }
        })) {
          validFiles.push(file);
        }
      }

      onFileSelect([...selectedFiles, ...validFiles]);
    }
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Use preview messages or external messages
  const messages = previewMode
    ? PREVIEW_MESSAGES.map(m => m.id === '1' ? { ...m, content: c.welcomeMessage } : m)
    : externalMessages || [];

  // Generate scoped CSS from custom CSS (replace .widget-container with unique selector)
  // SECURITY: Sanitize CSS client-side as defense-in-depth (already sanitized server-side)
  const scopedCSS = useMemo(() => {
    if (!c.customCSS) return '';
    const sanitized = sanitizeCSS(c.customCSS);
    return sanitized.replace(/\.widget-container/g, `#widget-${widgetId}`);
  }, [c.customCSS, widgetId]);

  return (
    <>
      {/* Inject animation styles */}
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      {/* Inject custom CSS if present */}
      {scopedCSS && (
        <style dangerouslySetInnerHTML={{ __html: scopedCSS }} />
      )}
      <div
        id={`widget-${widgetId}`}
        className={`widget-container flex flex-col overflow-hidden shadow-2xl ${c.glassEffect ? 'backdrop-blur-md' : ''}`}
        style={{
          width,
          height,
          maxHeight: '80vh',
          borderRadius: `${c.borderRadius}px`,
          fontFamily: c.fontFamily,
          background: getBackground(c.chatBackgroundColor, c.chatBackgroundGradient),
          border: c.borderStyle !== 'none'
            ? `${c.borderWidth}px ${c.borderStyle} rgba(255,255,255,0.2)`
            : 'none',
          boxShadow: c.boxShadow,
        }}
      >
        {/* Header */}
        <div
          className="widget-header h-16 px-5 flex items-center gap-3 flex-shrink-0"
          style={{
            background: getBackground(c.headerColor, c.headerGradient),
            color: c.headerTextColor,
            borderTopLeftRadius: `${c.borderRadius}px`,
            borderTopRightRadius: `${c.borderRadius}px`,
          }}
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5" style={{ color: c.headerTextColor }} />
          </div>
          <span className="flex-1 text-base font-semibold" style={{ color: c.headerTextColor }}>
            {c.chatbotName || widgetName || 'Chatbot'}
          </span>
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" style={{ color: c.headerTextColor }} />
            </button>
          )}
        </div>

        {/* Messages Area */}
        <div
          className="messages-area flex-1 overflow-y-auto p-4 space-y-3"
          style={{
            background: getBackground(c.chatBackgroundColor, c.chatBackgroundGradient),
            ...getBackgroundPattern(c.chatBackgroundPattern as string | undefined, c.chatBackgroundColor),
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.role === 'user' ? 'message-user justify-end' : 'message-bot justify-start'} flex items-start gap-2`}
            >
              {(msg.role === 'bot' || msg.role === 'error') && (
                <MessageAvatar
                  icon={msg.role === 'error' ? 'alert-circle' : (c.botAvatarIcon || 'bot')}
                  customIcon={msg.role === 'error' ? undefined : c.botAvatarCustom}
                  type="bot"
                  backgroundColor={msg.role === 'error' ? '#dc2626' : (c.botAvatarColor || '#374151')}
                />
              )}
              <div
                className={`message-bubble ${msg.role === 'user' ? 'message-bubble-user' : 'message-bubble-bot'} max-w-[75%] rounded-xl`}
                style={{
                  background: msg.role === 'user'
                    ? getBackground(c.userMessageColor, c.userMessageGradient)
                    : msg.role === 'error'
                    ? 'rgba(220, 38, 38, 0.15)'
                    : getBackground(c.botMessageColor, c.botMessageGradient),
                  color: msg.role === 'user' ? c.userMessageTextColor : msg.role === 'error' ? '#fca5a5' : c.botMessageTextColor,
                  fontSize: `${c.fontSize}px`,
                  fontWeight: c.fontWeight,
                  lineHeight: c.lineHeight,
                  padding: `${c.messagePadding}px`,
                  border: msg.role === 'error' ? '1px solid rgba(220, 38, 38, 0.3)' : 'none',
                  boxShadow: msg.role === 'user'
                    ? (c.userMessageGlow ? `0 0 20px ${c.userMessageGlowColor || c.userMessageColor}40` : 'none')
                    : msg.role === 'error'
                    ? 'none'
                    : (c.botMessageGlow ? `0 0 20px ${c.botMessageGlowColor || c.botMessageColor}40` : 'none'),
                }}
              >
                {/* File attachments */}
                {msg.files && msg.files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                        style={{
                          background: 'rgba(0,0,0,0.2)',
                        }}
                      >
                        <File className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate max-w-[100px]">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <MessageAvatar
                  icon={c.userAvatarIcon || 'user'}
                  customIcon={c.userAvatarCustom}
                  type="user"
                  backgroundColor={c.userAvatarColor || '#667eea'}
                />
              )}
            </div>
          ))}

          {/* Typing indicator - three dots animation (not in bubble) */}
          {isSending && c.typingIndicator !== 'none' && (
            <div className="typing-indicator flex justify-start items-center gap-1 px-2 py-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: c.botMessageTextColor || '#ffffff',
                    opacity: 0.6,
                    ...getTypingDotStyle(c.typingIndicator || 'dots', i),
                  }}
                />
              ))}
            </div>
          )}

          {messagesEndRef && <div ref={messagesEndRef} />}
        </div>

        {/* Clear chat - sticky at bottom of chat area */}
        {onClearChat && messages.length > 1 && (
          <div
            className="text-center py-1 flex-shrink-0"
            style={{ background: c.chatBackgroundColor }}
          >
            <button
              onClick={onClearChat}
              className="text-[11px] opacity-40 hover:opacity-70 transition-opacity"
              style={{ color: c.botMessageTextColor }}
            >
              clear chat
            </button>
          </div>
        )}

        {/* File Preview (when files selected) */}
        {!previewMode && selectedFiles.length > 0 && (
          <div
            className="file-preview px-4 py-2 flex flex-wrap gap-2 flex-shrink-0"
            style={{
              background: c.inputBackgroundColor,
              borderTop: '1px solid rgba(128,128,128,0.2)',
            }}
          >
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                style={{
                  background: 'rgba(128,128,128,0.2)',
                  color: c.inputTextColor,
                }}
              >
                <File className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[80px]">{file.name}</span>
                <span className="opacity-50">({formatFileSize(file.size)})</span>
                {onRemoveFile && (
                  <button
                    onClick={() => onRemoveFile(index)}
                    className="ml-1 hover:opacity-100 opacity-60"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div
          className="input-area h-14 px-4 flex items-center gap-2 flex-shrink-0"
          style={{
            background: c.inputBackgroundColor,
            borderTop: selectedFiles.length > 0 ? 'none' : '1px solid rgba(128,128,128,0.2)',
          }}
        >
          {/* Hidden file input */}
          {c.allowFileUploads && !previewMode && (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={c.allowedFileMimeTypes || undefined}
              onChange={handleFileChange}
              className="hidden"
            />
          )}

          {/* File upload button */}
          {c.allowFileUploads && !previewMode && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 hover:bg-white/10"
              style={{ color: c.inputPlaceholderColor }}
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}

          {previewMode ? (
            // Static preview - styled to look like real input
            <div
              className="input-field flex-1 px-4 py-2 rounded-full"
              style={{
                fontSize: `${c.fontSize}px`,
                background: 'rgba(128,128,128,0.15)',
                border: '1px solid rgba(128,128,128,0.2)',
              }}
            >
              <span style={{ color: c.inputPlaceholderColor }}>
                {c.placeholder}
              </span>
            </div>
          ) : (
            // Interactive mode - actual input
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange?.(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !isSending && onSend?.()}
              placeholder={c.placeholder}
              className="input-field flex-1 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-opacity-30"
              style={{
                fontSize: `${c.fontSize}px`,
                color: c.inputTextColor,
                background: 'rgba(128,128,128,0.15)',
                border: '1px solid rgba(128,128,128,0.2)',
              }}
            />
          )}
          <button
            onClick={onSend}
            disabled={previewMode || (!inputValue?.trim() && selectedFiles.length === 0) || isSending}
            className="send-button w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
            style={{
              background: c.sendButtonColor,
              color: c.inputBackgroundColor,
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Watermark */}
        {showWatermark ? (
          <div
            className="watermark px-4 py-2 text-center flex-shrink-0"
            style={{ background: c.inputBackgroundColor }}
          >
            <a
              href={process.env.NEXT_PUBLIC_APP_URL || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline"
              style={{ color: c.inputPlaceholderColor || 'rgba(255,255,255,0.5)' }}
            >
              Powered by FlowEngine
            </a>
          </div>
        ) : (
          <a
            href={process.env.NEXT_PUBLIC_APP_URL || '#'}
            target="_blank"
            rel="noopener noreferrer"
            aria-hidden="true"
            tabIndex={-1}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
          >
            FlowEngine
          </a>
        )}
      </div>
    </>
  );
}

export default ChatbotRenderer;
