import { z } from 'zod';

// ============================================
// ChatbotConfig TypeScript Interface
// ============================================

export interface ChatbotConfig {
  // Display & Position
  displayMode: 'popup' | 'embedded';
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  // Bubble Settings
  bubbleColor: string;
  bubbleGradient?: string;
  bubbleSize: number;
  bubbleIcon: string;
  bubbleIconColor?: string;
  bubbleGlow: boolean;
  bubbleGlowColor?: string;
  bubbleAnimation: 'none' | 'pulse' | 'bounce' | 'shake' | 'glow';

  // Header
  chatbotName: string;
  headerColor: string;
  headerGradient?: string;
  headerTextColor: string;

  // Chat Background
  chatBackgroundColor: string;
  chatBackgroundGradient?: string;

  // Messages
  welcomeMessage: string;
  placeholder: string;
  userMessageColor: string;
  userMessageGradient?: string;
  userMessageTextColor: string;
  userMessageGlow?: boolean;
  userMessageGlowColor?: string;
  botMessageColor: string;
  botMessageGradient?: string;
  botMessageTextColor: string;
  botMessageGlow?: boolean;
  botMessageGlowColor?: string;

  // Avatars
  userAvatarColor?: string;
  userAvatarIcon?: string;
  userAvatarCustom?: string;
  botAvatarColor?: string;
  botAvatarIcon?: string;
  botAvatarCustom?: string;

  // Input
  inputBackgroundColor?: string;
  inputTextColor?: string;
  inputPlaceholderColor?: string;
  sendButtonColor?: string;

  // Typography
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: string;
  messagePadding: number;

  // Design
  borderRadius: number;
  borderStyle: 'none' | 'solid' | 'dashed';
  borderWidth: number;
  boxShadow: string;
  glassEffect: boolean;

  // Animations
  windowAnimation: 'none' | 'slideUp' | 'fadeIn' | 'scaleIn';
  typingIndicator: 'dots' | 'pulse' | 'wave' | 'none';

  // Greeting
  showGreeting: boolean;
  greetingMessage: string;
  greetingDelay: number;
  greetingAutoHide: boolean;

  // Auto Open
  autoOpen: boolean;
  autoOpenDelay: number;

  // Watermark (Pro feature)
  showWatermark?: boolean;

  // Rate limiting (simple client-side limit)
  maxMessagesPerSession?: number;

  // Button-specific (for button component type)
  buttonText?: string;
  buttonSize?: 'small' | 'medium' | 'large';
  buttonWidth?: 'auto' | 'full';
  buttonHoverEffect?: 'none' | 'scale' | 'glow';
  buttonIcon?: string;

  // Custom CSS for advanced styling
  customCSS?: string;

  // Text/Content alignment
  textAlign?: 'left' | 'center' | 'right';

  // File uploads
  allowFileUploads?: boolean;
  allowedFileMimeTypes?: string; // Comma-separated, e.g., "image/*,application/pdf,.doc,.docx"

  // Allow additional properties for flexibility
  [key: string]: unknown;
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'file' | 'checkbox' | 'radio' | 'phone' | 'url';
  required: boolean;
  options?: string[];
  placeholder?: string;
  width?: '25' | '33' | '50' | '100';
  alignment?: 'left' | 'center' | 'right';
  accept?: string; // For file type: accepted file types
  maxSize?: number; // For file type: max size in MB
  multiple?: boolean; // For file/select: allow multiple selections
  customBorderRadius?: string;
  customPadding?: string;
  customFontSize?: string;
  customHeight?: string;
}

export interface WidgetStyles {
  backgroundColor?: string;
  textColor?: string;
  primaryColor?: string;
  buttonTextColor?: string;
  buttonHoverColor?: string;
  inputBackgroundColor?: string;
  inputBorderColor?: string;
  borderRadius?: number;
  formTitle?: string;
  formDescription?: string;
  showDescription?: boolean;
  buttonText?: string;
  // Custom CSS for advanced styling
  customCSS?: string;
  // Text/Content alignment
  textAlign?: 'left' | 'center' | 'right';
  // Rate limiting
  maxSubmissionsPerSession?: number;
  [key: string]: unknown;
}

// ============================================
// Zod Validation Schemas for URL Parameters
// ============================================

// Flexible schema that accepts both string and number for size/measurement properties
// This ensures compatibility with existing code that uses strings like "60" or "14"
export const ChatbotConfigSchema = z.object({
  // Display & Position
  displayMode: z.enum(['popup', 'embedded']).optional(),
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),

  // Bubble Settings
  bubbleColor: z.string().optional(),
  bubbleGradient: z.string().optional(),
  bubbleSize: z.union([z.string(), z.number()]).optional(),
  bubbleIcon: z.string().optional(),
  bubbleIconColor: z.string().optional(),
  bubbleGlow: z.boolean().optional(),
  bubbleGlowColor: z.string().optional(),
  bubbleAnimation: z.enum(['none', 'pulse', 'bounce', 'shake', 'glow']).optional(),

  // Header
  chatbotName: z.string().max(100).optional(),
  headerColor: z.string().optional(),
  headerGradient: z.string().optional(),
  headerTextColor: z.string().optional(),

  // Chat Background
  chatBackgroundColor: z.string().optional(),
  chatBackgroundGradient: z.string().optional(),

  // Messages
  welcomeMessage: z.string().max(500).optional(),
  placeholder: z.string().max(200).optional(),
  userMessageColor: z.string().optional(),
  userMessageGradient: z.string().optional(),
  userMessageTextColor: z.string().optional(),
  userMessageGlow: z.boolean().optional(),
  userMessageGlowColor: z.string().optional(),
  botMessageColor: z.string().optional(),
  botMessageGradient: z.string().optional(),
  botMessageTextColor: z.string().optional(),
  botMessageGlow: z.boolean().optional(),
  botMessageGlowColor: z.string().optional(),

  // Avatars
  userAvatarColor: z.string().optional(),
  userAvatarIcon: z.string().optional(),
  userAvatarCustom: z.string().optional(),
  botAvatarColor: z.string().optional(),
  botAvatarIcon: z.string().optional(),
  botAvatarCustom: z.string().optional(),

  // Input
  inputBackgroundColor: z.string().optional(),
  inputTextColor: z.string().optional(),
  inputPlaceholderColor: z.string().optional(),
  sendButtonColor: z.string().optional(),

  // Typography
  fontFamily: z.string().optional(),
  fontSize: z.union([z.string(), z.number()]).optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.string().optional(),
  messagePadding: z.union([z.string(), z.number()]).optional(),

  // Design
  borderRadius: z.union([z.string(), z.number()]).optional(),
  borderStyle: z.enum(['none', 'solid', 'dashed', 'dotted', 'double']).optional(),
  borderWidth: z.union([z.string(), z.number()]).optional(),
  boxShadow: z.string().optional(),
  glassEffect: z.boolean().optional(),

  // Animations
  windowAnimation: z.enum(['none', 'slideUp', 'fadeIn', 'scaleIn', 'flipIn']).optional(),
  typingIndicator: z.enum(['dots', 'pulse', 'wave', 'none']).optional(),

  // Greeting
  showGreeting: z.boolean().optional(),
  greetingMessage: z.string().max(200).optional(),
  greetingDelay: z.number().min(0).max(30).optional(),
  greetingAutoHide: z.boolean().optional(),

  // Auto Open - can be boolean or string enum
  autoOpen: z.union([z.boolean(), z.enum(['always', 'delayed', 'click-only'])]).optional(),
  autoOpenDelay: z.number().min(0).max(60).optional(),

  // Watermark (Pro feature)
  showWatermark: z.boolean().optional(),

  // Rate limiting
  maxMessagesPerSession: z.number().min(0).max(1000).optional(),

  // Button-specific
  buttonText: z.string().max(100).optional(),
  buttonSize: z.enum(['small', 'medium', 'large']).optional(),
  buttonWidth: z.enum(['auto', 'full']).optional(),
  buttonHoverEffect: z.enum(['none', 'scale', 'glow']).optional(),
  buttonIcon: z.string().optional(),

  // Custom CSS
  customCSS: z.string().max(10000).optional(),

  // Text alignment
  textAlign: z.enum(['left', 'center', 'right']).optional(),

  // File uploads
  allowFileUploads: z.boolean().optional(),
  allowedFileMimeTypes: z.string().max(500).optional(),
}).passthrough(); // Allow additional properties

export const FormFieldSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['text', 'email', 'number', 'textarea', 'select', 'date', 'time', 'file', 'checkbox', 'radio', 'phone', 'url']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().max(200).optional(),
  width: z.enum(['25', '33', '50', '100']).optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
  accept: z.string().optional(),
  maxSize: z.number().optional(),
  multiple: z.boolean().optional(),
  customBorderRadius: z.string().optional(),
  customPadding: z.string().optional(),
  customFontSize: z.string().optional(),
  customHeight: z.string().optional(),
});

export const WidgetStylesSchema = z.object({
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  primaryColor: z.string().optional(),
  buttonTextColor: z.string().optional(),
  buttonHoverColor: z.string().optional(),
  inputBackgroundColor: z.string().optional(),
  inputBorderColor: z.string().optional(),
  borderRadius: z.number().optional(),
  formTitle: z.string().max(200).optional(),
  formDescription: z.string().max(500).optional(),
  showDescription: z.boolean().optional(),
  buttonText: z.string().max(100).optional(),
  customCSS: z.string().max(10000).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  maxSubmissionsPerSession: z.number().min(0).max(1000).optional(),
}).passthrough();

// URL Import Schema - validates the entire config object from URL params
export const URLImportConfigSchema = z.object({
  widgetType: z.enum(['chatbot', 'form', 'button']).optional(),
  webhookPath: z.string().max(500).optional(),
  chatbotConfig: ChatbotConfigSchema.optional(),
  formFields: z.array(FormFieldSchema).optional(),
  styles: WidgetStylesSchema.optional(),
});

// Type inference from Zod schemas
export type URLImportConfig = z.infer<typeof URLImportConfigSchema>;

// ============================================
// Validation Helper Functions
// ============================================

export type ParseResult =
  | { success: true; data: URLImportConfig }
  | { success: false; error: string };

/**
 * Encode component config for URL transport (URL-safe base64)
 */
export function encodeWidgetConfig(config: Record<string, unknown>): string {
  try {
    const json = JSON.stringify(config);
    // Use URL-safe base64 encoding
    const base64 = btoa(unescape(encodeURIComponent(json)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

/**
 * Safely parse and validate URL import config
 * Returns result object with success/error info for proper user feedback
 */
export function parseURLImportConfig(base64String: string): URLImportConfig | null {
  const result = parseURLImportConfigWithError(base64String);
  return result.success ? result.data : null;
}

/**
 * Parse URL config with detailed error information
 */
export function parseURLImportConfigWithError(base64String: string): ParseResult {
  try {
    // Handle URL-safe base64 (convert back to standard base64)
    let normalizedBase64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (normalizedBase64.length % 4) {
      normalizedBase64 += '=';
    }

    const decoded = decodeURIComponent(escape(atob(normalizedBase64)));
    const parsed = JSON.parse(decoded);
    const result = URLImportConfigSchema.safeParse(parsed);

    if (result.success) {
      return { success: true, data: result.data };
    }

    const errorMessage = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');

    console.warn('URL config validation failed:', result.error.issues);
    return { success: false, error: `Invalid component config: ${errorMessage}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('URL config parse failed:', error);
    return { success: false, error: `Failed to parse component config: ${message}` };
  }
}

// ============================================
// Default Values
// ============================================

export const DEFAULT_CHATBOT_CONFIG: Partial<ChatbotConfig> = {
  // Display & Position
  displayMode: 'popup',
  position: 'bottom-right',

  // Bubble - matches UI Studio defaults
  bubbleColor: '#ffffff',
  bubbleGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  bubbleSize: 60,
  bubbleIcon: 'message-circle',
  bubbleGlow: true,
  bubbleGlowColor: '#667eea',
  bubbleAnimation: 'pulse',

  // Header - matches UI Studio defaults
  chatbotName: 'Chat Assistant',
  headerColor: '#ffffff',
  headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  headerTextColor: '#ffffff',

  // Chat Window - consistent sizing across all views
  chatBackgroundColor: '#0a0a0a',
  chatBackgroundGradient: '',

  // Messages - User (matches UI Studio defaults)
  welcomeMessage: 'Hi! How can I help you today?',
  placeholder: 'Type your message...',
  userMessageColor: '#ffffff',
  userMessageGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  userMessageTextColor: '#ffffff',
  userMessageGlow: true,
  userMessageGlowColor: '#667eea',

  // Messages - Bot
  botMessageColor: '#1a1a1a',
  botMessageGradient: '',
  botMessageTextColor: '#ffffff',
  botMessageGlow: false,
  botMessageGlowColor: '#000000',

  // Avatars
  userAvatarColor: '#667eea',
  userAvatarIcon: 'user',
  botAvatarColor: '#374151',
  botAvatarIcon: 'bot',

  // Input Area
  inputBackgroundColor: '#0a0a0a',
  inputTextColor: '#ffffff',
  inputPlaceholderColor: 'rgba(255,255,255,0.5)',
  sendButtonColor: '#ffffff',

  // Typography
  fontFamily: 'system-ui',
  fontSize: 14,
  fontWeight: '400',
  lineHeight: '1.5',
  messagePadding: 12,

  // Design
  borderRadius: 20,
  borderStyle: 'solid',
  borderWidth: 1,
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  glassEffect: false,

  // Animations
  windowAnimation: 'slideUp',
  typingIndicator: 'dots',

  // Greeting
  showGreeting: false,
  greetingMessage: 'Hi! How can I help you?',
  greetingDelay: 2,
  greetingAutoHide: false,

  // Auto Open
  autoOpen: false,
  autoOpenDelay: 5,

  // Rate limiting (0 = no limit)
  maxMessagesPerSession: 0,

  // File uploads (disabled by default)
  allowFileUploads: false,
  allowedFileMimeTypes: '',
};

export const DEFAULT_STYLES: WidgetStyles = {
  backgroundColor: '#0a0a0a',
  textColor: '#ffffff',
  primaryColor: '#ffffff',
  buttonTextColor: '#000000',
  inputBackgroundColor: '#111111',
  inputBorderColor: '#333333',
  borderRadius: 12,
};
