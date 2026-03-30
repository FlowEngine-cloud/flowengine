'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

/**
 * OAuth providers handled by FlowEngine's OAuth broker.
 * Derived from FLOWENGINE_OAUTH_TYPES in AddCredentialModal.tsx.
 */
interface OAuthProvider {
  id: string;
  name: string;
  services: string[];
}

const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: 'google',
    name: 'Google',
    services: [
      'Gmail', 'Google Sheets', 'Google Drive', 'Google Calendar',
      'Google Docs', 'Google BigQuery', 'Google Analytics', 'Google Ads',
      'Google Contacts', 'Google Chat', 'Google Tasks', 'Google Slides',
      'Google Translate', 'Vertex AI (Gemini)', 'Google Forms', 'Google Books',
      'Google Business Profile', 'Google Cloud Storage', 'Google Perspective',
      'Firebase Firestore', 'Firebase Realtime DB', 'Google Workspace Admin',
      'Cloud Natural Language',
    ],
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    services: [
      'Microsoft 365', 'OneDrive', 'Outlook', 'Microsoft Teams',
      'Microsoft Calendar', 'Microsoft Excel', 'SharePoint',
    ],
  },
  { id: 'slack', name: 'Slack', services: ['Slack'] },
  { id: 'linkedin', name: 'LinkedIn', services: ['LinkedIn'] },
  { id: 'reddit', name: 'Reddit', services: ['Reddit'] },
  { id: 'twitter', name: 'Twitter/X', services: ['Twitter/X'] },
];

interface OAuthCredentials {
  [providerId: string]: {
    clientId: string;
    clientSecret: string;
  };
}

export function OAuthSettings() {
  const { session } = useAuth();
  const [credentials, setCredentials] = useState<OAuthCredentials>({});
  const [serverCredentials, setServerCredentials] = useState<OAuthCredentials>({});
  const [loading, setLoading] = useState(true);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<{ provider: string; type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (session) loadCredentials();
  }, [session]);

  const loadCredentials = async () => {
    if (!session) return;
    try {
      const response = await fetch('/api/settings/portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.oauth_credentials) {
          const parsed = typeof data.oauth_credentials === 'string'
            ? JSON.parse(data.oauth_credentials)
            : data.oauth_credentials;
          setCredentials(parsed);
          setServerCredentials(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading OAuth credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (providerId: string) => {
    if (!session) return;
    setSavingProvider(providerId);
    setMessage(null);

    try {
      const updated = { ...serverCredentials, [providerId]: credentials[providerId] };
      if (!credentials[providerId]?.clientId && !credentials[providerId]?.clientSecret) {
        delete updated[providerId];
      }

      const response = await fetch('/api/settings/portal', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ oauth_credentials: updated }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save OAuth credentials');
      }

      setServerCredentials(updated);
      setMessage({ provider: providerId, type: 'success', text: 'Saved' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to save';
      setMessage({ provider: providerId, type: 'error', text: errMsg });
    } finally {
      setSavingProvider(null);
    }
  };

  const updateCredential = (providerId: string, field: 'clientId' | 'clientSecret', value: string) => {
    setCredentials(prev => ({
      ...prev,
      [providerId]: {
        clientId: prev[providerId]?.clientId || '',
        clientSecret: prev[providerId]?.clientSecret || '',
        [field]: value,
      },
    }));
  };

  const toggleExpanded = (providerId: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  };

  const toggleSecret = (key: string) => {
    setVisibleSecrets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isConfigured = (providerId: string) => {
    const cred = serverCredentials[providerId];
    return cred && (cred.clientId || cred.clientSecret);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-800/30 rounded w-1/3" />
              <div className="h-10 bg-gray-800/30 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Explanation */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-medium text-white">What is OAuth?</h3>
        </div>
        <p className="text-sm text-white/60 mb-3">
          OAuth allows your n8n instances to connect to third-party services (Google, Slack, etc.) on behalf of your clients. Instead of each client creating their own OAuth app, you register one OAuth app per provider and all client n8n instances use your credentials.
        </p>
        <p className="text-sm text-white/60">
          For each provider below, create an OAuth app in their developer portal, then paste the Client ID and Client Secret here. These credentials are injected into n8n instances so clients can authenticate with one click.
        </p>
      </div>

      {/* Providers */}
      <div className="space-y-3">
        {OAUTH_PROVIDERS.map(provider => {
          const isExpanded = expandedProviders.has(provider.id);
          const configured = isConfigured(provider.id);
          const cred = credentials[provider.id] || { clientId: '', clientSecret: '' };
          const secretKey = `${provider.id}-secret`;
          const isSaving = savingProvider === provider.id;

          return (
            <div key={provider.id} id={provider.id} className="bg-gray-900/50 border border-gray-800 rounded-lg scroll-mt-24">
              <button
                onClick={() => toggleExpanded(provider.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/30 transition-colors rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-white/40" />
                    : <ChevronRight className="h-4 w-4 text-white/40" />
                  }
                  <span className="text-white font-medium">{provider.name}</span>
                  {configured && (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </div>
                {provider.services.length > 1 && (
                  <span className="text-sm text-white/40">
                    {provider.services.length} services
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 space-y-4 border-t border-gray-800">
                  {/* Services covered */}
                  {provider.services.length > 1 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {provider.services.map(s => (
                        <span key={s} className="text-xs px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white/50">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Client ID */}
                  <div className={provider.services.length <= 1 ? 'mt-4' : ''}>
                    <label className="block text-sm text-white/60 mb-2">Client ID</label>
                    <input
                      type="text"
                      value={cred.clientId}
                      onChange={e => updateCredential(provider.id, 'clientId', e.target.value)}
                      placeholder="Enter Client ID"
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                    />
                  </div>

                  {/* Client Secret */}
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Client Secret</label>
                    <div className="relative">
                      <input
                        type={visibleSecrets.has(secretKey) ? 'text' : 'password'}
                        value={cred.clientSecret}
                        onChange={e => updateCredential(provider.id, 'clientSecret', e.target.value)}
                        placeholder="Enter Client Secret"
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => toggleSecret(secretKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {visibleSecrets.has(secretKey) ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Message */}
                  {message?.provider === provider.id && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                      message.type === 'success'
                        ? 'bg-green-900/20 border border-green-800 text-green-400'
                        : 'bg-red-900/20 border border-red-800 text-red-400'
                    }`}>
                      {message.type === 'success'
                        ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        : <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      }
                      {message.text}
                    </div>
                  )}

                  {/* Save */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSave(provider.id)}
                      disabled={isSaving}
                      className="px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      {isSaving ? (
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
