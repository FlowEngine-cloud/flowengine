/**
 * Environment variable validation
 * Validates required env vars at startup and logs warnings for optional ones
 */

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

// Required for core functionality
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

// Required for Stripe payments
const STRIPE_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
] as const;

// Required for email functionality
const EMAIL_ENV_VARS = [
  'N8N_SMTP_HOST',
  'N8N_SMTP_USER',
  'N8N_SMTP_PASS',
  'N8N_SMTP_SENDER',
] as const;

// Optional but recommended
const OPTIONAL_ENV_VARS = [
  'ENCRYPTION_SECRET',
  'NEXT_PUBLIC_SITE_URL',
] as const;

/**
 * Validate all environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check Stripe vars (required for payments)
  for (const envVar of STRIPE_ENV_VARS) {
    if (!process.env[envVar]) {
      warnings.push(`${envVar} not set - Stripe payments will not work`);
    }
  }

  // Check email vars
  for (const envVar of EMAIL_ENV_VARS) {
    if (!process.env[envVar]) {
      warnings.push(`${envVar} not set - Email notifications will not work`);
    }
  }

  // Check optional vars
  for (const envVar of OPTIONAL_ENV_VARS) {
    if (!process.env[envVar]) {
      warnings.push(`${envVar} not set (optional)`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Log validation results
 */
export function logEnvValidation(): void {
  const result = validateEnvironment();

  if (result.missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    result.missing.forEach(v => console.error(`   - ${v}`));
  }

  if (result.warnings.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Environment warnings:');
    result.warnings.forEach(w => console.warn(`   - ${w}`));
  }

  if (result.valid) {
    console.log('✅ Core environment variables validated');
  }
}

/**
 * Check if a specific feature is configured
 */
export function isFeatureConfigured(feature: 'stripe' | 'email'): boolean {
  switch (feature) {
    case 'stripe':
      return STRIPE_ENV_VARS.every(v => !!process.env[v]);
    case 'email':
      return EMAIL_ENV_VARS.every(v => !!process.env[v]);
    default:
      return false;
  }
}
