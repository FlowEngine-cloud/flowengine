'use client';

/**
 * User Profile Cache
 * Caches user profile data to avoid refetching on every navigation
 * Provides instant profile access for authenticated users
 */

interface UserProfile {
  id?: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
  stripe_customer_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface CacheEntry {
  profile: UserProfile;
  timestamp: number;
  userId: string;
}

class UserProfileCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Get cached profile for user
   */
  get(userId: string): UserProfile | null {
    const entry = this.cache.get(userId);

    if (!entry) return null;

    // Check if cache is still fresh
    const age = Date.now() - entry.timestamp;
    if (age > this.CACHE_TTL) {
      this.cache.delete(userId);
      return null;
    }

    return entry.profile;
  }

  /**
   * Set profile in cache
   */
  set(userId: string, profile: UserProfile): void {
    this.cache.set(userId, {
      profile,
      timestamp: Date.now(),
      userId
    });
  }

  /**
   * Clear cache for user
   */
  clear(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Check if profile is cached and fresh
   */
  has(userId: string): boolean {
    return this.get(userId) !== null;
  }
}

// Export singleton instance
export const userProfileCache = new UserProfileCache();
