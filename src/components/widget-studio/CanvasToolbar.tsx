'use client';

import React from 'react';
import {
  ArrowLeft,
  MessageCircle,
  FileText,
  MousePointerClick,
  Monitor,
  Smartphone,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CanvasToolbarProps {
  widgetName: string;
  widgetType: 'chatbot' | 'form' | 'button';
  zoomLevel: number;
  viewMode: 'desktop' | 'mobile';
  isSaving: boolean;
  isActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
  savedWidgetId?: string | null;
  hasUnsavedChanges?: boolean;
  saveError?: string | null;
  onWidgetNameChange: (name: string) => void;
  onZoomChange: (zoom: number) => void;
  onViewModeChange: (mode: 'desktop' | 'mobile') => void;
  onActiveChange: (active: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => Promise<void>;
  onExit: () => void;
  onDeleteAllDrafts?: () => void;
  isDeletingAllDrafts?: boolean;
  onClearError?: () => void;
}

const ZOOM_LEVELS = [50, 100, 150, 200];

export function CanvasToolbar({
  widgetName,
  widgetType,
  zoomLevel,
  viewMode,
  isSaving,
  isActive,
  canUndo,
  canRedo,
  savedWidgetId,
  hasUnsavedChanges,
  saveError,
  onWidgetNameChange,
  onZoomChange,
  onViewModeChange,
  onActiveChange,
  onUndo,
  onRedo,
  onSave,
  onExit,
  onDeleteAllDrafts,
  isDeletingAllDrafts,
  onClearError,
}: CanvasToolbarProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const getWidgetIcon = () => {
    switch (widgetType) {
      case 'chatbot':
        return MessageCircle;
      case 'form':
        return FileText;
      case 'button':
        return MousePointerClick;
      default:
        return MessageCircle;
    }
  };

  const WidgetIcon = getWidgetIcon();

  // BUILD VERSION: 2025-01-01-v3 - If you see this in production, new code is deployed
  return (
    <div className="h-16 bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-between relative z-10" data-build="2025-01-01-v3">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Back Button */}
        <button
          onClick={onExit}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Back to templates"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Widget Icon */}
        <div className="p-2 rounded-lg bg-gray-800/50 text-white">
          <WidgetIcon className="w-5 h-5" />
        </div>

        {/* Widget Name Input */}
        <input
          type="text"
          value={widgetName}
          onChange={(e) => onWidgetNameChange(e.target.value)}
          placeholder="Component Name"
          className="px-3 py-1.5 bg-transparent border-none text-white font-medium text-base focus:outline-none focus:ring-0 min-w-[200px]"
        />
      </div>

      {/* Center Section */}
      <div className="flex items-center gap-6">
        {/* Undo/Redo Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Cmd+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Cmd+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-700" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
              if (currentIndex > 0) {
                onZoomChange(ZOOM_LEVELS[currentIndex - 1]);
              }
            }}
            disabled={zoomLevel === ZOOM_LEVELS[0]}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => onZoomChange(level)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  zoomLevel === level
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {level}%
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
              if (currentIndex < ZOOM_LEVELS.length - 1) {
                onZoomChange(ZOOM_LEVELS[currentIndex + 1]);
              }
            }}
            disabled={zoomLevel === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('desktop')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2',
              viewMode === 'desktop'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Monitor className="w-4 h-4" />
            Desktop
          </button>
          <button
            onClick={() => onViewModeChange('mobile')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2',
              viewMode === 'mobile'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Smartphone className="w-4 h-4" />
            Mobile
          </button>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Error message for non-limit errors */}
        {saveError && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 border border-red-800 rounded-lg">
            <span className="text-xs text-red-400">{saveError}</span>
            <button
              onClick={onClearError}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Save status */}
        {isSaving ? (
          <span className="text-xs text-gray-400">Saving...</span>
        ) : savedWidgetId && !hasUnsavedChanges ? (
          <span className="text-xs text-green-400">Saved</span>
        ) : (
          <button
            onClick={() => onSave()}
            disabled={!widgetName.trim()}
            className="h-7 px-3 bg-white text-black hover:bg-gray-100 rounded text-xs font-medium disabled:opacity-50"
          >
            Save
          </button>
        )}

        {/* Live/Draft Toggle */}
        <button
          onClick={() => onActiveChange(!isActive)}
          className="h-7 flex items-center gap-1.5 px-2 rounded bg-gray-800/50 hover:bg-gray-800 transition-colors"
        >
          <div className={cn(
            "w-7 h-4 rounded-full transition-colors relative",
            isActive ? "bg-green-500" : "bg-gray-600"
          )}>
            <div className={cn(
              "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm",
              isActive ? "left-[14px]" : "left-0.5"
            )} />
          </div>
          <span className={cn("text-xs", isActive ? "text-green-400" : "text-gray-400")}>
            {isActive ? 'Live' : 'Draft'}
          </span>
        </button>

        {/* View Widget - only when saved, after toggle */}
        {savedWidgetId && (
          <a
            href={`/w/${savedWidgetId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-2 flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            title="View component"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View
          </a>
        )}
      </div>
    </div>
  );
}
