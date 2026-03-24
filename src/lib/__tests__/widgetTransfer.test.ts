/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createWidgetTransfer,
  consumeWidgetTransfer,
  peekWidgetTransfer,
  clearWidgetTransfer,
  getWidgetStudioUrl,
} from '@/lib/widgetTransfer';

// ─── Setup ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'fe_widget_transfer';

const VALID_TRANSFER = { widgetType: 'chatbot' as const };
const VALID_TRANSFER_WITH_WEBHOOK = {
  widgetType: 'chatbot' as const,
  webhookPath: '/api/webhook',
  selectedElement: 'header',
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

// ─── createWidgetTransfer ─────────────────────────────────────────────────────

describe('createWidgetTransfer', () => {
  it('returns a non-empty string ID', () => {
    const id = createWidgetTransfer(VALID_TRANSFER);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('stores data in localStorage under fe_widget_transfer', () => {
    createWidgetTransfer(VALID_TRANSFER);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!);
    expect(stored.data.widgetType).toBe('chatbot');
  });

  it('stored entry includes a timestamp and matching id', () => {
    const id = createWidgetTransfer(VALID_TRANSFER);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.id).toBe(id);
    expect(typeof stored.timestamp).toBe('number');
  });

  it('overwrites previous transfer (single slot storage)', () => {
    createWidgetTransfer(VALID_TRANSFER);
    createWidgetTransfer({ widgetType: 'form' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.data.widgetType).toBe('form');
  });
});

// ─── consumeWidgetTransfer ────────────────────────────────────────────────────

describe('consumeWidgetTransfer', () => {
  it('returns the transfer data and removes it from storage', () => {
    createWidgetTransfer(VALID_TRANSFER);
    const data = consumeWidgetTransfer();
    expect(data).not.toBeNull();
    expect(data!.widgetType).toBe('chatbot');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(consumeWidgetTransfer()).toBeNull();
  });

  it('returns null and clears storage for corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
    const data = consumeWidgetTransfer();
    expect(data).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears expired transfer (past 5 minutes)', () => {
    createWidgetTransfer(VALID_TRANSFER);
    // Advance past the 5-minute expiry
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(consumeWidgetTransfer()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns data for transfer just before expiry', () => {
    createWidgetTransfer(VALID_TRANSFER);
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    expect(consumeWidgetTransfer()).not.toBeNull();
  });

  it('returns null when expectedId does not match stored id', () => {
    createWidgetTransfer(VALID_TRANSFER);
    const data = consumeWidgetTransfer('wrong-id-xxx');
    expect(data).toBeNull();
    // Storage NOT cleared on ID mismatch
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('returns data when expectedId matches stored id', () => {
    const id = createWidgetTransfer(VALID_TRANSFER);
    const data = consumeWidgetTransfer(id);
    expect(data).not.toBeNull();
  });

  it('returns null for invalid data shape and clears storage', () => {
    // Manually write a stored entry with invalid data
    const stored = {
      data: { widgetType: 'invalid_enum_value' },
      timestamp: Date.now(),
      id: 'test-id',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    expect(consumeWidgetTransfer()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('preserves optional fields when present', () => {
    createWidgetTransfer(VALID_TRANSFER_WITH_WEBHOOK);
    const data = consumeWidgetTransfer();
    expect(data!.webhookPath).toBe('/api/webhook');
    expect(data!.selectedElement).toBe('header');
  });
});

// ─── peekWidgetTransfer ───────────────────────────────────────────────────────

describe('peekWidgetTransfer', () => {
  it('returns transfer data without removing it from storage', () => {
    createWidgetTransfer(VALID_TRANSFER);
    const data = peekWidgetTransfer();
    expect(data).not.toBeNull();
    // Storage should still be present
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(peekWidgetTransfer()).toBeNull();
  });

  it('returns null for expired transfer without clearing', () => {
    createWidgetTransfer(VALID_TRANSFER);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(peekWidgetTransfer()).toBeNull();
  });
});

// ─── clearWidgetTransfer ─────────────────────────────────────────────────────

describe('clearWidgetTransfer', () => {
  it('removes the transfer from localStorage', () => {
    createWidgetTransfer(VALID_TRANSFER);
    clearWidgetTransfer();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not throw when storage is empty', () => {
    expect(() => clearWidgetTransfer()).not.toThrow();
  });
});

// ─── getWidgetStudioUrl ───────────────────────────────────────────────────────

describe('getWidgetStudioUrl', () => {
  it('returns a URL containing the transfer id as a query param', () => {
    const url = getWidgetStudioUrl({ widgetType: 'chatbot' });
    expect(url).toContain('/portal/ui-studio/editor');
    expect(url).toContain('transfer=');
  });

  it('defaults widgetType to "chatbot" when not provided', () => {
    getWidgetStudioUrl({});
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.data.widgetType).toBe('chatbot');
  });

  it('stores the provided webhookPath in the transfer', () => {
    getWidgetStudioUrl({ widgetType: 'form', webhookPath: '/hook' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.data.webhookPath).toBe('/hook');
  });
});
