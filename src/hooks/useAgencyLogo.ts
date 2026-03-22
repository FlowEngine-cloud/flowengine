'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';

const AGENCY_LOGO_KEY = 'flowengine_agency_logo';

interface CachedLogo {
  url: string | null;
  userId: string;
  timestamp: number;
}

/**
 * Read cached logo data from localStorage.
 * Returns the cached data if valid (not expired), null otherwise.
 */
function getCachedLogoData(): CachedLogo | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AGENCY_LOGO_KEY);
    if (cached) {
      const data: CachedLogo = JSON.parse(cached);
      // Check if cache is not too old (24 hours)
      const isNotExpired = (Date.now() - data.timestamp) < 24 * 60 * 60 * 1000;
      if (isNotExpired) return data;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}


/**
 * Hook to get the cached agency logo URL.
 * Returns the logo immediately from cache, then refreshes in background.
 *
 * NOTE: We initialize from localStorage directly to show agency logo first,
 * accepting a minor hydration mismatch for better UX (no flash from FlowEngine to agency logo).
 */
export function useAgencyLogo() {
  const { user } = useAuth();

  // Initialize from localStorage directly to show agency logo immediately
  // This may cause a minor hydration warning but provides better UX
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    const cachedData = getCachedLogoData();
    return cachedData?.url ?? null;
  });
  // Open-source: all features always unlocked
  const [isProPlus] = useState<boolean>(true);
  const [cacheValidForUser, setCacheValidForUser] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated after mount
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Validate cache and fetch fresh data when user is available
  useEffect(() => {
    if (!isHydrated || !user) {
      return;
    }

    // Check if cache is for the current user
    const cachedData = getCachedLogoData();
    const cacheMatchesUser = cachedData?.userId === user.id;

    if (!cacheMatchesUser) {
      // Cache is for different user or doesn't exist
      // Clear state and mark cache as invalid for this user
      setCacheValidForUser(false);
      setLogoUrl(null);
    } else {
      setCacheValidForUser(true);
    }

    // Fetch fresh data for current user
    const fetchLogo = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_logo_url, tier')
          .eq('id', user.id)
          .single();

        if (profile) {
          const url = profile.agency_logo_url || null;
          setLogoUrl(url);
          setCacheValidForUser(true);

          // Cache in localStorage
          try {
            localStorage.setItem(AGENCY_LOGO_KEY, JSON.stringify({
              url,
              userId: user.id,
              timestamp: Date.now(),
            }));
          } catch {
            // Ignore storage errors
          }
        }
      } catch (error) {
        console.error('Error fetching agency logo:', error);
      }
    };

    fetchLogo();
  }, [user, isHydrated]);

  // Show logo if cache is confirmed valid for current user
  return { logoUrl: cacheValidForUser ? logoUrl : null, isProPlus };
}

/**
 * Update the cached agency logo URL.
 * Call this when the user updates their logo in settings.
 */
export function updateCachedAgencyLogo(url: string | null, userId: string) {
  try {
    localStorage.setItem(AGENCY_LOGO_KEY, JSON.stringify({
      url,
      userId,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear the cached agency logo.
 * Call this on logout.
 */
export function clearCachedAgencyLogo() {
  try {
    localStorage.removeItem(AGENCY_LOGO_KEY);
  } catch {
    // Ignore storage errors
  }
}
