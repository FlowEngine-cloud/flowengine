'use client';

/**
 * Client Detail Page - /portal/clients/[slug]
 * slug = client's user_id
 * Tabs (via ?tab=): properties (default), ai_tokens, team, payments
 */
import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useClientsContext } from '../context';
import { cn } from '@/lib/utils';
import {
  Server, Users, UsersRound, UserX, AlertTriangle,
  MessageSquare, Plus, Phone, ExternalLink,
  CreditCard, FileText, DollarSign, Send, Loader2,
  Settings, Wallet, TrendingUp, RefreshCw,
  Copy, Check, Trash2, Banknote, AlertCircle,
  ChevronRight, Coins, StickyNote, Edit3,
} from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';

// ─── Per-instance AI data ────────────────────────────────────────────────────

interface InstanceAiData {
  aiPayer: 'agency' | 'client';
  hasLinkedClient: boolean;
  isExternal: boolean;
  clientUserId?: string;
  clientEmail?: string;
}

// ─── Per-instance Payment data ────────────────────────────────────────────────

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  normalizedStatus?: string;
  description: string | null;
  created: number;
  receipt_url: string | null;
  invoice_url: string | null;
}

interface ManualPayment {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  description: string | null;
  payment_date: string;
  reference: string | null;
  created_at: string;
}

interface BillingSettings {
  monthly_expected_amount: number;
  currency: string;
  notes: string;
  stripe_customer_id?: string | null;
}

interface BillingResult {
  type: 'charge' | 'invoice' | 'subscription';
  invoiceUrl?: string;
  receiptUrl?: string;
  status: string;
  amount: number;
  subscriptionId?: string;
}

interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
}

interface PaymentData {
  stripeConnected: boolean;
  stripeKeyError?: boolean;
  isAgency: boolean;
  customerId: string | null;
  customer: { id: string; email: string | null; name: string | null } | null;
  transactions: Transaction[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: clientUserId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') || 'overview';

  const { session } = useAuth();
  const { grouped, loading, refetch, agencyInstances, agencyServices, liveStatus, statusLoading } = useClientsContext();

  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRemoveClient, setShowRemoveClient] = useState(false);
  const [removingClient, setRemovingClient] = useState(false);
  // AI tokens tab state - client-level budget + client-level payer
  const [clientBudget, setClientBudget] = useState<{ tokensRemaining: number; tokensUsed: number } | null>(null);
  const [feConnected, setFeConnected] = useState(false);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetLoaded, setBudgetLoaded] = useState(false);
  const [budgetRefreshing, setBudgetRefreshing] = useState(false);
  const [instanceAiData, setInstanceAiData] = useState<Record<string, InstanceAiData>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [topupAmount, setTopupAmount] = useState('10');
  const [topupLoading, setTopupLoading] = useState(false);
  const [clientPayer, setClientPayer] = useState<'agency' | 'client'>('agency');
  const [showPayerConfirm, setShowPayerConfirm] = useState(false);
  const [pendingPayer, setPendingPayer] = useState<'agency' | 'client' | null>(null);
  const [payerSwitching, setPayerSwitching] = useState(false);
  const [payerSuccess, setPayerSuccess] = useState<string | null>(null);

  // Payments tab state - unified per-client
  const [instancePayments, setInstancePayments] = useState<Record<string, PaymentData>>({});
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [stripeCustomers, setStripeCustomers] = useState<StripeCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [linkingCustomer, setLinkingCustomer] = useState(false);
  const [customersFetched, setCustomersFetched] = useState(false);

  // Billing action state
  const [billingAction, setBillingAction] = useState<'charge' | 'invoice' | 'subscription' | null>(null);
  const [billingAmount, setBillingAmount] = useState('');
  const [billingDescription, setBillingDescription] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const [billingResult, setBillingResult] = useState<BillingResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  // Recurring / subscription state
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'week' | 'month' | 'year'>('month');
  const [recurringIntervalCount, setRecurringIntervalCount] = useState('1');

  // Billing settings & manual payments
  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null);
  const [billingSettingsLoaded, setBillingSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [settingsAmount, setSettingsAmount] = useState('');
  const [settingsNotes, setSettingsNotes] = useState('');

  const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ amount: '', method: 'bank_transfer', description: '', date: '', reference: '' });
  const [manualLoading, setManualLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [txSource, setTxSource] = useState<'all' | 'stripe' | 'manual'>('all');

  // WhatsApp services
  const [linkedWhatsApp, setLinkedWhatsApp] = useState<
    { id: string; display_name: string | null; instance_name: string; phone_number: string | null; status: string; linked_instance_id: string | null }[]
  >([]);
  const [waLoading, setWaLoading] = useState(false);
  const [waLoaded, setWaLoaded] = useState(false);

  // Team members tab state
  const [teamMembers, setTeamMembers] = useState<{ id: string; email: string; role: string; status: string; invited_at: string; accepted_at: string | null }[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [teamInviteEmail, setTeamInviteEmail] = useState('');
  const [teamInviteRole, setTeamInviteRole] = useState('member');
  const [teamInviting, setTeamInviting] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);
  const [teamConfirmRemove, setTeamConfirmRemove] = useState<string | null>(null);

  // External instance linking
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [externalForm, setExternalForm] = useState({ serviceType: 'n8n' as 'n8n' | 'openclaw' | 'other', name: '', instanceUrl: '', apiKey: '', clientAccess: false });
  const [linkingExternal, setLinkingExternal] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  // Assign instance modal
  const [showAssignInstance, setShowAssignInstance] = useState(false);
  const [assignInstanceId, setAssignInstanceId] = useState('');
  const [assigningInstance, setAssigningInstance] = useState(false);

  // Link service state
  const [showLinkService, setShowLinkService] = useState(false);
  const [linkServiceId, setLinkServiceId] = useState('');
  const [linkServiceInstanceId, setLinkServiceInstanceId] = useState('');
  const [linkingService, setLinkingService] = useState(false);
  const [unlinkServiceConfirm, setUnlinkServiceConfirm] = useState<string | null>(null);
  const [unlinkingService, setUnlinkingService] = useState(false);

  // Client notes
  const [clientNotes, setClientNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  // Other (custom entries)
  interface CustomEntry { id: string; name: string; domain: string; access: string; notes: string; }
  const [customEntries, setCustomEntries] = useState<CustomEntry[]>([]);
  const [otherLoaded, setOtherLoaded] = useState(false);
  const [showOtherForm, setShowOtherForm] = useState(false);
  const [otherForm, setOtherForm] = useState({ name: '', domain: '', access: '', notes: '' });
  const [otherSaving, setOtherSaving] = useState(false);
  const [otherError, setOtherError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', domain: '', access: '', notes: '' });
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<string | null>(null);

  // Match by userId first, then fallback to email (for pending invites where userId = email)
  const client = grouped.find((g) => g.userId === clientUserId)
    || grouped.find((g) => g.email === clientUserId)
    || grouped.find((g) => g.email === decodeURIComponent(clientUserId));

  // Real instances (not invite-only placeholders, not deleted) - defined before callbacks that use it
  const realInstances = client?.instances.filter(i => !i.instance_id.startsWith('invite:') && i.status !== 'deleted') || [];
  const isPendingClient = client?.bestStatus === 'pending';

  // ─── Data fetching ──────────────────────────────────────────────────────────

  // Fetch client-level budget (independent of instances)
  const fetchClientBudget = useCallback(async (isRefresh = false) => {
    if (!session?.access_token || !clientUserId) return;
    if (!isRefresh && budgetLoaded) return;
    if (isRefresh) setBudgetRefreshing(true);
    else setBudgetLoading(true);
    try {
      const res = await fetch(`/api/client/budget?clientUserId=${clientUserId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClientBudget({
          tokensRemaining: data.budget.tokensRemaining,
          tokensUsed: data.budget.tokensUsed,
        });
        setFeConnected(data.feConnected ?? false);
      }
      if (!isRefresh) setBudgetLoaded(true);
    } catch { /* silent */ } finally {
      setBudgetLoading(false);
      setBudgetRefreshing(false);
    }
  }, [session?.access_token, clientUserId, budgetLoaded]);

  // Fetch per-instance AI payer data (only when instances exist)
  const fetchAiData = useCallback(async () => {
    if (!session?.access_token || !client || realInstances.length === 0 || aiLoaded) return;
    setAiLoading(true);
    try {
      const results = await Promise.all(
        realInstances.map(async (inst) => {
          const res = await fetch(`/api/client-panel/${inst.instance_id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (!res.ok) return null;
          const data = await res.json();
          return {
            id: inst.instance_id,
            data: {
              aiPayer: data.aiPayer || 'agency',
              hasLinkedClient: data.hasLinkedClient ?? true, // Client is linked if we're viewing their detail
              isExternal: data.instance?.is_external || false,
              // Always use the known client userId/email - API may not return it for all paths
              clientUserId: data.client?.user_id || clientUserId,
              clientEmail: data.client?.email || client.email,
            } as InstanceAiData,
          };
        })
      );
      const map: Record<string, InstanceAiData> = {};
      for (const r of results) {
        if (r) map[r.id] = r.data;
      }
      setInstanceAiData(map);
      // Derive client-level payer from instances (majority or first non-external)
      const payers = Object.values(map).filter(d => !d.isExternal).map(d => d.aiPayer);
      if (payers.length > 0) setClientPayer(payers[0]);
      setAiLoaded(true);
    } catch { /* silent */ } finally {
      setAiLoading(false);
    }
  }, [session?.access_token, client, clientUserId, realInstances.length, aiLoaded]);

  const fetchPayments = useCallback(async (force?: boolean) => {
    if (!session?.access_token || !client) return;
    if (realInstances.length === 0) return;
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const errors: string[] = [];
      const results = await Promise.all(
        realInstances.map(async (inst) => {
          try {
            const res = await fetch(`/api/client-panel/${inst.instance_id}/payment`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              errors.push(`${inst.instance_name || inst.instance_id}: ${errData.error || res.status}`);
              return null;
            }
            const data = await res.json();
            return { id: inst.instance_id, data: data as PaymentData };
          } catch (e) {
            errors.push(`${inst.instance_name || inst.instance_id}: fetch failed`);
            return null;
          }
        })
      );
      const map: Record<string, PaymentData> = {};
      for (const r of results) {
        if (r) map[r.id] = r.data;
      }
      if (Object.keys(map).length === 0 && errors.length > 0) {
        setPaymentsError(`Payment API errors: ${errors.join('; ')}`);
      }
      setInstancePayments(map);
      setPaymentsLoaded(true);

      // Set the initial selected customer from the first instance that has one
      for (const r of results) {
        if (r?.data?.customerId) {
          setSelectedCustomerId(r.data.customerId);
          break;
        }
      }
    } catch (err) {
      setPaymentsError(`Failed to load payments: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setPaymentsLoaded(false);
    } finally {
      setPaymentsLoading(false);
    }
  }, [session?.access_token, client, realInstances.length]);

  const fetchBillingSettings = useCallback(async () => {
    if (!session?.access_token || !clientUserId || billingSettingsLoaded) return;
    try {
      const res = await fetch(`/api/agency/billing/settings?clientUserId=${clientUserId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBillingSettings(data.settings);
        setManualPayments(data.manualPayments || []);
        if (data.settings?.monthly_expected_amount) {
          setSettingsAmount(String(data.settings.monthly_expected_amount / 100));
        }
        if (data.settings?.notes) {
          setSettingsNotes(data.settings.notes);
        }
      }
      setBillingSettingsLoaded(true);
    } catch { /* silent */ }
  }, [session?.access_token, clientUserId, billingSettingsLoaded]);

  const fetchWhatsApp = useCallback(async () => {
    if (!session?.access_token || !client || waLoaded) return;
    setWaLoading(true);
    try {
      const res = await fetch('/api/whatsapp/instances', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const instanceIds = new Set(realInstances.map(i => i.instance_id));
      const linked = (data.instances || []).filter(
        (w: { linked_instance_id: string | null }) => w.linked_instance_id && instanceIds.has(w.linked_instance_id)
      );
      setLinkedWhatsApp(linked);
      setWaLoaded(true);
    } catch { /* silent */ } finally {
      setWaLoading(false);
    }
  }, [session?.access_token, client, realInstances.length, waLoaded]);

  const fetchClientNotes = useCallback(async () => {
    if (!session?.access_token || !clientUserId || notesLoaded) return;
    try {
      const res = await fetch(`/api/agency/client-notes?clientUserId=${encodeURIComponent(clientUserId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClientNotes(data.notes || '');
        setNotesDraft(data.notes || '');
      }
      setNotesLoaded(true);
    } catch { /* silent */ }
  }, [session?.access_token, clientUserId, notesLoaded]);

  const saveClientNotes = async () => {
    if (!session?.access_token) return;
    setNotesSaving(true);
    try {
      await fetch('/api/agency/client-notes', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientUserId, notes: notesDraft }),
      });
      setClientNotes(notesDraft);
      setNotesEditing(false);
    } catch { /* silent */ } finally {
      setNotesSaving(false);
    }
  };

  const fetchCustomEntries = useCallback(async () => {
    if (!session?.access_token || !clientUserId || otherLoaded) return;
    try {
      const res = await fetch(`/api/agency/client-other?clientUserId=${encodeURIComponent(clientUserId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomEntries(data.entries || []);
      }
      setOtherLoaded(true);
    } catch { /* silent */ }
  }, [session?.access_token, clientUserId, otherLoaded]);

  const handleAddOtherEntry = async () => {
    if (!session?.access_token || !otherForm.name.trim()) return;
    setOtherSaving(true);
    setOtherError(null);
    try {
      const res = await fetch('/api/agency/client-other', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientUserId, ...otherForm }),
      });
      const data = await res.json();
      if (!res.ok) { setOtherError(data.error || 'Failed to save'); return; }
      setCustomEntries(prev => [...prev, data.entry]);
      setOtherForm({ name: '', domain: '', access: '', notes: '' });
      setShowOtherForm(false);
    } catch { setOtherError('Something went wrong'); } finally {
      setOtherSaving(false);
    }
  };

  const handleUpdateOtherEntry = async (id: string) => {
    if (!session?.access_token || !editForm.name.trim()) return;
    setOtherSaving(true);
    try {
      const res = await fetch('/api/agency/client-other', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setCustomEntries(prev => prev.map(e => e.id === id ? data.entry : e));
        setEditingEntry(null);
      }
    } catch { /* silent */ } finally {
      setOtherSaving(false);
    }
  };

  const handleDeleteOtherEntry = async (id: string) => {
    if (!session?.access_token) return;
    setDeletingEntry(id);
    try {
      await fetch(`/api/agency/client-other?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setCustomEntries(prev => prev.filter(e => e.id !== id));
      setConfirmDeleteEntry(null);
    } catch { /* silent */ } finally {
      setDeletingEntry(null);
    }
  };

  const [stripeError, setStripeError] = useState<string | null>(null);

  const fetchStripeCustomers = useCallback(async () => {
    if (!session?.access_token || customersFetched) return;
    setCustomersFetched(true);
    setCustomersLoading(true);
    setStripeError(null);
    try {
      const res = await fetch('/api/agency/customers', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStripeCustomers(data.customers || []);
      } else {
        setStripeError(data.error || 'Failed to load Stripe customers');
      }
    } catch {
      setStripeError('Failed to connect to Stripe');
    } finally {
      setCustomersLoading(false);
    }
  }, [session?.access_token]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleLinkCustomer = async () => {
    if (!session?.access_token || !selectedCustomerId || !client) return;
    setLinkingCustomer(true);
    setStripeError(null);
    try {
      // Link to all existing instances (if any)
      if (realInstances.length > 0) {
        await Promise.all(
          realInstances.map(async inst => {
            const res = await fetch(`/api/client-panel/${inst.instance_id}/payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ customerId: selectedCustomerId }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              console.error(`Link customer failed for ${inst.instance_id}:`, data.error);
            }
          })
        );
      }
      // Persist at client level via billing settings
      await fetch('/api/agency/billing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          clientUserId: client.userId,
          stripeCustomerId: selectedCustomerId,
          monthlyExpectedAmount: billingSettings?.monthly_expected_amount ?? 0,
          notes: billingSettings?.notes ?? '',
        }),
      });
      // Reload data
      if (realInstances.length > 0) {
        setPaymentsLoaded(false);
        await fetchPayments();
      }
      setBillingSettingsLoaded(false);
      fetchBillingSettings();
    } catch {
      setStripeError('Failed to link Stripe customer.');
    } finally {
      setLinkingCustomer(false);
    }
  };

  const handleUnlinkCustomer = async () => {
    if (!session?.access_token || !client) return;
    if (!confirm('Unlink this Stripe customer? Transaction history will no longer be visible.')) return;
    setLinkingCustomer(true);
    try {
      // Unlink from all instances
      if (realInstances.length > 0) {
        await Promise.all(
          realInstances.map(inst =>
            fetch(`/api/client-panel/${inst.instance_id}/payment`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
          )
        );
      }
      // Clear from billing settings
      await fetch('/api/agency/billing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          clientUserId: client.userId,
          stripeCustomerId: null,
          monthlyExpectedAmount: billingSettings?.monthly_expected_amount ?? 0,
          notes: billingSettings?.notes ?? '',
        }),
      });
      setSelectedCustomerId('');
      if (realInstances.length > 0) {
        setPaymentsLoaded(false);
        fetchPayments();
      }
      setBillingSettingsLoaded(false);
      fetchBillingSettings();
    } catch { /* silent */ } finally {
      setLinkingCustomer(false);
    }
  };

  const handleBillingAction = async () => {
    if (!session?.access_token || !billingAction || !selectedCustomerId) return;
    const amountNum = parseFloat(billingAmount);
    if (!amountNum || amountNum <= 0) {
      setBillingError('Please enter a valid amount.');
      return;
    }
    if (amountNum > 99999) {
      setBillingError('Amount exceeds maximum allowed.');
      return;
    }

    // If recurring is enabled on a charge/invoice, convert to subscription
    const effectiveAction = (billingAction !== 'subscription' && recurringEnabled) ? 'subscription' : billingAction;

    setBillingLoading(true);
    setBillingError(null);
    setBillingSuccess(null);
    setBillingResult(null);
    try {
      const amountCents = Math.round(amountNum * 100);
      const res = await fetch('/api/agency/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: effectiveAction,
          customerId: selectedCustomerId,
          amount: amountCents,
          currency: 'usd',
          description: billingDescription || undefined,
          ...(effectiveAction === 'subscription' ? {
            interval: recurringInterval,
            intervalCount: parseInt(recurringIntervalCount) || 1,
          } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBillingError(data.error || 'Failed to process billing action');
        return;
      }

      if (effectiveAction === 'charge') {
        setBillingResult({ type: 'charge', status: data.status, amount: amountCents, receiptUrl: data.receiptUrl });
      } else if (effectiveAction === 'invoice') {
        setBillingResult({ type: 'invoice', status: data.status || 'open', amount: amountCents, invoiceUrl: data.invoiceUrl });
      } else if (effectiveAction === 'subscription') {
        setBillingResult({ type: 'subscription', status: data.status, amount: amountCents, subscriptionId: data.subscriptionId });
      }

      setBillingAmount('');
      setBillingDescription('');
      setBillingAction(null);
      setRecurringEnabled(false);
      setRecurringInterval('month');
      setRecurringIntervalCount('1');

      // Refresh transactions
      setTimeout(() => {
        setPaymentsLoaded(false);
        fetchPayments();
      }, 2000);
    } catch {
      setBillingError('Something went wrong. Please try again.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSaveBillingSettings = async () => {
    if (!session?.access_token) return;
    setSavingSettings(true);
    try {
      const amountCents = Math.round(parseFloat(settingsAmount || '0') * 100);
      const res = await fetch('/api/agency/billing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          clientUserId,
          monthlyExpectedAmount: amountCents,
          notes: settingsNotes,
        }),
      });
      if (res.ok) {
        setBillingSettings(prev => ({ ...(prev || { currency: 'usd' }), monthly_expected_amount: amountCents, currency: 'usd', notes: settingsNotes }));
        setShowSettingsForm(false);
      }
    } catch { /* silent */ } finally {
      setSavingSettings(false);
    }
  };

  const handleAddManualPayment = async () => {
    if (!session?.access_token || !clientUserId) return;
    const amountNum = parseFloat(manualForm.amount);
    if (!amountNum || amountNum <= 0) return;
    if (!manualForm.date) return;

    setManualLoading(true);
    try {
      const res = await fetch('/api/agency/billing/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          clientUserId,
          amount: Math.round(amountNum * 100),
          paymentMethod: manualForm.method,
          description: manualForm.description || undefined,
          paymentDate: new Date(manualForm.date).toISOString(),
          reference: manualForm.reference || undefined,
        }),
      });
      if (res.ok) {
        setManualForm({ amount: '', method: 'bank_transfer', description: '', date: '', reference: '' });
        setShowManualForm(false);
        setBillingSettingsLoaded(false);
        fetchBillingSettings();
      }
    } catch { /* silent */ } finally {
      setManualLoading(false);
    }
  };

  const handleDeleteManualPayment = async (id: string) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`/api/agency/billing/settings?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setManualPayments(prev => prev.filter(p => p.id !== id));
      }
    } catch { /* silent */ }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleLinkExternal = async () => {
    if (!session?.access_token) return;
    const { serviceType, name, instanceUrl, apiKey } = externalForm;
    if (!name.trim()) { setExternalError('Name is required.'); return; }
    if (serviceType !== 'other' && !instanceUrl.trim()) { setExternalError('URL is required.'); return; }
    if (serviceType === 'n8n' && !apiKey.trim()) { setExternalError('API key is required for n8n.'); return; }
    setLinkingExternal(true);
    setExternalError(null);
    try {
      const res = await fetch('/api/instances/link-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: name.trim(),
          serviceType,
          instanceUrl: instanceUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          clientUserId,
          clientAccess: externalForm.clientAccess,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExternalError(data.error || 'Failed to link instance.');
        return;
      }
      setShowExternalForm(false);
      setExternalForm({ serviceType: 'n8n', name: '', instanceUrl: '', apiKey: '', clientAccess: false });
      refetch();
    } catch {
      setExternalError('Something went wrong. Please try again.');
    } finally {
      setLinkingExternal(false);
    }
  };

  const handleAssignInstance = async () => {
    if (!session?.access_token || !assignInstanceId || !client) return;
    if (isPendingClient) {
      setError('Client must accept their invite before instances can be assigned.');
      return;
    }
    setAssigningInstance(true);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instance_id: assignInstanceId, client_user_id: clientUserId }),
      });
      if (res.ok) {
        setShowAssignInstance(false);
        setAssignInstanceId('');
        refetch();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to assign instance');
      }
    } catch {
      setError('Failed to assign instance');
    } finally {
      setAssigningInstance(false);
    }
  };

  const handleLinkService = async () => {
    if (!session?.access_token || !linkServiceId || !linkServiceInstanceId) return;
    setLinkingService(true);
    try {
      const res = await fetch('/api/whatsapp/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ whatsappInstanceId: linkServiceId, portalInstanceId: linkServiceInstanceId }),
      });
      if (res.ok) {
        setShowLinkService(false);
        setLinkServiceId('');
        setLinkServiceInstanceId('');
        setWaLoaded(false);
        fetchWhatsApp();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to link service');
      }
    } catch {
      setError('Failed to link service');
    } finally {
      setLinkingService(false);
    }
  };

  const handleUnlinkService = async (whatsappInstanceId: string) => {
    if (!session?.access_token) return;
    setUnlinkingService(true);
    try {
      const res = await fetch('/api/whatsapp/link', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ whatsappInstanceId }),
      });
      if (res.ok) {
        setUnlinkServiceConfirm(null);
        setWaLoaded(false);
        fetchWhatsApp();
      }
    } catch { /* silent */ } finally {
      setUnlinkingService(false);
    }
  };

  const handleRevokeAccess = async (instanceId: string) => {
    if (!session?.access_token) return;
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch('/api/client/instances', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ instance_id: instanceId, user_id: clientUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to revoke access');
      } else {
        setRevokeConfirm(null);
        refetch();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setRevoking(false);
    }
  };

  const handleRemoveClient = async () => {
    if (!session?.access_token) return;
    setRemovingClient(true);
    setError(null);
    try {
      // Revoke all instance assignments for this client
      for (const inst of realInstances) {
        await fetch('/api/client/instances', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ instance_id: inst.instance_id, user_id: clientUserId }),
        });
      }
      // Cancel all pending invites for this client
      const inviteIds = client?.instances
        .filter(i => i.instance_id.startsWith('invite:'))
        .map(i => i.instance_id.replace('invite:', '')) || [];
      for (const invId of inviteIds) {
        await fetch(`/api/client/invite/${invId}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
      await refetch();
      router.push('/portal/clients');
    } catch {
      setError('Failed to remove client.');
    } finally {
      setRemovingClient(false);
      setShowRemoveClient(false);
    }
  };

  const handleTopup = async () => {
    if (!session?.access_token || !clientUserId) return;
    const amountNum = parseFloat(topupAmount);
    if (amountNum < 1 || amountNum > 1000) return;
    setTopupLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_TOPUP_PRICE_ID,
          planType: 'topup',
          customAmount: amountNum,
          tokenAmount: Math.floor(amountNum * 20000),
          targetUserId: clientUserId,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* silent */ } finally {
      setTopupLoading(false);
    }
  };

  // Client-level AI payer switch - applies to ALL non-external instances
  const handlePayerSwitch = (newPayer: 'agency' | 'client') => {
    if (newPayer === clientPayer) return;
    // Check if any instance can switch to client
    const nonExternal = Object.entries(instanceAiData).filter(([, d]) => !d.isExternal);
    if (newPayer === 'client' && nonExternal.some(([, d]) => !d.hasLinkedClient)) return;
    setPendingPayer(newPayer);
    setShowPayerConfirm(true);
  };

  const confirmPayerSwitch = async () => {
    if (!pendingPayer || !session?.access_token) return;
    const nonExternal = Object.entries(instanceAiData).filter(([, d]) => !d.isExternal);
    if (nonExternal.length === 0) return;
    setPayerSwitching(true);
    setError(null);
    try {
      const results = await Promise.all(
        nonExternal.map(async ([instId]) => {
          const res = await fetch('/api/n8n/update-ai-payer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ instanceId: instId, aiPayer: pendingPayer }),
          });
          return { instId, ok: res.ok };
        })
      );
      const allOk = results.every(r => r.ok);
      if (allOk) {
        setClientPayer(pendingPayer);
        setInstanceAiData(prev => {
          const updated = { ...prev };
          for (const [id, d] of Object.entries(updated)) {
            if (!d.isExternal) updated[id] = { ...d, aiPayer: pendingPayer };
          }
          return updated;
        });
        setPayerSuccess(`AI payer switched to ${pendingPayer === 'agency' ? 'you' : 'client'} for all instances.`);
        setTimeout(() => setPayerSuccess(null), 5000);
      } else {
        setError('Some instances failed to update. Please try again.');
      }
      setShowPayerConfirm(false);
    } catch {
      setError('Failed to switch AI payer. Please try again.');
    } finally {
      setPayerSwitching(false);
      setPendingPayer(null);
    }
  };

  // ─── Team members ──────────────────────────────────────────────────────────

  const fetchTeamMembers = useCallback(async () => {
    if (!session?.access_token || !clientUserId || teamLoaded) return;
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/client/team?clientId=${clientUserId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setTeamMembers(data.members || []);
    } catch { /* silent */ } finally {
      setTeamLoading(false);
      setTeamLoaded(true);
    }
  }, [session?.access_token, clientUserId, teamLoaded]);

  const handleTeamInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamInviteEmail.trim() || !session?.access_token) return;
    setTeamInviting(true);
    setTeamError(null);
    setTeamSuccess(null);
    try {
      const res = await fetch('/api/client/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clientId: clientUserId, email: teamInviteEmail.trim(), role: teamInviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTeamError(data.error || 'Failed to send invitation');
        return;
      }
      setTeamSuccess(`Invitation sent to ${teamInviteEmail.trim()}`);
      setTeamInviteEmail('');
      setTeamLoaded(false);
      fetchTeamMembers();
    } catch {
      setTeamError('Failed to send invitation');
    } finally {
      setTeamInviting(false);
    }
  };

  const handleTeamRemove = async (memberId: string) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`/api/client/team/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setTeamMembers(prev => prev.filter(m => m.id !== memberId));
        setTeamLoaded(false);
      }
    } catch { /* silent */ } finally {
      setTeamConfirmRemove(null);
    }
  };

  const handleTeamRoleChange = async (memberId: string, newRole: string) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`/api/client/team/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setTeamMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      }
    } catch { /* silent */ }
  };

  // ─── Effects ────────────────────────────────────────────────────────────────

  // Fetch client budget on AI tokens or overview tab
  useEffect(() => {
    if ((activeTab === 'ai_tokens' || activeTab === 'overview') && !budgetLoaded) fetchClientBudget();
  }, [activeTab, budgetLoaded, fetchClientBudget]);

  // Fetch per-instance AI payer data (only when instances exist)
  useEffect(() => {
    if (activeTab === 'ai_tokens' && !aiLoaded && realInstances.length > 0) fetchAiData();
  }, [activeTab, aiLoaded, realInstances.length, fetchAiData]);

  // Fetch team members on team or overview tab
  useEffect(() => {
    if ((activeTab === 'team' || activeTab === 'overview') && !teamLoaded) fetchTeamMembers();
  }, [activeTab, teamLoaded, fetchTeamMembers]);

  useEffect(() => {
    if (!teamSuccess) return;
    const t = setTimeout(() => setTeamSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [teamSuccess]);

  useEffect(() => {
    if ((activeTab === 'payments' || activeTab === 'overview') && !paymentsLoaded) fetchPayments();
  }, [activeTab, paymentsLoaded, fetchPayments]);

  useEffect(() => {
    if (activeTab === 'payments') fetchStripeCustomers();
  }, [activeTab, fetchStripeCustomers]);

  useEffect(() => {
    if ((activeTab === 'payments' || activeTab === 'overview') && !billingSettingsLoaded) fetchBillingSettings();
  }, [activeTab, billingSettingsLoaded, fetchBillingSettings]);

  useEffect(() => {
    if ((activeTab === 'properties' || activeTab === 'payments') && !waLoaded) fetchWhatsApp();
  }, [activeTab, waLoaded, fetchWhatsApp]);

  useEffect(() => {
    if (activeTab === 'properties' && !notesLoaded) fetchClientNotes();
  }, [activeTab, notesLoaded, fetchClientNotes]);

  useEffect(() => {
    if (activeTab === 'properties' && !otherLoaded) fetchCustomEntries();
  }, [activeTab, otherLoaded, fetchCustomEntries]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Client header skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-800/30 animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-gray-800/30 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-800/30 rounded animate-pulse" />
          </div>
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 space-y-3">
              <div className="h-4 w-24 bg-gray-800/30 rounded animate-pulse" />
              <div className="space-y-2">
                {[1, 2].map(j => (
                  <div key={j} className="h-10 bg-gray-800/30 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <Users className="w-10 h-10 text-white/40 mb-3" />
        <h3 className="text-lg font-semibold text-white mb-1">Client not found</h3>
        <p className="text-white/50 text-sm">This client no longer exists or was removed.</p>
      </div>
    );
  }

  const handleOpenInstance = (instanceId: string) => {
    router.push(`/portal?instance=${instanceId}`);
  };

  // Get instances not already assigned to this client (for assign modal)
  const assignedInstanceIds = new Set(realInstances.map(i => i.instance_id));
  const availableInstances = agencyInstances.filter(i => !assignedInstanceIds.has(i.id));

  // Instance status tags (for instance rows in overview)
  const instanceStatusTags: Record<string, { label: string; badgeClass: string; dotColor: string }> = {
    active: { label: 'Running', badgeClass: 'bg-green-500/10 text-green-400 border border-green-500/20', dotColor: 'bg-green-400' },
    running: { label: 'Running', badgeClass: 'bg-green-500/10 text-green-400 border border-green-500/20', dotColor: 'bg-green-400' },
    healthy: { label: 'Running', badgeClass: 'bg-green-500/10 text-green-400 border border-green-500/20', dotColor: 'bg-green-400' },
    deploying: { label: 'Deploying', badgeClass: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20', dotColor: 'bg-yellow-400' },
    error: { label: 'Error', badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20', dotColor: 'bg-red-400' },
    stopped: { label: 'Stopped', badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20', dotColor: 'bg-red-400' },
  };
  const defaultInstanceStatusTag = { label: 'Offline', badgeClass: 'bg-gray-800/30 text-white/50 border border-gray-700', dotColor: 'bg-white/30' };

  // ─── Overview tab ─────────────────────────────────────────────────────────
  if (activeTab === 'overview') {
    // Gather recent transactions from all instances
    const allTransactions: (Transaction & { instanceName: string })[] = [];
    for (const [instId, pd] of Object.entries(instancePayments)) {
      const instName = realInstances.find(i => i.instance_id === instId)?.instance_name || instId;
      for (const tx of pd.transactions) {
        allTransactions.push({ ...tx, instanceName: instName });
      }
    }
    for (const mp of manualPayments) {
      allTransactions.push({
        id: mp.id,
        type: 'manual',
        amount: mp.amount,
        currency: mp.currency,
        status: 'paid',
        normalizedStatus: 'paid',
        description: mp.description,
        created: new Date(mp.payment_date).getTime() / 1000,
        receipt_url: null,
        invoice_url: null,
        instanceName: mp.payment_method,
      });
    }
    allTransactions.sort((a, b) => b.created - a.created);
    const recentTx = allTransactions.slice(0, 5);

    const formatAmount = (amount: number, currency: string) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
    const formatDate = (ts: number) =>
      new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const activeMembers = teamMembers.filter(m => m.status === 'accepted');

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">

          {/* Pending invite banner */}
          {client.bestStatus === 'pending' && (
            <div className="p-4 bg-yellow-900/20 border border-yellow-900/40 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-400">Invite pending</p>
                <p className="text-sm text-white/40">This client has not yet accepted their invitation.</p>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/60">Monthly Rev</span>
              </div>
              <p className="text-2xl font-semibold text-white">
                {(() => {
                  const now = new Date();
                  const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
                  const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  const monthlyPaid = allTransactions.filter(tx => {
                    const nStatus = tx.normalizedStatus || tx.status;
                    if (nStatus !== 'paid' && nStatus !== 'succeeded') return false;
                    const txDate = new Date(tx.created * 1000);
                    return txDate >= mStart && txDate <= mEnd;
                  });
                  const total = monthlyPaid.reduce((sum, tx) => sum + tx.amount, 0);
                  if (total === 0) return '-';
                  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
                    .format(total / 100);
                })()}
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/60">Instances</span>
              </div>
              <p className="text-2xl font-semibold text-white">{realInstances.length}</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/60">AI Tokens</span>
              </div>
              <p className="text-2xl font-semibold text-white">
                {budgetLoading ? '-' : clientBudget ? clientBudget.tokensRemaining.toLocaleString() : '0'}
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <UsersRound className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/60">Members</span>
              </div>
              <p className="text-2xl font-semibold text-white">{teamLoading ? '-' : activeMembers.length}</p>
            </div>
          </div>

          {/* Instances */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Instances</h3>
              <button
                onClick={() => router.replace(`?tab=properties`)}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {realInstances.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-white/40">No instances assigned</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {realInstances.slice(0, 5).map(inst => {
                  const live = liveStatus[inst.instance_id] || inst.status;
                  const tag = instanceStatusTags[live] || defaultInstanceStatusTag;
                  return (
                    <div key={inst.instance_id} className="flex items-center gap-3 px-5 py-3">
                      <Server className="w-4 h-4 text-white/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{inst.instance_name}</p>
                        {inst.is_external && <span className="text-sm text-white/30">External</span>}
                      </div>
                      <span className={cn('px-2 py-0.5 text-xs rounded-full inline-flex items-center gap-1.5', tag.badgeClass)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', tag.dotColor)} />
                        {tag.label}
                      </span>
                    </div>
                  );
                })}
                {realInstances.length > 5 && (
                  <div className="px-5 py-2.5 text-sm text-white/30">
                    +{realInstances.length - 5} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Recent Payments</h3>
              <button
                onClick={() => router.replace(`?tab=payments`)}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {paymentsLoading ? (
              <div className="px-5 py-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-white/30 mx-auto" />
              </div>
            ) : recentTx.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-white/40">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {recentTx.map(tx => {
                  const isPaid = tx.normalizedStatus === 'paid' || tx.status === 'succeeded' || tx.status === 'paid';
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                      <DollarSign className="w-4 h-4 text-white/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{tx.description || tx.type}</p>
                        <p className="text-sm text-white/30">{formatDate(tx.created)}</p>
                      </div>
                      <span className={cn('text-sm font-medium', isPaid ? 'text-green-400' : 'text-white/60')}>
                        {formatAmount(tx.amount, tx.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Team Members */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Team Members</h3>
              <button
                onClick={() => router.replace(`?tab=team`)}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Manage <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {teamLoading ? (
              <div className="px-5 py-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-white/30 mx-auto" />
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-white/40">No team members</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {teamMembers.slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Users className="w-4 h-4 text-white/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{m.email}</p>
                      <p className="text-sm text-white/30 capitalize">{m.role}</p>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      m.status === 'accepted'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    )}>
                      {m.status === 'accepted' ? 'Active' : 'Pending'}
                    </span>
                  </div>
                ))}
                {teamMembers.length > 5 && (
                  <div className="px-5 py-2.5 text-sm text-white/30">
                    +{teamMembers.length - 5} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Remove Client */}
          <div className="border-t border-gray-800 pt-6">
            <button
              onClick={() => setShowRemoveClient(true)}
              className="flex items-center gap-2 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <UserX className="w-4 h-4" />
              Remove Client
            </button>
          </div>

        </div>

        {/* Remove client confirmation modal */}
        {showRemoveClient && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !removingClient) setShowRemoveClient(false); }}
          >
            <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-2">Remove Client</h3>
              <p className="text-sm text-white/60 mb-4">
                {isPendingClient
                  ? <>This will cancel the pending invite for <span className="text-white font-medium">{client.email}</span> and remove them from your clients.</>
                  : <>This will revoke <span className="text-white font-medium">{client.email}</span>&apos;s access to all linked instances and cancel any pending invites.</>
                }
              </p>
              {realInstances.length > 0 && (
                <div className="space-y-2 mb-4">
                  {realInstances.map(inst => (
                    <div key={inst.instance_id} className="flex items-center gap-2 p-3 bg-gray-800/30 border border-gray-700 rounded-lg">
                      <Server className="w-4 h-4 text-white/60 shrink-0" />
                      <span className="text-sm text-white">{inst.instance_name || 'Unnamed instance'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRemoveClient(false)}
                  disabled={removingClient}
                  className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveClient}
                  disabled={removingClient}
                  className="flex-1 px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:bg-gray-400 disabled:text-gray-600"
                >
                  {removingClient ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Removing...
                    </span>
                  ) : (
                    'Remove Client'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Properties tab ────────────────────────────────────────────────────────
  if (activeTab === 'properties') {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
          {/* Instances Section */}
          <div id="hosting">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Instances</h3>
              {availableInstances.length > 0 && (
                <button
                  onClick={() => setShowAssignInstance(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Link Instance
                </button>
              )}
            </div>

            {/* Link instance inline form */}
            {showAssignInstance && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-3 space-y-3">
                <p className="text-sm text-white/60">Link an instance to this client.</p>
                <SearchableSelect
                  value={assignInstanceId}
                  onChange={setAssignInstanceId}
                  placeholder="Select an instance..."
                  options={[
                    { value: '', label: 'Select an instance...' },
                    ...availableInstances.map(inst => ({ value: inst.id, label: inst.name }))
                  ]}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAssignInstance}
                    disabled={!assignInstanceId || assigningInstance}
                    className="px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    {assigningInstance ? 'Assigning...' : 'Assign'}
                  </button>
                  <button
                    onClick={() => { setShowAssignInstance(false); setAssignInstanceId(''); }}
                    className="px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {realInstances.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center">
                <Server className="w-8 h-8 text-white/20 mb-2" />
                <p className="text-sm text-white/40">No instances linked to this client.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {realInstances.map((inst) => {
                  const isConfirming = revokeConfirm === inst.instance_id;
                  return (
                    <div key={inst.instance_id} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                      {isConfirming ? (
                        <div className="flex items-center gap-2 px-4 py-3">
                          <span className="text-sm text-white/60 flex-1">Revoke access?</span>
                          <button
                            onClick={() => handleRevokeAccess(inst.instance_id)}
                            disabled={revoking}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {revoking ? 'Revoking...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setRevokeConfirm(null)}
                            className="px-3 py-1.5 border border-gray-700 text-white/60 hover:bg-gray-700 rounded-lg text-sm transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <button
                            onClick={() => handleOpenInstance(inst.instance_id)}
                            className="flex-1 px-4 py-4 text-left hover:bg-gray-900/50 transition-colors cursor-pointer min-w-0"
                          >
                            <div className="flex items-center gap-2">
                              {/* Live status dot */}
                              {(() => {
                                const s = liveStatus[inst.instance_id] || inst.status;
                                const isActive = ['active', 'running', 'healthy'].includes(s);
                                const isConnecting = ['deploying', 'provisioning', 'starting', 'restarting', 'updating'].includes(s);
                                const isError = ['error', 'failed', 'unhealthy', 'stopped', 'exited'].includes(s);
                                return (
                                  <span className={cn(
                                    'w-2 h-2 rounded-full shrink-0',
                                    isActive ? 'bg-green-400' : isConnecting ? 'bg-yellow-400 animate-pulse' : isError ? 'bg-red-400' : statusLoading ? 'bg-gray-500 animate-pulse' : 'bg-gray-500'
                                  )} />
                                );
                              })()}
                              <span className="text-sm font-medium text-white block truncate">
                                {inst.instance_name || 'Unnamed instance'}
                              </span>
                              {inst.is_external && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800/30 text-white/60 border border-gray-700 shrink-0">External</span>
                              )}
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-xs shrink-0',
                                inst.client_paid
                                  ? 'bg-green-900/20 text-green-400 border border-green-800'
                                  : 'bg-gray-800/30 text-white/40 border border-gray-700'
                              )}>
                                {inst.client_paid ? 'Client pays' : 'You pay'}
                              </span>
                            </div>
                            {inst.instance_url && (
                              <span className="text-sm text-white/30 block truncate mt-0.5">
                                {inst.instance_url.replace('https://', '')}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setRevokeConfirm(inst.instance_id); }}
                            className="p-4 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Services Section */}
          <div id="services">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Services</h3>
              {realInstances.length > 0 && agencyServices.length > 0 && !showLinkService && (
                <button
                  onClick={() => {
                    setShowLinkService(true);
                    if (realInstances.length === 1) setLinkServiceInstanceId(realInstances[0].instance_id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Link Service
                </button>
              )}
            </div>

            {/* Inline service linking form */}
            {showLinkService && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-3 space-y-3">
                <p className="text-sm text-white/60">Link a WhatsApp service to one of this client&apos;s instances.</p>
                <SearchableSelect
                  value={linkServiceId}
                  onChange={setLinkServiceId}
                  placeholder="Select a service..."
                  options={[
                    { value: '', label: 'Select a service...' },
                    ...agencyServices.map(s => ({ value: s.id, label: `${s.name}${s.phone ? ` (+${s.phone})` : ''}` }))
                  ]}
                />
                {realInstances.length > 1 && (
                  <SearchableSelect
                    value={linkServiceInstanceId}
                    onChange={setLinkServiceInstanceId}
                    placeholder="Link to instance..."
                    options={[
                      { value: '', label: 'Link to instance...' },
                      ...realInstances.map(inst => ({ value: inst.instance_id, label: inst.instance_name || 'Unnamed instance' }))
                    ]}
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleLinkService}
                    disabled={!linkServiceId || !linkServiceInstanceId || linkingService}
                    className="px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    {linkingService ? 'Linking...' : 'Link'}
                  </button>
                  <button
                    onClick={() => { setShowLinkService(false); setLinkServiceId(''); setLinkServiceInstanceId(''); }}
                    className="px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {waLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-800/30 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-32 bg-gray-800/30 rounded" />
                        <div className="h-3 w-24 bg-gray-800/30 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : linkedWhatsApp.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center">
                <MessageSquare className="w-8 h-8 text-white/20 mb-2" />
                <p className="text-sm text-white/40">No WhatsApp services linked</p>
              </div>
            ) : (
              <div className="space-y-3">
                {linkedWhatsApp.map((wa) => {
                  const linkedInst = realInstances.find(i => i.instance_id === wa.linked_instance_id);
                  const isConfirmingUnlink = unlinkServiceConfirm === wa.id;
                  return (
                    <div key={wa.id} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                      {isConfirmingUnlink ? (
                        <div className="flex items-center gap-2 px-4 py-3">
                          <span className="text-sm text-white/60 flex-1">Unlink this service?</span>
                          <button
                            onClick={() => handleUnlinkService(wa.id)}
                            disabled={unlinkingService}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {unlinkingService ? 'Unlinking...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setUnlinkServiceConfirm(null)}
                            className="px-3 py-1.5 border border-gray-700 text-white/60 hover:bg-gray-700 rounded-lg text-sm transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center p-4 gap-4">
                          <div className="p-2 bg-green-900/20 border border-green-800 rounded-lg shrink-0">
                            <MessageSquare className="w-4 h-4 text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{wa.display_name || wa.instance_name}</p>
                            {wa.phone_number && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-white/30" />
                                <p className="text-sm text-white/40">+{wa.phone_number}</p>
                              </div>
                            )}
                            {linkedInst && (
                              <p className="text-sm text-white/25 mt-0.5">{linkedInst.instance_name}</p>
                            )}
                          </div>
                          <button
                            onClick={() => setUnlinkServiceConfirm(wa.id)}
                            className="p-2 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors cursor-pointer shrink-0 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* External Instances Section */}
          <div id="external">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">External Instances</h3>
              {!showExternalForm && (
                <button
                  onClick={() => setShowExternalForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Link External
                </button>
              )}
            </div>

            {showExternalForm && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3 mb-3">
                {/* Service type selector */}
                <div className="flex gap-2">
                  {(['n8n', 'openclaw', 'other'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setExternalForm(f => ({ ...f, serviceType: type }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer capitalize ${
                        externalForm.serviceType === type
                          ? 'bg-white text-black border-white'
                          : 'border-gray-700 text-white/60 hover:bg-gray-800'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Instance name"
                  value={externalForm.name}
                  onChange={e => setExternalForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                />
                {externalForm.serviceType !== 'other' && (
                  <input
                    type="url"
                    placeholder={externalForm.serviceType === 'n8n' ? 'N8N URL (e.g. https://n8n.yourdomain.com)' : 'OpenClaw URL'}
                    value={externalForm.instanceUrl}
                    onChange={e => setExternalForm(f => ({ ...f, instanceUrl: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                  />
                )}
                {externalForm.serviceType === 'other' && (
                  <input
                    type="url"
                    placeholder="URL (optional)"
                    value={externalForm.instanceUrl}
                    onChange={e => setExternalForm(f => ({ ...f, instanceUrl: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                  />
                )}
                {externalForm.serviceType === 'n8n' && (
                  <input
                    type="password"
                    placeholder="N8N API Key"
                    value={externalForm.apiKey}
                    onChange={e => setExternalForm(f => ({ ...f, apiKey: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                  />
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={externalForm.clientAccess}
                    onClick={() => setExternalForm(f => ({ ...f, clientAccess: !f.clientAccess }))}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                      externalForm.clientAccess ? 'bg-white' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
                        externalForm.clientAccess ? 'translate-x-5 bg-black' : 'translate-x-1 bg-gray-400'
                      }`}
                    />
                  </button>
                  <div>
                    <span className="text-sm text-white">Client access</span>
                    <p className="text-sm text-white/60">
                      {externalForm.clientAccess ? 'Client can see this instance' : 'Only you (agency) can see this'}
                    </p>
                  </div>
                </div>
                {externalError && (
                  <p className="text-sm text-red-400">{externalError}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleLinkExternal}
                    disabled={linkingExternal}
                    className="px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    {linkingExternal ? 'Linking...' : 'Link Instance'}
                  </button>
                  <button
                    onClick={() => { setShowExternalForm(false); setExternalError(null); setExternalForm({ serviceType: 'n8n', name: '', instanceUrl: '', apiKey: '', clientAccess: false }); }}
                    className="px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showExternalForm && realInstances.filter(i => i.is_external).length === 0 && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center">
                <Server className="w-8 h-8 text-white/20 mb-2" />
                <p className="text-sm text-white/40">No external instances linked.</p>
                <p className="text-sm text-white/25 mt-1">Link any n8n, OpenClaw, or other external service.</p>
              </div>
            )}

            {realInstances.filter(i => i.is_external).length > 0 && (
              <div className="space-y-2">
                {realInstances.filter(i => i.is_external).map(inst => {
                  const isConfirmingExternal = revokeConfirm === `ext-${inst.instance_id}`;
                  const typeLabel = inst.service_type === 'openclaw' ? 'OpenClaw' : inst.service_type === 'n8n' ? 'n8n' : inst.service_type === 'other' ? 'Other' : 'External';
                  return (
                    <div key={inst.instance_id} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                      {isConfirmingExternal ? (
                        <div className="flex items-center gap-2 px-4 py-3">
                          <span className="text-sm text-white/60 flex-1">Unlink this external instance?</span>
                          <button
                            onClick={() => { setRevokeConfirm(null); handleRevokeAccess(inst.instance_id); }}
                            disabled={revoking}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {revoking ? 'Removing...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setRevokeConfirm(null)}
                            className="px-3 py-1.5 border border-gray-700 text-white/60 hover:bg-gray-700 rounded-lg text-sm transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-800/30 border border-gray-700 flex items-center justify-center shrink-0">
                            <Server className="w-4 h-4 text-white/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{inst.instance_name || 'External Instance'}</p>
                            {inst.instance_url && (
                              <p className="text-sm text-white/40 truncate mt-0.5">{inst.instance_url.replace('https://', '')}</p>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800/30 text-white/60 border border-gray-700 shrink-0">{typeLabel}</span>
                          <button
                            onClick={() => setRevokeConfirm(`ext-${inst.instance_id}`)}
                            className="p-2 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors cursor-pointer shrink-0 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div id="notes">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Notes</h3>
              {!notesEditing && (
                <button
                  onClick={() => { setNotesDraft(clientNotes); setNotesEditing(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {clientNotes ? 'Edit' : 'Add Notes'}
                </button>
              )}
            </div>

            {notesEditing ? (
              <div className="space-y-3">
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  placeholder="Add notes about this client..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveClientNotes}
                    disabled={notesSaving}
                    className="px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    {notesSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setNotesEditing(false)}
                    className="px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : clientNotes ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-white/60 whitespace-pre-wrap">{clientNotes}</p>
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center">
                <StickyNote className="w-8 h-8 text-white/20 mb-2" />
                <p className="text-sm text-white/40">No notes yet. Add notes about this client.</p>
              </div>
            )}
          </div>

          {/* Other Section - HIDDEN: use External Instances for hosted services */}
          {false && <div id="other">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Other</h3>
              {!showOtherForm && (
                <button
                  onClick={() => setShowOtherForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Entry
                </button>
              )}
            </div>

            {showOtherForm && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3 mb-3">
                <input
                  type="text"
                  placeholder="Name (required)"
                  value={otherForm.name}
                  onChange={e => setOtherForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                />
                <input
                  type="text"
                  placeholder="Domain"
                  value={otherForm.domain}
                  onChange={e => setOtherForm(f => ({ ...f, domain: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                />
                <input
                  type="text"
                  placeholder="Access"
                  value={otherForm.access}
                  onChange={e => setOtherForm(f => ({ ...f, access: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                />
                <input
                  type="text"
                  placeholder="Notes"
                  value={otherForm.notes}
                  onChange={e => setOtherForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                />
                {otherError && <p className="text-sm text-red-400">{otherError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleAddOtherEntry}
                    disabled={otherSaving || !otherForm.name.trim()}
                    className="px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    {otherSaving ? 'Saving...' : 'Add'}
                  </button>
                  <button
                    onClick={() => { setShowOtherForm(false); setOtherForm({ name: '', domain: '', access: '', notes: '' }); setOtherError(null); }}
                    className="px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {customEntries.length === 0 && !showOtherForm ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center">
                <FileText className="w-8 h-8 text-white/20 mb-2" />
                <p className="text-sm text-white/40">No entries yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customEntries.map(entry => {
                  const isEditing = editingEntry === entry.id;
                  const isConfirmingDelete = confirmDeleteEntry === entry.id;
                  return (
                    <div key={entry.id} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-2 px-4 py-3">
                          <span className="text-sm text-white/60 flex-1">Delete this entry?</span>
                          <button
                            onClick={() => handleDeleteOtherEntry(entry.id)}
                            disabled={deletingEntry === entry.id}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {deletingEntry === entry.id ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteEntry(null)}
                            className="px-3 py-1.5 border border-gray-700 text-white/60 hover:bg-gray-700 rounded-lg text-sm transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isEditing ? (
                        <div className="p-4 space-y-3">
                          <input
                            type="text"
                            placeholder="Name (required)"
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Domain"
                            value={editForm.domain}
                            onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Access"
                            value={editForm.access}
                            onChange={e => setEditForm(f => ({ ...f, access: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Notes"
                            value={editForm.notes}
                            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateOtherEntry(entry.id)}
                              disabled={otherSaving || !editForm.name.trim()}
                              className="px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                              {otherSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingEntry(null)}
                              className="px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start p-4 gap-3">
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-sm font-medium text-white">{entry.name}</p>
                            {entry.domain && (
                              <p className="text-sm text-white/40"><span className="text-white/25">Domain:</span> {entry.domain}</p>
                            )}
                            {entry.access && (
                              <p className="text-sm text-white/40"><span className="text-white/25">Access:</span> {entry.access}</p>
                            )}
                            {entry.notes && (
                              <p className="text-sm text-white/40"><span className="text-white/25">Notes:</span> {entry.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => { setEditingEntry(entry.id); setEditForm({ name: entry.name, domain: entry.domain, access: entry.access, notes: entry.notes }); }}
                              className="p-1.5 rounded-lg hover:bg-gray-700 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteEntry(entry.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Remove Client */}
          <div className="border-t border-gray-800 pt-6">
            <button
              onClick={() => setShowRemoveClient(true)}
              className="flex items-center gap-2 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <UserX className="w-4 h-4" />
              Remove Client
            </button>
          </div>
        </div>

        {/* Remove client confirmation modal */}
        {showRemoveClient && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !removingClient) setShowRemoveClient(false); }}
          >
            <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-2">Remove Client</h3>
              <p className="text-sm text-white/60 mb-4">
                This will revoke <span className="text-white font-medium">{client.email}</span>&apos;s access to all linked instances. The client account itself will not be deleted.
              </p>
              {realInstances.length > 0 && (
                <div className="space-y-2 mb-4">
                  {realInstances.map(inst => (
                    <div key={inst.instance_id} className="flex items-center gap-2 p-3 bg-gray-800/30 border border-gray-700 rounded-lg">
                      <Server className="w-4 h-4 text-white/60 shrink-0" />
                      <span className="text-sm text-white">{inst.instance_name || 'Unnamed instance'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRemoveClient(false)}
                  disabled={removingClient}
                  className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveClient}
                  disabled={removingClient}
                  className="flex-1 px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:bg-gray-400 disabled:text-gray-600"
                >
                  {removingClient ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Removing...
                    </span>
                  ) : (
                    'Remove Client'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── AI Tokens tab ─────────────────────────────────────────────────────────
  if (activeTab === 'ai_tokens') {
    if (!budgetLoading && !feConnected) {
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 md:p-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-purple-400/60" />
              </div>
              <div>
                <p className="text-base font-medium text-white mb-1">FlowEngine not connected</p>
                <p className="text-sm text-white/40 max-w-sm">
                  Connect your FlowEngine API key in{' '}
                  <span className="text-white/60">Settings → Connections</span>{' '}
                  to enable AI token tracking for clients.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const purchaseTokens = Math.floor(parseFloat(topupAmount || '0') * 20000);
    const nonExternalInstances = realInstances.filter(i => !i.is_external);
    const canSwitchToClient = Object.values(instanceAiData).filter(d => !d.isExternal).every(d => d.hasLinkedClient);

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{client.email}</p>
                  <p className="text-sm text-white/40">AI usage & tokens</p>
                </div>
              </div>
              <button
                onClick={() => fetchClientBudget(true)}
                disabled={budgetRefreshing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-white/60 hover:text-white bg-gray-800/30 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', budgetRefreshing && 'animate-spin')} />
                {budgetRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* Success / Error messages */}
            {payerSuccess && (
              <div className="p-3 bg-green-900/20 border border-green-800 rounded-lg flex items-center gap-2">
                <Settings className="h-4 w-4 text-green-400" />
                <p className="text-sm text-green-400">{payerSuccess}</p>
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Token Balance */}
            {budgetLoading ? (
              <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700 animate-pulse">
                <div className="h-4 bg-gray-700/30 rounded w-1/3 mb-2" />
                <div className="h-6 bg-gray-700/30 rounded w-1/2" />
              </div>
            ) : clientBudget ? (
              <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-white/60" />
                    <div>
                      <p className="text-sm text-white/40">Remaining</p>
                      <p className="text-lg font-semibold text-white">
                        {clientBudget.tokensRemaining.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-white/60" />
                    <div>
                      <p className="text-sm text-white/40">Used</p>
                      <p className="text-lg font-semibold text-white">
                        {clientBudget.tokensUsed.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700 text-center">
                <p className="text-sm text-white/40">No budget data available yet.</p>
              </div>
            )}

            {/* Who Pays - client-level toggle */}
            {nonExternalInstances.length > 0 && (
              <div>
                <p className="text-sm text-white/60 mb-3">Who pays for AI usage?</p>
                {aiLoading || !aiLoaded ? (
                  <div className="flex gap-3">
                    <div className="flex-1 h-16 bg-gray-800/30 rounded-lg animate-pulse" />
                    <div className="flex-1 h-16 bg-gray-800/30 rounded-lg animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handlePayerSwitch('agency')}
                        disabled={payerSwitching}
                        className={cn(
                          'flex-1 p-3 rounded-lg border transition-all text-left cursor-pointer',
                          clientPayer === 'agency'
                            ? 'bg-white text-black border-white'
                            : 'bg-gray-800/30 border-gray-700 hover:border-gray-600 text-white',
                          payerSwitching && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="font-medium text-sm">You (Agency)</div>
                        <div className={cn('text-sm', clientPayer === 'agency' ? 'text-black/60' : 'text-white/40')}>
                          Your tokens are used
                        </div>
                      </button>
                      <button
                        onClick={() => handlePayerSwitch('client')}
                        disabled={payerSwitching || !canSwitchToClient}
                        className={cn(
                          'flex-1 p-3 rounded-lg border transition-all text-left',
                          clientPayer === 'client'
                            ? 'bg-white text-black border-white cursor-pointer'
                            : 'bg-gray-800/30 border-gray-700 hover:border-gray-600 text-white',
                          (!canSwitchToClient || payerSwitching) && 'opacity-50 cursor-not-allowed',
                          canSwitchToClient && clientPayer !== 'client' && 'cursor-pointer'
                        )}
                      >
                        <div className="font-medium text-sm">Client</div>
                        <div className={cn('text-sm', clientPayer === 'client' ? 'text-black/60' : 'text-white/40')}>
                          Client&apos;s tokens are used
                        </div>
                      </button>
                    </div>
                    {!canSwitchToClient && Object.keys(instanceAiData).length > 0 && (
                      <p className="mt-3 text-sm text-white/40">
                        Client must add tokens before switching to client-pays.
                      </p>
                    )}
                    <p className="mt-3 text-sm text-white/30">
                      You can change this individually per instance under each instance&apos;s settings.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Top-up section */}
            <div className="border-t border-gray-800 pt-4">
              <p className="text-sm font-medium text-white mb-3">Top-up tokens</p>
              {isPendingClient ? (
                <div className="p-4 bg-yellow-900/20 border border-yellow-900/40 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
                  <p className="text-sm text-white/40">Token top-ups require an accepted invite. Once this client accepts, you can purchase tokens for their account.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {['5', '10', '25', '50'].map(preset => (
                      <button
                        key={preset}
                        onClick={() => setTopupAmount(preset)}
                        className={cn(
                          'px-3 py-2 text-sm rounded-lg border font-medium cursor-pointer transition-colors',
                          topupAmount === preset
                            ? 'bg-white text-black border-white'
                            : 'bg-gray-800/30 text-white/60 border-gray-700 hover:border-gray-600'
                        )}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                  <div className="relative mb-3">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <input
                      type="number"
                      value={topupAmount}
                      onChange={e => setTopupAmount(e.target.value)}
                      min="1"
                      max="1000"
                      step="1"
                      placeholder="Enter amount"
                      className="w-full pl-10 pr-4 py-3 bg-gray-900/50 text-white border border-gray-800 rounded-lg focus:ring-2 focus:ring-white focus:border-white text-sm placeholder:text-gray-500"
                    />
                  </div>
                  <button
                    onClick={handleTopup}
                    disabled={topupLoading || !topupAmount || parseFloat(topupAmount) < 1}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 font-medium rounded-lg transition-colors cursor-pointer text-sm"
                  >
                    {topupLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add {purchaseTokens.toLocaleString()} Tokens
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Payer switch confirmation modal */}
        {showPayerConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !payerSwitching) { setShowPayerConfirm(false); setPendingPayer(null); } }}
          >
            <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-2">Switch AI Payer</h3>
              <p className="text-sm text-white/60 mb-4">
                Switching to <span className="text-white font-medium">{pendingPayer === 'agency' ? 'You (Agency)' : 'Client'}</span> requires restarting {nonExternalInstances.length === 1 ? 'this instance' : 'these instances'}:
              </p>
              <div className="space-y-2 mb-4">
                {nonExternalInstances.map(inst => (
                  <div key={inst.instance_id} className="flex items-center gap-2 p-3 bg-gray-800/30 border border-gray-700 rounded-lg">
                    <Server className="w-4 h-4 text-white/60 shrink-0" />
                    <span className="text-sm text-white">{inst.instance_name || 'Unnamed instance'}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-white/40 mb-5">
                Each instance will be briefly unavailable (1-2 minutes).
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPayerConfirm(false); setPendingPayer(null); }}
                  disabled={payerSwitching}
                  className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPayerSwitch}
                  disabled={payerSwitching}
                  className="flex-1 px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:bg-gray-400 disabled:text-gray-600"
                >
                  {payerSwitching ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Restarting...
                    </span>
                  ) : (
                    'Restart & Switch'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Team Members tab ──────────────────────────────────────────────────────
  if (activeTab === 'team') {
    const activeCount = teamMembers.filter(m => m.status === 'accepted').length;
    const pendingCount = teamMembers.filter(m => m.status === 'pending').length;

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-800/30 flex items-center justify-center">
                <UsersRound className="h-5 w-5 text-white/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Team Members</p>
                <p className="text-sm text-white/40">Invite team members to {client.email}&apos;s account</p>
              </div>
            </div>

            {/* Invite Form */}
            <form onSubmit={handleTeamInvite}>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={teamInviteEmail}
                  onChange={e => { setTeamInviteEmail(e.target.value); setTeamError(null); setTeamSuccess(null); }}
                  placeholder="team@example.com"
                  className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm"
                />
                <select
                  value={teamInviteRole}
                  onChange={e => setTeamInviteRole(e.target.value)}
                  className="px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white text-sm focus:ring-2 focus:ring-white focus:border-white"
                >
                  <option value="member">Member (read-only)</option>
                  <option value="manager">Manager (no billing)</option>
                  <option value="admin">Admin (full access)</option>
                </select>
                <button
                  type="submit"
                  disabled={teamInviting || !teamInviteEmail.trim()}
                  className="px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {teamInviting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Send Invite'}
                </button>
              </div>

              {teamError && <p className="mt-2 text-sm text-red-400">{teamError}</p>}
              {teamSuccess && <p className="mt-2 text-sm text-green-400">{teamSuccess}</p>}
            </form>

            {/* Members Table */}
            {teamLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : teamMembers.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">No team members yet.</p>
            ) : (
              <>
                {/* Stats */}
                <div className="flex gap-4 text-sm">
                  <span className="text-green-400">{activeCount} active</span>
                  {pendingCount > 0 && <span className="text-yellow-400">{pendingCount} pending</span>}
                </div>

                {/* Header */}
                <div className="hidden sm:grid grid-cols-[1fr_120px_80px_80px] gap-3 px-3 pb-2 text-sm text-white/40 border-b border-gray-800">
                  <span>Email</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span></span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-gray-800">
                  {teamMembers.map(member => {
                    const isConfirming = teamConfirmRemove === member.id;

                    return (
                      <div
                        key={member.id}
                        className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_80px_80px] gap-2 sm:gap-3 items-start sm:items-center px-3 py-3"
                      >
                        <span className="text-white text-sm truncate w-full">{member.email}</span>

                        <select
                          value={member.role}
                          onChange={e => handleTeamRoleChange(member.id, e.target.value)}
                          className="px-2 py-1 bg-gray-900/50 border border-gray-800 rounded text-sm text-white focus:ring-1 focus:ring-white"
                        >
                          <option value="member">Member</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>

                        <span className={`text-sm px-2 py-0.5 rounded-full border ${member.status === 'accepted' ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-yellow-900/20 border-yellow-900/40 text-yellow-400'}`}>
                          {member.status === 'accepted' ? 'Active' : 'Pending'}
                        </span>

                        <div className="flex justify-end w-full sm:w-auto">
                          {isConfirming ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleTeamRemove(member.id)}
                                className="px-2 py-1 rounded text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setTeamConfirmRemove(null)}
                                className="px-2 py-1 rounded text-sm text-white/40 hover:text-white transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setTeamConfirmRemove(member.id)}
                              className="px-2 py-1 rounded text-sm bg-red-900/20 border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Payments tab ───────────────────────────────────────────────────────────
  if (activeTab === 'payments') {
    const formatAmount = (amount: number, currency: string) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);

    const formatDate = (ts: number) =>
      new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const statusBadge = (normalized: string) => {
      const styles: Record<string, string> = {
        paid: 'bg-green-900/20 text-green-400 border-green-800',
        pending: 'bg-yellow-900/20 text-yellow-400 border-yellow-900/40',
        overdue: 'bg-red-900/20 text-red-400 border-red-800',
        failed: 'bg-red-900/20 text-red-400 border-red-800',
        void: 'bg-gray-800/30 text-white/40 border-gray-700',
        draft: 'bg-gray-800/30 text-white/40 border-gray-700',
      };
      return (
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border capitalize', styles[normalized] || styles.draft)}>
          {normalized}
        </span>
      );
    };

    const paymentMethodLabels: Record<string, string> = {
      bank_transfer: 'Bank Transfer',
      cash: 'Cash',
      check: 'Check',
      crypto: 'Crypto',
      other: 'Other',
    };

    // Determine Stripe connection status from instance data or customer fetch
    const allPayments = Object.values(instancePayments);
    const hasPaymentData = allPayments.length > 0;
    const stripeConnected = hasPaymentData
      ? allPayments.some(pd => pd.stripeConnected)
      : (stripeCustomers.length > 0 || (customersFetched && !stripeError));
    const stripeKeyError = allPayments.some(pd => pd.stripeKeyError);

    // Collect all transactions across all instances, deduplicate by ID
    const allTransactions: Transaction[] = [];
    const seenTxIds = new Set<string>();
    for (const pd of Object.values(instancePayments)) {
      for (const tx of pd.transactions) {
        if (!seenTxIds.has(tx.id)) {
          seenTxIds.add(tx.id);
          allTransactions.push(tx);
        }
      }
    }
    allTransactions.sort((a, b) => b.created - a.created);

    // Current linked customer (from instances, or from billing settings)
    const instanceLinkedCustomer = allPayments.find(pd => pd.customer)?.customer;
    const settingsCustomerId = billingSettings?.stripe_customer_id;
    const linkedCustomer = instanceLinkedCustomer
      || (settingsCustomerId ? { id: settingsCustomerId, email: stripeCustomers.find(c => c.id === settingsCustomerId)?.email || settingsCustomerId, name: stripeCustomers.find(c => c.id === settingsCustomerId)?.name || null } : null);


    // Monthly expected vs collected calculation
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Sum of paid Stripe transactions this month
    const stripeCollected = allTransactions
      .filter(tx => {
        const nStatus = tx.normalizedStatus || tx.status;
        if (nStatus !== 'paid' && nStatus !== 'succeeded') return false;
        const txDate = new Date(tx.created * 1000);
        return txDate >= monthStart && txDate <= monthEnd;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Sum of manual payments this month
    const manualCollected = manualPayments
      .filter(mp => {
        const d = new Date(mp.payment_date);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, mp) => sum + mp.amount, 0);

    const totalCollected = stripeCollected + manualCollected;
    const expectedAmount = billingSettings?.monthly_expected_amount || 0;
    const debt = expectedAmount > 0 ? Math.max(0, expectedAmount - totalCollected) : 0;

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
          {paymentsLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 animate-pulse">
                  <div className="h-4 w-40 bg-gray-800/30 rounded mb-3" />
                  <div className="h-20 bg-gray-800/30 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Payment fetch error */}
              {paymentsError && (
                <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl">
                  <p className="text-sm text-red-400">{paymentsError}</p>
                </div>
              )}

              {/* Monthly Summary - always visible when expected amount is set */}
              {expectedAmount > 0 && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">{monthLabel}</h3>
                    {debt > 0 && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-red-900/20 text-red-400 border border-red-800">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {formatAmount(debt, 'usd')} outstanding
                      </span>
                    )}
                    {debt === 0 && totalCollected >= expectedAmount && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-green-900/20 text-green-400 border border-green-800">
                        <Check className="w-3.5 h-3.5" />
                        Paid in full
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Collected</span>
                      <span className="text-white font-medium">{formatAmount(totalCollected, 'usd')} of {formatAmount(expectedAmount, 'usd')}</span>
                    </div>
                    <div className="w-full bg-gray-800/30 rounded-full h-2">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all',
                          totalCollected >= expectedAmount ? 'bg-green-400' : totalCollected > 0 ? 'bg-yellow-400' : 'bg-gray-700'
                        )}
                        style={{ width: `${Math.min(100, expectedAmount > 0 ? (totalCollected / expectedAmount) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Stripe section */}
              {!stripeConnected && customersFetched ? (
                <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-white/30 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {stripeKeyError ? 'Stripe Key Error' : 'Stripe Not Connected'}
                      </p>
                      <p className="text-sm text-white/40">
                        {stripeKeyError
                          ? 'Your Stripe key could not be decrypted. Re-save it in settings.'
                          : 'Connect Stripe in settings to charge clients and view transactions.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/portal/settings')}
                    className="px-4 py-2.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer shrink-0"
                  >
                    Settings
                  </button>
                </div>
              ) : (
                <>
                  {/* Client Billing header with action buttons */}
                  <div id="billing">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Client Billing</h3>
                      {(linkedCustomer || selectedCustomerId) && !billingAction && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setBillingAction('charge'); setBillingResult(null); setRecurringEnabled(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            title="Charges the customer's card on file instantly"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Charge Card
                          </button>
                          <button
                            onClick={() => { setBillingAction('invoice'); setBillingResult(null); setRecurringEnabled(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            title="Sends a payment request email - client pays when ready"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Send Invoice
                          </button>
                          <button
                            onClick={() => { setBillingAction('subscription'); setBillingResult(null); setRecurringEnabled(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            title="Create a recurring subscription on the customer's card"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Subscribe
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stripe error */}
                    {stripeError && (
                      <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg mb-3">
                        <p className="text-sm text-red-400">{stripeError}</p>
                      </div>
                    )}

                    {/* Billing action form */}
                    {billingAction && (
                      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {billingAction === 'charge' ? (
                              <DollarSign className="w-4 h-4 text-white/60" />
                            ) : billingAction === 'invoice' ? (
                              <FileText className="w-4 h-4 text-white/60" />
                            ) : (
                              <RefreshCw className="w-4 h-4 text-white/60" />
                            )}
                            <h4 className="text-sm font-medium text-white">
                              {billingAction === 'charge' ? 'Charge Card' : billingAction === 'invoice' ? 'Send Invoice' : 'Create Subscription'}
                            </h4>
                          </div>
                          <button
                            onClick={() => { setBillingAction(null); setBillingError(null); setBillingAmount(''); setBillingDescription(''); setRecurringEnabled(false); setRecurringInterval('month'); setRecurringIntervalCount('1'); }}
                            className="text-sm text-white/40 hover:text-white transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        {/* Info banner explaining what will happen */}
                        <div className={cn(
                          'p-3 rounded-lg text-sm',
                          (billingAction === 'charge' && !recurringEnabled)
                            ? 'bg-yellow-900/20 border border-yellow-900/40 text-yellow-400'
                            : 'bg-gray-800/30 border border-gray-700 text-white/60'
                        )}>
                          {billingAction === 'subscription' || recurringEnabled
                            ? `A recurring subscription will be created. The customer's card will be charged every ${recurringIntervalCount === '1' ? '' : `${recurringIntervalCount} `}${recurringInterval}${parseInt(recurringIntervalCount) > 1 ? 's' : ''} automatically.`
                            : billingAction === 'charge'
                              ? 'This will immediately charge the customer\'s card on file. The payment will be processed right away.'
                              : 'This will email an invoice to the customer. They can pay at their convenience (due in 30 days).'}
                        </div>

                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <input
                            type="number"
                            value={billingAmount}
                            onChange={(e) => setBillingAmount(e.target.value)}
                            placeholder="Amount (USD)"
                            min="0.50"
                            step="0.01"
                            className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                          />
                        </div>

                        <input
                          type="text"
                          value={billingDescription}
                          onChange={(e) => setBillingDescription(e.target.value)}
                          placeholder="Description (optional)"
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                        />

                        {/* Recurring toggle (charge/invoice only) or interval picker (subscription) */}
                        {billingAction === 'subscription' ? (
                          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 space-y-2">
                            <p className="text-sm text-white/60">Billing interval</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={recurringIntervalCount}
                                onChange={(e) => setRecurringIntervalCount(e.target.value)}
                                min="1"
                                max="12"
                                className="w-16 px-2 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-white text-sm text-center focus:ring-2 focus:ring-white focus:border-white outline-none"
                              />
                              <span className="text-sm text-white/60">every</span>
                              <div className="flex gap-1">
                                {(['week', 'month', 'year'] as const).map(iv => (
                                  <button
                                    key={iv}
                                    type="button"
                                    onClick={() => setRecurringInterval(iv)}
                                    className={cn(
                                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                                      recurringInterval === iv
                                        ? 'bg-white text-black'
                                        : 'border border-gray-700 text-white/60 hover:bg-gray-700 hover:text-white'
                                    )}
                                  >
                                    {iv === 'week' ? 'Week' : iv === 'month' ? 'Month' : 'Year'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-white/60" />
                                <span className="text-sm text-white">Automate every</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setRecurringEnabled(!recurringEnabled)}
                                className={cn(
                                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0',
                                  recurringEnabled ? 'bg-white' : 'bg-gray-700'
                                )}
                              >
                                <span className={cn(
                                  'inline-block h-3 w-3 rounded-full transition-transform',
                                  recurringEnabled ? 'translate-x-5 bg-black' : 'translate-x-1 bg-gray-400'
                                )} />
                              </button>
                            </div>
                            {recurringEnabled && (
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="number"
                                  value={recurringIntervalCount}
                                  onChange={(e) => setRecurringIntervalCount(e.target.value)}
                                  min="1"
                                  max="12"
                                  className="w-16 px-2 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-white text-sm text-center focus:ring-2 focus:ring-white focus:border-white outline-none"
                                />
                                <div className="flex gap-1">
                                  {(['week', 'month', 'year'] as const).map(iv => (
                                    <button
                                      key={iv}
                                      type="button"
                                      onClick={() => setRecurringInterval(iv)}
                                      className={cn(
                                        'px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                                        recurringInterval === iv
                                          ? 'bg-white text-black'
                                          : 'border border-gray-700 text-white/60 hover:bg-gray-700 hover:text-white'
                                      )}
                                    >
                                      {iv === 'week' ? 'Week' : iv === 'month' ? 'Month' : 'Year'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {billingError && (
                          <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
                            <p className="text-sm text-red-400">{billingError}</p>
                          </div>
                        )}

                        <button
                          onClick={handleBillingAction}
                          disabled={billingLoading || !billingAmount}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                        >
                          {billingLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : billingAction === 'subscription' || recurringEnabled ? (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Start Subscription
                            </>
                          ) : billingAction === 'charge' ? (
                            <>
                              <DollarSign className="w-4 h-4" />
                              Charge Now
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Send Invoice
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Rich billing result feedback */}
                    {billingResult && (
                      <div className={cn(
                        'p-4 rounded-xl mb-3 border space-y-3',
                        billingResult.type === 'charge' && billingResult.status === 'succeeded'
                          ? 'bg-green-900/20 border-green-800'
                          : billingResult.type === 'invoice' || billingResult.type === 'subscription'
                            ? 'bg-green-900/20 border-green-800'
                            : 'bg-yellow-900/20 border-yellow-900/40'
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {billingResult.type === 'charge' ? (
                              <DollarSign className="w-4 h-4 text-green-400" />
                            ) : billingResult.type === 'subscription' ? (
                              <RefreshCw className="w-4 h-4 text-green-400" />
                            ) : (
                              <FileText className="w-4 h-4 text-green-400" />
                            )}
                            <p className="text-sm font-medium text-white">
                              {billingResult.type === 'charge'
                                ? billingResult.status === 'succeeded' ? 'Payment charged successfully' : `Charge processing (${billingResult.status})`
                                : billingResult.type === 'subscription'
                                  ? 'Subscription created successfully'
                                  : 'Invoice sent successfully'}
                            </p>
                          </div>
                          <button
                            onClick={() => setBillingResult(null)}
                            className="text-sm text-white/40 hover:text-white transition-colors cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                        <p className="text-sm text-white/60">
                          {formatAmount(billingResult.amount, 'usd')}
                          {billingResult.type === 'invoice' && ' - Due in 30 days'}
                          {billingResult.type === 'subscription' && ' - Recurring charge active'}
                        </p>
                        {/* Action links for invoice */}
                        {billingResult.invoiceUrl && (
                          <div className="flex items-center gap-2">
                            <a
                              href={billingResult.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-2 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open Invoice
                            </a>
                            <button
                              onClick={() => copyToClipboard(billingResult.invoiceUrl!)}
                              className="flex items-center gap-1.5 px-3 py-2 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                              {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedLink ? 'Copied' : 'Copy Link'}
                            </button>
                          </div>
                        )}
                        {/* Receipt link for charge */}
                        {billingResult.receiptUrl && (
                          <a
                            href={billingResult.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Receipt
                          </a>
                        )}
                      </div>
                    )}

                    {/* Stripe Customer */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">Stripe Customer</span>
                        {linkedCustomer && (
                          <button
                            onClick={handleUnlinkCustomer}
                            disabled={linkingCustomer}
                            className="text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Unlink
                          </button>
                        )}
                      </div>

                      {linkedCustomer ? (
                        <div className="flex items-center gap-3 p-3 bg-gray-800/30 border border-gray-700 rounded-lg">
                          <div className="w-8 h-8 rounded-lg bg-gray-800/30 border border-gray-700 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-white/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{linkedCustomer.name || linkedCustomer.email || linkedCustomer.id}</p>
                            {linkedCustomer.email && linkedCustomer.name && (
                              <p className="text-sm text-white/40 truncate">{linkedCustomer.email}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <SearchableSelect
                              value={selectedCustomerId}
                              onChange={setSelectedCustomerId}
                              placeholder={customersLoading ? 'Loading customers...' : 'Select a Stripe customer...'}
                              options={[
                                { value: '', label: 'Select a Stripe customer...' },
                                ...stripeCustomers.map(c => ({ value: c.id, label: c.email || c.name || c.id }))
                              ]}
                            />
                          </div>
                          <button
                            onClick={handleLinkCustomer}
                            disabled={!selectedCustomerId || linkingCustomer}
                            className="px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer shrink-0"
                          >
                            {linkingCustomer ? 'Linking...' : 'Link'}
                          </button>
                        </div>
                      )}

                      {linkedCustomer && (
                        <div className="pt-3 border-t border-gray-800">
                          <p className="text-sm text-white/40 mb-2">Change customer</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <SearchableSelect
                                value={selectedCustomerId}
                                onChange={setSelectedCustomerId}
                                placeholder="Select a Stripe customer..."
                                options={stripeCustomers.map(c => ({ value: c.id, label: c.email || c.name || c.id }))}
                              />
                            </div>
                            <button
                              onClick={handleLinkCustomer}
                              disabled={linkingCustomer}
                              className="px-3 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer shrink-0"
                            >
                              {linkingCustomer ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transaction History */}
                  <div id="transactions">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Transaction History</h3>
                      <div className="flex items-center gap-1.5">
                        {(['all', 'paid', 'pending', 'overdue'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setTxFilter(f)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-sm font-medium transition-colors cursor-pointer capitalize',
                              txFilter === f
                                ? 'bg-gray-800/30 text-white'
                                : 'text-white/40 hover:text-white/60'
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(() => {
                      const filteredTx = allTransactions.filter(tx => {
                        if (txFilter === 'all') return true;
                        const ns = tx.normalizedStatus || (tx.status === 'succeeded' ? 'paid' : tx.status === 'open' ? 'pending' : tx.status);
                        return ns === txFilter;
                      });
                      return filteredTx.length === 0 ? (
                      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center">
                        <p className="text-sm text-white/40">{txFilter === 'all' ? 'No transactions yet.' : `No ${txFilter} transactions.`}</p>
                      </div>
                    ) : (
                      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                        {filteredTx.map((tx, idx) => {
                          const nStatus = tx.normalizedStatus || (tx.status === 'succeeded' ? 'paid' : tx.status === 'open' ? 'pending' : tx.status);
                          return (
                            <div
                              key={tx.id}
                              className={cn(
                                'flex items-center gap-4 px-5 py-4',
                                idx < filteredTx.length - 1 && 'border-b border-gray-800'
                              )}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gray-800/30">
                                {tx.type === 'invoice' ? (
                                  <FileText className="w-4 h-4 text-white/40" />
                                ) : (
                                  <CreditCard className="w-4 h-4 text-white/40" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {tx.description || 'Payment'}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-sm text-white/40">{formatDate(tx.created)}</p>
                                  {statusBadge(nStatus)}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={cn(
                                  'text-sm font-semibold',
                                  nStatus === 'paid' ? 'text-green-400'
                                    : nStatus === 'pending' ? 'text-yellow-400'
                                    : nStatus === 'overdue' || nStatus === 'failed' ? 'text-red-400'
                                    : 'text-white/60'
                                )}>
                                  {formatAmount(tx.amount, tx.currency)}
                                </span>
                                {(tx.receipt_url || tx.invoice_url) && (
                                  <a
                                    href={tx.receipt_url || tx.invoice_url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                    })()}
                  </div>
                </>
              )}

              {/* Manual Payments */}
              <div id="manual">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Manual Payments</h3>
                  {!showManualForm && (
                    <button
                      onClick={() => setShowManualForm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Record Payment
                    </button>
                  )}
                </div>

                {showManualForm && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3 mb-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-white">Record External Payment</h4>
                      <button
                        onClick={() => setShowManualForm(false)}
                        className="text-sm text-white/40 hover:text-white transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-sm text-white/40">For payments received outside of Stripe (cash, bank transfer, etc.)</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                          type="number"
                          value={manualForm.amount}
                          onChange={(e) => setManualForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="Amount (USD)"
                          min="0.01"
                          step="0.01"
                          className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                        />
                      </div>
                      <input
                        type="date"
                        value={manualForm.date}
                        onChange={(e) => setManualForm(f => ({ ...f, date: e.target.value }))}
                        className="px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-white focus:border-white outline-none text-sm [color-scheme:dark]"
                      />
                    </div>

                    <SearchableSelect
                      value={manualForm.method}
                      onChange={(v) => setManualForm(f => ({ ...f, method: v }))}
                      placeholder="Payment method"
                      options={[
                        { value: 'bank_transfer', label: 'Bank Transfer' },
                        { value: 'cash', label: 'Cash' },
                        { value: 'check', label: 'Check' },
                        { value: 'crypto', label: 'Crypto' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />

                    <input
                      type="text"
                      value={manualForm.description}
                      onChange={(e) => setManualForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Description (optional)"
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                    />

                    <input
                      type="text"
                      value={manualForm.reference}
                      onChange={(e) => setManualForm(f => ({ ...f, reference: e.target.value }))}
                      placeholder="Reference / receipt # (optional)"
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                    />

                    <button
                      onClick={handleAddManualPayment}
                      disabled={manualLoading || !manualForm.amount || !manualForm.date}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                      {manualLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                      {manualLoading ? 'Saving...' : 'Record Payment'}
                    </button>
                  </div>
                )}

                {manualPayments.length > 0 && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                    {manualPayments.map((mp, idx) => (
                      <div
                        key={mp.id}
                        className={cn(
                          'flex items-center gap-4 px-5 py-4',
                          idx < manualPayments.length - 1 && 'border-b border-gray-800'
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gray-800/30">
                          <Banknote className="w-4 h-4 text-white/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {mp.description || paymentMethodLabels[mp.payment_method] || 'Manual Payment'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm text-white/40">
                              {new Date(mp.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-800/30 text-white/40 border-gray-700">
                              {paymentMethodLabels[mp.payment_method] || mp.payment_method}
                            </span>
                            {mp.reference && (
                              <span className="text-sm text-white/30">#{mp.reference}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-green-400">
                            {formatAmount(mp.amount, mp.currency)}
                          </span>
                          <button
                            onClick={() => handleDeleteManualPayment(mp.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {manualPayments.length === 0 && !showManualForm && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center">
                    <p className="text-sm text-white/40">No manual payments recorded.</p>
                  </div>
                )}
              </div>

              {/* Billing Settings - monthly expected + notes */}
              <div id="settings">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Billing Settings</h3>
                  {!showSettingsForm && (
                    <button
                      onClick={() => setShowSettingsForm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      {billingSettings?.monthly_expected_amount ? 'Edit' : 'Set Up'}
                    </button>
                  )}
                </div>

                {showSettingsForm && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3 mb-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-white">Monthly Expected Amount</h4>
                      <button
                        onClick={() => setShowSettingsForm(false)}
                        className="text-sm text-white/40 hover:text-white transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-sm text-white/40">Set how much this client should pay monthly. Outstanding amounts will show as debt.</p>

                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="number"
                        value={settingsAmount}
                        onChange={(e) => setSettingsAmount(e.target.value)}
                        placeholder="Monthly amount (USD)"
                        min="0"
                        step="1"
                        className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm"
                      />
                    </div>

                    <textarea
                      value={settingsNotes}
                      onChange={(e) => setSettingsNotes(e.target.value)}
                      placeholder="Notes about this client's billing (optional)"
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none text-sm resize-none"
                    />

                    <button
                      onClick={handleSaveBillingSettings}
                      disabled={savingSettings}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                      {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {savingSettings ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                )}

                {!showSettingsForm && billingSettings && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Monthly expected</span>
                      <span className="text-sm font-medium text-white">
                        {billingSettings.monthly_expected_amount > 0
                          ? formatAmount(billingSettings.monthly_expected_amount, 'usd')
                          : 'Not set'}
                      </span>
                    </div>
                    {billingSettings.notes && (
                      <p className="text-sm text-white/40">{billingSettings.notes}</p>
                    )}
                  </div>
                )}
              </div>

            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
