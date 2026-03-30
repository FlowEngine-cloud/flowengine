import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeCredentialData, logNormalization } from '@/lib/credentialNormalization';

// ─── normalizeCredentialData ──────────────────────────────────────────────────

describe('normalizeCredentialData', () => {
  it('returns data unchanged when schema has no properties', () => {
    const data = { apiKey: 'my-key' };
    expect(normalizeCredentialData(data, {})).toEqual({ apiKey: 'my-key' });
    expect(normalizeCredentialData(data, undefined)).toEqual({ apiKey: 'my-key' });
    expect(normalizeCredentialData(data, null)).toEqual({ apiKey: 'my-key' });
  });

  it('does not mutate the input object', () => {
    const data = { apiKey: 'key' };
    const schema = { properties: { useCustomUrl: { type: 'boolean' } } };
    const result = normalizeCredentialData(data, schema);
    expect(data).not.toHaveProperty('useCustomUrl');
    expect(result).toHaveProperty('useCustomUrl');
  });

  it('preserves fields already provided by user', () => {
    const data = { apiKey: 'my-key', useCustomUrl: true };
    const schema = {
      properties: { useCustomUrl: { type: 'boolean', default: false } },
    };
    const result = normalizeCredentialData(data, schema);
    expect(result.useCustomUrl).toBe(true); // user value kept, not overwritten with default
  });

  it('skips required fields (user must provide them)', () => {
    const data = { apiKey: 'key' };
    const schema = {
      required: ['clientId'],
      properties: {
        clientId: { type: 'string' },
      },
    };
    const result = normalizeCredentialData(data, schema);
    expect(result).not.toHaveProperty('clientId');
  });

  it('applies explicit schema default for optional fields', () => {
    const data = {};
    const schema = {
      properties: {
        region: { type: 'string', default: 'us-east-1' },
      },
    };
    expect(normalizeCredentialData(data, schema).region).toBe('us-east-1');
  });

  it('sets boolean fields to false', () => {
    const data = {};
    const schema = {
      properties: {
        allowUnauthorizedCerts: { type: 'boolean' },
        useCustomUrl: { type: 'boolean' },
      },
    };
    const result = normalizeCredentialData(data, schema);
    expect(result.allowUnauthorizedCerts).toBe(false);
    expect(result.useCustomUrl).toBe(false);
  });

  it('sets string enum field to first enum value', () => {
    const data = {};
    const schema = {
      properties: {
        authType: { type: 'string', enum: ['header', 'query', 'body'] },
      },
    };
    expect(normalizeCredentialData(data, schema).authType).toBe('header');
  });

  it('sets plain string field to empty string', () => {
    const data = {};
    const schema = {
      properties: {
        baseUrl: { type: 'string' },
      },
    };
    expect(normalizeCredentialData(data, schema).baseUrl).toBe('');
  });

  it('sets number/integer fields to 0', () => {
    const data = {};
    const schema = {
      properties: {
        timeout: { type: 'number' },
        port: { type: 'integer' },
      },
    };
    const result = normalizeCredentialData(data, schema);
    expect(result.timeout).toBe(0);
    expect(result.port).toBe(0);
  });

  it('sets object fields to empty object', () => {
    const data = {};
    const schema = {
      properties: {
        headers: { type: 'object' },
      },
    };
    expect(normalizeCredentialData(data, schema).headers).toEqual({});
  });

  it('sets array fields to empty array', () => {
    const data = {};
    const schema = {
      properties: {
        scopes: { type: 'array' },
      },
    };
    expect(normalizeCredentialData(data, schema).scopes).toEqual([]);
  });

  it('extracts enum from allOf nested schemas', () => {
    const data = {};
    const schema = {
      properties: {
        mode: {
          type: 'string',
          allOf: [
            { enum: ['insert', 'update', 'upsert'] },
          ],
        },
      },
    };
    expect(normalizeCredentialData(data, schema).mode).toBe('insert');
  });

  it('extracts enum from oneOf nested schemas', () => {
    const data = {};
    const schema = {
      properties: {
        grantType: {
          type: 'string',
          oneOf: [
            { const: 'authorizationCode' },
            { const: 'clientCredentials' },
          ],
        },
      },
    };
    expect(normalizeCredentialData(data, schema).grantType).toBe('authorizationCode');
  });

  it('handles fields with unknown types gracefully (no default added)', () => {
    const data = {};
    const schema = {
      properties: {
        unknownType: { type: 'null' },
      },
    };
    // null type is not handled — field should not be added
    const result = normalizeCredentialData(data, schema);
    expect(result).not.toHaveProperty('unknownType');
  });
});

// ─── logNormalization ─────────────────────────────────────────────────────────

describe('logNormalization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs added fields when normalization added new keys', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const original = { apiKey: 'key' };
    const normalized = { apiKey: 'key', useCustomUrl: false };
    logNormalization(original, normalized, 'openAiApi');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('openAiApi'),
      expect.stringContaining('useCustomUrl')
    );
  });

  it('does not log when no fields were added', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const data = { apiKey: 'key' };
    logNormalization(data, data, 'anthropicApi');
    expect(logSpy).not.toHaveBeenCalled();
  });
});
