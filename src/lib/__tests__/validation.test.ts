import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  isExternalUrl,
  isValidWebhookUrl,
  sanitizeString,
  isValidEmail,
  isValidImageUrl,
  sanitizeCSS,
  validateAndSanitizeCSS,
  checkRateLimit,
} from '@/lib/validation';

// ─── isValidUUID ──────────────────────────────────────────────────────────────

describe('isValidUUID', () => {
  it('accepts valid v4 UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
    expect(isValidUUID('00000000-0000-4000-8000-000000000000')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('rejects non-UUID strings', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false); // too short
    expect(isValidUUID('550e8400-e29b-31d4-a716-446655440000')).toBe(false); // v3
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false); // no dashes
  });

  it('is case-insensitive', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });
});

// ─── isExternalUrl ────────────────────────────────────────────────────────────

describe('isExternalUrl', () => {
  it('allows valid external HTTPS URLs', () => {
    expect(isExternalUrl('https://example.com')).toEqual({ valid: true });
    expect(isExternalUrl('https://n8n.myagency.com/webhook/abc')).toEqual({ valid: true });
    expect(isExternalUrl('https://api.service.io/v1')).toEqual({ valid: true });
  });

  it('allows HTTP URLs', () => {
    expect(isExternalUrl('http://example.com').valid).toBe(true);
  });

  it('blocks non-HTTP protocols', () => {
    expect(isExternalUrl('ftp://example.com').valid).toBe(false);
    expect(isExternalUrl('javascript:alert(1)').valid).toBe(false);
    expect(isExternalUrl('file:///etc/passwd').valid).toBe(false);
  });

  it('blocks localhost and loopback', () => {
    expect(isExternalUrl('http://localhost:3000').valid).toBe(false);
    expect(isExternalUrl('http://localhost').valid).toBe(false);
    expect(isExternalUrl('http://127.0.0.1').valid).toBe(false);
    expect(isExternalUrl('http://127.0.0.1:8080').valid).toBe(false);
    expect(isExternalUrl('http://0.0.0.0').valid).toBe(false);
    expect(isExternalUrl('http://sub.localhost').valid).toBe(false);
  });

  it('blocks full 10.0.0.0/8 private range', () => {
    expect(isExternalUrl('http://10.0.0.1').valid).toBe(false);
    expect(isExternalUrl('http://10.255.255.255').valid).toBe(false);
    expect(isExternalUrl('http://10.1.2.3').valid).toBe(false);
  });

  it('blocks 172.16.0.0/12 private range', () => {
    expect(isExternalUrl('http://172.16.0.1').valid).toBe(false);
    expect(isExternalUrl('http://172.20.10.1').valid).toBe(false);
    expect(isExternalUrl('http://172.31.255.255').valid).toBe(false);
  });

  it('allows 172.15.x.x and 172.32.x.x (outside private range)', () => {
    expect(isExternalUrl('http://172.15.0.1').valid).toBe(true);
    expect(isExternalUrl('http://172.32.0.1').valid).toBe(true);
  });

  it('blocks 192.168.x.x private range', () => {
    expect(isExternalUrl('http://192.168.1.1').valid).toBe(false);
    expect(isExternalUrl('http://192.168.0.0').valid).toBe(false);
  });

  it('blocks 169.254.x.x link-local / AWS metadata IP', () => {
    expect(isExternalUrl('http://169.254.169.254').valid).toBe(false);
    expect(isExternalUrl('http://169.254.0.1').valid).toBe(false);
  });

  it('blocks 127.x.x.x full loopback range', () => {
    expect(isExternalUrl('http://127.1.2.3').valid).toBe(false);
  });

  it('blocks cloud metadata endpoints', () => {
    expect(isExternalUrl('http://metadata.google.internal').valid).toBe(false);
    expect(isExternalUrl('http://metadata.google.com').valid).toBe(false);
    expect(isExternalUrl('http://metadata').valid).toBe(false);
    expect(isExternalUrl('http://instance-data').valid).toBe(false);
  });

  it('blocks internal TLDs', () => {
    expect(isExternalUrl('http://service.internal').valid).toBe(false);
    expect(isExternalUrl('http://device.local').valid).toBe(false);
    expect(isExternalUrl('http://host.lan').valid).toBe(false);
    expect(isExternalUrl('http://server.corp').valid).toBe(false);
    expect(isExternalUrl('http://machine.home').valid).toBe(false);
  });

  it('rejects invalid URL formats', () => {
    expect(isExternalUrl('not-a-url').valid).toBe(false);
    expect(isExternalUrl('').valid).toBe(false);
    expect(isExternalUrl('://noscheme').valid).toBe(false);
  });
});

// ─── isValidWebhookUrl ────────────────────────────────────────────────────────

describe('isValidWebhookUrl', () => {
  const instanceUrl = 'https://n8n.example.com';

  it('rejects when no instanceUrl provided', () => {
    const r = isValidWebhookUrl('https://n8n.example.com/webhook/abc');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/instance url is required/i);
  });

  it('rejects when hostname does not match instance', () => {
    const r = isValidWebhookUrl('https://evil.com/webhook/abc', instanceUrl);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/must point to your n8n instance/i);
  });

  it('rejects non-webhook/form paths', () => {
    expect(isValidWebhookUrl('https://n8n.example.com/api/workflows', instanceUrl).valid).toBe(false);
    expect(isValidWebhookUrl('https://n8n.example.com/', instanceUrl).valid).toBe(false);
    expect(isValidWebhookUrl('https://n8n.example.com/workflow/abc', instanceUrl).valid).toBe(false);
  });

  it('rejects path traversal attempts', () => {
    expect(isValidWebhookUrl('https://n8n.example.com/webhook/../etc/passwd', instanceUrl).valid).toBe(false);
    expect(isValidWebhookUrl('https://n8n.example.com/webhook//secret', instanceUrl).valid).toBe(false);
  });

  it('accepts valid webhook paths', () => {
    expect(isValidWebhookUrl('https://n8n.example.com/webhook/abc-123', instanceUrl)).toEqual({ valid: true });
    expect(isValidWebhookUrl('https://n8n.example.com/webhook/test?param=1', instanceUrl)).toEqual({ valid: true });
  });

  it('accepts valid form paths', () => {
    expect(isValidWebhookUrl('https://n8n.example.com/form/survey-id', instanceUrl)).toEqual({ valid: true });
  });

  it('rejects protocol mismatch between webhook and instance', () => {
    const r = isValidWebhookUrl('http://n8n.example.com/webhook/abc', 'https://n8n.example.com');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/protocol must match/i);
  });

  it('rejects internal/private webhook URLs regardless of hostname match', () => {
    // localhost passes the hostname check but fails the SSRF check first
    const r = isValidWebhookUrl('http://localhost/webhook/abc', 'http://localhost');
    expect(r.valid).toBe(false);
  });
});

// ─── sanitizeString ───────────────────────────────────────────────────────────

describe('sanitizeString', () => {
  it('removes angle brackets (XSS prevention)', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('trims leading/trailing whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('enforces default max length of 200', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeString(long)).toHaveLength(200);
  });

  it('enforces custom max length', () => {
    expect(sanitizeString('hello world', 5)).toBe('hello');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(null as any)).toBe('');
    expect(sanitizeString(undefined as any)).toBe('');
    expect(sanitizeString(42 as any)).toBe('');
    expect(sanitizeString({} as any)).toBe('');
  });

  it('allows normal text unchanged', () => {
    expect(sanitizeString('Hello, World!')).toBe('Hello, World!');
    expect(sanitizeString('user@example.com')).toBe('user@example.com');
  });

  it('preserves other special characters', () => {
    expect(sanitizeString('foo & bar')).toBe('foo & bar');
    expect(sanitizeString('test "quotes"')).toBe('test "quotes"');
  });
});

// ─── isValidEmail ─────────────────────────────────────────────────────────────

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user+tag@sub.domain.co.uk')).toBe(true);
    expect(isValidEmail('a@b.io')).toBe(true);
    expect(isValidEmail('firstname.lastname@company.org')).toBe(true);
  });

  it('rejects missing local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects no @ sign', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });

  it('rejects spaces in email', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
    expect(isValidEmail('user@ example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects emails over 254 characters', () => {
    const long = 'a'.repeat(250) + '@x.com';
    expect(isValidEmail(long)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isValidEmail(null as any)).toBe(false);
    expect(isValidEmail(undefined as any)).toBe(false);
  });

  it('rejects domain with no TLD (no dot)', () => {
    // The regex requires at least one dot-separated label after the hostname
    expect(isValidEmail('user@nodomain')).toBe(false);
  });
});

// ─── isValidImageUrl ──────────────────────────────────────────────────────────

describe('isValidImageUrl', () => {
  it('accepts HTTPS URLs with image extensions', () => {
    expect(isValidImageUrl('https://example.com/logo.png')).toEqual({ valid: true });
    expect(isValidImageUrl('https://example.com/logo.svg')).toEqual({ valid: true });
    expect(isValidImageUrl('https://example.com/photo.jpg')).toEqual({ valid: true });
    expect(isValidImageUrl('https://example.com/photo.jpeg')).toEqual({ valid: true });
    expect(isValidImageUrl('https://example.com/img.gif')).toEqual({ valid: true });
    expect(isValidImageUrl('https://example.com/img.webp')).toEqual({ valid: true });
    expect(isValidImageUrl('https://example.com/favicon.ico')).toEqual({ valid: true });
  });

  it('accepts known image CDN URLs', () => {
    expect(isValidImageUrl('https://images.unsplash.com/photo-abc?w=400')).toEqual({ valid: true });
    expect(isValidImageUrl('https://cloudinary.com/my-image')).toEqual({ valid: true });
    expect(isValidImageUrl('https://cdn.jsdelivr.net/img.png')).toEqual({ valid: true });
  });

  it('accepts any HTTPS URL (user responsibility)', () => {
    expect(isValidImageUrl('https://example.com/image-endpoint').valid).toBe(true);
  });

  it('rejects empty or null input', () => {
    expect(isValidImageUrl('')).toMatchObject({ valid: false });
    expect(isValidImageUrl(null as any)).toMatchObject({ valid: false });
    expect(isValidImageUrl(undefined as any)).toMatchObject({ valid: false });
  });

  it('rejects URLs over 2048 characters', () => {
    const long = 'https://example.com/' + 'a'.repeat(2040);
    expect(isValidImageUrl(long)).toMatchObject({ valid: false, error: expect.stringMatching(/too long/i) });
  });

  it('rejects non-HTTP protocols', () => {
    expect(isValidImageUrl('ftp://example.com/logo.png')).toMatchObject({ valid: false });
  });

  it('rejects invalid URL strings', () => {
    expect(isValidImageUrl('not-a-url')).toMatchObject({ valid: false });
    expect(isValidImageUrl('://bad')).toMatchObject({ valid: false });
  });
});

// ─── sanitizeCSS ──────────────────────────────────────────────────────────────

describe('sanitizeCSS', () => {
  it('removes HTML script tags', () => {
    const result = sanitizeCSS('body { } <script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('removes javascript: URLs', () => {
    expect(sanitizeCSS('background: url(javascript:alert(1))')).not.toContain('javascript:');
    expect(sanitizeCSS('background: url(JAVASCRIPT:alert(1))')).not.toContain('javascript:');
    // Handles spacing obfuscation
    expect(sanitizeCSS('background: url(j a v a s c r i p t:alert(1))')).not.toContain('javascript:');
  });

  it('replaces data: URLs with invalid:', () => {
    const result = sanitizeCSS('background: url(data:text/html,<h1>hi</h1>)');
    expect(result).not.toContain('data:');
    expect(result).toContain('invalid:');
  });

  it('removes vbscript:', () => {
    expect(sanitizeCSS('background: url(vbscript:msgbox(1))')).not.toMatch(/vbscript\s*:/i);
  });

  it('removes expression() (IE XSS)', () => {
    const result = sanitizeCSS('width: expression(alert(1))');
    expect(result).not.toMatch(/expression\s*\(/i);
    expect(result).toContain('blocked(');
  });

  it('blocks @import rules', () => {
    // The @import keyword is replaced with a CSS comment so the rule is inert
    const result = sanitizeCSS('@import url("evil.css")');
    expect(result).toContain('blocked');
    // The @import prefix is neutralised — only a comment remains, not an active rule
    expect(result).not.toMatch(/^@import\s+/i);
  });

  it('blocks @charset', () => {
    // The @charset keyword is replaced with a CSS comment so the declaration is inert
    const result = sanitizeCSS('@charset "UTF-8";');
    expect(result).toContain('blocked');
    // The @charset prefix is neutralised — only a comment remains
    expect(result).not.toMatch(/^@charset\s+/i);
  });

  it('removes -moz-binding (Firefox XSS)', () => {
    const result = sanitizeCSS('-moz-binding: url(evil.xml)');
    expect(result).not.toMatch(/-moz-binding\s*:/i);
  });

  it('removes CSS escape sequences', () => {
    // Hex-encoded "javascript" attempt
    const result = sanitizeCSS('background: \\6a\\61\\76\\61script:alert(1)');
    expect(result).not.toContain('\\6a');
  });

  it('enforces max length', () => {
    const long = '.a { color: red; } '.repeat(1000);
    expect(sanitizeCSS(long, 10000).length).toBeLessThanOrEqual(10000);
  });

  it('preserves safe CSS', () => {
    const safe = '.button { color: red; font-size: 16px; background: #fff; }';
    const result = sanitizeCSS(safe);
    expect(result).toContain('.button');
    expect(result).toContain('color: red');
    expect(result).toContain('font-size: 16px');
  });

  it('returns empty string for null/empty input', () => {
    expect(sanitizeCSS('')).toBe('');
    expect(sanitizeCSS(null as any)).toBe('');
    expect(sanitizeCSS(undefined as any)).toBe('');
  });
});

// ─── validateAndSanitizeCSS ───────────────────────────────────────────────────

describe('validateAndSanitizeCSS', () => {
  it('returns valid:true and sanitized CSS for safe input', () => {
    const result = validateAndSanitizeCSS('.btn { color: blue; }');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain('.btn');
    expect(result.error).toBeUndefined();
  });

  it('returns valid:true with empty sanitized for null/empty', () => {
    expect(validateAndSanitizeCSS('')).toEqual({ valid: true, sanitized: '' });
    expect(validateAndSanitizeCSS(null as any)).toEqual({ valid: true, sanitized: '' });
  });

  it('returns valid:false when CSS exceeds maxLength', () => {
    const result = validateAndSanitizeCSS('a'.repeat(200), 100);
    expect(result.valid).toBe(false);
    expect(result.sanitized).toBe('');
    expect(result.error).toMatch(/exceeds maximum length/i);
  });

  it('sanitizes </style> tags out of the CSS (HTML tag removal)', () => {
    // sanitizeCSS strips all HTML tags first, so </style> is removed before
    // the check — the result is valid after sanitization
    const result = validateAndSanitizeCSS('body { color: red; } </style>');
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toContain('</style>');
  });

  it('sanitizes </script> tags out of the CSS (HTML tag removal)', () => {
    // sanitizeCSS strips all HTML tags first, so </script> is removed before
    // the check — the result is valid after sanitization
    const result = validateAndSanitizeCSS('body { } </script>alert(1)');
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toContain('</script>');
  });

  it('sanitizes dangerous CSS and marks it valid', () => {
    // javascript: gets removed, so the result is safe and valid
    const result = validateAndSanitizeCSS('.x { background: url(javascript:alert(1)) }');
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toContain('javascript:');
  });
});

// ─── checkRateLimit ───────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('allows first request and returns remaining count', () => {
    const key = `test-first-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(key, 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('tracks multiple requests and decrements remaining', () => {
    const key = `test-multi-${Date.now()}-${Math.random()}`;
    expect(checkRateLimit(key, 10, 60000).remaining).toBe(9);
    expect(checkRateLimit(key, 10, 60000).remaining).toBe(8);
    expect(checkRateLimit(key, 10, 60000).remaining).toBe(7);
  });

  it('blocks when limit is reached', () => {
    const key = `test-block-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60000);
    const blocked = checkRateLimit(key, 3, 60000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetIn).toBeGreaterThan(0);
  });

  it('resets after the window expires', async () => {
    const key = `test-reset-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 2; i++) checkRateLimit(key, 2, 20);
    expect(checkRateLimit(key, 2, 20).allowed).toBe(false);
    // Wait for window expiry
    await new Promise(r => setTimeout(r, 30));
    expect(checkRateLimit(key, 2, 20).allowed).toBe(true);
  });

  it('different keys have independent counters', () => {
    const keyA = `rate-a-${Date.now()}-${Math.random()}`;
    const keyB = `rate-b-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(keyA, 3, 60000);
    expect(checkRateLimit(keyA, 3, 60000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 3, 60000).allowed).toBe(true);
  });
});
