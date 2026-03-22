'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import { Mail, Eye, EyeOff, AlertCircle, RefreshCw, Send } from 'lucide-react';

interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  sender: string;
}

export function SmtpIntegration() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [settings, setSettings] = useState<SmtpSettings>({
    host: '',
    port: 587,
    user: '',
    password: '',
    sender: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadSmtpStatus();
    }
  }, [user]);

  const loadSmtpStatus = async () => {
    if (!user || !session) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_smtp_host, agency_smtp_port, agency_smtp_user, agency_smtp_sender, agency_smtp_enabled')
        .eq('id', user.id)
        .single();

      if (profile?.agency_smtp_enabled) {
        setIsEnabled(true);
        setSettings({
          host: profile.agency_smtp_host || '',
          port: profile.agency_smtp_port || 587,
          user: profile.agency_smtp_user || '',
          password: '', // Password is never returned
          sender: profile.agency_smtp_sender || '',
        });
      }
    } catch (error) {
      console.error('Error loading SMTP status:', error);
    }
  };

  const handleSave = async () => {
    // Password is only required for new setups, not updates
    if (!settings.host || !settings.user || !settings.sender || !session) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    // Password required only for initial setup
    if (!isEnabled && !settings.password) {
      setMessage({ type: 'error', text: 'Password is required for initial setup' });
      return;
    }

    // Basic email validation for sender
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(settings.sender)) {
      setMessage({ type: 'error', text: 'Please enter a valid sender email address' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/agency/smtp-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save SMTP settings');
      }

      setIsEnabled(true);
      setSettings(prev => ({ ...prev, password: '' })); // Clear password after save
      setMessage({ type: 'success', text: 'SMTP settings saved successfully!' });
    } catch (error: any) {
      console.error('Error saving SMTP settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save SMTP settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!session) return;

    setTesting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/agency/smtp-settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email');
      }

      setMessage({ type: 'success', text: `Test email sent to ${user?.email}. Check your inbox!` });
    } catch (error: any) {
      console.error('Error testing SMTP:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to send test email' });
    } finally {
      setTesting(false);
    }
  };

  const handleDisable = async () => {
    if (!session) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/agency/smtp-settings', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable SMTP');
      }

      setIsEnabled(false);
      setSettings({ host: '', port: 587, user: '', password: '', sender: '' });
      setMessage({ type: 'success', text: 'SMTP disabled. Using default system emails.' });
    } catch (error: any) {
      console.error('Error disabling SMTP:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to disable SMTP' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5 text-gray-400" />
        <h3 className="text-lg font-medium text-white">Email SMTP</h3>
      </div>

      <p className="text-white/60 text-sm mb-4">
        Send client invitations from your own email address for a white-label experience.
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
                {isEnabled ? (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-white font-medium">SMTP Enabled</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-gray-500 rounded-full" />
                    <span className="text-white/60">Using default system emails</span>
                  </>
                )}
              </div>
              {isEnabled && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="text-sm text-white/60 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {testing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    {testing ? 'Sending...' : 'Test'}
                  </button>
                  <button
                    onClick={handleDisable}
                    disabled={loading}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Disabling...' : 'Disable'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SMTP Settings Form */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">SMTP Host *</label>
                <input
                  type="text"
                  value={settings.host}
                  onChange={(e) => setSettings(prev => ({ ...prev, host: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Port *</label>
                <input
                  type="number"
                  value={settings.port}
                  onChange={(e) => setSettings(prev => ({ ...prev, port: parseInt(e.target.value) || 587 }))}
                  placeholder="587"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Username/Email *</label>
              <input
                type="text"
                value={settings.user}
                onChange={(e) => setSettings(prev => ({ ...prev, user: e.target.value }))}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">
                Password / App Password {isEnabled ? '' : '*'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.password}
                  onChange={(e) => setSettings(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={isEnabled ? 'Leave blank to keep current password' : 'Enter password'}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-white/40">
                {isEnabled
                  ? 'Only enter a new password if you want to change it'
                  : 'For Gmail, use an App Password (not your regular password)'}
              </p>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Sender Email *</label>
              <input
                type="email"
                value={settings.sender}
                onChange={(e) => setSettings(prev => ({ ...prev, sender: e.target.value }))}
                placeholder="noreply@youragency.com"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
              />
              <p className="mt-1 text-xs text-white/40">
                This is the "From" address your clients will see
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !settings.host || !settings.user || !settings.sender || (!isEnabled && !settings.password)}
              className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : isEnabled ? (
                'Update SMTP Settings'
              ) : (
                'Enable SMTP'
              )}
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-white/60">
                <p className="mb-2">
                  Popular SMTP providers:
                </p>
                <ul className="list-disc list-inside space-y-1 text-white/40">
                  <li>Gmail: smtp.gmail.com (port 587)</li>
                  <li>Outlook: smtp.office365.com (port 587)</li>
                  <li>SendGrid: smtp.sendgrid.net (port 587)</li>
                  <li>Mailgun: smtp.mailgun.org (port 587)</li>
                </ul>
                <p className="mt-2 text-white/40">
                  Your password is encrypted and stored securely.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
