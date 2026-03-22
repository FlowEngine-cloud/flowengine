// Shared types for Instance Dashboard (used by both agency client-panel and client-dashboard)

export interface InstanceData {
  id: string;
  name: string;
  url: string;
  status: string;
  storageLimitGb: number;
  apiKey?: string | null;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  createdAt?: string;
}

export interface Widget {
  id: string;
  name: string;
  widget_type: 'button' | 'form' | 'chatbot';
  webhook_url: string;
  form_fields: any[];
  chatbot_config?: any;
  is_active?: boolean;
  styles?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    buttonText?: string;
    inputBorderColor?: string;
  };
  workflow_id?: string | null;
  workflow_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  created_at?: string;
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes?: any[];
  tags?: { id: string; name: string }[];
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  startedAt: string;
  stoppedAt?: string;
  mode?: string;
}

export interface ExecutionMetrics {
  total: number;
  success: number;
  error: number;
  successRate: number;
}

export interface CredentialStatus {
  type: string;
  name: string;
  icon: string;
  status: 'available' | 'missing';
  docUrl?: string;
}

export interface WorkflowTemplate {
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
  version?: number;
}

export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  createdAt?: string;
  docUrl?: string;
}

export interface PaymentInfo {
  stripeConnected: boolean;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  totalSpent?: number;
  currency?: string;
  transactionCount?: number;
  transactions?: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    created: number;
    description?: string;
  }>;
}

export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
  created: number;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  preview_image_url?: string;
  widget_type: 'button' | 'form' | 'chatbot';
  form_fields: Array<{
    name: string;
    type: 'text' | 'email' | 'number' | 'textarea' | 'select';
    required: boolean;
    options?: string[];
  }> | null;
  default_webhook_path: string | null;
  category_id: string | null;
  category: { id: string; name: string; color: string } | null;
  instance_id: string | null;
  instance: { id: string; instance_name: string } | null;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  templates: Template[];
}

export interface ClientInfo {
  email: string;
  status: 'pending' | 'accepted';
  invite_id: string;
  created_at: string;
}

// Props for the shared InstanceDashboard component
export interface InstanceDashboardProps {
  // Mode: agency (viewing client's instance) or client (viewing own instance)
  mode: 'agency' | 'client';

  // Instance data
  instance: InstanceData;

  // Optional client info (for agency mode)
  client?: ClientInfo | null;

  // Permissions
  isOwner?: boolean;
  isAgencyManager?: boolean;
  isClientPaid?: boolean;
  canRemoveWatermark?: boolean;
  allowFullAccess?: boolean;

  // Agency info (for client mode)
  invitedBy?: string;
  agencyLogoUrl?: string | null;

  // Preview mode
  isPreview?: boolean;

  // Data
  widgets: Widget[];
  workflows: Workflow[];
  executions: Execution[];
  executionMetrics: ExecutionMetrics | null;

  // Callbacks
  onRefresh: () => void;
  accessToken?: string;
}

export type TabId = 'overview' | 'widgets' | 'templates' | 'credentials' | 'payment' | 'settings';
