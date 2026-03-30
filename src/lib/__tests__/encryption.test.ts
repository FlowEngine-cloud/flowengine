import { describe, it, expect, vi } from 'vitest';

// ─── Set ENCRYPTION_SECRET before the module is loaded ────────────────────────
// The encryption module reads process.env.ENCRYPTION_SECRET at module load time
// (top-level const), so the env var must be set inside vi.hoisted() which runs
// before imports are evaluated.

const TEST_SECRET = 'test-secret-key-for-unit-tests-32c';

vi.hoisted(() => {
  process.env.ENCRYPTION_SECRET = 'test-secret-key-for-unit-tests-32c';
});

import { encrypt, decrypt, isEncrypted, encryptApiKey, decryptApiKey } from '@/lib/encryption';

// ─── encrypt / decrypt ────────────────────────────────────────────────────────

describe('encrypt / decrypt round-trip', () => {
  it('decrypts back to the original plaintext', () => {
    const plain = 'sk_live_abc123secretkey';
    const encrypted = encrypt(plain);
    expect(decrypt(encrypted)).toBe(plain);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const plain = 'same-value';
    const enc1 = encrypt(plain);
    const enc2 = encrypt(plain);
    expect(enc1).not.toBe(enc2);
    // But both decrypt correctly
    expect(decrypt(enc1)).toBe(plain);
    expect(decrypt(enc2)).toBe(plain);
  });

  it('handles empty string round-trip', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('handles strings with special characters', () => {
    const plain = 'Hello, 世界! @#$%^&*()_+{}|:"<>?';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('handles long strings', () => {
    const plain = 'a'.repeat(10000);
    expect(decrypt(encrypt(plain))).toBe(plain);
  });
});

describe('encrypt output format', () => {
  it('produces iv:ciphertext format (two colon-separated hex strings)', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[a-f0-9]{32}$/i); // 16-byte IV = 32 hex chars
    expect(parts[1]).toMatch(/^[a-f0-9]+$/i);
  });
});

describe('decrypt error handling', () => {
  it('throws on invalid encrypted text format', () => {
    expect(() => decrypt('invalid-no-colon')).toThrow();
  });

  it('throws on null/undefined input', () => {
    expect(() => decrypt(null as any)).toThrow();
    expect(() => decrypt(undefined as any)).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => decrypt('')).toThrow();
  });

  it('throws on wrong number of parts', () => {
    expect(() => decrypt('a:b:c')).toThrow();
  });
});

// ─── isEncrypted ──────────────────────────────────────────────────────────────

describe('isEncrypted', () => {
  it('returns true for output of encrypt()', () => {
    const encrypted = encrypt('some value');
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isEncrypted('sk_live_abc123')).toBe(false);
    expect(isEncrypted('hello world')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEncrypted('')).toBe(false);
  });

  it('returns false for strings with non-hex IV', () => {
    // IV must be 32 hex chars; this has 32 chars but with non-hex characters
    expect(isEncrypted('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:abcdef')).toBe(false);
  });

  it('returns false for IV that is wrong length', () => {
    // Valid hex but wrong IV length (not 32 chars)
    expect(isEncrypted('deadbeef:abcdef0123')).toBe(false);
  });
});

// ─── encryptApiKey ────────────────────────────────────────────────────────────

describe('encryptApiKey', () => {
  it('returns null for null/undefined input', () => {
    expect(encryptApiKey(null)).toBeNull();
    expect(encryptApiKey(undefined)).toBeNull();
    expect(encryptApiKey('')).toBeNull();
  });

  it('encrypts a plain text key', () => {
    const result = encryptApiKey('sk_live_test123');
    expect(result).not.toBeNull();
    expect(isEncrypted(result!)).toBe(true);
  });

  it('does not double-encrypt an already-encrypted value', () => {
    const encrypted = encrypt('original');
    const result = encryptApiKey(encrypted);
    // Should return the same already-encrypted value unchanged
    expect(result).toBe(encrypted);
    // Decrypting it once should give back "original"
    expect(decrypt(result!)).toBe('original');
  });
});

// ─── decryptApiKey ────────────────────────────────────────────────────────────

describe('decryptApiKey', () => {
  it('returns null for null/undefined/empty', () => {
    expect(decryptApiKey(null)).toBeNull();
    expect(decryptApiKey(undefined)).toBeNull();
    expect(decryptApiKey('')).toBeNull();
  });

  it('decrypts an encrypted key back to plaintext', () => {
    const plain = 'sk_test_abcdef123456';
    const encrypted = encrypt(plain);
    expect(decryptApiKey(encrypted)).toBe(plain);
  });

  it('returns plain text as-is for legacy unencrypted keys', () => {
    // A key that does NOT match the iv:ciphertext format is returned unchanged
    const legacy = 'sk_live_legacyunencryptedkey';
    expect(decryptApiKey(legacy)).toBe(legacy);
  });
});
