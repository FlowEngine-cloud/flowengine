'use client';

import { X, Crown, Info } from 'lucide-react';
import Link from 'next/link';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  type?: 'upgrade' | 'dedicated' | 'deploy';
}

export default function UpgradeModal({ isOpen, onClose, feature, type = 'upgrade' }: UpgradeModalProps) {
  // Close on ESC key
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const isDedicated = type === 'dedicated';
  const isDeploy = type === 'deploy';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-sm p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
            isDedicated || isDeploy
              ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
              : 'bg-gradient-to-br from-purple-500 to-violet-600'
          }`}>
            {isDedicated || isDeploy ? <Info className="w-6 h-6 text-white" /> : <Crown className="w-6 h-6 text-white" />}
          </div>

          {isDeploy ? (
            <>
              <h3 className="text-lg font-semibold text-white mb-2">
                Deploy Your First Instance
              </h3>
              <p className="text-white/60 text-sm mb-6">
                This is a preview of how the Portal works. Deploy your first client panel to start managing real clients.
              </p>
              <Link
                href="/n8n-account"
                onClick={onClose}
                className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors text-center"
              >
                Deploy Instance
              </Link>
            </>
          ) : isDedicated ? (
            <>
              <h3 className="text-lg font-semibold text-white mb-2">
                Dedicated Instance
              </h3>
              <p className="text-white/60 text-sm mb-6">
                This is your dedicated instance included with your plan. Dedicated instances are for your personal use and cannot be shared with clients. To share with clients, deploy a pay-per-instance panel.
              </p>
              <Link
                href="/n8n-account"
                onClick={onClose}
                className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors text-center"
              >
                Deploy New Instance
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-white mb-2">
                Pro+ Feature
              </h3>
              <p className="text-white/60 text-sm mb-6">
                {feature
                  ? `${feature} is available on Pro+. Upgrade to unlock client sharing and management features.`
                  : 'This feature is available on Pro+. Upgrade to unlock client sharing and management features.'
                }
              </p>
              <Link
                href="/#pricing"
                onClick={onClose}
                className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors text-center"
              >
                View Pricing
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
