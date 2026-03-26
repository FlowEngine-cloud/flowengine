'use client';

/**
 * OpenClaw Manage Content
 * Rendered inside the portal when an OpenClaw instance is selected.
 * Tabs: Manage (model+channels+gateway), Diagnostics.
 *
 * Instance lifecycle (start/stop/restart) is handled by Hosting, NOT here.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import {
  Loader2, Save, Server,
  Stethoscope, Copy, Check, Eye, EyeOff,
  ExternalLink, RefreshCw, ChevronDown,
  Brain, Radio, KeyRound, Activity,
} from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';

// Brand icons for channels
const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
  </svg>
);

const SlackIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

const AI_PROVIDER_URL = process.env.NEXT_PUBLIC_AI_PROVIDER_URL || process.env.NEXT_PUBLIC_AI_BASE_URL || 'https://openrouter.ai/api';

interface OpenClawInstanceData {
  id: string;
  instance_name: string;
  instance_url: string;
  status: string;
  openclaw_primary_model: string | null;
  openclaw_channel_tokens: string | null;
  gateway_token: string | null;
}

interface Props {
  instanceId: string;
  externalTab?: string;
  onTabChange?: (tab: string) => void;
  fallbackInstance?: { id: string; instance_name: string; instance_url?: string; status?: string };
}

export function OpenClawContent({ instanceId, externalTab, onTabChange, fallbackInstance }: Props) {
  const { session } = useAuth();
  const [instance, setInstance] = useState<OpenClawInstanceData | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);

  // Model state
  const [model, setModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [savingModel, setSavingModel] = useState(false);

  // Channel state
  const [telegramToken, setTelegramToken] = useState('');
  const [discordToken, setDiscordToken] = useState('');
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackAppToken, setSlackAppToken] = useState('');
  const [savingChannels, setSavingChannels] = useState(false);

  // Link copy states
  const [portalCopied, setPortalCopied] = useState(false);
  const [instanceCopied, setInstanceCopied] = useState(false);

  // Gateway token
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);

  // Doctor
  const [doctorOutput, setDoctorOutput] = useState<string | null>(null);
  const [runningDoctor, setRunningDoctor] = useState(false);

  // Map 'overview' (default from portal) to 'manage'
  const activeTab = (!externalTab || externalTab === 'overview') ? 'manage' : externalTab;

  const authHeader = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session]);

  // Fetch models from the configured AI provider via server-side authenticated route
  useEffect(() => {
    const loadModels = async () => {
      if (!session?.access_token) return;
      setModelsLoading(true);
      try {
        const res = await fetch('/api/client/models', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const ids = (data.data || [])
            .map((m: { id: string }) => m.id)
            .sort((a: string, b: string) => a.localeCompare(b));
          setAvailableModels(ids);
        }
      } catch {}
      setModelsLoading(false);
    };
    loadModels();
  }, [session?.access_token]);

  // Fetch instance data
  const fetchInstance = useCallback(async () => {
    if (!session?.access_token) {
      setLoadingInstance(false);
      return;
    }
    try {
      const res = await fetch(`/api/openclaw/${instanceId}/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setLoadingInstance(false);
        return;
      }
      const data = await res.json();
      setInstance(data.instance);
      setModel(data.instance?.openclaw_primary_model || '');
      if (data.instance?.openclaw_channel_tokens) {
        try {
          const tokens = JSON.parse(data.instance.openclaw_channel_tokens);
          setTelegramToken(tokens.telegram || '');
          setDiscordToken(tokens.discord || '');
          setSlackBotToken(tokens.slack_bot || '');
          setSlackAppToken(tokens.slack_app || '');
        } catch {}
      }
    } catch {}
    setLoadingInstance(false);
  }, [instanceId, session]);

  useEffect(() => {
    fetchInstance();
    const iv = setInterval(fetchInstance, 30000);
    return () => clearInterval(iv);
  }, [fetchInstance]);

  const showFeedback = (type: 'error' | 'success', msg: string) => {
    setFeedback({ type, msg });
    if (type === 'success') setTimeout(() => setFeedback(null), 5000);
  };

  const saveModel = async () => {
    if (!session?.access_token) return;
    setSavingModel(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/openclaw/${instanceId}/settings`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ primaryModel: model }),
      });
      const data = await res.json();
      if (!res.ok) showFeedback('error', data.error || 'Save failed');
      else showFeedback('success', data.message || 'Model updated. Instance restarting...');
    } catch {
      showFeedback('error', 'Something went wrong.');
    } finally {
      setSavingModel(false);
    }
  };

  const saveChannels = async () => {
    if (!session?.access_token) return;
    setSavingChannels(true);
    setFeedback(null);
    try {
      const tokens: Record<string, string> = {};
      if (telegramToken.trim()) tokens.telegram = telegramToken.trim();
      if (discordToken.trim()) tokens.discord = discordToken.trim();
      if (slackBotToken.trim()) tokens.slack_bot = slackBotToken.trim();
      if (slackAppToken.trim()) tokens.slack_app = slackAppToken.trim();
      const res = await fetch(`/api/openclaw/${instanceId}/settings`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ channelTokens: tokens }),
      });
      const data = await res.json();
      if (!res.ok) showFeedback('error', data.error || 'Save failed');
      else showFeedback('success', data.message || 'Channels saved. Instance restarting...');
    } catch {
      showFeedback('error', 'Something went wrong.');
    } finally {
      setSavingChannels(false);
    }
  };

  const runDoctor = async () => {
    if (!session?.access_token) return;
    setRunningDoctor(true);
    setDoctorOutput(null);
    try {
      const res = await fetch(`/api/openclaw/${instanceId}/doctor`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setDoctorOutput(data.output || data.error || 'No output');
    } catch {
      setDoctorOutput('Failed to run doctor.');
    } finally {
      setRunningDoctor(false);
    }
  };

  if (loadingInstance) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }

  if (!instance) {
    if (fallbackInstance) {
      return (
        <div className="flex flex-col items-center justify-center gap-6 p-8 min-h-[300px]">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/30 flex items-center justify-center">
            <Server className="w-8 h-8 text-gray-500" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg mb-1">{fallbackInstance.instance_name}</p>
            {fallbackInstance.instance_url && (
              <a
                href={fallbackInstance.instance_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 justify-center"
              >
                {fallbackInstance.instance_url.replace('https://', '')}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <Link
            href={`/portal/hosting/${fallbackInstance.id}`}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            Manage Instance
          </Link>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-white/60 text-sm">Instance not found.</p>
      </div>
    );
  }

  const isOnline = (instance.status === 'running' || instance.status === 'active');
  const channelCount = (() => {
    try {
      const tokens = instance.openclaw_channel_tokens ? JSON.parse(instance.openclaw_channel_tokens) : {};
      return Object.keys(tokens).filter(k => tokens[k]).length;
    } catch { return 0; }
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header — clickable URLs with copy buttons */}
      <div className="border-b border-gray-800 bg-black px-6 py-2.5 flex items-center justify-end gap-3">
        {/* Client Portal URL */}
        <div className="flex items-center bg-gray-900/50 border border-gray-800 hover:border-gray-700 rounded-lg transition-colors overflow-hidden">
          <a
            href={`/portal/${instance.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white font-mono truncate"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            {typeof window !== 'undefined' ? `${window.location.host}/portal/${instance.id}` : `/portal/${instance.id}`}
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/portal/${instance.id}`);
              setPortalCopied(true);
              setTimeout(() => setPortalCopied(false), 2000);
            }}
            className="px-2 py-2 border-l border-gray-800 hover:bg-gray-800/30 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
            title="Copy Portal URL"
          >
            {portalCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Instance URL */}
        {instance.instance_url && (
          <div className="flex items-center bg-gray-900/50 border border-gray-800 hover:border-gray-700 rounded-lg transition-colors overflow-hidden">
            <a
              href={instance.gateway_token ? `${instance.instance_url}#token=${instance.gateway_token}` : instance.instance_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white font-mono truncate"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              {instance.instance_url.replace('https://', '')}
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(instance.instance_url);
                setInstanceCopied(true);
                setTimeout(() => setInstanceCopied(false), 2000);
              }}
              className="px-2 py-2 border-l border-gray-800 hover:bg-gray-800/30 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
              title="Copy Instance URL"
            >
              {instanceCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
          {/* Feedback */}
          {feedback && (
            <div className={`p-3 rounded-lg text-sm ${feedback.type === 'error' ? 'bg-red-900/20 border border-red-800 text-red-400' : 'bg-green-900/20 border border-green-800 text-green-400'}`}>
              {feedback.msg}
            </div>
          )}

          {activeTab === 'manage' && (
            <>
              {/* Model Config */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-white/60" />
                  <h3 className="text-white text-sm font-semibold">Default Model</h3>
                </div>
                <p className="text-white/60 text-sm">
                  Select the AI model your OpenClaw instance will use. Changing this will restart your instance.
                </p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    {availableModels.length > 0 ? (
                      <SearchableSelect
                        value={model}
                        onChange={setModel}
                        options={availableModels.map(m => ({ value: m, label: m }))}
                        placeholder={modelsLoading ? 'Loading models...' : 'Select a model'}
                      />
                    ) : (
                      <input
                        type="text"
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        placeholder={modelsLoading ? 'Loading models...' : 'anthropic/claude-sonnet-4-20250514'}
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
                      />
                    )}
                  </div>
                  <button
                    onClick={saveModel}
                    disabled={savingModel || !model.trim()}
                    className="flex items-center gap-2 px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {savingModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </button>
                </div>
              </div>

              {/* Channels */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-white/60" />
                  <h3 className="text-white text-sm font-semibold">Channels</h3>
                  {channelCount > 0 && (
                    <span className="px-2 py-0.5 text-sm rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                      {channelCount} connected
                    </span>
                  )}
                </div>
                <p className="text-white/60 text-sm">
                  Connect Telegram, Discord, or Slack to your OpenClaw instance.
                </p>

                <div className="space-y-4">
                  {/* Telegram */}
                  <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TelegramIcon className="w-4 h-4 text-white/60" />
                      <span className="text-sm font-medium text-white">Telegram</span>
                    </div>
                    <div>
                      <label className="text-sm text-white/60 mb-1 block">Bot Token</label>
                      <input
                        type="password"
                        value={telegramToken}
                        onChange={e => setTelegramToken(e.target.value)}
                        placeholder="Paste bot token from @BotFather"
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
                      />
                    </div>
                  </div>

                  {/* Discord */}
                  <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DiscordIcon className="w-4 h-4 text-white/60" />
                      <span className="text-sm font-medium text-white">Discord</span>
                    </div>
                    <div>
                      <label className="text-sm text-white/60 mb-1 block">Bot Token</label>
                      <input
                        type="password"
                        value={discordToken}
                        onChange={e => setDiscordToken(e.target.value)}
                        placeholder="Paste token from Discord Developer Portal"
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
                      />
                    </div>
                  </div>

                  {/* Slack — grouped as one service */}
                  <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <SlackIcon className="w-4 h-4 text-white/60" />
                      <span className="text-sm font-medium text-white">Slack</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-white/60 mb-1 block">Bot Token</label>
                        <input
                          type="password"
                          value={slackBotToken}
                          onChange={e => setSlackBotToken(e.target.value)}
                          placeholder="xoxb-..."
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-white/60 mb-1 block">App Token</label>
                        <input
                          type="password"
                          value={slackAppToken}
                          onChange={e => setSlackAppToken(e.target.value)}
                          placeholder="xapp-..."
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={saveChannels}
                  disabled={savingChannels}
                  className="flex items-center gap-2 px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingChannels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Channels
                </button>
              </div>

              {/* Gateway Token */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-white/60" />
                  <h3 className="text-white text-sm font-semibold">Gateway Token</h3>
                </div>
                <p className="text-white/60 text-sm">
                  Use this token to authenticate external apps with your OpenClaw gateway.
                </p>
                {instance.gateway_token ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-gray-800/30 border border-gray-700 rounded-lg px-4 py-3">
                      <code className="flex-1 text-sm text-white font-mono truncate">
                        {tokenVisible ? instance.gateway_token : instance.gateway_token.replace(/./g, '\u2022').substring(0, 32) + '\u2022\u2022\u2022\u2022'}
                      </code>
                      <button
                        onClick={() => setTokenVisible(v => !v)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
                      >
                        {tokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(instance.gateway_token!);
                          setTokenCopied(true);
                          setTimeout(() => setTokenCopied(false), 2000);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
                      >
                        {tokenCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-sm text-white/30">
                      Set as <code className="text-white/60 font-mono text-sm">OPENCLAW_GATEWAY_TOKEN</code> in your client app.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-white/60">No gateway token generated yet. Redeploy from Hosting to generate one.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'diagnostics' && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-white/60" />
                <h3 className="text-white text-sm font-semibold">Diagnostics</h3>
              </div>
              <p className="text-white/60 text-sm">Run health checks on your OpenClaw instance.</p>
              <button
                onClick={runDoctor}
                disabled={runningDoctor || !isOnline}
                className="flex items-center gap-2 px-4 py-3 border border-gray-700 hover:bg-gray-800/30 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {runningDoctor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5" />}
                Run Doctor
              </button>
              {!isOnline && (
                <p className="text-sm text-white/30">Instance must be online to run diagnostics.</p>
              )}
              {doctorOutput && (
                <pre className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-sm text-green-400 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                  {doctorOutput}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Submenu items for the secondary panel */
export const OPENCLAW_TABS_LIST = [
  { id: 'manage', label: 'Overview', icon: Eye },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
] as const;
