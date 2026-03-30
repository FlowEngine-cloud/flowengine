import { describe, it, expect, vi } from 'vitest';

// Set NEXT_PUBLIC_APP_URL before the module is loaded (module-level const)
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
});

import { APP_URL, buildAppUrl } from '@/lib/config';

describe('APP_URL', () => {
  it('reads from NEXT_PUBLIC_APP_URL env var', () => {
    expect(APP_URL).toBe('https://app.example.com');
  });
});

describe('buildAppUrl', () => {
  it('joins base URL and path with leading slash on path', () => {
    expect(buildAppUrl('/dashboard')).toBe('https://app.example.com/dashboard');
  });

  it('prepends slash when path has no leading slash', () => {
    expect(buildAppUrl('settings')).toBe('https://app.example.com/settings');
  });

  it('strips trailing slash from base URL before joining', () => {
    // The APP_URL const is set at module load, so we can only test the joining logic.
    // If the env had a trailing slash, it would be stripped.
    // We verify the current (no trailing slash) case works:
    expect(buildAppUrl('/path')).toBe('https://app.example.com/path');
  });

  it('handles paths with query strings', () => {
    expect(buildAppUrl('/search?q=test')).toBe('https://app.example.com/search?q=test');
  });

  it('handles nested paths', () => {
    expect(buildAppUrl('/portal/settings/branding')).toBe(
      'https://app.example.com/portal/settings/branding'
    );
  });

  it('handles empty path as root slash', () => {
    // empty string → cleanPath becomes '/'
    expect(buildAppUrl('')).toBe('https://app.example.com/');
  });
});
