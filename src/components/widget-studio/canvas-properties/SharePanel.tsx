'use client';

import React, { useState } from 'react';
import {
  Link,
  Code2,
  QrCode,
  Check,
  Copy,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SharePanelProps {
  savedWidgetId: string | null;
  widgetName: string;
}

export function SharePanel({ savedWidgetId, widgetName }: SharePanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedEmbed, setExpandedEmbed] = useState<string | null>(null);
  const [generatingQR, setGeneratingQR] = useState(false);

  const isSaved = !!savedWidgetId;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const getWidgetUrl = () => {
    return savedWidgetId ? `${origin}/w/${savedWidgetId}` : '';
  };

  const getEmbedCode = () => {
    return `<iframe src="${getWidgetUrl()}" width="100%" height="600" frameborder="0"></iframe>`;
  };

  const getScriptCode = () => {
    return `<div id="fe-widget-${savedWidgetId}"></div>\n<script src="${origin}/widget.js" data-id="${savedWidgetId}"></script>`;
  };

  const getHtmlLink = () => {
    return `<a href="${getWidgetUrl()}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;font-family:system-ui,sans-serif;font-weight:500">${widgetName || 'Open Chat'}</a>`;
  };

  const copyToClipboard = async (text: string, field: string) => {
    if (!isSaved) return;
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenPreview = () => {
    if (savedWidgetId) {
      window.open(getWidgetUrl(), '_blank');
    }
  };

  const handleDownloadQR = async () => {
    if (!savedWidgetId) return;
    setGeneratingQR(true);
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getWidgetUrl())}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${widgetName || 'widget'}-qr-code.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    } finally {
      setGeneratingQR(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-medium text-white">Share Widget</h3>

      {/* Not saved warning */}
      {!isSaved && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-900/40 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-400">
              Save your component first to enable sharing options.
            </p>
          </div>
        </div>
      )}

      {/* Share Options List */}
      <div className={cn(
        "border border-gray-800 rounded-lg overflow-hidden divide-y divide-gray-800",
        !isSaved && "opacity-50 pointer-events-none"
      )}>
        {/* Direct Link - Always visible */}
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Link className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs text-white font-medium">Direct Link</span>
            </div>
            <button
              onClick={handleOpenPreview}
              disabled={!isSaved}
              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <ExternalLink className="w-3 h-3" />
              Preview
            </button>
          </div>
          <div className="flex gap-1.5">
            <div className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-400 overflow-x-auto truncate">
              {isSaved ? getWidgetUrl() : 'Save to generate URL'}
            </div>
            <button
              onClick={() => copyToClipboard(getWidgetUrl(), 'link')}
              disabled={!isSaved}
              className={cn(
                'px-2 py-1.5 rounded text-xs transition-all',
                copiedField === 'link' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              )}
            >
              {copiedField === 'link' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* iFrame Embed */}
        <div>
          <button
            onClick={() => setExpandedEmbed(expandedEmbed === 'iframe' ? null : 'iframe')}
            disabled={!isSaved}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-800/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs text-white font-medium">iFrame Embed</span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 transition-transform', expandedEmbed === 'iframe' && 'rotate-180')} />
          </button>
          {expandedEmbed === 'iframe' && (
            <div className="px-3 pb-2.5">
              <div className="flex gap-1.5">
                <pre className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                  {getEmbedCode()}
                </pre>
                <button
                  onClick={() => copyToClipboard(getEmbedCode(), 'iframe')}
                  className={cn(
                    'px-2 py-1.5 rounded text-xs transition-all self-start',
                    copiedField === 'iframe' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  )}
                >
                  {copiedField === 'iframe' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* JavaScript */}
        <div>
          <button
            onClick={() => setExpandedEmbed(expandedEmbed === 'js' ? null : 'js')}
            disabled={!isSaved}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-800/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-xs text-white font-medium">JavaScript</span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 transition-transform', expandedEmbed === 'js' && 'rotate-180')} />
          </button>
          {expandedEmbed === 'js' && (
            <div className="px-3 pb-2.5">
              <div className="flex gap-1.5">
                <pre className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                  {getScriptCode()}
                </pre>
                <button
                  onClick={() => copyToClipboard(getScriptCode(), 'js')}
                  className={cn(
                    'px-2 py-1.5 rounded text-xs transition-all self-start',
                    copiedField === 'js' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  )}
                >
                  {copiedField === 'js' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* HTML Link */}
        <div>
          <button
            onClick={() => setExpandedEmbed(expandedEmbed === 'html' ? null : 'html')}
            disabled={!isSaved}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-800/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-pink-400" />
              <span className="text-xs text-white font-medium">HTML Link</span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 transition-transform', expandedEmbed === 'html' && 'rotate-180')} />
          </button>
          {expandedEmbed === 'html' && (
            <div className="px-3 pb-2.5">
              <div className="flex gap-1.5">
                <pre className="flex-1 px-2 py-1.5 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                  {getHtmlLink()}
                </pre>
                <button
                  onClick={() => copyToClipboard(getHtmlLink(), 'html')}
                  className={cn(
                    'px-2 py-1.5 rounded text-xs transition-all self-start',
                    copiedField === 'html' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  )}
                >
                  {copiedField === 'html' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div>
          <button
            onClick={() => setExpandedEmbed(expandedEmbed === 'qr' ? null : 'qr')}
            disabled={!isSaved}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-800/50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <QrCode className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs text-white font-medium">QR Code</span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 transition-transform', expandedEmbed === 'qr' && 'rotate-180')} />
          </button>
          {expandedEmbed === 'qr' && (
            <div className="px-3 pb-2.5">
              <div className="flex items-center gap-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(getWidgetUrl())}`}
                  alt="QR Code"
                  className="w-16 h-16 rounded bg-white p-1"
                />
                <button
                  onClick={handleDownloadQR}
                  disabled={generatingQR}
                  className="px-2.5 py-1.5 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded text-xs transition-all disabled:opacity-50"
                >
                  {generatingQR ? 'Downloading...' : 'Download PNG'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
