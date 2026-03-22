'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Loader2, CheckCircle, AlertCircle, Shield, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

interface AuthSettings {
  allow_signup: boolean;
  enable_google_auth: boolean;
  enable_linkedin_auth: boolean;
  enable_github_auth: boolean;
}

const DEFAULT_AUTH: AuthSettings = {
  allow_signup: false,
  enable_google_auth: false,
  enable_linkedin_auth: false,
  enable_github_auth: false,
};

interface ProviderSetup {
  key: keyof AuthSettings;
  label: string;
  description: string;
  icon: React.ReactNode;
  steps: string[];
  docUrl?: string;
}

const GOOGLE_ICON = (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const LINKEDIN_ICON = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#0A66C2">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const GITHUB_ICON = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

export function AuthenticationSettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<AuthSettings>({ ...DEFAULT_AUTH });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  useEffect(() => {
    if (session) loadSettings();
  }, [session]);

  const loadSettings = async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/settings/portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          allow_signup: data.allow_signup ?? false,
          enable_google_auth: data.enable_google_auth ?? false,
          enable_linkedin_auth: data.enable_linkedin_auth ?? false,
          enable_github_auth: data.enable_github_auth ?? false,
        });
      }
    } catch (err) {
      console.error('Error loading auth settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/portal', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setMessage({ type: 'success', text: 'Authentication settings saved. Changes take effect on the login page immediately.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800/30 rounded w-1/3" />
          <div className="h-10 bg-gray-800/30 rounded" />
          <div className="h-10 bg-gray-800/30 rounded" />
        </div>
      </div>
    );
  }

  const providers: ProviderSetup[] = [
    {
      key: 'allow_signup',
      label: 'Allow Sign Up',
      description: 'Show a "Create account" option on the login page. When disabled, only invited users can log in.',
      icon: <Shield className="h-5 w-5 text-gray-400" />,
      steps: [
        'Toggle this on to allow new users to register on their own.',
        'When off, users must be invited via the Team Members section or Client invites.',
      ],
    },
    {
      key: 'enable_google_auth',
      label: 'Google',
      description: 'Allow users to sign in with their Google account.',
      icon: GOOGLE_ICON,
      steps: [
        'Go to your Supabase Dashboard → Authentication → Providers → Google',
        'Toggle Google provider to "Enabled"',
        'Go to Google Cloud Console → APIs & Services → Credentials',
        'Create an OAuth 2.0 Client ID (Web application type)',
        'Add your Supabase callback URL as an Authorized Redirect URI: https://<your-project>.supabase.co/auth/v1/callback',
        'Copy the Client ID and Client Secret into the Supabase Google provider settings',
        'Save in Supabase, then enable the toggle here',
      ],
      docUrl: 'https://supabase.com/docs/guides/auth/social-login/auth-google',
    },
    {
      key: 'enable_github_auth',
      label: 'GitHub',
      description: 'Allow users to sign in with their GitHub account.',
      icon: GITHUB_ICON,
      steps: [
        'Go to your Supabase Dashboard → Authentication → Providers → GitHub',
        'Toggle GitHub provider to "Enabled"',
        'Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App',
        'Set the Authorization callback URL to: https://<your-project>.supabase.co/auth/v1/callback',
        'Copy the Client ID and Client Secret into the Supabase GitHub provider settings',
        'Save in Supabase, then enable the toggle here',
      ],
      docUrl: 'https://supabase.com/docs/guides/auth/social-login/auth-github',
    },
    {
      key: 'enable_linkedin_auth',
      label: 'LinkedIn',
      description: 'Allow users to sign in with their LinkedIn account.',
      icon: LINKEDIN_ICON,
      steps: [
        'Go to your Supabase Dashboard → Authentication → Providers → LinkedIn (OIDC)',
        'Toggle LinkedIn provider to "Enabled"',
        'Go to LinkedIn Developer Portal → Create a new app',
        'Under "Auth" tab, add the redirect URL: https://<your-project>.supabase.co/auth/v1/callback',
        'Request the "Sign In with LinkedIn using OpenID Connect" product',
        'Copy the Client ID and Client Secret into the Supabase LinkedIn provider settings',
        'Save in Supabase, then enable the toggle here',
      ],
      docUrl: 'https://supabase.com/docs/guides/auth/social-login/auth-linkedin-oidc',
    },
  ];

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-5 w-5 text-gray-400" />
        <h3 className="text-lg font-medium text-white">Login Options</h3>
      </div>
      <p className="text-sm text-white/60 mb-6">
        Control how users sign in. For OAuth providers, you must first configure them in your Supabase Dashboard, then enable them here to show the button on the login page.
      </p>

      <div className="space-y-3">
        {providers.map(({ key, label, description, icon, steps, docUrl }) => {
          const isExpanded = expandedProvider === key;
          const isOAuth = key !== 'allow_signup';

          return (
            <div
              key={key}
              className="bg-gray-900/30 border border-gray-800 rounded-lg overflow-hidden"
            >
              {/* Main toggle row */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1 mr-4">
                  <div className="flex-shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-white/50 mt-0.5">{description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Setup guide toggle - only for OAuth providers */}
                  {isOAuth && (
                    <button
                      type="button"
                      onClick={() => setExpandedProvider(isExpanded ? null : key)}
                      className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                    >
                      Setup guide
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  {/* Toggle switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings[key]}
                    onClick={() => setSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                      settings[key] ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings[key] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Expandable setup guide */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-800/50">
                  <div className="mt-3 bg-gray-950/50 rounded-lg p-4">
                    <p className="text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">Setup Steps</p>
                    <ol className="space-y-2">
                      {steps.map((step, i) => (
                        <li key={i} className="flex gap-2.5 text-xs text-white/60">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-800 text-white/50 flex items-center justify-center text-[10px] font-medium mt-0.5">
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                    {docUrl && (
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Supabase docs
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-900/20 border border-green-800 text-green-400'
                : 'bg-red-900/20 border border-red-800 text-red-400'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {message.text}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
