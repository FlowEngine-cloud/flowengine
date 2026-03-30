'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, FileText, Palette, Layout, Sparkles, Play, Settings, Share2, Type } from 'lucide-react';
import { SidebarSection, SelectedElement } from './UnifiedCanvasEditor';
import { InfoPanel } from './canvas-properties/InfoPanel';
import { ContentPanel } from './canvas-properties/ContentPanel';
import { ColorsPanel } from './canvas-properties/ColorsPanel';
import { DesignPanel } from './canvas-properties/DesignPanel';
import { EffectsPanel } from './canvas-properties/EffectsPanel';
import { AnimationsPanel } from './canvas-properties/AnimationsPanel';
import { AdvancedPanel } from './canvas-properties/AdvancedPanel';
import { SharePanel } from './canvas-properties/SharePanel';

// ChatbotConfig matches the interface from page.tsx
type ChatbotConfig = Record<string, any>;

// Searchable settings index
interface SearchableItem {
  label: string;
  keywords: string[];
  section: SidebarSection;
  sectionLabel: string;
  forTypes?: Array<'chatbot' | 'form' | 'button'>;
}

const SECTION_ICONS: Record<SidebarSection, React.ComponentType<{ className?: string }>> = {
  info: FileText,
  content: Type,
  colors: Palette,
  design: Layout,
  effects: Sparkles,
  animations: Play,
  advanced: Settings,
  share: Share2,
};

const SEARCHABLE_ITEMS: SearchableItem[] = [
  // Info
  { label: 'Component Name', keywords: ['name', 'title', 'widget'], section: 'info', sectionLabel: 'Info' },
  { label: 'Description', keywords: ['description', 'about', 'info'], section: 'info', sectionLabel: 'Info' },
  { label: 'Webhook Path', keywords: ['webhook', 'url', 'endpoint', 'api'], section: 'info', sectionLabel: 'Info' },
  { label: 'n8n Instance', keywords: ['n8n', 'instance', 'workflow', 'connection'], section: 'info', sectionLabel: 'Info' },

  // Content - Chatbot
  { label: 'Chatbot Name', keywords: ['chatbot', 'name', 'title', 'header'], section: 'content', sectionLabel: 'Content', forTypes: ['chatbot'] },
  { label: 'Welcome Message', keywords: ['welcome', 'greeting', 'initial', 'message'], section: 'content', sectionLabel: 'Content', forTypes: ['chatbot'] },
  { label: 'Placeholder Text', keywords: ['placeholder', 'input', 'hint'], section: 'content', sectionLabel: 'Content', forTypes: ['chatbot'] },
  { label: 'Display Mode', keywords: ['display', 'mode', 'popup', 'embedded', 'inline'], section: 'content', sectionLabel: 'Content', forTypes: ['chatbot'] },
  { label: 'Position', keywords: ['position', 'corner', 'bottom', 'top', 'left', 'right'], section: 'content', sectionLabel: 'Content', forTypes: ['chatbot'] },
  { label: 'File Uploads', keywords: ['file', 'upload', 'attachment', 'attach', 'paperclip'], section: 'content', sectionLabel: 'Content', forTypes: ['chatbot'] },

  // Content - Form
  { label: 'Form Title', keywords: ['form', 'title', 'heading'], section: 'content', sectionLabel: 'Content', forTypes: ['form'] },
  { label: 'Form Fields', keywords: ['fields', 'inputs', 'form', 'text', 'email', 'select'], section: 'content', sectionLabel: 'Content', forTypes: ['form'] },
  { label: 'Button Text', keywords: ['button', 'submit', 'text', 'label'], section: 'content', sectionLabel: 'Content', forTypes: ['form', 'button'] },

  // Colors
  { label: 'Background Color', keywords: ['background', 'color', 'bg'], section: 'colors', sectionLabel: 'Colors' },
  { label: 'Text Color', keywords: ['text', 'color', 'font'], section: 'colors', sectionLabel: 'Colors' },
  { label: 'Primary Color', keywords: ['primary', 'color', 'accent', 'button'], section: 'colors', sectionLabel: 'Colors' },
  { label: 'Header Color', keywords: ['header', 'color', 'top'], section: 'colors', sectionLabel: 'Colors', forTypes: ['chatbot'] },
  { label: 'Bubble Color', keywords: ['bubble', 'color', 'chat', 'icon'], section: 'colors', sectionLabel: 'Colors', forTypes: ['chatbot'] },
  { label: 'User Message Color', keywords: ['user', 'message', 'color', 'sent'], section: 'colors', sectionLabel: 'Colors', forTypes: ['chatbot'] },
  { label: 'Bot Message Color', keywords: ['bot', 'message', 'color', 'received', 'assistant'], section: 'colors', sectionLabel: 'Colors', forTypes: ['chatbot'] },
  { label: 'Input Background', keywords: ['input', 'background', 'field', 'color'], section: 'colors', sectionLabel: 'Colors' },

  // Design
  { label: 'Border Radius', keywords: ['border', 'radius', 'rounded', 'corners'], section: 'design', sectionLabel: 'Design' },
  { label: 'Font Family', keywords: ['font', 'family', 'typography', 'text'], section: 'design', sectionLabel: 'Design' },
  { label: 'Font Size', keywords: ['font', 'size', 'text', 'typography'], section: 'design', sectionLabel: 'Design' },
  { label: 'Bubble Size', keywords: ['bubble', 'size', 'icon'], section: 'design', sectionLabel: 'Design', forTypes: ['chatbot'] },
  { label: 'Chat Window Size', keywords: ['chat', 'window', 'size', 'width', 'height'], section: 'design', sectionLabel: 'Design', forTypes: ['chatbot'] },
  { label: 'Text Alignment', keywords: ['text', 'align', 'alignment', 'left', 'center', 'right'], section: 'design', sectionLabel: 'Design' },

  // Effects
  { label: 'Glow Effect', keywords: ['glow', 'effect', 'shadow', 'light'], section: 'effects', sectionLabel: 'Effects', forTypes: ['chatbot'] },
  { label: 'Gradient', keywords: ['gradient', 'color', 'fade'], section: 'effects', sectionLabel: 'Effects', forTypes: ['chatbot'] },
  { label: 'Glass Effect', keywords: ['glass', 'blur', 'transparent', 'frosted'], section: 'effects', sectionLabel: 'Effects', forTypes: ['chatbot'] },
  { label: 'Typing Indicator', keywords: ['typing', 'indicator', 'loading', 'dots', 'animation', 'waiting', 'response'], section: 'effects', sectionLabel: 'Effects', forTypes: ['chatbot'] },

  // Animations
  { label: 'Bubble Animation', keywords: ['bubble', 'animation', 'pulse', 'bounce', 'shake'], section: 'animations', sectionLabel: 'Animations', forTypes: ['chatbot'] },
  { label: 'Window Animation', keywords: ['window', 'animation', 'slide', 'fade', 'scale', 'open'], section: 'animations', sectionLabel: 'Animations', forTypes: ['chatbot'] },
  { label: 'Greeting Message', keywords: ['greeting', 'notification', 'popup', 'message'], section: 'animations', sectionLabel: 'Animations', forTypes: ['chatbot'] },
  { label: 'Auto Open', keywords: ['auto', 'open', 'automatic', 'delay'], section: 'animations', sectionLabel: 'Animations', forTypes: ['chatbot'] },

  // Advanced
  { label: 'Watermark', keywords: ['watermark', 'branding', 'powered', 'logo'], section: 'advanced', sectionLabel: 'Advanced' },
  { label: 'Custom CSS', keywords: ['css', 'custom', 'style', 'code'], section: 'advanced', sectionLabel: 'Advanced' },
  { label: 'Message Limit', keywords: ['message', 'limit', 'rate', 'max', 'session'], section: 'advanced', sectionLabel: 'Advanced', forTypes: ['chatbot'] },
  { label: 'Submission Limit', keywords: ['submission', 'limit', 'rate', 'max', 'session'], section: 'advanced', sectionLabel: 'Advanced', forTypes: ['form', 'button'] },

  // Share
  { label: 'Embed Code', keywords: ['embed', 'code', 'script', 'html'], section: 'share', sectionLabel: 'Share' },
  { label: 'Share Link', keywords: ['share', 'link', 'url', 'copy'], section: 'share', sectionLabel: 'Share' },
];

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date' | 'time' | 'file' | 'checkbox' | 'radio' | 'phone' | 'url';
  required: boolean;
  options?: string[];
  placeholder?: string;
  width?: '25' | '33' | '50' | '100';
  customBorderRadius?: string;
  customPadding?: string;
  customFontSize?: string;
  customHeight?: string;
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

interface CanvasPropertiesPanelProps {
  sidebarSection: SidebarSection;
  selectedElement: SelectedElement;
  widgetType: 'chatbot' | 'form' | 'button';
  widgetName: string;
  widgetDescription: string;
  defaultWebhookPath: string;
  selectedInstanceIds: string[];
  formFields: FormField[];
  styles: Record<string, any>;
  chatbotConfig: ChatbotConfig;
  categories: Category[];
  instancesWithoutCategory?: InstanceWithoutCategory[];
  panelWidth?: number;
  savedWidgetId: string | null;
  canHideWatermark?: boolean; // Pro+ feature
  onWidgetNameChange: (name: string) => void;
  onWidgetDescriptionChange: (description: string) => void;
  onWebhookPathChange: (path: string) => void;
  onInstanceIdsChange: (ids: string[]) => void;
  onFormFieldsChange: (fields: FormField[]) => void;
  onStylesChange: (styles: Record<string, any>) => void;
  onChatbotConfigChange: (config: ChatbotConfig) => void;
  onSectionChange?: (section: SidebarSection) => void;
}

export function CanvasPropertiesPanel({
  sidebarSection,
  selectedElement,
  widgetType,
  widgetName,
  widgetDescription,
  defaultWebhookPath,
  selectedInstanceIds,
  formFields,
  styles,
  chatbotConfig,
  categories,
  instancesWithoutCategory = [],
  panelWidth = 300,
  savedWidgetId,
  canHideWatermark = false,
  onWidgetNameChange,
  onWidgetDescriptionChange,
  onWebhookPathChange,
  onInstanceIdsChange,
  onFormFieldsChange,
  onStylesChange,
  onChatbotConfigChange,
  onSectionChange,
}: CanvasPropertiesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter searchable items based on widget type and search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return SEARCHABLE_ITEMS.filter((item) => {
      // Filter by widget type
      if (item.forTypes && !item.forTypes.includes(widgetType)) {
        return false;
      }
      // Match label or keywords
      const matchesLabel = item.label.toLowerCase().includes(query);
      const matchesKeywords = item.keywords.some((kw) => kw.includes(query));
      return matchesLabel || matchesKeywords;
    }).slice(0, 8); // Limit results
  }, [searchQuery, widgetType]);

  const handleResultClick = (section: SidebarSection) => {
    if (onSectionChange) {
      onSectionChange(section);
    }
    setSearchQuery('');
  };

  // Determine if we should use compact layout
  const isCompact = panelWidth < 280;
  return (
    <div className="w-full h-full bg-gray-900/50 flex flex-col overflow-hidden">
      {/* Search Bar - Always visible */}
      <div className="flex-shrink-0 p-3 border-b border-gray-800 bg-gray-900/80 relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings..."
            className="w-full pl-9 pr-8 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-gray-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
            {searchResults.map((result, index) => {
              const Icon = SECTION_ICONS[result.section];
              return (
                <button
                  key={`${result.section}-${result.label}-${index}`}
                  onClick={() => handleResultClick(result.section)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700/50 transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{result.label}</div>
                    <div className="text-xs text-gray-500">{result.sectionLabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* No results message */}
        {searchQuery.trim() && searchResults.length === 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-3">
            <p className="text-sm text-gray-400 text-center">No settings found</p>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Info Panel */}
        {sidebarSection === 'info' && (
          <InfoPanel
            widgetName={widgetName}
            widgetDescription={widgetDescription}
            defaultWebhookPath={defaultWebhookPath}
            selectedInstanceIds={selectedInstanceIds}
            categories={categories}
            instancesWithoutCategory={instancesWithoutCategory}
            widgetType={widgetType}
            onWidgetNameChange={onWidgetNameChange}
            onWidgetDescriptionChange={onWidgetDescriptionChange}
            onWebhookPathChange={onWebhookPathChange}
            onInstanceIdsChange={onInstanceIdsChange}
          />
        )}

        {/* Content Panel */}
        {sidebarSection === 'content' && (
          <ContentPanel
            widgetType={widgetType}
            formFields={formFields}
            chatbotConfig={chatbotConfig}
            isCompact={isCompact}
            onFormFieldsChange={onFormFieldsChange}
            onChatbotConfigChange={onChatbotConfigChange}
          />
        )}

        {/* Colors Panel */}
        {sidebarSection === 'colors' && (
          <ColorsPanel
            selectedElement={selectedElement}
            widgetType={widgetType}
            chatbotConfig={chatbotConfig}
            styles={styles}
            isCompact={isCompact}
            onChatbotConfigChange={onChatbotConfigChange}
            onStylesChange={onStylesChange}
          />
        )}

        {/* Design Panel */}
        {sidebarSection === 'design' && (
          <DesignPanel
            widgetType={widgetType}
            styles={styles}
            chatbotConfig={chatbotConfig}
            isCompact={isCompact}
            onStylesChange={onStylesChange}
            onChatbotConfigChange={onChatbotConfigChange}
          />
        )}

        {/* Effects Panel */}
        {sidebarSection === 'effects' && (
          <EffectsPanel
            widgetType={widgetType}
            chatbotConfig={chatbotConfig}
            onChatbotConfigChange={onChatbotConfigChange}
            styles={styles}
            onStylesChange={onStylesChange}
          />
        )}

        {/* Animations Panel */}
        {sidebarSection === 'animations' && widgetType === 'chatbot' && (
          <AnimationsPanel chatbotConfig={chatbotConfig} onChatbotConfigChange={onChatbotConfigChange} />
        )}

        {/* Advanced Panel */}
        {sidebarSection === 'advanced' && (
          <AdvancedPanel
            widgetType={widgetType}
            chatbotConfig={chatbotConfig}
            onChatbotConfigChange={onChatbotConfigChange}
            styles={styles}
            onStylesChange={onStylesChange}
            canHideWatermark={canHideWatermark}
          />
        )}

        {/* Share Panel */}
        {sidebarSection === 'share' && (
          <SharePanel savedWidgetId={savedWidgetId} widgetName={widgetName} />
        )}
      </div>
    </div>
  );
}
