'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Users,
  Zap,
  Key,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Send,
  AlertTriangle,
  Copy,
  Check,
  X,
  Pencil,
  Link2,
  Code,
  MousePointer,
  FileText,
  Layers,
  Settings,
  Activity,
  ChevronRight,
  ChevronDown,
  Palette,
  Type,
  ToggleLeft,
  Share2,
  Download,
  CreditCard,
  DollarSign,
  Unlink,
  Search,
  MoreHorizontal,
  Tag,
  MessageSquare,
  Filter,
  AlertCircle,
  Archive,
  ArchiveRestore,
  Loader2,
  Table2,
  Braces,
  List,
  HelpCircle,
  Server,
  QrCode,
  Globe,
} from 'lucide-react';
import CredentialIcon from '@/components/credentials/CredentialIcon';
import TemplatePicker from '@/components/widgets/TemplatePicker';
import WidgetPreviewModal from '@/components/widgets/WidgetPreviewModal';
import TemplateDetailModal from '@/components/templates/TemplateDetailModal';
import TemplateUpdateModal from '@/components/templates/TemplateUpdateModal';
import TemplateUpdatesListModal from '@/components/templates/TemplateUpdatesListModal';
import TemplateUpdatesSection, { type TemplateUpdate } from '@/components/templates/TemplateUpdatesSection';
import AddCredentialModal from '@/components/credentials/AddCredentialModal';
import MissingCredentialsModal from '@/components/templates/MissingCredentialsModal';
import CredentialParameterModal from '@/components/credentials/CredentialParameterModal';
import { CredentialsTab, TemplatesTab } from '@/components/instance/tabs';
import { getCredentialParams, hasConfigurableParams, type CredentialParamInfo } from '@/lib/n8n/credentialNodeParams';
import { cn } from '@/lib/utils';
import { useAgencyLogo } from '@/hooks/useAgencyLogo';
import ExecutionDataViewer from '@/components/ExecutionDataViewer';
import { UnifiedSkeleton } from '@/components/ui/skeletons';
import WorkflowList, { type Workflow as WorkflowListItem, type WorkflowTemplateUpdate as WLTemplateUpdate, type ConnectedCredential } from '@/components/workflows/WorkflowList';

interface InstanceInfo {
  id: string;
  instance_name: string;
  instance_url: string;
  status: string;
  storage_limit_gb: number;
  n8n_api_key: string | null;
  is_external?: boolean;
}

interface ClientInfo {
  user_id?: string;
  email: string;
  status: 'pending' | 'accepted';
  invite_id: string;
  created_at: string;
}

interface Widget {
  id: string;
  name: string;
  widget_type: 'button' | 'form' | 'chatbot';
  webhook_url: string;
  form_fields: any[];
  chatbot_config?: any;
  styles?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    buttonText?: string;
    inputBorderColor?: string;
    inputBackgroundColor?: string;
  } | null;
  is_active: boolean;
  workflow_id?: string;
  workflow_name?: string;
  instance_id?: string;
  instance?: {
    id: string;
    instance_name: string;
    client_email?: string | null;
  };
}

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST';
  requiredCredentials?: Array<{ type: string; name: string }>;
  archived?: boolean;
}

interface Execution {
  id: string;
  workflowName: string;
  workflowId?: string;
  status: 'success' | 'error' | 'running';
  startedAt: string;
}

interface ExecutionMetrics {
  total: number;
  success: number;
  failed: number;
  running: number;
}

interface FormField {
  name: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
  instance_id?: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  widget_type: 'button' | 'form' | 'chatbot';
  form_fields: FormField[] | null;
  chatbot_config?: any;
  default_webhook_path: string | null;
  category_id: string | null;
  category: Category | null;
  instance_id: string | null;
  instance: {
    id: string;
    instance_name: string;
  } | null;
}

interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
}

interface Transaction {
  id: string;
  type: 'payment' | 'invoice';
  amount: number;
  currency: string;
  status: string;
  description: string;
  created: number;
  receiptUrl?: string | null;
  invoiceUrl?: string | null;
  pdfUrl?: string | null;
}

interface PaymentInfo {
  stripeConnected: boolean;
  isAgency: boolean;
  customerId: string | null;
  customer: StripeCustomer | null;
  transactions: Transaction[];
}

// Workflow Templates & Credentials interfaces
interface CredentialStatus {
  type: string;
  name: string;
  icon: string;
  status: 'available' | 'missing';
  docUrl?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  agency_name: string;
  required_credentials: CredentialStatus[];
  can_import: boolean;
  import_count: number;
  created_at: string;
  updated_at?: string;
  version?: number;
  changelog?: string | null;
}

interface N8nCredential {
  id: string;
  name: string;
  type: string;
  createdAt?: string;
  docUrl?: string;
}

// SECURITY: Validate logo URL before rendering to prevent XSS
function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * ClientPanelContent — the full instance management UI.
 * When embedded=true, background effects, preview banner, and header are hidden
 * so it fits cleanly inside the portal three-column layout.
 */
export function ClientPanelContent({ instanceId, embedded = false, portalEmbedded = false, externalTab, onTabChange, backUrl }: { instanceId: string; embedded?: boolean; portalEmbedded?: boolean; externalTab?: string; onTabChange?: (tab: string) => void; backUrl?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const { logoUrl: agencyLogoUrl } = useAgencyLogo();

  // Preview mode - show full UI but redirect actions to pricing
  const isPreviewMode = searchParams.get('preview') === 'true' && instanceId === 'demo';

  // Demo mode popup state
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const [loading, setLoading] = useState(false); // Render immediately, no blocking
  const [initialLoadComplete, setInitialLoadComplete] = useState(false); // Track if we've fetched data
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetrics | null>(null);
  // Tab URL persistence - read from URL params
  const urlTab = searchParams.get('tab');
  const validTabs = ['overview', 'widgets', 'templates', 'credentials', 'services', 'payment', 'settings'] as const;
  type TabType = typeof validTabs[number];

  const getInitialTab = (): TabType => {
    if (urlTab && validTabs.includes(urlTab as TabType)) {
      return urlTab as TabType;
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [tabInitialized, setTabInitialized] = useState(false);

  // Workflow Templates state
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [workflowTemplatesLoading, setWorkflowTemplatesLoading] = useState(false);
  const [workflowTemplatesLoaded, setWorkflowTemplatesLoaded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [templateDetailOpen, setTemplateDetailOpen] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [importingTemplateId, setImportingTemplateId] = useState<string | null>(null);

  // Template Updates state
  const [templateUpdates, setTemplateUpdates] = useState<TemplateUpdate[]>([]);
  const [templateUpdatesLoading, setTemplateUpdatesLoading] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<TemplateUpdate | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updatesListModalOpen, setUpdatesListModalOpen] = useState(false);

  // Credentials state
  const [credentials, setCredentials] = useState<N8nCredential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  const [credentialsWarning, setCredentialsWarning] = useState<string | null>(null);
  const [addCredentialOpen, setAddCredentialOpen] = useState(false);
  const [preselectedCredentialType, setPreselectedCredentialType] = useState<string | null>(null);

  // Missing credentials modal state (after import)
  const [missingCredsModalOpen, setMissingCredsModalOpen] = useState(false);
  const [missingCredsWorkflowName, setMissingCredsWorkflowName] = useState('');
  const [missingCredsList, setMissingCredsList] = useState<Array<{ type: string; name: string; icon: string }>>([]);
  const [addedCredTypes, setAddedCredTypes] = useState<string[]>([]);

  // Credential parameter modal state
  const [credentialParamOpen, setCredentialParamOpen] = useState(false);
  const [selectedCredentialParam, setSelectedCredentialParam] = useState<CredentialParamInfo | null>(null);
  const [credentialParamWorkflow, setCredentialParamWorkflow] = useState<Workflow | null>(null);

  // Workflow collapse state (tracks which workflows are expanded)
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());

  // Workflow archive state and view tab
  const [workflowViewTab, setWorkflowViewTab] = useState<'active' | 'archived'>('active');
  const [archivedWorkflows, setArchivedWorkflows] = useState<Workflow[]>([]);
  const [archivedWorkflowsLoading, setArchivedWorkflowsLoading] = useState(false);
  const [archivedWorkflowsFetched, setArchivedWorkflowsFetched] = useState(false);
  const [archivingWorkflow, setArchivingWorkflow] = useState<string | null>(null);
  const [workflowMenuOpen, setWorkflowMenuOpen] = useState<string | null>(null);
  const [workflowMenuPosition, setWorkflowMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const [apiKey, setApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);
  const [apiVerified, setApiVerified] = useState<boolean | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showExternalInput, setShowExternalInput] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesFetched, setTemplatesFetched] = useState(false);
  const [savingWidget, setSavingWidget] = useState(false);
  const [deletingWidget, setDeletingWidget] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [togglingWorkflow, setTogglingWorkflow] = useState<string | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<string | null>(null);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState(false);
  const [executionsLoading, setExecutionsLoading] = useState(true);
  const [executionsError, setExecutionsError] = useState<string | null>(null);
  const [executionFilter, setExecutionFilter] = useState<'all' | 'success' | 'error'>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all'); // 'all' or specific workflowId
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [widgetsLoading, setWidgetsLoading] = useState(true);

  // Widget editing state
  const [editingWidgetName, setEditingWidgetName] = useState('');
  const [savingWidgetName, setSavingWidgetName] = useState(false);

  /**
   * UI Components Tab/Filter System (2-level hierarchy)
   *
   * LEVEL 1 - TABS (for agency/owner only, clients see only their components):
   *   - "This Client" (default): Components assigned to this specific client/instance
   *   - "All": All agency components (client cannot see this tab)
   *
   * LEVEL 2 - FILTERS (shown under each tab for agency/owner):
   *   - "All": Show all components in current tab
   *   - "Linked": Only components linked to a workflow
   *   - "Not Linked": Only components not linked to any workflow
   */
  const [widgetTab, setWidgetTab] = useState<'instance' | 'all'>('instance');
  const [linkedFilter, setLinkedFilter] = useState<'all' | 'linked' | 'not-linked'>('all');
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [linkWidgetModalOpen, setLinkWidgetModalOpen] = useState(false);
  const [linkWidgetTab, setLinkWidgetTab] = useState<'in-use' | 'instance' | 'all'>('instance');
  const [isOwner, setIsOwner] = useState(false);
  const [isAgencyManager, setIsAgencyManager] = useState(false);
  const [isDedicated, setIsDedicated] = useState(false);
  const [instanceCategory, setInstanceCategory] = useState<{ id: string; name: string } | null>(null);
  const [allAgencyWidgets, setAllAgencyWidgets] = useState<Widget[]>([]);
  const [widgetSearch, setWidgetSearch] = useState('');
  const [widgetMenuOpen, setWidgetMenuOpen] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [workflowPickerWidget, setWorkflowPickerWidget] = useState<Widget | null>(null);

  // Services tab state
  const [servicesWhatsApp, setServicesWhatsApp] = useState<{ id: string; instance_name: string; display_name: string | null; phone_number: string | null; status: string }[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [linkWhatsAppOpen, setLinkWhatsAppOpen] = useState(false);
  const [availableWhatsApp, setAvailableWhatsApp] = useState<{ id: string; instance_name: string; display_name: string | null; phone_number: string | null; status: string }[]>([]);
  const [loadingAvailableWA, setLoadingAvailableWA] = useState(false);
  const [linkingWA, setLinkingWA] = useState(false);

  // Payment state
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentFetched, setPaymentFetched] = useState(false);
  const [availableCustomers, setAvailableCustomers] = useState<StripeCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [linkingCustomer, setLinkingCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [copiedClientUrl, setCopiedClientUrl] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Toast state for error/success messages
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Execution detail modal state
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<{
    id: string;
    workflowName: string;
    status: 'success' | 'error' | 'running';
  } | null>(null);
  const [executionDetail, setExecutionDetail] = useState<any>(null);
  const [executionDetailLoading, setExecutionDetailLoading] = useState(false);

  // Searchable workflow filter state
  const [workflowSearchQuery, setWorkflowSearchQuery] = useState('');
  const [workflowDropdownOpen, setWorkflowDropdownOpen] = useState(false);

  // Compute missing credentials from workflows
  const missingCredentials = useMemo(() => {
    const userCredTypes = new Set(credentials.map(c => c.type));
    const missingByType = new Map<string, { type: string; name: string; workflows: Map<string, { id: string; name: string }> }>();

    workflows.forEach(workflow => {
      (workflow.requiredCredentials || []).forEach(reqCred => {
        if (reqCred.type !== 'none' && reqCred.type !== 'flowEngineApi' && !userCredTypes.has(reqCred.type)) {
          const existing = missingByType.get(reqCred.type);
          if (existing) {
            if (!existing.workflows.has(workflow.id)) {
              existing.workflows.set(workflow.id, { id: workflow.id, name: workflow.name });
            }
          } else {
            missingByType.set(reqCred.type, {
              type: reqCred.type,
              name: reqCred.name,
              workflows: new Map([[workflow.id, { id: workflow.id, name: workflow.name }]])
            });
          }
        }
      });
    });

    return Array.from(missingByType.values()).map(item => ({
      type: item.type,
      name: item.name,
      workflows: Array.from(item.workflows.values())
    }));
  }, [credentials, workflows]);

  // Compute FlowEngine LLM credentials that can be added (even if env var is available)
  // FlowEngine LLM is NEVER missing (always works via env vars)
  // Users can add custom FlowEngine LLM keys via Add Credential modal
  const allCredentialsToAdd = useMemo(() => {
    return missingCredentials;
  }, [missingCredentials]);

  // Transform workflows for shared WorkflowList component
  const workflowListItems: WorkflowListItem[] = useMemo(() => {
    if (!instance) return [];
    const userCredTypes = new Set(credentials.map(c => c.type));
    return workflows.map(wf => ({
      id: wf.id,
      name: wf.name,
      active: wf.active,
      webhookUrl: wf.webhookUrl,
      instanceId: instance.id,
      instanceName: instance.instance_name,
      instanceUrl: instance.instance_url,
      requiredCredentials: (wf.requiredCredentials || []).map(rc => ({
        type: rc.type,
        name: rc.name,
        // FlowEngine LLM is always connected (via env vars)
        connected: rc.type === 'flowEngineApi' ? true : userCredTypes.has(rc.type),
      })),
      widgets: widgets
        .filter(w => w.workflow_id && String(w.workflow_id) === String(wf.id))
        .map(w => ({
          id: w.id,
          name: w.name,
          widget_type: w.widget_type,
          form_fields: w.form_fields,
          workflow_id: w.workflow_id,
        })),
    }));
  }, [workflows, instance, widgets, credentials]);

  // Transform credentials for shared WorkflowList component
  const connectedCredentialsForList: ConnectedCredential[] = useMemo(() => {
    return credentials.map(c => ({
      id: c.id,
      type: c.type,
      name: c.name,
    }));
  }, [credentials]);

  // Transform templateUpdates array to Map for WorkflowList
  const templateUpdatesMap = useMemo(() => {
    const map = new Map<string, WLTemplateUpdate>();
    templateUpdates.forEach(update => {
      map.set(String(update.workflowId), {
        importId: update.importId,
        workflowId: String(update.workflowId),
        workflowName: update.workflowName,
        templateId: update.templateId,
        templateName: update.templateName,
        installedVersion: update.installedVersion,
        latestVersion: update.latestVersion,
        changelog: update.changelog,
        instanceId: instance?.id,
      });
    });
    return map;
  }, [templateUpdates, instance]);

  // Helper function for preview mode - shows demo modal
  const handlePreviewAction = () => {
    if (isPreviewMode) {
      setDemoModalOpen(true);
      return true;
    }
    return false;
  };

  // Auto-dismiss toast - errors stay longer (8s) than success (5s)
  useEffect(() => {
    if (toast) {
      const duration = toast.type === 'error' ? 8000 : 5000;
      const timer = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Sync tab state from URL when searchParams becomes available (handles SSR/hydration)
  // Skip when portalEmbedded — parent controls tab via externalTab prop
  useEffect(() => {
    if (portalEmbedded) return;
    if (urlTab && validTabs.includes(urlTab as TabType) && activeTab !== urlTab) {
      setActiveTab(urlTab as TabType);
    }
  }, [urlTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync tab from external controller (e.g. portal secondary panel navigation)
  useEffect(() => {
    if (externalTab && validTabs.includes(externalTab as TabType) && externalTab !== activeTab) {
      setActiveTab(externalTab as TabType);
    }
  }, [externalTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle OAuth success redirect - refresh credentials and show toast
  // Skip when portalEmbedded — OAuth callbacks don't happen in embedded mode
  useEffect(() => {
    if (portalEmbedded) return;
    const success = searchParams.get('success');
    const credentialName = searchParams.get('name');

    if (success === 'credential_created' && session) {
      // Ensure we're on the credentials tab
      setActiveTab('credentials');

      // Set loading state IMMEDIATELY to prevent flash of empty state
      setCredentialsLoading(true);

      // Refresh credentials list
      fetchCredentials();
      fetchWorkflowTemplates();

      // Show success toast
      setToast({
        type: 'success',
        message: credentialName ? `${credentialName} connected successfully` : 'Credential connected successfully'
      });

      // Clear success params from URL but keep tab
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('success');
      newParams.delete('name');
      newParams.set('tab', 'credentials'); // Ensure tab stays as credentials
      const newUrl = `${window.location.pathname}?${newParams.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, session]);

  // Handle OAuth error redirect - show error toast
  // Skip when portalEmbedded — OAuth callbacks don't happen in embedded mode
  useEffect(() => {
    if (portalEmbedded) return;
    const error = searchParams.get('error');

    if (error) {
      // Navigate to credentials tab to show context
      setActiveTab('credentials');

      // Show error toast with the error message
      setToast({
        type: 'error',
        message: error
      });

      // Clear error param from URL but keep tab
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('error');
      newParams.set('tab', 'credentials');
      const newUrl = `${window.location.pathname}?${newParams.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);

  // Sync tab from URL when changed externally (e.g. portal sidebar navigation)
  // Skip when portalEmbedded — parent controls tab and URL
  useEffect(() => {
    if (portalEmbedded) return;
    if (!tabInitialized) return;
    const urlTabValue = searchParams.get('tab');
    const newTab = urlTabValue && validTabs.includes(urlTabValue as TabType) ? urlTabValue as TabType : 'overview';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when tab changes (for persistence on refresh)
  // Skip when portalEmbedded — parent owns the URL
  useEffect(() => {
    if (portalEmbedded) {
      if (!tabInitialized) setTabInitialized(true);
      return;
    }
    if (!tabInitialized) {
      setTabInitialized(true);
      return;
    }
    // Check if URL already has the correct tab value
    const currentUrlTab = searchParams.get('tab');
    const expectedUrlTab = activeTab === 'overview' ? null : activeTab;
    if (currentUrlTab === expectedUrlTab) {
      return; // URL already correct, no update needed
    }

    const currentParams = new URLSearchParams(searchParams.toString());
    if (activeTab === 'overview') {
      currentParams.delete('tab');
    } else {
      currentParams.set('tab', activeTab);
    }
    const newUrl = `${window.location.pathname}${currentParams.toString() ? '?' + currentParams.toString() : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [activeTab, searchParams, tabInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch archived workflows from n8n
  const fetchArchivedWorkflows = useCallback(async () => {
    if (!session) return;
    setArchivedWorkflowsLoading(true);
    try {
      const res = await fetch(`/api/client/workflows?instanceId=${instanceId}&archived=true`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setArchivedWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error('Failed to fetch archived workflows:', error);
    } finally {
      setArchivedWorkflowsLoading(false);
      setArchivedWorkflowsFetched(true);
    }
  }, [session, instanceId]);

  // Load archived workflows on mount (for count)
  useEffect(() => {
    // Fetch only once on initial load to get the count
    if (session && !archivedWorkflowsFetched && !archivedWorkflowsLoading) {
      fetchArchivedWorkflows();
    }
  }, [session, archivedWorkflowsFetched, archivedWorkflowsLoading, fetchArchivedWorkflows]);

  useEffect(() => {
    // Preview mode: Set up demo instance without API calls
    if (isPreviewMode) {
      setInstance({
        id: 'demo',
        instance_name: 'Demo Portal',
        instance_url: '#',
        status: 'running',
        storage_limit_gb: 10,
        n8n_api_key: 'demo-key',
      });
      setApiKey('demo-key');
      setIsOwner(true);
      setIsAgencyManager(true);
      setApiVerified(true);
      setClient({
        user_id: 'demo-user-123',
        email: 'sarah.chen@techstartup.com',
        status: 'accepted',
        invite_id: 'demo-invite-456',
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      });

      // Demo Workflows (2 workflows - 1 with UI component linked)
      setWorkflows([
        {
          id: 'demo-wf-1',
          name: 'Email Campaign Automation',
          active: true,
          webhookUrl: '#',
          requiredCredentials: [
            { type: 'gmailOAuth2', name: 'Gmail' },
            { type: 'hubspotOAuth2', name: 'HubSpot' }
          ]
        },
        {
          id: 'demo-wf-2',
          name: 'Slack Notification System',
          active: true,
          webhookUrl: '#',
          requiredCredentials: [
            { type: 'slackOAuth2', name: 'Slack' },
            { type: 'airtableTokenApi', name: 'Airtable' },
            { type: 'googleSheetsOAuth2', name: 'Google Sheets' }
          ]
        }
      ]);

      // Demo Credentials (5 total: 3 connected, 2 missing)
      setCredentials([
        {
          id: 'cred-1',
          name: 'Gmail Account',
          type: 'gmailOAuth2',
        },
        {
          id: 'cred-2',
          name: 'HubSpot CRM',
          type: 'hubspotOAuth2',
        },
        {
          id: 'cred-3',
          name: 'Slack Workspace',
          type: 'slackOAuth2',
        }
      ]);

      // Demo Templates (3 templates) - using correct WorkflowTemplate interface
      setWorkflowTemplates([
        {
          id: 'demo-tpl-1',
          name: 'Email Campaign Automation',
          description: 'Automate email campaigns with Gmail and HubSpot integration',
          category: 'Marketing',
          icon: 'mail',
          agency_name: 'Demo Agency',
          required_credentials: [
            { type: 'gmailOAuth2', name: 'Gmail', icon: 'gmail', status: 'available' as const },
            { type: 'hubspotOAuth2', name: 'HubSpot', icon: 'hubspot', status: 'available' as const }
          ],
          can_import: true,
          import_count: 0,
          created_at: '2026-01-15T09:00:00.000Z',
          version: 1
        },
        {
          id: 'demo-tpl-2',
          name: 'Slack Notification System',
          description: 'Send automated notifications to Slack channels',
          category: 'Communication',
          icon: 'message-square',
          agency_name: 'Demo Agency',
          required_credentials: [
            { type: 'slackOAuth2', name: 'Slack', icon: 'slack', status: 'available' as const }
          ],
          can_import: true,
          import_count: 0,
          created_at: '2026-01-18T11:00:00.000Z',
          version: 1
        },
        {
          id: 'demo-tpl-3',
          name: 'Data Export Pipeline',
          description: 'Export data to multiple destinations',
          category: 'Data Management',
          icon: 'database',
          agency_name: 'Demo Agency',
          required_credentials: [
            { type: 'airtableTokenApi', name: 'Airtable', icon: 'airtable', status: 'missing' as const },
            { type: 'googleSheetsOAuth2', name: 'Google Sheets', icon: 'sheets', status: 'missing' as const }
          ],
          can_import: false,
          import_count: 0,
          created_at: '2026-01-16T13:30:00.000Z',
          version: 1
        }
      ]);

      // Demo Widgets (3 UI components - 1 linked to workflow)
      const demoWidgets = [
        {
          id: 'demo-widget-1',
          name: 'Campaign Dashboard',
          widget_type: 'button' as const,
          webhook_url: '#',
          form_fields: [],
          is_active: true,
          workflow_id: 'demo-wf-1',
          workflow_name: 'Email Campaign Automation'
        },
        {
          id: 'demo-widget-2',
          name: 'Notification Form',
          widget_type: 'form' as const,
          webhook_url: '#',
          form_fields: [
            { name: 'message', type: 'textarea', required: true }
          ],
          is_active: true,
          workflow_id: undefined
        },
        {
          id: 'demo-widget-3',
          name: 'Support Chatbot',
          widget_type: 'chatbot' as const,
          webhook_url: '#',
          form_fields: [],
          chatbot_config: { greeting: 'How can I help you?' },
          is_active: true,
          workflow_id: undefined
        }
      ];
      setWidgets(demoWidgets);
      setAllAgencyWidgets(demoWidgets);

      // Demo Executions
      setExecutions([
        {
          id: 'exec-1',
          workflowId: 'demo-wf-1',
          workflowName: 'Email Campaign Automation',
          status: 'success',
          startedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString()
        },
        {
          id: 'exec-2',
          workflowId: 'demo-wf-2',
          workflowName: 'Slack Notification System',
          status: 'success',
          startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
        },
        {
          id: 'exec-3',
          workflowId: 'demo-wf-1',
          workflowName: 'Email Campaign Automation',
          status: 'error',
          startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
        },
        {
          id: 'exec-4',
          workflowId: 'demo-wf-2',
          workflowName: 'Slack Notification System',
          status: 'running',
          startedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString()
        }
      ]);

      // Demo Metrics
      setExecutionMetrics({
        total: 247,
        success: 231,
        failed: 15,
        running: 1
      });

      // Demo Payment Info (3 transactions)
      setPaymentInfo({
        stripeConnected: true,
        isAgency: true,
        customerId: 'cus_demo123',
        customer: {
          id: 'cus_demo123',
          email: 'sarah.chen@techstartup.com',
          name: 'Sarah Chen',
          created: Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60) // 90 days ago
        },
        transactions: [
          {
            id: 'pi_demo_001',
            type: 'payment' as const,
            amount: 2499.00,
            currency: 'usd',
            status: 'succeeded',
            description: 'Workflow Automation Package - Monthly',
            created: Math.floor(Date.now() / 1000) - (2 * 24 * 60 * 60), // 2 days ago
            receiptUrl: '#'
          },
          {
            id: 'in_demo_002',
            type: 'invoice' as const,
            amount: 4999.00,
            currency: 'usd',
            status: 'paid',
            description: 'Enterprise Setup & Integration',
            created: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // 30 days ago
            invoiceUrl: '#',
            pdfUrl: '#'
          },
          {
            id: 'pi_demo_003',
            type: 'payment' as const,
            amount: 2499.00,
            currency: 'usd',
            status: 'succeeded',
            description: 'Workflow Automation Package - Monthly',
            created: Math.floor(Date.now() / 1000) - (32 * 24 * 60 * 60), // 32 days ago
            receiptUrl: '#'
          }
        ]
      });
      setPaymentFetched(true);

      setLoading(false);
      setExecutionsLoading(false);
      setWorkflowsLoading(false);
      setWidgetsLoading(false);
      setWorkflowTemplatesLoaded(true);
      setCredentialsLoaded(true);
      setInitialLoadComplete(true);
      return;
    }

    if (!session) return;

    const fetchData = async () => {
      try {
        const instanceRes = await fetch(`/api/client-panel/${instanceId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!instanceRes.ok) {
          if (instanceRes.status === 403 && !embedded && !portalEmbedded) {
            router.push('/portal/hosting');
            return;
          }
          throw new Error('Failed to fetch instance');
        }

        const data = await instanceRes.json();
        setInstance(data.instance);
        setClient(data.client);
        setApiKey(data.instance?.n8n_api_key || '');
        // If API key exists, mark as verified (no need to re-verify on every refresh)
        if (data.instance?.n8n_api_key) {
          setApiVerified(true);
        }
        // If this is an external instance, show the external URL input
        if (data.instance?.is_external) {
          setShowExternalInput(true);
          setExternalUrl(data.instance?.instance_url || '');
        }
        setIsOwner(data.isOwner || false);
        setIsAgencyManager(data.isAgencyManager || false);
        setIsDedicated(data.isDedicated || false);
        setInstanceCategory(data.instanceCategory || null);

        // Client portal is now unified — clients use /portal/[id] directly
        // shouldUseClientPortal flag is still set by API but no longer triggers a redirect

        const widgetsRes = await fetch(`/api/client/widgets?instanceId=${instanceId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (widgetsRes.ok) {
          const widgetsData = await widgetsRes.json();
          setWidgets(widgetsData.widgets || []);
        }
        setWidgetsLoading(false);

        // Fetch all agency widgets if user is owner or agency manager (for "All Components" tab)
        if (data.isOwner || data.isAgencyManager) {
          const allWidgetsRes = await fetch(`/api/client-panel/${instanceId}/all-widgets`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (allWidgetsRes.ok) {
            const allWidgetsData = await allWidgetsRes.json();
            setAllAgencyWidgets(allWidgetsData.widgets || []);
          }
        }

        const execRes = await fetch(`/api/client/instances/${instanceId}/executions?range=${timeRange}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (execRes.ok) {
          const execData = await execRes.json();
          setExecutions(execData.executions || []);
          setExecutionMetrics(execData.metrics || null);
          if (execData.warning) {
            setExecutionsError(execData.warning);
          }
        } else {
          setExecutionsError('Failed to load executions');
        }
        setExecutionsLoading(false);

        if (data.instance?.n8n_api_key) {
          fetchWorkflows();
          // Also fetch credentials on initial load (needed for missing credentials indicators in workflows)
          const credsRes = await fetch(`/api/client/credentials?instanceId=${instanceId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (credsRes.ok) {
            const credsData = await credsRes.json();
            setCredentials(credsData.credentials || []);
          } else {
            // Silently handle errors - they'll be shown inline in the credentials tab if needed
            console.log('Credentials fetch failed on initial load - this is expected if API key is not configured');
          }
          // Fetch available template updates
          const updatesRes = await fetch(`/api/client/template-updates?instanceId=${instanceId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (updatesRes.ok) {
            const updatesData = await updatesRes.json();
            setTemplateUpdates(updatesData.updates || []);
          }
        } else {
          // No API key - stop loading state
          setWorkflowsLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch client panel data:', error);
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
        // Reset all loading states so UI never gets stuck in an infinite spinner
        setWorkflowsLoading(false);
        setWidgetsLoading(false);
        setExecutionsLoading(false);
      }
    };

    fetchData();
  }, [session, instanceId, router, isPreviewMode]);

  // skipVerification: true when called right after save/verify — don't let a transient
  // n8n error override the verified=true that was just confirmed by the verify-api step.
  const fetchWorkflows = async (skipVerification = false) => {
    try {
      const res = await fetch(`/api/client-panel/${instanceId}/workflows`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows || []);
        if (!skipVerification) {
          // Update verification status based on API response
          // This catches cases where API key becomes invalid after being saved
          if (data.workflows && !data.error) {
            setApiVerified(true);
            setApiError(null);
          } else if (data.error) {
            setApiVerified(false);
            setApiError(data.error);
          }
        }
      } else if (!skipVerification) {
        setApiVerified(false);
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      if (!skipVerification) setApiVerified(false);
    } finally {
      setWorkflowsLoading(false);
    }
  };

  const refetchExecutions = async (range: '24h' | '7d' | '30d') => {
    if (!session) return;
    setLoadingExecutions(true);
    try {
      const res = await fetch(`/api/client/instances/${instanceId}/executions?range=${range}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions || []);
        setExecutionMetrics(data.metrics || null);
      }
    } finally {
      setLoadingExecutions(false);
    }
  };

  const [refreshingWidgets, setRefreshingWidgets] = useState(false);

  const refreshWidgets = async () => {
    if (!session || refreshingWidgets) return;
    setRefreshingWidgets(true);
    try {
      // Refresh instance widgets
      const widgetsRes = await fetch(`/api/client/widgets?instanceId=${instanceId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (widgetsRes.ok) {
        const widgetsData = await widgetsRes.json();
        setWidgets(widgetsData.widgets || []);
      }

      // Refresh all agency widgets if owner or agency manager
      if (isOwner || isAgencyManager) {
        const allWidgetsRes = await fetch(`/api/client-panel/${instanceId}/all-widgets`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (allWidgetsRes.ok) {
          const allWidgetsData = await allWidgetsRes.json();
          setAllAgencyWidgets(allWidgetsData.widgets || []);
        }
      }
    } catch (error) {
      console.error('Failed to refresh widgets:', error);
    } finally {
      setRefreshingWidgets(false);
    }
  };

  const fetchTemplates = async () => {
    if (!session) return;
    setTemplatesLoading(true);
    try {
      const [templatesRes, categoriesRes] = await Promise.all([
        fetch('/api/widget-studio/templates', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/widget-studio/categories', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        // Deduplicate categories by ID
        const uniqueCategories = (data.categories || []).filter(
          (cat: Category, index: number, self: Category[]) =>
            index === self.findIndex(c => c.id === cat.id)
        );
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setTemplatesLoading(false);
      setTemplatesFetched(true);
    }
  };

  const openTemplatePicker = (workflow?: Workflow) => {
    setSelectedWorkflow(workflow || null);
    fetchTemplates();
    setTemplatePickerOpen(true);
  };

  const handleSaveApiKey = async () => {
    if (handlePreviewAction()) return;
    if (!session) return;
    setSavingApiKey(true);
    setApiError(null);

    try {
      const payload: { apiKey: string; externalUrl?: string } = { apiKey };
      if (showExternalInput && externalUrl.trim()) {
        payload.externalUrl = externalUrl.trim();
      }

      const res = await fetch(`/api/client-panel/${instanceId}/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setApiError(data.error || 'Failed to save');
        setApiVerified(false);
        return;
      }

      // Update local instance state with new URL if external was set
      if (showExternalInput && externalUrl.trim() && instance) {
        setInstance({ ...instance, instance_url: externalUrl.trim(), is_external: true });
      }

      const verifyRes = await fetch(`/api/client-panel/${instanceId}/verify-api`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const verifyData = await verifyRes.json();
      setApiVerified(verifyData.verified);

      if (!verifyData.verified && verifyData.error) {
        setApiError(verifyData.error);
      } else if (verifyData.verified) {
        // Refresh all data with new API key / external URL.
        // skipVerification=true so a transient n8n error doesn't flip verified back to false.
        fetchWorkflows(true);
        refetchExecutions(timeRange);
      }
    } catch (error) {
      setApiError('Failed to save');
      setApiVerified(false);
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleTemplateSelect = async (template: Template) => {
    if (!session) return;
    setSavingWidget(true);

    try {
      // Assign widget to this instance by updating its instance_id
      const res = await fetch(`/api/widget-studio/templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          instance_id: instanceId,
          workflow_id: selectedWorkflow?.id || null,
        }),
      });

      if (res.ok) {
        setTemplatePickerOpen(false);
        setSelectedWorkflow(null);
        setToast({ type: 'success', message: 'Component assigned successfully' });
        // Refresh UI components for this instance
        const widgetsRes = await fetch(`/api/client/widgets?instanceId=${instanceId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (widgetsRes.ok) {
          const widgetsData = await widgetsRes.json();
          setWidgets(widgetsData.widgets || []);
        }
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to assign component' });
      }
    } catch (error) {
      console.error('Failed to assign component:', error);
      setToast({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setSavingWidget(false);
      setSelectedWorkflow(null);
    }
  };

  // Unassign widget from this instance (doesn't delete the component)
  const handleUnassignWidget = async (widgetId: string) => {
    if (handlePreviewAction()) return;
    if (!confirm('Remove this component from this client? the component will still exist in UI Studio.') || !session || deletingWidget) return;

    setDeletingWidget(widgetId);
    try {
      const res = await fetch(`/api/widget-studio/templates/${widgetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ instance_id: null }),
      });

      if (res.ok) {
        setWidgets(widgets.filter(w => w.id !== widgetId));
        if (selectedWidget?.id === widgetId) setSelectedWidget(null);
        setToast({ type: 'success', message: 'Component removed from client' });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to unassign component' });
      }
    } catch (error) {
      console.error('Failed to unassign component:', error);
      setToast({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setDeletingWidget(null);
    }
  };

  // Add a component to this client (assigns instance_id)
  const handleAddToClient = async (widgetId: string) => {
    if (handlePreviewAction()) return;
    if (!session || deletingWidget) return;

    setDeletingWidget(widgetId);
    try {
      const res = await fetch(`/api/widget-studio/templates/${widgetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ instance_id: instanceId }),
      });

      if (res.ok) {
        const data = await res.json();
        // Add to instance widgets and update allAgencyWidgets
        const updatedWidget = data.template;
        setWidgets([...widgets, updatedWidget]);
        setAllAgencyWidgets(allAgencyWidgets.map(w => w.id === widgetId ? updatedWidget : w));
        setToast({ type: 'success', message: 'Component added to client' });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to add widget' });
      }
    } catch (error) {
      console.error('Failed to add widget to client:', error);
      setToast({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setDeletingWidget(null);
    }
  };

  const handleAssignClient = async () => {
    if (handlePreviewAction()) return;
    if (!inviteEmail || !session) return;
    setSendingInvite(true);

    try {
      const res = await fetch(`/api/client-panel/${instanceId}/assign-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setInviteEmail('');
        setEditingClient(false);
        setToast({ type: 'success', message: 'Client assigned successfully' });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to assign client' });
      }
    } catch (error) {
      console.error('Failed to assign client:', error);
      setToast({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRemoveClient = async () => {
    if (handlePreviewAction()) return;
    if (!session || !client) return;
    if (!confirm('Remove client access? They will no longer be able to access this instance.')) return;
    setSendingInvite(true);

    try {
      const res = await fetch(`/api/client-panel/${instanceId}/remove-client`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        setClient(null);
        setEditingClient(false);
        setToast({ type: 'success', message: 'Client access removed' });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to remove client' });
      }
    } catch (error) {
      console.error('Failed to remove client:', error);
      setToast({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setSendingInvite(false);
    }
  };

  const toggleWorkflow = async (workflowId: string, currentActive: boolean) => {
    if (handlePreviewAction()) return;
    if (!session || togglingWorkflow) return;
    setTogglingWorkflow(workflowId);

    try {
      const res = await fetch(`/api/client-panel/${instanceId}/workflows/${workflowId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ active: !currentActive }),
      });

      if (res.ok) {
        setWorkflows(workflows.map(wf =>
          wf.id === workflowId ? { ...wf, active: !currentActive } : wf
        ));
        setToast({ type: 'success', message: `Workflow ${!currentActive ? 'activated' : 'deactivated'} successfully` });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to toggle workflow' });
      }
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
      setToast({ type: 'error', message: 'Network error. Please check your connection.' });
    } finally {
      setTogglingWorkflow(null);
    }
  };

  const archiveWorkflow = async (workflowId: string, _isArchived: boolean) => {
    if (handlePreviewAction()) return;
    if (!session || archivingWorkflow) return;
    setArchivingWorkflow(workflowId);
    setWorkflowMenuOpen(null);

    try {
      const res = await fetch(`/api/client/workflows/${workflowId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ archive: true, instanceId }),
      });

      if (res.ok) {
        // Remove from workflows list (deleted permanently)
        setWorkflows(workflows.filter(w => w.id !== workflowId));
        setToast({ type: 'success', message: 'Workflow deleted' });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to delete workflow' });
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      setToast({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setArchivingWorkflow(null);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getWidgetLink = (widgetId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/w/${widgetId}`;
  };

  const getWidgetEmbedCode = (widgetId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `<div id="fe-widget-${widgetId}"></div>\n<script src="${baseUrl}/widget.js" data-id="${widgetId}"></script>`;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

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

  // Filter executions based on selected filters
  const getFilteredExecutions = () => {
    let filtered = executions;

    // Filter by time range
    const now = new Date();
    const timeMs = timeRange === '24h' ? 24 * 60 * 60 * 1000 :
                   timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                   30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - timeMs);
    filtered = filtered.filter(exec => new Date(exec.startedAt) >= cutoff);

    // Filter by workflow
    if (workflowFilter !== 'all') {
      filtered = filtered.filter(exec => exec.workflowId === workflowFilter);
    }
    // Filter by status
    if (executionFilter !== 'all') {
      filtered = filtered.filter(exec => exec.status === executionFilter);
    }
    return filtered;
  };

  // Get unique workflows from executions for filter dropdown
  const getUniqueWorkflows = () => {
    const workflowMap = new Map<string, string>();
    executions.forEach(exec => {
      if (exec.workflowId && !workflowMap.has(exec.workflowId)) {
        workflowMap.set(exec.workflowId, exec.workflowName);
      }
    });
    return Array.from(workflowMap.entries()).map(([id, name]) => ({ id, name }));
  };

  const getLinkedWidgets = (workflow: Workflow) => {
    // Use string comparison since n8n IDs may be numbers or strings
    return widgets.filter(w => w.workflow_id && String(w.workflow_id) === String(workflow.id));
  };

  const toggleWorkflowExpanded = (workflowId: string) => {
    setExpandedWorkflows(prev => {
      const next = new Set(prev);
      if (next.has(workflowId)) {
        next.delete(workflowId);
      } else {
        next.add(workflowId);
      }
      return next;
    });
  };

  // WorkflowList callback adapters
  const handleWorkflowToggleExpand = (workflowKey: string) => {
    // workflowKey format is workflowId (no instance prefix for single-instance view)
    toggleWorkflowExpanded(workflowKey);
  };

  const handleWorkflowToggle = (_workflowId: string, _instanceId: string, currentActive: boolean) => {
    // instanceId is ignored - we use the page's instanceId
    toggleWorkflow(_workflowId, currentActive);
  };

  const handleWorkflowDelete = (workflowId: string, _instanceId: string) => {
    archiveWorkflow(workflowId, false);
  };

  const handleAddComponent = (wfItem: WorkflowListItem) => {
    if (handlePreviewAction()) return;
    // Convert WorkflowListItem back to Workflow for openLinkWidgetModal
    const workflow = workflows.find(wf => wf.id === wfItem.id);
    if (workflow) {
      openLinkWidgetModal(workflow);
    }
  };

  const handleAddCredentialFromList = (credentialType: string, _instanceId: string) => {
    if (handlePreviewAction()) return;
    // Open credential modal with preselected type
    setPreselectedCredentialType(credentialType);
    setAddCredentialOpen(true);
  };

  // Open missing credentials modal for a workflow (from key badge click)
  const handleOpenMissingCredentials = (wfItem: WorkflowListItem) => {
    // Get the workflow's missing credentials
    const workflow = workflows.find(wf => wf.id === wfItem.id);
    if (!workflow) return;

    const userCredTypes = new Set(credentials.map(c => c.type));
    const allRequiredCreds = workflow.requiredCredentials || [];
    const missingCreds = allRequiredCreds.filter(
      c => c.type !== 'none' && c.type !== 'flowEngineApi' && !userCredTypes.has(c.type)
    );

    if (missingCreds.length > 0) {
      setMissingCredsWorkflowName(workflow.name);
      setMissingCredsList(missingCreds.map(c => ({ type: c.type, name: c.name, icon: '' })));
      setAddedCredTypes([]);
      setMissingCredsModalOpen(true);
    }
  };

  const handleConfigureCredential = async (credentialType: string, wfItem: WorkflowListItem, userCred?: ConnectedCredential) => {

    // Find the original workflow
    const workflow = workflows.find(wf => wf.id === wfItem.id);
    if (!workflow || !session) {
      return;
    }

    try {
      // Fetch workflow JSON to get parameters
      const res = await fetch(`/api/client/workflows/${workflow.id}/parameters?instanceId=${instanceId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setToast({ type: 'error', message: 'Failed to load workflow details' });
        return;
      }
      const workflowData = await res.json();

      // Get credential params for this credential type
      const cred = workflow.requiredCredentials?.find(c => c.type === credentialType);

      const credParams = getCredentialParams(
        workflowData,
        [{ type: credentialType, name: cred?.name || credentialType, id: userCred?.id }]
      );

      if (credParams.length > 0) {
        setSelectedCredentialParam(credParams[0]);
        setCredentialParamWorkflow(workflow);
        setCredentialParamOpen(true);
      } else {
        setToast({ type: 'success', message: 'This credential has no configurable parameters' });
      }
    } catch (e) {
      console.error('❌ [Configure] Error:', e);
      setToast({ type: 'error', message: 'Failed to load credential configuration' });
    }
  };

  const handleWorkflowWidgetClick = (widget: { id: string; name: string }, _workflow: WorkflowListItem) => {
    const fullWidget = widgets.find(w => w.id === widget.id);
    if (fullWidget) {
      openWidgetPanel(fullWidget);
    }
  };

  const handleUnlinkWidget = async (widgetId: string, _instanceId: string) => {
    if (confirm('Unlink this component from the workflow?')) {
      await handleWidgetUpdate(widgetId, { workflow_id: null } as any);
    }
  };

  const handleUpdateTemplateFromList = (update: WLTemplateUpdate) => {
    // Convert WorkflowTemplateUpdate to TemplateUpdate
    const templateUpdate = templateUpdates.find(u => u.workflowId === update.workflowId);
    if (templateUpdate) {
      setSelectedUpdate(templateUpdate);
      setUpdateModalOpen(true);
    }
  };

  const openWidgetPanel = (widget: Widget) => {
    if (handlePreviewAction()) return;
    setSelectedWidget(widget);
    setEditingWidgetName(widget.name);
    setWidgetModalOpen(true);
  };

  const handleWidgetUpdate = async (widgetId: string, updates: Partial<Widget>) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/client/widgets/${widgetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'Component updated successfully' });
        // Refresh components list
        const widgetsRes = await fetch(`/api/client/widgets?instanceId=${instanceId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (widgetsRes.ok) {
          const widgetsData = await widgetsRes.json();
          setWidgets(widgetsData.widgets || []);
        }
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to update component' });
      }
    } catch (error) {
      console.error('Failed to update component:', error);
      setToast({ type: 'error', message: 'Network error. Please try again.' });
    }
  };

  // Get UI components in use (linked to workflows)
  const getWidgetsInUse = () => {
    return widgets.filter(w => w.workflow_id && workflows.some(wf => String(w.workflow_id) === String(wf.id)));
  };

  // Open link widget modal for a workflow
  const openLinkWidgetModal = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setLinkWidgetTab('instance');
    setLinkWidgetModalOpen(true);
  };

  // Get UI components for link modal based on tab
  const getLinkModalWidgets = () => {
    if (linkWidgetTab === 'in-use') {
      return getWidgetsInUse();
    } else if (linkWidgetTab === 'instance') {
      return widgets;
    } else if (linkWidgetTab === 'all') {
      return allAgencyWidgets.length > 0 ? allAgencyWidgets : widgets;
    }
    return widgets;
  };

  // Link an existing component to the selected workflow
  const linkWidgetToWorkflow = async (widgetId: string) => {
    if (!selectedWorkflow || !session) return;
    // Set workflow_id, webhookUrl, and webhookMethod so the widget can trigger the workflow correctly
    await handleWidgetUpdate(widgetId, {
      workflow_id: selectedWorkflow.id,
      webhookUrl: selectedWorkflow.webhookUrl || null,
      webhookMethod: selectedWorkflow.webhookMethod || 'GET'
    } as any);
    setLinkWidgetModalOpen(false);
    setSelectedWorkflow(null);
  };

  // Assign widget to a workflow (from widget's 3-dot menu)
  const assignWidgetToWorkflow = async (workflowId: string) => {
    if (!workflowPickerWidget || !session) return;
    const workflow = workflows.find(w => w.id === workflowId);
    // Set workflow_id, webhookUrl, and webhookMethod so the widget can trigger the workflow correctly
    await handleWidgetUpdate(workflowPickerWidget.id, {
      workflow_id: workflowId,
      webhookUrl: workflow?.webhookUrl || null,
      webhookMethod: workflow?.webhookMethod || 'GET'
    } as any);
    setWorkflowPickerWidget(null);
  };

  // Get widgets filtered by tab, linked status, category, and search
  const getFilteredWidgets = () => {
    // Level 1: Tab filter
    let result: Widget[] = [];
    if (widgetTab === 'all') {
      // For owners/agency: all agency widgets
      result = allAgencyWidgets.length > 0 ? allAgencyWidgets : widgets;
    } else {
      // 'instance' tab or client view: UI components assigned to this instance
      result = widgets;
    }

    // Level 2: Linked filter (for owners and agency managers)
    if ((isOwner || isAgencyManager) && linkedFilter === 'linked') {
      result = result.filter(w => w.workflow_id && workflows.some(wf => String(w.workflow_id) === String(wf.id)));
    } else if ((isOwner || isAgencyManager) && linkedFilter === 'not-linked') {
      result = result.filter(w => !w.workflow_id || !workflows.some(wf => String(w.workflow_id) === String(wf.id)));
    }

    // Apply category filter (check template's category)
    if (selectedCategoryFilter) {
      result = result.filter(w => {
        // Widget might have category info from template
        const template = templates.find(t => t.id === (w as any).template_id);
        return template?.category_id === selectedCategoryFilter;
      });
    }
    // Apply search filter
    if (widgetSearch) {
      const search = widgetSearch.toLowerCase();
      result = result.filter(w => w.name.toLowerCase().includes(search));
    }
    return result;
  };

  // Payment functions
  const fetchPaymentInfo = async () => {
    if (!session) return;
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/client-panel/${instanceId}/payment`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentInfo(data);
      } else {
        // Set empty state for other errors
        setPaymentInfo({
          stripeConnected: false,
          isAgency: false,
          customerId: null,
          customer: null,
          transactions: [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch payment info:', error);
      // Set empty state on error
      setPaymentInfo({
        stripeConnected: false,
        isAgency: false,
        customerId: null,
        customer: null,
        transactions: [],
      });
    } finally {
      setPaymentLoading(false);
      setPaymentFetched(true);
    }
  };

  // Workflow Templates functions
  const fetchWorkflowTemplates = async () => {
    if (!session) return;
    setWorkflowTemplatesLoading(true);
    try {
      const res = await fetch(`/api/client/templates?instanceId=${instanceId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWorkflowTemplates(data.templates || []);
        setWorkflowTemplatesLoaded(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ type: 'error', message: data.error || 'Failed to load templates' });
        setWorkflowTemplatesLoaded(true); // Mark as loaded to prevent retry loop
      }
    } catch (error) {
      console.error('Failed to fetch workflow templates:', error);
      setToast({ type: 'error', message: 'Failed to load templates. Please try again.' });
      setWorkflowTemplatesLoaded(true); // Mark as loaded to prevent retry loop
    } finally {
      setWorkflowTemplatesLoading(false);
    }
  };

  // Fetch available template updates
  const fetchTemplateUpdates = useCallback(async () => {
    if (!session) return;
    setTemplateUpdatesLoading(true);
    try {
      const res = await fetch(`/api/client/template-updates?instanceId=${instanceId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplateUpdates(data.updates || []);
      }
    } catch (error) {
      console.error('Failed to fetch template updates:', error);
    } finally {
      setTemplateUpdatesLoading(false);
    }
  }, [session, instanceId]);

  // Handle clicking on a template update
  const handleUpdateClick = (update: TemplateUpdate) => {
    setSelectedUpdate(update);
    setUpdateModalOpen(true);
  };

  // Handle update complete
  const handleUpdateComplete = () => {
    fetchTemplateUpdates();
    fetchWorkflows();
    setToast({ type: 'success', message: 'Workflow updated successfully!' });
  };

  const handleImportTemplate = async (template: WorkflowTemplate, credentialSelections?: Record<string, string>) => {
    if (handlePreviewAction()) return;
    if (!session) return;
    setImportingTemplate(true);
    setImportingTemplateId(template.id);
    try {
      const res = await fetch(`/api/client/templates/${template.id}/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instanceId, credentialSelections }),
      });
      const data = await res.json();
      if (res.ok) {
        // Check for missing credentials
        const missingCreds = template.required_credentials.filter(c => c.status === 'missing');

        // Show success message
        const message = data.warning
          ? `Workflow imported! ${data.warning}`
          : (data.message || 'Workflow imported successfully!');
        setToast({ type: 'success', message });
        setTemplateDetailOpen(false);
        setSelectedTemplate(null);
        fetchWorkflowTemplates();

        // Switch to overview tab and refresh workflows to show the imported workflow
        setActiveTab('overview');
        await fetchWorkflows();

        // If there are missing credentials, open the missing credentials modal
        if (missingCreds.length > 0) {
          setTimeout(() => {
            setMissingCredsWorkflowName(template.name);
            setMissingCredsList(missingCreds.map(c => ({ type: c.type, name: c.name, icon: c.icon })));
            setAddedCredTypes([]);
            setMissingCredsModalOpen(true);
          }, 500);
        } else {
          // Scroll to workflows section after a brief delay
          setTimeout(() => {
            const workflowsSection = document.getElementById('workflows-section');
            if (workflowsSection) {
              workflowsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to import workflow' });
      }
    } catch (error) {
      console.error('Failed to import template:', error);
      setToast({ type: 'error', message: 'Failed to import workflow' });
    } finally {
      setImportingTemplate(false);
      setImportingTemplateId(null);
    }
  };

  // Credentials functions
  const fetchCredentials = async () => {
    if (!session) return;
    setCredentialsLoading(true);
    try {
      // Add cache buster to ensure fresh data after adding/deleting credentials
      const res = await fetch(`/api/client/credentials?instanceId=${instanceId}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        // Use flushSync to ensure credentials state updates are synchronous
        flushSync(() => {
          setCredentials(data.credentials || []);
          setCredentialsWarning(data.warning || null);
          setCredentialsLoaded(true);
        });
      } else {
        const data = await res.json().catch(() => ({}));
        // Don't show toast for expected errors - component shows these inline or they're access control issues
        const suppressedErrors = ['API key not configured', 'Instance not found', 'Instance API key not configured', 'Access denied'];
        if (!suppressedErrors.some(err => data.error?.includes(err))) {
          setToast({ type: 'error', message: data.error || 'Failed to load credentials' });
        }
        setCredentialsLoaded(true); // Mark as loaded to prevent retry loop
      }
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
      setToast({ type: 'error', message: 'Failed to load credentials. Please try again.' });
      setCredentialsLoaded(true); // Mark as loaded to prevent retry loop
    } finally {
      setCredentialsLoading(false);
    }
  };

  const handleDeleteCredential = async (credentialId: string, credentialType: string) => {
    if (handlePreviewAction()) return;
    if (!session) return;
    try {
      const res = await fetch(`/api/client/credentials/${credentialId}?instanceId=${instanceId}&type=${encodeURIComponent(credentialType)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'Credential deleted successfully' });

        // Refresh all data - credential was disconnected from workflows
        await Promise.all([
          fetchCredentials(),
          fetchWorkflows(),
        ]);
        fetchWorkflowTemplates();
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to delete credential' });
      }
    } catch (error) {
      console.error('Failed to delete credential:', error);
      setToast({ type: 'error', message: 'Failed to delete credential' });
    }
  };

  const handleCredentialCreated = (credentialName?: string, credentialType?: string) => {
    fetchCredentials();
    fetchWorkflowTemplates();
    // Track added credential for missing credentials modal
    if (credentialType && missingCredsModalOpen) {
      setAddedCredTypes(prev => [...prev, credentialType]);
    }
    // Show success toast
    setToast({ type: 'success', message: credentialName ? `${credentialName} credential added successfully` : 'Credential added successfully' });
  };

  // Fetch execution details and show in modal
  const handleExecutionClick = async (exec: { id: string; workflowName: string; status: 'success' | 'error' | 'running' }) => {
    if (!session) return;

    setSelectedExecution(exec);
    setExecutionModalOpen(true);
    setExecutionDetailLoading(true);
    setExecutionDetail(null);

    try {
      const res = await fetch(
        `/api/client/executions/${exec.id}?instanceId=${instanceId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setExecutionDetail(data.execution);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setToast({ type: 'error', message: errorData.error || 'Failed to fetch execution details' });
      }
    } catch (error) {
      console.error('Failed to fetch execution details:', error);
      setToast({ type: 'error', message: 'Failed to fetch execution details' });
    } finally {
      setExecutionDetailLoading(false);
    }
  };

  const fetchAvailableCustomers = async (search?: string) => {
    if (!session) return;
    setCustomersLoading(true);
    try {
      const url = search
        ? `/api/agency/customers?search=${encodeURIComponent(search)}`
        : '/api/agency/customers';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleLinkCustomer = async (customerId: string) => {
    if (handlePreviewAction()) return;
    if (!session) return;
    setLinkingCustomer(true);
    try {
      const res = await fetch(`/api/client-panel/${instanceId}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ customerId }),
      });
      if (res.ok) {
        setCustomerDropdownOpen(false);
        setCustomerSearch('');
        await fetchPaymentInfo();
      }
    } catch (error) {
      console.error('Failed to link customer:', error);
    } finally {
      setLinkingCustomer(false);
    }
  };

  const handleUnlinkCustomer = async () => {
    if (handlePreviewAction()) return;
    if (!session) return;
    if (!confirm('Unlink this customer? Transaction history will no longer be visible.')) return;
    setLinkingCustomer(true);
    try {
      const res = await fetch(`/api/client-panel/${instanceId}/payment`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        await fetchPaymentInfo();
      }
    } catch (error) {
      console.error('Failed to unlink customer:', error);
    } finally {
      setLinkingCustomer(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Fetch categories when switching to UI Components tab
  useEffect(() => {
    if (activeTab === 'widgets' && !templatesFetched && !templatesLoading) {
      fetchTemplates();
    }
  }, [activeTab, templatesFetched, templatesLoading]);

  // Fetch payment info when switching to payment tab
  useEffect(() => {
    if (activeTab === 'payment' && !paymentFetched && !paymentLoading && session && !isPreviewMode) {
      fetchPaymentInfo();
    }
  }, [activeTab, paymentFetched, paymentLoading, session, isPreviewMode]);

  // Fetch linked WhatsApp instances when services tab is active
  useEffect(() => {
    if (activeTab === 'services' && !servicesLoaded && !servicesLoading && session && instanceId) {
      setServicesLoading(true);
      fetch(`/api/client/whatsapp-instances?instanceId=${instanceId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          setServicesWhatsApp(data.instances || []);
          setServicesLoaded(true);
        })
        .catch(() => setServicesLoaded(true))
        .finally(() => setServicesLoading(false));
    }
  }, [activeTab, servicesLoaded, servicesLoading, session, instanceId]);

  const openLinkWhatsAppModal = async () => {
    setLinkWhatsAppOpen(true);
    if (availableWhatsApp.length > 0) return;
    setLoadingAvailableWA(true);
    try {
      const res = await fetch('/api/whatsapp/instances', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      // Filter out already-linked instances
      const linkedIds = new Set(servicesWhatsApp.map(w => w.id));
      setAvailableWhatsApp((data.instances || []).filter((w: { id: string }) => !linkedIds.has(w.id)));
    } catch { /* silent */ } finally {
      setLoadingAvailableWA(false);
    }
  };

  const handleLinkWhatsApp = async (whatsappInstanceId: string) => {
    if (!session?.access_token) return;
    setLinkingWA(true);
    try {
      const res = await fetch('/api/whatsapp/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ whatsappInstanceId, portalInstanceId: instanceId }),
      });
      if (!res.ok) throw new Error('Failed to link');
      // Refresh services list
      setServicesLoaded(false);
      setLinkWhatsAppOpen(false);
      setAvailableWhatsApp([]);
    } catch {
      setToast({ type: 'error', message: 'Failed to link WhatsApp instance' });
    } finally {
      setLinkingWA(false);
    }
  };

  // Fetch templates on first tab visit (lazy load)
  useEffect(() => {
    if (activeTab === 'templates' && !workflowTemplatesLoaded && !workflowTemplatesLoading && session && !isPreviewMode) {
      fetchWorkflowTemplates();
    }
  }, [activeTab, workflowTemplatesLoaded, workflowTemplatesLoading, session, isPreviewMode]);

  // Fetch credentials on first tab visit (lazy load)
  useEffect(() => {
    if (activeTab === 'credentials' && !credentialsLoaded && !credentialsLoading && session && !isPreviewMode) {
      fetchCredentials();
    }
  }, [activeTab, credentialsLoaded, credentialsLoading, session, isPreviewMode]);

  // Refetch widgets when returning from UI studio (page visibility change)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && session && initialLoadComplete && !isPreviewMode) {
        // Refetch widgets for this instance
        setWidgetsLoading(true);
        try {
          const widgetsRes = await fetch(`/api/client/widgets?instanceId=${instanceId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (widgetsRes.ok) {
            const widgetsData = await widgetsRes.json();
            setWidgets(widgetsData.widgets || []);
          }

          // Refetch all agency widgets if owner/manager
          if (isOwner || isAgencyManager) {
            const allWidgetsRes = await fetch(`/api/client-panel/${instanceId}/all-widgets`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (allWidgetsRes.ok) {
              const allWidgetsData = await allWidgetsRes.json();
              setAllAgencyWidgets(allWidgetsData.widgets || []);
            }
          }
        } catch (error) {
          console.error('Failed to refetch widgets:', error);
        } finally {
          setWidgetsLoading(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, instanceId, initialLoadComplete, isPreviewMode, isOwner, isAgencyManager]);

  // Only show "not found" error after we've actually tried to fetch
  if (initialLoadComplete && !instance) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-400">Instance not found</p>
          <Link href={backUrl ?? "/portal/hosting"} className="text-gray-500 hover:text-white mt-4 inline-block">
            Back
          </Link>
        </div>
      </div>
    );
  }

  // Payment is per-client, not per-instance — hide when opened from the client management flow
  const TABS = [
    { id: 'overview', name: 'Overview', icon: Eye },
    { id: 'widgets', name: 'UI Components', icon: MousePointer, count: widgets.length },
    { id: 'templates', name: 'Templates', icon: Download, count: workflowTemplates.length },
    { id: 'credentials', name: 'Credentials', icon: Key, count: credentials.length },
    { id: 'services' as const, name: 'Services', icon: Server },
    ...(!backUrl ? [{ id: 'payment' as const, name: 'Payment', icon: CreditCard }] : []),
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <div className={cn("min-h-full bg-black relative", embedded && "overflow-y-auto")}>
      {/* Background effects */}
      {!embedded && !portalEmbedded && (
        <>
          <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-purple-500/8 rounded-full blur-[200px] pointer-events-none" />
          <div className="absolute top-60 right-1/4 w-[500px] h-[500px] bg-pink-500/8 rounded-full blur-[180px] pointer-events-none" />
        </>
      )}

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={cn(
              'fixed top-4 left-1/2 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border',
              toast.type === 'error'
                ? 'bg-red-900/90 border-red-800 text-red-100'
                : 'bg-green-900/90 border-green-800 text-green-100'
            )}
          >
            {toast.type === 'error' ? (
              <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded hover:bg-gray-800/30 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Mode Banner */}
      {isPreviewMode && !embedded && !portalEmbedded && (
        <div className="fixed top-0 left-0 right-0 z-[150] bg-gradient-to-r from-purple-900/90 to-violet-900/90 backdrop-blur-sm border-b border-purple-500/30">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3">
            <Eye className="w-4 h-4 text-purple-300" />
            <span className="text-sm text-white">
              Demo Mode — Try out all Pro+ features
            </span>
            <button
              onClick={() => setDemoModalOpen(true)}
              className="px-3 py-1 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              View Pricing
            </button>
            <Link
              href="/"
              className="px-3 py-1 border border-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800/30 transition-colors"
            >
              Exit Demo
            </Link>
          </div>
        </div>
      )}

      {/* Compact header for standalone embedded mode */}
      {embedded && !portalEmbedded && instance && (
        <div className="border-b border-gray-800 bg-black px-6 h-[64px] flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white leading-tight">Overview</h2>
            <p className="text-sm text-white/60 leading-tight truncate">{instance.instance_name}</p>
          </div>
        </div>
      )}
      {/* Sub-header — quick-access links */}
      {(embedded || portalEmbedded) && instance && (
        <>
          <div className="border-b border-gray-800 bg-black px-6 py-2.5 flex items-center justify-end gap-3">
            {/* Client Portal */}
            <a
              href={`/portal/${instance.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white text-black hover:bg-gray-100 rounded-lg font-semibold transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              Client Portal
            </a>

            {/* n8n Management */}
            {instance.instance_url && (
              <a
                href={instance.instance_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                n8n Management
              </a>
            )}
          </div>
        </>
      )}

      {/* Header — hidden when embedded in portal layout */}
      {!embedded && !portalEmbedded && (
      <div className="relative border-b border-gray-800 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              {/* Logo or Back button */}
              {isSafeImageUrl(agencyLogoUrl) && !logoError ? (
                <div className="p-2 bg-gray-900/50 border border-gray-800 rounded-xl flex items-center justify-center">
                  <img
                    src={agencyLogoUrl!}
                    alt="Agency"
                    className="h-10 w-10 object-contain"
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <Link
                  href={backUrl ?? ((isOwner || isAgencyManager) ? "/portal/hosting" : "/portal")}
                  className="p-2.5 bg-gray-900/50 border border-gray-800 hover:border-purple-500/50 hover:bg-purple-500/10 rounded-xl text-gray-400 hover:text-white transition-all"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              )}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400">
                    {instance?.instance_name || (
                      <span className="inline-block h-8 w-48 bg-gray-800/30 rounded animate-pulse" />
                    )}
                  </span>
                </h1>
                {instance && (isOwner || isAgencyManager) ? (
                  <>
                  <a
                    href={instance.instance_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-purple-400 flex items-center gap-1.5 mt-1 transition-colors"
                  >
                    {instance.instance_url?.replace('https://', '')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {isDedicated && (
                    <p className="text-xs text-gray-500 mt-1.5">This instance is for internal usage only — not for clients. To invite clients, deploy a new instance.</p>
                  )}
                  </>
                ) : instance ? (
                  <p className="text-sm text-gray-500 mt-1">Managed instance</p>
                ) : (
                  <span className="inline-block h-4 w-32 bg-gray-800/30 rounded animate-pulse mt-1" />
                )}
              </div>
            </div>
            {instance && (isOwner || isAgencyManager) && (
              <div className="flex items-center gap-3">
                {!isDedicated && (
                <>
                <button
                  onClick={() => {
                    if (handlePreviewAction()) return;
                    const clientUrl = `${window.location.origin}/portal/${instanceId}`;
                    navigator.clipboard.writeText(clientUrl);
                    setCopiedClientUrl(true);
                    setTimeout(() => setCopiedClientUrl(false), 2000);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-all",
                    copiedClientUrl
                      ? "bg-green-500/10 border-green-500/50 text-green-400"
                      : "bg-gray-900/50 border-gray-800 hover:border-gray-700 text-white/60"
                  )}
                  title="Copy direct link for client to access their panel"
                >
                  {copiedClientUrl ? (
                    <>
                      <CheckCircle className="h-4 w-4" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copy Client URL
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (handlePreviewAction()) return;
                    window.open(`/portal/${instanceId}?preview=true${agencyLogoUrl ? `&logo=${encodeURIComponent(agencyLogoUrl)}` : ''}`, '_blank');
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/50 border border-gray-800 hover:border-purple-500/50 hover:bg-purple-500/10 text-white/60 rounded-xl text-sm font-medium transition-all"
                  title="Preview client panel"
                >
                  <Eye className="h-4 w-4" /> Preview
                </button>
                </>
                )}
                <a
                  href={instance.instance_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-purple-500/25"
                >
                  Open n8n
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      )}

      {/* Tabs — hidden in portal mode (secondary panel provides navigation) */}
      {!portalEmbedded && (
      <div className="relative border-b border-gray-800 bg-black/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-hide">
          <nav className="flex gap-1 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    onTabChange?.(tab.id);
                  }}
                  className={cn(
                    'flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-all',
                    activeTab === tab.id
                      ? 'border-purple-500 text-white'
                      : 'border-transparent text-gray-500 hover:text-white/60'
                  )}
                >
                  <Icon className={cn('h-4 w-4', activeTab === tab.id && 'text-purple-400')} />
                  {tab.name}
                  {'count' in tab && tab.count !== undefined && tab.count > 0 && (
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      activeTab === tab.id
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-gray-800 text-gray-500'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
      )}

      {/* Content */}
      <div className={cn("relative py-8", portalEmbedded ? "px-6" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8")}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Compact Metrics Row */}
            {executionsLoading ? (
              <UnifiedSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-white/40" />
                    <span className="text-white/40 text-xs">Total</span>
                  </div>
                  <p className="text-white font-semibold text-lg">{executionMetrics?.total || 0}</p>
                </div>
                <div
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-green-800 transition-colors"
                  onClick={() => setExecutionFilter('success')}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-400/60" />
                    <span className="text-white/40 text-xs">Success</span>
                  </div>
                  <p className="text-green-400 font-semibold text-lg">{executionMetrics?.success || 0}</p>
                </div>
                <div
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 cursor-pointer hover:border-red-800 transition-colors"
                  onClick={() => setExecutionFilter('error')}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="h-4 w-4 text-red-400/60" />
                    <span className="text-white/40 text-xs">Failed</span>
                  </div>
                  <p className="text-red-400 font-semibold text-lg">{executionMetrics?.failed || 0}</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-white/40" />
                    <span className="text-white/40 text-xs">Running</span>
                  </div>
                  <p className="text-white/60 font-semibold text-lg">{executionMetrics?.running || 0}</p>
                </div>
              </div>
            )}

            {/* Execution List with Filters */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-900/50 border-b border-gray-800">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExecutionFilter('all')}
                    className={cn(
                      'px-4 py-2 text-sm font-medium rounded-lg transition-all',
                      executionFilter === 'all'
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  All ({executions.length})
                </button>
                <button
                  onClick={() => setExecutionFilter('success')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2',
                    executionFilter === 'success'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                  )}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Success ({executionMetrics?.success || 0})
                </button>
                <button
                  onClick={() => setExecutionFilter('error')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2',
                    executionFilter === 'error'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                  )}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Errors ({executionMetrics?.failed || 0})
                </button>
                </div>
                <div className="flex items-center gap-2">
                  {/* Searchable Workflow Filter Dropdown */}
                  {getUniqueWorkflows().length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setWorkflowDropdownOpen(!workflowDropdownOpen)}
                        className={cn(
                          'flex items-center gap-2 pl-8 pr-8 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer',
                          'bg-gray-900/50 border border-gray-800 text-white/60',
                          'hover:border-gray-700 focus:outline-none focus:ring-2 focus:ring-white',
                          workflowFilter !== 'all' && 'border-gray-600 text-white'
                        )}
                      >
                        <span className="max-w-[120px] truncate">
                          {workflowFilter === 'all'
                            ? 'All Workflows'
                            : getUniqueWorkflows().find(w => w.id === workflowFilter)?.name || 'Select...'}
                        </span>
                      </button>
                      <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
                      <ChevronDown className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none transition-transform",
                        workflowDropdownOpen && "rotate-180"
                      )} />

                      {/* Searchable Dropdown */}
                      <AnimatePresence>
                        {workflowDropdownOpen && (
                          <>
                            {/* Backdrop to close on outside click */}
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => {
                                setWorkflowDropdownOpen(false);
                                setWorkflowSearchQuery('');
                              }}
                            />
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-full mt-1 w-64 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50 overflow-hidden"
                            >
                              {/* Search Input */}
                              <div className="p-2 border-b border-gray-800">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                  <input
                                    type="text"
                                    value={workflowSearchQuery}
                                    onChange={(e) => setWorkflowSearchQuery(e.target.value)}
                                    placeholder="Search workflows..."
                                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-800/30 border border-gray-700 rounded-md text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-white"
                                    autoFocus
                                  />
                                </div>
                              </div>

                              {/* Options List */}
                              <div className="max-h-48 overflow-y-auto p-1">
                                {/* All Workflows Option */}
                                <button
                                  onClick={() => {
                                    setWorkflowFilter('all');
                                    setWorkflowDropdownOpen(false);
                                    setWorkflowSearchQuery('');
                                  }}
                                  className={cn(
                                    'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                                    workflowFilter === 'all'
                                      ? 'bg-gray-800/30 text-white'
                                      : 'text-white/60 hover:bg-gray-800/30 hover:text-white'
                                  )}
                                >
                                  All Workflows
                                </button>

                                {/* Filtered Workflow Options */}
                                {getUniqueWorkflows()
                                  .filter(wf =>
                                    workflowSearchQuery === '' ||
                                    wf.name.toLowerCase().includes(workflowSearchQuery.toLowerCase())
                                  )
                                  .map((wf) => (
                                    <button
                                      key={wf.id}
                                      onClick={() => {
                                        setWorkflowFilter(wf.id);
                                        setWorkflowDropdownOpen(false);
                                        setWorkflowSearchQuery('');
                                      }}
                                      className={cn(
                                        'w-full text-left px-3 py-2 text-sm rounded-md transition-colors truncate',
                                        workflowFilter === wf.id
                                          ? 'bg-gray-800/30 text-white'
                                          : 'text-white/60 hover:bg-gray-800/30 hover:text-white'
                                      )}
                                    >
                                      {wf.name}
                                    </button>
                                  ))
                                }

                                {/* No results */}
                                {workflowSearchQuery !== '' &&
                                  getUniqueWorkflows().filter(wf =>
                                    wf.name.toLowerCase().includes(workflowSearchQuery.toLowerCase())
                                  ).length === 0 && (
                                    <p className="px-3 py-2 text-xs text-gray-500 text-center">
                                      No workflows found
                                    </p>
                                  )
                                }
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  {/* Time Range Filter */}
                  <div className="flex items-center gap-1">
                    {loadingExecutions && <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-500 mr-1" />}
                    <div className="flex gap-0.5 bg-gray-800 rounded-lg p-0.5">
                      {(['24h', '7d', '30d'] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => { setTimeRange(range); refetchExecutions(range); }}
                          className={cn(
                            'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                            timeRange === range
                              ? 'bg-white text-black'
                              : 'text-white/60 hover:text-white hover:bg-gray-700'
                          )}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution List */}
              <div className="p-4">
                {executionsLoading ? (
                  <UnifiedSkeleton count={5} />
                ) : executionsError ? (
                  !instance?.n8n_api_key ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-2xl bg-gray-800/30 flex items-center justify-center mx-auto mb-4">
                        <Key className="h-8 w-8 text-gray-500" />
                      </div>
                      <h3 className="text-white font-medium mb-2">n8n API Key Required</h3>
                      <p className="text-gray-400 text-sm max-w-md mx-auto mb-4">
                        To view execution history, add your n8n API key in settings.
                      </p>
                      <button
                        onClick={() => setActiveTab('settings')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                        Go to Settings
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 bg-gray-800/30 border border-gray-700 rounded-xl">
                      <AlertTriangle className="h-5 w-5 text-white/50 flex-shrink-0" />
                      <div>
                        <p className="text-white/50 text-sm font-medium">Unable to load executions</p>
                        <p className="text-white/40 text-xs mt-1">{executionsError}</p>
                      </div>
                    </div>
                  )
                ) : getFilteredExecutions().length === 0 ? (
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
                       'No executions yet'}
                    </p>
                    <p className="text-gray-600 text-sm mt-1">
                      {executionFilter !== 'all' ? 'Try changing the filter' : 'Run a workflow to see activity here'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {getFilteredExecutions().map((exec, index) => (
                      <motion.div
                        key={exec.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="flex items-center gap-4 p-4 bg-gray-800/30 rounded-xl hover:bg-gray-800/30 transition-all group cursor-pointer"
                        onClick={() => handleExecutionClick(exec)}
                        title="Click to view execution output"
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
                            <Clock className="h-5 w-5 text-white/60 animate-pulse" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{exec.workflowName || 'Workflow Execution'}</p>
                          <p className="text-gray-500 text-sm">ID: {exec.id}</p>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            'inline-block px-2.5 py-1 text-xs font-medium rounded-full mb-1',
                            exec.status === 'success' ? 'bg-green-500/20 text-green-400' :
                            exec.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-gray-800/30 text-white/60'
                          )}>
                            {exec.status === 'success' ? 'Success' : exec.status === 'error' ? 'Failed' : 'Running'}
                          </span>
                          <p className="text-gray-500 text-xs">{formatTimestamp(exec.startedAt)}</p>
                          <p className="text-gray-600 text-xs">{formatRelativeTime(exec.startedAt)}</p>
                        </div>
                        {/* n8n Direct Link - Agency only */}
                        {(isOwner || isAgencyManager) && instance && (
                          <a
                            href={`${instance.instance_url.replace(/\/$/, '')}/workflow/${exec.workflowId}/executions/${exec.id}`}
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
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Workflows with Component Gallery */}
            <div id="workflows-section" className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/30 transition-all">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Workflows & UI Components</h3>
                    <p className="text-sm text-gray-500">{workflows.length} workflows · {widgets.length} components</p>
                  </div>
                </div>
                {!apiKey && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl transition-all"
                  >
                    <Key className="h-4 w-4" /> Add API Key
                  </button>
                )}
              </div>


              {!apiKey ? (
                <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
                  <Key className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">Connect your n8n instance</p>
                  <p className="text-gray-600 text-sm mb-4">Add your n8n API key to see workflows and create UI components</p>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl text-sm font-medium transition-all"
                  >
                    Go to Settings
                  </button>
                </div>
              ) : (() => {
                if (workflowsLoading) {
                  return <UnifiedSkeleton count={6} />;
                }

                if (workflows.length === 0) {
                  // Show importing state when no workflows exist yet
                  if (importingTemplate) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                        <p className="text-gray-400 text-sm">Importing workflow...</p>
                      </div>
                    );
                  }

                  return (
                    <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
                      <Zap className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                      <p className="text-gray-400">No workflows found</p>
                      <p className="text-gray-600 text-sm">Create workflows in n8n with webhook triggers</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {/* Template Updates Available Banner */}
                    <TemplateUpdatesSection
                      updates={templateUpdates}
                      onViewAllClick={() => setUpdatesListModalOpen(true)}
                    />
                    {/* Show importing indicator at top when there are existing workflows */}
                    {importingTemplate && (
                      <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                        <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                        <p className="text-purple-400 text-sm">Importing workflow...</p>
                      </div>
                    )}
                    {/* Shared WorkflowList component */}
                    <WorkflowList
                      workflows={workflowListItems}
                      connectedCredentials={connectedCredentialsForList}
                      expandedWorkflows={expandedWorkflows}
                      togglingWorkflow={togglingWorkflow}
                      deletingWorkflow={deletingWorkflow}
                      templateUpdates={templateUpdatesMap}
                      onToggleExpand={handleWorkflowToggleExpand}
                      onToggleWorkflow={handleWorkflowToggle}
                      onDeleteWorkflow={handleWorkflowDelete}
                      onAddComponent={(isOwner || isAgencyManager) ? handleAddComponent : undefined}
                      onAddCredential={handleAddCredentialFromList}
                      onConfigureCredential={handleConfigureCredential}
                      onOpenMissingCredentials={handleOpenMissingCredentials}
                      onWidgetClick={handleWorkflowWidgetClick}
                      onUnlinkWidget={handleUnlinkWidget}
                      onUpdateTemplate={handleUpdateTemplateFromList}
                      accessToken={session?.access_token}
                      showN8nLink={isOwner || isAgencyManager}
                    />

                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}

        {/* Widgets Tab */}
        {activeTab === 'widgets' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gray-900/50 border border-gray-800 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-gray-400" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white">UI Components</h2>
                </div>
                <p className="text-gray-400 text-sm">
                  Manage embeddable UI components for this instance
                </p>
              </div>
              <button
                onClick={refreshWidgets}
                disabled={refreshingWidgets}
                className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all disabled:opacity-50"
                title="Refresh components"
              >
                <RefreshCw className={cn("h-4 w-4", refreshingWidgets && "animate-spin")} />
              </button>
            </div>

            {/* Level 1: Main Tabs & Search */}
            <div className="flex flex-col sm:flex-row gap-4 mb-3">
              {/* Tab Pills - Level 1 */}
              <div className="flex-1 flex flex-wrap items-center gap-2">
                {(isOwner || isAgencyManager) ? (
                  <>
                    {/* Owner/Agency Tabs: This Client | All */}
                    <button
                      onClick={() => setWidgetTab('instance')}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        widgetTab === 'instance'
                          ? 'bg-white text-black'
                          : 'bg-gray-900/50 text-gray-400 hover:text-white border border-gray-800'
                      )}
                    >
                      This Client
                      <span className={cn(
                        'ml-2 px-1.5 py-0.5 text-xs rounded-full',
                        widgetTab === 'instance'
                          ? 'bg-black/20 text-black'
                          : 'bg-gray-800 text-gray-500'
                      )}>
                        {widgets.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setWidgetTab('all')}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all group relative',
                        widgetTab === 'all'
                          ? 'bg-white text-black'
                          : 'bg-gray-900/50 text-gray-400 hover:text-white border border-gray-800'
                      )}
                      title="Clients cannot see this tab"
                    >
                      All
                      <span className={cn(
                        'ml-2 px-1.5 py-0.5 text-xs rounded-full',
                        widgetTab === 'all'
                          ? 'bg-black/20 text-black'
                          : 'bg-gray-800 text-gray-500'
                      )}>
                        {allAgencyWidgets.length || widgets.length}
                      </span>
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white/60 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Client can&apos;t see this
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Client view: just show their components */}
                    <span className="text-gray-400 text-sm">Your UI Components</span>
                  </>
                )}
              </div>

              {/* Search */}
              {widgets.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={widgetSearch}
                    onChange={(e) => setWidgetSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white text-sm"
                  />
                </div>
              )}
            </div>

            {/* Level 2: Linked Filter (swatch style) */}
            {(isOwner || isAgencyManager) && (
              <div className="flex items-center gap-1 mb-4">
                <span className="text-gray-500 text-xs mr-2">Filter:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'linked', label: 'Linked' },
                  { id: 'not-linked', label: 'Not Linked' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setLinkedFilter(filter.id as typeof linkedFilter)}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs font-medium transition-all',
                      linkedFilter === filter.id
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-500 hover:text-white/60'
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            {widgetsLoading ? (
              <UnifiedSkeleton count={6} />
            ) : widgets.length === 0 ? (
              <div className="text-center py-24">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gray-900/50 border border-gray-800 flex items-center justify-center">
                  <Layers className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No UI components assigned</h3>
                <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
                  {(isOwner || isAgencyManager)
                    ? 'Create UI components in UI Studio, then use the "All" tab to assign them to this client'
                    : 'No UI components have been assigned to this instance yet'}
                </p>
                {(isOwner || isAgencyManager) && (
                  <Link
                    href="/portal/ui-studio/editor"
                    target="_blank"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create First Component
                  </Link>
                )}
              </div>
            ) : getFilteredWidgets().length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-10 h-10 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">
                  {widgetSearch ? 'No UI components match your search' : (
                    linkedFilter === 'linked' ? 'No UI components linked to workflows'
                    : linkedFilter === 'not-linked' ? 'All UI components are linked to workflows'
                    : widgetTab === 'instance' ? 'No UI components assigned to this instance'
                    : 'No UI components found'
                  )}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {getFilteredWidgets().map((widget) => {
                  const linkedWorkflow = widget.workflow_id
                    ? workflows.find(wf => String(wf.id) === String(widget.workflow_id))
                    : undefined;
                  return (
                    <div
                      key={widget.id}
                      className="group bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 hover:bg-gray-800/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        {/* Type Icon */}
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center',
                          widget.widget_type === 'button'
                            ? 'bg-gray-800/30'
                            : widget.widget_type === 'chatbot'
                            ? 'bg-purple-500/20'
                            : 'bg-gray-800/30'
                        )}>
                          {widget.widget_type === 'button' ? (
                            <MousePointer className="h-6 w-6 text-white/60" />
                          ) : widget.widget_type === 'chatbot' ? (
                            <MessageSquare className="h-6 w-6 text-purple-400" />
                          ) : (
                            <FileText className="h-6 w-6 text-white/60" />
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {(() => {
                            const template = templates.find(t => t.id === (widget as any).template_id);
                            return template?.category ? (
                              <span
                                className="px-3 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${template.category.color}15`,
                                  color: template.category.color,
                                }}
                              >
                                {template.category.name}
                              </span>
                            ) : null;
                          })()}
                          {linkedWorkflow && (
                            <span className="flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded-full border border-green-500/20">
                              <Zap className="w-3 h-3" /> Active
                            </span>
                          )}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setWidgetMenuOpen(widgetMenuOpen === widget.id ? null : widget.id);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {widgetMenuOpen === widget.id && (
                              <div
                                className="absolute right-0 top-full mt-1 w-52 py-1.5 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Component Status toggle */}
                                <button
                                  onClick={() => {
                                    handleWidgetUpdate(widget.id, { is_active: !widget.is_active });
                                    setWidgetMenuOpen(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-white/60 hover:text-white hover:bg-gray-800 flex items-center justify-between gap-2"
                                >
                                  <span className="flex items-center gap-3">
                                    <ToggleLeft className="w-4 h-4 flex-shrink-0" />
                                    Component Status
                                  </span>
                                  <span className={cn(
                                    'px-1.5 py-0.5 text-xs rounded font-medium shrink-0',
                                    widget.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'
                                  )}>
                                    {widget.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </button>

                                <div className="mx-3 my-1 border-t border-gray-800" />

                                {/* Share section */}
                                <p className="px-4 pt-1 pb-0.5 text-xs text-gray-500 font-semibold uppercase tracking-wide">Share</p>
                                <button
                                  onClick={() => {
                                    copyToClipboard(getWidgetLink(widget.id), `link-${widget.id}`);
                                    setWidgetMenuOpen(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-white/60 hover:text-white hover:bg-gray-800 flex items-center gap-3"
                                >
                                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                                  Direct Link
                                </button>
                                <button
                                  onClick={() => {
                                    const link = getWidgetLink(widget.id);
                                    copyToClipboard(`<iframe src="${link}" width="100%" height="500" frameborder="0" style="border:none;border-radius:8px;"></iframe>`, `iframe-${widget.id}`);
                                    setWidgetMenuOpen(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-white/60 hover:text-white hover:bg-gray-800 flex items-center gap-3"
                                >
                                  <Code className="w-4 h-4 flex-shrink-0" />
                                  iFrame Embed
                                </button>
                                <button
                                  onClick={() => {
                                    copyToClipboard(getWidgetEmbedCode(widget.id), `js-${widget.id}`);
                                    setWidgetMenuOpen(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-white/60 hover:text-white hover:bg-gray-800 flex items-center gap-3"
                                >
                                  <Braces className="w-4 h-4 flex-shrink-0" />
                                  JavaScript
                                </button>
                                <button
                                  onClick={() => {
                                    const link = getWidgetLink(widget.id);
                                    copyToClipboard(`<a href="${link}" target="_blank" rel="noopener noreferrer">${widget.name}</a>`, `html-${widget.id}`);
                                    setWidgetMenuOpen(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-white/60 hover:text-white hover:bg-gray-800 flex items-center gap-3"
                                >
                                  <Globe className="w-4 h-4 flex-shrink-0" />
                                  HTML Link
                                </button>
                                <button
                                  onClick={() => {
                                    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getWidgetLink(widget.id))}`, '_blank');
                                    setWidgetMenuOpen(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-white/60 hover:text-white hover:bg-gray-800 flex items-center gap-3"
                                >
                                  <QrCode className="w-4 h-4 flex-shrink-0" />
                                  QR Code
                                </button>

                                <div className="mx-3 my-1 border-t border-gray-800" />

                                {/* Edit + workflow + client actions */}
                                {(isOwner || isAgencyManager) && (
                                  <Link
                                    href={`/portal/ui-studio/editor?widget=${widget.id}`}
                                    onClick={() => setWidgetMenuOpen(null)}
                                    className="w-full px-4 py-2.5 text-left text-sm text-white/60 hover:text-white hover:bg-gray-800 flex items-center gap-3"
                                  >
                                    <Pencil className="w-4 h-4 flex-shrink-0" />
                                    Edit in Studio
                                  </Link>
                                )}
                                {widget.workflow_id && (
                                  <button
                                    onClick={() => {
                                      setWidgetMenuOpen(null);
                                      handleUnlinkWidget(widget.id, widget.instance_id || '');
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-white/60 hover:text-white hover:bg-gray-800 flex items-center gap-3"
                                  >
                                    <Unlink className="w-4 h-4 flex-shrink-0" />
                                    Unlink Workflow
                                  </button>
                                )}
                                {widgetTab === 'all' && !widget.instance_id ? (
                                  <button
                                    onClick={() => {
                                      setWidgetMenuOpen(null);
                                      handleAddToClient(widget.id);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-purple-400 hover:text-purple-300 hover:bg-gray-800 flex items-center gap-3"
                                  >
                                    <Plus className="w-4 h-4 flex-shrink-0" />
                                    Add to Client
                                  </button>
                                ) : (isOwner || isAgencyManager) ? (
                                  <button
                                    onClick={() => {
                                      setWidgetMenuOpen(null);
                                      handleUnassignWidget(widget.id);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 flex items-center gap-3"
                                  >
                                    <Unlink className="w-4 h-4 flex-shrink-0" />
                                    Remove from Client
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <button
                        onClick={() => openWidgetPanel(widget)}
                        className="w-full text-left"
                      >
                        {/* Embed type pill */}
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium mb-2',
                          widget.widget_type === 'button'
                            ? 'bg-gray-800/30 text-white/60'
                            : widget.widget_type === 'chatbot'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-gray-800/30 text-white/60'
                        )}>
                          {widget.widget_type === 'button' ? 'Button' : widget.widget_type === 'chatbot' ? 'Chatbot' : 'Form'}
                          {widget.widget_type === 'form' && widget.form_fields && widget.form_fields.length > 0 && ` · ${widget.form_fields.length} fields`}
                        </span>
                        <h3 className={cn(
                          'text-white font-semibold mb-1 group-hover:text-white transition-colors leading-snug',
                          widget.name.length > 28 ? 'text-sm' : 'text-base'
                        )}>
                          {widget.name}
                        </h3>
                        {linkedWorkflow && (
                          <p className="text-gray-500 text-xs mb-3 truncate">
                            Linked: {linkedWorkflow.name}
                          </p>
                        )}
                        {widgetTab === 'all' && widget.instance && (
                          <div className="mb-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-md border border-purple-500/20 leading-tight">
                              {widget.instance.client_email && (
                                <><span className="truncate max-w-[90px]">{widget.instance.client_email}</span><span className="opacity-50 shrink-0">›</span></>
                              )}
                              <span className="truncate max-w-[90px]">{widget.instance.instance_name}</span>
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 text-xs">Click to edit</span>
                          <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <TemplatesTab
            templates={workflowTemplates}
            loading={!instance || workflowTemplatesLoading}
            agencyLogoUrl={agencyLogoUrl}
            mode="agency"
            importingTemplate={importingTemplate}
            importingTemplateId={importingTemplateId}
            onRefresh={fetchWorkflowTemplates}
            onSelectTemplate={(template) => {
              if (handlePreviewAction()) return;
              setSelectedTemplate(template);
              setTemplateDetailOpen(true);
            }}
            onImportTemplate={handleImportTemplate}
          />
        )}

        {/* Credentials Tab */}
        {activeTab === 'credentials' && (
          <CredentialsTab
            credentials={credentials}
            loading={!instance || credentialsLoading || !credentialsLoaded}
            refreshing={credentialsLoading || workflowsLoading}
            warning={credentialsWarning}
            missingCredentials={allCredentialsToAdd}
            agencyLogoUrl={agencyLogoUrl}
            instanceUrl={instance?.instance_url}
            hasApiKey={!!instance?.n8n_api_key}
            allowFullAccess={isOwner || isAgencyManager}
            isClientOwned={true}
            onRefresh={fetchCredentials}
            onAddCredential={(type) => {
              if (handlePreviewAction()) return;
              setPreselectedCredentialType(type ?? null);
              setAddCredentialOpen(true);
            }}
            onDeleteCredential={handleDeleteCredential}
            onNavigateToSettings={() => setActiveTab('settings')}
          />
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* WhatsApp Section */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-900/20 border border-green-800 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">WhatsApp</h3>
                    <p className="text-white/50 text-sm">Connected phone numbers</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openLinkWhatsAppModal}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-100 text-black rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add WhatsApp
                  </button>
                  <Link
                    href="/portal/services"
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/30 hover:bg-gray-800/30 border border-gray-700 rounded-lg text-xs text-white/70 hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Manage
                  </Link>
                </div>
              </div>

              {servicesLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-lg" />
                        <div className="flex-1">
                          <div className="h-3.5 w-32 bg-gray-700 rounded mb-2" />
                          <div className="h-3 w-20 bg-gray-700/60 rounded" />
                        </div>
                        <div className="h-5 w-20 bg-gray-700 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : servicesWhatsApp.length === 0 ? (
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-8 text-center">
                  <MessageSquare className="h-8 w-8 text-gray-500 mx-auto mb-3" />
                  <p className="text-white/50 text-sm mb-1">No WhatsApp numbers linked yet</p>
                  <p className="text-white/30 text-xs mb-4">Link a WhatsApp number to this instance</p>
                  <button
                    onClick={openLinkWhatsAppModal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Add WhatsApp
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {servicesWhatsApp.map((wa) => {
                    const statusCfg: Record<string, { label: string; className: string }> = {
                      connected:    { label: 'Connected',    className: 'text-green-400 bg-green-900/20 border-green-800' },
                      pending_scan: { label: 'Scan QR',      className: 'text-white/60 bg-gray-800/30 border-gray-700' },
                      connecting:   { label: 'Connecting',   className: 'text-white/60 bg-gray-800/30 border-gray-700' },
                      disconnected: { label: 'Disconnected', className: 'text-red-400 bg-red-900/20 border-red-800' },
                    };
                    const cfg = statusCfg[wa.status] || { label: wa.status, className: 'text-gray-400 bg-gray-800/30 border-gray-700' };
                    return (
                      <div key={wa.id} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 flex items-center gap-3">
                        <div className="p-1.5 bg-green-900/20 border border-green-800 rounded-lg flex-shrink-0">
                          <MessageSquare className="h-4 w-4 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {wa.display_name || wa.instance_name}
                          </p>
                          {wa.phone_number && (
                            <p className="text-white/40 text-xs">+{wa.phone_number}</p>
                          )}
                        </div>
                        <span className={`flex-shrink-0 text-xs font-medium border px-2 py-1 rounded-full ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
          isDedicated && !isPreviewMode ? (
            // Dedicated portal note
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="max-w-lg mx-auto">
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="h-8 w-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3">Payments for Client Portals Only</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Payment tracking is available for client portals, not for dedicated portals that come with your subscription.
                  </p>
                  <p className="text-gray-500 text-sm">
                    To use payment features, please invite clients to create their own client portals.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {paymentLoading || !paymentInfo ? (
                <UnifiedSkeleton count={5} />
              ) : !paymentInfo.stripeConnected ? (
              // Stripe not connected
              <div className="max-w-lg mx-auto">
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-800/30 flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="h-8 w-8 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Connect Stripe</h3>
                  <p className="text-gray-500 text-sm mb-2">
                    {paymentInfo?.isAgency
                      ? 'Connect your Stripe account to view transaction history with this client.'
                      : 'Your agency has not connected their Stripe account yet.'}
                  </p>
                  <p className="text-xs text-gray-500 mb-6">
                    Read-only access to view payments and invoices
                  </p>
                  {paymentInfo?.isAgency && (
                    <Link
                      href="/settings#stripe"
                      target="_blank"
                      className="inline-block px-5 py-2.5 bg-white hover:bg-gray-100 text-black font-medium rounded-xl transition-colors text-sm"
                    >
                      Connect Stripe
                    </Link>
                  )}
                </div>
              </div>
            ) : !client && paymentInfo?.isAgency ? (
              // No client assigned (agency view)
              <div className="max-w-lg mx-auto">
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-800/30 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-white/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No Client Assigned</h3>
                  <p className="text-gray-500 text-sm mb-6">
                    Assign a client to this instance first to link payment tracking.
                  </p>
                  <button
                    onClick={() => setActiveTab('overview')}
                    className="inline-block px-5 py-2.5 bg-white hover:bg-gray-100 text-black font-medium rounded-xl transition-colors text-sm"
                  >
                    Go to Overview
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Customer Info & Linking */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Linked Customer Card */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/30 transition-all">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                          <Users className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">Stripe Customer</h3>
                          <p className="text-sm text-gray-500">
                            {paymentInfo?.isAgency ? 'Link customer for tracking' : 'Your billing account'}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] bg-gray-800 text-gray-500 rounded-full">
                        Read-only
                      </span>
                    </div>

                    {paymentInfo?.customer ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-medium">
                              {(paymentInfo.customer.email || paymentInfo.customer.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">
                                {paymentInfo.customer.name || paymentInfo.customer.email || 'Customer'}
                              </p>
                              {paymentInfo.customer.email && paymentInfo.customer.name && (
                                <p className="text-sm text-gray-500 truncate">{paymentInfo.customer.email}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-green-500/20 flex items-center justify-between">
                            <span className="text-xs text-gray-500">Customer ID</span>
                            <code className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                              {paymentInfo.customer.id}
                            </code>
                          </div>
                        </div>

                        {paymentInfo.isAgency && (
                          <button
                            onClick={handleUnlinkCustomer}
                            disabled={linkingCustomer}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 rounded-lg transition-all"
                          >
                            {linkingCustomer ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Unlink className="h-4 w-4" />
                            )}
                            Unlink Customer
                          </button>
                        )}
                      </div>
                    ) : paymentInfo?.isAgency ? (
                      // Customer selector for agency
                      <div className="space-y-4">
                        <div className="relative">
                          <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            onFocus={() => {
                              setCustomerDropdownOpen(true);
                              if (availableCustomers.length === 0) {
                                fetchAvailableCustomers();
                              }
                            }}
                            placeholder="Search by email or enter customer ID..."
                            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white transition-all"
                          />

                          <AnimatePresence>
                            {customerDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute z-20 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden"
                              >
                                {customersLoading ? (
                                  <div className="p-4 flex items-center justify-center">
                                    <RefreshCw className="h-5 w-5 text-gray-500 animate-spin" />
                                  </div>
                                ) : availableCustomers.length === 0 ? (
                                  <div className="p-4 text-center text-gray-500 text-sm">
                                    {customerSearch ? 'No customers found' : 'Loading customers...'}
                                  </div>
                                ) : (
                                  <div className="max-h-64 overflow-y-auto">
                                    {availableCustomers
                                      .filter(c =>
                                        !customerSearch ||
                                        c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                        c.id.includes(customerSearch)
                                      )
                                      .slice(0, 10)
                                      .map((cust) => (
                                        <button
                                          key={cust.id}
                                          onClick={() => handleLinkCustomer(cust.id)}
                                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-800/30 transition-all text-left"
                                        >
                                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-medium">
                                            {(cust.email || cust.name || '?').charAt(0).toUpperCase()}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm truncate">
                                              {cust.name || cust.email || 'Unknown'}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                              {cust.email || cust.id}
                                            </p>
                                          </div>
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Direct ID entry */}
                        {customerSearch.startsWith('cus_') && (
                          <button
                            onClick={() => handleLinkCustomer(customerSearch)}
                            disabled={linkingCustomer}
                            className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-700 disabled:text-gray-600 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                          >
                            {linkingCustomer ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                            Link Customer ID
                          </button>
                        )}

                        <p className="text-xs text-gray-500 text-center">
                          Search customers by email or paste a customer ID (cus_xxx)
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-xl text-center">
                        <p className="text-gray-500 text-sm">
                          No customer linked yet
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Info Box */}
                  <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                    <div className="flex gap-3">
                      <DollarSign className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-gray-500">
                        {paymentInfo?.isAgency ? (
                          <>
                            <p className="mb-1"><span className="text-gray-400 font-medium">Read-only access</span> - Link a Stripe customer to view their payment history.</p>
                            <p>Both you and your client can see transaction history here.</p>
                          </>
                        ) : (
                          <p>View your payment history and invoices from your agency here (read-only).</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Transaction History */}
                <div className="lg:col-span-2">
                  <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/30 transition-all">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">Transaction History</h3>
                          <p className="text-sm text-gray-500">
                            {paymentInfo?.transactions?.length || 0} transactions
                          </p>
                        </div>
                      </div>
                      {paymentInfo?.customer && (
                        <button
                          onClick={() => fetchPaymentInfo()}
                          className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {!paymentInfo?.customer ? (
                      <div className="py-12 text-center">
                        <div className="w-12 h-12 rounded-xl bg-gray-800/30 flex items-center justify-center mx-auto mb-4">
                          <FileText className="h-6 w-6 text-gray-500" />
                        </div>
                        <p className="text-gray-500 text-sm">
                          {paymentInfo?.isAgency
                            ? 'Link a customer to view their transaction history'
                            : 'No payment history available'}
                        </p>
                      </div>
                    ) : paymentInfo.transactions.length === 0 ? (
                      <div className="py-12 text-center">
                        <div className="w-12 h-12 rounded-xl bg-gray-800/30 flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="h-6 w-6 text-gray-500" />
                        </div>
                        <p className="text-gray-500 text-sm">No transactions yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                        {paymentInfo.transactions.map((txn, index) => (
                          <motion.div
                            key={txn.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="flex items-center justify-between p-4 bg-gray-800/30 border border-gray-700 rounded-xl hover:border-gray-600 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                txn.status === 'succeeded' || txn.status === 'paid'
                                  ? 'bg-green-500/20'
                                  : txn.status === 'pending'
                                    ? 'bg-gray-800/30'
                                    : 'bg-gray-800/30'
                              )}>
                                {txn.type === 'payment' ? (
                                  <CreditCard className={cn(
                                    'h-5 w-5',
                                    txn.status === 'succeeded' ? 'text-green-400' :
                                    txn.status === 'pending' ? 'text-white/60' : 'text-gray-500'
                                  )} />
                                ) : (
                                  <FileText className={cn(
                                    'h-5 w-5',
                                    txn.status === 'paid' ? 'text-green-400' :
                                    txn.status === 'open' ? 'text-white/60' : 'text-gray-500'
                                  )} />
                                )}
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">{txn.description}</p>
                                <p className="text-xs text-gray-500">
                                  {formatDate(txn.created)} · {txn.type === 'payment' ? 'Payment' : 'Invoice'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-white font-medium">
                                  {formatCurrency(txn.amount, txn.currency)}
                                </p>
                                <span className={cn(
                                  'text-xs',
                                  txn.status === 'succeeded' || txn.status === 'paid'
                                    ? 'text-green-400'
                                    : txn.status === 'pending' || txn.status === 'open'
                                      ? 'text-white/60'
                                      : 'text-gray-500'
                                )}>
                                  {txn.status}
                                </span>
                              </div>
                              {(txn.receiptUrl || txn.invoiceUrl) && (
                                <a
                                  href={txn.receiptUrl || txn.invoiceUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-all"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
          )
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Two Column Layout: Client Access + API Key | AI Payer */}
            {(isOwner || isAgencyManager) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left Column: Client Access + API Key stacked */}
                <div className="space-y-6">
                  {/* Client Access Card */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/30 transition-all">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                          <Users className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">Client Access</h3>
                          <p className="text-sm text-gray-500">Manage who can access this instance</p>
                        </div>
                      </div>
                      {client && !editingClient && !isDedicated && (
                        <button
                          onClick={() => { setEditingClient(true); setInviteEmail(client.email); }}
                          className="p-2 text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {isDedicated ? (
                      <div className="p-3 bg-green-900/10 border border-green-800/30 rounded-xl flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                        <p className="text-sm text-green-400">Payments are for client portals and not included in the dedicated portal</p>
                      </div>
                    ) : client && !editingClient ? (
                      <div className="flex items-center gap-4 p-4 bg-gray-800/30 border border-gray-700 rounded-xl">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-lg">
                          {client.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{client.email}</p>
                          <p className="text-sm text-gray-500">Client User</p>
                        </div>
                        <span className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-full',
                          client.status === 'accepted'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gray-800/30 text-white/60 border border-gray-700'
                        )}>
                          {client.status === 'accepted' ? 'Active' : 'Pending Invite'}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="client@email.com"
                            className="flex-1 px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white transition-all"
                          />
                          <button
                            onClick={handleAssignClient}
                            disabled={!inviteEmail || sendingInvite}
                            className="px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-xl transition-all flex items-center gap-2"
                          >
                            {sendingInvite ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Invite</>}
                          </button>
                        </div>
                        {editingClient && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditingClient(false); setInviteEmail(''); }}
                              className="flex-1 px-3 py-2 border border-gray-700 hover:bg-gray-800 text-gray-400 rounded-xl text-sm transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleRemoveClient}
                              disabled={sendingInvite}
                              className="px-4 py-2 border border-gray-700 hover:bg-red-500/10 hover:border-red-500/50 text-gray-400 hover:text-red-400 rounded-xl text-sm transition-all"
                            >
                              Remove Access
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* n8n API Key Card */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/30 transition-all">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                          <Key className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">n8n API Key</h3>
                          <p className="text-sm text-gray-500">Connect to your n8n instance</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowApiKeyHelp(!showApiKeyHelp)}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                          title="How to get your n8n API key"
                        >
                          <HelpCircle className="h-5 w-5" />
                        </button>
                        {apiKey && (
                          <span className={cn(
                            'px-3 py-1 text-xs font-medium rounded-full border flex items-center gap-1.5',
                            apiVerified === true
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : apiVerified === false
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : workflowsLoading
                                  ? 'bg-gray-800/30 text-gray-400 border-gray-700'
                                  : 'bg-gray-800/30 text-white/60 border-gray-700'
                          )}>
                            {apiVerified === true ? (
                              'Connected'
                            ) : apiVerified === false ? (
                              'Error'
                            ) : workflowsLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Verifying...
                              </>
                            ) : (
                              'Not verified'
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Help Section */}
                    <AnimatePresence>
                      {showApiKeyHelp && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-5 p-4 bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden"
                        >
                          <h4 className="text-white font-medium mb-3">How to get your n8n API key:</h4>
                          <ol className="text-sm text-white/60 space-y-2 list-decimal list-inside mb-4">
                            <li>Open your n8n instance dashboard</li>
                            <li>Click on your profile icon in the bottom left</li>
                            <li>Select <span className="text-white font-medium">Settings</span></li>
                            <li>Navigate to <span className="text-white font-medium">API</span> section</li>
                            <li>Click <span className="text-white font-medium">Create an API key</span></li>
                            <li>Copy the generated key and paste it below</li>
                          </ol>
                          {instance?.instance_url && (
                            <a
                              href={`${instance.instance_url}/settings/api`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Open n8n API Settings
                            </a>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {apiError && (
                      <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                        <p className="text-red-400 text-sm">{apiError}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => { setApiKey(e.target.value); setApiVerified(null); setApiError(null); }}
                          placeholder="Enter your n8n API key"
                          className="w-full px-4 py-3 bg-gray-800/30 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white pr-12 transition-all"
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-purple-400 rounded-lg transition-colors"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <button
                        onClick={handleSaveApiKey}
                        disabled={savingApiKey}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-xl transition-all"
                      >
                        {savingApiKey ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Save'}
                      </button>
                    </div>

                    {/* External Instance URL Input */}
                    <AnimatePresence>
                      {showExternalInput && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 overflow-hidden"
                        >
                          <label className="block text-sm text-gray-400 mb-2">External n8n Instance URL</label>
                          <input
                            type="url"
                            value={externalUrl}
                            onChange={(e) => { setExternalUrl(e.target.value); setApiVerified(null); setApiError(null); }}
                            placeholder="https://your-n8n-instance.com"
                            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-2">Enter the URL of your self-hosted n8n instance</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Use External Instance Link */}
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <button
                        onClick={() => setShowExternalInput(!showExternalInput)}
                        className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        {showExternalInput ? '← Use hosted instance' : 'Use an external instance →'}
                      </button>
                    </div>

                    {/* Direct link to n8n API settings */}
                    {instance?.instance_url && !showExternalInput && (
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <a
                          href={`${instance.instance_url}/settings/api`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-800/30 hover:bg-gray-800/30 border border-gray-700 hover:border-gray-600 rounded-xl text-sm text-white/60 hover:text-white transition-all"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {apiVerified === true ? 'Manage API Key in n8n' : 'Get API Key from n8n'}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Link WhatsApp Modal */}
      {linkWhatsAppOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Add WhatsApp</h3>
              <button onClick={() => setLinkWhatsAppOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            {loadingAvailableWA ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
              </div>
            ) : availableWhatsApp.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm mb-2">No available WhatsApp numbers</p>
                <p className="text-white/25 text-xs mb-4">All your numbers are already linked to instances</p>
                <Link href="/portal/services" className="text-white/60 text-sm underline hover:text-white">
                  Manage WhatsApp numbers
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {availableWhatsApp.map(wa => (
                  <button
                    key={wa.id}
                    onClick={() => handleLinkWhatsApp(wa.id)}
                    disabled={linkingWA}
                    className="w-full p-4 rounded-lg border transition-all text-left bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/30 disabled:opacity-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{wa.display_name || wa.instance_name}</p>
                        {wa.phone_number && <p className="text-white/40 text-xs">+{wa.phone_number}</p>}
                      </div>
                      {linkingWA && <Loader2 className="h-4 w-4 text-white/40 animate-spin" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* component preview Modal */}
      <WidgetPreviewModal
        isOpen={widgetModalOpen}
        widget={selectedWidget}
        onClose={() => {
          setWidgetModalOpen(false);
          setSelectedWidget(null);
        }}
        onToggleStatus={async (widgetId, isActive) => {
          await handleWidgetUpdate(widgetId, { is_active: isActive });
        }}
        onLinkWorkflow={(widget) => {
          setSelectedWidget(widget as unknown as Widget);
          setLinkWidgetModalOpen(true);
        }}
        onUnlinkWorkflow={async (widgetId) => {
          await handleWidgetUpdate(widgetId, { workflow_id: null } as any);
        }}
        onRemoveFromClient={async (widgetId) => {
          await handleUnassignWidget(widgetId);
        }}
        showRemoveFromClient={widgetTab === 'instance' && (isOwner || isAgencyManager)}
        isProcessing={deletingWidget === selectedWidget?.id}
      />

      {/* Template Picker - Only show widgets NOT already assigned to this instance */}
      <TemplatePicker
        isOpen={templatePickerOpen}
        onClose={() => { setTemplatePickerOpen(false); setSelectedWorkflow(null); }}
        onSelect={handleTemplateSelect}
        templates={templates.filter(t => !t.instance_id || t.instance_id !== instanceId)}
        categories={categories}
        isLoading={templatesLoading}
        isSaving={savingWidget}
        workflowName={selectedWorkflow?.name}
      />

      {/* Link Component Modal */}
      <AnimatePresence>
        {linkWidgetModalOpen && selectedWorkflow && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
              onClick={() => { setLinkWidgetModalOpen(false); setSelectedWorkflow(null); }}
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
                      onClick={() => { setLinkWidgetModalOpen(false); setSelectedWorkflow(null); }}
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
                      { id: 'instance', label: 'This Instance', count: widgets.length, show: true },
                      { id: 'in-use', label: 'Linked', count: getWidgetsInUse().length, show: isOwner || isAgencyManager },
                      { id: 'all', label: 'All', count: allAgencyWidgets.length || widgets.length, show: isOwner || isAgencyManager },
                    ].filter(tab => tab.show).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setLinkWidgetTab(tab.id as typeof linkWidgetTab)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
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
                            <p className="text-gray-500 text-sm">
                              {widget.widget_type === 'button' ? 'Button' : widget.widget_type === 'chatbot' ? 'Chatbot' : 'Form'}
                              {widget.widget_type === 'form' && widget.form_fields?.length > 0 && ` · ${widget.form_fields.length} fields`}
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
                      <p className="text-white/60 text-sm">No UI components found</p>
                      <p className="text-gray-500 text-xs mt-1">
                        {linkWidgetTab === 'in-use' ? 'No UI components are currently linked to workflows' : 'Create UI components in the UI Components tab'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Workflow Picker Modal - for assigning widget to workflow from 3-dot menu */}
        {workflowPickerWidget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              onClick={() => setWorkflowPickerWidget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-gray-900/95 border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">Assign to Workflow</h2>
                    <p className="text-sm text-white/60 mt-1">
                      Widget: <span className="text-white">{workflowPickerWidget.name}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setWorkflowPickerWidget(null)}
                    className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 max-h-80 overflow-y-auto">
                {workflows.length === 0 ? (
                  <div className="text-center py-8">
                    <Zap className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No workflows available</p>
                    <p className="text-gray-500 text-xs mt-1">Add your n8n API key to see workflows</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workflows.filter(w => w.webhookUrl).length === 0 ? (
                      <div className="text-center py-8">
                        <AlertTriangle className="w-10 h-10 text-white/50 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">No workflows with webhook triggers</p>
                        <p className="text-gray-500 text-xs mt-1">Add a Webhook or Chat Trigger node to your workflow</p>
                      </div>
                    ) : (
                      workflows.filter(w => w.webhookUrl).map((workflow) => (
                        <button
                          key={workflow.id}
                          onClick={() => assignWidgetToWorkflow(workflow.id)}
                          className="w-full p-4 rounded-lg border border-gray-800 hover:border-gray-700 hover:bg-gray-800/30 text-left transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${workflow.active ? 'bg-green-500/20' : 'bg-gray-800/30'}`}>
                              <Zap className={`w-5 h-5 ${workflow.active ? 'text-green-400' : 'text-gray-500'}`} />
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">{workflow.name}</p>
                              <p className="text-gray-500 text-xs">{workflow.active ? 'Active' : 'Inactive'}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-400 transition-colors" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Template Detail Modal */}
      <TemplateDetailModal
        isOpen={templateDetailOpen}
        template={selectedTemplate}
        onClose={() => {
          setTemplateDetailOpen(false);
          setSelectedTemplate(null);
        }}
        onImport={(template, credentialSelections) => handleImportTemplate(template as WorkflowTemplate, credentialSelections)}
        isImporting={importingTemplate}
      />

      {/* Template Update Modal (for single workflow update) */}
      {selectedUpdate && (
        <TemplateUpdateModal
          isOpen={updateModalOpen}
          onClose={() => {
            setUpdateModalOpen(false);
            setSelectedUpdate(null);
          }}
          importId={selectedUpdate.importId}
          workflowId={selectedUpdate.workflowId}
          workflowName={selectedUpdate.workflowName}
          templateName={selectedUpdate.templateName}
          installedVersion={selectedUpdate.installedVersion}
          latestVersion={selectedUpdate.latestVersion}
          changelog={selectedUpdate.changelog}
          instanceId={instanceId}
          accessToken={session?.access_token || ''}
          onUpdateComplete={handleUpdateComplete}
        />
      )}

      {/* Template Updates List Modal (for viewing/updating all) */}
      <TemplateUpdatesListModal
        isOpen={updatesListModalOpen}
        onClose={() => setUpdatesListModalOpen(false)}
        updates={templateUpdates}
        accessToken={session?.access_token || ''}
        onUpdateComplete={handleUpdateComplete}
      />

      {/* Add Credential Modal */}
      <AddCredentialModal
        isOpen={addCredentialOpen}
        onClose={() => {
          setAddCredentialOpen(false);
          setPreselectedCredentialType(null);
        }}
        onAdd={async (type, name, data) => {
          const res = await fetch('/api/client/credentials', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              instanceId,
              type,
              name,
              data,
            }),
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to create credential');
          }
          handleCredentialCreated(name, type);
        }}
        fetchSchema={async (type) => {
          const res = await fetch(`/api/client/credentials/schema/${encodeURIComponent(type)}?instanceId=${instanceId}`, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || 'Failed to fetch schema' };
          }
          return { schema: data.schema, docUrl: data.docUrl };
        }}
        preselectedType={preselectedCredentialType}
        instanceUrl={instance?.instance_url}
        instanceId={instanceId}
        accessToken={session?.access_token}
        allowFullAccess={true}
        requiredTypes={[
          ...credentials.map(c => c.type),
          ...allCredentialsToAdd.map(m => m.type),
          'flowEngineApi' // Always allow adding FlowEngine LLM custom keys
        ]}
        existingCredentials={credentials}
      />

      {/* Missing Credentials Modal (after import) */}
      <MissingCredentialsModal
        isOpen={missingCredsModalOpen}
        onClose={() => {
          setMissingCredsModalOpen(false);
          setMissingCredsWorkflowName('');
          setMissingCredsList([]);
          setAddedCredTypes([]);
        }}
        workflowName={missingCredsWorkflowName}
        missingCredentials={missingCredsList}
        onAddCredential={(type) => {
          setPreselectedCredentialType(type);
          setAddCredentialOpen(true);
        }}
        addedCredentials={addedCredTypes}
      />

      {/* Credential Parameter Modal */}
      <CredentialParameterModal
        isOpen={credentialParamOpen}
        onClose={() => {
          setCredentialParamOpen(false);
          setSelectedCredentialParam(null);
          setCredentialParamWorkflow(null);
        }}
        onSave={async (nodeId, parameters) => {
          if (!session || !credentialParamWorkflow) {
            throw new Error('No session or workflow selected');
          }

          const res = await fetch(`/api/client/workflows/${credentialParamWorkflow.id}/parameters`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ nodeId, parameters, instanceId }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to save parameters');
          }

          fetchWorkflows();
          setToast({ type: 'success', message: 'Configuration saved successfully' });
        }}
        paramInfo={selectedCredentialParam}
        workflowName={credentialParamWorkflow?.name}
      />

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
                      <Clock className="h-4 w-4 text-white/60" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{selectedExecution.workflowName}</h3>
                    <p className="text-gray-500 text-xs">Execution #{selectedExecution.id}</p>
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
                        <p className="text-gray-500 text-xs mb-1">Status</p>
                        <p className={cn(
                          'text-sm font-medium',
                          executionDetail.status === 'success' ? 'text-green-400' :
                          executionDetail.status === 'error' ? 'text-red-400' : 'text-white/60'
                        )}>
                          {executionDetail.status === 'success' ? 'Success' :
                           executionDetail.status === 'error' ? 'Failed' : 'Running'}
                        </p>
                      </div>
                      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                        <p className="text-gray-500 text-xs mb-1">Started</p>
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
                        <p className="text-gray-500 text-sm">No output data available</p>
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

      {/* Demo Mode Modal */}
      <AnimatePresence>
        {demoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDemoModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <Eye className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Demo Mode
                  </h3>
                  <p className="text-sm text-gray-400">
                    This is a demonstration of Pro+ features with sample data
                  </p>
                </div>
              </div>

              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-white/60 mb-3">
                  You're exploring all the features available:
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Workflow automation & templates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Credential management & integrations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Custom UI components & widgets</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Client portal & sharing features</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setDemoModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
                >
                  Continue Exploring
                </button>
                <Link
                  href="/#pricing" target="_blank"
                  className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 text-center rounded-lg text-sm font-medium transition-colors"
                >
                  View Pricing
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

