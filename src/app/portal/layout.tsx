'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { BrandedLoadingSpinner } from '@/components/ui/loading-logo';
import { useAgencyLogo } from '@/hooks/useAgencyLogo';
import { usePortalRole } from '@/components/portal/usePortalRole';
import PortalSidebar from '@/components/portal/PortalSidebar';
import PortalMobileHeader from '@/components/portal/PortalMobileHeader';
import { PortalRoleContext } from './context';
import { supabase } from '@/lib/supabase';

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL || '';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || '';
const DEMO_CLIENT_EMAIL = process.env.NEXT_PUBLIC_DEMO_CLIENT_EMAIL || '';
const DEMO_CLIENT_PASSWORD = process.env.NEXT_PUBLIC_DEMO_CLIENT_PASSWORD || '';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { logoUrl } = useAgencyLogo();
  const router = useRouter();
  const { role, agencyId, loading: roleLoading } = usePortalRole();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth');
    }
  }, [authLoading, user, router]);

  const isClientView = IS_DEMO && DEMO_CLIENT_EMAIL && user?.email === DEMO_CLIENT_EMAIL;
  const canSwitchToClient = IS_DEMO && DEMO_CLIENT_EMAIL && DEMO_CLIENT_PASSWORD && !isClientView;
  const canSwitchToAdmin = IS_DEMO && DEMO_EMAIL && DEMO_PASSWORD && isClientView;

  const switchDemo = async (email: string, password: string) => {
    setSwitching(true);
    setSwitchError(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSwitchError(true);
      setTimeout(() => setSwitchError(false), 3000);
    } else {
      // Clear cached role and instances so the new user's role is detected fresh
      try {
        sessionStorage.removeItem('portal-role');
        sessionStorage.removeItem('portal-hosting-instances-v2');
        localStorage.removeItem('flowengine_agency_logo');
      } catch {}
      window.location.href = '/portal';
    }
    setSwitching(false);
  };

  if (authLoading || !user) {
    return <BrandedLoadingSpinner logoUrl={logoUrl} />;
  }

  return (
    <PortalRoleContext.Provider value={{ role, agencyId, loading: roleLoading }}>
      <div className="h-screen bg-black flex flex-col">
        {IS_DEMO && (
          <div className="flex-shrink-0 bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center justify-center gap-3 text-xs text-yellow-400">
            <span>{switchError ? 'Login failed — client user not set up yet.' : 'This is a live demo — changes are disabled.'}</span>
            {canSwitchToClient && (
              <button
                onClick={() => switchDemo(DEMO_CLIENT_EMAIL, DEMO_CLIENT_PASSWORD)}
                disabled={switching}
                className="text-white underline underline-offset-2 hover:text-white/70 disabled:opacity-50 transition-colors"
              >
                {switching ? 'Switching…' : 'View as client →'}
              </button>
            )}
            {canSwitchToAdmin && (
              <button
                onClick={() => switchDemo(DEMO_EMAIL, DEMO_PASSWORD)}
                disabled={switching}
                className="text-white underline underline-offset-2 hover:text-white/70 disabled:opacity-50 transition-colors"
              >
                {switching ? 'Switching…' : '← View as admin'}
              </button>
            )}
          </div>
        )}
        {/* Mobile header */}
        <PortalMobileHeader />

        {/* Desktop layout: sidebar + content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Icon sidebar - desktop only */}
          <div className="hidden md:block">
            <PortalSidebar />
          </div>

          {/* Content area (secondary panel + main content handled by each page) */}
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row pt-14 md:pt-0">
            {children}
          </div>
        </div>
      </div>
    </PortalRoleContext.Provider>
  );
}
