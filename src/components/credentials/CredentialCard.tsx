'use client';

/**
 * CredentialCard Component
 * Displays a credential with type icon and delete option
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CredentialIcon from './CredentialIcon';

interface Credential {
  id: string;
  name: string;
  type: string;
  createdAt?: string;
  docUrl?: string;
  isLocalRecord?: boolean; // Flag indicating this is from local tracking, not n8n API
}

interface CredentialCardProps {
  credential: Credential;
  onDelete: (id: string, type: string) => Promise<void>;
  index?: number;
}

export default function CredentialCard({ credential, onDelete, index = 0 }: CredentialCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(credential.id, credential.type);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  // Format the credential type for display
  const formatType = (type: string) => {
    return type
      .replace(/OAuth2Api$/i, '')
      .replace(/Api$/i, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="h-full bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors flex flex-col"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-lg bg-gray-800/50 flex items-center justify-center shrink-0">
            <CredentialIcon type={credential.type} className="h-5 w-5 text-gray-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-white font-medium truncate">{credential.name}</h4>
            <p className="text-xs text-gray-500 truncate">{formatType(credential.type)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center gap-1"
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-red-400 transition-colors"
              title="Delete credential"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {credential.createdAt && (
        <p className="text-xs text-gray-600 mt-2">
          Added {new Date(credential.createdAt).toLocaleDateString()}
        </p>
      )}
    </motion.div>
  );
}
