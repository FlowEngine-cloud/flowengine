/**
 * Widget Transfer Utility
 *
 * Centralizes all widget import/export logic between components.
 * Provides type-safe, validated transfers with proper error handling.
 *
 * Architecture:
 * - Single source of truth for widget transfer logic
 * - Uses sessionStorage with expiry and validation
 * - Supports both config and element selection transfer
 * - Idempotent - safe to call multiple times
 */

import { z } from 'zod';
import { ChatbotConfigSchema, FormFieldSchema, WidgetStylesSchema } from '@/components/widget-studio/types';

// ============================================
// Types & Schemas
// ============================================

const WidgetTransferSchema = z.object({
  widgetType: z.enum(['chatbot', 'form', 'button']),
  chatbotConfig: ChatbotConfigSchema.optional(),
  formFields: z.array(FormFieldSchema).optional(),
  styles: WidgetStylesSchema.optional(),
  webhookPath: z.string().optional(),
  selectedElement: z.string().nullable().optional(),
});

export type WidgetTransfer = z.infer<typeof WidgetTransferSchema>;

interface StoredTransfer {
  data: WidgetTransfer;
  timestamp: number;
  id: string;
}

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'fe_widget_transfer';
const TRANSFER_EXPIRY_MS = 300000; // 5 minutes - enough time for slow connections or user delays

// Use localStorage for cross-tab support (sessionStorage is per-tab and doesn't work for new tab navigation)
const storage = typeof window !== 'undefined' ? window.localStorage : null;

// ============================================
// Transfer Functions
// ============================================

/**
 * Creates a component transfer and stores it in localStorage.
 * Returns a unique transfer ID that can be passed in URL params.
 * Uses localStorage (not sessionStorage) for cross-tab support.
 */
export function createWidgetTransfer(data: WidgetTransfer): string {
  if (!storage) {
    throw new Error('Storage not available');
  }

  const id = crypto.randomUUID();
  const transfer: StoredTransfer = {
    data,
    timestamp: Date.now(),
    id,
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(transfer));
    console.log('[WidgetTransfer] Created transfer:', id, data);
    return id;
  } catch (e) {
    console.error('[WidgetTransfer] Failed to create transfer:', e);
    throw new Error('Failed to create component transfer');
  }
}

/**
 * Consumes a component transfer from localStorage.
 * Validates the data, checks expiry, and cleans up after reading.
 * Uses localStorage (not sessionStorage) for cross-tab support.
 *
 * @param expectedId - Optional transfer ID to verify (prevents reading wrong transfer)
 * @returns The validated widget transfer data, or null if not found/invalid
 */
export function consumeWidgetTransfer(expectedId?: string): WidgetTransfer | null {
  if (!storage) {
    console.log('[WidgetTransfer] Storage not available');
    return null;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      console.log('[WidgetTransfer] No transfer found in storage');
      return null;
    }

    let stored: StoredTransfer;
    try {
      stored = JSON.parse(raw);
    } catch (e) {
      console.error('[WidgetTransfer] Failed to parse stored transfer:', e);
      storage.removeItem(STORAGE_KEY);
      return null;
    }

    // Check expiry
    if (Date.now() - stored.timestamp > TRANSFER_EXPIRY_MS) {
      console.warn('[WidgetTransfer] Transfer expired, clearing');
      storage.removeItem(STORAGE_KEY);
      return null;
    }

    // Verify ID if provided (prevents consuming wrong transfer)
    if (expectedId && stored.id !== expectedId) {
      console.warn('[WidgetTransfer] Transfer ID mismatch, expected:', expectedId, 'got:', stored.id);
      return null;
    }

    // Validate data structure
    const result = WidgetTransferSchema.safeParse(stored.data);
    if (!result.success) {
      console.error('[WidgetTransfer] Validation failed:', result.error.issues);
      storage.removeItem(STORAGE_KEY);
      return null;
    }

    // Clear after successful read (prevent duplicate reads)
    storage.removeItem(STORAGE_KEY);
    console.log('[WidgetTransfer] Consumed transfer:', stored.id, result.data);

    return result.data;
  } catch (e) {
    console.error('[WidgetTransfer] Failed to consume transfer:', e);
    // Clean up on any error
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {}
    return null;
  }
}

/**
 * Peeks at a component transfer without consuming it.
 * Useful for checking if a transfer exists before navigation.
 */
export function peekWidgetTransfer(): WidgetTransfer | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const stored: StoredTransfer = JSON.parse(raw);

    // Check expiry
    if (Date.now() - stored.timestamp > TRANSFER_EXPIRY_MS) {
      return null;
    }

    const result = WidgetTransferSchema.safeParse(stored.data);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Clears any pending widget transfer.
 */
export function clearWidgetTransfer(): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {}
}

// ============================================
// Navigation Helpers
// ============================================

/**
 * Opens widget studio with a component transfer.
 * Handles sessionStorage setup and URL construction.
 */
export function openWidgetStudio(
  config: {
    widgetType?: 'chatbot' | 'form' | 'button';
    chatbotConfig?: Record<string, unknown>;
    formFields?: Array<Record<string, unknown>>;
    styles?: Record<string, unknown>;
    webhookPath?: string;
    selectedElement?: string | null;
  },
  options: { newTab?: boolean } = { newTab: true }
): void {
  const transfer: WidgetTransfer = {
    widgetType: config.widgetType || 'chatbot',
    chatbotConfig: config.chatbotConfig,
    formFields: config.formFields as WidgetTransfer['formFields'],
    styles: config.styles as WidgetTransfer['styles'],
    webhookPath: config.webhookPath,
    selectedElement: config.selectedElement,
  };

  const transferId = createWidgetTransfer(transfer);
  const params = new URLSearchParams();
  params.set('transfer', transferId);

  const url = `/portal/ui-studio/editor?${params.toString()}`;

  if (options.newTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
}

/**
 * Builds widget studio URL with transfer.
 * Use this when you need the URL but want to handle navigation yourself.
 */
export function getWidgetStudioUrl(
  config: {
    widgetType?: 'chatbot' | 'form' | 'button';
    chatbotConfig?: Record<string, unknown>;
    webhookPath?: string;
    selectedElement?: string | null;
  }
): string {
  const transfer: WidgetTransfer = {
    widgetType: config.widgetType || 'chatbot',
    chatbotConfig: config.chatbotConfig,
    webhookPath: config.webhookPath,
    selectedElement: config.selectedElement,
  };

  const transferId = createWidgetTransfer(transfer);
  const params = new URLSearchParams();
  params.set('transfer', transferId);

  return `/portal/ui-studio/editor?${params.toString()}`;
}
