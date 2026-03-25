'use client';

/**
 * Portal Overview — Aggregated dashboard showing metrics, executions,
 * and workflows across all instances.
 */

import { useEffect, useState, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { usePortalRole } from '@/components/portal/usePortalRole';
import { usePortalInstances } from '@/components/portal/usePortalInstances';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Layers,
  PanelsTopLeft,
  X,
  MousePointer,
  FileText,
  MessageSquare,
  Link2,
  Loader2,
  Key,
  Download,
  Server,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { UnifiedSkeleton } from '@/components/ui/skeletons';
import SearchableSelect from '@/components/ui/SearchableSelect';
import SecondaryPanel, { SecondaryPanelSection } from '@/components/portal/SecondaryPanel';
import AddCredentialModal from '@/components/credentials/AddCredentialModal';
import WorkflowList from '@/components/workflows/WorkflowList';
import ExecutionDataViewer from '@/components/ExecutionDataViewer';
import { ClientPanelContent } from './[id]/content';
import { OpenClawContent, OPENCLAW_TABS_LIST } from './[id]/openclaw-content';


// =============================================================================
// Type Definitions
// =============================================================================

// Payment is a per-client concept, not per-instance - managed at /portal/clients/[id]
const INSTANCE_TABS = [
  { id: 'overview', label: 'Overview', icon: PanelsTopLeft },
  { id: 'widgets', label: 'UI Embeds', icon: Layers },
  { id: 'templates', label: 'Templates', icon: Download },
  { id: 'credentials', label: 'Credentials', icon: Key },
  { id: 'services', label: 'Services', icon: Server },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/** Workflow execution record with status and timing */
interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'success' | 'error' | 'running';
  startedAt: string;
  instanceId: string;
  instanceName: string;
  clientEmail?: string;
}

/** Credential required by a workflow node */
interface WorkflowCredential {
  type: string;
  name: string;
  /** Whether this credential is connected in the n8n instance */
  connected?: boolean;
}

/**
 * UI component (widget) that can be linked to a workflow.
 * Note: `type` comes from workflow.widgets (API response), `widget_type` from client_widgets table.
 */
interface WorkflowWidget {
  id: string;
  name: string;
  /** Widget type from API response (workflow.widgets) */
  type?: 'button' | 'form' | 'chatbot';
  /** Widget type from database (client_widgets table) */
  widget_type?: 'button' | 'form' | 'chatbot';
  form_fields?: any[];
  workflow_id?: string;
}

/** Workflow with associated credentials and widgets */
interface Workflow {
  id: string;
  name: string;
  active: boolean;
  webhookUrl?: string;
  instanceId: string;
  instanceName: string;
  clientEmail?: string;
  /** Credentials with connection status (from all-executions API) */
  credentials?: WorkflowCredential[];
  /** Required credentials (from individual instance API) */
  requiredCredentials?: WorkflowCredential[];
  /** UI components linked to this workflow */
  widgets?: WorkflowWidget[];
}

/** Simplified instance info for the "All" view dropdown */
interface AllInstance {
  instanceId: string;
  instanceName: string;
  instanceUrl: string;
  clientEmail?: string;
}

/** Aggregated execution metrics across all instances */
interface ExecutionMetrics {
  total: number;
  success: number;
  failed: number;
  running: number;
}

/** Widget item for the Assign Component modal */
interface WidgetItem {
  id: string;
  name: string;
  widget_type: 'button' | 'form' | 'chatbot';
  workflow_id?: string;
  instance_id: string;
  form_fields?: any[];
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Main portal page content component.
 * Handles all state management, data fetching, and user interactions.
 */
function PortalPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = usePortalRole();
  const { instances: portalInstances, loading: instancesLoading } = usePortalInstances();

  // Update URL without triggering Next.js navigation (avoids re-renders and navigation conflicts)
  const updateUrl = useCallback((params: URLSearchParams) => {
    const url = `/portal?${params.toString()}`;
    window.history.replaceState(window.history.state, '', url);
  }, []);

  // Instance filter for secondary panel — check URL for deep link
  const urlInstance = searchParams.get('instance');
  const [instanceFilter, setInstanceFilterState] = useState<string>(urlInstance || 'all');

  // Active tab for the selected instance (secondary panel navigation)
  const [activePortalTab, setActivePortalTab] = useState<string>(
    () => searchParams.get('tab') || 'overview'
  );

  // Listen for sidebar nav reset (when clicking Overview while already on /portal)
  useEffect(() => {
    const handleReset = () => {
      setInstanceFilterState('all');
      setActivePortalTab('overview');
    };
    window.addEventListener('portal-nav-reset', handleReset);
    return () => window.removeEventListener('portal-nav-reset', handleReset);
  }, []);

  // Sync instance selection to URL + reset modal state
  const setInstanceFilter = useCallback((id: string) => {
    setInstanceFilterState(id);
    setActivePortalTab('overview');
    // Reset modal state to prevent bleed between instances
    setAddCredentialOpen(false);
    setLinkWidgetModalOpen(false);
    setExecutionModalOpen(false);
    setSelectedWorkflow(null);
    setSelectedInstanceId(null);
    setSelectedInstanceUrl(null);
    setPreselectedCredentialType(null);

    const params = new URLSearchParams(window.location.search);
    if (id === 'all') {
      params.delete('instance');
      params.delete('tab');
    } else {
      params.set('instance', id);
      params.delete('view');
      params.delete('status');
      params.delete('tab');
    }
    updateUrl(params);
  }, [updateUrl]);

  // Clients with a single instance auto-select it; multiple instances see the "All" overview
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (roleLoading || instancesLoading || didAutoSelect.current) return;
    if (role === 'client' && instanceFilter === 'all') {
      const clientInsts = portalInstances.filter(i => i.access === 'client');
      if (clientInsts.length === 1) {
        didAutoSelect.current = true;
        setInstanceFilterState(clientInsts[0].id);
        const params = new URLSearchParams(window.location.search);
        params.set('instance', clientInsts[0].id);
        params.delete('view');
        params.delete('status');
        window.history.replaceState(window.history.state, '', `/portal?${params.toString()}`);
      }
    }
  }, [role, roleLoading, instancesLoading, portalInstances, instanceFilter]);

  // URL persistence for dashboard view and filters
  // Note: uses ?view= instead of ?tab= to avoid conflict with ClientPanelContent's ?tab= param
  const urlSubTab = searchParams.get('view') as 'executions' | 'workflows' | null;
  const urlStatus = searchParams.get('status') as 'all' | 'success' | 'error' | null;
  const validSubTabs = ['executions', 'workflows'];
  const validStatuses = ['all', 'success', 'error'];

  const [allSubTab, setAllSubTabState] = useState<'executions' | 'workflows'>(
    urlSubTab && validSubTabs.includes(urlSubTab) ? urlSubTab : 'executions'
  );
  const [emailFilter, setEmailFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // All view state
  const [allExecutions, setAllExecutions] = useState<Execution[]>([]);
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);
  const [allInstances, setAllInstances] = useState<AllInstance[]>([]);
  const [allMetrics, setAllMetrics] = useState<ExecutionMetrics | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  const [allDataFetched, setAllDataFetched] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [executionFilter, setExecutionFilterState] = useState<'all' | 'success' | 'error'>(
    urlStatus && validStatuses.includes(urlStatus) ? urlStatus : 'all'
  );


  // Workflow management state
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [togglingWorkflow, setTogglingWorkflow] = useState<string | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal state for Add Credential
  const [addCredentialOpen, setAddCredentialOpen] = useState(false);
  const [preselectedCredentialType, setPreselectedCredentialType] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedInstanceUrl, setSelectedInstanceUrl] = useState<string | null>(null);

  // Modal state for Assign Component (same as portal/[id])
  const [linkWidgetModalOpen, setLinkWidgetModalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [allWidgets, setAllWidgets] = useState<WidgetItem[]>([]);
  const [linkWidgetTab, setLinkWidgetTab] = useState<'instance' | 'linked' | 'all'>('instance');


  // Execution detail modal state
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<{
    id: string;
    workflowName: string;
    status: 'success' | 'error' | 'running';
    instanceId: string;
  } | null>(null);
  const [executionDetail, setExecutionDetail] = useState<any>(null);
  const [executionDetailLoading, setExecutionDetailLoading] = useState(false);

  // Update URL when sub tab changes (uses ?view= to avoid conflict with instance ?tab=)
  const setAllSubTab = useCallback((tab: 'executions' | 'workflows') => {
    setAllSubTabState(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('view', tab);
    updateUrl(params);
  }, [updateUrl]);

  // Update URL when execution filter changes
  const setExecutionFilter = useCallback((filter: 'all' | 'success' | 'error') => {
    setExecutionFilterState(filter);
    const params = new URLSearchParams(window.location.search);
    if (filter === 'all') {
      params.delete('status');
    } else {
      params.set('status', filter);
    }
    updateUrl(params);
  }, [updateUrl]);




  /**
   * Fetches aggregated data for the "All" view from all user's n8n instances.
   * Retrieves executions, workflows (with credential status), metrics, and widgets.
   */
  const fetchAllData = async () => {
    if (!session?.access_token) return;
    setAllLoading(true);
    setAllError(null);
    try {
      // Add timestamp for cache busting on refresh
      const res = await fetch(`/api/client/all-executions?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        let errorMsg = 'Failed to fetch data';
        try { const data = await res.json(); errorMsg = data.error || errorMsg; } catch {}
        throw new Error(errorMsg);
      }
      const data = await res.json();
      setAllExecutions(data.executions || []);
      setAllWorkflows(data.workflows || []);
      setAllInstances(data.instances || []);
      setAllMetrics(data.metrics || null);
      setAllWidgets(data.widgets || []);
    } catch (err: any) {
      setAllError(err.message);
    } finally {
      setAllLoading(false);
      setAllDataFetched(true);
    }
  };

  /** Toggles a workflow's expanded/collapsed state in the list */
  const toggleWorkflowExpanded = (workflowKey: string) => {
    setExpandedWorkflows(prev => {
      const next = new Set(prev);
      if (next.has(workflowKey)) {
        next.delete(workflowKey);
      } else {
        next.add(workflowKey);
      }
      return next;
    });
  };

  // Expand workflow card when clicking missing credentials badge (no modal in this view)
  const handleOpenMissingCredentials = (workflow: { id: string; instanceId: string }) => {
    const workflowKey = `${workflow.instanceId}:${workflow.id}`;
    // Ensure the card is expanded so user can see/click individual credentials
    setExpandedWorkflows(prev => {
      const next = new Set(prev);
      next.add(workflowKey);
      return next;
    });
  };

  /**
   * Toggles a workflow's active/inactive state via the n8n API.
   * Updates local state optimistically on success.
   */
  const handleToggleWorkflow = async (workflowId: string, instanceId: string, currentActive: boolean) => {
    if (!session?.access_token) return;
    const workflowKey = `${instanceId}:${workflowId}`;
    setTogglingWorkflow(workflowKey);
    try {
      const res = await fetch(`/api/client/workflows/${workflowId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ instanceId, active: !currentActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to toggle workflow');
      }
      // Update local state
      setAllWorkflows(prev => prev.map(wf =>
        wf.instanceId === instanceId && wf.id === workflowId
          ? { ...wf, active: !currentActive }
          : wf
      ));
      setToast({ type: 'success', message: `Workflow ${!currentActive ? 'activated' : 'deactivated'}` });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setTogglingWorkflow(null);
    }
  };

  /** Deletes a workflow from the n8n instance after user confirmation */
  const handleDeleteWorkflow = async (workflowId: string, instanceId: string) => {
    if (!session?.access_token || !confirm('Are you sure you want to delete this workflow?')) return;
    const workflowKey = `${instanceId}:${workflowId}`;
    setDeletingWorkflow(workflowKey);
    try {
      const res = await fetch(`/api/client/workflows/${workflowId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ instanceId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete workflow');
      }
      // Remove from local state
      setAllWorkflows(prev => prev.filter(wf => !(wf.instanceId === instanceId && wf.id === workflowId)));
      setToast({ type: 'success', message: 'Workflow deleted' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setDeletingWorkflow(null);
    }
  };

  /**
   * Resolves an instance URL by ID, checking both local and API data sources.
   * Used for credential and widget operations that require the n8n instance URL.
   */
  const getInstanceUrl = (instanceId: string): string | null => {
    // First check portal instances (shared hook)
    const inst = portalInstances.find(i => i.id === instanceId);
    if (inst?.instance_url) return inst.instance_url;
    // Fall back to allInstances (from All view API)
    const allInstance = allInstances.find(i => i.instanceId === instanceId);
    return allInstance?.instanceUrl || null;
  };

  /** Formats a timestamp for display in the execution modal */
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /** Fetches execution details and opens the modal */
  const handleExecutionClick = async (exec: {
    id: string;
    workflowName: string;
    status: 'success' | 'error' | 'running';
    instanceId: string;
  }) => {
    if (!session) return;

    setSelectedExecution(exec);
    setExecutionModalOpen(true);
    setExecutionDetailLoading(true);
    setExecutionDetail(null);

    try {
      const res = await fetch(
        `/api/client/executions/${exec.id}?instanceId=${exec.instanceId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setExecutionDetail(data.execution);
      } else {
        setToast({ type: 'error', message: 'Failed to fetch execution details' });
      }
    } catch (error) {
      console.error('Failed to fetch execution details:', error);
      setToast({ type: 'error', message: 'Failed to fetch execution details' });
    } finally {
      setExecutionDetailLoading(false);
    }
  };

  /** Opens the Add Credential modal with pre-selected credential type */
  const handleAddCredential = (credentialType: string, instanceId: string) => {
    const instanceUrl = getInstanceUrl(instanceId);
    setPreselectedCredentialType(credentialType);
    setSelectedInstanceId(instanceId);
    setSelectedInstanceUrl(instanceUrl);
    setAddCredentialOpen(true);
  };

  /**
   * Opens the Assign Component modal for linking a UI widget to a workflow.
   * Sets up the modal state with the selected workflow and instance context.
   */
  const openLinkWidgetModal = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setSelectedInstanceId(workflow.instanceId);
    setLinkWidgetTab('instance');
    setLinkWidgetModalOpen(true);
  };

  /**
   * Returns all widgets belonging to the currently selected instance.
   * Used to populate the "This Instance" tab in the Assign Component modal.
   */
  const getWidgetsForInstance = () => {
    if (!selectedInstanceId) return [];
    return allWidgets.filter(w => w.instance_id === selectedInstanceId);
  };

  /** Returns widgets that are already linked to a workflow in the selected instance */
  const getWidgetsInUse = () => {
    if (!selectedInstanceId) return [];
    return allWidgets.filter(w => w.instance_id === selectedInstanceId && w.workflow_id);
  };

  // Get widgets based on current tab selection
  const getLinkModalWidgets = () => {
    if (linkWidgetTab === 'linked') {
      return getWidgetsInUse();
    } else if (linkWidgetTab === 'instance') {
      return getWidgetsForInstance();
    } else if (linkWidgetTab === 'all') {
      return allWidgets;
    }
    return getWidgetsForInstance();
  };

  // Link an existing widget to the selected workflow
  const linkWidgetToWorkflow = async (widgetId: string) => {
    if (!selectedWorkflow || !session?.access_token) return;
    try {
      const res = await fetch(`/api/client/widgets/${widgetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          workflow_id: selectedWorkflow.id,
          webhook_url: selectedWorkflow.webhookUrl || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          throw new Error(data.error || 'Failed to link widget');
        } catch {
          throw new Error('Failed to link widget');
        }
      }
      setLinkWidgetModalOpen(false);
      setSelectedWorkflow(null);
      setSelectedInstanceId(null);
      setToast({ type: 'success', message: 'Component linked to workflow' });
      fetchAllData();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Handle credential creation
  const handleCredentialAdd = async (type: string, name: string, data: Record<string, any>) => {
    if (!session?.access_token || !selectedInstanceId) {
      throw new Error('No instance selected');
    }
    const res = await fetch('/api/client/credentials', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceId: selectedInstanceId,
        type,
        name,
        data,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      try {
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || 'Failed to create credential');
      } catch {
        throw new Error('Failed to create credential');
      }
    }
    setAddCredentialOpen(false);
    setPreselectedCredentialType(null);
    setSelectedInstanceId(null);
    setSelectedInstanceUrl(null);
    setToast({ type: 'success', message: 'Credential added successfully' });
    fetchAllData();
  };

  // Fetch credential schema
  const fetchCredentialSchema = async (type: string) => {
    if (!session?.access_token || !selectedInstanceId) {
      return { error: 'No instance selected' };
    }
    const res = await fetch(
      `/api/client/credentials/schema/${encodeURIComponent(type)}?instanceId=${selectedInstanceId}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return { error: data.error || 'Failed to fetch schema' };
      } catch {
        return { error: 'Failed to fetch schema' };
      }
    }
    return res.json();
  };

  // Handle unlink widget
  const handleUnlinkWidget = async (widgetId: string, instanceId: string) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`/api/client/widgets/${widgetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ workflow_id: null, instanceId }),
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          throw new Error(data.error || 'Failed to unlink widget');
        } catch {
          throw new Error('Failed to unlink widget');
        }
      }
      // Refresh data
      fetchAllData();
      setToast({ type: 'success', message: 'Component unlinked from workflow' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Get unique emails from instances for email filter
  const uniqueEmails = useMemo(() => {
    const emails = new Set<string>();
    allInstances.forEach(inst => {
      if (inst.clientEmail) emails.add(inst.clientEmail);
    });
    return Array.from(emails).sort();
  }, [allInstances]);

  // Filtered executions based on filters (instance + email + time + status)
  const filteredExecutions = useMemo(() => {
    const now = new Date();
    const timeMs = timeRange === '24h' ? 24 * 60 * 60 * 1000 :
                   timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                   30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - timeMs);

    return allExecutions.filter(exec => {
      if (instanceFilter !== 'all' && exec.instanceId !== instanceFilter) return false;
      if (executionFilter !== 'all' && exec.status !== executionFilter) return false;
      if (emailFilter !== 'all' && exec.clientEmail !== emailFilter) return false;
      if (new Date(exec.startedAt) < cutoff) return false;
      return true;
    });
  }, [allExecutions, instanceFilter, executionFilter, emailFilter, timeRange]);

  // Filtered workflows based on filters (instance + email)
  const filteredWorkflows = useMemo(() => {
    return allWorkflows.filter(wf => {
      if (instanceFilter !== 'all' && wf.instanceId !== instanceFilter) return false;
      if (emailFilter !== 'all' && wf.clientEmail !== emailFilter) return false;
      return true;
    });
  }, [allWorkflows, instanceFilter, emailFilter]);

  // Filtered metrics based on all active filters (time, instance, client)
  const displayMetrics = useMemo(() => {
    const now = new Date();
    const timeMs = timeRange === '24h' ? 24 * 60 * 60 * 1000 :
                   timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                   30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - timeMs);

    const filtered = allExecutions.filter(exec => {
      if (instanceFilter !== 'all' && exec.instanceId !== instanceFilter) return false;
      if (emailFilter !== 'all' && exec.clientEmail !== emailFilter) return false;
      if (new Date(exec.startedAt) < cutoff) return false;
      return true;
    });

    return {
      total: filtered.length,
      success: filtered.filter(e => e.status === 'success').length,
      failed: filtered.filter(e => e.status === 'error').length,
      running: filtered.filter(e => e.status === 'running').length,
    };
  }, [allExecutions, instanceFilter, emailFilter, timeRange]);

  // Active portal instances (exclude deleted and FlowEngine Cloud — those live in Hosting)
  const activePortalInstances = useMemo(() => portalInstances.filter(i => !i.deleted_at && (i as any).platform !== 'flowengine'), [portalInstances]);

  // When a client email is selected, filter the instance list to only show their instances
  const emailFilteredInstances = useMemo(() => {
    if (emailFilter === 'all') return activePortalInstances;
    const matchingIds = new Set(allInstances.filter(i => i.clientEmail === emailFilter).map(i => i.instanceId));
    return activePortalInstances.filter(i => matchingIds.has(i.id));
  }, [activePortalInstances, allInstances, emailFilter]);

  // Stable token ref to avoid effect re-triggers from session object reference changes
  const accessToken = session?.access_token;

  // Fetch All data on mount (once)
  const didFetch = useRef(false);
  useEffect(() => {
    if (accessToken && !didFetch.current) {
      didFetch.current = true;
      fetchAllData();
    }
  }, [accessToken]);

  const isInitializing = authLoading;

  // Redirect unauthenticated users (in useEffect, not render path)
  useEffect(() => {
    if (!isInitializing && !session) {
      router.push('/');
    }
  }, [isInitializing, session, router]);

  if (!isInitializing && !session) {
    return null;
  }

  // If no instances, show preview banner with link to demo
  const isPreviewMode = !isInitializing && !instancesLoading && portalInstances.length === 0;
  const showContentSkeleton = isInitializing || instancesLoading;

  // Dedicated instances can access portal too - they just can't share with clients
  // The portal/[id] page will handle showing/hiding client sharing features based on instance type

  return (
    <>
      {/* Secondary Panel — uses shared SecondaryPanel component with global search */}
      <div className="hidden md:flex">
        {showContentSkeleton ? (
          <div className="w-[280px] flex-shrink-0 h-full bg-black border-r border-gray-800 flex flex-col">
            <div className="h-[64px] border-b border-gray-800 px-3 flex items-center">
              <div className="h-9 w-full bg-gray-800/30 rounded-lg animate-pulse" />
            </div>
            <div className="px-2 space-y-1 pt-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-28 bg-gray-800/30 rounded animate-pulse" />
                    <div className="h-3 w-36 bg-gray-800/30 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SecondaryPanel
            sections={(() => {
              const sections: SecondaryPanelSection[] = [];
              if (instanceFilter !== 'all') {
                // Show tabs for the selected instance — n8n vs OpenClaw
                const selectedInst = activePortalInstances.find(i => i.id === instanceFilter);
                const st = selectedInst?.service_type;
                const isOpenClaw = st === 'openclaw';
                const isFlowEngine = (selectedInst as any)?.platform === 'flowengine';
                // FlowEngine instances don't have portal tabs — managed in Hosting
                if (!isFlowEngine) {
                  if (isOpenClaw) {
                    sections.push({
                      title: '',
                      items: OPENCLAW_TABS_LIST.map((tab) => ({
                        id: tab.id,
                        label: tab.label,
                        icon: <tab.icon className="w-4 h-4" />,
                      })),
                    });
                  } else {
                    sections.push({
                      title: '',
                      items: INSTANCE_TABS.map((tab) => ({
                        id: tab.id,
                        label: tab.label,
                        icon: <tab.icon className="w-4 h-4" />,
                      })),
                    });
                  }
                }
              } else {
                // Show instance list grouped by service type
                // Exclude FlowEngine Cloud instances — they live in Hosting, not here
                const portalManaged = emailFilteredInstances.filter(i => (i as any).platform !== 'flowengine');
                const sorted = [...portalManaged].sort((a, b) => a.instance_name.localeCompare(b.instance_name));
                const ocInsts = sorted.filter(i => (i as any).service_type === 'openclaw');
                const pendingInsts = sorted.filter(i => (i as any).status === 'pending_deploy');
                const n8nInsts = sorted.filter(i => {
                  const st = (i as any).service_type;
                  const status = (i as any).status;
                  return (st === 'n8n' || (!st && status !== 'pending_deploy'));
                });
                const n8nSectionIcon = <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5"><path clipRule="evenodd" d="M24 8.4c0 1.325-1.102 2.4-2.462 2.4-1.146 0-2.11-.765-2.384-1.8h-3.436c-.602 0-1.115.424-1.214 1.003l-.101.592a2.38 2.38 0 01-.8 1.405c.412.354.704.844.8 1.405l.1.592A1.222 1.222 0 0015.719 15h.975c.273-1.035 1.237-1.8 2.384-1.8 1.36 0 2.461 1.075 2.461 2.4S20.436 18 19.078 18c-1.147 0-2.11-.765-2.384-1.8h-.975c-1.204 0-2.23-.848-2.428-2.005l-.101-.592a1.222 1.222 0 00-1.214-1.003H10.97c-.308.984-1.246 1.7-2.356 1.7-1.11 0-2.048-.716-2.355-1.7H4.817c-.308.984-1.246 1.7-2.355 1.7C1.102 14.3 0 13.225 0 11.9s1.102-2.4 2.462-2.4c1.183 0 2.172.815 2.408 1.9h1.337c.236-1.085 1.225-1.9 2.408-1.9 1.184 0 2.172.815 2.408 1.9h.952c.601 0 1.115-.424 1.213-1.003l.102-.592c.198-1.157 1.225-2.005 2.428-2.005h3.436c.274-1.035 1.238-1.8 2.384-1.8C22.898 6 24 7.075 24 8.4zm-1.23 0c0 .663-.552 1.2-1.232 1.2-.68 0-1.23-.537-1.23-1.2 0-.663.55-1.2 1.23-1.2.68 0 1.231.537 1.231 1.2zM2.461 13.1c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm6.153 0c.68 0 1.231-.537 1.231-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm10.462 3.7c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.23.537-1.23 1.2 0 .663.55 1.2 1.23 1.2z" /></svg>;
                const ocSectionIcon = <img src="/logos/openclaw.png" className="w-3.5 h-3.5 object-contain rounded" alt="" />;
                const mapInst = (inst: typeof sorted[0]) => ({
                  id: inst.id,
                  label: inst.instance_name,
                  sublabel: inst.instance_url?.replace('https://', ''),
                  icon: (inst as any).service_type === 'openclaw'
                    ? <img src="/logos/openclaw.png" className="w-5 h-5 object-contain rounded" alt="OpenClaw" />
                    : (inst as any).service_type === 'n8n'
                      ? <img src="/logos/n8n.svg" className="w-4 h-4 object-contain" alt="n8n" style={{ filter: 'brightness(0) invert(1) opacity(0.7)' }} />
                      : <Server className="w-4 h-4" />,
                });
                if (n8nInsts.length > 0) {
                  sections.push({ title: 'n8n', icon: n8nSectionIcon, items: n8nInsts.map(mapInst) });
                }
                if (ocInsts.length > 0) {
                  sections.push({ title: 'OpenClaw', icon: ocSectionIcon, items: ocInsts.map(mapInst) });
                }
                if (pendingInsts.length > 0) {
                  sections.push({ title: 'Not deployed', icon: <Server className="w-3.5 h-3.5" />, items: pendingInsts.map(mapInst) });
                }
              }
              return sections;
            })()}
            selectedId={instanceFilter !== 'all' ? activePortalTab : undefined}
            onSelect={(id) => {
              if (instanceFilter !== 'all') {
                // Clicking Overview goes back to main instance list
                if (id === 'overview') {
                  setInstanceFilterState('all');
                  setActivePortalTab('overview');
                  window.history.replaceState(null, '', '/portal');
                  return;
                }
                // Tab selection
                setActivePortalTab(id);
                const params = new URLSearchParams(window.location.search);
                params.set('instance', instanceFilter);
                params.set('tab', id);
                updateUrl(params);
              } else {
                // Instance selection
                setInstanceFilter(id);
              }
            }}
            action={
              <div className="space-y-2">
                {role !== 'client' && uniqueEmails.length > 0 && (
                  <SearchableSelect
                    value={emailFilter}
                    onChange={setEmailFilter}
                    options={[
                      { value: 'all', label: `All Clients (${uniqueEmails.length})` },
                      ...uniqueEmails.map(email => ({ value: email, label: email })),
                    ]}
                  />
                )}
                <SearchableSelect
                  value={instanceFilter}
                  onChange={setInstanceFilter}
                  options={[
                    ...(role !== 'client' ? [{ value: 'all', label: 'All Instances' }] : []),
                    ...activePortalInstances.map(inst => ({ value: inst.id, label: inst.instance_name })),
                  ]}
                />
              </div>
            }
          />
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content area */}
        {instanceFilter !== 'all' && !showContentSkeleton ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header bar — breadcrumb */}
            <div className="flex-shrink-0 border-b border-gray-800 px-6 h-[64px] flex items-center gap-3 min-w-0">
              <button
                onClick={() => setInstanceFilter('all')}
                className="p-1.5 rounded-lg hover:bg-gray-800/30 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-lg font-semibold text-white truncate">
                {activePortalInstances.find(i => i.id === instanceFilter)?.instance_name || instanceFilter}
              </h1>
            </div>
            {/* Mobile instance dropdown */}
            <div className="md:hidden flex-shrink-0 border-b border-gray-800 px-4 py-3">
              <SearchableSelect
                value={instanceFilter}
                onChange={setInstanceFilter}
                options={[
                  ...(role !== 'client' ? [{ value: 'all', label: 'All Instances' }] : []),
                  ...activePortalInstances.map(inst => ({ value: inst.id, label: inst.instance_name })),
                ]}
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const selectedInst = activePortalInstances.find(i => i.id === instanceFilter);
                const st = selectedInst?.service_type;
                // FlowEngine Cloud instances are managed in Hosting, not here
                if ((selectedInst as any)?.platform === 'flowengine') {
                  return (
                    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
                      <div className="w-12 h-12 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center">
                        <Server className="w-6 h-6 text-white/30" />
                      </div>
                      <div>
                        <p className="text-white font-medium mb-1">{selectedInst?.instance_name}</p>
                        <p className="text-sm text-white/50">This instance is hosted on FlowEngine Cloud.<br />Manage it from the Hosting section.</p>
                      </div>
                      <Link href={`/portal/hosting/${instanceFilter}`} className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">
                        Go to Hosting
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                      </Link>
                    </div>
                  );
                }
                if (st === 'openclaw') {
                  return <OpenClawContent key={instanceFilter} instanceId={instanceFilter} externalTab={activePortalTab} onTabChange={setActivePortalTab} />;
                }
                // External instances and link-type instances → managed in Hosting
                if (selectedInst?.is_external || st === 'other') {
                  return (
                    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
                      <div className="w-12 h-12 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center">
                        <Server className="w-6 h-6 text-white/30" />
                      </div>
                      <div>
                        <p className="text-white font-medium mb-1">{selectedInst?.instance_name}</p>
                        <p className="text-sm text-white/50">This is an external instance.<br />Manage it from the Hosting section.</p>
                      </div>
                      <Link href={`/portal/hosting/${instanceFilter}`} className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">
                        Go to Hosting
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                      </Link>
                    </div>
                  );
                }
                return <ClientPanelContent key={instanceFilter} instanceId={instanceFilter} portalEmbedded externalTab={activePortalTab} onTabChange={setActivePortalTab} />;
              })()}
            </div>
          </div>
        ) : (
          <>
          {/* Dashboard header — title only */}
          <div className="flex-shrink-0 border-b border-gray-800 px-6 h-[64px] flex items-center">
            <h1 className="text-lg font-semibold text-white">Overview</h1>
          </div>
          {/* Sub-header — mobile instance dropdown */}
          <div className="md:hidden flex-shrink-0 border-b border-gray-800 px-6 py-3 flex items-center">
            <SearchableSelect
              value={instanceFilter}
              onChange={setInstanceFilter}
              options={[
                ...(role !== 'client' ? [{ value: 'all', label: 'All Instances' }] : []),
                ...activePortalInstances.map(inst => ({ value: inst.id, label: inst.instance_name })),
              ]}
            />
          </div>
          <div className="flex-1 overflow-y-auto bg-black px-4 py-4 md:px-6 md:py-8 relative">
            <div className="w-full max-w-6xl mx-auto relative z-10">

        {/* Empty state notice */}
        {isPreviewMode && !showContentSkeleton && (
          <div className="flex items-center gap-3 p-4 mb-6 bg-gray-900/50 border border-gray-800 rounded-xl">
            <Server className="w-5 h-5 text-white/40 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">No instances configured</p>
              <p className="text-sm text-white/60">Head to Hosting to deploy or connect your first instance.</p>
            </div>
            <Link
              href="/portal/hosting"
              className="px-3 py-1.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              Go to Hosting
            </Link>
          </div>
        )}

        {/* Content */}
        {(
          <>
        {/* Content */}
        {showContentSkeleton ? (
          <UnifiedSkeleton count={4} />
        ) : (
          /* All - Overview style */
          <div className="space-y-6">
            {allError ? (
              <div className="flex items-start gap-3 p-4 bg-gray-800/30 border border-gray-700 rounded-xl">
                <Activity className="h-5 w-5 text-white/50 flex-shrink-0" />
                <div>
                  <p className="text-white/50 text-sm font-medium">Unable to load data</p>
                  <p className="text-white/40 text-sm mt-1">{allError}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Filter Bar - Compact row */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {/* Left: Filters */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Executions/Workflows Tabs */}
                      <div className="flex items-center gap-0.5 bg-gray-800/30 rounded-lg p-0.5">
                        <button
                          onClick={() => setAllSubTab('executions')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                            allSubTab === 'executions'
                              ? 'bg-white text-black'
                              : 'text-gray-400 hover:text-white'
                          )}
                        >
                          <Activity className="h-3.5 w-3.5" />
                          Executions
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                            allSubTab === 'executions' ? 'bg-black/10' : 'bg-gray-700'
                          )}>
                            {allLoading || !allDataFetched ? '-' : filteredExecutions.length}
                          </span>
                        </button>
                        <button
                          onClick={() => setAllSubTab('workflows')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                            allSubTab === 'workflows'
                              ? 'bg-white text-black'
                              : 'text-gray-400 hover:text-white'
                          )}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Workflows
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                            allSubTab === 'workflows' ? 'bg-black/10' : 'bg-gray-700'
                          )}>
                            {allLoading || !allDataFetched ? '-' : filteredWorkflows.length}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Right: Time Range + Refresh */}
                    <div className="flex items-center gap-2">
                      {/* Time Range */}
                      <div className="flex items-center gap-0.5 bg-gray-800/30 rounded-lg p-0.5">
                        {(['24h', '7d', '30d'] as const).map((range) => (
                          <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={cn(
                              'px-2.5 py-1 text-sm font-medium rounded-md transition-all',
                              timeRange === range
                                ? 'bg-white text-black'
                                : 'text-gray-500 hover:text-white'
                            )}
                          >
                            {range}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => fetchAllData()}
                        disabled={allLoading}
                        className="p-1.5 text-gray-400 hover:text-white bg-gray-800/80 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", allLoading && "animate-spin")} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-white/40" />
                      <span className="text-white/40 text-sm">Total</span>
                    </div>
                    {allLoading || !allDataFetched ? (
                      <div className="h-7 w-12 bg-gray-800/30 rounded animate-pulse" />
                    ) : (
                      <p className="text-white font-semibold text-lg">{displayMetrics?.total || 0}</p>
                    )}
                  </div>
                  <div
                    className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-green-800 transition-colors"
                    onClick={() => setExecutionFilter('success')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-green-400/60" />
                      <span className="text-white/40 text-sm">Success</span>
                    </div>
                    {allLoading || !allDataFetched ? (
                      <div className="h-7 w-12 bg-gray-800/30 rounded animate-pulse" />
                    ) : (
                      <p className="text-green-400 font-semibold text-lg">{displayMetrics?.success || 0}</p>
                    )}
                  </div>
                  <div
                    className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-red-800 transition-colors"
                    onClick={() => setExecutionFilter('error')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-4 w-4 text-red-400/60" />
                      <span className="text-white/40 text-sm">Failed</span>
                    </div>
                    {allLoading || !allDataFetched ? (
                      <div className="h-7 w-12 bg-gray-800/30 rounded animate-pulse" />
                    ) : (
                      <p className="text-red-400 font-semibold text-lg">{displayMetrics?.failed || 0}</p>
                    )}
                  </div>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-white/40" />
                      <span className="text-white/40 text-sm">Running</span>
                    </div>
                    {allLoading || !allDataFetched ? (
                      <div className="h-7 w-12 bg-gray-800/30 rounded animate-pulse" />
                    ) : (
                      <p className="text-yellow-400 font-semibold text-lg">{displayMetrics?.running || 0}</p>
                    )}
                  </div>
                </div>

                {/* Executions Tab Content */}
                {allSubTab === 'executions' && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                    {/* Status Filter Bar */}
                    <div className="flex items-center gap-1 p-2 bg-gray-900/50 border-b border-gray-800">
                      <button
                        onClick={() => setExecutionFilter('all')}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                          executionFilter === 'all'
                            ? 'bg-white text-black'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        )}
                      >
                        All ({allLoading || !allDataFetched ? '-' : displayMetrics?.total || 0})
                      </button>
                      <button
                        onClick={() => setExecutionFilter('success')}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5',
                          executionFilter === 'success'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                        )}
                      >
                        <CheckCircle className="h-3 w-3" />
                        Success ({allLoading || !allDataFetched ? '-' : displayMetrics?.success || 0})
                      </button>
                      <button
                        onClick={() => setExecutionFilter('error')}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5',
                          executionFilter === 'error'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                        )}
                      >
                        <XCircle className="h-3 w-3" />
                        Errors ({allLoading || !allDataFetched ? '-' : displayMetrics?.failed || 0})
                      </button>
                      {!allLoading && allDataFetched && displayMetrics?.running > 0 && (
                        <span className="px-2 py-1 text-sm text-yellow-400 bg-gray-800/30 rounded-lg flex items-center gap-1">
                          <Clock className="h-3 w-3 animate-pulse" />
                          {displayMetrics.running} running
                        </span>
                      )}
                    </div>

                    {/* Execution List */}
                    <div className="p-3">
                      {allLoading || !allDataFetched ? (
                        <UnifiedSkeleton count={5} />
                      ) : filteredExecutions.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 rounded-2xl bg-gray-800/30 flex items-center justify-center mx-auto mb-4">
                            {executionFilter === 'error' ? (
                              <XCircle className="h-8 w-8 text-gray-500" />
                            ) : executionFilter === 'success' ? (
                              <CheckCircle className="h-8 w-8 text-gray-500" />
                            ) : (
                              <Activity className="h-8 w-8 text-gray-500" />
                            )}
                          </div>
                          <p className="text-gray-400 font-medium">
                            {executionFilter === 'error' ? 'No failed executions' :
                             executionFilter === 'success' ? 'No successful executions' :
                             allInstances.length === 0 && portalInstances.length > 0 ? 'Please add your n8n API key' :
                             'No executions yet'}
                          </p>
                          <p className="text-gray-500 text-base mt-1">
                            {executionFilter !== 'all' ? 'Try changing the filter' : 
                             allInstances.length === 0 && portalInstances.length > 0 ? 'Add API key in portal settings to view executions' :
                             'Run a workflow to see activity here'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                          {filteredExecutions.slice(0, 50).map((exec, index) => (
                            <motion.div
                              key={`${exec.instanceId}-${exec.id}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.02 }}
                              className="flex items-center gap-4 p-4 bg-gray-800/30 rounded-xl hover:bg-gray-800/30 transition-all group cursor-pointer"
                              onClick={() => handleExecutionClick({
                                id: exec.id,
                                workflowName: exec.workflowName || 'Workflow Execution',
                                status: exec.status,
                                instanceId: exec.instanceId,
                              })}
                            >
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                exec.status === 'success' ? 'bg-green-500/20' :
                                exec.status === 'error' ? 'bg-red-500/20' : 'bg-gray-800/30'
                              )}>
                                {exec.status === 'success' ? (
                                  <CheckCircle className="h-5 w-5 text-green-400" />
                                ) : exec.status === 'error' ? (
                                  <XCircle className="h-5 w-5 text-red-400" />
                                ) : (
                                  <Clock className="h-5 w-5 text-yellow-400 animate-pulse" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{exec.workflowName || 'Workflow Execution'}</p>
                                <p className="text-gray-500 text-base truncate">{exec.instanceName}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className={cn(
                                  'inline-block px-2.5 py-1 text-sm font-medium rounded-full mb-1',
                                  exec.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                  exec.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-900/20 text-yellow-400'
                                )}>
                                  {exec.status === 'success' ? 'Success' : exec.status === 'error' ? 'Failed' : 'Running'}
                                </span>
                                <p className="text-gray-500 text-base">{new Date(exec.startedAt).toLocaleString()}</p>
                              </div>
                              {/* n8n Direct Link */}
                              {(() => {
                                const instanceUrl = getInstanceUrl(exec.instanceId);
                                if (!instanceUrl) return null;
                                return (
                                  <a
                                    href={`${instanceUrl.replace(/\/$/, '')}/workflow/${exec.workflowId}/executions/${exec.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all flex-shrink-0"
                                    title="Open in n8n"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <svg
                                      fill="currentColor"
                                      fillRule="evenodd"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-4 w-4"
                                    >
                                      <title>n8n</title>
                                      <path d="M24 8.4c0 1.325-1.102 2.4-2.462 2.4-1.146 0-2.11-.765-2.384-1.8h-3.436c-.602 0-1.115.424-1.214 1.003l-.101.592a2.38 2.38 0 01-.8 1.405c.412.354.704.844.8 1.405l.1.592A1.222 1.222 0 0015.719 15h.975c.273-1.035 1.237-1.8 2.384-1.8 1.36 0 2.461 1.075 2.461 2.4S20.436 18 19.078 18c-1.147 0-2.11-.765-2.384-1.8h-.975c-1.204 0-2.23-.848-2.428-2.005l-.101-.592a1.222 1.222 0 00-1.214-1.003H10.97c-.308.984-1.246 1.7-2.356 1.7-1.11 0-2.048-.716-2.355-1.7H4.817c-.308.984-1.246 1.7-2.355 1.7C1.102 14.3 0 13.225 0 11.9s1.102-2.4 2.462-2.4c1.183 0 2.172.815 2.408 1.9h1.337c.236-1.085 1.225-1.9 2.408-1.9 1.184 0 2.172.815 2.408 1.9h.952c.601 0 1.115-.424 1.213-1.003l.102-.592c.198-1.157 1.225-2.005 2.428-2.005h3.436c.274-1.035 1.238-1.8 2.384-1.8C22.898 6 24 7.075 24 8.4zm-1.23 0c0 .663-.552 1.2-1.232 1.2-.68 0-1.23-.537-1.23-1.2 0-.663.55-1.2 1.23-1.2.68 0 1.231.537 1.231 1.2zM2.461 13.1c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm6.153 0c.68 0 1.231-.537 1.231-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.231.537-1.231 1.2 0 .663.55 1.2 1.23 1.2zm10.462 3.7c.68 0 1.23-.537 1.23-1.2 0-.663-.55-1.2-1.23-1.2-.68 0-1.23.537-1.23 1.2 0 .663.55 1.2 1.23 1.2z" />
                                    </svg>
                                  </a>
                                );
                              })()}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Workflows Tab Content */}
                {allSubTab === 'workflows' && (
                  <div className="space-y-3">
                    {allLoading || !allDataFetched ? (
                      <UnifiedSkeleton count={6} />
                    ) : filteredWorkflows.length === 0 ? (
                      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-800/30 flex items-center justify-center mx-auto mb-4">
                          <Layers className="h-8 w-8 text-gray-500" />
                        </div>
                        <p className="text-gray-400 font-medium">
                          {allInstances.length === 0 && portalInstances.length > 0 ? 'Please add your n8n API key' : 'No workflows yet'}
                        </p>
                        <p className="text-gray-500 text-base mt-1">
                          {allInstances.length === 0 && portalInstances.length > 0 ? 'Add API key in portal settings to view workflows' : 'Create a workflow in n8n to see it here'}
                        </p>
                      </div>
                    ) : (
                      <WorkflowList
                        workflows={filteredWorkflows}
                        showInstance={true}
                        expandedWorkflows={expandedWorkflows}
                        togglingWorkflow={togglingWorkflow}
                        deletingWorkflow={deletingWorkflow}
                        onToggleExpand={toggleWorkflowExpanded}
                        onToggleWorkflow={handleToggleWorkflow}
                        onDeleteWorkflow={handleDeleteWorkflow}
                        onAddComponent={openLinkWidgetModal}
                        onAddCredential={handleAddCredential}
                        onOpenMissingCredentials={handleOpenMissingCredentials}
                        onUnlinkWidget={handleUnlinkWidget}
                        linkToPortal={true}
                        showN8nLink={true}
                        getInstanceUrl={getInstanceUrl}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
          </>
        )}
            </div>
          </div>
          </>
        )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              'fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg z-[200]',
              toast.type === 'success' ? 'bg-green-900/90 border border-green-800 text-green-400' : 'bg-red-900/90 border border-red-800 text-red-400'
            )}
            onAnimationComplete={() => {
              setTimeout(() => setToast(null), 3000);
            }}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Credential Modal */}
      <AddCredentialModal
        isOpen={addCredentialOpen}
        onClose={() => {
          setAddCredentialOpen(false);
          setPreselectedCredentialType(null);
          setSelectedInstanceId(null);
          setSelectedInstanceUrl(null);
        }}
        onAdd={handleCredentialAdd}
        fetchSchema={fetchCredentialSchema}
        preselectedType={preselectedCredentialType}
        instanceUrl={selectedInstanceUrl || undefined}
        instanceId={selectedInstanceId || undefined}
        accessToken={session?.access_token}
      />

      {/* Assign Component Modal (same as portal/[id]) */}
      <AnimatePresence>
        {linkWidgetModalOpen && selectedWorkflow && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 z-[100]"
              onClick={() => { setLinkWidgetModalOpen(false); setSelectedWorkflow(null); setSelectedInstanceId(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-lg bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-medium text-white">Assign Component</h2>
                      <p className="text-sm text-white/60 mt-1">
                        for <span className="text-white">{selectedWorkflow.name}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => { setLinkWidgetModalOpen(false); setSelectedWorkflow(null); setSelectedInstanceId(null); }}
                      className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Widget Tabs */}
                <div className="px-6 pt-4">
                  <div className="flex gap-1 p-1 bg-gray-800/30 border border-gray-700 rounded-xl w-fit">
                    {[
                      { id: 'instance', label: 'This Instance', count: getWidgetsForInstance().length },
                      { id: 'linked', label: 'Linked', count: getWidgetsInUse().length },
                      { id: 'all', label: 'All', count: allWidgets.length },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setLinkWidgetTab(tab.id as typeof linkWidgetTab)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                          linkWidgetTab === tab.id
                            ? 'bg-white text-black'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                        )}
                      >
                        {tab.label}
                        <span className={cn(
                          'px-1.5 py-0.5 text-[10px] rounded-full',
                          linkWidgetTab === tab.id
                            ? 'bg-black/20 text-black'
                            : 'bg-gray-700 text-gray-500'
                        )}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 max-h-[50vh] overflow-y-auto">
                  {getLinkModalWidgets().length > 0 ? (
                    <div className="space-y-3">
                      {getLinkModalWidgets().map((widget) => (
                        <button
                          key={widget.id}
                          onClick={() => linkWidgetToWorkflow(widget.id)}
                          className="w-full flex items-center gap-4 p-4 bg-gray-800/30 border border-gray-700 hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl text-left transition-all"
                        >
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            widget.widget_type === 'button'
                              ? 'bg-gray-800/30'
                              : widget.widget_type === 'chatbot'
                              ? 'bg-purple-500/20'
                              : 'bg-gray-800/30'
                          )}>
                            {widget.widget_type === 'button' ? (
                              <MousePointer className="h-5 w-5 text-white/60" />
                            ) : widget.widget_type === 'chatbot' ? (
                              <MessageSquare className="h-5 w-5 text-purple-400" />
                            ) : (
                              <FileText className="h-5 w-5 text-white/60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{widget.name}</p>
                            <p className="text-gray-500 text-base">
                              {widget.widget_type === 'button' ? 'Button' : widget.widget_type === 'chatbot' ? 'Chatbot' : 'Form'}
                            </p>
                          </div>
                          <Link2 className="h-5 w-5 text-gray-500" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-800/30 border border-gray-700 flex items-center justify-center">
                        <FileText className="w-7 h-7 text-gray-500" />
                      </div>
                      <p className="text-white/60 text-base">No UI components found</p>
                      <p className="text-gray-500 text-base mt-1">
                        {linkWidgetTab === 'linked' ? 'No UI components are currently linked to workflows' : 'Create UI components in the client portal first'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* Execution Detail Modal */}
      <AnimatePresence>
        {executionModalOpen && selectedExecution && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setExecutionModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    selectedExecution.status === 'success' ? 'bg-green-500/20' :
                    selectedExecution.status === 'error' ? 'bg-red-500/20' : 'bg-gray-800/30'
                  )}>
                    {selectedExecution.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : selectedExecution.status === 'error' ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{selectedExecution.workflowName}</h3>
                    <p className="text-gray-500 text-base">Execution #{selectedExecution.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setExecutionModalOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                {executionDetailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : executionDetail ? (
                  <div className="space-y-4">
                    {/* Status & Timing */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                        <p className="text-gray-500 text-base mb-1">Status</p>
                        <p className={cn(
                          'text-sm font-medium',
                          executionDetail.status === 'success' ? 'text-green-400' :
                          executionDetail.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                        )}>
                          {executionDetail.status === 'success' ? 'Success' :
                           executionDetail.status === 'error' ? 'Failed' : 'Running'}
                        </p>
                      </div>
                      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                        <p className="text-gray-500 text-base mb-1">Started</p>
                        <p className="text-white text-sm">{formatTimestamp(executionDetail.startedAt)}</p>
                      </div>
                    </div>

                    {/* Error Message */}
                    {executionDetail.error && (
                      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                        <p className="text-red-400 text-sm font-medium mb-1">Error</p>
                        <p className="text-red-300 text-sm">{executionDetail.error}</p>
                      </div>
                    )}

                    {/* Input/Output Data Viewer */}
                    {(executionDetail.output || executionDetail.input) && (
                      <ExecutionDataViewer
                        input={executionDetail.input}
                        output={executionDetail.output}
                        executionId={selectedExecution?.id}
                      />
                    )}

                    {/* Node Outputs (collapsible) */}
                    {executionDetail.nodeOutputs && Object.keys(executionDetail.nodeOutputs).length > 0 && (
                      <div>
                        <p className="text-gray-400 text-sm font-medium mb-2">Node Outputs</p>
                        <div className="space-y-2">
                          {Object.entries(executionDetail.nodeOutputs).map(([nodeName, output]) => (
                            <details key={nodeName} className="bg-gray-800/30 border border-gray-700 rounded-lg">
                              <summary className="px-4 py-2 cursor-pointer text-white/60 text-sm hover:text-white">
                                {nodeName}
                              </summary>
                              <div className="px-4 pb-3 pt-1">
                                <pre className="text-gray-400 text-xs whitespace-pre-wrap break-words overflow-x-auto">
                                  {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                                </pre>
                              </div>
                            </details>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No output message */}
                    {!executionDetail.output && !executionDetail.error && (
                      <div className="text-center py-8">
                        <p className="text-gray-500 text-base">No output data available</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Failed to load execution details</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    </>
  );
}

export default function PortalPage() {
  return (
    <ErrorBoundary
      fallbackTitle="Portal Error"
      fallbackMessage="Something went wrong loading the portal. Please try again."
    >
      <Suspense fallback={
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-gray-800 px-6 h-[64px] flex items-center">
            <h1 className="text-lg font-semibold text-white">Overview</h1>
          </div>
          <div className="flex-1 overflow-y-auto bg-black px-6 py-8">
            <div className="w-full max-w-6xl mx-auto">
              <UnifiedSkeleton count={4} />
            </div>
          </div>
        </div>
      }>
        <PortalPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
