'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';

const AGENCY_LOGO_KEY = 'flowengine_agency_logo';

interface CachedLogo {
  url: string | null;
  userId: string;
  timestamp: number;
}

function getCachedLogoData(): CachedLogo | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AGENCY_LOGO_KEY);
    if (cached) {
      const data: CachedLogo = JSON.parse(cached);
      const isNotExpired = (Date.now() - data.timestamp) < 24 * 60 * 60 * 1000;
      if (isNotExpired) return data;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Hook to get the agency logo URL.
 * For clients, fetches the agency's logo via /api/portal/branding (bypasses RLS).
 * For agency/free users, also uses /api/portal/branding which returns their own logo.
 */
export function useAgencyLogo() {
  const { user, session } = useAuth();

  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    const cachedData = getCachedLogoData();
    return cachedData?.url ?? null;
  });
  const [isProPlus] = useState<boolean>(true);
  const [cacheValidForUser, setCacheValidForUser] = useState<boolean>(true);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || !user || !session?.access_token) return;

    const cachedData = getCachedLogoData();
    const cacheMatchesUser = cachedData?.userId === user.id;

    if (!cacheMatchesUser) {
      setCacheValidForUser(false);
      setLogoUrl(null);
    } else {
      setCacheValidForUser(true);
    }

    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/portal/branding', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const url = data.agency_logo_url ?? null;
        setLogoUrl(url);
        setCacheValidForUser(true);
        try {
          localStorage.setItem(AGENCY_LOGO_KEY, JSON.stringify({
            url,
            userId: user.id,
            timestamp: Date.now(),
          }));
        } catch {
          // Ignore storage errors
        }
      } catch {
        // Ignore fetch errors
      }
    };

    fetchLogo();
  }, [user, session?.access_token, isHydrated]);

  return { logoUrl: cacheValidForUser ? logoUrl : null, isProPlus };
}

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

export function clearCachedAgencyLogo() {
  try {
    localStorage.removeItem(AGENCY_LOGO_KEY);
  } catch {
    // Ignore storage errors
  }
}
