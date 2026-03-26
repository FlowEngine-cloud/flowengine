/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { userProfileCache } from '@/lib/userProfileCache';

describe('UserProfileCache', () => {
  beforeEach(() => {
    userProfileCache.clearAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('returns null for a user that has not been cached', () => {
      expect(userProfileCache.get('nonexistent')).toBeNull();
    });

    it('returns cached profile immediately after set', () => {
      const profile = { id: 'user-1', email: 'alice@example.com', full_name: 'Alice' };
      userProfileCache.set('user-1', profile);
      const result = userProfileCache.get('user-1');
      expect(result).toEqual(profile);
    });

    it('returns null after the 5-minute TTL expires', () => {
      const profile = { id: 'user-2', email: 'bob@example.com' };
      userProfileCache.set('user-2', profile);

      // Advance past TTL (5 minutes + 1ms)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(userProfileCache.get('user-2')).toBeNull();
    });

    it('returns profile just before the TTL expires', () => {
      const profile = { id: 'user-3', email: 'carol@example.com' };
      userProfileCache.set('user-3', profile);

      // Advance to just before TTL
      vi.advanceTimersByTime(5 * 60 * 1000 - 1);

      expect(userProfileCache.get('user-3')).toEqual(profile);
    });
  });

  describe('has', () => {
    it('returns false for uncached user', () => {
      expect(userProfileCache.has('unknown-user')).toBe(false);
    });

    it('returns true for a freshly cached user', () => {
      userProfileCache.set('user-4', { id: 'user-4' });
      expect(userProfileCache.has('user-4')).toBe(true);
    });

    it('returns false after TTL expiry', () => {
      userProfileCache.set('user-5', { id: 'user-5' });
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      expect(userProfileCache.has('user-5')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes specific user from cache', () => {
      userProfileCache.set('user-a', { id: 'user-a' });
      userProfileCache.set('user-b', { id: 'user-b' });
      userProfileCache.clear('user-a');
      expect(userProfileCache.get('user-a')).toBeNull();
      expect(userProfileCache.get('user-b')).not.toBeNull();
    });

    it('clearAll removes all entries', () => {
      userProfileCache.set('u1', { id: 'u1' });
      userProfileCache.set('u2', { id: 'u2' });
      userProfileCache.clearAll();
      expect(userProfileCache.get('u1')).toBeNull();
      expect(userProfileCache.get('u2')).toBeNull();
    });
  });

  describe('overwriting', () => {
    it('updates cache when set is called again for the same user', () => {
      userProfileCache.set('user-x', { id: 'user-x', full_name: 'Old Name' });
      userProfileCache.set('user-x', { id: 'user-x', full_name: 'New Name' });
      expect(userProfileCache.get('user-x')?.full_name).toBe('New Name');
    });
  });
});
