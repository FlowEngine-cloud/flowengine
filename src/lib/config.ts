/**
 * Application Configuration
 *
 * Centralized configuration for URLs and other app-wide settings.
 * Uses environment variables with sensible fallbacks.
 */

// Main FlowEngine app URL (NOT n8n instances)
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

// Helper to build full URLs
export function buildAppUrl(path: string): string {
  const base = APP_URL.endsWith('/') ? APP_URL.slice(0, -1) : APP_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
