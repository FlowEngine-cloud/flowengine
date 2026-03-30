'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

interface UpgradePreview {
  currentPlan: {
    priceId: string;
    amount: number;
    currency: string;
    interval: string;
  };
  newPlan: {
    priceId: string;
    amount: number;
    currency: string;
    interval: string;
  };
  proration: {
    credit: number;
    newCharge: number;
    totalDue: number;
    currency: string;
    isUpgrade: boolean;
    nextBillingDate: string;
    nextBillingAmount: number;
  };
}

interface UpgradeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  priceId: string;
  accessToken: string;
  loading?: boolean;
}

export function UpgradeConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  priceId,
  accessToken,
  loading = false,
}: UpgradeConfirmationModalProps) {
  const [preview, setPreview] = useState<UpgradePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && priceId && accessToken) {
      fetchPreview();
    }
  }, [isOpen, priceId, accessToken]);

  const fetchPreview = async () => {
    try {
      setLoadingPreview(true);
      setError(null);
      console.log('[UpgradeModal] Fetching preview for priceId:', priceId);

      const response = await fetch('/api/stripe/preview-upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to preview upgrade');
      }

      const data = await response.json();
      console.log('[UpgradeModal] Preview data received:', data);
      setPreview(data);
    } catch (err: any) {
      console.error('[UpgradeModal] Preview error:', err);
      setError(err.message || 'Failed to load upgrade preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getPlanName = (amount: number, interval: string) => {
    const monthlyAmount = interval === 'year' ? amount / 12 : amount;
    const tier = monthlyAmount <= 1900 ? 'Pro' : 'Pro Plus';
    const cycle = interval === 'year' ? 'Yearly' : 'Monthly';
    return `${tier} ${cycle}`;
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4'>
      <div className='bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <h3 className='text-xl font-semibold text-white'>
            {preview?.proration.isUpgrade ? 'Confirm Upgrade' : 'Confirm Downgrade'}
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className='p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {loadingPreview ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin text-white/60' />
          </div>
        ) : error ? (
          <div className='py-6'>
            <p className='text-red-400 text-sm mb-4'>{error}</p>
            <button
              onClick={onClose}
              className='w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors'
            >
              Close
            </button>
          </div>
        ) : preview ? (
          <>
            {/* Plan Comparison */}
            <div className='space-y-4 mb-6'>
              <div className='flex items-center justify-between p-4 bg-gray-800/30 rounded-lg border border-gray-800'>
                <div>
                  <p className='text-xs text-gray-400 mb-1'>Current Plan</p>
                  <p className='text-white font-medium'>
                    {getPlanName(preview.currentPlan.amount, preview.currentPlan.interval)}
                  </p>
                  <p className='text-sm text-gray-400 mt-1'>
                    {formatCurrency(preview.currentPlan.amount, preview.currentPlan.currency)}/
                    {preview.currentPlan.interval}
                  </p>
                </div>
              </div>

              <div className='flex items-center justify-center'>
                <div className='h-px w-full bg-gradient-to-r from-transparent via-gray-700 to-transparent' />
                <span className='px-3 text-xs text-gray-500 whitespace-nowrap'>upgrading to</span>
                <div className='h-px w-full bg-gradient-to-r from-transparent via-gray-700 to-transparent' />
              </div>

              <div className='flex items-center justify-between p-4 bg-purple-900/20 rounded-lg border border-purple-800/40'>
                <div>
                  <p className='text-xs text-purple-400 mb-1'>New Plan</p>
                  <p className='text-white font-medium'>
                    {getPlanName(preview.newPlan.amount, preview.newPlan.interval)}
                  </p>
                  <p className='text-sm text-gray-400 mt-1'>
                    {formatCurrency(preview.newPlan.amount, preview.newPlan.currency)}/
                    {preview.newPlan.interval}
                  </p>
                </div>
              </div>
            </div>

            {/* Proration Breakdown */}
            <div className='p-4 bg-gray-800/50 rounded-lg border border-gray-700 mb-6'>
              <p className='text-xs text-gray-400 uppercase tracking-wider mb-3'>
                {preview.proration.isUpgrade ? 'Billing Summary' : 'Downgrade Information'}
              </p>

              {preview.proration.isUpgrade ? (
                /* Upgrade: Show immediate charge */
                <div className='space-y-2 text-sm'>
                  {preview.proration.credit > 0 && (
                    <div className='flex items-center justify-between'>
                      <span className='text-gray-300'>Credit for unused time</span>
                      <span className='text-green-400'>
                        -{formatCurrency(preview.proration.credit, preview.proration.currency)}
                      </span>
                    </div>
                  )}
                  <div className='flex items-center justify-between'>
                    <span className='text-gray-300'>New plan charge (prorated)</span>
                    <span className='text-white'>
                      {formatCurrency(preview.proration.newCharge, preview.proration.currency)}
                    </span>
                  </div>
                  <div className='pt-2 border-t border-gray-700'>
                    <div className='flex items-center justify-between'>
                      <span className='text-white font-semibold'>Total due today</span>
                      <span className='text-white font-semibold text-lg'>
                        {formatCurrency(preview.proration.totalDue, preview.proration.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Downgrade: Show next billing info */
                <div className='space-y-3 text-sm'>
                  <div className='p-3 bg-blue-900/20 border border-blue-800/40 rounded-lg'>
                    <p className='text-blue-400 text-xs mb-1'>Change applies at end of current period</p>
                    <p className='text-white'>
                      {new Date(preview.proration.nextBillingDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className='flex items-center justify-between'>
                    <span className='text-gray-300'>Current plan price</span>
                    <span className='text-white'>
                      {formatCurrency(preview.currentPlan.amount, preview.currentPlan.currency)}/
                      {preview.currentPlan.interval}
                    </span>
                  </div>

                  <div className='pt-2 border-t border-gray-700'>
                    <div className='flex items-center justify-between'>
                      <span className='text-white font-semibold'>Next billing amount</span>
                      <span className='text-white font-semibold text-lg'>
                        {formatCurrency(preview.proration.nextBillingAmount, preview.proration.currency)}
                      </span>
                    </div>
                  </div>

                  <p className='text-xs text-gray-400 pt-2'>
                    No charge today. Your subscription will automatically switch to the new plan on the date above.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className='flex gap-3'>
              <button
                onClick={onClose}
                disabled={loading}
                className='flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className='flex-1 px-4 py-3 bg-white hover:bg-gray-100 disabled:bg-gray-400 text-black rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2'
              >
                {loading && <Loader2 className='h-4 w-4 animate-spin' />}
                {loading
                  ? preview?.proration.isUpgrade
                    ? 'Upgrading...'
                    : 'Confirming...'
                  : preview?.proration.isUpgrade
                  ? 'Confirm Upgrade'
                  : 'Confirm Downgrade'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
