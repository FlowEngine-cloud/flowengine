'use client';

import React, { useState, useLayoutEffect, useEffect } from 'react';

/**
 * Simple loading spinner
 */
export function LoadingLogo({ message }: { message?: string }) {
  return (
    <div className='h-screen flex items-center justify-center bg-black'>
      <div className='w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin' />
    </div>
  );
}

/**
 * Minimal inline loading component for smaller contexts
 */
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className='flex items-center justify-center'>
      <div className={`${sizeClasses[size]} border-2 border-transparent border-t-white rounded-full animate-spin`} />
    </div>
  );
}

interface BrandedLoadingSpinnerProps {
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
}

// Cache keys for reading directly from localStorage
const AGENCY_LOGO_KEY = 'flowengine_agency_logo';
const CLIENT_STATUS_KEY = 'flowengine_client_status';
const AUTH_STATE_KEY = 'flowengine_auth_state';

/**
 * Read cached client status directly from localStorage.
 * Returns { isClient, hasOwnInstances, agencyName, agencyLogoUrl } or null.
 */
export function getCachedClientStatus(): { isClient: boolean; hasOwnInstances: boolean; agencyName: string | null; agencyLogoUrl: string | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CLIENT_STATUS_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is not too old (1 hour - reduced from 24h to prevent stale data)
      const isNotExpired = (Date.now() - data.timestamp) < 60 * 60 * 1000;
      if (isNotExpired) {
        return {
          isClient: data.isClient || false,
          hasOwnInstances: data.hasOwnInstances || false,
          agencyName: data.agencyName || null,
          agencyLogoUrl: data.agencyLogoUrl || null,
        };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Cache client status to localStorage for instant rendering.
 */
export function setCachedClientStatus(
  isClient: boolean,
  hasOwnInstances: boolean,
  agencyName?: string | null,
  agencyLogoUrl?: string | null
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLIENT_STATUS_KEY, JSON.stringify({
      isClient,
      hasOwnInstances,
      agencyName: agencyName || null,
      agencyLogoUrl: agencyLogoUrl || null,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear cached client status (call on logout).
 */
export function clearCachedClientStatus(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CLIENT_STATUS_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if user was previously authenticated (cached in localStorage).
 * Used to show the correct menu instantly while Supabase session loads.
 */
export function getCachedAuthState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUTH_STATE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Cache auth state to localStorage for instant menu rendering.
 */
export function setCachedAuthState(isAuthenticated: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (isAuthenticated) {
      localStorage.setItem(AUTH_STATE_KEY, 'true');
    } else {
      localStorage.removeItem(AUTH_STATE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear cached auth state (call on logout).
 */
export function clearCachedAuthState(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STATE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Read cached logo directly from localStorage.
 * This is used for immediate rendering without waiting for hooks.
 */
function getImmediateLogoUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AGENCY_LOGO_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is not too old (24 hours)
      const isNotExpired = (Date.now() - data.timestamp) < 24 * 60 * 60 * 1000;
      if (isNotExpired && data.url) {
        return data.url;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Branded loading spinner with spinning logo animation.
 * Shows agency logo if provided, otherwise shows FlowEngine logo.
 *
 * IMPORTANT: This component reads from localStorage directly on mount to avoid
 * SSR hydration issues. The logo appears immediately on the client without flash.
 */
export function BrandedLoadingSpinner({
  logoUrl: propLogoUrl,
  size = 'lg',
  fullScreen = true,
  message,
}: BrandedLoadingSpinnerProps) {
  // Track if we've mounted (client-side only)
  const [mounted, setMounted] = useState(false);
  // Read logo directly from localStorage on mount to avoid hydration mismatch
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);

  // Use useLayoutEffect to read from localStorage synchronously before paint
  // This ensures the correct logo appears immediately without flash
  // Falls back to useEffect for SSR safety
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    // Read from localStorage immediately on mount
    const logo = getImmediateLogoUrl();
    setCachedLogo(logo);
    setMounted(true);
  }, []);

  // Use prop logo if provided, otherwise use cached logo
  const logoUrl = propLogoUrl || cachedLogo;

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  };

  const ringSize = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  // During SSR/before mount, show only the spinning ring (no logo yet)
  // This avoids hydration mismatch and ensures smooth transition
  const content = (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Spinning ring */}
        <div
          className={`${ringSize[size]} border-2 border-white/10 border-t-white/60 rounded-full animate-spin absolute inset-0 m-auto`}
          style={{ animationDuration: '1s' }}
        />
        {/* Logo container - only render after mount to avoid flash */}
        <div className={`${ringSize[size]} flex items-center justify-center`}>
          <div className={`${sizeClasses[size]} flex items-center justify-center animate-pulse`}>
            {mounted ? (
              logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Loading"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    // Fallback to FlowEngine logo if image fails to load
                    (e.target as HTMLImageElement).src = '/logo.svg';
                  }}
                />
              ) : (
                <img
                  src="/logo.svg"
                  alt="FlowEngine"
                  className="max-w-full max-h-full object-contain"
                />
              )
            ) : (
              // Placeholder during SSR - just show empty space with pulse
              <div className={`${sizeClasses[size]}`} />
            )}
          </div>
        </div>
      </div>
      {message && (
        <p className="text-white/60 text-sm animate-pulse">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}
