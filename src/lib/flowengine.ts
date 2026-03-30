/**
 * FlowEngine API Client
 *
 * Used when connecting to FlowEngine's managed hosting service.
 * Provides managed n8n instances, AI workflows, WhatsApp, backups, and monitoring.
 *
 * Get your API key from your FlowEngine account at flowengine.cloud
 */

const FLOWENGINE_API_URL = 'https://flowengine.cloud';

// Matches the actual API response shape from /api/v1/n8n/instances
interface FlowEngineInstance {
  id: string;
  instance_name: string;
  instance_url: string;
  storage_gb: number;
  status: string;
  billing_cycle: 'monthly' | 'annual';
  service_type?: 'n8n' | 'openclaw' | 'website';
  created_at: string;
  updated_at?: string;
  is_external?: boolean; // true = user-connected external n8n, not FlowEngine-hosted
  coolify_status?: string;
  stripe_subscription_id?: string;
}

// Matches the actual API response shape from /api/v1/whatsapp/sessions
interface FlowEngineWhatsAppSession {
  instance_name: string;
  display_name: string;
  phone_number: string | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  qr_code: string | null;
  n8n_instance_id: string | null;
  created_at: string;
}

interface FlowEnginePricingTier {
  price: number;
  display: string;
  yearly?: string;
}

interface FlowEnginePricing {
  instances: Record<string, FlowEnginePricingTier>;
  whatsapp: Record<string, FlowEnginePricingTier>;
}

// Matches /api/v1/user response
interface FlowEngineUser {
  success: boolean;
  user_id: string;
  credits_remaining: number;
  tier: string;
  subscription_status: string;
}

class FlowEngineApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'FlowEngineApiError';
    this.status = status;
    this.code = code;
  }
}

class FlowEngineClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = FLOWENGINE_API_URL;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout for provisioning

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!res.ok) {
        // Read body once as text, then try to parse as JSON
        const text = await res.text();
        // If response is HTML (e.g. 404 page), the endpoint doesn't exist
        if (text.trimStart().startsWith('<')) {
          throw new FlowEngineApiError(res.status, 'not_found', `FlowEngine API endpoint not found (${res.status})`);
        }
        let errorData: any;
        try {
          errorData = JSON.parse(text);
        } catch {
          throw new FlowEngineApiError(res.status, 'unknown', text || `HTTP ${res.status}`);
        }
        throw new FlowEngineApiError(
          res.status,
          errorData.error || 'unknown',
          errorData.message || errorData.error || `HTTP ${res.status}`,
        );
      }

      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Test the API key by calling GET /api/v1/user.
   * Returns { ok: true } on success, { ok: false, error } on failure.
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const data = await this.request<FlowEngineUser>('GET', '/api/v1/user');
      if (data.success) {
        return { ok: true };
      }
      return { ok: false, error: 'Authentication failed' };
    } catch (err) {
      if (err instanceof FlowEngineApiError) {
        if (err.status === 401 || err.status === 403) {
          return { ok: false, error: 'Invalid API key — check your FlowEngine account' };
        }
        return { ok: false, error: err.message };
      }
      const msg = (err as Error)?.message || String(err);
      if (msg.includes('abort') || msg.includes('timeout')) {
        return { ok: false, error: 'Connection timed out — FlowEngine may be unreachable' };
      }
      if (msg.includes('fetch failed') || msg.includes('ENOTFOUND')) {
        return { ok: false, error: 'Could not reach flowengine.cloud — check your network' };
      }
      return { ok: false, error: msg };
    }
  }

  /** Fetch pricing for all services */
  async getPricing(): Promise<FlowEnginePricing> {
    const res = await this.request<{ success: boolean; pricing: FlowEnginePricing }>('GET', '/api/v1/pricing');
    return res.pricing;
  }

  // ==========================================
  // n8n Instances
  // ==========================================

  /** Provision a new managed n8n instance */
  async createInstance(opts: {
    instance_name: string;
    storage_gb: number;
    billing_cycle: 'monthly' | 'annual';
    coupon?: string;
  }): Promise<{ success: boolean; instance: FlowEngineInstance }> {
    return this.request('POST', '/api/v1/n8n/instances', opts);
  }

  /**
   * List all n8n instances — API returns { success, instances: [] }
   *
   * ⚠️ KNOWN ISSUE: Returns ALL instances under the FE account, including instances
   * provisioned for the FE account owner's clients. All share the same user_id.
   * The OSS cannot distinguish personal vs client-managed instances until FE exposes
   * a portal_client_id or is_client_instance field on the response.
   */
  async listInstances(): Promise<FlowEngineInstance[]> {
    const res = await this.request<{ success: boolean; instances: FlowEngineInstance[] }>('GET', '/api/v1/n8n/instances');
    return res.instances ?? [];
  }

  /** Get a single n8n instance — API returns { success, instance: {} } */
  async getInstance(id: string): Promise<FlowEngineInstance> {
    const res = await this.request<{ success: boolean; instance: FlowEngineInstance }>('GET', `/api/v1/n8n/instances/${id}`);
    return res.instance;
  }

  /** Delete an n8n instance (cancels Stripe subscription) */
  async deleteInstance(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/n8n/instances/${id}`);
  }

  /** Rename a managed instance */
  async renameInstance(id: string, newName: string): Promise<{ success: boolean; instance_name: string }> {
    return this.request('PATCH', `/api/v1/n8n/instances/${id}`, { instance_name: newName });
  }

  /** Start, stop, or restart an n8n instance */
  async manageInstance(id: string, action: 'start' | 'stop' | 'restart'): Promise<{ success: boolean; message: string }> {
    return this.request('POST', `/api/v1/n8n/instances/${id}/manage`, { action });
  }

  /** Fetch recent logs for a managed n8n instance */
  async getInstanceLogs(id: string, lines = 300): Promise<{ success: boolean; logs: string }> {
    return this.request('GET', `/api/v1/n8n/instances/${id}/logs?lines=${lines}`);
  }

  /** Get database credentials for a managed n8n instance */
  async getInstanceCredentials(id: string): Promise<{ success: boolean; credentials: { user: string; password: string; database: string; host: string; port: number } }> {
    return this.request('GET', `/api/v1/n8n/instances/${id}/credentials`);
  }

  /** Execute a SQL command against the instance's PostgreSQL database */
  async executeTerminal(id: string, command: string): Promise<{ success: boolean; output: string }> {
    return this.request('POST', `/api/v1/n8n/instances/${id}/terminal`, { command });
  }

  /** List backups for a managed n8n instance */
  async listBackups(id: string): Promise<{ success: boolean; backups: Array<{ id: string; fileName: string; fileSizeBytes: number; status: string; createdAt: string }> }> {
    return this.request('GET', `/api/v1/n8n/instances/${id}/backups`);
  }

  /** Create a backup for a managed n8n instance */
  async createBackup(id: string): Promise<{ success: boolean; backup: { id: string; fileName: string; fileSizeBytes?: number; status: string } }> {
    return this.request('POST', `/api/v1/n8n/instances/${id}/backups`, {});
  }

  // ==========================================
  // WhatsApp Sessions
  // ==========================================

  /**
   * Create a WhatsApp session.
   * Note: API uses `display_name` (not `instance_name`) as the identifier param.
   */
  async createWhatsAppSession(opts: {
    display_name: string;
    n8n_instance_id?: string;
  }): Promise<FlowEngineWhatsAppSession> {
    return this.request('POST', '/api/v1/whatsapp/sessions', opts);
  }

  /** List all WhatsApp sessions — API returns { success, sessions: [] } */
  async listWhatsAppSessions(): Promise<FlowEngineWhatsAppSession[]> {
    const res = await this.request<{ success: boolean; sessions: FlowEngineWhatsAppSession[] }>('GET', '/api/v1/whatsapp/sessions');
    return res.sessions ?? [];
  }

  /** Get WhatsApp session details — response is flat (not nested in 'session') */
  async getWhatsAppSession(instanceName: string): Promise<FlowEngineWhatsAppSession> {
    return this.request('GET', `/api/v1/whatsapp/sessions/${instanceName}`);
  }

  /** Delete a WhatsApp session */
  async deleteWhatsAppSession(instanceName: string): Promise<void> {
    await this.request('DELETE', `/api/v1/whatsapp/sessions/${instanceName}`);
  }

  /** Set the webhook URL for a WhatsApp session — API uses PUT, not POST */
  async setWhatsAppWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    await this.request('PUT', `/api/v1/whatsapp/sessions/${instanceName}/webhook`, { webhook_url: webhookUrl });
  }
}

/** Create a FlowEngine client from an API key or FLOWENGINE_API_KEY env var */
export function createFlowEngineClient(apiKey?: string): FlowEngineClient | null {
  const key = (apiKey || '').trim();
  if (!key) return null;
  return new FlowEngineClient(key);
}

export { FlowEngineClient, FlowEngineApiError };
export type { FlowEngineInstance, FlowEngineWhatsAppSession, FlowEnginePricing, FlowEnginePricingTier, FlowEngineUser };
