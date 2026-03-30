'use client';

import React, { useState } from 'react';
import {
  FileText,
  Type,
  Palette,
  Layout,
  Sparkles,
  Play,
  MessageCircle,
  MousePointerClick,
  ChevronDown,
  Share2,
  Settings,
} from 'lucide-react';
import { SidebarSection } from './UnifiedCanvasEditor';

interface CanvasSidebarProps {
  currentSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
  widgetType: 'chatbot' | 'form' | 'button';
  onWidgetTypeChange: (type: 'chatbot' | 'form' | 'button') => void;
}

interface NavItem {
  id: SidebarSection;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  showForTypes?: Array<'chatbot' | 'form' | 'button'>;
}

// Navigation items (AI removed - it's always visible on the right now)
const NAV_ITEMS: NavItem[] = [
  { id: 'info', icon: FileText, label: 'Component Info' },
  { id: 'content', icon: Type, label: 'Content' },
  { id: 'colors', icon: Palette, label: 'Colors' },
  { id: 'design', icon: Layout, label: 'Design' },
  { id: 'effects', icon: Sparkles, label: 'Effects', showForTypes: ['chatbot'] },
  { id: 'animations', icon: Play, label: 'Animations', showForTypes: ['chatbot'] },
  { id: 'advanced', icon: Settings, label: 'Advanced' },
  { id: 'share', icon: Share2, label: 'Share' },
];

const WIDGET_TYPES = [
  { id: 'chatbot' as const, icon: MessageCircle, label: 'Chatbot' },
  { id: 'form' as const, icon: FileText, label: 'Form' },
  { id: 'button' as const, icon: MousePointerClick, label: 'Button' },
];

export function CanvasSidebar({
  currentSection,
  onSectionChange,
  widgetType,
  onWidgetTypeChange,
}: CanvasSidebarProps) {
  const [isTypeMenuExpanded, setIsTypeMenuExpanded] = useState(false);

  const filteredNavItems = NAV_ITEMS.filter(
    (item) => !item.showForTypes || item.showForTypes.includes(widgetType)
  );

  const currentWidgetType = WIDGET_TYPES.find(t => t.id === widgetType);
  const CurrentIcon = currentWidgetType?.icon || MessageCircle;

  return (
    <div className="w-20 h-full bg-gray-900/50 border-r border-gray-800 flex flex-col flex-shrink-0 relative z-10">
        {/* Main Navigation */}
        <div className="flex-1 py-4 overflow-y-auto">
          <div className="space-y-1">
            {/* component type Selector - Inline expandable */}
            <div className="relative">
              <button
                onClick={() => setIsTypeMenuExpanded(!isTypeMenuExpanded)}
                className={`w-full px-2 py-3 flex flex-col items-center gap-1.5 transition-colors group ${
                  isTypeMenuExpanded
                    ? 'bg-gray-800/30 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                }`}
                title={`component type: ${currentWidgetType?.label}`}
              >
                <CurrentIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
                <span className="text-[11px] font-medium text-center leading-tight flex items-center gap-0.5">
                  Type
                  <ChevronDown className={`w-3 h-3 transition-transform ${isTypeMenuExpanded ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {/* Inline component type Options */}
              {isTypeMenuExpanded && (
                <div className="py-1 space-y-0.5">
                  {WIDGET_TYPES.map((type) => {
                    const TypeIcon = type.icon;
                    const isSelected = type.id === widgetType;
                    return (
                      <button
                        key={type.id}
                        onClick={() => {
                          onWidgetTypeChange(type.id);
                          setIsTypeMenuExpanded(false);
                        }}
                        className={`w-full px-2 py-2.5 flex flex-col items-center gap-1.5 transition-colors ${
                          isSelected
                            ? 'bg-white text-black'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                        }`}
                        title={type.label}
                      >
                        <TypeIcon className="w-4 h-4" />
                        <span className="text-[11px] font-medium">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="h-px bg-gray-800 my-2 mx-3" />

            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSectionChange(item.id);
                    // Close type menu when navigating to a section
                    setIsTypeMenuExpanded(false);
                  }}
                  className={`w-full px-2 py-3 flex flex-col items-center gap-1.5 transition-colors group ${
                    isActive
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="text-[11px] font-medium text-center leading-tight">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

    </div>
  );
}
