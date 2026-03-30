'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetStudioErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('UI Studio Error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-900/50 border border-gray-800 rounded-lg">
          <div className="p-4 rounded-full bg-red-900/20 border border-red-800 mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h3>
          <p className="text-sm text-gray-400 text-center mb-4 max-w-md">
            An error occurred while rendering this component. Your work has been auto-saved.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="text-xs text-red-400 bg-red-900/10 border border-red-800 rounded-lg p-3 mb-4 max-w-md overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper for specific sections
interface SectionErrorBoundaryProps {
  children: ReactNode;
  section: 'preview' | 'properties' | 'sidebar' | 'ai';
}

export function SectionErrorBoundary({ children, section }: SectionErrorBoundaryProps) {
  const titles: Record<string, string> = {
    preview: 'Preview failed to load',
    properties: 'Properties panel failed to load',
    sidebar: 'Sidebar failed to load',
    ai: 'AI Assistant failed to load',
  };

  return (
    <WidgetStudioErrorBoundary fallbackTitle={titles[section]}>
      {children}
    </WidgetStudioErrorBoundary>
  );
}
