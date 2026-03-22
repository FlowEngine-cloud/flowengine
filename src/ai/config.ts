/**
 * Configuration and Environment Validation Module
 */

import { existsSync } from 'fs';

export interface AIRouterConfig {
  aiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  environment: 'development' | 'production' | 'test';
  n8n: N8nConfig;
}

/**
 * N8n API Configuration - Server-side only
 * SECURITY: These credentials should NEVER be exposed to the client
 */
export interface N8nConfig {
  apiUrl: string | null;
  apiKey: string | null;
  webhookUrl: string | null;
  enabled: boolean;
}

export class ConfigurationError extends Error {
  constructor(message: string, public missingVars: string[]) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function getAIRouterConfig(): AIRouterConfig {
  const missingVars: string[] = [];

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (missingVars.length > 0) {
    throw new ConfigurationError(
      `Missing critical environment variables: ${missingVars.join(', ')}`,
      missingVars
    );
  }

  return {
    aiBaseUrl: process.env.AI_BASE_URL || '',
    supabaseUrl: supabaseUrl!,
    supabaseAnonKey: supabaseAnonKey!,
    environment: (process.env.NODE_ENV as any) || 'development',
    n8n: getN8nConfig(),
  };
}

function getN8nConfig(): N8nConfig {
  const apiUrl = process.env.N8N_API_URL;
  const apiKey = process.env.N8N_API_KEY;
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const enabled = !!(apiUrl && apiKey);

  if (!enabled) {
    console.warn('[CONFIG] n8n integration disabled - missing N8N_API_URL or N8N_API_KEY');
  }

  return {
    apiUrl: apiUrl || null,
    apiKey: apiKey || null,
    webhookUrl: webhookUrl || null,
    enabled,
  };
}

export function getN8nConfiguration(): N8nConfig {
  return getN8nConfig();
}

export function getSafeAIBaseUrl(): string {
  try {
    return getAIRouterConfig().aiBaseUrl;
  } catch {
    return '';
  }
}

export function validateEnvironment(): { valid: boolean; errors: string[] } {
  try {
    getAIRouterConfig();
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return { valid: false, errors: error.missingVars };
    }
    return { valid: false, errors: ['Unknown configuration error'] };
  }
}

export function checkFileExists(filePath: string): boolean {
  try {
    return existsSync(filePath);
  } catch {
    return false;
  }
}

export function validateRequiredFiles(): { valid: boolean; missingFiles: string[] } {
  const requiredFiles = ['prompts/workflow-assistant.md'];
  const missingFiles = requiredFiles.filter(f => !checkFileExists(f));
  return { valid: missingFiles.length === 0, missingFiles };
}

export function validateN8nConfig(): { valid: boolean; warnings: string[]; errors: string[] } {
  const config = getN8nConfig();
  const warnings: string[] = [];

  if (!config.enabled) {
    if (!config.apiUrl) warnings.push('N8N_API_URL not configured');
    if (!config.apiKey) warnings.push('N8N_API_KEY not configured');
  }
  if (!config.webhookUrl) warnings.push('N8N_WEBHOOK_URL not configured (optional)');

  return { valid: true, warnings, errors: [] };
}

export function validateSystem() {
  const envValidation = validateEnvironment();
  const fileValidation = validateRequiredFiles();
  const n8nValidation = validateN8nConfig();
  const overall = envValidation.valid && fileValidation.valid;

  return { environment: envValidation, files: fileValidation, n8n: n8nValidation, overall };
}
