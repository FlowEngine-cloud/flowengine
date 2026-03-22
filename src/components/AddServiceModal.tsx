'use client';

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Calendar, CreditCard, Loader2, ChevronLeft, Plus, Settings, AlertCircle } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import Link from 'next/link';

interface PricingTier {
  price: number;
  display: string;
  yearly?: string;
}

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken?: string;
  onSuccess?: () => void;
}

interface CardInfo {
  hasCard: boolean;
  last4?: string;
  brand?: string;
  paymentMethodId?: string;
}

export default function AddServiceModal({
  isOpen,
  onClose,
  accessToken,
  onSuccess,
}: AddServiceModalProps) {
  useEscapeKey(isOpen, onClose);

  const [step, setStep] = useState<'choose' | 'configure'>('choose');
  const [displayName, setDisplayName] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [checkingCard, setCheckingCard] = useState(false);
  const [directCharging, setDirectCharging] = useState(false);
  const [checkoutRedirecting, setCheckoutRedirecting] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);

  // FlowEngine connection + pricing
  const [flowEngineConnected, setFlowEngineConnected] = useState<boolean | null>(null);
  const [whatsappPricing, setWhatsappPricing] = useState<Record<string, PricingTier> | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('choose');
      setDisplayName('');
      setBillingCycle('annual');
      setChargeError(null);
      setDirectCharging(false);
      setCheckoutRedirecting(false);
      setFlowEngineConnected(null);
      setWhatsappPricing(null);
      setCardInfo(null);
      setConnectionError(null);
    }
  }, [isOpen]);

  // Connection error from FlowEngine API
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Fetch FlowEngine connection status + pricing
  useEffect(() => {
    if (!isOpen || !accessToken || flowEngineConnected !== null) return;
    setPricingLoading(true);
    setConnectionError(null);
    fetch('/api/flowengine/pricing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(res => res.ok ? res.json() : { connected: false, error: 'Failed to connect' })
      .then(data => {
        setFlowEngineConnected(data.connected);
        if (data.connected && data.pricing?.whatsapp) {
          setWhatsappPricing(data.pricing.whatsapp);
        }
        if (!data.connected && data.error) {
          setConnectionError(data.error);
        }
      })
      .catch(() => {
        setFlowEngineConnected(false);
        setConnectionError('Could not reach the server');
      })
      .finally(() => setPricingLoading(false));
  }, [isOpen, accessToken, flowEngineConnected]);

  // Check for card on file when configuring (only if connected)
  useEffect(() => {
    if (!isOpen || !accessToken || cardInfo !== null || !flowEngineConnected || step !== 'configure') return;
    setCheckingCard(true);
    fetch('/api/stripe/charge-card', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(res => res.ok ? res.json() : { hasCard: false })
      .then(data => setCardInfo(data))
      .catch(() => setCardInfo({ hasCard: false }))
      .finally(() => setCheckingCard(false));
  }, [isOpen, accessToken, cardInfo, flowEngineConnected, step]);

  const currentPricing = whatsappPricing?.[billingCycle] || null;

  const handleDeploy = async () => {
    setChargeError(null);

    // If card on file, charge directly
    if (cardInfo?.hasCard && accessToken) {
      setDirectCharging(true);
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
            instanceName: displayName.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          onClose();
          if (onSuccess) onSuccess();
          return;
        }
        setChargeError(data.error || 'Payment failed. Please try again.');
      } catch {
        setChargeError('Something went wrong. Please try again.');
      } finally {
        setDirectCharging(false);
      }
      return;
    }

    // No card on file — fall back to Stripe checkout redirect
    handleCheckoutRedirect();
  };

  const handleCheckoutRedirect = async () => {
    if (!accessToken) return;
    setCheckoutRedirecting(true);
    setChargeError(null);
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
          instanceName: displayName.trim() || undefined,
          cancelUrl: '/portal/services',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setChargeError(err.message || 'Failed to start checkout');
    } finally {
      setCheckoutRedirecting(false);
    }
  };

  const isProcessing = directCharging || checkoutRedirecting;

  if (!isOpen) return null;

  if (step === 'choose') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="relative w-full max-w-md bg-gray-900/50 rounded-lg border border-gray-800">
          <div className="p-6 border-b border-gray-800">
            <button onClick={onClose} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold text-white">Add Service</h2>
            <p className="text-white/60 text-sm mt-1">Choose a service to add</p>
          </div>
          <div className="p-6 space-y-3">
            <button
              onClick={() => setStep('configure')}
              className="w-full p-4 rounded-lg border text-left transition-all bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/30 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-900/30 border border-green-800/50 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">WhatsApp</p>
                  <p className="text-sm text-white/60">Connect a WhatsApp Business number</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !isProcessing) onClose(); }}
    >
      <div className="relative w-full max-w-md bg-gray-900/50 rounded-lg border border-gray-800">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => setStep('choose')}
              disabled={isProcessing}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-semibold text-white">Add WhatsApp Number</h2>
          </div>
          <p className="text-white/60 text-sm mt-1">Connect a WhatsApp Business number</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {pricingLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
              <span className="text-white/40 text-sm">Loading...</span>
            </div>
          ) : flowEngineConnected === false ? (
            /* Not connected — show CTA */
            <div className="p-6 bg-gray-800/20 rounded-lg border border-gray-700 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-800/50 border border-gray-700 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-white/40" />
              </div>
              <div>
                <p className="text-white font-medium">FlowEngine API not connected</p>
                <p className="text-white/50 text-sm mt-1">
                  {connectionError || 'A FlowEngine API key is required to add WhatsApp numbers. Add your API key in settings to get started.'}
                </p>
              </div>
              <Link
                href="/portal/settings?tab=connections#flowengine"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Go to Settings
              </Link>
            </div>
          ) : !whatsappPricing ? (
            /* Connected but pricing data not available */
            <div className="p-6 bg-gray-800/20 rounded-lg border border-gray-700 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-800/50 border border-gray-700 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-white/40" />
              </div>
              <div>
                <p className="text-white font-medium">Pricing unavailable</p>
                <p className="text-white/50 text-sm mt-1">
                  Connected to FlowEngine but couldn&apos;t load WhatsApp pricing. Please try again later.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Support Line"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                  maxLength={50}
                />
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  <Calendar className="inline-block w-4 h-4 mr-1.5 text-gray-400" />
                  Billing Cycle
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`p-4 rounded-lg border transition-all cursor-pointer text-left ${
                      billingCycle === 'monthly'
                        ? 'border-white bg-gray-800/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-white font-medium">Monthly</div>
                    <div className="text-gray-400 text-sm mt-0.5">{currentPricing?.display || 'Billed monthly'}</div>
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`relative p-4 rounded-lg border transition-all cursor-pointer text-left ${
                      billingCycle === 'annual'
                        ? 'border-white bg-gray-800/30'
                        : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                    }`}
                  >
                    <span className="absolute -top-2 right-3 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">
                      SAVE
                    </span>
                    <div className="text-white font-medium">Annual</div>
                    <div className="text-gray-400 text-sm mt-0.5">{currentPricing?.display || 'Save annually'}</div>
                  </button>
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 text-sm">Total</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-bold text-lg">
                      {currentPricing?.display}
                    </span>
                    {billingCycle === 'annual' && currentPricing?.yearly && (
                      <div className="text-gray-500 text-sm">
                        {currentPricing.yearly} billed annually
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card on file info */}
              {checkingCard ? (
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                  <div className="w-4 h-4 bg-gray-800/30 rounded animate-pulse" />
                  <div className="h-4 w-48 bg-gray-800/30 rounded animate-pulse" />
                </div>
              ) : cardInfo?.hasCard ? (
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                  <CreditCard className="w-4 h-4 text-white/30" />
                  <span className="text-sm text-white/60">
                    Paying with {cardInfo.brand} ending in {cardInfo.last4}
                  </span>
                </div>
              ) : null}

              {/* Charge error */}
              {chargeError && (
                <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
                  <p className="text-sm text-red-400">{chargeError}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {flowEngineConnected && whatsappPricing && !pricingLoading && (
          <div className="p-6 pt-0">
            <div className="flex gap-3">
              {cardInfo?.hasCard && (
                <button
                  onClick={handleCheckoutRedirect}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Use different card</span>
                </button>
              )}
              <button
                onClick={handleDeploy}
                disabled={isProcessing || checkingCard}
                className="flex-1 px-4 py-3 bg-white hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 text-black rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : checkingCard ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : cardInfo?.hasCard ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Add & Pay</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add WhatsApp Number</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-gray-500 text-sm mt-3 text-center">
              {cardInfo?.hasCard ? 'Card will be charged immediately' : 'Secure checkout via Stripe'}
            </p>
            <p className="text-white/30 text-sm mt-2 text-center">
              Tip: Use a dedicated number for automations, not your personal one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
