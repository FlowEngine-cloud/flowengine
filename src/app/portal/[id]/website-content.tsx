'use client';

/**
 * WebsitePortalContent — Manage panel for Website / Docker / "other" instances.
 * Shown when service_type is 'website', 'other', or unknown.
 * Displays instance URL, status, and links to the Hosting page for lifecycle controls.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, Copy, Check, Server, ArrowRight } from 'lucide-react';

interface Props {
  instanceId: string;
  instanceName: string;
  instanceUrl?: string;
  status?: string;
}

export function WebsitePortalContent({ instanceId, instanceName, instanceUrl, status }: Props) {
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    if (!instanceUrl) return;
    navigator.clipboard.writeText(instanceUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isOnline = status === 'running' || status === 'active';
  const statusLabel = isOnline ? 'Online' : (status || 'Unknown');

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header */}
      <div className="border-b border-gray-800 bg-black px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {instanceUrl ? (
            <>
              <a
                href={instanceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm truncate flex items-center gap-1"
              >
                {instanceUrl.replace(/^https?:\/\//, '')}
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
              <button
                onClick={copyUrl}
                className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-white transition-colors shrink-0"
                title="Copy URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            <span className="text-gray-600 text-sm">No URL configured</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
          <span className="text-xs text-gray-400 capitalize">{statusLabel}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        <div className="w-20 h-20 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center">
          <Globe className="w-10 h-10 text-gray-500" />
        </div>

        <div className="text-center space-y-2">
          <p className="text-white font-semibold text-xl">{instanceName}</p>
          {instanceUrl && (
            <a
              href={instanceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 justify-center"
            >
              {instanceUrl.replace(/^https?:\/\//, '')}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="max-w-sm text-center space-y-4">
          <p className="text-gray-500 text-sm">
            Start, stop, and configure this instance from the Hosting page.
          </p>
          <Link
            href={`/portal/hosting/${instanceId}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
          >
            <Server className="w-4 h-4" />
            Open Hosting Page
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
