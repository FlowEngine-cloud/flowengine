'use client';

import { useEffect } from 'react';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { AgencyBranding } from '@/components/settings/AgencyBranding';
import { AuthenticationSettings } from '@/components/settings/AuthenticationSettings';
import { TeamMembers } from '@/components/settings/TeamMembers';
import { PlatformSettings } from '@/components/settings/PlatformSettings';
import { OAuthSettings } from '@/components/settings/OAuthSettings';
import { APIAccess } from '@/components/settings/APIAccess';
import { APIDocsSection } from '@/components/settings/APIDocsSection';
import { useSettingsContext } from './context';

export default function PortalSettingsPage() {
  const { activeTab, loading } = useSettingsContext();

  // Scroll to hash target once loading finishes and content is rendered
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [loading, activeTab]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        {activeTab === 'account' && (
          <div className='space-y-8'>
            <section id='account-settings' className='scroll-mt-24'>
              <h2 className='text-xl font-semibold text-white mb-4'>Account Settings</h2>
              <AccountSettings />
            </section>
          </div>
        )}

        {activeTab === 'company' && (
          <>
            <section id="team-members" className='scroll-mt-24 mb-8'>
              <h2 className='text-xl font-semibold text-white mb-4'>Team Members</h2>
              <TeamMembers />
            </section>

            <div className='space-y-8'>
              <section id="branding" className='scroll-mt-24'>
                <h2 className='text-xl font-semibold text-white mb-4'>Name and Logo</h2>
                <AgencyBranding />
              </section>
            </div>

            <section id="authentication" className='scroll-mt-24 mt-8'>
              <h2 className='text-xl font-semibold text-white mb-4'>Authentication</h2>
              <AuthenticationSettings />
            </section>
          </>
        )}

        {activeTab === 'connections' && (
          <div className='space-y-8'>
            <PlatformSettings />
          </div>
        )}

        {activeTab === 'oauth' && (
          <div className='space-y-8'>
            <OAuthSettings />
          </div>
        )}

        {activeTab === 'api' && (
          <div className='space-y-8'>
            <APIAccess />
            <APIDocsSection />
          </div>
        )}
      </div>
    </div>
  );
}
