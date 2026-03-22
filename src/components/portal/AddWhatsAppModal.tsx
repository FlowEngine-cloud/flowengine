'use client';

/**
 * AddWhatsAppModal — Native in-portal modal for adding a new WhatsApp number.
 * Checks for card on file and charges directly, or falls back to Stripe checkout.
 */
import { useState, useEffect } from 'react';
import { X, MessageSquare, Loader2, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AddWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken?: string;
}

interface CardInfo {
  hasCard: boolean;
  last4?: string;
  brand?: string;
}

export default function AddWhatsAppModal({ isOpen, onClose, accessToken }: AddWhatsAppModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [checkingCard, setCheckingCard] = useState(false);

  // Check for card on file when modal opens
  useEffect(() => {
    if (!isOpen || !accessToken || cardInfo !== null) return;
    setCheckingCard(true);
    fetch('/api/stripe/charge-card', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(res => res.ok ? res.json() : { hasCard: false })
      .then(data => setCardInfo(data))
      .catch(() => setCardInfo({ hasCard: false }))
      .finally(() => setCheckingCard(false));
  }, [isOpen, accessToken, cardInfo]);

  const handleAdd = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    // If card on file, charge directly
    if (cardInfo?.hasCard) {
      try {
        const res = await fetch('/api/stripe/charge-card', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            planType: 'whatsapp',
            billingCycle,
            instanceName: displayName || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          onClose();
          window.location.reload();
          return;
        }
        setError(data.error || 'Payment failed. Please try again.');
        setLoading(false);
      } catch {
        setError('Something went wrong. Please try again.');
        setLoading(false);
      }
      return;
    }

    // No card — fall back to Stripe checkout redirect
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          planType: 'whatsapp',
          billingCycle,
          instanceName: displayName || undefined,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create checkout session');
        setLoading(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-white">Add WhatsApp Number</h2>
                    <p className="text-sm text-white/60">Connect a new WhatsApp number</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    Display Name (optional)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g., Sales WhatsApp"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                    disabled={loading}
                    maxLength={50}
                  />
                </div>

                {/* Billing Cycle */}
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    Billing Cycle
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      disabled={loading}
                      className={cn(
                        'p-4 rounded-lg border text-left transition-all',
                        billingCycle === 'monthly'
                          ? 'border-white bg-gray-800/30'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                      )}
                    >
                      <p className="text-sm font-medium text-white">Monthly</p>
                      <p className="text-lg font-semibold text-white mt-1">$6<span className="text-sm text-white/40">/mo</span></p>
                    </button>
                    <button
                      onClick={() => setBillingCycle('annual')}
                      disabled={loading}
                      className={cn(
                        'p-4 rounded-lg border text-left transition-all relative',
                        billingCycle === 'annual'
                          ? 'border-white bg-gray-800/30'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                      )}
                    >
                      <span className="absolute -top-2 right-3 px-2 py-0.5 bg-green-500/20 border border-green-800 text-green-400 text-sm rounded-full font-medium">
                        Save
                      </span>
                      <p className="text-sm font-medium text-white">Annual</p>
                      <p className="text-lg font-semibold text-white mt-1">$5<span className="text-sm text-white/40">/mo</span></p>
                      <p className="text-sm text-white/40">$60/year</p>
                    </button>
                  </div>
                </div>

                {/* Card on file info */}
                {cardInfo?.hasCard && (
                  <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                    <CreditCard className="w-4 h-4 text-white/40" />
                    <span className="text-sm text-white/60">
                      Paying with {cardInfo.brand} ending in {cardInfo.last4}
                    </span>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
                <p className="text-sm text-white/30">
                  {cardInfo?.hasCard ? 'Card will be charged immediately' : 'Secure checkout via Stripe'}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={loading || checkingCard}
                    className="px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : checkingCard ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking...
                      </>
                    ) : cardInfo?.hasCard ? (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Add & Pay
                      </>
                    ) : (
                      'Add WhatsApp'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
