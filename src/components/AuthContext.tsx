'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { clearCachedAgencyLogo } from '@/hooks/useAgencyLogo';
import { clearCachedClientStatus, setCachedAuthState, clearCachedAuthState } from './ui/loading-logo';


interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  keySetup: 'idle' | 'checking' | 'ready' | 'error';
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  keySetup: 'idle',
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Start with true to prevent flash of unauthenticated content on protected pages
  const [loading, setLoading] = useState(true);
  const [keySetup, setKeySetup] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');

  useEffect(() => {
    // Skip auth in development if SKIP_AUTH is enabled
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        email_confirmed_at: new Date().toISOString(),
        phone: '',
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as User;

      const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        token_type: 'bearer',
        user: mockUser,
      } as Session;

      setUser(mockUser);
      setSession(mockSession);
      setLoading(false);
      return;
    }

    // Get initial session with timeout
    const getSession = async () => {
      console.log('🔐 AuthContext: Starting session check...');
      try {
        // Add timeout to prevent hanging - 3s is enough for most cases
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session timeout')), 3000)
        );

        const {
          data: { session },
        } = (await Promise.race([sessionPromise, timeoutPromise])) as any;

        console.log('🔐 AuthContext: getSession result:', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
        });

        setSession(session);
        setUser(session?.user ?? null);
        // Cache auth state for instant menu rendering on next visit
        setCachedAuthState(!!(session?.user && !session.user.is_anonymous));
      } catch (error) {
        console.error('🔐 AuthContext: Error getting session:', error);
        // Continue without session rather than hanging
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // Cache auth state for instant menu rendering on next visit
      setCachedAuthState(!!(session?.user && !session.user.is_anonymous));

    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Key setup is handled server-side on signup.
  useEffect(() => {
    if (user) {
      setKeySetup('ready'); // Assume key is ready if user is logged in.
    }
  }, [user]);

  const signOut = async () => {
    try {
      setLoading(true);
      // Clear caches to prevent showing wrong data on next login
      clearCachedAgencyLogo();
      clearCachedClientStatus();
      clearCachedAuthState();
      await supabase.auth.signOut();
      // Auth state change listener will update the state
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    keySetup,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
