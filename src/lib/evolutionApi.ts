/**
 * Evolution API stub for the open-source portal.
 *
 * The full implementation interfaces with Evolution API (WhatsApp) infrastructure.
 * This stub satisfies the import from the whatsapp-instances API route.
 */

export interface EvolutionApiConfig {
  baseUrl: string;
  apiKey: string;
}

export function isValidInstanceName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
}

export interface ConnectionStateResult {
  ok: boolean;
  data?: {
    instance?: {
      state?: string;
    };
  };
}

/**
 * Fetches the live connection state of a WhatsApp session from Evolution API.
 * Stub - always returns a disconnected state.
 */
export async function getConnectionState(
  config: EvolutionApiConfig,
  instanceName: string
): Promise<ConnectionStateResult> {
  return { ok: false };
}

/**
 * Creates a new WhatsApp session via Evolution API.
 * Stub - throws not implemented.
 */
export async function createSession(
  config: EvolutionApiConfig,
  instanceName: string,
  options?: Record<string, any>
): Promise<{ ok: boolean; data?: any; error?: string }> {
  return { ok: false, error: 'Evolution API not configured in open-source portal' };
}

/**
 * Sets a webhook for a WhatsApp session.
 * Stub - throws not implemented.
 */
export async function setWebhook(
  config: EvolutionApiConfig,
  instanceName: string,
  webhookUrl: string,
  events?: string[]
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'Evolution API not configured in open-source portal' };
}

/**
 * Deletes a WhatsApp session from Evolution API.
 * Stub - throws not implemented.
 */
export async function deleteSession(
  config: EvolutionApiConfig,
  instanceName: string
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'Evolution API not configured in open-source portal' };
}
