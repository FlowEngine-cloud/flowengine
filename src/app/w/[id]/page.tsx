'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { RefreshCw, AlertCircle, CheckCircle, MessageCircle } from 'lucide-react';
import { BrandedLoadingSpinner } from '@/components/ui/loading-logo';
import { ChatbotRenderer, mergeWithDefaults, ChatMessage as RendererChatMessage, ChatFileAttachment } from '@/components/widgets/ChatbotRenderer';
import { ChatbotConfig as FullChatbotConfig } from '@/components/widget-studio/types';
import { useAgencyLogo } from '@/hooks/useAgencyLogo';
import {
  FieldRenderer,
  getFieldWidthStyle,
  FormStyles,
  FormField as SharedFormField
} from '@/components/shared/FormFieldRenderer';
import { supabase } from '@/lib/supabase';

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'file' | 'checkbox' | 'radio' | 'phone' | 'url';
  required: boolean;
  options?: string[];
  accept?: string;
  maxSize?: number;
  width?: '25' | '33' | '50' | '100';
  alignment?: 'left' | 'center' | 'right';
  multiple?: boolean;
  placeholder?: string;
}

interface ChatbotConfig {
  headerTitle?: string;
  headerSubtitle?: string;
  placeholder?: string;
  welcomeMessage?: string;
  bubbleColor?: string;
  bubbleSize?: number;
  headerColor?: string;
  headerTextColor?: string;
  chatBackgroundColor?: string;
  userMessageColor?: string;
  userMessageTextColor?: string;
  botMessageColor?: string;
  botMessageTextColor?: string;
  sendButtonColor?: string;
  inputBackgroundColor?: string;
  borderRadius?: number;
  fontFamily?: string;
  fontSize?: number;
  displayMode?: 'popup' | 'embedded';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  maxMessagesPerSession?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'bot' | 'error';
  content: string;
  timestamp?: Date;
  files?: ChatFileAttachment[];
}

interface WidgetStyles {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string | number;
  buttonText?: string;
  inputBorderColor?: string;
  inputBackgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  formTitle?: string;
  formDescription?: string;
  showDescription?: boolean;
  maxSubmissionsPerSession?: number;
}

interface Widget {
  id: string;
  name: string;
  type: 'button' | 'form' | 'chatbot';
  fields: FormField[];
  chatbotConfig?: ChatbotConfig;
  styles?: WidgetStyles | null;
  canHideWatermark?: boolean;
  agencyLogoUrl?: string | null;
  hasWorkflow?: boolean;
}

const DEFAULT_STYLES: WidgetStyles = {
  primaryColor: '#ffffff',
  backgroundColor: '#0a0a0a',
  textColor: '#ffffff',
  borderRadius: '12',
  buttonText: 'Submit',
  inputBorderColor: '#333333',
  inputBackgroundColor: '#111111',
};


export default function PublicWidgetPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  // Only hide watermark if owner is Pro+ AND wm=0 param is set
  const hideWatermarkParam = searchParams.get('wm') === '0';

  // Get cached agency logo (works if the visitor is the agency owner testing their widget)
  const { logoUrl: cachedLogoUrl } = useAgencyLogo();

  const [widget, setWidget] = useState<Widget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string | string[] | File | File[] | null>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Chatbot state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Storage key for persisting chat messages
  const chatStorageKey = `flowengine_chatbot_${id}`;

  // Storage key for unique session ID (for n8n memory)
  const sessionStorageKey = `flowengine_session_${id}`;

  // Storage key for tracking form/button submission count
  const submissionStorageKey = `flowengine_submissions_${id}`;

  // Generate or retrieve unique session ID for this user/widget combo
  const [chatSessionId, setChatSessionId] = useState<string>('');

  // Watermark is hidden only if both conditions are met:
  // 1. Owner is Pro+ (canHideWatermark from API)
  // 2. User requested to hide it (?wm=0)
  const shouldHideWatermark = widget?.canHideWatermark && hideWatermarkParam;

  // Fetch widget data
  useEffect(() => {
    const fetchWidget = async () => {
      try {
        // Include auth token if the user is logged in so owners can preview their own drafts
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch(`/api/public/widget/${id}`, { headers });
        if (!res.ok) {
          const data = await res.json();
          if (res.status === 404) {
            setError('Component not found');
          } else if (res.status === 403) {
            setError('this component is currently disabled');
          } else {
            setError(data.error || 'Failed to load component');
          }
          return;
        }
        const data = await res.json();
        setWidget(data.widget);

        // Initialize form data
        const initialData: Record<string, string | string[] | File | null> = {};
        data.widget.fields?.forEach((field: FormField) => {
          if (field.type === 'checkbox') {
            initialData[field.name] = [];
          } else if (field.type === 'file') {
            initialData[field.name] = null;
          } else {
            initialData[field.name] = '';
          }
        });
        setFormData(initialData);
      } catch (err) {
        setError('Failed to load component');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWidget();
  }, [id]);

  // Generate or retrieve unique session ID for n8n memory
  useEffect(() => {
    if (widget?.type === 'chatbot') {
      try {
        let sessionId = localStorage.getItem(sessionStorageKey);
        if (!sessionId) {
          // Generate a unique session ID: widgetId + random string
          sessionId = `${id}-${Math.random().toString(36).substring(2, 15)}`;
          localStorage.setItem(sessionStorageKey, sessionId);
        }
        setChatSessionId(sessionId);
      } catch {
        // Fallback if localStorage unavailable
        setChatSessionId(`${id}-${Math.random().toString(36).substring(2, 15)}`);
      }
    }
  }, [widget?.type, id, sessionStorageKey]);

  // Load messages from localStorage on mount
  useEffect(() => {
    if (widget?.type === 'chatbot') {
      try {
        const stored = localStorage.getItem(chatStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Restore messages with timestamps converted back to Date objects
            const restoredMessages = parsed.map((m: ChatMessage & { timestamp?: string }) => ({
              ...m,
              timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
            }));
            setMessages(restoredMessages);
            setMessagesLoaded(true);
            return;
          }
        }
      } catch {
        // Ignore localStorage errors
      }
      setMessagesLoaded(true);
    }
  }, [widget?.type, chatStorageKey]);

  // Initialize chatbot with welcome message (only if no stored messages)
  useEffect(() => {
    if (widget?.type === 'chatbot' && widget.chatbotConfig?.welcomeMessage && messagesLoaded && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'bot',
        content: widget.chatbotConfig.welcomeMessage,
        timestamp: new Date(),
      }]);
    }
    // For embedded mode, open chat immediately
    if (widget?.type === 'chatbot' && widget.chatbotConfig?.displayMode === 'embedded') {
      setChatOpen(true);
    }
  }, [widget, messagesLoaded, messages.length]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (widget?.type === 'chatbot' && messagesLoaded && messages.length > 0) {
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(messages));
      } catch {
        // Ignore localStorage errors (quota exceeded, etc.)
      }
    }
  }, [messages, widget?.type, messagesLoaded, chatStorageKey]);

  // Scroll to bottom when messages change (scroll container directly, not scrollIntoView which affects parent)
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Clear chat history and start new session
  const clearChat = () => {
    localStorage.removeItem(chatStorageKey);
    setMessages([]);
    setSelectedFiles([]);
    // Generate new session ID so n8n memory starts fresh too
    const newSessionId = `${id}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(sessionStorageKey, newSessionId);
    setChatSessionId(newSessionId);
  };

  // File handling for chat
  const handleFileSelect = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Send chat message
  const sendChatMessage = async () => {
    // Allow sending if there's text OR files
    if ((!inputMessage.trim() && selectedFiles.length === 0) || isSendingChat || !widget) return;

    // Check message limit
    const maxMessages = widget.chatbotConfig?.maxMessagesPerSession || 0;
    if (maxMessages > 0) {
      const userMessageCount = messages.filter(m => m.role === 'user').length;
      if (userMessageCount >= maxMessages) {
        const limitMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'error',
          content: `Message limit reached (${maxMessages} messages per session). Clear chat to continue.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, limitMsg]);
        return;
      }
    }

    // Convert files to base64 for storage and submission
    const fileAttachments: ChatFileAttachment[] = [];
    const filesForSubmission: Array<{ name: string; type: string; size: number; data: string }> = [];

    for (const file of selectedFiles) {
      try {
        const base64Data = await fileToBase64(file);
        fileAttachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data,
        });
        filesForSubmission.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data,
        });
      } catch {
        // Skip files that fail to convert
      }
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      files: fileAttachments.length > 0 ? fileAttachments : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setSelectedFiles([]);
    setIsSendingChat(true);

    try {
      const res = await fetch(`/api/public/widget/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // n8n Chat Trigger expects 'action' and 'chatInput'
          action: 'sendMessage',
          chatInput: userMessage.content,
          message: userMessage.content,
          // File attachments (if any)
          ...(filesForSubmission.length > 0 && { files: filesForSubmission }),
          // Unique session ID per user for n8n memory
          sessionId: chatSessionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // n8n AI Agent returns response in 'output' field
        // Also check 'text', 'result', 'response', 'message' for flexibility
        const aiResponse = data.output || data.text || data.response || data.message || data.result;
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: aiResponse || 'Thanks for your message!',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        // Show specific error from API with error styling
        let errorMessage = 'Sorry, I encountered an error. Please try again.';
        try {
          const data = await res.json();
          if (data.code === 'NO_WORKFLOW') {
            errorMessage = 'This chatbot is in preview mode. Connect a workflow to enable responses.';
          } else if (data.error) {
            // Show the actual error from the API
            errorMessage = data.error;
          }
        } catch {
          // Ignore parse errors
        }
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'error',
          content: errorMessage,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'error',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const updateField = (name: string, value: string | string[] | File | File[] | null) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => {
        const { [name]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const toggleCheckbox = (fieldName: string, option: string) => {
    const current = (formData[fieldName] as string[]) || [];
    const updated = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option];
    updateField(fieldName, updated);
  };

  // Validate a single field (for real-time validation on blur)
  const validateField = (field: FormField) => {
    const value = formData[field.name];
    let fieldError = '';

    // Required check
    if (field.required) {
      if (field.type === 'checkbox') {
        if (!value || (value as string[]).length === 0) {
          fieldError = `Please select at least one option`;
        }
      } else if (field.type === 'file') {
        if (!value) {
          fieldError = `${field.name} is required`;
        }
      } else if (!value || !(value as string).trim()) {
        fieldError = `${field.name} is required`;
      }
    }

    // Type-specific validation (only if not already errored and has value)
    if (!fieldError && value && typeof value === 'string' && value.trim()) {
      switch (field.type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            fieldError = 'Invalid email format';
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            fieldError = 'Must be a number';
          }
          break;
        case 'phone':
          const phoneRegex = /^[\d\s\-\+\(\)\.]+$/;
          if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 7) {
            fieldError = 'Invalid phone number';
          }
          break;
        case 'url':
          try {
            new URL(value);
          } catch {
            fieldError = 'Invalid URL format';
          }
          break;
      }
    }

    // Update errors state for this field
    if (fieldError) {
      setFormErrors(prev => ({ ...prev, [field.name]: fieldError }));
    } else {
      setFormErrors(prev => {
        const { [field.name]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const validate = () => {
    if (!widget) return false;
    const newErrors: Record<string, string> = {};

    widget.fields.forEach(field => {
      const value = formData[field.name];

      if (field.required) {
        if (field.type === 'checkbox') {
          if (!value || (value as string[]).length === 0) {
            newErrors[field.name] = `Please select at least one option`;
          }
        } else if (field.type === 'file') {
          if (!value) {
            newErrors[field.name] = `${field.name} is required`;
          }
        } else if (!value || !(value as string).trim()) {
          newErrors[field.name] = `${field.name} is required`;
        }
      }

      if (value && typeof value === 'string' && value.trim()) {
        switch (field.type) {
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              newErrors[field.name] = 'Invalid email format';
            }
            break;
          case 'number':
            if (isNaN(Number(value))) {
              newErrors[field.name] = 'Must be a number';
            }
            break;
          case 'phone':
            const phoneRegex = /^[\d\s\-\+\(\)\.]+$/;
            if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 7) {
              newErrors[field.name] = 'Invalid phone number';
            }
            break;
          case 'url':
            try {
              new URL(value);
            } catch {
              newErrors[field.name] = 'Invalid URL format';
            }
            break;
        }
      }
    });

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (widget?.type === 'form' && !validate()) {
      return;
    }

    // Check submission rate limit for forms and buttons
    const maxSubmissions = widget?.styles?.maxSubmissionsPerSession || 0;
    if (maxSubmissions > 0) {
      try {
        const storedCount = parseInt(localStorage.getItem(submissionStorageKey) || '0', 10);
        if (storedCount >= maxSubmissions) {
          setError(`Submission limit reached (${maxSubmissions} per session).`);
          return;
        }
      } catch {
        // localStorage not available, continue without rate limiting
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare data for submission
      const submitData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (value instanceof File) {
          // Convert file to base64
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(value);
          });
          submitData[key] = {
            name: value.name,
            type: value.type,
            size: value.size,
            data: base64,
          };
        } else {
          submitData[key] = value;
        }
      }

      // Submit through secure server-side proxy (never exposes webhook URL)
      const res = await fetch(`/api/public/widget/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (res.ok) {
        setSubmitSuccess(true);
        // Increment submission count for rate limiting
        if (maxSubmissions > 0) {
          try {
            const currentCount = parseInt(localStorage.getItem(submissionStorageKey) || '0', 10);
            localStorage.setItem(submissionStorageKey, String(currentCount + 1));
          } catch {
            // localStorage not available, skip
          }
        }
      } else {
        // Check for specific error codes and messages
        try {
          const data = await res.json();
          if (data.code === 'NO_WORKFLOW') {
            setError('This component is in preview mode. Connect a workflow to enable submissions.');
          } else {
            // Use error field (from API) or message field as fallback
            setError(data.error || data.message || 'Failed to submit. Please try again.');
          }
        } catch {
          setError('Failed to submit. Please try again.');
        }
      }
    } catch (err) {
      setError('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert WidgetStyles to FormStyles for the shared component
  const getFormStyles = (s: WidgetStyles): FormStyles => ({
    backgroundColor: s.backgroundColor || '#0a0a0a',
    textColor: s.textColor || '#ffffff',
    primaryColor: s.primaryColor || '#ffffff',
    buttonTextColor: s.primaryColor === '#ffffff' ? '#000000' : '#ffffff',
    inputBackgroundColor: s.inputBackgroundColor || '#111111',
    inputBorderColor: s.inputBorderColor || '#333333',
    borderRadius: typeof s.borderRadius === 'string' ? parseInt(s.borderRadius) : (s.borderRadius || 12),
    formTitle: s.formTitle,
    formDescription: s.formDescription,
    showDescription: s.showDescription,
    buttonText: s.buttonText,
    textAlign: s.textAlign,
  });

  // Loading state - use cached logo (for agency owner testing) or API response logo
  if (isLoading) {
    return <BrandedLoadingSpinner logoUrl={cachedLogoUrl} />;
  }

  // Error state
  if (error && !widget) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // Success state (for form/button only)
  if (submitSuccess && widget?.type !== 'chatbot') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Success!</h1>
          <p className="text-gray-400">Your submission has been received.</p>
        </div>
      </div>
    );
  }

  // chatbot component - different layout
  if (widget?.type === 'chatbot') {
    // Merge with centralized defaults for consistent styling
    const config = mergeWithDefaults((widget.chatbotConfig || {}) as Partial<FullChatbotConfig>);
    const isEmbedded = config.displayMode === 'embedded';
    const position = config.position || 'bottom-right';

    // Watermark is hidden if Pro user sets showWatermark: false in config OR uses ?wm=0 param
    const chatbotHideWatermark = widget?.canHideWatermark && (hideWatermarkParam || config.showWatermark === false);

    // Position classes for popup mode
    const positionClasses: Record<string, string> = {
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
    };

    // Convert messages to renderer format (remove timestamp, keep files)
    const rendererMessages: RendererChatMessage[] = messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      files: m.files,
    }));

    // Embedded mode - full page chat
    if (isEmbedded) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="w-full max-w-lg h-[80vh]">
            <ChatbotRenderer
              config={(widget.chatbotConfig || {}) as Partial<FullChatbotConfig>}
              widgetName={widget.name}
              messages={rendererMessages}
              inputValue={inputMessage}
              onInputChange={setInputMessage}
              onSend={sendChatMessage}
              isSending={isSendingChat}
              selectedFiles={selectedFiles}
              onFileSelect={handleFileSelect}
              onRemoveFile={handleRemoveFile}
              width="100%"
              height="100%"
              previewMode={false}
              messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
              showCloseButton={false}
              onClearChat={clearChat}
              showWatermark={!chatbotHideWatermark}
            />
          </div>
        </div>
      );
    }

    // Popup mode - bubble + chat window
    return (
      <div className="min-h-screen bg-transparent">
        {/* Chat Bubble */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className={`fixed ${positionClasses[position]} rounded-full shadow-lg transition-transform hover:scale-110`}
            style={{
              width: `${config.bubbleSize}px`,
              height: `${config.bubbleSize}px`,
              background: config.bubbleGradient || config.bubbleColor,
              boxShadow: config.bubbleGlow
                ? `0 4px 20px rgba(0,0,0,0.3), 0 0 40px ${config.bubbleGlowColor || '#667eea'}60`
                : '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            <MessageCircle
              className="w-7 h-7 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ color: config.headerTextColor }}
            />
          </button>
        )}

        {/* Chat Window - Full screen on mobile, positioned on desktop */}
        {chatOpen && (
          <div className={`fixed ${positionClasses[position]} max-sm:inset-2 max-sm:flex max-sm:items-center max-sm:justify-center`}>
            <ChatbotRenderer
              config={(widget.chatbotConfig || {}) as Partial<FullChatbotConfig>}
              widgetName={widget.name}
              messages={rendererMessages}
              inputValue={inputMessage}
              onInputChange={setInputMessage}
              onSend={sendChatMessage}
              isSending={isSendingChat}
              selectedFiles={selectedFiles}
              onFileSelect={handleFileSelect}
              onRemoveFile={handleRemoveFile}
              width="320px"
              height="500px"
              previewMode={false}
              messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
              onClose={() => setChatOpen(false)}
              showCloseButton={true}
              onClearChat={clearChat}
              showWatermark={!chatbotHideWatermark}
            />
          </div>
        )}
      </div>
    );
  }

  // Form/button components
  // Merge widget styles with defaults
  const styles = { ...DEFAULT_STYLES, ...(widget?.styles || {}) };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="max-w-md w-full"
        style={{
          backgroundColor: styles.backgroundColor,
          borderRadius: `${styles.borderRadius || 12}px`,
          border: `1px solid ${styles.inputBorderColor || '#333333'}`,
          padding: '32px',
          textAlign: styles.textAlign || 'left',
        }}
      >
        {/* Header */}
        <div className="mb-2">
          <h1
            className="text-xl font-bold"
            style={{ color: styles.textColor }}
          >
            {widget?.name}
          </h1>
        </div>
        {/* Description - shown if exists */}
        {styles.showDescription && styles.formDescription ? (
          <p className="text-sm mb-6" style={{ color: styles.textColor, opacity: 0.6 }}>
            {styles.formDescription}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* button component */}
        {widget?.type === 'button' && (
          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="w-full px-8 py-3 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
            style={{
              backgroundColor: styles.primaryColor,
              borderRadius: `${styles.borderRadius || 12}px`,
              color: styles.primaryColor === '#ffffff' ? '#000' : '#fff',
            }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              styles.buttonText || widget.name
            )}
          </button>
        )}

        {/* form component */}
        {widget?.type === 'form' && (
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4">
            {widget.fields.map((field) => {
              const formStyles = getFormStyles(styles);
              return (
                <div key={field.name} style={{ width: getFieldWidthStyle(field.width), minWidth: '80px' }}>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: styles.textColor, opacity: 0.8 }}
                  >
                    {field.name}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <FieldRenderer
                    field={field as SharedFormField}
                    value={formData[field.name]}
                    onChange={(val) => updateField(field.name, val)}
                    onToggleCheckbox={(opt) => toggleCheckbox(field.name, opt)}
                    onBlur={() => validateField(field)}
                    error={formErrors[field.name]}
                    styles={formStyles}
                    previewMode={false}
                  />
                  {formErrors[field.name] && (
                    <p className="text-red-400 text-xs mt-1">{formErrors[field.name]}</p>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 py-3 font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
              style={{
                width: '100%',
                backgroundColor: styles.primaryColor,
                borderRadius: `${styles.borderRadius || 12}px`,
                color: styles.primaryColor === '#ffffff' ? '#000' : '#fff',
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                styles.buttonText || 'Submit'
              )}
            </button>
          </form>
        )}

        {/* Powered by - visible version only shown if not hidden by Pro+ user */}
        {!shouldHideWatermark ? (
          <div
            className="mt-6 pt-4 text-center"
            style={{ borderTop: `1px solid ${styles.inputBorderColor}` }}
          >
            <a
              href="https://flowengine.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Powered by <span className="text-gray-400 hover:text-gray-200">FlowEngine</span>
            </a>
          </div>
        ) : (
          <a
            href="https://flowengine.cloud"
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
    </div>
  );
}
