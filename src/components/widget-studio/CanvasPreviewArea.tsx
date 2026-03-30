'use client';

import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import { MessageCircle, Sparkles, FileText, Bot, HelpCircle, Headphones, MessageSquare, MessagesSquare, X } from 'lucide-react';
import { SelectedElement } from './UnifiedCanvasEditor';
import { sanitizeCSS } from '@/lib/validation';
import { FieldRenderer, getFieldWidthStyle, FormStyles } from '@/components/shared/FormFieldRenderer';
import { ChatbotRenderer, mergeWithDefaults } from '@/components/widgets/ChatbotRenderer';
import { ChatbotConfig as FullChatbotConfig } from '@/components/widget-studio/types';

// Animation keyframes as CSS
const animationStyles = `
@keyframes bubble-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes bubble-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
@keyframes bubble-shake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  25% { transform: translateX(-5px) rotate(-5deg); }
  75% { transform: translateX(5px) rotate(5deg); }
}
@keyframes bubble-glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 10px var(--glow-color)); }
  50% { filter: drop-shadow(0 0 25px var(--glow-color)); }
}
@keyframes greeting-slide-in {
  0% { opacity: 0; transform: translateY(10px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes greeting-slide-out {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(10px) scale(0.95); }
}
@keyframes window-slide-up {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes window-fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes window-scale-in {
  0% { opacity: 0; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes float-particle {
  0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
  50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
}
`;

// Background pattern generator
const getBackgroundPattern = (pattern: string, baseColor: string): React.CSSProperties => {
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
    case 'particles':
      return {
        position: 'relative' as const,
      };
    default:
      return {};
  }
};

// Get bubble animation style (continuous/looping)
const getBubbleAnimationStyle = (animation: string, glowColor: string) => {
  switch (animation) {
    case 'bounce':
      return { animation: 'bubble-bounce 1s ease-in-out infinite' };
    case 'pulse':
      return { animation: 'bubble-pulse 2s ease-in-out infinite' };
    case 'shake':
      return { animation: 'bubble-shake 0.5s ease-in-out infinite' };
    case 'glow':
      return {
        animation: 'bubble-glow-pulse 2s ease-in-out infinite',
        '--glow-color': glowColor || '#667eea',
      } as React.CSSProperties;
    default:
      return {};
  }
};

// Get window open animation style (one-time)
const getWindowAnimationStyle = (animation: string) => {
  switch (animation) {
    case 'slideUp':
      return { animation: 'window-slide-up 0.3s ease-out forwards' };
    case 'fadeIn':
      return { animation: 'window-fade-in 0.3s ease-out forwards' };
    case 'scaleIn':
      return { animation: 'window-scale-in 0.3s ease-out forwards' };
    default:
      return {};
  }
};

// Icon map for bubble icons
const BUBBLE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  'messages-square': MessagesSquare,
  'bot': Bot,
  'headphones': Headphones,
  'help-circle': HelpCircle,
};

// Render bubble icon (Lucide icon or emoji)
const BubbleIcon = ({ icon, className }: { icon: string; className?: string }) => {
  const IconComponent = BUBBLE_ICON_MAP[icon];
  if (IconComponent) {
    return <IconComponent className={className} />;
  }
  // Fallback to emoji or default icon
  if (icon && icon.length <= 2) {
    return <span className="text-3xl">{icon}</span>;
  }
  return <MessageCircle className={className} />;
};

// ChatbotConfig matches the interface from page.tsx
type ChatbotConfig = Record<string, any>;

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'file' | 'checkbox' | 'radio' | 'phone' | 'url';
  required: boolean;
  options?: string[];
  placeholder?: string;
  width?: '25' | '33' | '50' | '100';
  alignment?: 'left' | 'center' | 'right';
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  customBorderRadius?: string;
  customPadding?: string;
  customFontSize?: string;
  customHeight?: string;
}

interface CanvasPreviewAreaProps {
  widgetType: 'chatbot' | 'form' | 'button';
  chatbotConfig: ChatbotConfig;
  formFields: FormField[];
  styles: Record<string, any>;
  selectedElement: SelectedElement;
  zoomLevel: number;
  viewMode: 'desktop' | 'mobile';
  onElementSelect: (element: SelectedElement) => void;
  onChatbotConfigChange?: (config: ChatbotConfig) => void;
  onStylesChange?: (styles: Record<string, any>) => void;
}

export function CanvasPreviewArea({
  widgetType,
  chatbotConfig,
  formFields,
  styles,
  selectedElement,
  zoomLevel,
  viewMode,
  onElementSelect,
  onChatbotConfigChange,
  onStylesChange,
}: CanvasPreviewAreaProps) {
  const [hoveredElement, setHoveredElement] = useState<SelectedElement>(null);
  const [chatOpen, setChatOpen] = useState(true); // Chat window starts open for clearer preview
  const [showGreetingBubble, setShowGreetingBubble] = useState(false);
  const [greetingHiding, setGreetingHiding] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const widgetId = useId().replace(/:/g, '');

  // Resize state for widget elements - use local state during drag to avoid re-renders
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [localDimensions, setLocalDimensions] = useState<{ width: number; height: number } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Get current widget dimensions from config or defaults
  const getWidgetDimensions = () => {
    // During resize, use local dimensions for smooth visual feedback
    if (localDimensions) return localDimensions;

    if (widgetType === 'chatbot') {
      return {
        width: chatbotConfig.widgetWidth || (viewMode === 'mobile' ? 300 : 320),
        height: chatbotConfig.widgetHeight || 500,
      };
    } else if (widgetType === 'form') {
      return {
        width: styles.formWidth || 384,
        height: styles.formHeight || 500,
      };
    }
    return { width: 200, height: 500 };
  };

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    const dims = getWidgetDimensions();
    const startDims = {
      width: typeof dims.width === 'number' ? dims.width : 320,
      height: typeof dims.height === 'number' ? dims.height : 500,
    };
    setIsResizing(true);
    setResizeDirection(direction);
    setLocalDimensions(startDims);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: startDims.width,
      startHeight: startDims.height,
    };
  };

  // Store latest values in refs to avoid stale closures in event handlers
  const onChatbotConfigChangeRef = useRef(onChatbotConfigChange);
  const onStylesChangeRef = useRef(onStylesChange);
  const chatbotConfigRef = useRef(chatbotConfig);
  const stylesRef = useRef(styles);

  // Keep refs updated when props change
  onChatbotConfigChangeRef.current = onChatbotConfigChange;
  onStylesChangeRef.current = onStylesChange;
  chatbotConfigRef.current = chatbotConfig;
  stylesRef.current = styles;

  // Handle resize mouse move and mouse up
  useEffect(() => {
    if (!isResizing || !resizeRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current || !resizeDirection) return;

      const scale = zoomLevel / 100;
      const deltaX = (e.clientX - resizeRef.current.startX) / scale;
      const deltaY = (e.clientY - resizeRef.current.startY) / scale;

      let newWidth = resizeRef.current.startWidth;
      let newHeight = resizeRef.current.startHeight;

      // Calculate new dimensions based on direction
      if (resizeDirection.includes('e')) {
        newWidth = Math.max(200, Math.min(600, resizeRef.current.startWidth + deltaX));
      }
      if (resizeDirection.includes('w')) {
        newWidth = Math.max(200, Math.min(600, resizeRef.current.startWidth - deltaX));
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(300, Math.min(800, resizeRef.current.startHeight + deltaY));
      }
      if (resizeDirection.includes('n')) {
        newHeight = Math.max(300, Math.min(800, resizeRef.current.startHeight - deltaY));
      }

      // Update local state only during drag (no config updates = no re-renders)
      setLocalDimensions({
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      });
    };

    const handleMouseUp = () => {
      // Commit final dimensions to config only on mouseup
      if (localDimensions) {
        if (widgetType === 'chatbot' && onChatbotConfigChangeRef.current) {
          onChatbotConfigChangeRef.current({
            ...chatbotConfigRef.current,
            widgetWidth: localDimensions.width,
            widgetHeight: localDimensions.height,
          });
        } else if (widgetType === 'form' && onStylesChangeRef.current) {
          onStylesChangeRef.current({
            ...stylesRef.current,
            formWidth: localDimensions.width,
            formHeight: localDimensions.height,
          });
        }
      }
      setIsResizing(false);
      setResizeDirection(null);
      setLocalDimensions(null);
      resizeRef.current = null;
    };

    // Set appropriate cursor based on resize direction
    const getCursor = () => {
      if (resizeDirection === 'nw' || resizeDirection === 'se') return 'nwse-resize';
      if (resizeDirection === 'ne' || resizeDirection === 'sw') return 'nesw-resize';
      if (resizeDirection === 'n' || resizeDirection === 's') return 'ns-resize';
      if (resizeDirection === 'e' || resizeDirection === 'w') return 'ew-resize';
      return 'nwse-resize';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = getCursor();
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resizeDirection, zoomLevel, widgetType, localDimensions]);

  // Resize handles component
  const ResizeHandles = ({ show }: { show: boolean }) => {
    if (!show) return null;

    const handleClass = "absolute bg-white border-2 border-gray-900 rounded-sm z-20 transition-opacity";
    const edgeClass = "absolute bg-transparent z-10 transition-opacity";
    const dims = getWidgetDimensions();

    return (
      <>
        {/* Dimension indicator - shows during resize */}
        {isResizing && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 px-2 py-1 rounded text-xs text-white font-mono whitespace-nowrap z-30">
            {typeof dims.width === 'number' ? dims.width : 0} × {typeof dims.height === 'number' ? dims.height : 'auto'}
          </div>
        )}

        {/* Corner handles */}
        <div
          className={`${handleClass} w-3 h-3 -top-1.5 -left-1.5 cursor-nwse-resize ${isResizing ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
          onMouseDown={(e) => handleResizeStart(e, 'nw')}
        />
        <div
          className={`${handleClass} w-3 h-3 -top-1.5 -right-1.5 cursor-nesw-resize ${isResizing ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
          onMouseDown={(e) => handleResizeStart(e, 'ne')}
        />
        <div
          className={`${handleClass} w-3 h-3 -bottom-1.5 -left-1.5 cursor-nesw-resize ${isResizing ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
          onMouseDown={(e) => handleResizeStart(e, 'sw')}
        />
        <div
          className={`${handleClass} w-3 h-3 -bottom-1.5 -right-1.5 cursor-nwse-resize ${isResizing ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
          onMouseDown={(e) => handleResizeStart(e, 'se')}
        />

        {/* Edge handles */}
        <div
          className={`${edgeClass} top-0 left-3 right-3 h-2 -translate-y-1 cursor-ns-resize`}
          onMouseDown={(e) => handleResizeStart(e, 'n')}
        />
        <div
          className={`${edgeClass} bottom-0 left-3 right-3 h-2 translate-y-1 cursor-ns-resize`}
          onMouseDown={(e) => handleResizeStart(e, 's')}
        />
        <div
          className={`${edgeClass} left-0 top-3 bottom-3 w-2 -translate-x-1 cursor-ew-resize`}
          onMouseDown={(e) => handleResizeStart(e, 'w')}
        />
        <div
          className={`${edgeClass} right-0 top-3 bottom-3 w-2 translate-x-1 cursor-ew-resize`}
          onMouseDown={(e) => handleResizeStart(e, 'e')}
        />
      </>
    );
  };

  // Generate scoped CSS from custom CSS (replace .widget-container with unique selector)
  // SECURITY: Sanitize CSS client-side as defense-in-depth (already sanitized server-side)
  const scopedCSS = useMemo(() => {
    if (!chatbotConfig.customCSS) return '';
    const sanitized = sanitizeCSS(chatbotConfig.customCSS);
    return sanitized.replace(/\.widget-container/g, `#widget-${widgetId}`);
  }, [chatbotConfig.customCSS, widgetId]);

  const formScopedCSS = useMemo(() => {
    if (!styles?.customCSS) return '';
    const sanitized = sanitizeCSS(styles.customCSS);
    return sanitized.replace(/\.widget-container/g, `#widget-${widgetId}`);
  }, [styles?.customCSS, widgetId]);

  // Handle bubble click with delay to distinguish from double-click
  const handleBubbleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clear any existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    // Delay single click action to allow double-click detection
    clickTimeoutRef.current = setTimeout(() => {
      setChatOpen(!chatOpen);
    }, 200);
  };

  // Handle bubble double-click for editing
  const handleBubbleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Cancel the pending single click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    onElementSelect('bubble');
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // Handle greeting message timing
  useEffect(() => {
    if (chatbotConfig.showGreeting && !chatOpen) {
      const delay = (chatbotConfig.greetingDelay || 2) * 1000;
      const timer = setTimeout(() => {
        setShowGreetingBubble(true);
        setGreetingHiding(false);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setShowGreetingBubble(false);
    }
  }, [chatbotConfig.showGreeting, chatbotConfig.greetingDelay, chatOpen]);

  // Auto-hide greeting after 10s if enabled
  useEffect(() => {
    if (showGreetingBubble && chatbotConfig.greetingAutoHide && !greetingHiding) {
      const timer = setTimeout(() => {
        setGreetingHiding(true);
        setTimeout(() => setShowGreetingBubble(false), 300);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showGreetingBubble, chatbotConfig.greetingAutoHide, greetingHiding]);

  const getBackground = (color: string, gradient?: string) => {
    return gradient || color;
  };

  const getElementLabel = (element: SelectedElement): string => {
    const labels: Record<string, string> = {
      // Chatbot elements
      'bubble': 'Chat Bubble',
      'header-bg': 'Header Background',
      'header-text': 'Header Text',
      'chat-bg': 'Chat Background',
      'user-msg': 'Your Messages',
      'user-text': 'Your Message Text',
      'user-avatar': 'User Avatar',
      'bot-msg': 'Bot Messages',
      'bot-text': 'Bot Message Text',
      'bot-avatar': 'Bot Avatar',
      'input': 'Input Area',
      'send-button': 'Send Button',
      // Form elements
      'form-bg': 'Form Background',
      'form-title': 'Form Title',
      'form-input': 'Form Inputs',
      'form-button': 'Submit Button',
      // button component
      'button-widget': 'Button',
    };
    return element ? labels[element] || '' : '';
  };

  const scale = zoomLevel / 100;
  const isEmbedded = chatbotConfig.displayMode === 'embedded';
  const position = chatbotConfig.position || 'bottom-right';

  // Position classes for bubble and chat window
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return { bubble: 'bottom-4 left-4', window: 'bottom-28 left-4', greeting: 'bottom-24 left-4' };
      case 'top-right':
        return { bubble: 'top-4 right-4', window: 'top-28 right-4', greeting: 'top-24 right-4' };
      case 'top-left':
        return { bubble: 'top-4 left-4', window: 'top-28 left-4', greeting: 'top-24 left-4' };
      default: // bottom-right
        return { bubble: 'bottom-4 right-4', window: 'bottom-28 right-4', greeting: 'bottom-24 right-4' };
    }
  };
  const positionClasses = getPositionClasses();

  // Responsive dimensions based on view mode
  const dimensions = viewMode === 'mobile'
    ? { container: '375px', chatWidth: '340px', chatHeight: '600px' }
    : { container: '400px', chatWidth: '400px', chatHeight: '600px' };

  // Get bubble animation style (continuous)
  const bubbleAnimStyle = getBubbleAnimationStyle(
    chatbotConfig.bubbleAnimation || 'none',
    chatbotConfig.bubbleGlowColor || '#667eea'
  );

  // Get window open animation style (one-time)
  const windowAnimStyle = chatOpen ? getWindowAnimationStyle(chatbotConfig.windowAnimation || 'slideUp') : {};

  // Handle clicking on the canvas background to clear selection
  const handleCanvasBackgroundClick = (e: React.MouseEvent) => {
    // Only clear selection if clicking directly on the canvas background
    if (e.target === e.currentTarget) {
      onElementSelect(null);
    }
  };

  return (
    <div
      className="flex-1 bg-gray-950 flex flex-col items-center justify-center p-8 overflow-auto"
      onClick={handleCanvasBackgroundClick}
    >
      {/* Inject animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      {/* Inject custom CSS (scoped to this component) */}
      {(scopedCSS || formScopedCSS) && (
        <style dangerouslySetInnerHTML={{ __html: scopedCSS + formScopedCSS }} />
      )}

      {/* Selection Indicator */}
      {selectedElement && (
        <div className="mb-6 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>
            Editing: <strong>{getElementLabel(selectedElement)}</strong>
          </span>
        </div>
      )}

      {/* Preview Container */}
      <div
        className="transition-all duration-200"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Chatbot Preview */}
        {widgetType === 'chatbot' && (() => {
          // Merge with defaults for consistent styling with public widget
          const c = mergeWithDefaults(chatbotConfig as Partial<FullChatbotConfig>);

          return (
          <div id={`widget-${widgetId}`} className={`widget-container relative ${isEmbedded ? 'flex items-center justify-center' : ''}`} style={{ width: dimensions.container, height: dimensions.chatHeight }}>
            {/* Popup Mode: Greeting Message Bubble */}
            {!isEmbedded && showGreetingBubble && !chatOpen && (
              <div
                className={`absolute ${positionClasses.greeting} max-w-[200px] cursor-pointer`}
                style={{
                  animation: greetingHiding
                    ? 'greeting-slide-out 0.3s ease-out forwards'
                    : 'greeting-slide-in 0.3s ease-out forwards',
                }}
                onClick={() => {
                  setShowGreetingBubble(false);
                  setChatOpen(true);
                }}
              >
                <div
                  className="px-4 py-3 rounded-2xl shadow-lg relative"
                  style={{
                    background: c.headerColor,
                    color: c.headerTextColor,
                  }}
                >
                  <p className="text-sm">{c.greetingMessage}</p>
                  {/* Triangle pointer */}
                  <div
                    className="absolute -bottom-2 right-6 w-0 h-0"
                    style={{
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderTop: `8px solid ${c.headerColor}`,
                    }}
                  />
                </div>
                <button
                  className="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGreetingHiding(true);
                    setTimeout(() => setShowGreetingBubble(false), 300);
                  }}
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            )}

            {/* Popup Mode: Chat Bubble - Click to open/close, double-click to edit */}
            {!isEmbedded && (
            <button
              className={`absolute ${positionClasses.bubble} rounded-full cursor-pointer group ${
                hoveredElement === 'bubble' ? 'ring-4 ring-white/50' : ''
              } ${selectedElement === 'bubble' ? 'ring-4 ring-white' : ''}`}
              style={{
                background: getBackground(c.bubbleColor, c.bubbleGradient),
                width: `${c.bubbleSize}px`,
                height: `${c.bubbleSize}px`,
                boxShadow: c.bubbleGlow
                  ? `0 4px 20px rgba(0,0,0,0.3), 0 0 40px ${c.bubbleGlowColor}60`
                  : '0 4px 20px rgba(0,0,0,0.3)',
                ...bubbleAnimStyle,
              }}
              onClick={handleBubbleClick}
              onDoubleClick={handleBubbleDoubleClick}
              onMouseEnter={() => setHoveredElement('bubble')}
              onMouseLeave={() => setHoveredElement(null)}
            >
              <div className="w-full h-full flex items-center justify-center" style={{ color: c.bubbleIconColor || '#ffffff' }}>
                {chatOpen ? (
                  <X className="w-7 h-7" />
                ) : (
                  <BubbleIcon
                    icon={c.bubbleIcon}
                    className="w-7 h-7"
                  />
                )}
              </div>
              <div
                className={`absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 px-3 py-1.5 rounded-lg text-xs text-white whitespace-nowrap transition-opacity ${
                  hoveredElement === 'bubble' || selectedElement === 'bubble' ? 'opacity-100' : 'opacity-0'
                }`}
              >
                Click to {chatOpen ? 'close' : 'open'} | Double-click to edit
              </div>
            </button>
            )}

            {/* Chat Window - Always visible in embedded mode, toggle in popup mode */}
            {(isEmbedded || chatOpen) && (() => {
              const dims = getWidgetDimensions();
              return (
              <div
                className={`${isEmbedded ? 'relative' : `absolute ${positionClasses.window}`} ${selectedElement ? 'ring-2 ring-blue-500/50' : ''}`}
                style={{
                  width: `${dims.width}px`,
                  height: `${dims.height}px`,
                  ...(isEmbedded ? {} : windowAnimStyle),
                }}
              >
                {/* Resize handles - show when any element selected or hovering */}
                <ResizeHandles show={!!selectedElement || !!hoveredElement || isResizing} />

                {/* Use ChatbotRenderer for exact visual parity with public widget */}
                <ChatbotRenderer
                  config={chatbotConfig as Partial<FullChatbotConfig>}
                  previewMode={true}
                  width="100%"
                  height="100%"
                  showCloseButton={false}
                  showWatermark={false}
                />

                {/* Selection overlays - transparent clickable zones for editor element selection */}
                <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: `${c.borderRadius}px` }}>
                  {/* Header selection zone */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-16 pointer-events-auto cursor-pointer transition-all ${
                      hoveredElement === 'header-bg' || selectedElement === 'header-bg'
                        ? 'ring-2 ring-white ring-inset bg-white/10'
                        : 'hover:bg-white/5'
                    }`}
                    style={{ borderTopLeftRadius: `${c.borderRadius}px`, borderTopRightRadius: `${c.borderRadius}px` }}
                    onClick={(e) => { e.stopPropagation(); onElementSelect('header-bg'); }}
                    onMouseEnter={() => setHoveredElement('header-bg')}
                    onMouseLeave={() => setHoveredElement(null)}
                  >
                    {/* Header text clickable zone - positioned over chatbot name */}
                    <div
                      className={`absolute left-[68px] top-1/2 -translate-y-1/2 h-8 right-12 pointer-events-auto cursor-pointer transition-all rounded ${
                        hoveredElement === 'header-text' || selectedElement === 'header-text'
                          ? 'ring-2 ring-white bg-white/20'
                          : 'hover:bg-white/10'
                      }`}
                      onClick={(e) => { e.stopPropagation(); onElementSelect('header-text'); }}
                      onMouseEnter={(e) => { e.stopPropagation(); setHoveredElement('header-text'); }}
                      onMouseLeave={(e) => { e.stopPropagation(); setHoveredElement(null); }}
                    />
                  </div>

                  {/* Messages area - contains clickable zones for messages and avatars */}
                  <div
                    className={`absolute top-16 left-0 right-0 bottom-14 pointer-events-auto cursor-pointer transition-all ${
                      hoveredElement === 'chat-bg' || selectedElement === 'chat-bg'
                        ? 'ring-2 ring-white ring-inset bg-white/5'
                        : ''
                    }`}
                    onClick={(e) => { e.stopPropagation(); onElementSelect('chat-bg'); }}
                    onMouseEnter={() => setHoveredElement('chat-bg')}
                    onMouseLeave={() => setHoveredElement(null)}
                  >
                    {/* Bot message zone - first message row (welcome message) */}
                    <div className="absolute top-4 left-4 right-4 flex items-start gap-2 pointer-events-none">
                      {/* Bot avatar clickable zone */}
                      <div
                        className={`w-7 h-7 rounded-full pointer-events-auto cursor-pointer transition-all flex-shrink-0 ${
                          hoveredElement === 'bot-avatar' || selectedElement === 'bot-avatar'
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110'
                            : 'hover:ring-2 hover:ring-white/50 hover:scale-105'
                        }`}
                        onClick={(e) => { e.stopPropagation(); onElementSelect('bot-avatar'); }}
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredElement('bot-avatar'); }}
                        onMouseLeave={(e) => { e.stopPropagation(); setHoveredElement(null); }}
                      />
                      {/* Bot message bubble clickable zone */}
                      <div
                        className={`max-w-[75%] h-10 rounded-xl pointer-events-auto cursor-pointer transition-all ${
                          hoveredElement === 'bot-msg' || selectedElement === 'bot-msg'
                            ? 'ring-2 ring-white bg-white/10'
                            : 'hover:ring-2 hover:ring-white/50'
                        }`}
                        style={{ width: '180px' }}
                        onClick={(e) => { e.stopPropagation(); onElementSelect('bot-msg'); }}
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredElement('bot-msg'); }}
                        onMouseLeave={(e) => { e.stopPropagation(); setHoveredElement(null); }}
                      />
                    </div>

                    {/* User message zone - second message row */}
                    <div className="absolute top-[72px] left-4 right-4 flex items-start gap-2 justify-end pointer-events-none">
                      {/* User message bubble clickable zone */}
                      <div
                        className={`max-w-[75%] h-10 rounded-xl pointer-events-auto cursor-pointer transition-all ${
                          hoveredElement === 'user-msg' || selectedElement === 'user-msg'
                            ? 'ring-2 ring-white bg-white/10'
                            : 'hover:ring-2 hover:ring-white/50'
                        }`}
                        style={{ width: '160px' }}
                        onClick={(e) => { e.stopPropagation(); onElementSelect('user-msg'); }}
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredElement('user-msg'); }}
                        onMouseLeave={(e) => { e.stopPropagation(); setHoveredElement(null); }}
                      />
                      {/* User avatar clickable zone */}
                      <div
                        className={`w-7 h-7 rounded-full pointer-events-auto cursor-pointer transition-all flex-shrink-0 ${
                          hoveredElement === 'user-avatar' || selectedElement === 'user-avatar'
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110'
                            : 'hover:ring-2 hover:ring-white/50 hover:scale-105'
                        }`}
                        onClick={(e) => { e.stopPropagation(); onElementSelect('user-avatar'); }}
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredElement('user-avatar'); }}
                        onMouseLeave={(e) => { e.stopPropagation(); setHoveredElement(null); }}
                      />
                    </div>
                  </div>

                  {/* Input area selection zone */}
                  <div
                    className={`absolute bottom-0 left-0 right-0 h-14 pointer-events-auto cursor-pointer transition-all flex items-center ${
                      hoveredElement === 'input' || selectedElement === 'input'
                        ? 'ring-2 ring-white ring-inset bg-white/5'
                        : ''
                    }`}
                    onClick={(e) => { e.stopPropagation(); onElementSelect('input'); }}
                    onMouseEnter={() => setHoveredElement('input')}
                    onMouseLeave={() => setHoveredElement(null)}
                  >
                    {/* Send button clickable zone - positioned at right of input area */}
                    <div
                      className={`absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full pointer-events-auto cursor-pointer transition-all ${
                        hoveredElement === 'send-button' || selectedElement === 'send-button'
                          ? 'ring-2 ring-white scale-110 bg-white/20'
                          : 'hover:ring-2 hover:ring-white/50 hover:scale-105'
                      }`}
                      onClick={(e) => { e.stopPropagation(); onElementSelect('send-button'); }}
                      onMouseEnter={(e) => { e.stopPropagation(); setHoveredElement('send-button'); }}
                      onMouseLeave={(e) => { e.stopPropagation(); setHoveredElement(null); }}
                    />
                  </div>
                </div>
              </div>
              );
            })()}
          </div>
        );
        })()}

        {/* Form Preview */}
        {widgetType === 'form' && (() => {
          const dims = getWidgetDimensions();
          return (
          <div
            id={`widget-${widgetId}`}
            className={`widget-container relative rounded-xl p-8 transition-all cursor-pointer ${
              selectedElement === 'form-bg' ? 'ring-2 ring-white' : hoveredElement === 'form-bg' ? 'ring-2 ring-white/50' : ''
            }`}
            style={{
              width: `${dims.width}px`,
              minHeight: `${dims.height}px`,
              backgroundColor: styles.backgroundColor || '#0a0a0a',
              borderRadius: `${styles.borderRadius || 12}px`,
              border: `1px solid ${styles.inputBorderColor || '#333333'}`,
              textAlign: (styles.textAlign as 'left' | 'center' | 'right') || 'left',
            }}
            onClick={() => onElementSelect('form-bg')}
            onMouseEnter={() => setHoveredElement('form-bg')}
            onMouseLeave={() => setHoveredElement(null)}
          >
            {/* Resize handles for form */}
            <ResizeHandles show={!!selectedElement || !!hoveredElement || isResizing} />
            <h3
              className={`text-xl font-bold mb-2 cursor-pointer transition-all inline-block ${
                selectedElement === 'form-title' ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent rounded px-1 -mx-1' :
                hoveredElement === 'form-title' ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-transparent rounded px-1 -mx-1' : ''
              }`}
              style={{ color: styles.textColor || '#ffffff' }}
              onClick={(e) => { e.stopPropagation(); onElementSelect('form-title'); }}
              onMouseEnter={(e) => { e.stopPropagation(); setHoveredElement('form-title'); }}
              onMouseLeave={(e) => { e.stopPropagation(); setHoveredElement(null); }}
            >
              {styles.formTitle || 'Contact Form'}
            </h3>
            {styles.showDescription && styles.formDescription && (
              <p className="text-sm mb-6" style={{ color: styles.textColor || '#ffffff', opacity: 0.6 }}>
                {styles.formDescription}
              </p>
            )}

            {formFields.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm" style={{ color: styles.textColor || '#ffffff', opacity: 0.6 }}>No form fields yet</p>
                <p className="text-xs mt-1" style={{ color: styles.textColor || '#ffffff', opacity: 0.4 }}>Add fields in the Content panel</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {/* Form Inputs - Clickable for selection with flex wrap for widths */}
                <div
                  className={`flex flex-wrap gap-4 cursor-pointer transition-all rounded-lg ${
                    selectedElement === 'form-input' ? 'ring-2 ring-white p-2 -m-2' :
                    hoveredElement === 'form-input' ? 'ring-2 ring-white/50 p-2 -m-2' : ''
                  }`}
                  onClick={(e) => { e.stopPropagation(); onElementSelect('form-input'); }}
                  onMouseEnter={(e) => { e.stopPropagation(); setHoveredElement('form-input'); }}
                  onMouseLeave={(e) => { e.stopPropagation(); setHoveredElement(null); }}
                >
                  {formFields.map((field, index) => {
                    // Convert styles to FormStyles format for shared component
                    const formStyles: FormStyles = {
                      backgroundColor: styles.backgroundColor || '#0a0a0a',
                      textColor: styles.textColor || '#ffffff',
                      primaryColor: styles.primaryColor || '#ffffff',
                      buttonTextColor: styles.buttonTextColor || '#000000',
                      inputBackgroundColor: styles.inputBackgroundColor || '#111111',
                      inputBorderColor: styles.inputBorderColor || '#333333',
                      borderRadius: styles.borderRadius || 12,
                    };

                    return (
                      <div key={index} style={{ width: getFieldWidthStyle(field.width), minWidth: '80px' }}>
                        <label
                          className="block text-sm font-medium mb-1.5"
                          style={{ color: styles.textColor || '#ffffff', opacity: 0.8 }}
                        >
                          {field.name}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <FieldRenderer
                          field={field}
                          value={field.type === 'checkbox' ? [] : ''}
                          styles={formStyles}
                          previewMode={true}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Form Submit Button */}
                <button
                  className={`w-full px-6 py-3 font-medium transition-all mt-4 cursor-pointer hover:scale-[1.02] ${
                    selectedElement === 'form-button' ? 'ring-2 ring-white scale-[1.02]' :
                    hoveredElement === 'form-button' ? 'ring-2 ring-white/50' : ''
                  }`}
                  style={{
                    backgroundColor: styles.primaryColor || '#ffffff',
                    color: styles.buttonTextColor || '#000000',
                    borderRadius: `${styles.borderRadius || 12}px`,
                  }}
                  onClick={(e) => { e.stopPropagation(); onElementSelect('form-button'); }}
                  onMouseEnter={(e) => { e.stopPropagation(); setHoveredElement('form-button'); }}
                  onMouseLeave={(e) => { e.stopPropagation(); setHoveredElement(null); }}
                >
                  {styles.buttonText || 'Submit'}
                </button>
              </div>
            )}
          </div>
          );
        })()}

        {/* Button Preview */}
        {widgetType === 'button' && (
          <div id={`widget-${widgetId}`} className="widget-container bg-gray-900/50 border border-gray-800 rounded-xl p-12 flex items-center justify-center">
            <button
              className={`font-medium transition-all shadow-lg cursor-pointer ${
                chatbotConfig.buttonSize === 'small' ? 'px-4 py-2 text-sm' :
                chatbotConfig.buttonSize === 'large' ? 'px-12 py-5 text-xl' :
                'px-8 py-4 text-lg'
              } ${
                chatbotConfig.buttonWidth === 'full' ? 'w-full' : ''
              } ${
                chatbotConfig.buttonHoverEffect === 'scale' ? 'hover:scale-105' :
                chatbotConfig.buttonHoverEffect === 'glow' ? 'hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]' :
                ''
              } ${
                selectedElement === 'button-widget' ? 'ring-2 ring-white scale-105' :
                hoveredElement === 'button-widget' ? 'ring-2 ring-white/50' : ''
              }`}
              style={{
                backgroundColor: styles.primaryColor || '#ffffff',
                color: styles.buttonTextColor || '#000000',
                borderRadius: `${styles.borderRadius || 12}px`,
              }}
              onClick={() => onElementSelect('button-widget')}
              onMouseEnter={() => setHoveredElement('button-widget')}
              onMouseLeave={() => setHoveredElement(null)}
            >
              {chatbotConfig.buttonIcon && <span className="mr-2">{chatbotConfig.buttonIcon}</span>}
              {chatbotConfig.buttonText || styles.buttonText || 'Click Me'}
            </button>
          </div>
        )}
      </div>

      {/* AI Edit Hint - Shows when an element is selected */}
      {selectedElement && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div className="flex items-center gap-2 bg-black/90 border border-gray-700 rounded-full px-3 py-1 text-[11px]">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span className="text-gray-300">{getElementLabel(selectedElement)}</span>
            <span className="text-purple-400">• Click AI to edit</span>
          </div>
        </div>
      )}
    </div>
  );
}
