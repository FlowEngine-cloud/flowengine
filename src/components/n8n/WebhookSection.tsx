'use client';

import { ChevronDown, Copy } from 'lucide-react';

interface WebhookSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  coolifyServiceId: string | null | undefined;
  serverDomain: string | null | undefined;
}

export default function WebhookSection({ isExpanded, onToggle, coolifyServiceId, serverDomain }: WebhookSectionProps) {
  const webhookUrl = coolifyServiceId && serverDomain
    ? `https://${serverDomain}/api/v1/deploy?uuid=${coolifyServiceId}&force=false`
    : null;

  return (
    <div className='border-t border-gray-700 pt-4'>
      <button
        onClick={onToggle}
        className='w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors'
      >
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-purple-900/30 rounded-lg'>
            <svg className='w-5 h-5 text-purple-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 10V3L4 14h7v7l9-11h-7z' />
            </svg>
          </div>
          <div className='text-left'>
            <p className='text-purple-400 text-sm font-medium'>Deployment Webhook</p>
            <p className='text-white/50 text-xs'>Trigger deployments from CI/CD pipelines</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className='mt-3'>
          <div className='bg-black/30 border border-gray-700/50 rounded-lg p-4'>
            <p className='text-white/70 text-xs mb-3'>
              Automate your deployment workflow by triggering this webhook from GitHub Actions, GitLab CI, Jenkins, or
              any other CI/CD tool. Perfect for continuous deployment pipelines.
            </p>

            <div className='bg-black/50 rounded-lg p-4 space-y-2'>
              <div className='flex items-center gap-2'>
                <code className='text-white text-sm font-mono break-all flex-1'>
                  {webhookUrl || 'Loading...'}
                </code>
                <button
                  onClick={() => {
                    if (webhookUrl) {
                      navigator.clipboard.writeText(webhookUrl);
                    }
                  }}
                  disabled={!webhookUrl}
                  className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  title='Copy webhook URL'
                >
                  <Copy className='w-4 h-4' />
                </button>
              </div>
              <p className='text-white/50 text-xs'>Send a POST request to this URL to trigger a deployment</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
