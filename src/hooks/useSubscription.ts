'use client';

// Stub — subscription tiers are not used in the open-source portal
export function useSubscription() {
  return {
    isLoading: false,
    planName: null as string | null,
    userTier: null as string | null,
  };
}
