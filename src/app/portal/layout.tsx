'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { BrandedLoadingSpinner } from '@/components/ui/loading-logo';
import { useAgencyLogo } from '@/hooks/useAgencyLogo';
import { usePortalRole } from '@/components/portal/usePortalRole';
import PortalSidebar from '@/components/portal/PortalSidebar';
import PortalMobileHeader from '@/components/portal/PortalMobileHeader';
import { PortalRoleContext } from './context';

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { logoUrl } = useAgencyLogo();
  const router = useRouter();
  const { role, agencyId, loading: roleLoading } = usePortalRole();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return <BrandedLoadingSpinner logoUrl={logoUrl} />;
  }

  return (
    <PortalRoleContext.Provider value={{ role, agencyId, loading: roleLoading }}>
      <div className="h-screen bg-black flex flex-col">
        {IS_DEMO && (
          <div className="flex-shrink-0 bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-center text-xs text-yellow-400">
            This is a live demo — changes are disabled.
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
