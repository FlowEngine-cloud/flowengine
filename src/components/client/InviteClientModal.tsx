'use client';

import React, { useState } from 'react';
import { X, RefreshCw, CheckCircle, Check, Server } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface InviteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (config: InviteConfig) => Promise<string | null>;
  isSending?: boolean;
  agencyInstances?: { id: string; name: string; storage_limit_gb: number }[];
}

export interface InviteConfig {
  name: string;
  email?: string;
  storageSizeGb: 0;
  billingCycle: 'monthly';
  allowFullAccess: boolean;
  existingInstanceIds?: string[];
}

export default function InviteClientModal({
  isOpen,
  onClose,
  onInvite,
  isSending = false,
  agencyInstances = [],
}: InviteClientModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [apiError, setApiError] = useState('');
  const [successName, setSuccessName] = useState('');
  const [successInvited, setSuccessInvited] = useState(false);

  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);

  useEscapeKey(isOpen && !isSending && !successName, onClose);

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(s => s !== id) : [...list, id]);
  };

  const handleInvite = async () => {
    if (!name.trim()) {
      setNameError('Client name is required');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setNameError('');
    setEmailError('');
    setApiError('');

    const config: InviteConfig = {
      name: name.trim(),
      email: email.trim() || undefined,
      storageSizeGb: 0,
      billingCycle: 'monthly',
      allowFullAccess: false,
      existingInstanceIds: selectedInstanceIds.length > 0 ? selectedInstanceIds : undefined,
    };

    const error = await onInvite(config);
    if (error) {
      setApiError(error);
    } else {
      setSuccessName(name.trim());
      setSuccessInvited(!!email.trim());
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setName('');
      setEmail('');
      setNameError('');
      setEmailError('');
      setApiError('');
      setSuccessName('');
      setSuccessInvited(false);
      setSelectedInstanceIds([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  const ItemCheckbox = ({ checked, label, sublabel, onClick }: { checked: boolean; label: string; sublabel?: string | null; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-left transition-all ${
        checked ? 'bg-gray-800/50 border-gray-600' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
      }`}
    >
      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
        checked ? 'bg-white' : 'border border-gray-600'
      }`}>
        {checked && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white truncate">{label}</p>
        {sublabel && <p className="text-sm text-white/40 truncate">{sublabel}</p>}
      </div>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSending) handleClose();
      }}
    >
      <div className="w-full max-w-md bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        {successName ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-green-900/30 border border-green-800 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-7 h-7 text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Client Added</h2>
            <p className="text-white/60 text-sm mb-6">
              <span className="text-white font-medium">{successName}</span>{successInvited ? ' has been added and will receive an invite email' : ' has been added as a client'}
            </p>
            <button onClick={handleClose} className="px-6 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Add Client</h2>
              <button onClick={handleClose} disabled={isSending} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Client name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                    if (apiError) setApiError('');
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                  placeholder="Acme Corp"
                  autoFocus
                  className={`w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors ${
                    nameError ? 'border-red-500/50' : 'border-gray-800'
                  }`}
                />
                {nameError && <p className="text-red-400 text-sm mt-1.5">{nameError}</p>}
              </div>

              {/* Email (optional) */}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Client email <span className="text-white/30">(optional — sends an invite)</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                    if (apiError) setApiError('');
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                  placeholder="client@example.com"
                  className={`w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors ${
                    emailError ? 'border-red-500/50' : 'border-gray-800'
                  }`}
                />
                {emailError && <p className="text-red-400 text-sm mt-1.5">{emailError}</p>}
                {apiError && (
                  <div className="mt-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                    <p className="text-red-400 text-sm">{apiError}</p>
                  </div>
                )}
              </div>

              {/* Assign Instances & Services (optional) */}
              <div className="space-y-4">
                {agencyInstances.length > 0 && (
                  <div>
                    <label className="flex items-center gap-1.5 text-sm text-white/60 mb-2">
                      <Server className="w-3.5 h-3.5" />
                      Assign Instances
                    </label>
                    <div className="space-y-1.5">
                      {agencyInstances.map((inst) => (
                        <ItemCheckbox
                          key={inst.id}
                          checked={selectedInstanceIds.includes(inst.id)}
                          label={inst.name}
                          sublabel={inst.storage_limit_gb ? `${inst.storage_limit_gb}GB` : null}
                          onClick={() => toggleItem(inst.id, selectedInstanceIds, setSelectedInstanceIds)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {agencyInstances.length === 0 && (
                  <p className="text-white/40 text-sm py-2">
                    No instances to assign yet. Client will get portal access.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
              <button onClick={handleClose} disabled={isSending} className="flex-1 py-3 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={isSending || !name.trim()}
                className="flex-1 py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 transition-all flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Adding...</>
                ) : (
                  <><Check className="w-4 h-4" /> Add Client</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
