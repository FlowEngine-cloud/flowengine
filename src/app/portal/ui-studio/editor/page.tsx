'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Plus, Search, Layers, Trash2, ArrowLeft,
  MousePointer, FileText, Copy, MoreHorizontal, Tag, Sparkles,
  GripVertical, Type, Mail, Hash, AlignLeft, Calendar, Clock,
  Upload, CheckSquare, Circle, Phone, Link as LinkIcon, ChevronDown, X,
  HelpCircle, ExternalLink, Palette, ChevronRight, MessageCircle, Image,
  Sun, Moon, Send, RotateCcw, QrCode, Code2, Check, Maximize2, Minimize2,
  Lock, Paperclip
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { GradientBuilder } from '@/components/widget-studio/GradientBuilder';
import { EnhancedColorInput } from '@/components/widget-studio/EnhancedColorInput';
import { VisualColorMap } from '@/components/widget-studio/VisualColorMap';
import { InteractiveColorEditor } from '@/components/widget-studio/InteractiveColorEditor';
import { CanvasEditor } from '@/components/widget-studio/CanvasEditor';
import { UnifiedCanvasEditor, SelectedElement } from '@/components/widget-studio/UnifiedCanvasEditor';
import { parseURLImportConfig, parseURLImportConfigWithError, DEFAULT_CHATBOT_CONFIG as SHARED_CHATBOT_DEFAULTS } from '@/components/widget-studio/types';
import { consumeWidgetTransfer, type WidgetTransfer } from '@/lib/widgetTransfer';
import { UIStudioSkeleton, CardGridSkeleton } from '@/components/ui/skeletons';
import AuthModal from '@/components/AuthModal';

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'file' | 'checkbox' | 'radio' | 'phone' | 'url';
  required: boolean;
  options?: string[];
  placeholder?: string;

  // Advanced styling
  width?: '25' | '33' | '50' | '100'; // percentage
  customBorderRadius?: string; // px
  customPadding?: string; // px
  customFontSize?: string; // px
  customHeight?: string; // px
}

interface WidgetStyles {
  // Form Container
  backgroundColor: string;
  formPadding: string;
  formMaxWidth: string;
  formShadow: string;

  // Title & Description
  showTitle: boolean;
  formTitle: string;
  titleColor: string;
  titleFontSize: string;
  titleFontWeight: string;
  titleAlignment: string;
  showDescription: boolean;
  formDescription: string;
  descriptionColor: string;
  descriptionFontSize: string;

  // Labels
  labelColor: string;
  labelFontSize: string;
  labelFontWeight: string;
  labelMarginBottom: string;
  requiredIndicatorColor: string;

  // Inputs
  inputBackgroundColor: string;
  inputBorderColor: string;
  inputBorderWidth: string;
  textColor: string;
  inputFontSize: string;
  inputPadding: string;
  placeholderColor: string;
  inputFocusBorderColor: string;
  inputFocusShadow: string;

  // Button
  primaryColor: string;
  buttonTextColor: string;
  buttonText: string;
  buttonFontSize: string;
  buttonFontWeight: string;
  buttonPadding: string;
  buttonWidth: string;
  buttonHoverColor: string;
  buttonShadow: string;

  // Layout
  borderRadius: string;
  fieldSpacing: string;
  fontFamily: string;

  // Messages
  successMessageColor: string;
  successBackgroundColor: string;
  errorMessageColor: string;
  errorBackgroundColor: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  display_order: number;
  instance_id: string | null;
  instance?: {
    id: string;
    instance_name: string;
  } | null;
}

interface InstanceWithoutCategory {
  id: string;
  instance_name: string;
}

interface ChatbotConfig {
  // Display Mode
  displayMode: 'popup' | 'embedded';
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  // Branding
  chatbotLogo?: string;
  chatbotName: string;
  showWatermark: boolean;

  // RTL Support
  direction: 'ltr' | 'rtl';
  textAlign: 'left' | 'right' | 'center';

  // Bubble/Icon
  bubbleColor: string;
  bubbleGradient?: string; // gradient string
  bubbleIcon: string;
  bubbleIconColor?: string;
  bubbleSize: string;
  bubbleShape: 'circle' | 'rounded-square' | 'square';
  bubbleGlow: boolean;
  bubbleGlowColor: string;
  bubbleAnimation: 'none' | 'pulse' | 'bounce' | 'shake' | 'glow';

  // Avatar
  avatarIcon?: string; // emoji icon for bot avatar

  // Chat Window - Advanced Colors
  headerColor: string;
  headerGradient?: string;
  headerTextColor: string;
  chatBackgroundColor: string;
  chatBackgroundGradient?: string;
  chatBackgroundPattern?: 'none' | 'dots' | 'grid' | 'waves' | 'particles';

  // Input Area
  inputBackgroundColor?: string;
  inputTextColor?: string;
  inputPlaceholderColor?: string;
  sendButtonColor?: string;

  // Messages - User
  userMessageColor: string;
  userMessageGradient?: string;
  userMessageTextColor: string;
  userMessageShadow: string;
  userMessageGlow: boolean;
  userMessageGlowColor: string;

  // Messages - Bot
  botMessageColor: string;
  botMessageGradient?: string;
  botMessageTextColor: string;
  botMessageShadow: string;
  botMessageGlow: boolean;
  botMessageGlowColor: string;

  // Message Styling
  messageAnimation: 'none' | 'slide' | 'fade' | 'bounce' | 'scale';
  messageSpacing: string;
  messagePadding: string;
  showAvatar: boolean;
  avatarUrl?: string;
  showTimestamp: boolean;
  timestampColor: string;

  // Typography
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';

  // Behavior
  welcomeMessage: string;
  placeholder: string;
  autoOpen: 'always' | 'delayed' | 'click-only';
  autoOpenDelay?: number; // in seconds for delayed mode
  typingIndicator: 'dots' | 'pulse' | 'wave' | 'none';
  typingAnimation?: boolean;
  windowAnimation?: 'none' | 'slideUp' | 'fadeIn' | 'scaleIn' | 'flipIn';
  soundEffects: boolean;

  // Greeting
  showGreeting?: boolean;
  greetingMessage?: string;
  greetingDelay?: number;
  greetingAutoHide?: boolean;

  // Advanced Styling
  borderRadius: string;
  borderWidth: string;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'double';

  // Effects
  backdropBlur: string;
  boxShadow: string;
  glassEffect: boolean;

  // Layout
  chatWidth: string;
  chatHeight: string;
  inputHeight: string;
  headerHeight: string;

  // Theme
  themePreset: 'custom' | 'neon' | 'glassmorphism' | 'neumorphism' | 'cyberpunk' | 'minimal' | 'gradient';

  // File uploads
  allowFileUploads?: boolean;
  allowedFileMimeTypes?: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  widget_type: 'button' | 'form' | 'chatbot';
  form_fields: FormField[] | null;
  webhook_url: string | null;
  instance_id: string | null;
  instance: {
    id: string;
    instance_name: string;
  } | null;
  styles: WidgetStyles | null;
  chatbot_config?: ChatbotConfig | null;
  is_active?: boolean;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e'];

// Chatbot bubble icon options
const BUBBLE_ICONS = [
  { value: '💬', label: 'Chat Bubble', shape: 'circle' },
  { value: '🤖', label: 'Robot', shape: 'circle' },
  { value: '👋', label: 'Wave', shape: 'circle' },
  { value: '💭', label: 'Thought', shape: 'circle' },
  { value: '✨', label: 'Sparkles', shape: 'circle' },
  { value: '🎯', label: 'Target', shape: 'circle' },
  { value: '⚡', label: 'Lightning', shape: 'circle' },
  { value: '🚀', label: 'Rocket', shape: 'circle' },
  { value: '💡', label: 'Lightbulb', shape: 'circle' },
];

// Chatbot avatar icon options
const AVATAR_ICONS = [
  { value: '🤖', label: 'Robot' },
  { value: '👤', label: 'Person' },
  { value: '🎭', label: 'Theater' },
  { value: '🦸', label: 'Superhero' },
  { value: '🧑‍💼', label: 'Professional' },
  { value: '👨‍💻', label: 'Developer' },
  { value: '👩‍⚕️', label: 'Healthcare' },
  { value: '🎓', label: 'Education' },
  { value: '🌟', label: 'Star' },
];

const BUBBLE_SHAPES = [
  { value: 'circle', label: 'Circle' },
  { value: 'rounded-square', label: 'Rounded Square' },
  { value: 'square', label: 'Square' },
];

const FIELD_TYPES = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'textarea', label: 'Text Area', icon: AlignLeft },
  { type: 'select', label: 'Dropdown', icon: ChevronDown },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'time', label: 'Time', icon: Clock },
  { type: 'file', label: 'File', icon: Upload },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'radio', label: 'Radio', icon: Circle },
  { type: 'url', label: 'URL', icon: LinkIcon },
] as const;

const DEFAULT_STYLES: WidgetStyles = {
  // Form Container
  backgroundColor: '#0a0a0a',
  formPadding: '24',
  formMaxWidth: '480',
  formShadow: 'none',

  // Title & Description
  showTitle: true,
  formTitle: 'Contact Us',
  titleColor: '#ffffff',
  titleFontSize: '24',
  titleFontWeight: '600',
  titleAlignment: 'left',
  showDescription: false,
  formDescription: 'Fill out the form below and we\'ll get back to you.',
  descriptionColor: '#888888',
  descriptionFontSize: '14',

  // Labels
  labelColor: '#ffffff',
  labelFontSize: '14',
  labelFontWeight: '500',
  labelMarginBottom: '6',
  requiredIndicatorColor: '#ef4444',

  // Inputs
  inputBackgroundColor: '#111111',
  inputBorderColor: '#333333',
  inputBorderWidth: '1',
  textColor: '#ffffff',
  inputFontSize: '14',
  inputPadding: '12',
  placeholderColor: '#666666',
  inputFocusBorderColor: '#ffffff',
  inputFocusShadow: '0 0 0 2px rgba(255,255,255,0.1)',

  // Button
  primaryColor: '#ffffff',
  buttonTextColor: '#000000',
  buttonText: 'Submit',
  buttonFontSize: '14',
  buttonFontWeight: '600',
  buttonPadding: '14',
  buttonWidth: 'full',
  buttonHoverColor: '#e5e5e5',
  buttonShadow: 'none',

  // Layout
  borderRadius: '12',
  fieldSpacing: '20',
  fontFamily: 'system-ui',

  // Messages
  successMessageColor: '#10b981',
  successBackgroundColor: '#10b98115',
  errorMessageColor: '#ef4444',
  errorBackgroundColor: '#ef444415',
};

const CHATBOT_THEME_PRESETS: Record<string, Partial<ChatbotConfig>> = {
  neon: {
    themePreset: 'neon',
    bubbleGradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    bubbleGlow: true,
    bubbleGlowColor: '#f5576c',
    bubbleAnimation: 'glow',
    headerGradient: 'linear-gradient(135deg, #ff006a 0%, #d500f9 100%)',
    headerTextColor: '#ffffff',
    chatBackgroundColor: '#0a0014',
    chatBackgroundPattern: 'dots',
    userMessageGradient: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
    userMessageGlow: true,
    userMessageGlowColor: '#00f2fe',
    userMessageShadow: '0 0 20px rgba(0, 242, 254, 0.6)',
    botMessageColor: '#1a0033',
    botMessageTextColor: '#ff00ff',
    botMessageGlow: true,
    botMessageGlowColor: '#ff00ff',
    boxShadow: '0 0 60px rgba(245, 87, 108, 0.4)',
    borderColor: '#ff00ff',
    glassEffect: false,
  },
  glassmorphism: {
    themePreset: 'glassmorphism',
    bubbleColor: 'rgba(255, 255, 255, 0.1)',
    bubbleGradient: '',
    bubbleGlow: false,
    bubbleAnimation: 'none',
    headerColor: 'rgba(255, 255, 255, 0.1)',
    headerGradient: '',
    headerTextColor: '#ffffff',
    chatBackgroundColor: 'rgba(15, 15, 15, 0.7)',
    chatBackgroundPattern: 'none',
    userMessageColor: 'rgba(255, 255, 255, 0.15)',
    userMessageGradient: '',
    userMessageTextColor: '#ffffff',
    userMessageGlow: false,
    userMessageShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    botMessageColor: 'rgba(255, 255, 255, 0.1)',
    botMessageTextColor: '#ffffff',
    botMessageGlow: false,
    backdropBlur: '20',
    glassEffect: true,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  },
  cyberpunk: {
    themePreset: 'cyberpunk',
    bubbleGradient: 'linear-gradient(135deg, #fcff00 0%, #00ffff 100%)',
    bubbleGlow: true,
    bubbleGlowColor: '#00ffff',
    bubbleAnimation: 'shake',
    headerGradient: 'linear-gradient(135deg, #ff0080 0%, #ff8c00 50%, #40e0d0 100%)',
    headerTextColor: '#000000',
    chatBackgroundColor: '#0d0221',
    chatBackgroundPattern: 'grid',
    userMessageGradient: 'linear-gradient(135deg, #fcff00 0%, #00ffff 100%)',
    userMessageTextColor: '#000000',
    userMessageGlow: true,
    userMessageGlowColor: '#00ffff',
    userMessageShadow: '0 0 20px rgba(0, 255, 255, 0.8)',
    botMessageColor: '#1a0b2e',
    botMessageTextColor: '#ff0080',
    botMessageGlow: true,
    botMessageGlowColor: '#ff0080',
    boxShadow: '0 0 40px rgba(255, 0, 128, 0.5)',
    borderColor: '#00ffff',
    borderWidth: '2',
    textTransform: 'uppercase',
    letterSpacing: '1',
  },
  neumorphism: {
    themePreset: 'neumorphism',
    bubbleColor: '#e0e5ec',
    bubbleGradient: '',
    bubbleIconColor: '#2c3e50',
    bubbleGlow: false,
    bubbleAnimation: 'none',
    headerColor: '#e0e5ec',
    headerGradient: '',
    headerTextColor: '#2c3e50',
    chatBackgroundColor: '#e0e5ec',
    chatBackgroundPattern: 'none',
    userMessageColor: '#e0e5ec',
    userMessageGradient: '',
    userMessageTextColor: '#2c3e50',
    userMessageGlow: false,
    userMessageShadow: '6px 6px 12px #a3b1c6, -6px -6px 12px #ffffff',
    botMessageColor: '#e0e5ec',
    botMessageTextColor: '#34495e',
    botMessageGlow: false,
    botMessageShadow: '-6px -6px 12px #ffffff, 6px 6px 12px #a3b1c6',
    borderColor: 'transparent',
    boxShadow: '20px 20px 60px #a3b1c6, -20px -20px 60px #ffffff',
    borderRadius: '30',
    // Light theme input area colors
    inputBackgroundColor: '#e0e5ec',
    inputTextColor: '#2c3e50',
    inputPlaceholderColor: 'rgba(44,62,80,0.5)',
    sendButtonColor: '#2c3e50',
  },
  minimal: {
    themePreset: 'minimal',
    bubbleColor: '#000000',
    bubbleGradient: '',
    bubbleIconColor: '#ffffff',
    bubbleGlow: false,
    bubbleAnimation: 'none',
    headerColor: '#ffffff',
    headerGradient: '',
    headerTextColor: '#000000',
    chatBackgroundColor: '#ffffff',
    chatBackgroundPattern: 'none',
    userMessageColor: '#000000',
    userMessageGradient: '',
    userMessageTextColor: '#ffffff',
    userMessageGlow: false,
    userMessageShadow: 'none',
    botMessageColor: '#f5f5f5',
    botMessageTextColor: '#000000',
    botMessageGlow: false,
    botMessageShadow: 'none',
    borderColor: '#e5e5e5',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    borderRadius: '12',
    glassEffect: false,
    // Light theme input area colors
    inputBackgroundColor: '#f5f5f5',
    inputTextColor: '#000000',
    inputPlaceholderColor: 'rgba(0,0,0,0.5)',
    sendButtonColor: '#000000',
  },
  gradient: {
    themePreset: 'gradient',
    bubbleGradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    bubbleGlow: true,
    bubbleGlowColor: '#fa709a',
    bubbleAnimation: 'pulse',
    headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    headerTextColor: '#ffffff',
    chatBackgroundGradient: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    chatBackgroundPattern: 'waves',
    userMessageGradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    userMessageTextColor: '#ffffff',
    userMessageGlow: true,
    userMessageGlowColor: '#f5576c',
    botMessageGradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    botMessageTextColor: '#ffffff',
    botMessageGlow: true,
    botMessageGlowColor: '#00f2fe',
    boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)',
  },
};

const BUTTON_STYLE_PRESETS: Record<string, Partial<WidgetStyles>> = {
  primary: {
    primaryColor: '#ffffff',
    buttonTextColor: '#000000',
    buttonHoverColor: '#f5f5f5',
    buttonFontSize: '16',
    buttonFontWeight: '600',
    buttonPadding: '16',
    buttonWidth: 'full',
    buttonShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    borderRadius: '8',
  },
  gradient: {
    primaryColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    buttonTextColor: '#ffffff',
    buttonHoverColor: '#5a67d8',
    buttonFontSize: '16',
    buttonFontWeight: '700',
    buttonPadding: '16',
    buttonWidth: 'full',
    buttonShadow: '0 10px 25px rgba(102, 126, 234, 0.3)',
    borderRadius: '12',
  },
  neon: {
    primaryColor: '#000000',
    buttonTextColor: '#00ffff',
    buttonHoverColor: '#1a1a1a',
    buttonFontSize: '16',
    buttonFontWeight: '700',
    buttonPadding: '16',
    buttonWidth: 'full',
    buttonShadow: '0 0 20px rgba(0, 255, 255, 0.6), inset 0 0 20px rgba(0, 255, 255, 0.2)',
    borderRadius: '8',
  },
  minimal: {
    primaryColor: 'transparent',
    buttonTextColor: '#000000',
    buttonHoverColor: '#f5f5f5',
    buttonFontSize: '14',
    buttonFontWeight: '500',
    buttonPadding: '12',
    buttonWidth: 'auto',
    buttonShadow: 'none',
    borderRadius: '6',
  },
  pill: {
    primaryColor: '#000000',
    buttonTextColor: '#ffffff',
    buttonHoverColor: '#333333',
    buttonFontSize: '15',
    buttonFontWeight: '600',
    buttonPadding: '14',
    buttonWidth: 'auto',
    buttonShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    borderRadius: '999',
  },
  outline: {
    primaryColor: 'transparent',
    buttonTextColor: '#000000',
    buttonHoverColor: '#000000',
    buttonFontSize: '16',
    buttonFontWeight: '600',
    buttonPadding: '16',
    buttonWidth: 'full',
    buttonShadow: 'none',
    borderRadius: '8',
  },
};

// Extend shared defaults with UI Studio specific properties
// Core styling values come from SHARED_CHATBOT_DEFAULTS for consistency across all views
// Note: UI Studio uses string types for numeric values (e.g., '60' vs 60) for form inputs
const DEFAULT_CHATBOT_CONFIG: ChatbotConfig = {
  // Required fields - convert numbers to strings where UI Studio expects strings
  displayMode: SHARED_CHATBOT_DEFAULTS.displayMode || 'popup',
  position: SHARED_CHATBOT_DEFAULTS.position || 'bottom-right',
  bubbleColor: SHARED_CHATBOT_DEFAULTS.bubbleColor || '#ffffff',
  bubbleSize: String(SHARED_CHATBOT_DEFAULTS.bubbleSize || 60),
  bubbleIcon: SHARED_CHATBOT_DEFAULTS.bubbleIcon || 'message-circle',
  bubbleGlow: SHARED_CHATBOT_DEFAULTS.bubbleGlow ?? true,
  bubbleAnimation: SHARED_CHATBOT_DEFAULTS.bubbleAnimation || 'pulse',
  chatbotName: SHARED_CHATBOT_DEFAULTS.chatbotName || 'Chat Assistant',
  headerColor: SHARED_CHATBOT_DEFAULTS.headerColor || '#ffffff',
  headerTextColor: SHARED_CHATBOT_DEFAULTS.headerTextColor || '#ffffff',
  chatBackgroundColor: SHARED_CHATBOT_DEFAULTS.chatBackgroundColor || '#0a0a0a',
  welcomeMessage: SHARED_CHATBOT_DEFAULTS.welcomeMessage || 'Hi! How can I help you today?',
  placeholder: SHARED_CHATBOT_DEFAULTS.placeholder || 'Type your message...',
  userMessageColor: SHARED_CHATBOT_DEFAULTS.userMessageColor || '#ffffff',
  userMessageTextColor: SHARED_CHATBOT_DEFAULTS.userMessageTextColor || '#ffffff',
  botMessageColor: SHARED_CHATBOT_DEFAULTS.botMessageColor || '#1a1a1a',
  botMessageTextColor: SHARED_CHATBOT_DEFAULTS.botMessageTextColor || '#ffffff',
  fontFamily: SHARED_CHATBOT_DEFAULTS.fontFamily || 'system-ui',
  fontSize: String(SHARED_CHATBOT_DEFAULTS.fontSize || 14),
  fontWeight: SHARED_CHATBOT_DEFAULTS.fontWeight || '400',
  lineHeight: SHARED_CHATBOT_DEFAULTS.lineHeight || '1.5',
  messagePadding: String(SHARED_CHATBOT_DEFAULTS.messagePadding || 12),
  borderRadius: String(SHARED_CHATBOT_DEFAULTS.borderRadius || 20),
  borderStyle: 'solid', // UI Studio only supports solid, dashed, dotted, double
  borderWidth: String(SHARED_CHATBOT_DEFAULTS.borderWidth || 1),
  boxShadow: SHARED_CHATBOT_DEFAULTS.boxShadow || '0 20px 60px rgba(0, 0, 0, 0.5)',
  glassEffect: SHARED_CHATBOT_DEFAULTS.glassEffect ?? false,
  windowAnimation: SHARED_CHATBOT_DEFAULTS.windowAnimation || 'slideUp',
  showGreeting: SHARED_CHATBOT_DEFAULTS.showGreeting ?? false,
  greetingMessage: SHARED_CHATBOT_DEFAULTS.greetingMessage || 'Hi! How can I help you?',
  greetingDelay: SHARED_CHATBOT_DEFAULTS.greetingDelay ?? 2,
  greetingAutoHide: SHARED_CHATBOT_DEFAULTS.greetingAutoHide ?? false,

  // Gradient values from shared defaults
  bubbleGradient: SHARED_CHATBOT_DEFAULTS.bubbleGradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  headerGradient: SHARED_CHATBOT_DEFAULTS.headerGradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  chatBackgroundGradient: SHARED_CHATBOT_DEFAULTS.chatBackgroundGradient || '',
  userMessageGradient: SHARED_CHATBOT_DEFAULTS.userMessageGradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  botMessageGradient: SHARED_CHATBOT_DEFAULTS.botMessageGradient || '',
  bubbleGlowColor: SHARED_CHATBOT_DEFAULTS.bubbleGlowColor || '#667eea',
  userMessageGlow: SHARED_CHATBOT_DEFAULTS.userMessageGlow ?? true,
  userMessageGlowColor: SHARED_CHATBOT_DEFAULTS.userMessageGlowColor || '#667eea',
  botMessageGlow: SHARED_CHATBOT_DEFAULTS.botMessageGlow ?? false,
  botMessageGlowColor: SHARED_CHATBOT_DEFAULTS.botMessageGlowColor || '#000000',
  inputBackgroundColor: SHARED_CHATBOT_DEFAULTS.inputBackgroundColor || '#0a0a0a',
  inputTextColor: SHARED_CHATBOT_DEFAULTS.inputTextColor || '#ffffff',
  inputPlaceholderColor: SHARED_CHATBOT_DEFAULTS.inputPlaceholderColor || 'rgba(255,255,255,0.5)',
  sendButtonColor: SHARED_CHATBOT_DEFAULTS.sendButtonColor || '#ffffff',

  // UI Studio specific properties (not in shared defaults)
  showWatermark: true,
  direction: 'ltr',
  textAlign: 'left',
  bubbleShape: 'circle',
  avatarIcon: '🤖',
  chatBackgroundPattern: 'none',
  userMessageShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
  botMessageShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  messageAnimation: 'slide',
  messageSpacing: '12',
  showAvatar: true,
  avatarUrl: '',
  showTimestamp: true,
  timestampColor: '#666666',
  letterSpacing: '0',
  textTransform: 'none',
  typingIndicator: 'dots',
  soundEffects: false,
  borderColor: '#333333',
  backdropBlur: '10',
  chatWidth: '400',
  chatHeight: '600',
  inputHeight: '56',
  headerHeight: '64',
  themePreset: 'custom',

  // Override autoOpen to use string enum for UI Studio UI
  autoOpen: 'click-only',
  autoOpenDelay: 3,

  // File uploads (disabled by default)
  allowFileUploads: SHARED_CHATBOT_DEFAULTS.allowFileUploads ?? false,
  allowedFileMimeTypes: SHARED_CHATBOT_DEFAULTS.allowedFileMimeTypes || '',
};

// AI Assistant loading phases
const AI_LOADING_PHASES = [
  'Understanding your request...',
  'Analyzing component context...',
  'Generating changes...',
  'Finalizing response...',
];

// Cache utilities for stale-while-revalidate pattern
const UI_STUDIO_CACHE_KEY = 'ui-studio-cache';
const UI_STUDIO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface UIStudioCache {
  templates: Template[];
  categories: Category[];
  timestamp: number;
}

function getUIStudioCache(): UIStudioCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(UI_STUDIO_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached) as UIStudioCache;
    if (Date.now() - data.timestamp > UI_STUDIO_CACHE_TTL) {
      sessionStorage.removeItem(UI_STUDIO_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setUIStudioCache(templates: Template[], categories: Category[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(UI_STUDIO_CACHE_KEY, JSON.stringify({ templates, categories, timestamp: Date.now() }));
  } catch {
    // Ignore storage errors
  }
}

function WidgetStudioContent({ embedded = false }: { embedded?: boolean } = {}) {
  const { session, user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const widgetIdFromUrl = searchParams.get('widget') || searchParams.get('edit');
  const [loadedWidgetId, setLoadedWidgetId] = useState<string | null>(null);
  // Ref to prevent race condition when exiting - useSearchParams doesn't update synchronously with replaceState
  const isExitingRef = useRef(false);

  // Redirect to main listing if no relevant params and not embedded
  // This prevents showing a duplicate template listing
  const hasEditorParams = widgetIdFromUrl || searchParams.get('editor') || searchParams.get('config') || searchParams.get('transfer') || searchParams.get('aiMode') || searchParams.get('import') || searchParams.get('draftId');
  useEffect(() => {
    if (!embedded && !hasEditorParams) {
      router.replace('/portal/ui-studio');
    }
  }, [embedded, hasEditorParams, router]);

  // Auto-enter builder mode when navigating from portal "+ New" button
  useEffect(() => {
    if (searchParams.get('editor') === 'new') {
      setIsBuilderMode(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [instancesWithoutCategory, setInstancesWithoutCategory] = useState<{ id: string; instance_name: string }[]>([]);
  const [instances, setInstances] = useState<{ id: string; instance_name: string }[]>([]);
  const [selectedInstanceFilter, setSelectedInstanceFilter] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);

  // Builder state
  const [isBuilderMode, setIsBuilderMode] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [builderTab, setBuilderTab] = useState<'content' | 'colors' | 'design' | 'effects' | 'animations'>('content');

  // Form state
  const [widgetName, setWidgetName] = useState('Untitled Component');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [defaultWebhookPath, setDefaultWebhookPath] = useState('');
  const [widgetType, setWidgetType] = useState<'button' | 'form' | 'chatbot'>('chatbot');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [styles, setStyles] = useState<WidgetStyles>(DEFAULT_STYLES);
  const [chatbotConfig, setChatbotConfig] = useState<ChatbotConfig>(DEFAULT_CHATBOT_CONFIG);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false); // Draft mode by default

  // Category management
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(COLORS[0]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // Help modal
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAccessHelp, setShowAccessHelp] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [previewBg, setPreviewBg] = useState<'dark' | 'light'>('dark');
  const [previewHeight, setPreviewHeight] = useState(400);
  const [aiChatHeight, setAiChatHeight] = useState(300);
  const [chatMessages, setChatMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [canvasMode, setCanvasMode] = useState(true); // Canvas mode by default for chatbots
  const [initialSelectedElement, setInitialSelectedElement] = useState<SelectedElement>(null);
  const [chatInput, setChatInput] = useState('');

  // AI Assistant state (local memory - no DB)
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiLoadingPhase, setAiLoadingPhase] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiChangeApplied, setAiChangeApplied] = useState(false);
  const [aiFullScreen, setAiFullScreen] = useState(false);
  const [mobileEditorTab, setMobileEditorTab] = useState<'chat' | 'preview'>('chat');
  const [embedCodeCopied, setEmbedCodeCopied] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [savedWidgetId, setSavedWidgetId] = useState<string | null>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [sharePanelExpanded, setSharePanelExpanded] = useState(true);
  const [originUrl, setOriginUrl] = useState(''); // Set on client to prevent hydration mismatch

  // Draft auto-save state
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDeletingAllDrafts, setIsDeletingAllDrafts] = useState(false);
  const [deleteAllDraftsConfirm, setDeleteAllDraftsConfirm] = useState(false);
  // Use ref instead of state to avoid triggering re-renders and duplicate saves
  const currentDraftIdRef = useRef<string | null>(null);
  // Lock to prevent concurrent auto-saves creating multiple drafts
  const isSavingDraftRef = useRef(false);
  // Flag to skip auto-save when a real save is in progress or completed
  const skipAutoSaveRef = useRef(false);

  // Multi-select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [showBulkTagsModal, setShowBulkTagsModal] = useState(false);
  const [bulkTagsInstanceIds, setBulkTagsInstanceIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canCreateMore = true; // No tier limits in self-hosted
  const isPro = true;
  const isProPlus = true;

  // Set origin URL on client to prevent hydration mismatch
  useEffect(() => {
    setOriginUrl(window.location.origin);
  }, []);

  // Load Google Fonts dynamically
  useEffect(() => {
    if (styles.fontFamily && styles.fontFamily !== 'system-ui') {
      const fontName = styles.fontFamily.replace(/\s+/g, '+');
      const linkId = `google-font-${fontName}`;

      // Check if already loaded
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;
        document.head.appendChild(link);
      }
    }
  }, [styles.fontFamily]);

  // Check for AI mode from URL params
  useEffect(() => {
    const aiMode = searchParams.get('aiMode');
    if (aiMode === 'true') {
      setIsBuilderMode(true);
      setAiAssistantOpen(true);
      setAiFullScreen(true);
    }
  }, [searchParams]);

  // Import component config from transfer utility or URL params (from workflow builder)
  useEffect(() => {
    const transferId = searchParams.get('transfer');
    const configParam = searchParams.get('config');
    const elementParam = searchParams.get('element');

    let transfer: WidgetTransfer | null = null;

    // Method 1: Use new transfer utility (preferred - validated, expiry-checked)
    if (transferId) {
      transfer = consumeWidgetTransfer(transferId);
      if (transfer) {
        // Transfer loaded successfully
      } else {
        console.warn('[UI Studio] Transfer not found or expired for id:', transferId);
      }
    }
    // Method 2: Fall back to URL param (for backwards compatibility)
    else if (configParam) {
      const parseResult = parseURLImportConfigWithError(configParam);
      if (parseResult.success === true) {
        // Convert URL config to transfer format
        transfer = {
          widgetType: parseResult.data.widgetType || 'chatbot',
          chatbotConfig: parseResult.data.chatbotConfig,
          formFields: parseResult.data.formFields,
          styles: parseResult.data.styles,
          webhookPath: parseResult.data.webhookPath,
          selectedElement: elementParam,
        };
      } else if (parseResult.success === false) {
        console.error('[UI Studio] Failed to parse URL config:', parseResult.error);
      }
    }

    // Apply transfer data if available
    if (transfer) {
      // Set initial element from transfer or URL param, default to 'bubble' for chatbot
      const elementToSelect = transfer.selectedElement || elementParam;
      if (elementToSelect) {
        setInitialSelectedElement(elementToSelect as SelectedElement);
      } else if (transfer.widgetType === 'chatbot') {
        setInitialSelectedElement('bubble');
      }

      // Enter builder mode with appropriate component type
      setIsBuilderMode(true);
      setWidgetType(transfer.widgetType || 'chatbot');
      setCanvasMode(true);

      // Set component name based on component type
      if (transfer.chatbotConfig?.chatbotName) {
        setWidgetName(transfer.chatbotConfig.chatbotName as string);
      } else if (transfer.widgetType === 'form' && transfer.styles?.formTitle) {
        setWidgetName(transfer.styles.formTitle as string);
      } else if (transfer.widgetType === 'button' && (transfer.styles?.buttonText || transfer.chatbotConfig?.buttonText)) {
        setWidgetName((transfer.styles?.buttonText || transfer.chatbotConfig?.buttonText) as string);
      }

      // Apply validated chatbot config
      if (transfer.chatbotConfig) {
        setChatbotConfig(prev => ({
          ...prev,
          ...(transfer.chatbotConfig as Partial<ChatbotConfig>),
        }));
      } else if (transfer.widgetType === 'button' && transfer.styles) {
        // For button components, apply button properties to chatbotConfig as well
        // since CanvasPreviewArea reads buttonSize, buttonWidth, etc. from chatbotConfig
        setChatbotConfig(prev => ({
          ...prev,
          buttonText: transfer.styles?.buttonText as string | undefined,
          buttonSize: (transfer.styles?.buttonSize as 'small' | 'medium' | 'large') || 'medium',
          buttonWidth: (transfer.styles?.buttonWidth as 'auto' | 'full') || 'auto',
          buttonHoverEffect: (transfer.styles?.buttonHoverEffect as 'none' | 'scale' | 'glow') || 'none',
          buttonIcon: transfer.styles?.buttonIcon as string | undefined,
        }));
      } else {
        console.warn('[UI Studio] No chatbotConfig in transfer! Using defaults.');
      }

      // Apply form fields if provided
      if (transfer.formFields) {
        setFormFields(transfer.formFields as FormField[]);
      }

      // Apply styles if provided
      if (transfer.styles) {
        setStyles(prev => ({
          ...prev,
          ...(transfer.styles as unknown as Partial<WidgetStyles>),
        }));
      }

      // Store webhook path if provided
      if (transfer.webhookPath) {
        setDefaultWebhookPath(transfer.webhookPath);
      }
    }
  }, [searchParams]);

  // Load draft from database or restore editor from URL param
  useEffect(() => {
    // Skip if we're intentionally exiting (race condition with useSearchParams)
    if (isExitingRef.current) return;

    const importMethod = searchParams.get('import');
    const configParam = searchParams.get('config');
    const widgetParam = searchParams.get('widget');
    const editorParam = searchParams.get('editor');
    const draftIdParam = searchParams.get('draftId');

    // If ?editor=true is in URL, we should enter/stay in builder mode
    // This persists the editor state across refreshes
    // Skip if importing from session or URL config
    if (editorParam === 'true' && !isBuilderMode && !configParam && !widgetParam && !importMethod && session) {
      // Reset auto-save state for fresh session
      setLastAutoSave(null);
      setIsAutoSaving(false);
      setSavedWidgetId(null);

      // Try to load draft if available - use draftId param if provided
      const draftUrl = draftIdParam
        ? `/api/widget-studio/draft?id=${draftIdParam}`
        : '/api/widget-studio/draft';

      fetch(draftUrl, {
        headers: { 'Authorization': `Bearer ${(session as any).access_token}` },
      })
        .then(res => res.json())
        .then(data => {
          setIsBuilderMode(true);
          setCanvasMode(true);

          if (data.draft) {
            // Track the draft ID for future updates (prevents creating new drafts)
            currentDraftIdRef.current = data.draft.id;

            // Load component type from draft
            setWidgetType(data.draft.widget_type || 'chatbot');

            // Load type-specific data
            if (data.draft.widget_type === 'form' && data.draft.form_fields) {
              setFormFields(data.draft.form_fields);
            } else if (data.draft.chatbot_config) {
              setChatbotConfig(prev => ({
                ...prev,
                ...data.draft.chatbot_config,
              }));
              if (data.draft.chatbot_config.chatbotName) {
                setWidgetName(data.draft.chatbot_config.chatbotName);
              }
            }

            // Load styles
            if (data.draft.styles) {
              setStyles(prev => ({ ...prev, ...data.draft.styles }));
            }

            // Load webhook URL
            if (data.draft.webhook_url) {
              setDefaultWebhookPath(data.draft.webhook_url);
            }

            // If draft exists, show "Draft saved" with the draft's update time
            if (data.draft.updated_at) {
              setLastAutoSave(new Date(data.draft.updated_at));
            }
          } else {
            // No draft, start with default chatbot
            setWidgetType('chatbot');
          }
        })
        .catch(() => {
          // Even if draft fails, enter builder mode since ?editor=true
          setIsBuilderMode(true);
          setWidgetType('chatbot');
          setCanvasMode(true);
        });
    }
  }, [session, searchParams, isBuilderMode]);

  // Auto-save draft every 2 seconds when config changes (debounced)
  useEffect(() => {
    // Only auto-save when in builder mode, creating new component (not editing), and has valid session
    const accessToken = (session as any)?.access_token;
    if (!isBuilderMode || savedWidgetId || editingTemplate || !accessToken) {
      return;
    }

    const saveTimeout = setTimeout(async () => {
      // Prevent concurrent saves to avoid creating multiple drafts
      // Also skip if a real save is in progress or completed
      if (isSavingDraftRef.current || skipAutoSaveRef.current) {
        return;
      }
      isSavingDraftRef.current = true;
      setIsAutoSaving(true);

      try {
        // Build payload based on component type
        const payload: Record<string, any> = {
          widget_type: widgetType,
          webhook_url: defaultWebhookPath,
          styles: styles,
        };

        // Include draftId to update existing draft instead of creating new one
        if (currentDraftIdRef.current) {
          payload.draftId = currentDraftIdRef.current;
        }

        if (widgetType === 'chatbot') {
          payload.chatbot_config = { ...chatbotConfig, chatbotName: widgetName };
        } else if (widgetType === 'form') {
          payload.form_fields = formFields;
        }

        const res = await fetch('/api/widget-studio/draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          // If a new draft was created, save its ID for future updates
          if (data.draftId && !currentDraftIdRef.current) {
            currentDraftIdRef.current = data.draftId;
          }
          setLastAutoSave(new Date());
          setHasUnsavedChanges(false);
        } else {
          console.error('Auto-save failed:', await res.text());
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        isSavingDraftRef.current = false;
        setIsAutoSaving(false);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(saveTimeout);
  }, [chatbotConfig, widgetName, defaultWebhookPath, formFields, styles, isBuilderMode, widgetType, savedWidgetId, session, editingTemplate]);

  // Track unsaved changes (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isBuilderMode) {
      setHasUnsavedChanges(true);
    }
  }, [chatbotConfig, widgetName, defaultWebhookPath, formFields, styles]);

  // Fetch categories and instances
  const fetchCategories = useCallback(async (): Promise<Category[] | undefined> => {
    if (!session) return;
    try {
      const res = await fetch('/api/widget-studio/categories', {
        headers: { Authorization: `Bearer ${(session as any).access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const cats = data.categories || [];
        setCategories(cats);
        // Store instances without categories for the InfoPanel
        setInstancesWithoutCategory(data.instancesWithoutCategory || []);
        // Combine instances from categories and instancesWithoutCategory for the filter dropdown
        const allInstances: { id: string; instance_name: string }[] = [];
        // Get instances from categories
        cats.forEach((cat: Category) => {
          if (cat.instance) {
            allInstances.push({ id: cat.instance.id, instance_name: cat.instance.instance_name });
          }
        });
        // Add instances without categories
        (data.instancesWithoutCategory || []).forEach((inst: { id: string; instance_name: string }) => {
          if (!allInstances.some(i => i.id === inst.id)) {
            allInstances.push(inst);
          }
        });
        setInstances(allInstances);
        return cats;
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, [session]);

  // Fetch templates
  const fetchTemplates = useCallback(async (): Promise<Template[] | undefined> => {
    if (!session) return;
    try {
      const res = await fetch('/api/widget-studio/templates', {
        headers: { Authorization: `Bearer ${(session as any).access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const temps = data.templates || [];
        setTemplates(temps);
        return temps;
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      // Check cache first for instant load
      const cached = getUIStudioCache();
      if (cached) {
        setTemplates(cached.templates);
        setCategories(cached.categories);
        setIsLoading(false);
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Fetch fresh data (in background if cached)
      Promise.all([fetchCategories(), fetchTemplates()]).then(([cats, temps]) => {
        // Update cache with fresh data
        if (cats && temps) {
          setUIStudioCache(temps, cats);
        }
      }).finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [session, fetchCategories, fetchTemplates]);

  // load component from URL parameter
  useEffect(() => {
    // Skip if we're intentionally exiting (race condition with useSearchParams)
    if (isExitingRef.current) return;

    const loadWidgetFromUrl = async () => {
      if (!widgetIdFromUrl || !session || loadedWidgetId === widgetIdFromUrl) return;

      try {
        // Fetch widget via API with proper authorization
        const res = await fetch(`/api/widget-studio/templates/${widgetIdFromUrl}`, {
          headers: { Authorization: `Bearer ${(session as any).access_token}` },
        });

        if (!res.ok) {
          console.error('Widget not found or access denied:', res.status);
          return;
        }

        const data = await res.json();
        const widget = data.widget;

        if (!widget) {
          console.error('Widget not found in response');
          return;
        }

        // Enter builder mode with the component data
        setLoadedWidgetId(widgetIdFromUrl);
        setWidgetName(widget.name || '');
        setWidgetDescription(widget.description || '');
        setWidgetType(widget.widget_type || 'chatbot');
        setFormFields(widget.form_fields || []);
        setChatbotConfig({ ...DEFAULT_CHATBOT_CONFIG, ...(widget.chatbot_config || {}) });
        setStyles({ ...DEFAULT_STYLES, ...(widget.styles || {}) });
        setDefaultWebhookPath(widget.webhook_url || '');
        setSelectedInstanceIds(widget.instance_id ? [widget.instance_id] : []);
        setIsActive(widget.is_active ?? false);
        // Set editingTemplate so save uses PUT instead of POST
        setEditingTemplate(widget as Template);
        setSavedWidgetId(widget.id);
        setSelectedCategoryFilter(null);
        setIsBuilderMode(true);
        setCanvasMode(true);

        // Handle element selection from URL param (e.g., ?widget=123&element=bubble)
        const elementToSelect = searchParams.get('element');
        if (elementToSelect) {
          setInitialSelectedElement(elementToSelect as SelectedElement);
        }
      } catch (err) {
        console.error('Failed to load component:', err);
      }
    };

    loadWidgetFromUrl();
  }, [widgetIdFromUrl, session, loadedWidgetId, searchParams]);

  // Reset builder form
  const resetBuilder = () => {
    setWidgetName('');
    setWidgetDescription('');
    setDefaultWebhookPath('');
    setWidgetType('chatbot');
    setFormFields([{ name: 'Name', type: 'text', required: true, placeholder: 'Enter your name' }]);
    setSelectedFieldIndex(null);
    setStyles(DEFAULT_STYLES);
    setChatbotConfig(DEFAULT_CHATBOT_CONFIG);
    setSelectedInstanceIds([]);
    setIsActive(false); // new components start in draft mode
    setBuilderTab('content');
    // Reset auto-save state for new component sessions
    setLastAutoSave(null);
    setIsAutoSaving(false);
  };

  // Enter builder mode
  const enterBuilderMode = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setWidgetName(template.name);
      setWidgetDescription(template.description || '');
      setDefaultWebhookPath(template.webhook_url || '');
      setWidgetType(template.widget_type);
      setFormFields(template.form_fields || []);
      setStyles({ ...DEFAULT_STYLES, ...(template.styles || {}) });
      setChatbotConfig({ ...DEFAULT_CHATBOT_CONFIG, ...(template.chatbot_config || {}) });
      setSelectedInstanceIds(template.instance_id ? [template.instance_id] : []);
      setIsActive(template.is_active ?? false);
      setSavedWidgetId(template.id); // Set saved widget ID - share buttons will show automatically
    } else {
      setEditingTemplate(null);
      setSavedWidgetId(null);
      resetBuilder();
    }
    setIsBuilderMode(true);

    // Update URL to persist editor state
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('editor', 'true');
      if (template?.id) {
        url.searchParams.set('widget', template.id);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Exit builder mode
  const exitBuilderMode = () => {
    // Set flag to prevent race condition with useSearchParams not updating synchronously
    isExitingRef.current = true;

    setIsBuilderMode(false);
    setEditingTemplate(null);
    setLoadedWidgetId(null); // Reset so the same widget can be re-opened
    currentDraftIdRef.current = null; // Reset draft ID so next session starts fresh
    isSavingDraftRef.current = false; // Reset saving lock
    skipAutoSaveRef.current = false; // Reset skip flag for next session
    resetBuilder();

    // Navigate back to the main listing
    if (!embedded) {
      router.replace('/portal/ui-studio');
    } else {
      // Clear URL params when exiting editor in embedded mode
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('editor');
        url.searchParams.delete('widget');
        window.history.replaceState({}, '', url.toString());
      }
    }

    // Clear the exiting flag after searchParams has time to sync
    setTimeout(() => {
      isExitingRef.current = false;
    }, 100);
  };

  // Add field (max 20 fields)
  const MAX_FIELDS = 20;
  const addField = (type: FormField['type']) => {
    if (formFields.length >= MAX_FIELDS) {
      setSaveError(`Maximum ${MAX_FIELDS} fields allowed`);
      return;
    }
    const newField: FormField = {
      name: type.charAt(0).toUpperCase() + type.slice(1) + ' Field',
      type,
      required: false,
      placeholder: '',
      options: type === 'select' || type === 'radio' ? ['Option 1', 'Option 2'] : undefined,
    };
    setFormFields([...formFields, newField]);
    setSelectedFieldIndex(formFields.length);
    setSaveError(null);
  };

  // Update field
  const updateField = (index: number, updates: Partial<FormField>) => {
    const updated = [...formFields];
    updated[index] = { ...updated[index], ...updates };
    setFormFields(updated);
  };

  // Remove field
  const removeField = (index: number) => {
    setFormFields(formFields.filter((_, i) => i !== index));
    if (selectedFieldIndex === index) {
      setSelectedFieldIndex(null);
    } else if (selectedFieldIndex !== null && selectedFieldIndex > index) {
      setSelectedFieldIndex(selectedFieldIndex - 1);
    }
  };

  // Handle drag start
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFields = [...formFields];
    const draggedField = newFields[draggedIndex];
    newFields.splice(draggedIndex, 1);
    newFields.splice(index, 0, draggedField);
    setFormFields(newFields);
    setDraggedIndex(index);
    if (selectedFieldIndex === draggedIndex) {
      setSelectedFieldIndex(index);
    }
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Generate embed code
  const generateEmbedCode = () => {
    const widgetId = 'widget-' + Date.now(); // In production, this would be the saved widget ID
    const baseUrl = originUrl;

    if (widgetType === 'chatbot') {
      const config = JSON.stringify(chatbotConfig, null, 2);
      return `<!-- FlowEngine Chatbot Component -->
<div id="${widgetId}"></div>
<script>
  (function() {
    const config = ${config};
    const script = document.createElement('script');
    script.src = '${baseUrl}/widgets/chatbot.js';
    script.async = true;
    script.onload = function() {
      FlowEngineChatbot.init('${widgetId}', config);
    };
    document.head.appendChild(script);
  })();
</script>`;
    } else if (widgetType === 'form') {
      const fields = JSON.stringify(formFields, null, 2);
      const widgetStyles = JSON.stringify(styles, null, 2);
      return `<!-- FlowEngine Form Component -->
<div id="${widgetId}"></div>
<script>
  (function() {
    const fields = ${fields};
    const styles = ${widgetStyles};
    const script = document.createElement('script');
    script.src = '${baseUrl}/widgets/form.js';
    script.async = true;
    script.onload = function() {
      FlowEngineForm.init('${widgetId}', { fields, styles });
    };
    document.head.appendChild(script);
  })();
</script>`;
    } else if (widgetType === 'button') {
      const config = JSON.stringify(styles, null, 2);
      return `<!-- FlowEngine Button Component -->
<div id="${widgetId}"></div>
<script>
  (function() {
    const config = ${config};
    const script = document.createElement('script');
    script.src = '${baseUrl}/widgets/button.js';
    script.async = true;
    script.onload = function() {
      FlowEngineButton.init('${widgetId}', config);
    };
    document.head.appendChild(script);
  })();
</script>`;
    }
    return '';
  };

  const handleCopyEmbedCode = async () => {
    const code = generateEmbedCode();
    try {
      await navigator.clipboard.writeText(code);
      setEmbedCodeCopied(true);
      setTimeout(() => setEmbedCodeCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
    }
  };

  // Reset handlers for sections
  const resetChatbotGradients = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChatbotConfig({
      ...chatbotConfig,
      bubbleGradient: '',
      headerGradient: '',
      chatBackgroundGradient: '',
      userMessageGradient: '',
      botMessageGradient: '',
    });
  };

  const resetChatbotEffects = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChatbotConfig({
      ...chatbotConfig,
      bubbleGlow: false,
      bubbleGlowColor: DEFAULT_CHATBOT_CONFIG.bubbleGlowColor,
      userMessageGlow: false,
      userMessageGlowColor: DEFAULT_CHATBOT_CONFIG.userMessageGlowColor,
      botMessageGlow: false,
      botMessageGlowColor: DEFAULT_CHATBOT_CONFIG.botMessageGlowColor,
      glassEffect: false,
      backdropBlur: DEFAULT_CHATBOT_CONFIG.backdropBlur,
      chatBackgroundPattern: 'none',
      bubbleAnimation: 'none',
      borderWidth: DEFAULT_CHATBOT_CONFIG.borderWidth,
      boxShadow: DEFAULT_CHATBOT_CONFIG.boxShadow,
      userMessageShadow: 'none',
      botMessageShadow: 'none',
    });
  };

  const resetChatbotTypography = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChatbotConfig({
      ...chatbotConfig,
      fontFamily: DEFAULT_CHATBOT_CONFIG.fontFamily,
      fontSize: DEFAULT_CHATBOT_CONFIG.fontSize,
      fontWeight: DEFAULT_CHATBOT_CONFIG.fontWeight,
      lineHeight: DEFAULT_CHATBOT_CONFIG.lineHeight,
      letterSpacing: DEFAULT_CHATBOT_CONFIG.letterSpacing,
      textTransform: DEFAULT_CHATBOT_CONFIG.textTransform,
      textAlign: DEFAULT_CHATBOT_CONFIG.textAlign,
      direction: DEFAULT_CHATBOT_CONFIG.direction,
    });
  };

  const resetButtonStyles = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStyles({
      ...styles,
      primaryColor: DEFAULT_STYLES.primaryColor,
      buttonTextColor: DEFAULT_STYLES.buttonTextColor,
      buttonText: DEFAULT_STYLES.buttonText,
      buttonFontSize: DEFAULT_STYLES.buttonFontSize,
      buttonFontWeight: DEFAULT_STYLES.buttonFontWeight,
      buttonPadding: DEFAULT_STYLES.buttonPadding,
      buttonWidth: DEFAULT_STYLES.buttonWidth,
      buttonHoverColor: DEFAULT_STYLES.buttonHoverColor,
      buttonShadow: DEFAULT_STYLES.buttonShadow,
    });
  };

  const resetFormStyles = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStyles({
      ...styles,
      inputBackgroundColor: DEFAULT_STYLES.inputBackgroundColor,
      inputBorderColor: DEFAULT_STYLES.inputBorderColor,
      inputBorderWidth: DEFAULT_STYLES.inputBorderWidth,
      textColor: DEFAULT_STYLES.textColor,
      inputFontSize: DEFAULT_STYLES.inputFontSize,
      inputPadding: DEFAULT_STYLES.inputPadding,
      placeholderColor: DEFAULT_STYLES.placeholderColor,
      inputFocusBorderColor: DEFAULT_STYLES.inputFocusBorderColor,
      inputFocusShadow: DEFAULT_STYLES.inputFocusShadow,
    });
  };

  // AI Assistant handler
  const handleAiAssistantSubmit = async () => {
    // When canvas mode is active, UnifiedCanvasEditor's AIPanel handles AI interactions
    // Skip this handler to prevent duplicate processing
    if (canvasMode) {
      return;
    }
    if (!aiInput.trim() || aiIsLoading) return;

    const userMessage = aiInput.trim();
    setAiInput('');
    setAiIsLoading(true);
    setAiError(null);

    // Add user message immediately
    const newMessages = [...aiChatMessages, { role: 'user' as const, content: userMessage }];
    setAiChatMessages(newMessages);

    // Detect component type from user message and auto-switch if needed
    // Order matters: check most specific (button) first, then form, then chatbot (catch-all)
    const lowerMessage = userMessage.toLowerCase();
    let detectedType: 'button' | 'form' | 'chatbot' | null = null;

    // 1. Button detection (most specific - check first)
    if (lowerMessage.includes('button') || lowerMessage.includes('cta') || lowerMessage.includes('call to action')) {
      detectedType = 'button';
    }
    // 2. Form detection
    else if (lowerMessage.includes('form') || lowerMessage.includes('contact form') ||
             lowerMessage.includes('signup') || lowerMessage.includes('input field') ||
             (lowerMessage.includes('field') && !lowerMessage.includes('button'))) {
      detectedType = 'form';
    }
    // 3. Chatbot detection (catch-all, but exclude if button/form mentioned)
    else if (lowerMessage.includes('chatbot') || lowerMessage.includes('chat bot') ||
             lowerMessage.includes('chatbot component') || lowerMessage.includes('conversational') ||
             (lowerMessage.includes('chat') && !lowerMessage.includes('button') && !lowerMessage.includes('form') &&
              (lowerMessage.includes('build') || lowerMessage.includes('create') || lowerMessage.includes('make')))) {
      detectedType = 'chatbot';
    }

    // Auto-switch component type if different from current
    if (detectedType && detectedType !== widgetType) {
      setWidgetType(detectedType);
    }

    // Use detected type or current type for context
    const activeWidgetType = detectedType || widgetType;

    try {
      // Build widget context
      const widgetContext = {
        type: activeWidgetType,
        ...(activeWidgetType === 'form' && { fields: formFields }),
        ...(activeWidgetType === 'chatbot' && { chatbotConfig }),
        ...(activeWidgetType === 'button' && { buttonConfig: { text: styles.buttonText, primaryColor: styles.primaryColor } }),
      };

      const response = await fetch('/api/widget-studio/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          widgetContext,
          conversationHistory: aiChatMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get AI response');
      }

      // Handle streaming response with auto-apply
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let appliedUpdate = false;

      // Add empty assistant message that we'll update
      setAiChatMessages([...newMessages, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';

              if (delta) {
                assistantMessage += delta;

                // Check for complete widget update blocks and apply them
                const updateMatch = assistantMessage.match(/<WIDGET_UPDATE>\s*(\{[\s\S]*?\})\s*<\/WIDGET_UPDATE>/);
                if (updateMatch && !appliedUpdate) {
                  try {
                    const widgetUpdate = JSON.parse(updateMatch[1]);

                    // Validate and apply updates with type checking
                    // Use activeWidgetType (computed from detectedType) to avoid race condition with setState
                    // Check both 'fields' and 'formFields' for compatibility
                    const formFieldsUpdate = widgetUpdate.formFields || widgetUpdate.fields;
                    if (formFieldsUpdate && Array.isArray(formFieldsUpdate) && activeWidgetType === 'form') {
                      // Validate each field has required properties
                      const validFields = formFieldsUpdate.filter((f: any) =>
                        f.name && f.type && typeof f.name === 'string'
                      );
                      if (validFields.length > 0) {
                        setFormFields(validFields);
                      }
                    }

                    if (widgetUpdate.styles && typeof widgetUpdate.styles === 'object') {
                      // Only update valid style properties
                      setStyles(prev => ({ ...prev, ...widgetUpdate.styles }));
                    }

                    if (widgetUpdate.chatbotConfig && typeof widgetUpdate.chatbotConfig === 'object' && activeWidgetType === 'chatbot') {
                      setChatbotConfig(prev => ({ ...prev, ...widgetUpdate.chatbotConfig }));
                    }

                    appliedUpdate = true;
                    setAiChangeApplied(true);
                    setTimeout(() => setAiChangeApplied(false), 3000);
                  } catch (e) {
                    console.error('[AI-ASSISTANT] Failed to parse component update:', e);
                    // Don't set appliedUpdate = true on error, allow retry
                  }
                }

                // Update the message, removing the update block from display
                setAiChatMessages(prev => {
                  const updated = [...prev];
                  const cleanMessage = assistantMessage.replace(/<WIDGET_UPDATE>[\s\S]*?<\/WIDGET_UPDATE>/, '').trim();
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: cleanMessage || assistantMessage
                  };
                  return updated;
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      setAiError(error instanceof Error ? error.message : 'An error occurred');
      // Remove the empty assistant message on error
      setAiChatMessages(newMessages);
    } finally {
      setAiIsLoading(false);
    }
  };

  // Save template
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveTemplate = async () => {
    if (!session) {
      setSaveError('Please sign in to save UI embeds');
      return;
    }

    // Immediately flag to skip auto-save to prevent race conditions
    skipAutoSaveRef.current = true;

    // Validate component name
    if (!widgetName.trim()) {
      setSaveError('Component name is required');
      skipAutoSaveRef.current = false; // Resume auto-save on validation error
      return;
    }

    // Validate form fields for form type
    if (widgetType === 'form') {
      if (formFields.length === 0) {
        setSaveError('Form components require at least one field');
        skipAutoSaveRef.current = false; // Resume auto-save on validation error
        return;
      }
      // Validate each field has a name
      const emptyNameField = formFields.find(f => !f.name.trim());
      if (emptyNameField) {
        setSaveError('All fields must have a label');
        skipAutoSaveRef.current = false; // Resume auto-save on validation error
        return;
      }
      // Validate select/radio fields have at least one option
      const emptyOptionsField = formFields.find(
        f => (f.type === 'select' || f.type === 'radio') && (!f.options || f.options.filter(o => o.trim()).length === 0)
      );
      if (emptyOptionsField) {
        setSaveError('Dropdown and radio fields must have at least one option');
        skipAutoSaveRef.current = false; // Resume auto-save on validation error
        return;
      }
    }

    // Validate button text (only for form/button components, not chatbots)
    if (widgetType !== 'chatbot' && (!styles.buttonText || !styles.buttonText.trim())) {
      setSaveError('Button text cannot be empty');
      skipAutoSaveRef.current = false; // Resume auto-save on validation error
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      // If we have an existing draft, convert it to a component by updating it
      // This prevents duplicate components (draft + saved widget)
      const targetId = editingTemplate?.id || currentDraftIdRef.current;
      const url = targetId
        ? `/api/widget-studio/templates/${targetId}`
        : '/api/widget-studio/templates';
      const method = targetId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(session as any).access_token}`,
        },
        body: JSON.stringify({
          name: widgetName.trim(),
          widget_type: widgetType,
          form_fields: widgetType === 'form' ? formFields : null,
          chatbot_config: widgetType === 'chatbot' ? chatbotConfig : null,
          instance_id: selectedInstanceIds[0] || null,
          webhook_url: defaultWebhookPath.trim(),
          styles,
          is_active: isActive, // Respect user's active/draft choice
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchTemplates();
        // Set the saved widget ID - share buttons will show automatically
        const savedId = data.template?.id || data.id || targetId || null;
        setSavedWidgetId(savedId);
        setHasUnsavedChanges(false);

        // Sync the saved component config to localStorage for Chat page
        if (widgetType === 'chatbot' && chatbotConfig) {
          try {
            localStorage.setItem('flowengine_widget_draft', JSON.stringify({ ...chatbotConfig, chatbotName: widgetName }));
            console.log('[UI Studio] Updated localStorage draft with saved chatbot config');
          } catch (e) {
            console.warn('[UI Studio] Failed to update localStorage draft:', e);
          }
        }

        // Clear the draft ID since widget is now saved - no more draft syncing needed
        currentDraftIdRef.current = null;
        isSavingDraftRef.current = false;
      } else {
        const data = await res.json();
        console.error('[UI Studio] Save failed:', data);

        // If limit error, show upgrade modal and revert toggle
        if (res.status === 403 && data.error?.toLowerCase().includes('limit')) {
          setIsActive(false);
          setShowUpgradeModal(true);
        } else {
          setSaveError(data.error || 'Failed to save component');
        }
      }
    } catch {
      setSaveError('Failed to save component. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Clear save error
  const handleClearError = () => {
    setSaveError(null);
    setShowUpgradeModal(false);
  };

  // Handle active toggle with auto-save
  const handleActiveToggle = async (newActive: boolean) => {
    setIsActive(newActive);
    // Auto-save when toggling Live/Draft
    // Use setTimeout to ensure state is updated before save
    setTimeout(() => {
      handleSaveTemplateWithActive(newActive);
    }, 0);
  };

  // Save template with specific active state (for auto-save on toggle)
  const handleSaveTemplateWithActive = async (activeState: boolean) => {
    if (!session || isSaving) return;
    setSaveError(null);
    setIsSaving(true);

    try {
      const targetId = editingTemplate?.id || currentDraftIdRef.current;
      const url = targetId
        ? `/api/widget-studio/templates/${targetId}`
        : '/api/widget-studio/templates';
      const method = targetId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(session as any).access_token}`,
        },
        body: JSON.stringify({
          name: widgetName.trim() || 'Untitled Component',
          widget_type: widgetType,
          form_fields: widgetType === 'form' ? formFields : null,
          chatbot_config: widgetType === 'chatbot' ? chatbotConfig : null,
          instance_id: selectedInstanceIds[0] || null,
          webhook_url: defaultWebhookPath.trim(),
          styles,
          is_active: activeState,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const savedId = data.template?.id || data.id || targetId || null;
        setSavedWidgetId(savedId);
        setHasUnsavedChanges(false);
        await fetchTemplates();
      } else {
        const data = await res.json();
        console.error('[UI Studio] Save failed:', data);

        // If limit error, show upgrade modal and revert toggle
        if (res.status === 403 && data.error?.toLowerCase().includes('limit')) {
          setIsActive(false);
          setShowUpgradeModal(true);
        } else {
          setSaveError(data.error || 'Failed to save component');
        }
      }
    } catch {
      setSaveError('Failed to save component. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Create category
  const handleCreateCategory = async () => {
    if (!session || !newCategoryName.trim()) return;
    try {
      const res = await fetch('/api/widget-studio/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(session as any).access_token}`,
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          color: newCategoryColor,
        }),
      });
      if (res.ok) {
        setNewCategoryName('');
        setNewCategoryColor(COLORS[(categories.length + 1) % COLORS.length]);
        setShowCategoryModal(false);
        await fetchCategories();
      }
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (id: string) => {
    if (!session || isDeleting) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/widget-studio/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${(session as any).access_token}` },
      });
      if (res.ok) {
        setDeleteConfirm(null);
        await fetchTemplates();
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete');
      }
    } catch {
      setDeleteError('Failed to delete. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete all drafts
  const handleDeleteAllDrafts = async () => {
    if (!session || isDeletingAllDrafts) return;
    setIsDeletingAllDrafts(true);
    try {
      const res = await fetch('/api/widget-studio/draft?all=true', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${(session as any).access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`Deleted ${data.deleted} drafts`);
        setDeleteAllDraftsConfirm(false);
        currentDraftIdRef.current = null; // Reset so next save creates a fresh draft
        isSavingDraftRef.current = false; // Reset saving lock
        skipAutoSaveRef.current = false; // Reset skip flag
        // Refresh the templates list to reflect deleted drafts
        await fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to delete drafts:', err);
    } finally {
      setIsDeletingAllDrafts(false);
    }
  };

  // Toggle template selection
  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all visible templates
  const selectAllTemplates = () => {
    // Filter templates inline since filteredTemplates is defined later
    const filtered = templates.filter((t) => {
      const matchesSearch = !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesInstance = !selectedInstanceFilter ||
        t.instance_id === selectedInstanceFilter;
      return matchesSearch && matchesInstance;
    });
    const allIds = new Set(filtered.map((t) => t.id));
    setSelectedTemplateIds(allIds);
  };

  // Clear all selections and exit select mode
  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedTemplateIds(new Set());
  };

  // Bulk delete selected templates
  const handleBulkDelete = async () => {
    if (!session || selectedTemplateIds.size === 0) return;
    setIsBulkDeleting(true);
    setDeleteError(null);
    try {
      const deletePromises = Array.from(selectedTemplateIds).map((id) =>
        fetch(`/api/widget-studio/templates/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${(session as any).access_token}` },
        })
      );
      await Promise.all(deletePromises);
      await fetchTemplates();
      setShowBulkDeleteConfirm(false);
      exitSelectMode();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      setDeleteError('Failed to delete some templates');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Toggle bulk tag selection
  const toggleBulkTagSelection = (instanceId: string) => {
    setBulkTagsInstanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) {
        next.delete(instanceId);
      } else {
        next.add(instanceId);
      }
      return next;
    });
  };

  // Bulk update tags (instance_id) for selected templates
  const handleBulkUpdateTags = async () => {
    if (!session || selectedTemplateIds.size === 0 || bulkTagsInstanceIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      // Get selected instance IDs as array
      const selectedInstances = Array.from(bulkTagsInstanceIds);
      const templateIds = Array.from(selectedTemplateIds);

      const updatePromises = templateIds.map((id, index) => {
        const template = templates.find((t) => t.id === id);
        if (!template) return Promise.resolve();
        // Distribute templates among selected instances (round-robin)
        const instanceId = selectedInstances[index % selectedInstances.length];
        return fetch(`/api/widget-studio/templates/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(session as any).access_token}`,
          },
          body: JSON.stringify({
            name: template.name,
            widget_type: template.widget_type,
            form_fields: template.form_fields,
            webhook_url: template.webhook_url,
            instance_id: instanceId,
            chatbot_config: template.chatbot_config,
            styles: template.styles,
            is_active: template.is_active,
          }),
        });
      });
      await Promise.all(updatePromises);
      await fetchTemplates();
      setShowBulkTagsModal(false);
      setBulkTagsInstanceIds(new Set());
      exitSelectMode();
    } catch (err) {
      console.error('Failed to bulk update tags:', err);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Duplicate template
  const handleDuplicateTemplate = async (id: string) => {
    if (!session) return;
    setActiveMenu(null);
    try {
      const res = await fetch(`/api/widget-studio/templates/${id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${(session as any).access_token}` },
      });
      if (res.ok) {
        await fetchTemplates();
      }
    } catch {
      console.error('Failed to duplicate template');
    }
  };

  // copy component link
  const handleCopyWidgetLink = async (id: string, canHideWatermark: boolean) => {
    const baseUrl = originUrl || 'https://flowengine.cloud';
    const watermarkParam = canHideWatermark ? '?wm=0' : '';
    const widgetUrl = `${baseUrl}/w/${id}${watermarkParam}`;

    try {
      await navigator.clipboard.writeText(widgetUrl);
      setLinkCopied(id);
      setTimeout(() => setLinkCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Handle component type change with warning
  const handleTypeChange = (newType: 'button' | 'form' | 'chatbot') => {
    if (widgetType === 'form' && newType !== 'form' && formFields.length > 0) {
      if (!confirm('Switching component type will remove all form fields. Continue?')) {
        return;
      }
      setFormFields([]);
      setSelectedFieldIndex(null);
    }
    if (widgetType === 'chatbot' && newType !== 'chatbot') {
      if (!confirm('Switching from chatbot will remove chatbot configuration. Continue?')) {
        return;
      }
    }
    setWidgetType(newType);
  };

  // Filter templates by instance and search
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase());
    // Filter by instance directly (templates now have instance_id)
    const matchesInstance = !selectedInstanceFilter ||
      t.instance_id === selectedInstanceFilter;
    return matchesSearch && matchesInstance;
  });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [activeMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S: Save widget
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveTemplate();
      }

      // Cmd/Ctrl + K: Copy embed code
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleCopyEmbedCode();
      }

      // Only allow tab shortcuts when not in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Number keys 1-3: Switch component type
      if (e.key === '1') {
        e.preventDefault();
        setWidgetType('form');
      } else if (e.key === '2') {
        e.preventDefault();
        setWidgetType('button');
      } else if (e.key === '3') {
        e.preventDefault();
        setWidgetType('chatbot');
      }

      // C: Content tab, O: Colors tab, D: Design tab
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setBuilderTab('content');
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setBuilderTab('colors');
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setBuilderTab('design');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [builderTab]);

  // AI Assistant loading phases animation
  useEffect(() => {
    if (aiIsLoading) {
      setAiLoadingPhase(0);
      const interval = setInterval(() => {
        setAiLoadingPhase((prev) => {
          if (prev >= AI_LOADING_PHASES.length - 1) return AI_LOADING_PHASES.length - 1;
          return prev + 1;
        });
      }, 1000); // Change phase every second
      return () => clearInterval(interval);
    } else {
      setAiLoadingPhase(0);
    }
  }, [aiIsLoading]);

  if (authLoading) {
    if (embedded) {
      return (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="h-8 w-48 bg-gray-800/30 rounded animate-pulse" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-800/30 rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="h-64 bg-gray-800/30 rounded-lg animate-pulse" />
          </div>
        </div>
      );
    }
    // Editor mode: show a canvas-like skeleton matching the builder layout
    if (searchParams.get('editor') === 'true') {
      return (
        <div className="fixed inset-0 bg-black flex">
          {/* Left toolbar skeleton */}
          <div className="w-[280px] border-r border-gray-800 flex flex-col">
            <div className="h-14 border-b border-gray-800 px-4 flex items-center gap-3">
              <div className="h-8 w-8 bg-gray-800/30 rounded-lg animate-pulse" />
              <div className="h-5 w-32 bg-gray-800/30 rounded animate-pulse" />
            </div>
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-gray-900/50 border border-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-[400px] h-[500px] bg-gray-900/50 border border-gray-800 rounded-xl animate-pulse" />
          </div>
          {/* Right panel skeleton */}
          <div className="w-[300px] border-l border-gray-800 p-4 space-y-4">
            <div className="h-5 w-20 bg-gray-800/30 rounded animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-16 bg-gray-800/30 rounded animate-pulse" />
                <div className="h-9 bg-gray-900/50 border border-gray-800 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    return <UIStudioSkeleton />;
  }

  // Auth guard - redirect to login if not authenticated
  if (!session || !user) {
    if (embedded) return null;
    return (
      <>
        <AuthModal
          isOpen={true}
          onClose={() => {}}
          closeable={false}
          redirectTo="/portal/ui-studio/editor"
        />
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="max-w-md mx-auto px-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Login Required</h2>
              <p className="text-gray-400">
                You need to be logged in to access the UI Studio.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Handler for creating new component - checks template limits
  const handleCreateWidget = () => {
    if (!canCreateMore) {
      setShowUpgradeModal(true);
      return;
    }
    enterBuilderMode();
  };

  // Builder Mode - Unified Canvas Editor
  if (isBuilderMode) {
    return (
      <>
        <UnifiedCanvasEditor
          widgetType={widgetType}
          widgetName={widgetName}
          widgetDescription={widgetDescription}
          defaultWebhookPath={defaultWebhookPath}
          selectedInstanceIds={selectedInstanceIds}
          formFields={formFields}
          styles={styles}
          chatbotConfig={chatbotConfig}
          onWidgetTypeChange={setWidgetType}
          onWidgetNameChange={setWidgetName}
          onWidgetDescriptionChange={setWidgetDescription}
          onWebhookPathChange={setDefaultWebhookPath}
          onInstanceIdsChange={setSelectedInstanceIds}
          onFormFieldsChange={setFormFields}
          onStylesChange={setStyles}
          onChatbotConfigChange={setChatbotConfig}
          onSave={handleSaveTemplate}
          onExit={exitBuilderMode}
          isSaving={isSaving}
          saveError={saveError}
          onClearError={handleClearError}
          savedWidgetId={savedWidgetId}
          isActive={isActive}
          onActiveChange={handleActiveToggle}
          categories={categories}
          instancesWithoutCategory={instancesWithoutCategory}
          initialSelectedElement={initialSelectedElement}
          hasUnsavedChanges={hasUnsavedChanges}
          onDeleteAllDrafts={handleDeleteAllDrafts}
          isDeletingAllDrafts={isDeletingAllDrafts}
          canHideWatermark={isProPlus}
        />

        {/* Upgrade Modal for widget limit */}
        {showUpgradeModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowUpgradeModal(false)}
          >
            <div
              className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-900/20 border border-red-800 flex items-center justify-center">
                  <Layers className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Active Component Limit Reached</h3>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  {isPro && !isProPlus
                    ? `You can only have 5 active (live) UI embeds on Pro. Upgrade to Max for unlimited active UI embeds.`
                    : `Free accounts can only have 1 active (live) UI embed. Upgrade to activate more.`}
                </p>
                <div className="text-xs text-gray-500 mb-6 space-y-1">
                  <p>Free: 1 active • Pro: 5 active • Max: Unlimited</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-800 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Maybe Later
                  </button>
                  <Link
                    href="/#pricing"
                    onClick={() => setShowUpgradeModal(false)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Upgrade
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // OLD BUILDER MODE (FALLBACK - TO BE REMOVED)
  // Keep this section temporarily for reference, will be deleted later
  if (false && isBuilderMode) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 pt-28 pb-16">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={exitBuilderMode}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">
                  {editingTemplate ? 'Edit Component' : 'New Component'}
                </h1>
                <p className="text-gray-400 text-sm">
                  {editingTemplate ? 'Make changes to your component template' : 'Create a new component template'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Delete All Drafts */}
              {deleteAllDraftsConfirm ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-800 rounded-lg">
                  <span className="text-sm text-red-400">Delete all drafts?</span>
                  <button
                    onClick={handleDeleteAllDrafts}
                    disabled={isDeletingAllDrafts}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
                  >
                    {isDeletingAllDrafts ? 'Deleting...' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setDeleteAllDraftsConfirm(false)}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteAllDraftsConfirm(true)}
                  className="p-2 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                  title="Delete all drafts"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={exitBuilderMode}
                className="px-4 py-2.5 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!widgetName.trim() || isSaving}
                className="px-6 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : savedWidgetId ? (editingTemplate ? 'Save Changes' : 'Save') : 'Save and Share'}
              </button>
            </div>
          </div>

          {/* Share Panel - Hidden (moved to under preview) */}
          {false && savedWidgetId && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden mb-8">
              <button
                onClick={() => setSharePanelExpanded(!sharePanelExpanded)}
                className="w-full px-8 py-5 flex items-center justify-between hover:bg-gray-800/30 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-900/20 border border-green-800 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-semibold text-white mb-0.5">Component Saved Successfully!</h3>
                    <p className="text-sm text-white/60">Share your component using the options below</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-all ${sharePanelExpanded ? '' : 'rotate-180'}`} />
              </button>

              {sharePanelExpanded && (
                <div className="px-8 pb-8 space-y-6 border-t border-gray-800 pt-6">
                  {/* Component Link */}
                  <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-5">
                    <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      Direct Link
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        readOnly
                        value={`${originUrl}/w/${savedWidgetId}`}
                        className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white text-sm focus:ring-2 focus:ring-white focus:border-white"
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <button
                        onClick={() => {
                          const url = `${originUrl}/w/${savedWidgetId}`;
                          navigator.clipboard.writeText(url);
                          setShareLinkCopied(true);
                          setTimeout(() => setShareLinkCopied(false), 2000);
                        }}
                        className="px-6 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        {shareLinkCopied ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy Link
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-white/60 mt-3">Share this link to let users access your component directly</p>
                  </div>

                  {/* HTML Embed Code */}
                  <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-5">
                    <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Code2 className="w-4 h-4" />
                      Embed Code
                    </label>
                    <div className="space-y-3">
                      <textarea
                        readOnly
                        value={generateEmbedCode()}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white text-xs font-mono resize-none focus:ring-2 focus:ring-white focus:border-white"
                        rows={5}
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <button
                        onClick={handleCopyEmbedCode}
                        className="w-full px-6 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        {embedCodeCopied ? 'Copied!' : 'Copy Embed Code'}
                      </button>
                    </div>
                    <p className="text-xs text-white/60 mt-3">Paste this code into your website to embed the component</p>
                  </div>

                  {/* QR Code */}
                  <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-5">
                    <label className="block text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <QrCode className="w-4 h-4" />
                      QR Code
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex justify-center">
                        <div className="w-40 h-40 bg-white rounded-lg p-2 shadow-lg">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${originUrl}/w/${savedWidgetId}`)}`}
                            alt="QR Code"
                            className="w-full h-full"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col justify-center gap-3">
                        <p className="text-sm text-white/60">
                          Scan this QR code with a mobile device to access your component instantly
                        </p>
                        <a
                          href={`https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(`${originUrl}/w/${savedWidgetId}`)}`}
                          download={`widget-${savedWidgetId}-qr.png`}
                          className="px-6 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <QrCode className="w-4 h-4" />
                          Download QR Code
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* component type Tabs */}
          <div className="flex gap-2 border-b border-gray-800 mb-6">
            <button
              onClick={() => setWidgetType('chatbot')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                widgetType === 'chatbot'
                  ? 'text-white border-white'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              <MessageCircle className="w-4 h-4 inline-block mr-2" />
              Chatbot
            </button>
            <button
              onClick={() => setWidgetType('form')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                widgetType === 'form'
                  ? 'text-white border-white'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 inline-block mr-2" />
              Form
            </button>
            <button
              onClick={() => setWidgetType('button')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                widgetType === 'button'
                  ? 'text-white border-white'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              <MousePointer className="w-4 h-4 inline-block mr-2" />
              Button
            </button>
          </div>

          {/* AI Full-Screen Modal */}
          {aiFullScreen && aiAssistantOpen && (
            <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm">
              <div className="h-full flex flex-col">
                {/* Top Bar */}
                <div className="bg-black border-b border-gray-800 px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 lg:gap-4">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-gray-900/50 border border-gray-800 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                    </div>
                    <h2 className="text-white font-medium text-sm lg:text-base">AI Builder</h2>
                    {aiChangeApplied && (
                      <span className="flex items-center gap-1 lg:gap-1.5 text-xs text-green-400 bg-green-900/20 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg border border-green-800/30">
                        <Check className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                        <span className="hidden sm:inline">Changes Applied</span>
                        <span className="sm:hidden">Applied</span>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setAiFullScreen(false)}
                    className="p-2.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  >
                    <Minimize2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Tab Switcher */}
                <div className="lg:hidden flex border-b border-gray-800">
                  <button
                    onClick={() => setMobileEditorTab('chat')}
                    className={cn(
                      "flex-1 py-3 text-sm font-medium transition-colors",
                      mobileEditorTab === 'chat'
                        ? "text-white border-b-2 border-white"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setMobileEditorTab('preview')}
                    className={cn(
                      "flex-1 py-3 text-sm font-medium transition-colors",
                      mobileEditorTab === 'preview'
                        ? "text-white border-b-2 border-white"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    Preview
                  </button>
                </div>

                {/* Main Content - Split View */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                  {/* Left Panel - AI Chat */}
                  <div className={cn(
                    "lg:w-1/2 border-r border-gray-800 flex flex-col bg-black",
                    mobileEditorTab === 'chat' ? "flex-1" : "hidden lg:flex"
                  )}>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 lg:p-8">
                      {aiChatMessages.length === 0 ? (
                        <div className="text-center py-20">
                          <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-gray-900/50 border border-gray-800 flex items-center justify-center">
                            <Sparkles className="w-10 h-10 text-gray-400" />
                          </div>
                          <h3 className="text-xl font-medium text-white mb-3">Start Building</h3>
                          <p className="text-gray-400 mb-8">Tell me what component you want to create</p>
                          <div className="max-w-md mx-auto space-y-3">
                            <p className="text-xs text-gray-500 text-left mb-2">Example prompts:</p>
                            <button
                              onClick={() => setAiInput('"Create a contact form with name, email, and message fields"')}
                              className="w-full text-left px-5 py-4 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-gray-300 hover:border-gray-700 hover:bg-gray-800/30 transition-colors"
                            >
                              "Create a contact form with name, email, and message fields"
                            </button>
                            <button
                              onClick={() => setAiInput('"Make the button background blue with rounded corners"')}
                              className="w-full text-left px-5 py-4 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-gray-300 hover:border-gray-700 hover:bg-gray-800/30 transition-colors"
                            >
                              "Make the button background blue with rounded corners"
                            </button>
                            <button
                              onClick={() => setAiInput('"Change chatbot welcome message and bubble color"')}
                              className="w-full text-left px-5 py-4 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-gray-300 hover:border-gray-700 hover:bg-gray-800/30 transition-colors"
                            >
                              "Change chatbot welcome message and bubble color"
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {aiChatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex gap-4",
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                              )}
                            >
                              {msg.role === 'assistant' && (
                                <div className="w-10 h-10 rounded-lg bg-gray-900/50 border border-gray-800 flex items-center justify-center flex-shrink-0">
                                  <Sparkles className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div
                                className={cn(
                                  "px-5 py-4 rounded-lg max-w-[75%]",
                                  msg.role === 'user'
                                    ? 'bg-white text-black'
                                    : 'bg-gray-900/50 border border-gray-800 text-gray-200'
                                )}
                              >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.content || (msg.role === 'assistant' && (
                                    <span className="text-gray-500 italic">{AI_LOADING_PHASES[aiLoadingPhase]}</span>
                                  ))}
                                </p>
                              </div>
                              {msg.role === 'user' && (
                                <div className="w-10 h-10 rounded-lg bg-white/10 border border-gray-700 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-xs font-medium">You</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Error */}
                    {aiError && (
                      <div className="mx-8 mb-6 px-5 py-4 bg-red-900/20 border border-red-800 rounded-lg">
                        <p className="text-red-400 text-sm">{aiError}</p>
                      </div>
                    )}

                    {/* Input Area */}
                    <div className="border-t border-gray-800 bg-black p-4 lg:p-8">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAiAssistantSubmit()}
                          placeholder="Describe what you want to build..."
                          disabled={aiIsLoading}
                          className="flex-1 px-5 py-4 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white disabled:opacity-50"
                        />
                        <button
                          onClick={handleAiAssistantSubmit}
                          disabled={aiIsLoading || !aiInput.trim()}
                          className="px-6 py-4 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                          {aiIsLoading ? (
                            <>
                              <RotateCcw className="w-5 h-5 animate-spin" />
                              <span>Thinking...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5" />
                              <span>Send</span>
                            </>
                          )}
                        </button>
                      </div>

                      {aiChatMessages.length > 0 && (
                        <div className="flex items-center justify-between mt-5 pt-5 border-t border-gray-800">
                          <span className="text-xs text-gray-500">
                            {aiChatMessages.length} message{aiChatMessages.length !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => {
                              setAiChatMessages([]);
                              setAiError(null);
                              setAiChangeApplied(false);
                            }}
                            className="text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            Clear conversation
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Panel - Live Preview */}
                  <div className={cn(
                    "lg:w-1/2 flex flex-col bg-black",
                    mobileEditorTab === 'preview' ? "flex-1" : "hidden lg:flex"
                  )}>
                    <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 border-b border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">Live Preview</span>
                        <span className="text-xs text-gray-500 bg-gray-900/50 border border-gray-800 px-2 py-1 rounded hidden sm:inline">{widgetType}</span>
                      </div>
                      <button
                        onClick={() => setPreviewBg(previewBg === 'dark' ? 'light' : 'dark')}
                        className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                        title={`Switch to ${previewBg === 'dark' ? 'light' : 'dark'} background`}
                      >
                        {previewBg === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex-1 p-4 lg:p-6 overflow-y-auto" style={{backgroundColor: previewBg === 'light' ? '#ffffff' : '#0a0a0a'}}>
                      <div className="text-center text-gray-500 text-sm">
                        Preview updates as you build your component
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Panel - Builder */}
            <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-80px)]">
              {/* Basic Info */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-medium mb-4">Basic Info</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Component Name</label>
                    <input
                      type="text"
                      value={widgetName}
                      onChange={(e) => setWidgetName(e.target.value)}
                      placeholder="e.g., Contact Form"
                      className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
                    <textarea
                      value={widgetDescription}
                      onChange={(e) => setWidgetDescription(e.target.value)}
                      placeholder="What is this component for?"
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Default Webhook Path (optional)</label>
                    <input
                      type="text"
                      value={defaultWebhookPath}
                      onChange={(e) => setDefaultWebhookPath(e.target.value)}
                      placeholder="/webhook/my-form"
                      className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      <span className="text-gray-400">Tip:</span> When assigning this component to a workflow in n8n Hosting, the workflow&apos;s webhook will be used automatically.
                    </p>
                  </div>
                  <div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-sm text-gray-400">Add to:</label>
                        <button
                          type="button"
                          onClick={() => setShowAccessHelp(!showAccessHelp)}
                          className="p-1 rounded-full hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {showAccessHelp && (
                        <div className="mb-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-xs text-gray-400">
                          <p className="mb-1"><strong className="text-gray-300">How it works:</strong></p>
                          <p>• Each category is linked to an instance</p>
                          <p>• Adding a component to a category makes it available to clients with access to that instance</p>
                          <p>• Leave empty to keep as template only</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => {
                          const isSelected = cat.instance_id && selectedInstanceIds.includes(cat.instance_id);
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                if (!cat.instance_id) return;
                                if (isSelected) {
                                  setSelectedInstanceIds(selectedInstanceIds.filter(id => id !== cat.instance_id));
                                } else {
                                  setSelectedInstanceIds([...selectedInstanceIds, cat.instance_id]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-white text-black'
                                  : 'bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600'
                              }`}
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                              {cat.name}
                              {isSelected && <X className="w-3 h-3 ml-0.5" />}
                            </button>
                          );
                        })}
                        {categories.length === 0 && (
                          <p className="text-xs text-gray-500">No categories available</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-gray-800">
                <button
                  onClick={() => setBuilderTab('content')}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    builderTab === 'content'
                      ? 'text-white border-white'
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  Content
                </button>
                <button
                  onClick={() => setBuilderTab('colors')}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    builderTab === 'colors'
                      ? 'text-white border-white'
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  Colors
                </button>
                <button
                  onClick={() => setBuilderTab('design')}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    builderTab === 'design'
                      ? 'text-white border-white'
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  Design
                </button>
                {widgetType === 'chatbot' && (
                  <>
                    <button
                      onClick={() => setBuilderTab('effects')}
                      className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        builderTab === 'effects'
                          ? 'text-white border-white'
                          : 'text-gray-400 border-transparent hover:text-white'
                      }`}
                    >
                      Effects
                    </button>
                    <button
                      onClick={() => setBuilderTab('animations')}
                      className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        builderTab === 'animations'
                          ? 'text-white border-white'
                          : 'text-gray-400 border-transparent hover:text-white'
                      }`}
                    >
                      Animations
                    </button>
                  </>
                )}
              </div>

              {/* Content Tab */}
              {builderTab === 'content' && widgetType === 'form' && (
                <div className="space-y-4">
                  {/* Quick Start Templates */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden" open>
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        Quick Start Templates
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 border-t border-gray-800 pt-4">
                      <p className="text-xs text-gray-400 mb-4">Start with a pre-built form template</p>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={() => setFormFields([
                            { name: 'Name', type: 'text', required: true, placeholder: 'Enter your name' },
                            { name: 'Email', type: 'email', required: true, placeholder: 'Enter your email' },
                            { name: 'Message', type: 'textarea', required: true, placeholder: 'Your message' }
                          ])}
                          className="group p-4 bg-gray-800/30 border border-gray-700 hover:border-gray-600 hover:bg-gray-800/50 rounded-lg text-left transition-all"
                        >
                          <div className="text-sm font-medium text-white mb-1">Simple Contact</div>
                          <div className="text-xs text-gray-400">Name, Email, Message</div>
                          <div className="text-[10px] text-gray-500 mt-2">3 fields</div>
                        </button>

                        <button
                          onClick={() => setFormFields([
                            { name: 'First Name', type: 'text', required: true, placeholder: 'First name' },
                            { name: 'Last Name', type: 'text', required: true, placeholder: 'Last name' },
                            { name: 'Email', type: 'email', required: true, placeholder: 'Email address' },
                            { name: 'Phone', type: 'phone', required: false, placeholder: 'Phone number' },
                            { name: 'Company', type: 'text', required: false, placeholder: 'Company name' },
                            { name: 'Subject', type: 'text', required: true, placeholder: 'Subject' },
                            { name: 'Message', type: 'textarea', required: true, placeholder: 'Your message' }
                          ])}
                          className="group p-4 bg-gray-800/30 border border-gray-700 hover:border-gray-600 hover:bg-gray-800/50 rounded-lg text-left transition-all"
                        >
                          <div className="text-sm font-medium text-white mb-1">Long Contact</div>
                          <div className="text-xs text-gray-400">Detailed contact form</div>
                          <div className="text-[10px] text-gray-500 mt-2">7 fields</div>
                        </button>

                        <button
                          onClick={() => {
                            setFormFields([
                              { name: 'Email', type: 'email', required: true, placeholder: 'Enter your email' }
                            ]);
                            setStyles({ ...styles, formTitle: 'Subscribe to Our Newsletter', buttonText: 'Subscribe' });
                          }}
                          className="group p-4 bg-gray-800/30 border border-gray-700 hover:border-gray-600 hover:bg-gray-800/50 rounded-lg text-left transition-all"
                        >
                          <div className="text-sm font-medium text-white mb-1">Subscribe</div>
                          <div className="text-xs text-gray-400">Email only</div>
                          <div className="text-[10px] text-gray-500 mt-2">1 field</div>
                        </button>
                      </div>
                    </div>
                  </details>

                  {/* Field Types */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Add Field</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
                        <button
                          key={type}
                          onClick={() => addField(type as FormField['type'])}
                          className="flex flex-col items-center gap-1.5 p-3 bg-gray-800/30 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-xs">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fields List */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-400">
                        Form Fields ({formFields.length}/{MAX_FIELDS})
                      </h3>
                      {formFields.length >= MAX_FIELDS - 2 && formFields.length < MAX_FIELDS && (
                        <span className="text-xs text-yellow-400">Near limit</span>
                      )}
                      {formFields.length >= MAX_FIELDS && (
                        <span className="text-xs text-red-400">Limit reached</span>
                      )}
                    </div>
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {formFields.map((field, index) => {
                        const FieldIcon = FIELD_TYPES.find(f => f.type === field.type)?.icon || Type;
                        return (
                          <div
                            key={index}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedFieldIndex(index)}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                              selectedFieldIndex === index
                                ? 'bg-white/10 border border-white/20'
                                : 'bg-gray-800/30 border border-gray-700 hover:border-gray-600'
                            } ${draggedIndex === index ? 'opacity-50' : ''}`}
                          >
                            <GripVertical className="w-4 h-4 text-gray-500 cursor-grab" />
                            <FieldIcon className="w-4 h-4 text-gray-400" />
                            <span className="flex-1 text-sm">{field.name}</span>
                            {field.required && (
                              <span className="text-xs text-red-400">Required</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(index);
                              }}
                              className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      {formFields.length === 0 && (
                        <p className="text-center text-gray-500 py-8 text-sm">
                          No fields yet. Add fields from above.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Selected Field Properties */}
                  {typeof selectedFieldIndex === 'number' && formFields[selectedFieldIndex as number] && (
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                      <h3 className="text-sm font-medium text-gray-400 mb-3">Field Properties</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Label</label>
                          <input
                            type="text"
                            value={formFields[selectedFieldIndex as number].name}
                            onChange={(e) => updateField(selectedFieldIndex as number, { name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Placeholder</label>
                          <input
                            type="text"
                            value={formFields[selectedFieldIndex as number].placeholder || ''}
                            onChange={(e) => updateField(selectedFieldIndex as number, { placeholder: e.target.value })}
                            placeholder="Enter placeholder text..."
                            className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                          />
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formFields[selectedFieldIndex as number].required}
                            onChange={(e) => updateField(selectedFieldIndex as number, { required: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                          />
                          <span className="text-sm text-gray-300">Required field</span>
                        </label>
                        {(formFields[selectedFieldIndex as number].type === 'select' || formFields[selectedFieldIndex as number].type === 'radio') && (
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Options (one per line)</label>
                            <textarea
                              value={(formFields[selectedFieldIndex as number].options || []).join('\n')}
                              onChange={(e) => updateField(selectedFieldIndex as number, { options: e.target.value.split('\n').filter(Boolean) })}
                              rows={3}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors resize-none"
                            />
                          </div>
                        )}

                        {/* Advanced Field Styling */}
                        <details className="border-t border-gray-700 pt-4 mt-4">
                          <summary className="cursor-pointer text-sm font-medium text-white mb-3 flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            Advanced Field Styling
                          </summary>
                          <div className="space-y-4 mt-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Field Width</label>
                              <select
                                value={formFields[selectedFieldIndex as number].width || '100'}
                                onChange={(e) => updateField(selectedFieldIndex as number, { width: e.target.value as FormField['width'] })}
                                className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                              >
                                <option value="100">Full Width (100%)</option>
                                <option value="50">Half Width (50%)</option>
                                <option value="33">One Third (33%)</option>
                                <option value="25">Quarter (25%)</option>
                              </select>
                              <p className="text-[10px] text-gray-500 mt-1">Multiple fields with 50% width will appear side-by-side</p>
                            </div>

                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Border Radius (px)</label>
                              <input
                                type="number"
                                min="0"
                                max="24"
                                value={formFields[selectedFieldIndex as number].customBorderRadius || styles.borderRadius}
                                onChange={(e) => updateField(selectedFieldIndex as number, { customBorderRadius: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                                placeholder={`Default: ${styles.borderRadius}`}
                              />
                              <p className="text-[10px] text-gray-500 mt-1">Leave empty to use global form border radius</p>
                            </div>

                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Padding (px)</label>
                              <input
                                type="number"
                                min="4"
                                max="32"
                                value={formFields[selectedFieldIndex as number].customPadding || styles.inputPadding}
                                onChange={(e) => updateField(selectedFieldIndex as number, { customPadding: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                                placeholder={`Default: ${styles.inputPadding}`}
                              />
                            </div>

                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Font Size (px)</label>
                              <input
                                type="number"
                                min="10"
                                max="24"
                                value={formFields[selectedFieldIndex as number].customFontSize || styles.inputFontSize}
                                onChange={(e) => updateField(selectedFieldIndex as number, { customFontSize: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                                placeholder={`Default: ${styles.inputFontSize}`}
                              />
                            </div>

                            {formFields[selectedFieldIndex as number].type !== 'textarea' && formFields[selectedFieldIndex as number].type !== 'checkbox' && formFields[selectedFieldIndex as number].type !== 'radio' && (
                              <div>
                                <label className="block text-sm text-gray-400 mb-2">Height (px)</label>
                                <input
                                  type="number"
                                  min="32"
                                  max="80"
                                  value={formFields[selectedFieldIndex as number].customHeight || ''}
                                  onChange={(e) => updateField(selectedFieldIndex as number, { customHeight: e.target.value })}
                                  className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                                  placeholder="Auto"
                                />
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Button Type Message */}
              {builderTab === 'content' && widgetType === 'button' && (
                <div className="space-y-4">
                  {/* Button Style Preset Gallery */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Quick Start: Button Presets
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                      Start with a pre-designed button style and customize it further in the Style tab
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(BUTTON_STYLE_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => setStyles({ ...styles, ...preset })}
                          className="group relative overflow-hidden rounded-lg transition-all hover:scale-[1.02] hover:ring-1 hover:ring-gray-600"
                        >
                          {/* Preview Mini Button */}
                          <div className="aspect-[4/3] p-4 flex items-center justify-center bg-gray-800/30">
                            <div
                              className="px-6 py-3 text-xs font-medium transition-all"
                              style={{
                                background: preset.primaryColor,
                                color: preset.buttonTextColor,
                                borderRadius: `${preset.borderRadius}px`,
                                boxShadow: preset.buttonShadow !== 'none' ? preset.buttonShadow : 'none',
                                fontWeight: preset.buttonFontWeight,
                                border: preset.primaryColor === 'transparent' ? `2px solid ${preset.buttonTextColor}` : 'none',
                              }}
                            >
                              Click Me
                            </div>
                          </div>

                          {/* Style Name */}
                          <div className="px-2 py-1.5 text-[10px] font-medium text-center border-t bg-gray-800/50 text-gray-300 border-gray-700">
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Info Card */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <MousePointer className="w-4 h-4" />
                      Button Customization
                    </h3>
                    <p className="text-xs text-gray-400">
                      Choose a preset above or switch to the <span className="text-white font-medium">Style tab</span> to customize every aspect of your button including colors, size, shadows, and more.
                    </p>
                  </div>
                </div>
              )}

              {/* Chatbot Configuration */}
              {builderTab === 'content' && widgetType === 'chatbot' && (
                <div className="space-y-4">
                  {/* Theme Preset Gallery */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Quick Start: Theme Presets
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                      Start with a pre-designed theme and customize it further in the Style tab
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(CHATBOT_THEME_PRESETS).map(([key, preset]) => {
                        const isActive = chatbotConfig.themePreset === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setChatbotConfig({ ...DEFAULT_CHATBOT_CONFIG, ...preset })}
                            className={`group relative overflow-hidden rounded-lg transition-all ${
                              isActive
                                ? 'ring-2 ring-white scale-105'
                                : 'hover:scale-[1.02] hover:ring-1 hover:ring-gray-600'
                            }`}
                          >
                            {/* Preview Mini Card */}
                            <div className="aspect-[4/3] p-3 flex flex-col justify-between"
                              style={{
                                background: preset.chatBackgroundGradient || preset.chatBackgroundColor || '#0a0a0a'
                              }}
                            >
                              {/* Header */}
                              <div
                                className="h-6 rounded-md flex items-center px-2"
                                style={{
                                  background: preset.headerGradient || preset.headerColor || '#ffffff',
                                  color: preset.headerTextColor || '#ffffff'
                                }}
                              >
                                <div className="text-[8px] font-medium truncate">Chat</div>
                              </div>

                              {/* Messages */}
                              <div className="space-y-1.5">
                                {/* Bot message */}
                                <div
                                  className="text-[7px] px-2 py-1 rounded max-w-[70%]"
                                  style={{
                                    background: preset.botMessageGradient || preset.botMessageColor || '#1a1a1a',
                                    color: preset.botMessageTextColor || '#ffffff',
                                    boxShadow: preset.botMessageGlow ? `0 0 8px ${preset.botMessageGlowColor}` : 'none'
                                  }}
                                >
                                  Hello!
                                </div>
                                {/* User message */}
                                <div className="flex justify-end">
                                  <div
                                    className="text-[7px] px-2 py-1 rounded max-w-[70%]"
                                    style={{
                                      background: preset.userMessageGradient || preset.userMessageColor || '#ffffff',
                                      color: preset.userMessageTextColor || '#ffffff',
                                      boxShadow: preset.userMessageGlow ? `0 0 8px ${preset.userMessageGlowColor}` : 'none'
                                    }}
                                  >
                                    Hi there
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Theme Name */}
                            <div className={`px-2 py-1.5 text-[10px] font-medium text-center border-t ${
                              isActive
                                ? 'bg-white text-black border-white'
                                : 'bg-gray-800/50 text-gray-300 border-gray-700'
                            }`}>
                              {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Display Mode */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Display Mode
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Display Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setChatbotConfig({ ...chatbotConfig, displayMode: 'embedded' })}
                            className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                              chatbotConfig.displayMode === 'embedded'
                                ? 'bg-white text-black'
                                : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
                            }`}
                          >
                            Under Preview
                          </button>
                          <button
                            onClick={() => setChatbotConfig({ ...chatbotConfig, displayMode: 'popup' })}
                            className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                              chatbotConfig.displayMode === 'popup'
                                ? 'bg-white text-black'
                                : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
                            }`}
                          >
                            70% Popup
                          </button>
                        </div>
                      </div>

                      {chatbotConfig.displayMode === 'popup' && (
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Bubble Position</label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const).map((pos) => (
                              <button
                                key={pos}
                                onClick={() => setChatbotConfig({ ...chatbotConfig, position: pos })}
                                className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-colors capitalize ${
                                  chatbotConfig.position === pos
                                    ? 'bg-white text-black'
                                    : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
                                }`}
                              >
                                {pos.replace('-', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* File Uploads */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      File Uploads
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={chatbotConfig.allowFileUploads || false}
                            onChange={(e) => setChatbotConfig({ ...chatbotConfig, allowFileUploads: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 accent-white"
                          />
                          <span className="text-sm text-white">Enable File Uploads</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-7">Let users attach files to their messages</p>
                      </div>

                      {chatbotConfig.allowFileUploads && (
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Allowed File Types</label>
                          <input
                            type="text"
                            value={chatbotConfig.allowedFileMimeTypes || ''}
                            onChange={(e) => setChatbotConfig({ ...chatbotConfig, allowedFileMimeTypes: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                            placeholder="image/*,application/pdf,.doc,.docx"
                          />
                          <p className="text-xs text-gray-500 mt-1">Comma-separated. Leave empty to allow all files.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Branding */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4">Branding</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Chatbot Name</label>
                        <input
                          type="text"
                          value={chatbotConfig.chatbotName}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, chatbotName: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                          placeholder="Chat Assistant"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Bot Avatar Icon</label>
                        <div className="grid grid-cols-5 gap-2">
                          {AVATAR_ICONS.map((icon) => (
                            <button
                              key={icon.value}
                              onClick={() => setChatbotConfig({ ...chatbotConfig, avatarIcon: icon.value })}
                              className={`aspect-square flex items-center justify-center text-2xl rounded-lg transition-all ${
                                chatbotConfig.avatarIcon === icon.value
                                  ? 'bg-white text-black ring-2 ring-white scale-105'
                                  : 'bg-gray-800/30 hover:bg-gray-700 border border-gray-700'
                              }`}
                              title={icon.label}
                            >
                              {icon.value}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">This icon appears next to bot messages in the chat</p>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                          <Image className="w-4 h-4" aria-hidden="true" />
                          Logo URL (optional - overrides avatar icon)
                        </label>
                        <input
                          type="url"
                          value={chatbotConfig.chatbotLogo || ''}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, chatbotLogo: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                          placeholder="https://example.com/logo.png"
                        />
                      </div>

                      {!isProPlus && (
                        <div className="flex items-center gap-3 p-3 bg-gray-800/30 border border-gray-700 rounded-lg">
                          <input
                            type="checkbox"
                            checked={chatbotConfig.showWatermark}
                            disabled
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 opacity-50"
                          />
                          <div className="flex-1">
                            <p className="text-sm text-gray-400">
                              &quot;Powered by FlowEngine&quot; watermark
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Upgrade to Max to remove
                            </p>
                          </div>
                        </div>
                      )}

                      {isProPlus && (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={chatbotConfig.showWatermark}
                            onChange={(e) => setChatbotConfig({ ...chatbotConfig, showWatermark: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                          />
                          <span className="text-sm text-gray-400">Show &quot;Powered by FlowEngine&quot; watermark</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Behavior */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4">Behavior</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Welcome Message</label>
                        <textarea
                          value={chatbotConfig.welcomeMessage}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, welcomeMessage: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white resize-none"
                          rows={3}
                          placeholder="Hi! How can I help you today?"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Input Placeholder</label>
                        <input
                          type="text"
                          value={chatbotConfig.placeholder}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, placeholder: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                          placeholder="Type your message..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Auto-open Behavior</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setChatbotConfig({ ...chatbotConfig, autoOpen: 'always' })}
                            className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                              chatbotConfig.autoOpen === 'always'
                                ? 'bg-white text-black'
                                : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
                            }`}
                          >
                            Always On
                          </button>
                          <button
                            onClick={() => setChatbotConfig({ ...chatbotConfig, autoOpen: 'delayed' })}
                            className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                              chatbotConfig.autoOpen === 'delayed'
                                ? 'bg-white text-black'
                                : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
                            }`}
                          >
                            After Delay
                          </button>
                          <button
                            onClick={() => setChatbotConfig({ ...chatbotConfig, autoOpen: 'click-only' })}
                            className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                              chatbotConfig.autoOpen === 'click-only'
                                ? 'bg-white text-black'
                                : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
                            }`}
                          >
                            Click Only
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {chatbotConfig.autoOpen === 'always' && 'Chat opens immediately when page loads'}
                          {chatbotConfig.autoOpen === 'delayed' && 'Chat opens automatically after a delay'}
                          {chatbotConfig.autoOpen === 'click-only' && 'Chat opens only when user clicks the bubble'}
                        </p>
                      </div>

                      {chatbotConfig.autoOpen === 'delayed' && (
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Delay before opening (seconds)</label>
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={chatbotConfig.autoOpenDelay}
                            onChange={(e) => setChatbotConfig({ ...chatbotConfig, autoOpenDelay: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Colors Tab */}
              {builderTab === 'colors' && (
                <div className="space-y-4">
                  {/* Chatbot Colors - Full Canvas Editor */}
                  {widgetType === 'chatbot' && canvasMode && (
                    <div className="fixed inset-0 z-50 bg-black">
                      <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
                        <button
                          onClick={() => setCanvasMode(false)}
                          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          ← Classic Mode
                        </button>
                      </div>
                      <CanvasEditor
                        config={chatbotConfig}
                        onChange={(newConfig) => setChatbotConfig(newConfig as any)}
                      />
                    </div>
                  )}

                  {/* Chatbot Colors - Classic Interactive Editor */}
                  {widgetType === 'chatbot' && !canvasMode && (
                    <>
                      <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-purple-300 mb-1">✨ Try Canvas Mode!</h4>
                            <p className="text-xs text-purple-200/80 mb-3">
                              Click elements directly in the preview for a Canva-like editing experience
                            </p>
                            <button
                              onClick={() => setCanvasMode(true)}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Switch to Canvas Mode
                            </button>
                          </div>
                        </div>
                      </div>

                      <InteractiveColorEditor
                        config={chatbotConfig}
                        onChange={(newConfig) => setChatbotConfig(newConfig as any)}
                      />
                    </>
                  )}

                  {/* Form & Button Colors */}
                  {(widgetType === 'form' || widgetType === 'button') && (
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-6">
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-medium text-white mb-2">Form Colors</h3>
                        <p className="text-sm text-gray-400">Customize your form appearance</p>
                      </div>

                      <EnhancedColorInput
                        label="Primary / Button Color"
                        value={styles.primaryColor}
                        onChange={(color) => setStyles({ ...styles, primaryColor: color })}
                        description="Main button and accent color"
                      />

                      <EnhancedColorInput
                        label="Background"
                        value={styles.backgroundColor}
                        onChange={(color) => setStyles({ ...styles, backgroundColor: color })}
                        description="Form container background"
                      />

                      <EnhancedColorInput
                        label="Text Color"
                        value={styles.textColor}
                        onChange={(color) => setStyles({ ...styles, textColor: color })}
                        description="Main text color"
                      />

                      {widgetType === 'form' && (
                        <>
                          <div className="border-t border-gray-700 pt-6">
                            <h4 className="text-sm font-medium text-white mb-4">Form Fields</h4>

                            <div className="space-y-6">
                              <EnhancedColorInput
                                label="Label Color"
                                value={styles.labelColor}
                                onChange={(color) => setStyles({ ...styles, labelColor: color })}
                                description="Field labels"
                              />

                              <EnhancedColorInput
                                label="Input Background"
                                value={styles.inputBackgroundColor}
                                onChange={(color) => setStyles({ ...styles, inputBackgroundColor: color })}
                                description="Input field backgrounds"
                              />

                              <EnhancedColorInput
                                label="Input Border"
                                value={styles.inputBorderColor}
                                onChange={(color) => setStyles({ ...styles, inputBorderColor: color })}
                                description="Input field borders"
                              />

                              <EnhancedColorInput
                                label="Placeholder Color"
                                value={styles.placeholderColor}
                                onChange={(color) => setStyles({ ...styles, placeholderColor: color })}
                                description="Placeholder text in inputs"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Design Tab */}
              {builderTab === 'design' && (
                <div className="space-y-3">
                  {/* Chatbot Styling */}
                  {widgetType === 'chatbot' && (
                    <>
                      {/* Quick Themes */}
                      <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden" open>
                        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                          <span className="text-sm font-medium text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            Quick Themes
                          </span>
                          <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-4 pb-4 border-t border-gray-800 pt-4">
                          <p className="text-xs text-gray-400 mb-4">
                            Start with a pre-designed theme and customize it further
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(CHATBOT_THEME_PRESETS).map(([key, preset]) => {
                              const isActive = chatbotConfig.themePreset === key;
                              return (
                                <button
                                  key={key}
                                  onClick={() => setChatbotConfig({ ...DEFAULT_CHATBOT_CONFIG, ...preset })}
                                  className={`group relative overflow-hidden rounded-lg transition-all ${
                                    isActive
                                      ? 'ring-2 ring-white scale-105'
                                      : 'hover:scale-[1.02] hover:ring-1 hover:ring-gray-600'
                                  }`}
                                >
                                  <div className="aspect-[4/3] p-3 flex flex-col justify-between"
                                    style={{
                                      background: preset.chatBackgroundGradient || preset.chatBackgroundColor || '#0a0a0a'
                                    }}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="w-6 h-6 rounded-full" style={{ background: preset.bubbleGradient || preset.bubbleColor }} />
                                      {isActive && <Check className="w-4 h-4 text-white" />}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="h-2 rounded-full w-3/4" style={{ background: preset.botMessageGradient || preset.botMessageColor }} />
                                      <div className="h-2 rounded-full w-1/2 ml-auto" style={{ background: preset.userMessageGradient || preset.userMessageColor }} />
                                    </div>
                                  </div>
                                  <div className="px-2 py-1.5 bg-gray-900/80 backdrop-blur-sm text-center">
                                    <span className="text-xs text-white capitalize">{key}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </details>

                      {/* Colors */}
                      <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                          <span className="text-sm font-medium text-white">Chatbot Colors</span>
                          <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Header Background</label>
                            <input
                              type="color"
                              value={chatbotConfig.headerColor}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, headerColor: e.target.value })}
                              className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Header Text</label>
                            <input
                              type="color"
                              value={chatbotConfig.headerTextColor}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, headerTextColor: e.target.value })}
                              className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Chat Background</label>
                            <input
                              type="color"
                              value={chatbotConfig.chatBackgroundColor}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, chatBackgroundColor: e.target.value })}
                              className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">User Message BG</label>
                              <input
                                type="color"
                                value={chatbotConfig.userMessageColor}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, userMessageColor: e.target.value })}
                                className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">User Message Text</label>
                              <input
                                type="color"
                                value={chatbotConfig.userMessageTextColor}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, userMessageTextColor: e.target.value })}
                                className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Bot Message BG</label>
                              <input
                                type="color"
                                value={chatbotConfig.botMessageColor}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, botMessageColor: e.target.value })}
                                className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Bot Message Text</label>
                              <input
                                type="color"
                                value={chatbotConfig.botMessageTextColor}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, botMessageTextColor: e.target.value })}
                                className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* Layout */}
                      <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                          <span className="text-sm font-medium text-white">Layout</span>
                          <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Chat Width (px)</label>
                            <input
                              type="number"
                              min="300"
                              max="600"
                              value={chatbotConfig.chatWidth}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, chatWidth: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Chat Height (px)</label>
                            <input
                              type="number"
                              min="400"
                              max="800"
                              value={chatbotConfig.chatHeight}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, chatHeight: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Border Radius (px): {chatbotConfig.borderRadius}</label>
                            <input
                              type="range"
                              min="0"
                              max="24"
                              value={chatbotConfig.borderRadius}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, borderRadius: e.target.value })}
                              className="w-full accent-white mt-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Font Family</label>
                            <select
                              value={chatbotConfig.fontFamily}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, fontFamily: e.target.value })}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                            >
                              <option value="system-ui">System UI</option>
                              <option value="Inter">Inter</option>
                              <option value="Roboto">Roboto</option>
                              <option value="Open Sans">Open Sans</option>
                              <option value="Lato">Lato</option>
                              <option value="Poppins">Poppins</option>
                            </select>
                          </div>
                        </div>
                      </details>

                      {/* Gradients - Legacy */}
                      <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-purple-300 mb-1">💡 New! Interactive Color Editor</h4>
                            <p className="text-xs text-purple-200/80">
                              For a better experience, use the <strong>Colors tab</strong> above - just click on any part of the preview to edit colors and gradients visually!
                            </p>
                          </div>
                        </div>
                      </div>

                      <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                          <span className="text-sm font-medium text-gray-400">🎨 Gradients (Advanced CSS Mode)</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={resetChatbotGradients}
                              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                              title="Reset to defaults"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                          </div>
                        </summary>
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Bubble Gradient (CSS)</label>
                            <input
                              type="text"
                              value={chatbotConfig.bubbleGradient || ''}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, bubbleGradient: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white font-mono text-xs"
                              placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Leave empty to use solid color</p>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Header Gradient (CSS)</label>
                            <input
                              type="text"
                              value={chatbotConfig.headerGradient || ''}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, headerGradient: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white font-mono text-xs"
                              placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Chat Background Gradient (CSS)</label>
                            <input
                              type="text"
                              value={chatbotConfig.chatBackgroundGradient || ''}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, chatBackgroundGradient: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white font-mono text-xs"
                              placeholder="linear-gradient(180deg, #0f0c29 0%, #302b63 100%)"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Background Pattern</label>
                            <select
                              value={chatbotConfig.chatBackgroundPattern || 'none'}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, chatBackgroundPattern: e.target.value as any })}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                            >
                              <option value="none">None</option>
                              <option value="dots">Dots</option>
                              <option value="grid">Grid</option>
                              <option value="waves">Waves</option>
                              <option value="particles">Particles</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">User Message Gradient (CSS)</label>
                            <input
                              type="text"
                              value={chatbotConfig.userMessageGradient || ''}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, userMessageGradient: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white font-mono text-xs"
                              placeholder="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Bot Message Gradient (CSS)</label>
                            <input
                              type="text"
                              value={chatbotConfig.botMessageGradient || ''}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, botMessageGradient: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white font-mono text-xs"
                              placeholder="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
                            />
                          </div>
                        </div>
                      </details>

                      {/* Effects & Animations */}
                      <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                          <span className="text-sm font-medium text-white">✨ Effects & Animations</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={resetChatbotEffects}
                              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                              title="Reset to defaults"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                          </div>
                        </summary>
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Bubble Animation</label>
                            <select
                              value={chatbotConfig.bubbleAnimation}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, bubbleAnimation: e.target.value as any })}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                            >
                              <option value="none">None</option>
                              <option value="pulse">Pulse</option>
                              <option value="bounce">Bounce</option>
                              <option value="shake">Shake</option>
                              <option value="glow">Glow</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Message Entrance Animation</label>
                            <select
                              value={chatbotConfig.messageAnimation}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, messageAnimation: e.target.value as any })}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                            >
                              <option value="none">None</option>
                              <option value="slide">Slide In</option>
                              <option value="fade">Fade In</option>
                              <option value="bounce">Bounce In</option>
                              <option value="scale">Scale In</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Typing Indicator</label>
                            <select
                              value={chatbotConfig.typingIndicator}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, typingIndicator: e.target.value as any })}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                            >
                              <option value="dots">Bouncing Dots</option>
                              <option value="pulse">Pulsing Dots</option>
                              <option value="wave">Wave Dots</option>
                              <option value="none">None</option>
                            </select>
                            {/* Live Preview */}
                            {chatbotConfig.typingIndicator !== 'none' && (
                              <div className="mt-3 flex items-center gap-1.5 p-3 bg-gray-800/30 rounded-lg">
                                <style>{`
                                  @keyframes typing-dots-sidebar {
                                    0%, 20% { opacity: 0.3; transform: translateY(0); }
                                    50% { opacity: 1; transform: translateY(-4px); }
                                    80%, 100% { opacity: 0.3; transform: translateY(0); }
                                  }
                                  @keyframes typing-pulse-sidebar {
                                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                                    50% { opacity: 1; transform: scale(1); }
                                  }
                                  @keyframes typing-wave-sidebar {
                                    0%, 100% { transform: translateY(0); }
                                    50% { transform: translateY(-6px); }
                                  }
                                `}</style>
                                {[0, 1, 2].map((i) => (
                                  <div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-white"
                                    style={{
                                      animation: chatbotConfig.typingIndicator === 'dots'
                                        ? `typing-dots-sidebar 1.4s ease-in-out infinite ${i * 0.15}s`
                                        : chatbotConfig.typingIndicator === 'pulse'
                                        ? `typing-pulse-sidebar 1.4s ease-in-out infinite ${i * 0.15}s`
                                        : `typing-wave-sidebar 1.2s ease-in-out infinite ${i * 0.15}s`,
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={chatbotConfig.bubbleGlow}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, bubbleGlow: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                            />
                            <span className="text-sm text-gray-300">Enable bubble glow effect</span>
                          </label>
                          {chatbotConfig.bubbleGlow && (
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Bubble Glow Color</label>
                              <input
                                type="color"
                                value={chatbotConfig.bubbleGlowColor}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, bubbleGlowColor: e.target.value })}
                                className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                              />
                            </div>
                          )}
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={chatbotConfig.userMessageGlow}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, userMessageGlow: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                            />
                            <span className="text-sm text-gray-300">Enable user message glow</span>
                          </label>
                          {chatbotConfig.userMessageGlow && (
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">User Message Glow Color</label>
                              <input
                                type="color"
                                value={chatbotConfig.userMessageGlowColor}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, userMessageGlowColor: e.target.value })}
                                className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                              />
                            </div>
                          )}
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={chatbotConfig.botMessageGlow}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, botMessageGlow: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                            />
                            <span className="text-sm text-gray-300">Enable bot message glow</span>
                          </label>
                          {chatbotConfig.botMessageGlow && (
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Bot Message Glow Color</label>
                              <input
                                type="color"
                                value={chatbotConfig.botMessageGlowColor}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, botMessageGlowColor: e.target.value })}
                                className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                              />
                            </div>
                          )}
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={chatbotConfig.glassEffect}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, glassEffect: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                            />
                            <span className="text-sm text-gray-300">Enable glassmorphism effect</span>
                          </label>
                          {chatbotConfig.glassEffect && (
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Backdrop Blur (px): {chatbotConfig.backdropBlur}</label>
                              <input
                                type="range"
                                min="0"
                                max="40"
                                value={chatbotConfig.backdropBlur}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, backdropBlur: e.target.value })}
                                className="w-full accent-white mt-2"
                              />
                            </div>
                          )}
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={chatbotConfig.soundEffects}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, soundEffects: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                            />
                            <span className="text-sm text-gray-300">Enable sound effects</span>
                          </label>
                        </div>
                      </details>

                      {/* Typography & RTL */}
                      <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                          <span className="text-sm font-medium text-white">✍️ Typography & RTL</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={resetChatbotTypography}
                              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                              title="Reset to defaults"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                          </div>
                        </summary>
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Text Direction</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setChatbotConfig({ ...chatbotConfig, direction: 'ltr', textAlign: 'left' })}
                                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                                  chatbotConfig.direction === 'ltr'
                                    ? 'bg-white text-black'
                                    : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
                                }`}
                              >
                                LTR (English)
                              </button>
                              <button
                                onClick={() => setChatbotConfig({ ...chatbotConfig, direction: 'rtl', textAlign: 'right' })}
                                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                                  chatbotConfig.direction === 'rtl'
                                    ? 'bg-white text-black'
                                    : 'bg-gray-800/30 text-gray-400 hover:text-white border border-gray-700'
                                }`}
                              >
                                RTL (Arabic, Hebrew)
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Font Size (px)</label>
                            <input
                              type="number"
                              min="10"
                              max="24"
                              value={chatbotConfig.fontSize}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, fontSize: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Font Weight</label>
                            <select
                              value={chatbotConfig.fontWeight}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, fontWeight: e.target.value })}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                            >
                              <option value="300">Light (300)</option>
                              <option value="400">Regular (400)</option>
                              <option value="500">Medium (500)</option>
                              <option value="600">Semibold (600)</option>
                              <option value="700">Bold (700)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Line Height</label>
                            <input
                              type="number"
                              min="1"
                              max="2.5"
                              step="0.1"
                              value={chatbotConfig.lineHeight}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, lineHeight: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Letter Spacing (px)</label>
                            <input
                              type="number"
                              min="-2"
                              max="5"
                              step="0.5"
                              value={chatbotConfig.letterSpacing}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, letterSpacing: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Text Transform</label>
                            <select
                              value={chatbotConfig.textTransform}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, textTransform: e.target.value as any })}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                            >
                              <option value="none">None</option>
                              <option value="uppercase">UPPERCASE</option>
                              <option value="lowercase">lowercase</option>
                              <option value="capitalize">Capitalize</option>
                            </select>
                          </div>
                        </div>
                      </details>

                      {/* Messages & Display */}
                      <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                          <span className="text-sm font-medium text-white">💬 Messages & Display</span>
                          <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={chatbotConfig.showAvatar}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, showAvatar: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                            />
                            <span className="text-sm text-gray-300">Show bot avatar</span>
                          </label>
                          {chatbotConfig.showAvatar && (
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Avatar URL (optional)</label>
                              <input
                                type="url"
                                value={chatbotConfig.avatarUrl || ''}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, avatarUrl: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                                placeholder="https://example.com/avatar.png"
                              />
                            </div>
                          )}
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={chatbotConfig.showTimestamp}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, showTimestamp: e.target.checked })}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                            />
                            <span className="text-sm text-gray-300">Show message timestamps</span>
                          </label>
                          {chatbotConfig.showTimestamp && (
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Timestamp Color</label>
                              <input
                                type="color"
                                value={chatbotConfig.timestampColor}
                                onChange={(e) => setChatbotConfig({ ...chatbotConfig, timestampColor: e.target.value })}
                                className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Message Spacing (px)</label>
                            <input
                              type="number"
                              min="4"
                              max="32"
                              value={chatbotConfig.messageSpacing}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, messageSpacing: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Message Padding (px)</label>
                            <input
                              type="number"
                              min="8"
                              max="24"
                              value={chatbotConfig.messagePadding}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, messagePadding: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                            />
                          </div>
                        </div>
                      </details>
                    </>
                  )}

                  {/* Form Title & Description */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white">Form Title & Description</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={styles.showTitle}
                          onChange={(e) => setStyles({ ...styles, showTitle: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                        />
                        <span className="text-sm text-gray-300">Show form title</span>
                      </label>
                      {styles.showTitle && (
                        <>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Title Text</label>
                            <input
                              type="text"
                              value={styles.formTitle}
                              onChange={(e) => setStyles({ ...styles, formTitle: e.target.value })}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Title Color</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={styles.titleColor}
                                  onChange={(e) => setStyles({ ...styles, titleColor: e.target.value })}
                                  className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={styles.titleColor}
                                  onChange={(e) => setStyles({ ...styles, titleColor: e.target.value })}
                                  className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Title Size: {styles.titleFontSize}px</label>
                              <input
                                type="range"
                                min="16"
                                max="36"
                                value={styles.titleFontSize}
                                onChange={(e) => setStyles({ ...styles, titleFontSize: e.target.value })}
                                className="w-full accent-white mt-2"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Font Weight</label>
                              <select
                                value={styles.titleFontWeight}
                                onChange={(e) => setStyles({ ...styles, titleFontWeight: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                              >
                                <option value="400">Normal</option>
                                <option value="500">Medium</option>
                                <option value="600">Semibold</option>
                                <option value="700">Bold</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Alignment</label>
                              <select
                                value={styles.titleAlignment}
                                onChange={(e) => setStyles({ ...styles, titleAlignment: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                      <div className="border-t border-gray-700 pt-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={styles.showDescription}
                            onChange={(e) => setStyles({ ...styles, showDescription: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                          />
                          <span className="text-sm text-gray-300">Show description</span>
                        </label>
                      </div>
                      {styles.showDescription && (
                        <>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Description Text</label>
                            <textarea
                              value={styles.formDescription}
                              onChange={(e) => setStyles({ ...styles, formDescription: e.target.value })}
                              rows={2}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors resize-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Description Color</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={styles.descriptionColor}
                                  onChange={(e) => setStyles({ ...styles, descriptionColor: e.target.value })}
                                  className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={styles.descriptionColor}
                                  onChange={(e) => setStyles({ ...styles, descriptionColor: e.target.value })}
                                  className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">Size: {styles.descriptionFontSize}px</label>
                              <input
                                type="range"
                                min="12"
                                max="18"
                                value={styles.descriptionFontSize}
                                onChange={(e) => setStyles({ ...styles, descriptionFontSize: e.target.value })}
                                className="w-full accent-white mt-2"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </details>

                  {/* Form Container */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white">Form Container</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Background Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={styles.backgroundColor}
                            onChange={(e) => setStyles({ ...styles, backgroundColor: e.target.value })}
                            className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={styles.backgroundColor}
                            onChange={(e) => setStyles({ ...styles, backgroundColor: e.target.value })}
                            className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Padding: {styles.formPadding}px</label>
                          <input
                            type="range"
                            min="12"
                            max="48"
                            value={styles.formPadding}
                            onChange={(e) => setStyles({ ...styles, formPadding: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Max Width: {styles.formMaxWidth}px</label>
                          <input
                            type="range"
                            min="320"
                            max="800"
                            step="20"
                            value={styles.formMaxWidth}
                            onChange={(e) => setStyles({ ...styles, formMaxWidth: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Shadow</label>
                        <select
                          value={styles.formShadow}
                          onChange={(e) => setStyles({ ...styles, formShadow: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                        >
                          <option value="none">None</option>
                          <option value="0 1px 3px rgba(0,0,0,0.12)">Small</option>
                          <option value="0 4px 6px rgba(0,0,0,0.1)">Medium</option>
                          <option value="0 10px 25px rgba(0,0,0,0.15)">Large</option>
                          <option value="0 20px 50px rgba(0,0,0,0.2)">Extra Large</option>
                        </select>
                      </div>
                    </div>
                  </details>

                  {/* Labels */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white">Labels</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Label Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.labelColor}
                              onChange={(e) => setStyles({ ...styles, labelColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.labelColor}
                              onChange={(e) => setStyles({ ...styles, labelColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Required * Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.requiredIndicatorColor}
                              onChange={(e) => setStyles({ ...styles, requiredIndicatorColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.requiredIndicatorColor}
                              onChange={(e) => setStyles({ ...styles, requiredIndicatorColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Size: {styles.labelFontSize}px</label>
                          <input
                            type="range"
                            min="10"
                            max="18"
                            value={styles.labelFontSize}
                            onChange={(e) => setStyles({ ...styles, labelFontSize: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Weight</label>
                          <select
                            value={styles.labelFontWeight}
                            onChange={(e) => setStyles({ ...styles, labelFontWeight: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                          >
                            <option value="400">Normal</option>
                            <option value="500">Medium</option>
                            <option value="600">Semibold</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Bottom Gap: {styles.labelMarginBottom}px</label>
                          <input
                            type="range"
                            min="2"
                            max="12"
                            value={styles.labelMarginBottom}
                            onChange={(e) => setStyles({ ...styles, labelMarginBottom: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Input Fields */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white">Input Fields</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={resetFormStyles}
                          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Reset to defaults"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                      </div>
                    </summary>
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Background</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.inputBackgroundColor}
                              onChange={(e) => setStyles({ ...styles, inputBackgroundColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.inputBackgroundColor}
                              onChange={(e) => setStyles({ ...styles, inputBackgroundColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Text Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.textColor}
                              onChange={(e) => setStyles({ ...styles, textColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.textColor}
                              onChange={(e) => setStyles({ ...styles, textColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Border Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.inputBorderColor}
                              onChange={(e) => setStyles({ ...styles, inputBorderColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.inputBorderColor}
                              onChange={(e) => setStyles({ ...styles, inputBorderColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Placeholder Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.placeholderColor}
                              onChange={(e) => setStyles({ ...styles, placeholderColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.placeholderColor}
                              onChange={(e) => setStyles({ ...styles, placeholderColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Border: {styles.inputBorderWidth}px</label>
                          <input
                            type="range"
                            min="0"
                            max="3"
                            value={styles.inputBorderWidth}
                            onChange={(e) => setStyles({ ...styles, inputBorderWidth: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Font Size: {styles.inputFontSize}px</label>
                          <input
                            type="range"
                            min="12"
                            max="18"
                            value={styles.inputFontSize}
                            onChange={(e) => setStyles({ ...styles, inputFontSize: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Padding: {styles.inputPadding}px</label>
                          <input
                            type="range"
                            min="8"
                            max="20"
                            value={styles.inputPadding}
                            onChange={(e) => setStyles({ ...styles, inputPadding: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                      </div>
                      <div className="border-t border-gray-700 pt-4">
                        <p className="text-xs text-gray-500 mb-3">Focus State</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Focus Border</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={styles.inputFocusBorderColor}
                                onChange={(e) => setStyles({ ...styles, inputFocusBorderColor: e.target.value })}
                                className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={styles.inputFocusBorderColor}
                                onChange={(e) => setStyles({ ...styles, inputFocusBorderColor: e.target.value })}
                                className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Focus Shadow</label>
                            <select
                              value={styles.inputFocusShadow}
                              onChange={(e) => setStyles({ ...styles, inputFocusShadow: e.target.value })}
                              className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                            >
                              <option value="none">None</option>
                              <option value="0 0 0 2px rgba(255,255,255,0.1)">Subtle</option>
                              <option value="0 0 0 3px rgba(99,102,241,0.3)">Indigo Glow</option>
                              <option value="0 0 0 3px rgba(16,185,129,0.3)">Green Glow</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Button */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white">Submit Button</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={resetButtonStyles}
                          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Reset to defaults"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                      </div>
                    </summary>
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Button Text</label>
                        <input
                          type="text"
                          value={styles.buttonText}
                          onChange={(e) => setStyles({ ...styles, buttonText: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Background</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.primaryColor}
                              onChange={(e) => setStyles({ ...styles, primaryColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.primaryColor}
                              onChange={(e) => setStyles({ ...styles, primaryColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Text Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.buttonTextColor}
                              onChange={(e) => setStyles({ ...styles, buttonTextColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.buttonTextColor}
                              onChange={(e) => setStyles({ ...styles, buttonTextColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Hover Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.buttonHoverColor}
                              onChange={(e) => setStyles({ ...styles, buttonHoverColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.buttonHoverColor}
                              onChange={(e) => setStyles({ ...styles, buttonHoverColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Width</label>
                          <select
                            value={styles.buttonWidth}
                            onChange={(e) => setStyles({ ...styles, buttonWidth: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                          >
                            <option value="full">Full Width</option>
                            <option value="auto">Auto (fit content)</option>
                            <option value="half">Half Width</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Font Size: {styles.buttonFontSize}px</label>
                          <input
                            type="range"
                            min="12"
                            max="20"
                            value={styles.buttonFontSize}
                            onChange={(e) => setStyles({ ...styles, buttonFontSize: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Weight</label>
                          <select
                            value={styles.buttonFontWeight}
                            onChange={(e) => setStyles({ ...styles, buttonFontWeight: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                          >
                            <option value="400">Normal</option>
                            <option value="500">Medium</option>
                            <option value="600">Semibold</option>
                            <option value="700">Bold</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Padding: {styles.buttonPadding}px</label>
                          <input
                            type="range"
                            min="8"
                            max="24"
                            value={styles.buttonPadding}
                            onChange={(e) => setStyles({ ...styles, buttonPadding: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Shadow</label>
                        <select
                          value={styles.buttonShadow}
                          onChange={(e) => setStyles({ ...styles, buttonShadow: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                        >
                          <option value="none">None</option>
                          <option value="0 2px 4px rgba(0,0,0,0.1)">Subtle</option>
                          <option value="0 4px 12px rgba(0,0,0,0.15)">Medium</option>
                          <option value="0 8px 24px rgba(0,0,0,0.2)">Large</option>
                        </select>
                      </div>
                    </div>
                  </details>

                  {/* Typography */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white">Typography</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Font Family</label>
                        <select
                          value={styles.fontFamily}
                          onChange={(e) => setStyles({ ...styles, fontFamily: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                        >
                          <option value="system-ui">System Default</option>
                          <option value="Inter">Inter</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Open Sans">Open Sans</option>
                          <option value="Poppins">Poppins</option>
                          <option value="Lato">Lato</option>
                          <option value="Montserrat">Montserrat</option>
                          <option value="Nunito">Nunito</option>
                          <option value="Raleway">Raleway</option>
                          <option value="Source Sans Pro">Source Sans Pro</option>
                          <option value="Playfair Display">Playfair Display</option>
                          <option value="Merriweather">Merriweather</option>
                        </select>
                      </div>
                    </div>
                  </details>

                  {/* Layout & Spacing */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white">Layout & Spacing</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Border Radius: {styles.borderRadius}px</label>
                          <input
                            type="range"
                            min="0"
                            max="24"
                            value={styles.borderRadius}
                            onChange={(e) => setStyles({ ...styles, borderRadius: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Field Spacing: {styles.fieldSpacing}px</label>
                          <input
                            type="range"
                            min="8"
                            max="40"
                            value={styles.fieldSpacing}
                            onChange={(e) => setStyles({ ...styles, fieldSpacing: e.target.value })}
                            className="w-full accent-white"
                          />
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Messages */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white">Success & Error Messages</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">
                      <p className="text-xs text-gray-500">Success Message</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Text Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.successMessageColor}
                              onChange={(e) => setStyles({ ...styles, successMessageColor: e.target.value })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.successMessageColor}
                              onChange={(e) => setStyles({ ...styles, successMessageColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Background</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={styles.successBackgroundColor.replace(/15$/, '')}
                              onChange={(e) => setStyles({ ...styles, successBackgroundColor: e.target.value + '15' })}
                              className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={styles.successBackgroundColor}
                              onChange={(e) => setStyles({ ...styles, successBackgroundColor: e.target.value })}
                              className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-gray-700 pt-4">
                        <p className="text-xs text-gray-500 mb-3">Error Message</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Text Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={styles.errorMessageColor}
                                onChange={(e) => setStyles({ ...styles, errorMessageColor: e.target.value })}
                                className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={styles.errorMessageColor}
                                onChange={(e) => setStyles({ ...styles, errorMessageColor: e.target.value })}
                                className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Background</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={styles.errorBackgroundColor.replace(/15$/, '')}
                                onChange={(e) => setStyles({ ...styles, errorBackgroundColor: e.target.value + '15' })}
                                className="w-10 h-10 rounded-lg border border-gray-700 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={styles.errorBackgroundColor}
                                onChange={(e) => setStyles({ ...styles, errorBackgroundColor: e.target.value })}
                                className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Quick Presets */}
                  <details className="group bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                      <span className="text-sm font-medium text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        Quick Presets
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 border-t border-gray-800 pt-4">
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        <button
                          onClick={() => setStyles({
                            ...DEFAULT_STYLES,
                          })}
                          className="px-3 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Dark
                        </button>
                        <button
                          onClick={() => setStyles({
                            ...styles,
                            primaryColor: '#000000',
                            backgroundColor: '#ffffff',
                            textColor: '#000000',
                            labelColor: '#374151',
                            placeholderColor: '#9ca3af',
                            buttonTextColor: '#ffffff',
                            buttonHoverColor: '#1f2937',
                            inputBorderColor: '#d1d5db',
                            inputBackgroundColor: '#f9fafb',
                            inputFocusBorderColor: '#000000',
                            titleColor: '#000000',
                            descriptionColor: '#6b7280',
                          })}
                          className="px-3 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Light
                        </button>
                        <button
                          onClick={() => setStyles({
                            ...styles,
                            primaryColor: '#6366f1',
                            backgroundColor: '#0f0f23',
                            textColor: '#ffffff',
                            labelColor: '#a5b4fc',
                            placeholderColor: '#6366f1',
                            buttonTextColor: '#ffffff',
                            buttonHoverColor: '#4f46e5',
                            inputBorderColor: '#4338ca',
                            inputBackgroundColor: '#1e1e3f',
                            inputFocusBorderColor: '#818cf8',
                            titleColor: '#ffffff',
                            descriptionColor: '#a5b4fc',
                          })}
                          className="px-3 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Indigo
                        </button>
                        <button
                          onClick={() => setStyles({
                            ...styles,
                            primaryColor: '#10b981',
                            backgroundColor: '#022c22',
                            textColor: '#ffffff',
                            labelColor: '#6ee7b7',
                            placeholderColor: '#059669',
                            buttonTextColor: '#ffffff',
                            buttonHoverColor: '#059669',
                            inputBorderColor: '#047857',
                            inputBackgroundColor: '#064e3b',
                            inputFocusBorderColor: '#34d399',
                            titleColor: '#ffffff',
                            descriptionColor: '#6ee7b7',
                          })}
                          className="px-3 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Emerald
                        </button>
                        <button
                          onClick={() => setStyles({
                            ...styles,
                            primaryColor: '#f43f5e',
                            backgroundColor: '#1c1917',
                            textColor: '#ffffff',
                            labelColor: '#fda4af',
                            placeholderColor: '#fb7185',
                            buttonTextColor: '#ffffff',
                            buttonHoverColor: '#e11d48',
                            inputBorderColor: '#991b1b',
                            inputBackgroundColor: '#292524',
                            inputFocusBorderColor: '#fb7185',
                            titleColor: '#ffffff',
                            descriptionColor: '#fda4af',
                          })}
                          className="px-3 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Rose
                        </button>
                        <button
                          onClick={() => setStyles({
                            ...styles,
                            primaryColor: '#f59e0b',
                            backgroundColor: '#fefce8',
                            textColor: '#422006',
                            labelColor: '#92400e',
                            placeholderColor: '#d97706',
                            buttonTextColor: '#ffffff',
                            buttonHoverColor: '#d97706',
                            inputBorderColor: '#fcd34d',
                            inputBackgroundColor: '#fffbeb',
                            inputFocusBorderColor: '#f59e0b',
                            titleColor: '#422006',
                            descriptionColor: '#92400e',
                          })}
                          className="px-3 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Amber
                        </button>
                        <button
                          onClick={() => setStyles({
                            ...styles,
                            primaryColor: '#8b5cf6',
                            backgroundColor: '#0c0a1d',
                            textColor: '#ffffff',
                            labelColor: '#c4b5fd',
                            placeholderColor: '#8b5cf6',
                            buttonTextColor: '#ffffff',
                            buttonHoverColor: '#7c3aed',
                            inputBorderColor: '#6d28d9',
                            inputBackgroundColor: '#1e1533',
                            inputFocusBorderColor: '#a78bfa',
                            titleColor: '#ffffff',
                            descriptionColor: '#c4b5fd',
                          })}
                          className="px-3 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Violet
                        </button>
                        <button
                          onClick={() => setStyles({
                            ...styles,
                            primaryColor: '#0ea5e9',
                            backgroundColor: '#0c1929',
                            textColor: '#ffffff',
                            labelColor: '#7dd3fc',
                            placeholderColor: '#38bdf8',
                            buttonTextColor: '#ffffff',
                            buttonHoverColor: '#0284c7',
                            inputBorderColor: '#0369a1',
                            inputBackgroundColor: '#0c1e2f',
                            inputFocusBorderColor: '#38bdf8',
                            titleColor: '#ffffff',
                            descriptionColor: '#7dd3fc',
                          })}
                          className="px-3 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          Sky
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              )}

              {/* Effects Tab */}
              {builderTab === 'effects' && widgetType === 'chatbot' && (
                <div className="space-y-4">
                  {/* Gradient Effects */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4">Gradient Effects</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Chat Background Gradient</label>
                        <input
                          type="text"
                          value={chatbotConfig.chatBackgroundGradient || ''}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, chatBackgroundGradient: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white font-mono text-xs"
                          placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        />
                        {chatbotConfig.chatBackgroundGradient && (
                          <div className="mt-2 h-12 rounded-lg border border-gray-700" style={{ background: chatbotConfig.chatBackgroundGradient }} />
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Header Gradient</label>
                        <input
                          type="text"
                          value={chatbotConfig.headerGradient || ''}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, headerGradient: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white font-mono text-xs"
                          placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        />
                        {chatbotConfig.headerGradient && (
                          <div className="mt-2 h-12 rounded-lg border border-gray-700" style={{ background: chatbotConfig.headerGradient }} />
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Bot Message Gradient</label>
                        <input
                          type="text"
                          value={chatbotConfig.botMessageGradient || ''}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, botMessageGradient: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white font-mono text-xs"
                          placeholder="linear-gradient(135deg, #1e293b 0%, #334155 100%)"
                        />
                        {chatbotConfig.botMessageGradient && (
                          <div className="mt-2 h-12 rounded-lg border border-gray-700" style={{ background: chatbotConfig.botMessageGradient }} />
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">User Message Gradient</label>
                        <input
                          type="text"
                          value={chatbotConfig.userMessageGradient || ''}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, userMessageGradient: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white font-mono text-xs"
                          placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        />
                        {chatbotConfig.userMessageGradient && (
                          <div className="mt-2 h-12 rounded-lg border border-gray-700" style={{ background: chatbotConfig.userMessageGradient }} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Glow Effects */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4">Glow Effects</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input
                            type="checkbox"
                            checked={chatbotConfig.botMessageGlow}
                            onChange={(e) => setChatbotConfig({ ...chatbotConfig, botMessageGlow: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                          />
                          <span className="text-sm text-gray-300">Enable Bot Message Glow</span>
                        </label>
                        {chatbotConfig.botMessageGlow && (
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Bot Glow Color</label>
                            <input
                              type="color"
                              value={chatbotConfig.botMessageGlowColor}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, botMessageGlowColor: e.target.value })}
                              className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input
                            type="checkbox"
                            checked={chatbotConfig.userMessageGlow}
                            onChange={(e) => setChatbotConfig({ ...chatbotConfig, userMessageGlow: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                          />
                          <span className="text-sm text-gray-300">Enable User Message Glow</span>
                        </label>
                        {chatbotConfig.userMessageGlow && (
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">User Glow Color</label>
                            <input
                              type="color"
                              value={chatbotConfig.userMessageGlowColor}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, userMessageGlowColor: e.target.value })}
                              className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                          <input
                            type="checkbox"
                            checked={chatbotConfig.bubbleGlow}
                            onChange={(e) => setChatbotConfig({ ...chatbotConfig, bubbleGlow: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                          />
                          <span className="text-sm text-gray-300">Enable Bubble Glow</span>
                        </label>
                        {chatbotConfig.bubbleGlow && (
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Bubble Glow Color</label>
                            <input
                              type="color"
                              value={chatbotConfig.bubbleGlowColor}
                              onChange={(e) => setChatbotConfig({ ...chatbotConfig, bubbleGlowColor: e.target.value })}
                              className="w-full h-12 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Glass Effects */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4">Glass & Blur Effects</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={chatbotConfig.glassEffect}
                            onChange={(e) => setChatbotConfig({ ...chatbotConfig, glassEffect: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-white focus:ring-white"
                          />
                          <span className="text-sm text-gray-300">Enable Glassmorphism Effect</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-2">Adds a frosted glass effect to the chat window</p>
                      </div>
                    </div>
                  </div>

                  {/* Typing Indicator */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4">Typing Indicator</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Animation Style</label>
                        <select
                          value={chatbotConfig.typingIndicator}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, typingIndicator: e.target.value as any })}
                          className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                        >
                          <option value="dots">Bouncing Dots</option>
                          <option value="pulse">Pulsing Dots</option>
                          <option value="wave">Wave Dots</option>
                          <option value="none">None (Disabled)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">Three-dot animation shown while AI is responding</p>
                      </div>
                      {/* Live Preview */}
                      {chatbotConfig.typingIndicator !== 'none' && (
                        <div className="mt-4">
                          <label className="block text-sm text-gray-400 mb-2">Preview</label>
                          <div className="flex items-center gap-1.5 p-4 bg-gray-800/30 rounded-lg">
                            <style>{`
                              @keyframes typing-dots-preview {
                                0%, 20% { opacity: 0.3; transform: translateY(0); }
                                50% { opacity: 1; transform: translateY(-4px); }
                                80%, 100% { opacity: 0.3; transform: translateY(0); }
                              }
                              @keyframes typing-pulse-preview {
                                0%, 100% { opacity: 0.3; transform: scale(0.8); }
                                50% { opacity: 1; transform: scale(1); }
                              }
                              @keyframes typing-wave-preview {
                                0%, 100% { transform: translateY(0); }
                                50% { transform: translateY(-6px); }
                              }
                            `}</style>
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                className="w-2.5 h-2.5 rounded-full bg-white"
                                style={{
                                  animation: chatbotConfig.typingIndicator === 'dots'
                                    ? `typing-dots-preview 1.4s ease-in-out infinite ${i * 0.15}s`
                                    : chatbotConfig.typingIndicator === 'pulse'
                                    ? `typing-pulse-preview 1.4s ease-in-out infinite ${i * 0.15}s`
                                    : `typing-wave-preview 1.2s ease-in-out infinite ${i * 0.15}s`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Animations Tab */}
              {builderTab === 'animations' && widgetType === 'chatbot' && (
                <div className="space-y-4">
                  {/* Bubble Animations */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4">Bubble Animations</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Bubble Animation</label>
                        <select
                          value={chatbotConfig.bubbleAnimation}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, bubbleAnimation: e.target.value as any })}
                          className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                        >
                          <option value="none">None</option>
                          <option value="pulse">Pulse</option>
                          <option value="bounce">Bounce</option>
                          <option value="shake">Shake</option>
                          <option value="wiggle">Wiggle</option>
                        </select>
                        {chatbotConfig.bubbleAnimation !== 'none' && (
                          <div className="mt-4 flex justify-center">
                            <div
                              className={cn(
                                "w-16 h-16 rounded-full flex items-center justify-center text-2xl",
                                chatbotConfig.bubbleAnimation === 'pulse' && 'animate-pulse',
                                chatbotConfig.bubbleAnimation === 'bounce' && 'animate-bounce',
                              )}
                              style={{ background: chatbotConfig.bubbleGradient || chatbotConfig.bubbleColor }}
                            >
                              {chatbotConfig.bubbleIcon}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Message Animations */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4">Message Animations</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Message Entry Animation</label>
                        <select
                          value={chatbotConfig.messageAnimation || 'slideIn'}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, messageAnimation: e.target.value as any })}
                          className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                        >
                          <option value="none">None</option>
                          <option value="slideIn">Slide In</option>
                          <option value="fadeIn">Fade In</option>
                          <option value="scaleIn">Scale In</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Typing Indicator Style</label>
                        <select
                          value={chatbotConfig.typingIndicator}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, typingIndicator: e.target.value as any })}
                          className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                        >
                          <option value="dots">Bouncing Dots</option>
                          <option value="pulse">Pulsing Dots</option>
                          <option value="wave">Wave Dots</option>
                          <option value="none">None (Disabled)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">Classic three-dot animation while AI is responding</p>
                      </div>
                    </div>
                  </div>

                  {/* Window Animations */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium mb-4">Window Animations</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Chat Window Entry</label>
                        <select
                          value={chatbotConfig.windowAnimation || 'slideUp'}
                          onChange={(e) => setChatbotConfig({ ...chatbotConfig, windowAnimation: e.target.value as any })}
                          className="w-full px-4 py-2.5 bg-gray-800/30 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors"
                        >
                          <option value="none">None</option>
                          <option value="slideUp">Slide Up</option>
                          <option value="fadeIn">Fade In</option>
                          <option value="scaleIn">Scale In</option>
                          <option value="flipIn">Flip In</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Live Preview */}
            <div className="lg:sticky lg:top-28 flex flex-col">
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl flex flex-col relative" style={{height: `${previewHeight}px`, overflow: 'hidden'}}>
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-400">Live Preview</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyEmbedCode}
                      disabled={!savedWidgetId}
                      className="relative px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:hover:bg-transparent"
                      title={!savedWidgetId ? "Save component first to get share links" : "Copy embed code"}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {embedCodeCopied ? (
                        <span className="text-green-400 font-medium">Copied!</span>
                      ) : (
                        <span>Embed Code</span>
                      )}
                    </button>
                    <button
                      onClick={() => setPreviewBg(previewBg === 'dark' ? 'light' : 'dark')}
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                      title={`Switch to ${previewBg === 'dark' ? 'light' : 'dark'} background`}
                    >
                      {previewBg === 'dark' ? (
                        <Sun className="w-4 h-4" />
                      ) : (
                        <Moon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div
                  className="p-4 overflow-y-auto flex-1"
                  style={{
                    backgroundColor: widgetType === 'chatbot' ? 'transparent' : (previewBg === 'light' ? '#ffffff' : '#0a0a0a')
                  }}
                >
                  {/* Dynamic placeholder and ring styles */}
                  <style>{`
                    .widget-preview-input::placeholder {
                      color: ${styles.placeholderColor} !important;
                      opacity: 1;
                    }
                    .widget-preview-field.ring-2 {
                      --tw-ring-offset-color: ${styles.backgroundColor};
                    }
                    .widget-preview-input:focus {
                      border-color: ${styles.inputFocusBorderColor} !important;
                      box-shadow: ${styles.inputFocusShadow !== 'none' ? styles.inputFocusShadow : 'none'} !important;
                    }
                    .widget-preview-button:hover {
                      background-color: ${styles.buttonHoverColor} !important;
                    }
                  `}</style>
                  {/* preview component */}
                  <div
                    className={widgetType === 'chatbot' ? 'min-h-[600px]' : 'min-h-[300px]'}
                    style={{
                      backgroundColor: widgetType === 'chatbot' ? 'transparent' : styles.backgroundColor,
                      fontFamily: styles.fontFamily,
                      borderRadius: `${styles.borderRadius}px`,
                      padding: widgetType === 'chatbot' ? '0' : `${styles.formPadding}px`,
                      maxWidth: `${styles.formMaxWidth}px`,
                      boxShadow: widgetType === 'chatbot' ? 'none' : (styles.formShadow !== 'none' ? styles.formShadow : 'none'),
                      margin: '0 auto',
                    }}
                  >
                    {widgetType === 'chatbot' ? (
                      <div className="relative h-full min-h-[600px]">
                        {/* Chatbot Preview based on display mode */}
                        {chatbotConfig.displayMode === 'popup' && (
                          <div className="relative h-full flex items-end justify-end p-4 gap-4">
                            {/* Chat window (preview shown as open) */}
                            <div
                              className="flex flex-col shadow-2xl"
                              style={{
                                width: '70%',
                                height: `${chatbotConfig.chatHeight}px`,
                                maxWidth: '70%',
                                maxHeight: '100%',
                                borderRadius: `${chatbotConfig.borderRadius}px`,
                                fontFamily: chatbotConfig.fontFamily,
                                background: chatbotConfig.chatBackgroundGradient || chatbotConfig.chatBackgroundColor,
                                overflow: 'hidden',
                                direction: chatbotConfig.direction,
                                ...(chatbotConfig.glassEffect && {
                                  backdropFilter: `blur(${chatbotConfig.backdropBlur}px)`,
                                  backgroundColor: 'rgba(0,0,0,0.3)'
                                }),
                                boxShadow: chatbotConfig.boxShadow,
                              }}
                            >
                              {/* Header */}
                              <div
                                className="px-4 py-3 flex items-center gap-3"
                                style={{
                                  background: chatbotConfig.headerGradient || chatbotConfig.headerColor,
                                  color: chatbotConfig.headerTextColor,
                                  textAlign: chatbotConfig.textAlign as any,
                                  fontSize: `${chatbotConfig.fontSize}px`,
                                  fontWeight: chatbotConfig.fontWeight,
                                }}
                              >
                                {chatbotConfig.chatbotLogo && (
                                  <img
                                    src={chatbotConfig.chatbotLogo}
                                    alt="Logo"
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                )}
                                <span className="font-medium">{chatbotConfig.chatbotName}</span>
                              </div>

                              {/* Messages area */}
                              <div className="flex-1 p-4 overflow-y-auto" style={{ gap: `${chatbotConfig.messageSpacing}px`, display: 'flex', flexDirection: 'column' }}>
                                {/* Welcome message */}
                                <div className={`flex gap-2 items-end ${chatbotConfig.direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                                  {(chatbotConfig.showAvatar || chatbotConfig.avatarIcon) && (
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                                      style={{
                                        backgroundColor: chatbotConfig.botMessageColor,
                                      }}
                                    >
                                      {chatbotConfig.avatarIcon || '🤖'}
                                    </div>
                                  )}
                                  <div
                                    className="px-4 py-2 max-w-[70%]"
                                    style={{
                                      background: chatbotConfig.botMessageGradient || chatbotConfig.botMessageColor,
                                      color: chatbotConfig.botMessageTextColor,
                                      borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                      fontSize: `${chatbotConfig.fontSize}px`,
                                      fontWeight: chatbotConfig.fontWeight,
                                      lineHeight: chatbotConfig.lineHeight,
                                      letterSpacing: `${chatbotConfig.letterSpacing}px`,
                                      textTransform: chatbotConfig.textTransform as any,
                                      padding: `${chatbotConfig.messagePadding}px`,
                                      boxShadow: chatbotConfig.botMessageShadow,
                                      ...(chatbotConfig.botMessageGlow && { filter: `drop-shadow(0 0 10px ${chatbotConfig.botMessageGlowColor})` }),
                                    }}
                                  >
                                    {chatbotConfig.welcomeMessage}
                                  </div>
                                </div>

                                {/* Dynamic messages */}
                                {chatMessages.map((msg, idx) => (
                                  <div key={idx} className={`flex gap-2 ${msg.isUser ? (chatbotConfig.direction === 'rtl' ? '' : 'justify-end') : (chatbotConfig.direction === 'rtl' ? 'flex-row-reverse' : '')} ${msg.isUser ? '' : 'items-end'}`}>
                                    {!msg.isUser && (chatbotConfig.showAvatar || chatbotConfig.avatarIcon) && (
                                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                                        style={{
                                          backgroundColor: chatbotConfig.botMessageColor,
                                        }}
                                      >
                                        {chatbotConfig.avatarIcon || '🤖'}
                                      </div>
                                    )}
                                    <div
                                      className="px-4 py-2 max-w-[70%]"
                                      style={{
                                        background: msg.isUser
                                          ? (chatbotConfig.userMessageGradient || chatbotConfig.userMessageColor)
                                          : (chatbotConfig.botMessageGradient || chatbotConfig.botMessageColor),
                                        color: msg.isUser ? chatbotConfig.userMessageTextColor : chatbotConfig.botMessageTextColor,
                                        borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                        fontSize: `${chatbotConfig.fontSize}px`,
                                        fontWeight: chatbotConfig.fontWeight,
                                        lineHeight: chatbotConfig.lineHeight,
                                        letterSpacing: `${chatbotConfig.letterSpacing}px`,
                                        textTransform: chatbotConfig.textTransform as any,
                                        padding: `${chatbotConfig.messagePadding}px`,
                                        boxShadow: msg.isUser ? chatbotConfig.userMessageShadow : chatbotConfig.botMessageShadow,
                                        ...(msg.isUser && chatbotConfig.userMessageGlow && { filter: `drop-shadow(0 0 10px ${chatbotConfig.userMessageGlowColor})` }),
                                        ...(!msg.isUser && chatbotConfig.botMessageGlow && { filter: `drop-shadow(0 0 10px ${chatbotConfig.botMessageGlowColor})` }),
                                      }}
                                    >
                                      {msg.text}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Input area */}
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!chatInput.trim()) return;

                                  // Add user message
                                  setChatMessages([...chatMessages, { text: chatInput, isUser: true }]);
                                  setChatInput('');

                                  // Add bot response after a delay
                                  setTimeout(() => {
                                    setChatMessages(prev => [...prev, { text: 'Hi there! This is a preview. The actual chatbot will connect to your workflow.', isUser: false }]);
                                  }, 500);
                                }}
                                className="p-3 border-t"
                                style={{ borderColor: chatbotConfig.botMessageColor }}
                              >
                                <div className="flex gap-2 items-center">
                                  {chatbotConfig.allowFileUploads && (
                                    <button
                                      type="button"
                                      className="p-2 rounded-lg transition-colors hover:opacity-80"
                                      style={{
                                        backgroundColor: chatbotConfig.botMessageColor,
                                        color: chatbotConfig.botMessageTextColor,
                                        borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                      }}
                                      title="Attach file"
                                    >
                                      <Paperclip className="w-4 h-4" />
                                    </button>
                                  )}
                                  <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder={chatbotConfig.placeholder}
                                    className="flex-1 px-4 py-2 outline-none"
                                    style={{
                                      backgroundColor: chatbotConfig.botMessageColor,
                                      color: chatbotConfig.botMessageTextColor,
                                      borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                      fontSize: '14px',
                                    }}
                                  />
                                  <button
                                    type="submit"
                                    className="px-3 py-2 rounded-lg transition-colors flex items-center justify-center"
                                    style={{
                                      background: chatbotConfig.headerGradient || chatbotConfig.headerColor,
                                      color: chatbotConfig.headerTextColor,
                                      borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                    }}
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                </div>
                              </form>

                              {/* Watermark */}
                              {chatbotConfig.showWatermark && (
                                <div className="px-3 py-2 text-center text-xs opacity-50" style={{ color: chatbotConfig.botMessageTextColor }}>
                                  Powered by FlowEngine
                                </div>
                              )}
                            </div>

                            {/* Chat bubble - positioned next to chat window */}
                            <div
                              className="flex items-center justify-center cursor-pointer shadow-lg transition-transform hover:scale-105 flex-shrink-0"
                              style={{
                                background: chatbotConfig.bubbleGradient || chatbotConfig.bubbleColor,
                                width: `${chatbotConfig.bubbleSize}px`,
                                height: `${chatbotConfig.bubbleSize}px`,
                                fontSize: `${parseInt(chatbotConfig.bubbleSize) / 2.5}px`,
                                borderRadius: chatbotConfig.bubbleShape === 'circle' ? '50%' : chatbotConfig.bubbleShape === 'rounded-square' ? '20%' : '8px',
                                ...(chatbotConfig.bubbleGlow && { boxShadow: `0 0 30px ${chatbotConfig.bubbleGlowColor}` }),
                              }}
                            >
                              {chatbotConfig.bubbleIcon}
                            </div>
                          </div>
                        )}

                        {chatbotConfig.displayMode === 'embedded' && (
                          <div
                            className="flex flex-col shadow-2xl h-full"
                            style={{
                              borderRadius: `${chatbotConfig.borderRadius}px`,
                              fontFamily: chatbotConfig.fontFamily,
                              background: chatbotConfig.chatBackgroundGradient || chatbotConfig.chatBackgroundColor,
                              overflow: 'hidden',
                              direction: chatbotConfig.direction,
                              ...(chatbotConfig.glassEffect && {
                                backdropFilter: `blur(${chatbotConfig.backdropBlur}px)`,
                                backgroundColor: 'rgba(0,0,0,0.3)'
                              }),
                              boxShadow: chatbotConfig.boxShadow,
                            }}
                          >
                            {/* Header */}
                            <div
                              className="px-4 py-3 flex items-center gap-3"
                              style={{
                                background: chatbotConfig.headerGradient || chatbotConfig.headerColor,
                                color: chatbotConfig.headerTextColor,
                                textAlign: chatbotConfig.textAlign as any,
                                fontSize: `${chatbotConfig.fontSize}px`,
                                fontWeight: chatbotConfig.fontWeight,
                              }}
                            >
                              {chatbotConfig.chatbotLogo && (
                                <img
                                  src={chatbotConfig.chatbotLogo}
                                  alt="Logo"
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              )}
                              <span className="font-medium">{chatbotConfig.chatbotName}</span>
                            </div>

                            {/* Messages area */}
                            <div className="flex-1 p-4 overflow-y-auto" style={{ gap: `${chatbotConfig.messageSpacing}px`, display: 'flex', flexDirection: 'column' }}>
                              {/* Bot message */}
                              <div className={`flex gap-2 items-end ${chatbotConfig.direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                                {(chatbotConfig.showAvatar || chatbotConfig.avatarIcon) && (
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                                    style={{
                                      backgroundColor: chatbotConfig.botMessageColor,
                                    }}
                                  >
                                    {chatbotConfig.avatarIcon || '🤖'}
                                  </div>
                                )}
                                <div
                                  className="px-4 py-2 max-w-[70%]"
                                  style={{
                                    background: chatbotConfig.botMessageGradient || chatbotConfig.botMessageColor,
                                    color: chatbotConfig.botMessageTextColor,
                                    borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                    fontSize: `${chatbotConfig.fontSize}px`,
                                    fontWeight: chatbotConfig.fontWeight,
                                    lineHeight: chatbotConfig.lineHeight,
                                    letterSpacing: `${chatbotConfig.letterSpacing}px`,
                                    textTransform: chatbotConfig.textTransform as any,
                                    padding: `${chatbotConfig.messagePadding}px`,
                                    boxShadow: chatbotConfig.botMessageShadow,
                                    ...(chatbotConfig.botMessageGlow && { filter: `drop-shadow(0 0 10px ${chatbotConfig.botMessageGlowColor})` }),
                                  }}
                                >
                                  {chatbotConfig.welcomeMessage}
                                </div>
                              </div>

                              {/* User message (example) */}
                              <div className={`flex gap-2 ${chatbotConfig.direction === 'rtl' ? '' : 'justify-end'}`}>
                                <div
                                  className="px-4 py-2 max-w-[80%]"
                                  style={{
                                    background: chatbotConfig.userMessageGradient || chatbotConfig.userMessageColor,
                                    color: chatbotConfig.userMessageTextColor,
                                    borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                    fontSize: `${chatbotConfig.fontSize}px`,
                                    fontWeight: chatbotConfig.fontWeight,
                                    lineHeight: chatbotConfig.lineHeight,
                                    letterSpacing: `${chatbotConfig.letterSpacing}px`,
                                    textTransform: chatbotConfig.textTransform as any,
                                    padding: `${chatbotConfig.messagePadding}px`,
                                    boxShadow: chatbotConfig.userMessageShadow,
                                    ...(chatbotConfig.userMessageGlow && { filter: `drop-shadow(0 0 10px ${chatbotConfig.userMessageGlowColor})` }),
                                  }}
                                >
                                  Hello! I need help
                                </div>
                              </div>
                            </div>

                            {/* Input area */}
                            <div className="p-3 border-t" style={{ borderColor: chatbotConfig.botMessageColor }}>
                              <div className="flex gap-2 items-center">
                                {chatbotConfig.allowFileUploads && (
                                  <button
                                    type="button"
                                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                                    style={{
                                      backgroundColor: chatbotConfig.botMessageColor,
                                      color: chatbotConfig.botMessageTextColor,
                                      borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                    }}
                                    title="Attach file"
                                  >
                                    <Paperclip className="w-4 h-4" />
                                  </button>
                                )}
                                <input
                                  type="text"
                                  placeholder={chatbotConfig.placeholder}
                                  readOnly
                                  className="flex-1 px-4 py-2 outline-none"
                                  style={{
                                    backgroundColor: chatbotConfig.botMessageColor,
                                    color: chatbotConfig.botMessageTextColor,
                                    borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                    fontSize: '14px',
                                  }}
                                />
                                <button
                                  type="button"
                                  className="px-3 py-2 rounded-lg transition-colors flex items-center justify-center"
                                  style={{
                                    background: chatbotConfig.headerGradient || chatbotConfig.headerColor,
                                    color: chatbotConfig.headerTextColor,
                                    borderRadius: `${parseInt(chatbotConfig.borderRadius) / 2}px`,
                                  }}
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Watermark */}
                            {chatbotConfig.showWatermark && (
                              <div className="px-3 py-2 text-center text-xs opacity-50" style={{ color: chatbotConfig.botMessageTextColor }}>
                                Powered by FlowEngine
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : widgetType === 'form' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: `${styles.fieldSpacing}px` }}>
                        {/* Title */}
                        {styles.showTitle && (
                          <div style={{ textAlign: styles.titleAlignment as 'left' | 'center' | 'right' }}>
                            <h2
                              style={{
                                color: styles.titleColor,
                                fontSize: `${styles.titleFontSize}px`,
                                fontWeight: styles.titleFontWeight,
                                marginBottom: styles.showDescription ? '8px' : '0',
                              }}
                            >
                              {styles.formTitle}
                            </h2>
                            {styles.showDescription && (
                              <p
                                style={{
                                  color: styles.descriptionColor,
                                  fontSize: `${styles.descriptionFontSize}px`,
                                }}
                              >
                                {styles.formDescription}
                              </p>
                            )}
                          </div>
                        )}
                        {formFields.length === 0 && !styles.showTitle && (
                          <div className="text-center py-8">
                            <p style={{ color: styles.labelColor, opacity: 0.5, fontSize: `${styles.labelFontSize}px` }}>
                              Add fields to see preview
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4">
                          {formFields.map((field, index) => (
                            <div
                              key={index}
                              onClick={() => setSelectedFieldIndex(index)}
                              className={`widget-preview-field cursor-pointer transition-all ${
                                selectedFieldIndex === index ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg' : ''
                              }`}
                              style={{
                                width: field.width ? `calc(${field.width}% - 1rem)` : '100%',
                                flexGrow: 0,
                                flexShrink: 0,
                              }}
                            >
                              <label
                                className="block"
                                style={{
                                  color: styles.labelColor,
                                  fontSize: `${styles.labelFontSize}px`,
                                  fontWeight: styles.labelFontWeight,
                                  marginBottom: `${styles.labelMarginBottom}px`,
                                }}
                              >
                                {field.name}
                                {field.required && (
                                  <span style={{ color: styles.requiredIndicatorColor, marginLeft: '4px' }}>*</span>
                                )}
                              </label>
                              {field.type === 'textarea' ? (
                                <textarea
                                  placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}...`}
                                  rows={3}
                                  readOnly
                                  className="w-full outline-none resize-none widget-preview-input"
                                  style={{
                                    backgroundColor: styles.inputBackgroundColor,
                                    borderColor: styles.inputBorderColor,
                                    color: styles.textColor,
                                    borderWidth: `${styles.inputBorderWidth}px`,
                                    borderStyle: 'solid',
                                    borderRadius: `${field.customBorderRadius || Math.min(parseInt(styles.borderRadius), 12)}px`,
                                    fontSize: `${field.customFontSize || styles.inputFontSize}px`,
                                    padding: `${field.customPadding || styles.inputPadding}px`,
                                  }}
                                />
                              ) : field.type === 'select' ? (
                                <select
                                  className="w-full outline-none widget-preview-input"
                                  style={{
                                    backgroundColor: styles.inputBackgroundColor,
                                    borderColor: styles.inputBorderColor,
                                    color: styles.textColor,
                                    borderWidth: `${styles.inputBorderWidth}px`,
                                    borderStyle: 'solid',
                                    borderRadius: `${field.customBorderRadius || Math.min(parseInt(styles.borderRadius), 12)}px`,
                                    fontSize: `${field.customFontSize || styles.inputFontSize}px`,
                                    padding: `${field.customPadding || styles.inputPadding}px`,
                                    height: field.customHeight ? `${field.customHeight}px` : 'auto',
                                  }}
                                >
                                  <option style={{ color: styles.placeholderColor }}>Select {field.name.toLowerCase()}...</option>
                                  {field.options?.map((opt, i) => (
                                    <option key={i}>{opt}</option>
                                  ))}
                                </select>
                              ) : field.type === 'checkbox' ? (
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4" style={{ accentColor: styles.primaryColor }} />
                                  <span style={{ color: styles.textColor, fontSize: `${field.customFontSize || styles.inputFontSize}px` }}>
                                    {field.placeholder || field.name}
                                  </span>
                                </label>
                              ) : field.type === 'radio' ? (
                                <div className="space-y-2">
                                  {(field.options || ['Option 1', 'Option 2']).map((opt, i) => (
                                    <label key={i} className="flex items-center gap-3 cursor-pointer">
                                      <input type="radio" name={`radio-${index}`} className="w-4 h-4" style={{ accentColor: styles.primaryColor }} />
                                      <span style={{ color: styles.textColor, fontSize: `${field.customFontSize || styles.inputFontSize}px` }}>
                                        {opt}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <input
                                  type={field.type}
                                  placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}...`}
                                  readOnly
                                  className="w-full outline-none widget-preview-input"
                                  style={{
                                    backgroundColor: styles.inputBackgroundColor,
                                    borderColor: styles.inputBorderColor,
                                    color: styles.textColor,
                                    borderWidth: `${styles.inputBorderWidth}px`,
                                    borderStyle: 'solid',
                                    borderRadius: `${field.customBorderRadius || Math.min(parseInt(styles.borderRadius), 12)}px`,
                                    fontSize: `${field.customFontSize || styles.inputFontSize}px`,
                                    padding: `${field.customPadding || styles.inputPadding}px`,
                                    height: field.customHeight ? `${field.customHeight}px` : 'auto',
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        {(formFields.length > 0 || styles.showTitle) && (
                          <button
                            type="button"
                            className="widget-preview-button transition-colors"
                            style={{
                              backgroundColor: styles.primaryColor,
                              color: styles.buttonTextColor,
                              borderRadius: `${Math.min(parseInt(styles.borderRadius), 12)}px`,
                              fontSize: `${styles.buttonFontSize}px`,
                              fontWeight: styles.buttonFontWeight,
                              padding: `${styles.buttonPadding}px`,
                              marginTop: `${parseInt(styles.fieldSpacing) / 2}px`,
                              width: styles.buttonWidth === 'full' ? '100%' : styles.buttonWidth === 'half' ? '50%' : 'auto',
                              boxShadow: styles.buttonShadow !== 'none' ? styles.buttonShadow : 'none',
                            }}
                          >
                            {styles.buttonText}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full min-h-[200px]">
                        <button
                          type="button"
                          className="widget-preview-button transition-colors"
                          style={{
                            backgroundColor: styles.primaryColor,
                            color: styles.buttonTextColor,
                            borderRadius: `${styles.borderRadius}px`,
                            fontSize: `${styles.buttonFontSize}px`,
                            fontWeight: styles.buttonFontWeight,
                            padding: `${styles.buttonPadding}px ${parseInt(styles.buttonPadding) * 2}px`,
                            boxShadow: styles.buttonShadow !== 'none' ? styles.buttonShadow : 'none',
                          }}
                        >
                          {styles.buttonText}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Resize Handle - Full Width Bottom Bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize hover:bg-white/5 group z-10"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startY = e.clientY;
                    const startHeight = previewHeight;

                    const handleMouseMove = (e: MouseEvent) => {
                      e.preventDefault();
                      const delta = e.clientY - startY;
                      const newHeight = Math.min(Math.max(startHeight + delta, 400), 1200);
                      setPreviewHeight(newHeight);
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                      document.body.style.cursor = '';
                      document.body.style.userSelect = '';
                    };

                    document.body.style.cursor = 'ns-resize';
                    document.body.style.userSelect = 'none';
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-16 h-1 bg-gray-600 rounded-full group-hover:bg-white/40" />
                  </div>
                </div>
              </div>

              {/* AI Widget Assistant - Always Visible */}
              <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl flex flex-col overflow-hidden relative" style={{height: `${aiChatHeight}px`}}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-800/50 border border-gray-700 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">AI Component Builder</span>
                      {aiChangeApplied && (
                        <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-800/30">
                          <Check className="w-3 h-3" />
                          Applied
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAiAssistantOpen(true);
                      setAiFullScreen(true);
                    }}
                    className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                    title="Expand to fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Messages - Fixed height with scroll */}
                <div className="flex-1 overflow-y-auto p-4">
                  {aiChatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-800/30 border border-gray-700 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-gray-400" />
                      </div>
                      <h4 className="text-white font-medium text-sm mb-2">Start Building</h4>
                      <p className="text-gray-400 text-xs mb-4">Describe what you want to create</p>
                      <div className="space-y-2">
                        <button
                          onClick={() => setAiInput('"Create a contact form with name, email, and message fields"')}
                          className="w-full text-left px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-xs text-gray-300 hover:border-gray-600 hover:bg-gray-800/50 transition-colors"
                        >
                          "Create a contact form..."
                        </button>
                        <button
                          onClick={() => setAiInput('"Make the button background blue with rounded corners"')}
                          className="w-full text-left px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-xs text-gray-300 hover:border-gray-600 hover:bg-gray-800/50 transition-colors"
                        >
                          "Make the button blue..."
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {aiChatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "flex gap-2",
                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          {msg.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-lg bg-gray-800/50 border border-gray-700 flex items-center justify-center flex-shrink-0">
                              <Sparkles className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                          <div
                            className={cn(
                              "px-3 py-2 rounded-lg max-w-[75%]",
                              msg.role === 'user'
                                ? 'bg-white text-black'
                                : 'bg-gray-800/30 border border-gray-700 text-gray-200'
                            )}
                          >
                            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                              {msg.content || (msg.role === 'assistant' && (
                                <span className="text-gray-500 italic">{AI_LOADING_PHASES[aiLoadingPhase]}</span>
                              ))}
                            </p>
                          </div>
                          {msg.role === 'user' && (
                            <div className="w-6 h-6 rounded-lg bg-white/10 border border-gray-700 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[10px] font-medium">You</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error */}
                {aiError && (
                  <div className="mx-4 mb-3 px-3 py-2 bg-red-900/20 border border-red-800 rounded-lg">
                    <p className="text-red-400 text-xs">{aiError}</p>
                  </div>
                )}

                {/* Input */}
                <div className="border-t border-gray-800 p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAiAssistantSubmit()}
                      placeholder="Describe what you want..."
                      disabled={aiIsLoading}
                      className="flex-1 px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white disabled:opacity-50 text-xs"
                    />
                    <button
                      onClick={handleAiAssistantSubmit}
                      disabled={aiIsLoading || !aiInput.trim()}
                      className="px-4 py-2 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg font-medium transition-colors flex items-center gap-2 text-xs"
                    >
                      {aiIsLoading ? (
                        <>
                          <RotateCcw className="w-3 h-3 animate-spin" />
                          <span>...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3" />
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </div>

                  {aiChatMessages.length > 0 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                      <span className="text-[10px] text-gray-500">
                        {aiChatMessages.length} message{aiChatMessages.length !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => {
                          setAiChatMessages([]);
                          setAiError(null);
                          setAiChangeApplied(false);
                        }}
                        className="text-[10px] text-gray-400 hover:text-white transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                {/* Resize Handle - Full Width Bottom Bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize hover:bg-white/5 group z-10"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startY = e.clientY;
                    const startHeight = aiChatHeight;

                    const handleMouseMove = (e: MouseEvent) => {
                      e.preventDefault();
                      const delta = e.clientY - startY;
                      const newHeight = Math.min(Math.max(startHeight + delta, 300), 800);
                      setAiChatHeight(newHeight);
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                      document.body.style.cursor = '';
                      document.body.style.userSelect = '';
                    };

                    document.body.style.cursor = 'ns-resize';
                    document.body.style.userSelect = 'none';
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-16 h-1 bg-gray-600 rounded-full group-hover:bg-white/40" />
                  </div>
                </div>
              </div>

              {/* Share Links - Below Preview */}
              <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <p className="text-sm font-medium text-white mb-3">Share & Embed</p>
                {!savedWidgetId ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-4">Save your component to get share links</p>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={isSaving || !widgetName.trim()}
                      className="px-6 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save & Share'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Direct Link */}
                    <div className="px-3 py-2.5 bg-gray-800/30 border border-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <LinkIcon className="h-3.5 w-3.5 text-purple-400" />
                        <span className="text-xs text-white">Direct Link</span>
                      </div>
                      <div className="flex gap-1.5">
                        <a
                          href={`${originUrl}/w/${savedWidgetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 hover:border-gray-600 rounded text-[10px] text-gray-400 hover:text-gray-300 overflow-x-auto transition-colors truncate"
                        >
                          {`${originUrl}/w/${savedWidgetId}`}
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${originUrl}/w/${savedWidgetId}`);
                            setShareLinkCopied(true);
                            setTimeout(() => setShareLinkCopied(false), 2000);
                          }}
                          className={cn(
                            'px-2 py-1.5 rounded text-xs transition-all',
                            shareLinkCopied ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          )}
                        >
                          {shareLinkCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Embed Code */}
                    <details className="group bg-gray-800/30 border border-gray-700/50 rounded-lg overflow-hidden">
                      <summary className="px-3 py-2.5 cursor-pointer flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <Code2 className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-xs text-white">iFrame Embed</span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 text-gray-500 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-3 pb-2.5">
                        <div className="flex gap-1.5">
                          <pre className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap">
                            {generateEmbedCode()}
                          </pre>
                          <button
                            onClick={handleCopyEmbedCode}
                            className={cn(
                              'px-2 py-1.5 rounded text-xs transition-all self-start',
                              embedCodeCopied ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            )}
                          >
                            {embedCodeCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    </details>

                    {/* QR Code */}
                    <details className="group bg-gray-800/30 border border-gray-700/50 rounded-lg overflow-hidden">
                      <summary className="px-3 py-2.5 cursor-pointer flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <QrCode className="h-3.5 w-3.5 text-cyan-400" />
                          <span className="text-xs text-white">QR Code</span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 text-gray-500 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-3 pb-2.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${originUrl}/w/${savedWidgetId}`)}`}
                            alt="QR Code"
                            className="w-16 h-16 rounded bg-white p-1"
                          />
                          <a
                            href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${originUrl}/w/${savedWidgetId}`)}`}
                            download={`${widgetName}-qr.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded text-xs transition-all"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Template List View
  return (
    <div className={embedded ? "flex-1 overflow-y-auto text-white" : "min-h-screen bg-black text-white"}>
      <div className={cn("max-w-4xl mx-auto px-6", embedded ? "pt-6 pb-8" : "pt-28 pb-16")}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gray-900/50 border border-gray-800 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-gray-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold">UI Studio</h1>
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded text-white/60 border border-gray-700">Beta</span>
            </div>
            <p className="text-gray-400 text-sm">
              Create UI embed templates to assign to your client workflows
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSelectMode(!isSelectMode)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm",
                isSelectMode
                  ? "bg-white text-black font-medium"
                  : "text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700"
              )}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Select</span>
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg transition-all text-sm"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </button>
            <button
              onClick={handleCreateWidget}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>
        </div>

        {/* Select Mode Bar */}
        {isSelectMode && (
          <div className="flex items-center justify-between gap-3 mb-6 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-sm text-white font-medium">
                {selectedTemplateIds.size} selected
              </span>
              <button
                onClick={selectAllTemplates}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Select all
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkTagsModal(true)}
                disabled={selectedTemplateIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Tag className="w-4 h-4" />
                Edit Tags
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={selectedTemplateIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-800 hover:border-red-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={exitSelectMode}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Instance Filters & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Instance Pills - same as client-panel tabs */}
          <div className="flex-1 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedInstanceFilter(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                !selectedInstanceFilter
                  ? 'bg-white text-black'
                  : 'bg-gray-900/50 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              All
            </button>
            {instances.map((inst) => (
              <button
                key={inst.id}
                onClick={() => setSelectedInstanceFilter(inst.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedInstanceFilter === inst.id
                    ? 'bg-white text-black'
                    : 'bg-gray-900/50 text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {inst.instance_name}
              </button>
            ))}
          </div>

          {/* Search */}
          {templates.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white text-sm"
              />
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : templates.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gray-900/50 border border-gray-800 flex items-center justify-center">
              <Layers className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium mb-2">No UI embeds yet</h3>
            <p className="text-gray-400 text-sm mb-8 max-w-xs mx-auto">
              Create your first component template to start building forms and buttons for your clients
            </p>
            <button
              onClick={handleCreateWidget}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-gray-100 text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Component
            </button>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-10 h-10 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No UI embeds match your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => {
                  if (isSelectMode) {
                    toggleTemplateSelection(template.id);
                  }
                }}
                className={cn(
                  "group bg-gray-900/50 border rounded-xl p-5 hover:bg-gray-800/30 transition-all",
                  isSelectMode ? "cursor-pointer" : "",
                  selectedTemplateIds.has(template.id)
                    ? "border-white bg-gray-800/50"
                    : "border-gray-800 hover:border-gray-700"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* Checkbox in select mode */}
                    {isSelectMode && (
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
                          selectedTemplateIds.has(template.id)
                            ? "bg-white border-white"
                            : "border-gray-600 hover:border-gray-500"
                        )}
                      >
                        {selectedTemplateIds.has(template.id) && (
                          <Check className="w-3 h-3 text-black" />
                        )}
                      </div>
                    )}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      template.widget_type === 'button'
                        ? 'bg-blue-500/20'
                        : template.widget_type === 'chatbot'
                        ? 'bg-purple-500/20'
                        : 'bg-emerald-500/20'
                    }`}>
                      {template.widget_type === 'button' ? (
                        <MousePointer className="h-6 w-6 text-blue-400" />
                      ) : template.widget_type === 'chatbot' ? (
                        <MessageCircle className="h-6 w-6 text-purple-400" />
                      ) : (
                        <FileText className="h-6 w-6 text-emerald-400" />
                      )}
                    </div>
                  </div>
                  {/* Hide menu in select mode */}
                  {!isSelectMode && (
                  <div className="flex items-center gap-2">
                    {/* 3-dot menu only - tags moved below name */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === template.id ? null : template.id);
                        }}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {activeMenu === template.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-44 py-1 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              handleCopyWidgetLink(template.id, isProPlus);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800 flex items-center gap-3"
                          >
                            <LinkIcon className="w-4 h-4" />
                            {linkCopied === template.id ? 'Link Copied!' : 'Copy Link'}
                          </button>
                          <button
                            onClick={() => handleDuplicateTemplate(template.id)}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800 flex items-center gap-3"
                          >
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenu(null);
                              setDeleteConfirm(template.id);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 flex items-center gap-3"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
                <button
                  onClick={() => !isSelectMode && enterBuilderMode(template)}
                  className={cn("w-full text-left", isSelectMode && "pointer-events-none")}
                >
                  <h3 className="text-white font-semibold mb-1 group-hover:text-white transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-gray-500 text-sm mb-3">
                    {template.widget_type === 'button' ? 'Button Component' : template.widget_type === 'chatbot' ? 'Chatbot Component' : 'Form Component'}
                    {template.widget_type === 'form' && template.form_fields && template.form_fields.length > 0 && ` · ${template.form_fields.length} fields`}
                  </p>
                  {/* Tags row */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {template.is_active === false && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/20 border border-yellow-900/40 text-yellow-400">
                        Draft
                      </span>
                    )}
                    {template.instance && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400">
                        {template.instance.instance_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs">Click to edit</span>
                    <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowCategoryModal(false)}
        >
          <div
            className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-medium mb-6">New Category</h3>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Lead Forms"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-3">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewCategoryColor(color)}
                        className={`w-8 h-8 rounded-lg transition-all ${
                          newCategoryColor === color
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 py-3 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                className="flex-1 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-center mb-2">Delete Component?</h3>
            <p className="text-gray-400 text-sm text-center mb-4">
              This template will be permanently deleted. Components already assigned to clients won&apos;t be affected.
            </p>
            {deleteError && (
              <p className="text-red-400 text-sm text-center mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTemplate(deleteConfirm)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {showBulkDeleteConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowBulkDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-center mb-2">Delete {selectedTemplateIds.size} Component{selectedTemplateIds.size !== 1 ? 's' : ''}?</h3>
            <p className="text-gray-400 text-sm text-center mb-4">
              These templates will be permanently deleted. Components already assigned to clients won&apos;t be affected.
            </p>
            {deleteError && (
              <p className="text-red-400 text-sm text-center mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isBulkDeleting}
                className="flex-1 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isBulkDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Tags Edit Modal */}
      {showBulkTagsModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => {
            setShowBulkTagsModal(false);
            setBulkTagsInstanceIds(new Set());
          }}
        >
          <div
            className="w-full max-w-sm bg-gray-900/50 border border-gray-800 rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium mb-2">Edit Tags</h3>
            <p className="text-gray-400 text-sm mb-6">
              Select tags to assign to {selectedTemplateIds.size} component{selectedTemplateIds.size !== 1 ? 's' : ''}.
            </p>

            <div className="space-y-2 mb-6">
              {instances.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => toggleBulkTagSelection(inst.id)}
                  className={cn(
                    "w-full p-4 rounded-lg text-left text-sm transition-all flex items-center gap-3",
                    bulkTagsInstanceIds.has(inst.id)
                      ? "bg-gray-800/30 border border-white"
                      : "bg-gray-800/30 border border-gray-800 hover:border-gray-700 hover:bg-gray-800/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
                      bulkTagsInstanceIds.has(inst.id)
                        ? "bg-white border-white"
                        : "border-gray-600"
                    )}
                  >
                    {bulkTagsInstanceIds.has(inst.id) && (
                      <Check className="w-3 h-3 text-black" />
                    )}
                  </div>
                  <span className={bulkTagsInstanceIds.has(inst.id) ? "text-white" : "text-gray-400"}>
                    {inst.instance_name}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkTagsModal(false);
                  setBulkTagsInstanceIds(new Set());
                }}
                className="flex-1 py-3 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdateTags}
                disabled={isBulkUpdating || bulkTagsInstanceIds.size === 0}
                className="flex-1 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isBulkUpdating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Apply'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="w-full max-w-lg bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-medium">How UI Studio Works</h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium mb-1">Create UI Embed Templates</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Build form or button UI embeds here with custom fields, colors, fonts, and styling.
                    These are reusable templates you can assign to multiple clients.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium mb-1">Link to Client Workflows</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Go to <span className="text-white font-medium">Client Panel</span> → select a client →
                    choose a workflow → assign your component template. The component will connect to that workflow&apos;s webhook.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium mb-1">Clients Use the Component</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    When clients submit the form or click the button, their data automatically flows
                    to the linked n8n workflow for processing.
                  </p>
                </div>
              </div>

              {/* Tip */}
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Palette className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-300">
                      <span className="font-medium text-white">Pro tip:</span> Use the Style tab to customize
                      text sizes, colors, spacing, and more. You can create different themes for different clients!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-800 flex justify-between items-center">
              <Link
                href="/n8n-account"
                className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Go to n8n Hosting
                <ExternalLink className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal - shown when user reaches their template limit */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowUpgradeModal(false)}
        >
          <div
            className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-900/20 border border-red-800 flex items-center justify-center">
                <Layers className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Active Component Limit Reached</h3>
              <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                {isPro && !isProPlus
                  ? `You can only have 5 active (live) UI embeds on Pro. Upgrade to Max for unlimited active UI embeds.`
                  : `Free accounts can only have 1 active (live) UI embed. Upgrade to activate more.`}
              </p>
              <div className="text-xs text-gray-500 mb-6 space-y-1">
                <p>Free: 1 active • Pro: 5 active • Max: Unlimited</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-800 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Maybe Later
                </button>
                <Link
                  href="/#pricing"
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function WidgetStudioPage({ embedded = false }: { embedded?: boolean } = {}) {
  const isEditorMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('editor') === 'true';

  const fallback = embedded ? (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-800/30 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-800/30 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-800/30 rounded-lg animate-pulse" />
      </div>
    </div>
  ) : isEditorMode ? (
    <div className="fixed inset-0 bg-black flex">
      <div className="w-[280px] border-r border-gray-800 flex flex-col">
        <div className="h-14 border-b border-gray-800 px-4 flex items-center gap-3">
          <div className="h-8 w-8 bg-gray-800/30 rounded-lg animate-pulse" />
          <div className="h-5 w-32 bg-gray-800/30 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-900/50 border border-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-[400px] h-[500px] bg-gray-900/50 border border-gray-800 rounded-xl animate-pulse" />
      </div>
      <div className="w-[300px] border-l border-gray-800 p-4 space-y-4">
        <div className="h-5 w-20 bg-gray-800/30 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-16 bg-gray-800/30 rounded animate-pulse" />
            <div className="h-9 bg-gray-900/50 border border-gray-800 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  ) : (
    <UIStudioSkeleton />
  );

  return (
    <Suspense fallback={fallback}>
      <WidgetStudioContent embedded={embedded} />
    </Suspense>
  );
}
