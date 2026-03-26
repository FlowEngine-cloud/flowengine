import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnvironment, logEnvValidation, isFeatureConfigured } from '@/lib/validateEnv';

// Save original env so we can restore it after each test
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Clear all relevant env vars before each test
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  delete process.env.N8N_SMTP_HOST;
  delete process.env.N8N_SMTP_USER;
  delete process.env.N8N_SMTP_PASS;
  delete process.env.N8N_SMTP_SENDER;
  delete process.env.ENCRYPTION_SECRET;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  // Restore env
  Object.assign(process.env, ORIGINAL_ENV);
});

// ─── validateEnvironment ──────────────────────────────────────────────────────

describe('validateEnvironment', () => {
  it('reports all three required vars as missing when not set', () => {
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(result.missing).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('is valid when all required vars are set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

    const result = validateEnvironment();
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('includes warnings for missing Stripe vars', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';

    const result = validateEnvironment();
    const stripeWarnings = result.warnings.filter(w => w.includes('STRIPE'));
    expect(stripeWarnings).toHaveLength(3);
  });

  it('includes warnings for missing email vars', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';

    const result = validateEnvironment();
    const emailWarnings = result.warnings.filter(w => w.includes('N8N_SMTP'));
    expect(emailWarnings).toHaveLength(4);
  });

  it('includes warnings for missing optional vars', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';

    const result = validateEnvironment();
    const optionalWarnings = result.warnings.filter(w => w.includes('optional'));
    expect(optionalWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('no warnings for optional vars when they are set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    process.env.ENCRYPTION_SECRET = 'secret';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com';

    const result = validateEnvironment();
    const optionalWarnings = result.warnings.filter(w => w.includes('ENCRYPTION_SECRET') || w.includes('NEXT_PUBLIC_SITE_URL'));
    expect(optionalWarnings).toHaveLength(0);
  });
});

// ─── isFeatureConfigured ──────────────────────────────────────────────────────

describe('isFeatureConfigured', () => {
  it('returns false for stripe when vars are not set', () => {
    expect(isFeatureConfigured('stripe')).toBe(false);
  });

  it('returns true for stripe when all stripe vars are set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test';
    expect(isFeatureConfigured('stripe')).toBe(true);
  });

  it('returns false for stripe when only some stripe vars are set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    // Missing STRIPE_WEBHOOK_SECRET and PUBLISHABLE_KEY
    expect(isFeatureConfigured('stripe')).toBe(false);
  });

  it('returns false for email when vars are not set', () => {
    expect(isFeatureConfigured('email')).toBe(false);
  });

  it('returns true for email when all email vars are set', () => {
    process.env.N8N_SMTP_HOST = 'smtp.example.com';
    process.env.N8N_SMTP_USER = 'user@example.com';
    process.env.N8N_SMTP_PASS = 'password';
    process.env.N8N_SMTP_SENDER = 'noreply@example.com';
    expect(isFeatureConfigured('email')).toBe(true);
  });

  it('returns false for unknown feature', () => {
    expect(isFeatureConfigured('unknown' as any)).toBe(false);
  });
});

// ─── logEnvValidation ─────────────────────────────────────────────────────────

describe('logEnvValidation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs error when required vars are missing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logEnvValidation();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CRITICAL'));
  });

  it('logs success message when required vars are present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEnvValidation();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('validated'));
  });
});
