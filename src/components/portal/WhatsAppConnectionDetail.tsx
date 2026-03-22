'use client';

/**
 * WhatsAppConnectionDetail — Self-contained single-connection management UI.
 * Used in /portal/services/[id] to show a single WhatsApp connection detail
 * inside the portal three-column layout.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  Users,
  Hash,
  Loader2,
  Wifi,
  WifiOff,
  Send,
  X,
  AlertTriangle,
  ChevronDown,
  Eye,
  EyeOff,
  Link2Off,
  Code,
} from 'lucide-react';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: string;
  billing_cycle: string;
  server_url: string | null;
  linked_instance_id: string | null;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

type Stats = { contacts: number; chats: number; messages: number };

interface PortalInstance {
  id: string;
  instance_name: string;
  status: string;
  instance_url: string | null;
}

// ─── FlowEngine WhatsApp Detail ─────────────────────────────────────────────

interface FESession {
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  n8n_instance_id: string | null;
}

function FlowEngineWhatsAppDetail({ instanceName }: { instanceName: string }) {
  const [session, setSession] = useState<FESession | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhookInput, setWebhookInput] = useState('');
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getToken = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    return s?.access_token ?? null;
  };

  const fetchSession = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/flowengine/whatsapp/${encodeURIComponent(instanceName)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [instanceName]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  // Poll every 10s while waiting to connect or when QR is showing
  useEffect(() => {
    if (!session) return;
    const needsPoll = session.status === 'connecting' || session.status === 'disconnected' || !!session.qr_code;
    if (!needsPoll) return;
    const id = setInterval(fetchSession, 10000);
    return () => clearInterval(id);
  }, [session?.status, session?.qr_code, fetchSession]);

  const handleSetWebhook = async () => {
    const token = await getToken();
    if (!token) return;
    setSavingWebhook(true);
    setWebhookError(null);
    try {
      const res = await fetch(`/api/flowengine/whatsapp/${encodeURIComponent(instanceName)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookInput.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setWebhookError(d.error || d.message || 'Failed to save webhook');
        return;
      }
      setWebhookModalOpen(false);
    } catch {
      setWebhookError('Network error — please try again');
    } finally {
      setSavingWebhook(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const feStatusBadge = (s: string) => {
    const map: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
      connected: { icon: <Wifi className="h-3 w-3" />, label: 'Connected', cls: 'text-green-400 bg-green-900/20 border-green-800' },
      connecting: { icon: <RefreshCw className="h-3 w-3 animate-spin" />, label: 'Scan QR', cls: 'text-gray-400 bg-gray-800/30 border-gray-700' },
      disconnected: { icon: <WifiOff className="h-3 w-3" />, label: 'Disconnected', cls: 'text-red-400 bg-red-900/20 border-red-800' },
      error: { icon: <AlertTriangle className="h-3 w-3" />, label: 'Error', cls: 'text-orange-400 bg-orange-900/20 border-orange-800' },
    };
    const badge = map[s] ?? map['error'];
    return (
      <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${badge.cls}`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4 w-full">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gray-800/30 rounded-full animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-36 bg-gray-800/30 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-800/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          <div className="h-24 bg-gray-800/30 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">Could not load session</p>
        </div>
      </div>
    );
  }

  const isConnected = session.status === 'connected';
  const needsScan = session.status === 'connecting' || session.status === 'disconnected';

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-900/20 border border-green-800 rounded-lg">
              <WhatsAppIcon className="h-5 w-5 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">{session.display_name || instanceName}</p>
              {session.phone_number && <p className="text-white/40 text-sm">+{session.phone_number}</p>}
            </div>
            {feStatusBadge(session.status)}
            <button onClick={fetchSession} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200" title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* QR Code — show whenever qr_code is available, or when connecting without one yet */}
        {(session.qr_code || needsScan) && !isConnected && (
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 flex flex-col items-center">
            {session.qr_code ? (
              <>
                <img
                  src={session.qr_code.startsWith('data:') ? session.qr_code : `data:image/png;base64,${session.qr_code}`}
                  alt="WhatsApp QR Code"
                  className="w-48 h-48 rounded-lg bg-white p-2 mb-3"
                />
                <p className="text-white/60 text-sm text-center mb-3">
                  Open WhatsApp → Settings → Linked Devices → Link a Device
                </p>
                <button onClick={fetchSession} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Refresh QR
                </button>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 text-white/40 animate-spin mb-3" />
                <p className="text-white/60 text-sm">Waiting for QR code…</p>
                <button onClick={fetchSession} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mt-2">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </>
            )}
          </div>
        )}

        {/* Connection info */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wide">Connection Info</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40 w-28 flex-shrink-0">Instance Name</span>
              <span className="text-xs text-white/70 font-mono truncate flex-1">{instanceName}</span>
              <button onClick={() => copyText(instanceName, 'name')} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 flex-shrink-0">
                {copiedId === 'name' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            {isConnected && session.phone_number && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40 w-28 flex-shrink-0">Phone</span>
                <span className="text-xs text-white/70 font-mono flex-1">+{session.phone_number}</span>
                <button onClick={() => copyText(session.phone_number!, 'phone')} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 flex-shrink-0">
                  {copiedId === 'phone' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Webhook */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/40 mb-1">Incoming message webhook</p>
              <p className="text-white/30 text-sm italic">Receive messages at a URL</p>
            </div>
            <button
              onClick={() => { setWebhookModalOpen(true); setWebhookInput(''); setWebhookError(null); }}
              className="ml-4 px-3 py-1.5 text-xs border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex-shrink-0"
            >
              Set
            </button>
          </div>
        </div>

        {/* Webhook Modal */}
        {webhookModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Webhook URL</h3>
                <button onClick={() => setWebhookModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  type="url"
                  value={webhookInput}
                  onChange={e => setWebhookInput(e.target.value)}
                  placeholder="https://your-webhook.com/path"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
                />
                <p className="text-white/30 text-xs">Incoming messages will be forwarded here. Leave empty to clear.</p>
                {webhookError && <p className="text-red-400 text-sm">{webhookError}</p>}
                <button
                  onClick={handleSetWebhook}
                  disabled={savingWebhook}
                  className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
                >
                  {savingWebhook ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Local (Supabase-backed) WhatsApp Detail ────────────────────────────────

function LocalWhatsAppDetail({ connectionId }: { connectionId: string }) {
  const { user } = useAuth();

  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Per-instance state
  const [qr, setQr] = useState<string | null | undefined>(undefined);
  const [qrLoading, setQrLoading] = useState(false);
  const [instStats, setInstStats] = useState<Stats | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(false);
  const [showApiCode, setShowApiCode] = useState(false);

  // Webhook modal
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookInput, setWebhookInput] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);

  // Test message modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testError, setTestError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Link portal modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [portalInstances, setPortalInstances] = useState<PortalInstance[]>([]);
  const [loadingPortals, setLoadingPortals] = useState(false);
  const [linkingPortal, setLinkingPortal] = useState(false);

  // Derived status booleans
  const status = instance?.status || '';
  const isConnected = status === 'connected';
  const isPendingScan = status === 'pending_scan';
  const isConnecting = status === 'connecting';
  const isDisconnected = status === 'disconnected';
  const hasSession = !!instance?.server_url;

  const getHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : null;
  }, []);

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  }, []);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fetch single instance from DB
  const fetchInstance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single();
    if (data) {
      setInstance(data as WhatsAppInstance);
    }
    setLoading(false);
  }, [connectionId, user]);

  // Fetch live state from Evolution API
  const fetchLiveState = useCallback(async (instanceName: string) => {
    const headers = await getHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`/api/whatsapp/${instanceName}`, { headers });
      const data = await res.json();
      const state = data.liveState?.instance?.state;
      if (state === 'open') {
        setInstance(prev => prev ? { ...prev, status: 'connected', phone_number: data.instance?.phoneNumber || prev.phone_number } : prev);
        if (data.stats) setInstStats(data.stats);
      } else if (state === 'close') {
        setInstance(prev => {
          if (!prev) return prev;
          if (prev.status === 'connected') return { ...prev, status: 'disconnected', phone_number: null };
          return prev;
        });
      }
    } catch {
      // Silent
    }
  }, [getHeaders]);

  const fetchQR = useCallback(async (instanceName: string) => {
    setQrLoading(true);
    const headers = await getHeaders();
    if (!headers) { setQrLoading(false); return; }
    try {
      const res = await fetch(`/api/whatsapp/${instanceName}/qr`, { headers });
      const data = await res.json();
      if (data.base64) setQr(data.base64);
      else setQr(null);
    } catch {
      setQr(null);
    } finally {
      setQrLoading(false);
    }
  }, [getHeaders]);

  const fetchStats = useCallback(async (instanceName: string) => {
    const headers = await getHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`/api/whatsapp/${instanceName}/stats`, { headers });
      const data = await res.json();
      if (data.contacts !== undefined) setInstStats(data);
    } catch {
      // Silent
    }
  }, [getHeaders]);

  const fetchApiKey = useCallback(async (instanceName: string) => {
    if (fetchedKey) return;
    const headers = await getHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`/api/whatsapp/${instanceName}`, { headers });
      const data = await res.json();
      if (data.apiKey) setFetchedKey(data.apiKey);
    } catch {
      // Silent
    }
  }, [getHeaders, fetchedKey]);

  const callAction = useCallback(async (
    instanceName: string,
    action: string,
    params?: Record<string, unknown>,
    options?: { silent?: boolean }
  ) => {
    const headers = await getHeaders();
    if (!headers) throw new Error('Not authenticated');
    setActionLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`/api/whatsapp/${instanceName}/actions`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        let msg = data.error || `${action} failed`;
        try {
          const parsed = typeof msg === 'string' ? JSON.parse(msg) : msg;
          const inner = parsed?.response?.message ?? parsed?.message ?? msg;
          msg = Array.isArray(inner) ? inner.join(', ') : (typeof inner === 'object' ? JSON.stringify(inner) : String(inner));
        } catch { /* not JSON */ }
        throw new Error(msg);
      }
      return data;
    } catch (err: any) {
      const msg = err.name === 'AbortError' ? 'Request timed out' : (err.message || `Failed to ${action}`);
      if (!options?.silent) showError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  }, [getHeaders, showError]);

  const handleDisconnect = async () => {
    if (!instance) return;
    try {
      await callAction(instance.instance_name, 'logout');
      setInstance(prev => prev ? { ...prev, status: 'disconnected', phone_number: null } : prev);
      setInstStats(null);
    } catch { /* shown by callAction */ }
  };

  const handleReconnect = async () => {
    if (!instance) return;
    try {
      await callAction(instance.instance_name, 'reconnect');
      setInstance(prev => prev ? { ...prev, status: 'pending_scan' } : prev);
      setQr(undefined);
      setTimeout(() => fetchQR(instance.instance_name), 1500);
    } catch { /* shown by callAction */ }
  };

  const handleSendTest = async () => {
    if (!instance || !testTo.trim()) return;
    setTestError(null);
    setSendingTest(true);
    try {
      await callAction(instance.instance_name, 'sendText', { to: testTo, text: testMessage || 'Hello!' }, { silent: true });
      setTestSent(true);
      setTimeout(() => { setTestModalOpen(false); setTestSent(false); setTestTo(''); setTestMessage(''); }, 1500);
    } catch (err: any) {
      setTestError(err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!instance) return;
    setSavingWebhook(true);
    const headers = await getHeaders();
    if (!headers) { setSavingWebhook(false); return; }
    try {
      if (webhookInput.trim()) {
        await fetch(`/api/whatsapp/${instance.instance_name}/webhook-url`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl: webhookInput.trim() }),
        });
      } else {
        await fetch(`/api/whatsapp/${instance.instance_name}/webhook-url`, {
          method: 'DELETE',
          headers,
        });
      }
      setInstance(prev => prev ? { ...prev, webhook_url: webhookInput.trim() || null } : prev);
      setWebhookModalOpen(false);
    } catch {
      showError('Failed to update webhook');
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleUnlink = async () => {
    if (!instance) return;
    const headers = await getHeaders();
    if (!headers) return;
    try {
      await fetch('/api/whatsapp/link', {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappInstanceId: instance.id }),
      });
      setInstance(prev => prev ? { ...prev, linked_instance_id: null } : prev);
    } catch {
      showError('Failed to unlink');
    }
  };

  const openLinkModal = async () => {
    setLinkModalOpen(true);
    if (portalInstances.length > 0) return;
    setLoadingPortals(true);
    const headers = await getHeaders();
    if (!headers) { setLoadingPortals(false); return; }
    try {
      const res = await fetch('/api/whatsapp/portal-instances', { headers });
      const data = await res.json();
      setPortalInstances(data.instances || []);
    } catch { /* Silent */ } finally {
      setLoadingPortals(false);
    }
  };

  const handleLink = async (portalInstanceId: string) => {
    if (!instance) return;
    setLinkingPortal(true);
    const headers = await getHeaders();
    if (!headers) { setLinkingPortal(false); return; }
    try {
      const res = await fetch('/api/whatsapp/link', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappInstanceId: instance.id, portalInstanceId }),
      });
      if (!res.ok) throw new Error('Failed to link');
      setInstance(prev => prev ? { ...prev, linked_instance_id: portalInstanceId } : prev);
      setLinkModalOpen(false);
    } catch {
      showError('Failed to link instance');
    } finally {
      setLinkingPortal(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  // Verify live state after instance is loaded
  useEffect(() => {
    if (!instance || instance.status === 'pending_payment') return;
    setIsChecking(true);
    fetchLiveState(instance.instance_name).then(() => {
      setIsChecking(false);
      if (instance.status === 'pending_scan') {
        fetchQR(instance.instance_name);
      } else if (instance.status === 'connected') {
        fetchStats(instance.instance_name);
      }
    });
  }, [instance?.instance_name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling for pending/connecting
  const fetchLiveStateRef = useRef(fetchLiveState);
  fetchLiveStateRef.current = fetchLiveState;
  const fetchQRRef = useRef(fetchQR);
  fetchQRRef.current = fetchQR;

  useEffect(() => {
    if (!instance || (instance.status !== 'pending_scan' && instance.status !== 'connecting')) return;
    const id = setInterval(() => fetchLiveStateRef.current(instance.instance_name), 15000);
    return () => clearInterval(id);
  }, [instance?.status, instance?.instance_name]);

  useEffect(() => {
    if (!instance || instance.status !== 'pending_scan') return;
    const id = setInterval(() => fetchQRRef.current(instance.instance_name), 45000);
    return () => clearInterval(id);
  }, [instance?.status, instance?.instance_name]);

  const statusBadge = (s: string) => {
    const map: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
      connected: { icon: <Wifi className="h-3 w-3" />, label: 'Connected', cls: 'text-green-400 bg-green-900/20 border-green-800' },
      pending_scan: { icon: <RefreshCw className="h-3 w-3" />, label: 'Scan QR', cls: 'text-gray-400 bg-gray-800/30 border-gray-700' },
      connecting: { icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'Connecting', cls: 'text-gray-400 bg-gray-900/50 border-gray-800' },
      disconnected: { icon: <WifiOff className="h-3 w-3" />, label: 'Disconnected', cls: 'text-red-400 bg-red-900/20 border-red-800' },
    };
    const badge = map[s] || { icon: <AlertTriangle className="h-3 w-3" />, label: s, cls: 'text-gray-400 bg-gray-800 border-gray-700' };
    return (
      <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${badge.cls}`}>
        {badge.icon} {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4 w-full">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gray-800/30 rounded-full animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-36 bg-gray-800/30 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-800/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
          <div className="h-5 w-32 bg-gray-800/30 rounded animate-pulse" />
          <div className="h-24 bg-gray-800/30 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">Connection not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
      {/* Error banner */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-900/20 border border-green-800 rounded-lg">
            <WhatsAppIcon className="h-5 w-5 text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium">{instance.display_name || instance.instance_name}</p>
            {instance.phone_number && <p className="text-white/40 text-sm">+{instance.phone_number}</p>}
          </div>
          {isChecking ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-800/30 border border-gray-700 px-2 py-1 rounded-full">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking…
            </span>
          ) : statusBadge(instance.status)}
        </div>
      </div>

      {/* Status verification skeleton */}
      {isChecking && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="h-2 w-20 bg-gray-700/50 rounded-full animate-pulse" />
          <div className="h-2 w-12 bg-gray-700/50 rounded-full animate-pulse" />
        </div>
      )}

      {/* QR scan */}
      {isPendingScan && !isChecking && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 flex flex-col items-center">
          {(qrLoading || qr === undefined) ? (
            <div className="w-48 h-48 rounded-lg bg-gray-700/50 animate-pulse" />
          ) : qr ? (
            <>
              <img
                src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                alt="WhatsApp QR Code"
                className="w-48 h-48 rounded-lg bg-white p-2 mb-3"
              />
              <p className="text-white/60 text-sm text-center mb-3">
                Open WhatsApp &rarr; Settings &rarr; Linked Devices &rarr; Link a Device
              </p>
              <button
                onClick={() => { setQr(undefined); fetchQR(instance.instance_name); }}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Regenerate QR
              </button>
            </>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 text-white/50 mb-3" />
              <p className="text-white/60 text-sm mb-3">Could not load QR code</p>
              <button
                onClick={handleReconnect}
                disabled={actionLoading}
                className="px-4 py-2 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reinitialize Session'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Connecting */}
      {isConnecting && !isChecking && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
          <p className="text-white/60 text-sm">Connecting to WhatsApp...</p>
        </div>
      )}

      {/* Stats */}
      {isConnected && (
        <div className="grid grid-cols-3 gap-3">
          {instStats ? (
            [
              { icon: Users, value: instStats.contacts, label: 'Contacts' },
              { icon: MessageSquare, value: instStats.chats, label: 'Chats' },
              { icon: Hash, value: instStats.messages, label: 'Messages' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 text-center">
                <Icon className="h-4 w-4 text-white/40 mx-auto mb-1" />
                <div className="text-lg font-semibold text-white">{value.toLocaleString()}</div>
                <div className="text-xs text-white/40">{label}</div>
              </div>
            ))
          ) : (
            ['Contacts', 'Chats', 'Messages'].map((label) => (
              <div key={label} className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 text-center">
                <div className="h-4 w-4 bg-gray-700 rounded mx-auto mb-1 animate-pulse" />
                <div className="h-6 w-10 bg-gray-700 rounded mx-auto mb-1 animate-pulse" />
                <div className="text-xs text-white/40">{label}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* API credentials */}
      {hasSession && isConnected && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wide">API Credentials</p>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Base URL', value: instance.server_url!, id: `url-${instance.id}` },
              { label: 'Number ID', value: instance.instance_name, id: `name-${instance.id}` },
            ].map(({ label, value, id }) => (
              <div key={id} className="flex items-center gap-2">
                <span className="text-xs text-white/40 w-16 flex-shrink-0">{label}</span>
                <span className="text-xs text-white/70 font-mono truncate flex-1">{value}</span>
                <button onClick={() => copyText(value, id)} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 flex-shrink-0">
                  {copiedId === id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40 w-16 flex-shrink-0">API Key</span>
              <span className="text-xs text-white/70 font-mono flex-1 truncate">
                {revealKey && fetchedKey ? fetchedKey : '••••••••••••••••'}
              </span>
              <button
                onClick={() => {
                  if (!revealKey && !fetchedKey) fetchApiKey(instance.instance_name);
                  setRevealKey(!revealKey);
                }}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 flex-shrink-0"
              >
                {revealKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={async () => {
                  if (!fetchedKey) await fetchApiKey(instance.instance_name);
                  if (fetchedKey) copyText(fetchedKey, `key-${instance.id}`);
                }}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 flex-shrink-0"
              >
                {copiedId === `key-${instance.id}` ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Quick Start */}
      {hasSession && isConnected && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => {
              setShowApiCode(!showApiCode);
              if (!fetchedKey) fetchApiKey(instance.instance_name);
            }}
            className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5 text-white/40" />
              <span className="text-xs text-white/40 font-medium uppercase tracking-wide">API Quick Start</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-white/40 transition-transform ${showApiCode ? 'rotate-180' : ''}`} />
          </button>
          {showApiCode && (
            <div className="px-4 pb-4 space-y-3">
              <div className="relative group">
                <pre className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-xs font-mono text-white/80 overflow-x-auto whitespace-pre">{`curl -X POST ${instance.server_url}/message/sendText/${instance.instance_name} \\
  -H "apikey: ${fetchedKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "number": "1234567890",
    "text": "Hello!"
  }'`}</pre>
                <button
                  onClick={() => {
                    const code = `curl -X POST ${instance.server_url}/message/sendText/${instance.instance_name} \\\n  -H "apikey: ${fetchedKey || 'YOUR_API_KEY'}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "number": "1234567890",\n    "text": "Hello!"\n  }'`;
                    copyText(code, `code-${instance.id}`);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedId === `code-${instance.id}` ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-white/30 text-xs">
                Replace the phone number and message. See <a href="/whatsapp/docs" target="_blank" rel="noopener noreferrer" className="text-white/50 underline underline-offset-2">full API docs</a> for all endpoints.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Webhook */}
      {hasSession && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/40 mb-1">Incoming message webhook</p>
              {instance.webhook_url ? (
                <p className="text-white/80 text-sm font-mono truncate">{instance.webhook_url}</p>
              ) : (
                <p className="text-white/30 text-sm italic">Not set - messages won&apos;t be forwarded</p>
              )}
            </div>
            <button
              onClick={() => { setWebhookModalOpen(true); setWebhookInput(instance.webhook_url || ''); }}
              className="ml-4 px-3 py-1.5 text-xs border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex-shrink-0"
            >
              {instance.webhook_url ? 'Edit' : 'Set'}
            </button>
          </div>
        </div>
      )}

      {/* Linked n8n instance */}
      {hasSession && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/40 mb-1">Linked n8n instance</p>
              {instance.linked_instance_id ? (
                <p className="text-white/80 text-sm truncate">
                  {portalInstances.find(p => p.id === instance.linked_instance_id)?.instance_name || instance.linked_instance_id}
                </p>
              ) : (
                <p className="text-white/30 text-sm italic">Not linked - assign to a client portal</p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {instance.linked_instance_id && (
                <button
                  onClick={handleUnlink}
                  className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                  title="Unlink"
                >
                  <Link2Off className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={openLinkModal}
                className="px-3 py-1.5 text-xs border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              >
                {instance.linked_instance_id ? 'Change' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {hasSession && (
        <div className="flex flex-wrap gap-2">
          {isDisconnected && (
            <button
              onClick={handleReconnect}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reconnect
            </button>
          )}
          {isConnected && (
            <button
              onClick={() => setTestModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium border border-gray-700 transition-colors"
            >
              <Send className="h-4 w-4" /> Send Test
            </button>
          )}
          {(isConnected || isPendingScan || isConnecting) && (
            <button
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium border border-gray-700 transition-colors ml-auto"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
              Disconnect
            </button>
          )}
        </div>
      )}

      {/* ── Test Message Modal ── */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Send Test Message</h3>
              <button onClick={() => { setTestModalOpen(false); setTestError(null); setTestSent(false); }} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={testTo}
                onChange={e => setTestTo(e.target.value)}
                placeholder="Phone number (e.g., 1234567890)"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
              />
              <textarea
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                placeholder="Message (optional)"
                rows={3}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white resize-none"
              />
              {testError && <p className="text-red-400 text-sm">{testError}</p>}
              {testSent && <p className="text-green-400 text-sm flex items-center gap-1"><Check className="h-4 w-4" /> Sent!</p>}
              <button
                onClick={handleSendTest}
                disabled={sendingTest || !testTo.trim()}
                className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Webhook Modal ── */}
      {webhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Webhook URL</h3>
              <button onClick={() => setWebhookModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="url"
                value={webhookInput}
                onChange={e => setWebhookInput(e.target.value)}
                placeholder="https://your-webhook-url.com/webhook"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
              />
              <p className="text-white/30 text-xs">Incoming messages will be forwarded to this URL. Leave empty to remove.</p>
              <button
                onClick={handleSetWebhook}
                disabled={savingWebhook}
                className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                {savingWebhook ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Portal Modal ── */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Link n8n Instance</h3>
              <button onClick={() => setLinkModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            {loadingPortals ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
              </div>
            ) : portalInstances.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">No instances available</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {portalInstances.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleLink(p.id)}
                    disabled={linkingPortal}
                    className="w-full p-4 rounded-lg border transition-all text-left bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 disabled:opacity-50"
                  >
                    <p className="text-white text-sm font-medium">{p.instance_name}</p>
                    {p.instance_url && <p className="text-white/40 text-xs truncate">{p.instance_url}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ─── Router wrapper ──────────────────────────────────────────────────────────

export default function WhatsAppConnectionDetail({ connectionId }: { connectionId: string }) {
  if (connectionId.startsWith('fe_')) {
    return <FlowEngineWhatsAppDetail instanceName={connectionId.slice(3)} />;
  }
  return <LocalWhatsAppDetail connectionId={connectionId} />;
}
