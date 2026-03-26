/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubscription } from '@/hooks/useSubscription';

describe('useSubscription', () => {
  it('returns isLoading: false', () => {
    const { result } = renderHook(() => useSubscription());
    expect(result.current.isLoading).toBe(false);
  });

  it('returns planName: null (subscription tiers not used in OSS portal)', () => {
    const { result } = renderHook(() => useSubscription());
    expect(result.current.planName).toBeNull();
  });

  it('returns userTier: null', () => {
    const { result } = renderHook(() => useSubscription());
    expect(result.current.userTier).toBeNull();
  });

  it('always returns the same stable shape', () => {
    const { result, rerender } = renderHook(() => useSubscription());
    const first = result.current;
    rerender();
    // shape is identical every render (no state changes)
    expect(result.current).toEqual(first);
  });
});
