'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import Auth from '@/components/Auth';
import { supabase } from '@/lib/supabase';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL || '';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || '';

/** Read cached agency logo from localStorage (persists after logout). */
function getCachedLogo(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('flowengine_agency_logo');
    if (cached) {
      const data = JSON.parse(cached);
      if (data?.url) return data.url;
    }
  } catch { /* ignore */ }
  return null;
}

interface AuthConfig {
  allow_signup: boolean;
  enable_google_auth: boolean;
  enable_linkedin_auth: boolean;
  enable_github_auth: boolean;
  agency_name: string | null;
  first_run: boolean;
}

export default function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [demoLoading, setDemoLoading] = useState(false);

  const enterDemo = async () => {
    if (!DEMO_EMAIL || !DEMO_PASSWORD) return;
    setDemoLoading(true);
    await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    setDemoLoading(false);
  };
  const [logoUrl] = useState<string | null>(() => getCachedLogo());
  const [authConfig, setAuthConfig] = useState<AuthConfig | undefined>();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/portal');
    }
  }, [loading, user, router]);

  // Fetch auth config (public endpoint, no auth needed)
  useEffect(() => {
    fetch('/api/auth-config')
      .then(res => res.json())
      .then(setAuthConfig)
      .catch(() => {
        // Default: everything disabled
        setAuthConfig({
          allow_signup: false,
          enable_google_auth: false,
          enable_linkedin_auth: false,
          enable_github_auth: false,
          agency_name: null,
          first_run: false,
        });
      });
  }, []);

  if (loading || !authConfig) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      {/* Logo + Agency name */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <img src={logoUrl || '/logo.svg'} alt="Portal" className="w-20 h-20 object-contain" />
        <span className="text-lg font-semibold text-white">
          {authConfig?.agency_name || 'FlowEngine'}
        </span>
      </div>
      {DEMO_MODE && DEMO_EMAIL ? (
        <div className="w-full max-w-sm">
          <button
            onClick={enterDemo}
            disabled={demoLoading}
            className="w-full py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {demoLoading ? 'Entering demo...' : 'Try the demo'}
          </button>
          <p className="text-center text-xs text-white/30 mt-3">Read-only live demo</p>
        </div>
      ) : (
        <Auth
          onSuccess={() => router.replace('/portal')}
          initialMode={authConfig?.first_run ? 'signup' : 'signin'}
          authConfig={authConfig}
        />
      )}
    </div>
  );
}
