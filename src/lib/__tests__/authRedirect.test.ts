/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRedirectUrl, getCurrentReturnUrl, redirectToSignIn, redirectToSignUp } from '@/lib/authRedirect';

// ─── getRedirectUrl ────────────────────────────────────────────────────────────

describe('getRedirectUrl', () => {
  it('returns "/" when no redirect param', () => {
    expect(getRedirectUrl(new URLSearchParams())).toBe('/');
  });

  it('returns "/" when only unrelated params', () => {
    expect(getRedirectUrl(new URLSearchParams('foo=bar'))).toBe('/');
  });

  it('uses "redirect" param when present', () => {
    expect(getRedirectUrl(new URLSearchParams('redirect=/dashboard'))).toBe('/dashboard');
  });

  it('falls back to "next" param', () => {
    expect(getRedirectUrl(new URLSearchParams('next=/portal'))).toBe('/portal');
  });

  it('"redirect" takes precedence over "next"', () => {
    expect(getRedirectUrl(new URLSearchParams('redirect=/a&next=/b'))).toBe('/a');
  });

  it('blocks absolute http:// redirects (open redirect prevention)', () => {
    const result = getRedirectUrl(new URLSearchParams('redirect=http://evil.com'));
    expect(result).toBe('/');
  });

  it('blocks absolute https:// redirects (open redirect prevention)', () => {
    const result = getRedirectUrl(new URLSearchParams('redirect=https://attacker.io/steal'));
    expect(result).toBe('/');
  });

  it('prepends "/" when path has no leading slash', () => {
    expect(getRedirectUrl(new URLSearchParams('redirect=portal/settings'))).toBe('/portal/settings');
  });

  it('preserves query strings in the redirect path', () => {
    expect(getRedirectUrl(new URLSearchParams('redirect=/search?q=hello'))).toBe('/search?q=hello');
  });
});

// ─── getCurrentReturnUrl ───────────────────────────────────────────────────────

describe('getCurrentReturnUrl', () => {
  it('returns "/" for root path (default jsdom location)', () => {
    // jsdom default location is http://localhost/
    expect(getCurrentReturnUrl()).toBe('/');
  });

  it('returns "/" when on an /auth/ page', () => {
    // Override location for this test
    Object.defineProperty(window, 'location', {
      value: { pathname: '/auth/signin', search: '' },
      writable: true,
      configurable: true,
    });
    expect(getCurrentReturnUrl()).toBe('/');
  });

  it('returns full path + search for non-auth pages', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/portal/settings', search: '?tab=smtp' },
      writable: true,
      configurable: true,
    });
    expect(getCurrentReturnUrl()).toBe('/portal/settings?tab=smtp');
  });

  it('returns just the pathname when search is empty', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/portal', search: '' },
      writable: true,
      configurable: true,
    });
    expect(getCurrentReturnUrl()).toBe('/portal');
  });
});

// ─── redirectToSignIn / redirectToSignUp ───────────────────────────────────────

describe('redirectToSignIn', () => {
  beforeEach(() => {
    // Restore a clean writable location object
    Object.defineProperty(window, 'location', {
      value: { pathname: '/portal', search: '', href: '' },
      writable: true,
      configurable: true,
    });
  });

  it('sets window.location.href to the sign-in URL with encoded return URL', () => {
    redirectToSignIn('/portal/settings');
    expect(window.location.href).toBe('/auth/signin?redirect=%2Fportal%2Fsettings');
  });

  it('uses current path when no returnUrl provided', () => {
    redirectToSignIn();
    // getCurrentReturnUrl() returns '/portal' (pathname) + '' (search) = '/portal'
    expect(window.location.href).toBe('/auth/signin?redirect=%2Fportal');
  });
});

describe('redirectToSignUp', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/portal', search: '', href: '' },
      writable: true,
      configurable: true,
    });
  });

  it('sets window.location.href to the sign-up URL with encoded return URL', () => {
    redirectToSignUp('/welcome');
    expect(window.location.href).toBe('/auth/signup?redirect=%2Fwelcome');
  });

  it('uses current path when no returnUrl provided', () => {
    redirectToSignUp();
    expect(window.location.href).toBe('/auth/signup?redirect=%2Fportal');
  });
});
