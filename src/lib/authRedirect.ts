/**
 * Auth Redirect Utilities
 *
 * Handles redirecting users to sign-in/sign-up while preserving their current location
 * so they can return to where they were after authentication.
 */

/**
 * Get the current URL path for redirect purposes
 * Excludes auth pages to prevent redirect loops
 */
export function getCurrentReturnUrl(): string {
  if (typeof window === 'undefined') return '/';

  const currentPath = window.location.pathname + window.location.search;

  // Don't redirect back to auth pages
  if (currentPath.startsWith('/auth/')) {
    return '/';
  }

  return currentPath;
}

/**
 * Redirect to sign-in page with return URL preserved
 * @param returnUrl - Optional custom return URL (defaults to current page)
 */
export function redirectToSignIn(returnUrl?: string): void {
  const url = returnUrl || getCurrentReturnUrl();
  const encodedUrl = encodeURIComponent(url);
  window.location.href = `/auth/signin?redirect=${encodedUrl}`;
}

/**
 * Redirect to sign-up page with return URL preserved
 * @param returnUrl - Optional custom return URL (defaults to current page)
 */
export function redirectToSignUp(returnUrl?: string): void {
  const url = returnUrl || getCurrentReturnUrl();
  const encodedUrl = encodeURIComponent(url);
  window.location.href = `/auth/signup?redirect=${encodedUrl}`;
}

/**
 * Get redirect URL from query parameters
 * Falls back to homepage if no redirect param exists
 */
export function getRedirectUrl(searchParams: URLSearchParams): string {
  const redirect = searchParams.get('redirect') || searchParams.get('next');

  if (!redirect) return '/';

  // Sanitize redirect URL to prevent open redirects
  // Only allow relative URLs
  if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
    console.warn('Blocked absolute URL redirect:', redirect);
    return '/';
  }

  // Ensure it starts with /
  if (!redirect.startsWith('/')) {
    return '/' + redirect;
  }

  return redirect;
}
