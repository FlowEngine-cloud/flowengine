/**
 * Encryption utilities for sensitive data
 * Uses AES-256-CBC encryption
 */
import crypto from 'crypto';

// Encryption key from environment (32 bytes for AES-256)
// SECURITY: Require dedicated encryption key - do NOT fallback to service role key
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET || '';

// Validate encryption key at startup
function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    throw new Error(
      'ENCRYPTION_SECRET must be set and at least 32 characters. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  return Buffer.from(ENCRYPTION_KEY, 'utf-8').slice(0, 32);
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText || typeof encryptedText !== 'string') {
    throw new Error('Invalid encrypted text');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }

  const [ivHex, encrypted] = parts;
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted text components');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Check if a string looks like an encrypted value (iv:ciphertext format)
 * Encrypted values have format: 32-char hex IV + ":" + hex ciphertext
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  // Must have exactly 2 parts, IV is 32 hex chars, ciphertext is hex
  return parts.length === 2 &&
    parts[0].length === 32 &&
    /^[a-f0-9]+$/i.test(parts[0]) &&
    /^[a-f0-9]+$/i.test(parts[1]);
}

/**
 * Encrypt an n8n API key for storage
 * Returns the encrypted value, or null if input is null/empty
 */
export function encryptApiKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  // Don't double-encrypt
  if (isEncrypted(apiKey)) return apiKey;
  return encrypt(apiKey);
}

/**
 * Decrypt an n8n API key for use
 * Handles legacy unencrypted keys gracefully (returns as-is)
 * Returns null if input is null/empty
 */
export function decryptApiKey(storedKey: string | null | undefined): string | null {
  if (!storedKey) return null;

  // Check if it's encrypted (has iv:ciphertext format)
  if (isEncrypted(storedKey)) {
    try {
      return decrypt(storedKey);
    } catch (error) {
      console.error('Failed to decrypt API key, treating as legacy plaintext:', error);
      return storedKey; // Fallback for corrupted data
    }
  }

  // Legacy unencrypted key - return as-is
  return storedKey;
}
