'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Settings,
  Bot,
  X,
  Menu,
  FileText,
  Type,
  Palette,
  Layout,
  Play,
  Share2,
  MessageCircle,
  MousePointerClick,
  ChevronDown,
  Sparkles,
  Search,
  Undo2,
  Redo2,
  ExternalLink
} from 'lucide-react';
import { CanvasSidebar } from './CanvasSidebar';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasPreviewArea } from './CanvasPreviewArea';
import { CanvasPropertiesPanel } from './CanvasPropertiesPanel';
import { AIPanel } from './AIPanel';
import { SectionErrorBoundary } from './ErrorBoundary';
import { useDebouncedHistory } from './hooks/useHistory';

// ChatbotConfig matches the interface from page.tsx
// Using Record<string, any> for flexibility since it's just passed through
type ChatbotConfig = Record<string, any>;

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'file' | 'checkbox' | 'radio' | 'phone' | 'url';
  required: boolean;
  options?: string[];
  placeholder?: string;
  width?: '25' | '33' | '50' | '100';
  alignment?: 'left' | 'center' | 'right';
  customBorderRadius?: string;
  customPadding?: string;
  customFontSize?: string;
  customHeight?: string;
}

// Unified state for history tracking - tracks all editable widget state
interface WidgetState {
  chatbotConfig: ChatbotConfig;
  styles: Record<string, any>;
  formFields: FormField[];
}

interface Category {
  id: string;
  name: string;
  instance_id?: string | null;
  instance?: {
    id: string;
    instance_name: string;
  } | null;
}

interface InstanceWithoutCategory {
  id: string;
  instance_name: string;
}

interface UnifiedCanvasEditorProps {
  widgetType: 'chatbot' | 'form' | 'button';
  widgetName: string;
  widgetDescription: string;
  defaultWebhookPath: string;
  selectedInstanceIds: string[];
  formFields: FormField[];
  styles: Record<string, any>;
  chatbotConfig: ChatbotConfig;
  onWidgetTypeChange: (type: 'chatbot' | 'form' | 'button') => void;
  onWidgetNameChange: (name: string) => void;
  onWidgetDescriptionChange: (description: string) => void;
  onWebhookPathChange: (path: string) => void;
  onInstanceIdsChange: (ids: string[]) => void;
  onFormFieldsChange: (fields: FormField[]) => void;
  onStylesChange: (styles: any) => void;
  onChatbotConfigChange: (config: any) => void;
  onSave: () => Promise<void>;
  onExit: () => void;
  isSaving: boolean;
  saveError: string | null;
  onClearError?: () => void;
  savedWidgetId: string | null;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
  categories: Category[];
  instancesWithoutCategory?: InstanceWithoutCategory[];
  initialSelectedElement?: SelectedElement;
  hasUnsavedChanges?: boolean;
  onDeleteAllDrafts?: () => void;
  isDeletingAllDrafts?: boolean;
  canHideWatermark?: boolean; // Pro+ feature
}

export type SidebarSection = 'info' | 'content' | 'colors' | 'design' | 'effects' | 'animations' | 'advanced' | 'share';

export type SelectedElement =
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

// Single source of truth for element-to-section mapping
const ELEMENT_TO_SECTION_MAP: Record<string, SidebarSection> = {
  // Chatbot elements
  'bubble': 'colors',
  'header-bg': 'colors',
  'header-text': 'content',
  'chat-bg': 'colors',
  'user-msg': 'colors',
  'user-text': 'colors',
  'user-avatar': 'colors',
  'bot-msg': 'colors',
  'bot-text': 'colors',
  'bot-avatar': 'colors',
  'input': 'colors',
  'send-button': 'colors',
  // Form elements
  'form-bg': 'colors',
  'form-title': 'content',
  'form-input': 'colors',
  'form-button': 'colors',
  // button component
  'button-widget': 'colors',
};

// Searchable settings for mobile search
interface MobileSearchableItem {
  label: string;
  keywords: string[];
  section: SidebarSection;
  forTypes?: Array<'chatbot' | 'form' | 'button'>;
}

const MOBILE_SEARCHABLE_ITEMS: MobileSearchableItem[] = [
  // Info
  { label: 'Component Name', keywords: ['name', 'title', 'widget'], section: 'info' },
  { label: 'Description', keywords: ['description', 'about'], section: 'info' },
  { label: 'Webhook Path', keywords: ['webhook', 'url', 'endpoint'], section: 'info' },
  { label: 'n8n Instance', keywords: ['n8n', 'instance', 'workflow'], section: 'info' },
  // Content
  { label: 'Welcome Message', keywords: ['welcome', 'greeting', 'message'], section: 'content', forTypes: ['chatbot'] },
  { label: 'Placeholder Text', keywords: ['placeholder', 'input'], section: 'content', forTypes: ['chatbot'] },
  { label: 'Display Mode', keywords: ['display', 'popup', 'embedded'], section: 'content', forTypes: ['chatbot'] },
  { label: 'File Uploads', keywords: ['file', 'upload', 'attachment', 'attach'], section: 'content', forTypes: ['chatbot'] },
  { label: 'Form Fields', keywords: ['fields', 'inputs', 'form'], section: 'content', forTypes: ['form'] },
  { label: 'Button Text', keywords: ['button', 'submit', 'text'], section: 'content', forTypes: ['form', 'button'] },
  // Colors
  { label: 'Background Color', keywords: ['background', 'color', 'bg'], section: 'colors' },
  { label: 'Text Color', keywords: ['text', 'color', 'font'], section: 'colors' },
  { label: 'Primary Color', keywords: ['primary', 'accent', 'button'], section: 'colors' },
  { label: 'Header Color', keywords: ['header', 'top'], section: 'colors', forTypes: ['chatbot'] },
  // Design
  { label: 'Border Radius', keywords: ['border', 'radius', 'rounded'], section: 'design' },
  { label: 'Font Family', keywords: ['font', 'family', 'typography'], section: 'design' },
  { label: 'Font Size', keywords: ['font', 'size'], section: 'design' },
  // Effects
  { label: 'Glow Effect', keywords: ['glow', 'shadow', 'light'], section: 'effects', forTypes: ['chatbot'] },
  { label: 'Gradient', keywords: ['gradient', 'fade'], section: 'effects', forTypes: ['chatbot'] },
  // Animations
  { label: 'Bubble Animation', keywords: ['bubble', 'animation', 'pulse'], section: 'animations', forTypes: ['chatbot'] },
  { label: 'Auto Open', keywords: ['auto', 'open', 'delay'], section: 'animations', forTypes: ['chatbot'] },
  // Advanced
  { label: 'Watermark', keywords: ['watermark', 'branding', 'powered'], section: 'advanced' },
  { label: 'Custom CSS', keywords: ['css', 'custom', 'style'], section: 'advanced' },
  { label: 'Rate Limit', keywords: ['limit', 'rate', 'max', 'session'], section: 'advanced' },
  // Share
  { label: 'Embed Code', keywords: ['embed', 'code', 'script'], section: 'share' },
  { label: 'Share Link', keywords: ['share', 'link', 'url'], section: 'share' },
];

export function UnifiedCanvasEditor({
  widgetType,
  widgetName,
  widgetDescription,
  defaultWebhookPath,
  selectedInstanceIds,
  formFields,
  styles,
  chatbotConfig,
  onWidgetTypeChange,
  onWidgetNameChange,
  onWidgetDescriptionChange,
  onWebhookPathChange,
  onInstanceIdsChange,
  onFormFieldsChange,
  onStylesChange,
  onChatbotConfigChange,
  onSave,
  onExit,
  isSaving,
  saveError,
  onClearError,
  savedWidgetId,
  isActive,
  onActiveChange,
  categories,
  instancesWithoutCategory = [],
  initialSelectedElement,
  hasUnsavedChanges,
  onDeleteAllDrafts,
  isDeletingAllDrafts,
  canHideWatermark = false,
}: UnifiedCanvasEditorProps) {
  // Core state management
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>(() => {
    // If an initial element is provided, start with the appropriate section
    if (initialSelectedElement) {
      return ELEMENT_TO_SECTION_MAP[initialSelectedElement] || 'info';
    }
    return 'info';
  });
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(initialSelectedElement || null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [mobilePanel, setMobilePanel] = useState<'none' | 'properties' | 'ai'>('none');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');

  // Mobile search results
  const mobileSearchResults = useMemo(() => {
    if (!mobileSearchQuery.trim()) return [];
    const query = mobileSearchQuery.toLowerCase();
    return MOBILE_SEARCHABLE_ITEMS.filter((item) => {
      if (item.forTypes && !item.forTypes.includes(widgetType)) return false;
      const matchesLabel = item.label.toLowerCase().includes(query);
      const matchesKeywords = item.keywords.some((kw) => kw.includes(query));
      return matchesLabel || matchesKeywords;
    }).slice(0, 6);
  }, [mobileSearchQuery, widgetType]);

  const handleMobileSearchResultClick = (section: SidebarSection) => {
    setSidebarSection(section);
    setMobilePanel('properties');
    setMobileSearchQuery('');
  };

  // History management for undo/redo - tracks ALL widget state
  const initialWidgetState: WidgetState = {
    chatbotConfig,
    styles,
    formFields,
  };

  const {
    state: historyState,
    setState: setHistoryState,
    undo: historyUndo,
    redo: historyRedo,
    canUndo,
    canRedo,
  } = useDebouncedHistory<WidgetState>(initialWidgetState, 300);

  // Track last synced state to prevent loops
  const lastSyncedState = useRef<string>(JSON.stringify(initialWidgetState));

  // Sync from parent to local when parent changes externally (loading widget, etc.)
  useEffect(() => {
    const parentState: WidgetState = { chatbotConfig, styles, formFields };
    const parentStateStr = JSON.stringify(parentState);
    // Only sync if parent changed AND it's different from what we last synced
    if (parentStateStr !== lastSyncedState.current) {
      lastSyncedState.current = parentStateStr;
      setHistoryState(parentState, false);
    }
  }, [chatbotConfig, styles, formFields, setHistoryState]);

  // Sync from history to parent when local changes happen
  useEffect(() => {
    const historyStateStr = JSON.stringify(historyState);
    // Only sync to parent if history changed from what we last synced
    if (historyStateStr !== lastSyncedState.current) {
      lastSyncedState.current = historyStateStr;
      // Sync all state parts to parent
      onChatbotConfigChange(historyState.chatbotConfig);
      onStylesChange(historyState.styles);
      onFormFieldsChange(historyState.formFields);
    }
  }, [historyState, onChatbotConfigChange, onStylesChange, onFormFieldsChange]);

  // Wrapped handlers that go through history
  const handleConfigChange = useCallback((newConfig: ChatbotConfig) => {
    setHistoryState(prev => ({ ...prev, chatbotConfig: newConfig }));
  }, [setHistoryState]);

  const handleStylesChange = useCallback((newStyles: Record<string, any>) => {
    setHistoryState(prev => ({ ...prev, styles: newStyles }));
  }, [setHistoryState]);

  const handleFormFieldsChange = useCallback((newFields: FormField[]) => {
    setHistoryState(prev => ({ ...prev, formFields: newFields }));
  }, [setHistoryState]);

  // Undo/redo handlers
  const undo = useCallback(() => {
    historyUndo();
  }, [historyUndo]);

  const redo = useCallback(() => {
    historyRedo();
  }, [historyRedo]);

  // Update selectedElement when initialSelectedElement changes (for URL params)
  useEffect(() => {
    if (initialSelectedElement) {
      setSelectedElement(initialSelectedElement);
      // Also update sidebar section to match the element
      setSidebarSection(ELEMENT_TO_SECTION_MAP[initialSelectedElement] || 'colors');
    }
  }, [initialSelectedElement]);

  // Resizable properties panel
  const [propertiesWidth, setPropertiesWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Handle resize drag
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: propertiesWidth };
  }, [propertiesWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(450, Math.max(220, resizeRef.current.startWidth + delta));
      setPropertiesWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Auto-switch to appropriate section when element is selected
  const handleElementSelect = (element: SelectedElement) => {
    setSelectedElement(element);

    // Map elements to their appropriate sections
    if (element) {
      const targetSection = ELEMENT_TO_SECTION_MAP[element];
      if (targetSection) {
        setSidebarSection(targetSection);
      }
    }
  };

  // Handle AI widget updates - goes through history for undo/redo support
  const handleWidgetUpdate = useCallback((updates: any) => {
    // Handle widget type change first (outside of history state)
    if (updates.widgetType && ['chatbot', 'form', 'button'].includes(updates.widgetType)) {
      onWidgetTypeChange(updates.widgetType);
      // Switch to content section so user sees the new component
      setSidebarSection('content');
      setSelectedElement(null);
    }

    // Then handle config/style/field updates
    setHistoryState(prev => {
      const newState = { ...prev };
      if (updates.fields) {
        newState.formFields = updates.fields;
      }
      if (updates.styles) {
        newState.styles = { ...prev.styles, ...updates.styles };
      }
      if (updates.chatbotConfig) {
        newState.chatbotConfig = { ...prev.chatbotConfig, ...updates.chatbotConfig };
      }
      return newState;
    });
  }, [setHistoryState, onWidgetTypeChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to clear selection
      if (e.key === 'Escape' && selectedElement) {
        e.preventDefault();
        setSelectedElement(null);
      }
      // Cmd+S / Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (widgetName.trim() && !isSaving) {
          onSave();
        }
      }
      // Cmd+Z / Ctrl+Z to undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
      }
      // Cmd+Shift+Z / Ctrl+Shift+Z to redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
      }
      // Cmd+Y / Ctrl+Y to redo (alternative)
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [widgetName, isSaving, onSave, undo, redo, canUndo, canRedo, selectedElement]);

  // Handle exit with confirmation
  const handleExit = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to exit?');
      if (!confirmed) return;
    }
    onExit();
  }, [hasUnsavedChanges, onExit]);

  // Mobile navigation items
  const mobileNavItems = [
    { id: 'info' as SidebarSection, icon: FileText, label: 'Info' },
    { id: 'content' as SidebarSection, icon: Type, label: 'Content' },
    { id: 'colors' as SidebarSection, icon: Palette, label: 'Colors' },
    { id: 'design' as SidebarSection, icon: Layout, label: 'Design' },
    ...(widgetType === 'chatbot' ? [
      { id: 'effects' as SidebarSection, icon: Sparkles, label: 'Effects' },
      { id: 'animations' as SidebarSection, icon: Play, label: 'Animations' },
    ] : []),
    { id: 'advanced' as SidebarSection, icon: Settings, label: 'Advanced' },
    { id: 'share' as SidebarSection, icon: Share2, label: 'Share' },
  ];

  const widgetTypes = [
    { id: 'chatbot' as const, icon: MessageCircle, label: 'Chatbot' },
    { id: 'form' as const, icon: FileText, label: 'Form' },
    { id: 'button' as const, icon: MousePointerClick, label: 'Button' },
  ];

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row h-screen bg-black overflow-hidden" style={{ zIndex: 50 }}>
      {/* Mobile Header - Only visible on mobile */}
      <div className="lg:hidden flex-shrink-0 bg-gray-900 border-b border-gray-800">
        {/* Top row: Menu, Widget Name, Actions */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-white font-medium text-sm truncate max-w-[150px]">
              {widgetName || 'Untitled'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={isSaving || !widgetName.trim()}
              className="px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleExit}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search, Undo/Redo, View Mode */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 relative">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={mobileSearchQuery}
              onChange={(e) => setMobileSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className="w-full pl-8 pr-7 py-1.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30"
            />
            {mobileSearchQuery && (
              <button
                onClick={() => setMobileSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-700 rounded"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Active Toggle */}
          <button
            onClick={() => onActiveChange(!isActive)}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              isActive ? 'bg-green-500' : 'bg-gray-700'
            }`}
            title={isActive ? 'Widget is active' : 'Widget is inactive'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>

          {/* Preview/View Button */}
          {savedWidgetId && (
            <a
              href={`/w/${savedWidgetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"
              title="View widget"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Search Results Dropdown */}
          {mobileSearchResults.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
              {mobileSearchResults.map((result, index) => (
                <button
                  key={`${result.section}-${result.label}-${index}`}
                  onClick={() => handleMobileSearchResultClick(result.section)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{result.label}</div>
                    <div className="text-xs text-gray-500 capitalize">{result.section}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {mobileSearchQuery.trim() && mobileSearchResults.length === 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-3">
              <p className="text-sm text-gray-400 text-center">No settings found</p>
            </div>
          )}
        </div>

        {/* Section Navigation Tabs - Horizontal Scroll */}
        <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = sidebarSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSidebarSection(item.id);
                  setMobilePanel('properties');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-white text-black'
                    : 'bg-gray-800/50 text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-medium">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              {mobileNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = sidebarSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSidebarSection(item.id);
                      setMobilePanel('properties');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-white text-black'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800">
              <p className="text-gray-500 text-xs mb-2">Widget Type</p>
              <div className="space-y-1">
                {widgetTypes.map((type) => {
                  const TypeIcon = type.icon;
                  const isSelected = type.id === widgetType;
                  return (
                    <button
                      key={type.id}
                      onClick={() => {
                        onWidgetTypeChange(type.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-white text-black'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      <TypeIcon className="w-5 h-5" />
                      <span>{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left: 60px Icon Navigation - Hidden on mobile */}
      <div className="hidden lg:block">
        <CanvasSidebar
          currentSection={sidebarSection}
          onSectionChange={setSidebarSection}
          widgetType={widgetType}
          onWidgetTypeChange={onWidgetTypeChange}
        />
      </div>

      {/* Properties Panel - Resizable - Hidden on mobile */}
      <div
        className="hidden lg:block h-full flex-shrink-0 bg-gray-900 border-r border-gray-800 overflow-hidden relative"
        style={{ width: `${propertiesWidth}px` }}
      >
        <SectionErrorBoundary section="properties">
          <CanvasPropertiesPanel
            sidebarSection={sidebarSection}
            selectedElement={selectedElement}
            widgetType={widgetType}
            widgetName={widgetName}
            widgetDescription={widgetDescription}
            defaultWebhookPath={defaultWebhookPath}
            selectedInstanceIds={selectedInstanceIds}
            formFields={historyState.formFields}
            styles={historyState.styles}
            chatbotConfig={historyState.chatbotConfig}
            categories={categories}
            instancesWithoutCategory={instancesWithoutCategory}
            panelWidth={propertiesWidth}
            savedWidgetId={savedWidgetId}
            onWidgetNameChange={onWidgetNameChange}
            onWidgetDescriptionChange={onWidgetDescriptionChange}
            onWebhookPathChange={onWebhookPathChange}
            onInstanceIdsChange={onInstanceIdsChange}
            onFormFieldsChange={handleFormFieldsChange}
            onStylesChange={handleStylesChange}
            onChatbotConfigChange={handleConfigChange}
            canHideWatermark={canHideWatermark}
            onSectionChange={setSidebarSection}
          />
        </SectionErrorBoundary>
        {/* Resize Handle */}
        <div
          className={`absolute top-0 -right-1 w-2 h-full cursor-col-resize transition-colors group ${
            isResizing ? 'bg-white/30' : 'hover:bg-white/20'
          }`}
          onMouseDown={handleResizeMouseDown}
        >
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-opacity ${
            isResizing ? 'bg-white/50 opacity-100' : 'bg-white/30 opacity-0 group-hover:opacity-100'
          }`} />
        </div>
      </div>

      {/* Main Content Area: Toolbar + Canvas - Flexible */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* Top Toolbar - Hidden on mobile (we have mobile header) */}
        <div className="hidden lg:block">
          <CanvasToolbar
          widgetName={widgetName}
          widgetType={widgetType}
          zoomLevel={zoomLevel}
          viewMode={viewMode}
          isSaving={isSaving}
          isActive={isActive}
          canUndo={canUndo}
          canRedo={canRedo}
          savedWidgetId={savedWidgetId}
          hasUnsavedChanges={hasUnsavedChanges}
          saveError={saveError}
          onWidgetNameChange={onWidgetNameChange}
          onZoomChange={setZoomLevel}
          onViewModeChange={setViewMode}
          onActiveChange={onActiveChange}
          onUndo={undo}
          onRedo={redo}
          onSave={onSave}
          onExit={handleExit}
          onDeleteAllDrafts={onDeleteAllDrafts}
          isDeletingAllDrafts={isDeletingAllDrafts}
          onClearError={onClearError}
        />
        </div>

        {/* Canvas Preview Area (Flexible) */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <SectionErrorBoundary section="preview">
            <CanvasPreviewArea
            widgetType={widgetType}
            chatbotConfig={historyState.chatbotConfig}
            formFields={historyState.formFields}
            styles={historyState.styles}
            selectedElement={selectedElement}
            zoomLevel={zoomLevel}
            viewMode={viewMode}
            onElementSelect={handleElementSelect}
            onChatbotConfigChange={handleConfigChange}
            onStylesChange={handleStylesChange}
            />
          </SectionErrorBoundary>
        </div>
      </div>

      {/* AI Panel - Fixed width - Hidden on mobile */}
      <div className="hidden lg:block w-[300px] h-full flex-shrink-0 bg-gray-900 border-l border-gray-800 overflow-hidden">
        <SectionErrorBoundary section="ai">
          <AIPanel
            widgetType={widgetType}
            widgetName={widgetName}
            selectedElement={selectedElement}
            widgetContext={{
              fields: historyState.formFields,
              chatbotConfig: historyState.chatbotConfig,
              styles: historyState.styles,
            }}
            onWidgetUpdate={handleWidgetUpdate}
          />
        </SectionErrorBoundary>
      </div>

      {/* Mobile Floating Action Buttons */}
      <div className="lg:hidden fixed bottom-4 right-4 flex flex-col gap-2 z-[60]">
        <button
          onClick={() => setMobilePanel(mobilePanel === 'ai' ? 'none' : 'ai')}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            mobilePanel === 'ai' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Bot className="w-5 h-5" />
        </button>
        <button
          onClick={() => setMobilePanel(mobilePanel === 'properties' ? 'none' : 'properties')}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            mobilePanel === 'properties' ? 'bg-white text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Bottom Sheet */}
      {mobilePanel !== 'none' && (
        <div className="lg:hidden fixed inset-0 z-[55]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobilePanel('none')}
          />

          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Handle */}
            <div className="flex items-center justify-center py-3 border-b border-gray-800">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-white font-medium">
                {mobilePanel === 'properties' ? 'Properties' : 'AI Assistant'}
              </h3>
              <button
                onClick={() => setMobilePanel('none')}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {mobilePanel === 'properties' && (
                <SectionErrorBoundary section="properties">
                  <CanvasPropertiesPanel
                    sidebarSection={sidebarSection}
                    selectedElement={selectedElement}
                    widgetType={widgetType}
                    widgetName={widgetName}
                    widgetDescription={widgetDescription}
                    defaultWebhookPath={defaultWebhookPath}
                    selectedInstanceIds={selectedInstanceIds}
                    formFields={historyState.formFields}
                    styles={historyState.styles}
                    chatbotConfig={historyState.chatbotConfig}
                    categories={categories}
                    instancesWithoutCategory={instancesWithoutCategory}
                    panelWidth={320}
                    savedWidgetId={savedWidgetId}
                    onWidgetNameChange={onWidgetNameChange}
                    onWidgetDescriptionChange={onWidgetDescriptionChange}
                    onWebhookPathChange={onWebhookPathChange}
                    onInstanceIdsChange={onInstanceIdsChange}
                    onFormFieldsChange={handleFormFieldsChange}
                    onStylesChange={handleStylesChange}
                    onChatbotConfigChange={handleConfigChange}
                    canHideWatermark={canHideWatermark}
                    onSectionChange={setSidebarSection}
                  />
                </SectionErrorBoundary>
              )}
              {mobilePanel === 'ai' && (
                <SectionErrorBoundary section="ai">
                  <AIPanel
                    widgetType={widgetType}
                    widgetName={widgetName}
                    selectedElement={selectedElement}
                    widgetContext={{
                      fields: historyState.formFields,
                      chatbotConfig: historyState.chatbotConfig,
                      styles: historyState.styles,
                    }}
                    onWidgetUpdate={handleWidgetUpdate}
                  />
                </SectionErrorBoundary>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
