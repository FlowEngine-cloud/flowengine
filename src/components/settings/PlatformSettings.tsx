'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import {
  Eye,
  EyeOff,
  Brain,
  Key,
  Loader2,
  CheckCircle,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { StripeIntegration } from './StripeIntegration';
import { SmtpIntegration } from './SmtpIntegration';

interface PlatformConfig {
  // AI
  ai_base_url: string;
  ai_api_key: string;
  // FlowEngine
  flowengine_api_key: string;
}

type SectionKey = 'ai' | 'flowengine';

const DEFAULT_CONFIG: PlatformConfig = {
  ai_base_url: '',
  ai_api_key: '',
  flowengine_api_key: '',
};

const SECTION_FIELDS: Record<SectionKey, (keyof PlatformConfig)[]> = {
  ai: ['ai_base_url', 'ai_api_key'],
  flowengine: ['flowengine_api_key'],
};

const SECRET_FIELDS: Set<keyof PlatformConfig> = new Set([
  'ai_api_key',
  'flowengine_api_key',
]);

export function PlatformSettings() {
  const { session } = useAuth();
  const [config, setConfig] = useState<PlatformConfig>({ ...DEFAULT_CONFIG });
  const [serverConfig, setServerConfig] = useState<PlatformConfig>({ ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [message, setMessage] = useState<{ section: SectionKey; type: 'success' | 'error'; text: string } | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<keyof PlatformConfig>>(new Set());
  const [testingConnection, setTestingConnection] = useState(false);
  const [feConnectionStatus, setFeConnectionStatus] = useState<'connected' | 'failed' | null>(null);

  useEffect(() => {
    if (session) {
      loadConfig();
    }
  }, [session]);

  const loadConfig = async () => {
    if (!session) return;
    try {
      const response = await fetch('/api/settings/portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const merged = { ...DEFAULT_CONFIG, ...data };
        setConfig(merged);
        setServerConfig(merged);
      }
    } catch (error) {
      console.error('Error loading platform settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (section: SectionKey) => {
    if (!session) return;
    setSavingSection(section);
    setMessage(null);

    try {
      const fields = SECTION_FIELDS[section];
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const value = config[field];
        if (SECRET_FIELDS.has(field)) {
          if (value !== '********') {
            payload[field] = value || null;
          }
        } else {
          payload[field] = value;
        }
      }

      const response = await fetch('/api/settings/portal', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      const updatedServer = { ...serverConfig };
      for (const field of fields) {
        (updatedServer as Record<string, unknown>)[field] = config[field];
      }
      setServerConfig(updatedServer);
      if (section === 'flowengine') {
        setFeConnectionStatus(null);
        // Notify hooks to re-fetch FlowEngine instances immediately
        try {
          sessionStorage.removeItem('portal-hosting-instances-v3');
          window.dispatchEvent(new CustomEvent('flowengine-key-updated', { detail: { removed: false } }));
        } catch {}
      }

      setMessage({ section, type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to save settings';
      setMessage({ section, type: 'error', text: errMsg });
    } finally {
      setSavingSection(null);
    }
  };

  const testFlowEngineConnection = async () => {
    if (!session) return;
    setTestingConnection(true);
    setMessage(null);
    try {
      // Send the current form key directly so the test works even before saving.
      // If the field shows '********' (masked/unchanged), fall back to DB key via GET.
      const formKey = config.flowengine_api_key;
      const hasLiveKey = formKey && formKey !== '********';
      // Always POST so we can pass both the key and the URL from the form
      const res = await fetch('/api/flowengine/pricing', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(hasLiveKey ? { apiKey: formKey } : {}),
        }),
      });
      const data = await res.json();
      if (data.connected) {
        setFeConnectionStatus('connected');
        setMessage({ section: 'flowengine', type: 'success', text: 'Connection successful — FlowEngine API is reachable' });
      } else {
        setFeConnectionStatus('failed');
        const errText = data.error || 'Connection failed';
        setMessage({ section: 'flowengine', type: 'error', text: errText });
      }
    } catch {
      setFeConnectionStatus('failed');
      setMessage({ section: 'flowengine', type: 'error', text: 'Could not reach the server' });
    } finally {
      setTestingConnection(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const updateField = (field: keyof PlatformConfig, value: string | boolean) => {
    if (field === 'flowengine_api_key') setFeConnectionStatus(null);
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSecret = (field: keyof PlatformConfig) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const isConfigured = (fields: (keyof PlatformConfig)[]): boolean => {
    return fields.some((field) => {
      const val = serverConfig[field];
      if (typeof val === 'boolean') return val;
      return val && val !== '';
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-800/30 rounded w-1/3" />
              <div className="h-10 bg-gray-800/30 rounded" />
              <div className="h-10 bg-gray-800/30 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const renderMessage = (section: SectionKey) => {
    if (!message || message.section !== section) return null;
    return (
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
    );
  };

  const clearField = async (field: keyof PlatformConfig, section: SectionKey) => {
    if (!session) return;
    updateField(field, '');
    // Immediately write null to DB — don't require a separate Save click
    try {
      const res = await fetch('/api/settings/portal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ [field]: null }),
      });
      if (!res.ok) throw new Error('Failed to clear key');
      // Update server state so status dot reflects removal
      setServerConfig((prev) => ({ ...prev, [field]: '' }));
      if (section === 'flowengine') {
        setFeConnectionStatus(null);
        try {
          sessionStorage.removeItem('portal-hosting-instances-v3');
          window.dispatchEvent(new CustomEvent('flowengine-key-updated', { detail: { removed: true } }));
        } catch {}
      }
      setMessage({ section, type: 'success', text: 'Key removed' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      updateField(field, '********'); // revert UI on failure
      setMessage({ section, type: 'error', text: 'Failed to remove key' });
    }
  };

  const renderTextField = (
    field: keyof PlatformConfig,
    label: string,
    placeholder: string,
    isSecret = false,
    onClear?: () => void
  ) => {
    const value = config[field] as string;
    const isVisible = visibleSecrets.has(field);
    const hasValue = !!(value && value !== '');
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm text-white/60">{label}</label>
          {isSecret && hasValue && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="relative">
          <input
            type={isSecret && !isVisible ? 'password' : 'text'}
            value={value}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white pr-12"
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => toggleSecret(field)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {isVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSaveButton = (section: SectionKey) => {
    const isSaving = savingSection === section;
    return (
      <button
        onClick={() => handleSave(section)}
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
    );
  };


  return (
    <div className="space-y-8">
      {/* FlowEngine API */}
      <section id="flowengine" className="scroll-mt-24">
        <h2 className="text-xl font-semibold text-white mb-4">FlowEngine API</h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-white">Connection</h3>
          </div>
          <p className="text-sm text-white/60 mb-4">
            FlowEngine API configuration for managed hosting and platform services.
          </p>
          {/* Status row — always visible */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isConfigured(['flowengine_api_key']) ? (
                  <>
                    <div className={`w-3 h-3 rounded-full ${feConnectionStatus === 'connected' ? 'bg-green-500' : feConnectionStatus === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <span className="text-white font-medium">{feConnectionStatus === 'connected' ? 'Connected' : feConnectionStatus === 'failed' ? 'Invalid key' : 'Key saved'}</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span className="text-white/60">Not connected</span>
                  </>
                )}
              </div>
              {isConfigured(['flowengine_api_key']) && (
                <button
                  onClick={() => clearField('flowengine_api_key', 'flowengine')}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
          {/* Key input — only shown when not connected */}
          {!isConfigured(['flowengine_api_key']) && (
            <div className="space-y-4">
              {renderTextField('flowengine_api_key', 'API Key', 'fe_...')}
              {renderMessage('flowengine')}
              <div className="flex justify-end gap-3">
                <button
                  onClick={testFlowEngineConnection}
                  disabled={testingConnection || savingSection === 'flowengine'}
                  className="px-4 py-3 border border-gray-700 hover:bg-gray-800 text-white/60 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {testingConnection ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Testing...</>
                  ) : (
                    <><Zap className="h-4 w-4" />Test Connection</>
                  )}
                </button>
                {renderSaveButton('flowengine')}
              </div>
            </div>
          )}
          {isConfigured(['flowengine_api_key']) && renderMessage('flowengine')}
        </div>
      </section>

      {/* AI Provider */}
      <section id="ai" className="scroll-mt-24">
        <h2 className="text-xl font-semibold text-white mb-4">AI Provider</h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-white">Connection</h3>
          </div>
          <p className="text-sm text-white/60 mb-4">
            Connect your AI provider to power AI features. Use{' '}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-2 hover:text-white/80">
              OpenRouter
            </a>{' '}
            — create a free account, get an API key, and paste it below. Any OpenAI-compatible API also works.
          </p>
          {/* Status row */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isConfigured(SECTION_FIELDS.ai) ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-white font-medium">Key saved</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span className="text-white/60">Not connected</span>
                  </>
                )}
              </div>
              {isConfigured(SECTION_FIELDS.ai) && (
                <button
                  onClick={() => clearField('ai_api_key', 'ai')}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
          {/* Fields — always shown for AI (base URL + key can be updated) */}
          <div className="space-y-4">
            {renderTextField('ai_base_url', 'Base URL', 'https://openrouter.ai/api')}
            {renderTextField('ai_api_key', 'API Key', 'sk-or-v1-...')}
            {renderMessage('ai')}
            <div className="flex justify-end">{renderSaveButton('ai')}</div>
          </div>
        </div>
      </section>

      {/* Stripe */}
      <section id="stripe" className="scroll-mt-24">
        <h2 className="text-xl font-semibold text-white mb-4">Stripe</h2>
        <StripeIntegration />
      </section>

      {/* Email SMTP */}
      <section id="smtp" className="scroll-mt-24">
        <h2 className="text-xl font-semibold text-white mb-4">Email SMTP</h2>
        <SmtpIntegration />
      </section>
    </div>
  );
}
