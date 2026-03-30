'use client';

/**
 * MissingCredentialsModal Component
 * Shows after importing a workflow with missing credentials
 * Allows users to add each missing credential
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Plus, CheckCircle } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import CredentialIcon from '@/components/credentials/CredentialIcon';

interface MissingCredential {
  type: string;
  name: string;
  icon: string;
}

interface MissingCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowName: string;
  missingCredentials: MissingCredential[];
  onAddCredential: (type: string) => void;
  addedCredentials?: string[]; // Types that have been added
}

export default function MissingCredentialsModal({
  isOpen,
  onClose,
  workflowName,
  missingCredentials,
  onAddCredential,
  addedCredentials = [],
}: MissingCredentialsModalProps) {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const remainingCount = missingCredentials.filter(c => !addedCredentials.includes(c.type)).length;
  const allAdded = remainingCount === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-white">Add Missing Credentials</h2>
                <p className="text-sm text-gray-400 mt-1">
                  For: {workflowName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-3">
              {allAdded ? (
                <div className="p-4 rounded-lg bg-green-900/20 border border-green-800/50 text-center">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-green-400 font-medium">All credentials added!</p>
                  <p className="text-sm text-gray-400 mt-1">Your workflow is ready to use.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-400 mb-4">
                    Click on each credential to add it:
                  </p>
                  {missingCredentials.map((cred) => {
                    const isAdded = addedCredentials.includes(cred.type);
                    return (
                      <button
                        key={cred.type}
                        onClick={() => !isAdded && onAddCredential(cred.type)}
                        disabled={isAdded}
                        className={`w-full flex items-center justify-between p-4 rounded-lg transition-all text-left ${
                          isAdded
                            ? 'bg-green-900/20 border border-green-800/50'
                            : 'bg-red-900/20 border border-red-800/50 hover:bg-red-900/30 hover:border-red-700 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <CredentialIcon
                            type={cred.icon}
                            fallback="none"
                            className={`w-6 h-6 ${isAdded ? 'text-green-400' : 'text-red-400'}`}
                          />
                          <span className="text-white font-medium">{cred.name}</span>
                        </div>
                        {isAdded ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            <span className="text-xs text-green-400">Added</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-400">
                            <Plus className="w-5 h-5" />
                            <span className="text-xs">Add</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-800">
              <button
                onClick={onClose}
                className="w-full py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                {allAdded ? 'Done' : `Skip (${remainingCount} remaining)`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
