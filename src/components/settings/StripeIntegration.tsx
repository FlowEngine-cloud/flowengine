'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import { CreditCard, Eye, EyeOff, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

export function StripeIntegration() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadStripeStatus();
    }
  }, [user]);

  const loadStripeStatus = async () => {
    if (!user || !session) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_stripe_key_set')
        .eq('id', user.id)
        .single();

      if (profile?.agency_stripe_key_set) {
        setHasKey(true);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error loading stripe status:', error);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim() || !session) return;

    // Basic validation
    if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
      setMessage({ type: 'error', text: 'Please enter a valid Stripe secret key (starts with sk_live_ or sk_test_)' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/agency/stripe-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save API key');
      }

      setHasKey(true);
      setIsConnected(true);
      setApiKey('');
      setMessage({ type: 'success', text: 'Stripe API key saved successfully!' });
    } catch (error: any) {
      console.error('Error saving API key:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!session) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/agency/stripe-key', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove API key');
      }

      setHasKey(false);
      setIsConnected(false);
      setMessage({ type: 'success', text: 'Stripe API key removed' });
    } catch (error: any) {
      console.error('Error removing API key:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to remove API key' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-gray-400" />
        <h3 className="text-lg font-medium text-white">Stripe Integration</h3>
      </div>

      <p className="text-white/60 text-sm mb-4">
        Connect your Stripe account to link client subscriptions. Your clients will see their billing status directly in their dashboard.
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-900/20 border border-green-800 text-green-400'
            : 'bg-red-900/20 border border-red-800 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* Connection Status */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-white font-medium">Connected</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-gray-500 rounded-full" />
                  <span className="text-white/60">Not connected</span>
                </>
              )}
            </div>
            {isConnected && (
              <button
                onClick={handleRemoveApiKey}
                disabled={loading}
                className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                {loading ? 'Removing...' : 'Disconnect'}
              </button>
            )}
          </div>
        </div>

        {/* API Key Input */}
        {!isConnected && (
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Stripe Secret Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-white/40">
                Find your API key in{' '}
                <a
                  href="https://dashboard.stripe.com/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-white underline inline-flex items-center gap-1"
                >
                  Stripe Dashboard <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <button
              onClick={handleSaveApiKey}
              disabled={saving || !apiKey.trim()}
              className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Connecting...
                </span>
              ) : (
                'Connect Stripe'
              )}
            </button>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-white/60">
              <p className="mb-2">
                How it works:
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Connect your Stripe account above</li>
                <li>When inviting a client, link their Stripe subscription</li>
                <li>Clients see their billing status in their dashboard</li>
              </ol>
              <p className="mt-2 text-white/40">
                Your API key is encrypted and stored securely. We only read subscription data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
