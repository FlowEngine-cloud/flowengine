'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthConfig {
  allow_signup: boolean;
  enable_google_auth: boolean;
  enable_linkedin_auth: boolean;
  enable_github_auth: boolean;
}

interface AuthProps {
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup';
  redirectTo?: string;
  lockedEmail?: string; // Pre-filled and read-only email (for invites)
  authConfig?: AuthConfig;
}

export default function Auth({ onSuccess, initialMode = 'signin', redirectTo, lockedEmail, authConfig }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [email, setEmail] = useState(lockedEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);
  const [resetLoading, setResetLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        // Derive site URL from browser origin to avoid hardcoded localhost in production
        const siteUrl =
          typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_SITE_URL || '';

        const callbackUrl = redirectTo
          ? `${siteUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`
          : `${siteUrl}/auth/callback`;

        console.log('🔐 Sign-up using redirect URL:', callbackUrl);

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl,
          },
        });
        if (error) throw error;

        // Show success message for sign up
        setError('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // After successful sign in, redirect if redirectTo is provided, otherwise call onSuccess
        if (redirectTo) {
          // Don't set loading to false - let the redirect happen with button still loading
          window.location.href = redirectTo;
          return;
        } else {
          onSuccess?.();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthAuth = async (provider: 'google' | 'linkedin_oidc' | 'github') => {
    const setLoadingState = provider === 'google' ? setGoogleLoading : provider === 'linkedin_oidc' ? setLinkedinLoading : setGithubLoading;
    setLoadingState(true);
    setError(null);

    try {
      // Use current browser origin for OAuth redirect to avoid hardcoded localhost
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || '';

      // Build redirect URL
      let redirectUrl = `${baseUrl}/auth/callback`;
      if (redirectTo) {
        const params = new URLSearchParams();
        params.set('next', redirectTo);
        redirectUrl += `?${params.toString()}`;
      }

      console.log(`🔐 ${provider} OAuth sign-in using redirect URL:`, redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoadingState(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError(null);

    try {
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || '';

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/auth/callback?reset=true`,
      });

      if (error) throw error;

      setError('Check your email for the password reset link!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className='w-full max-w-md space-y-8'>
      <div>
        <h2 className='mt-6 text-center text-3xl font-bold tracking-tight text-white'>
          {mode === 'reset' ? 'Reset your password' : mode === 'signin' ? 'Sign in' : 'Create your account'}
        </h2>
        {mode === 'reset' && (
          <p className='mt-2 text-center text-sm text-white/60'>
            Enter your email to receive a password reset link
          </p>
        )}
      </div>

      <div className='mt-8 space-y-6'>
        {/* Social Sign In Buttons - Only shown when enabled in portal settings */}
        {mode !== 'reset' && !lockedEmail && (authConfig?.enable_google_auth || authConfig?.enable_linkedin_auth || authConfig?.enable_github_auth) && (
        <div className='space-y-3'>
          {/* Google Sign In Button */}
          {authConfig?.enable_google_auth && <button
            type='button'
            onClick={() => handleOAuthAuth('google')}
            disabled={googleLoading || linkedinLoading || githubLoading || loading}
            className='btn-minimal group relative flex w-full justify-center items-center rounded-lg py-3 px-4 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {googleLoading ? (
              <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900'></div>
            ) : (
              <>
                <svg className='h-5 w-5 mr-3' viewBox='0 0 24 24'>
                  <path
                    fill='#4285F4'
                    d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                  />
                  <path
                    fill='#34A853'
                    d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                  />
                  <path
                    fill='#FBBC05'
                    d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                  />
                  <path
                    fill='#EA4335'
                    d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>}

          {/* LinkedIn Sign In Button */}
          {authConfig?.enable_linkedin_auth && <button
            type='button'
            onClick={() => handleOAuthAuth('linkedin_oidc')}
            disabled={googleLoading || linkedinLoading || githubLoading || loading}
            className='btn-minimal group relative flex w-full justify-center items-center rounded-lg py-3 px-4 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {linkedinLoading ? (
              <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900'></div>
            ) : (
              <>
                <svg className='h-5 w-5 mr-3' viewBox='0 0 24 24' fill='#0A66C2'>
                  <path d='M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'/>
                </svg>
                Continue with LinkedIn
              </>
            )}
          </button>}

          {/* GitHub Sign In Button */}
          {authConfig?.enable_github_auth && <button
            type='button'
            onClick={() => handleOAuthAuth('github')}
            disabled={googleLoading || linkedinLoading || githubLoading || loading}
            className='btn-minimal group relative flex w-full justify-center items-center rounded-lg py-3 px-4 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {githubLoading ? (
              <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900'></div>
            ) : (
              <>
                <svg className='h-5 w-5 mr-3' viewBox='0 0 24 24' fill='currentColor'>
                  <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z'/>
                </svg>
                Continue with GitHub
              </>
            )}
          </button>}
        </div>
        )}

        {/* Divider - Only shown when OAuth buttons are visible */}
        {mode !== 'reset' && !lockedEmail && (authConfig?.enable_google_auth || authConfig?.enable_linkedin_auth || authConfig?.enable_github_auth) && (
        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <div className='w-full border-t border-white/20' />
          </div>
          <div className='relative flex justify-center text-sm'>
            <span className='bg-black px-2 text-white/60'>Or continue with email</span>
          </div>
        </div>
        )}

        {/* Password Reset Form */}
        {mode === 'reset' ? (
        <form className='space-y-4' onSubmit={handlePasswordReset}>
          <div>
            <label htmlFor='email' className='block text-sm font-medium text-white/80 mb-1'>
              Email address
            </label>
            <input
              id='email'
              name='email'
              type='email'
              autoComplete='email'
              required
              className='block w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white placeholder-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 sm:text-sm backdrop-blur-sm'
              placeholder='Enter your email'
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div
              className={`rounded-lg p-4 border backdrop-blur-sm ${
                error.includes('Check your email')
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <div className='flex'>
                <div className='flex-shrink-0'>
                  {error.includes('Check your email') ? (
                    <svg className='h-5 w-5 text-green-400' fill='currentColor' viewBox='0 0 20 20'>
                      <path
                        fillRule='evenodd'
                        d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                        clipRule='evenodd'
                      />
                    </svg>
                  ) : (
                    <svg className='h-5 w-5 text-red-400' fill='currentColor' viewBox='0 0 20 20'>
                      <path
                        fillRule='evenodd'
                        d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                        clipRule='evenodd'
                      />
                    </svg>
                  )}
                </div>
                <div className='ml-3'>
                  <p className='text-sm font-medium'>{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type='submit'
              disabled={resetLoading}
              className='btn-minimal-filled group relative flex w-full justify-center rounded-lg py-3 px-4 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {resetLoading ? (
                <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-white'></div>
              ) : (
                <>
                  Send reset link
                  <svg
                    className='ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M13 7l5 5m0 0l-5 5m5-5H6'
                    />
                  </svg>
                </>
              )}
            </button>
          </div>

          <div className='text-center'>
            <button
              type='button'
              onClick={() => setMode('signin')}
              className='text-sm text-white/60 hover:text-white font-medium transition-colors cursor-pointer'
            >
              Back to sign in
            </button>
          </div>
        </form>
        ) : (
        /* Email/Password Form */
        <form className='space-y-4' onSubmit={handleAuth}>
          <div className='space-y-4'>
            <div>
              <label htmlFor='email' className='block text-sm font-medium text-white/80 mb-1'>
                Email address
              </label>
              <input
                id='email'
                name='email'
                type='email'
                autoComplete='email'
                required
                readOnly={!!lockedEmail}
                className={`block w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white placeholder-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 sm:text-sm backdrop-blur-sm ${lockedEmail ? 'cursor-not-allowed opacity-70' : ''}`}
                placeholder='Enter your email'
                value={email}
                onChange={e => !lockedEmail && setEmail(e.target.value)}
              />
              {lockedEmail && (
                <p className='mt-1 text-xs text-white/50'>This email was specified in your invitation</p>
              )}
            </div>
            <div>
              <div className='flex items-center justify-between mb-1'>
                <label htmlFor='password' className='block text-sm font-medium text-white/80'>
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type='button'
                    onClick={() => setMode('reset')}
                    className='text-xs text-white/60 hover:text-white transition-colors cursor-pointer'
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id='password'
                name='password'
                type='password'
                required
                className='block w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white placeholder-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 sm:text-sm backdrop-blur-sm'
                placeholder='Enter your password'
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {mode === 'signup' && (
            <div>
              <label htmlFor='confirmPassword' className='block text-sm font-medium text-white/80 mb-1'>
                Confirm password
              </label>
              <input
                id='confirmPassword'
                name='confirmPassword'
                type='password'
                required
                className='block w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white placeholder-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 sm:text-sm backdrop-blur-sm'
                placeholder='Repeat your password'
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            )}
          </div>

          {error && (
            <div
              className={`rounded-lg p-4 border backdrop-blur-sm ${
                error.includes('Check your email')
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <div className='flex'>
                <div className='flex-shrink-0'>
                  {error.includes('Check your email') ? (
                    <svg className='h-5 w-5 text-green-400' fill='currentColor' viewBox='0 0 20 20'>
                      <path
                        fillRule='evenodd'
                        d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                        clipRule='evenodd'
                      />
                    </svg>
                  ) : (
                    <svg className='h-5 w-5 text-red-400' fill='currentColor' viewBox='0 0 20 20'>
                      <path
                        fillRule='evenodd'
                        d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                        clipRule='evenodd'
                      />
                    </svg>
                  )}
                </div>
                <div className='ml-3'>
                  <p className='text-sm font-medium'>{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type='submit'
              disabled={loading || googleLoading}
              className='btn-minimal-filled group relative flex w-full justify-center rounded-lg py-3 px-4 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? (
                <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-white'></div>
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  <svg
                    className='ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M13 7l5 5m0 0l-5 5m5-5H6'
                    />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Sign up toggle - only shown when allow_signup is enabled */}
          {authConfig?.allow_signup && (
          <div className='text-center'>
            <button
              type='button'
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className='text-sm text-white/60 hover:text-white font-medium transition-colors cursor-pointer'
            >
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
          )}
        </form>
        )}
      </div>
    </div>
  );
}
