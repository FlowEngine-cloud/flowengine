'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SecondaryPanel, { SecondaryPanelSection } from '@/components/portal/SecondaryPanel';
import { User, Building2, Search, Link2, KeyRound, Plug } from 'lucide-react';
import { SettingsContext, type SettingsTab } from './context';
import { usePortalRole } from '@/components/portal/usePortalRole';

function SettingsLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = usePortalRole();
  const loading = false;
  // Self-hosted: all features unlocked, everyone has Teams-level access
  const isTeams = true;
  const [search, setSearch] = useState('');

  const rawTab = (searchParams?.get('tab') as SettingsTab) || 'account';
  // Clients can only access account tab — redirect if they somehow land elsewhere
  const activeTab: SettingsTab = (role === 'client' && rawTab !== 'account') ? 'account' : rawTab;

  // Handle URL hash for deep linking
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'branding' || hash === 'team-members' || hash === 'authentication') {
      if (activeTab !== 'company') router.replace('/portal/settings?tab=company#' + hash);
    } else if (hash === 'flowengine' || hash === 'ai' || hash === 'stripe' || hash === 'smtp') {
      if (activeTab !== 'connections') router.replace('/portal/settings?tab=connections#' + hash);
    } else if (hash === 'google' || hash === 'microsoft' || hash === 'slack' || hash === 'linkedin' || hash === 'reddit' || hash === 'twitter') {
      if (activeTab !== 'oauth') router.replace('/portal/settings?tab=oauth#' + hash);
    } else if (hash === 'api-access' || hash === 'mcp' || hash === 'api-docs') {
      if (activeTab !== 'api') router.replace('/portal/settings?tab=api#' + hash);
    }
  }, []);

  const handleSelect = useCallback((id: string) => {
    if (id.startsWith('tab:')) {
      const raw = id.replace('tab:', '');
      const [tabId, anchor] = raw.split('#');
      if (anchor && tabId === activeTab) {
        // Scroll to anchor within current tab
        setTimeout(() => {
          const el = document.getElementById(anchor);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        return;
      }
      const url = `/portal/settings?tab=${tabId}` + (anchor ? `#${anchor}` : '');
      router.replace(url);
      if (anchor) {
        setTimeout(() => {
          const el = document.getElementById(anchor);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      return;
    }
  }, [activeTab, router]);

  // Build sub-items per tab
  const accountSubItems = [
    { id: 'tab:account#account-settings', label: 'Account' },
  ];

  const companySubItems = [
    { id: 'tab:company#team-members', label: 'Team Members' },
    { id: 'tab:company#branding', label: 'Name and Logo' },
    { id: 'tab:company#authentication', label: 'Authentication' },
  ];

  const connectionsSubItems = [
    { id: 'tab:connections#flowengine', label: 'FlowEngine API' },
    { id: 'tab:connections#ai', label: 'AI Provider' },
    { id: 'tab:connections#stripe', label: 'Stripe' },
    { id: 'tab:connections#smtp', label: 'Email SMTP' },
  ];

  const oauthSubItems = [
    { id: 'tab:oauth#google', label: 'Google' },
    { id: 'tab:oauth#microsoft', label: 'Microsoft' },
    { id: 'tab:oauth#slack', label: 'Slack' },
    { id: 'tab:oauth#linkedin', label: 'LinkedIn' },
    { id: 'tab:oauth#reddit', label: 'Reddit' },
    { id: 'tab:oauth#twitter', label: 'Twitter/X' },
  ];

  const apiSubItems = [
    { id: 'tab:api#api-access', label: 'API Key' },
    { id: 'tab:api#mcp', label: 'MCP Server' },
    { id: 'tab:api#api-docs', label: 'API Docs' },
  ];

  const tabs = [
    { id: 'account' as const, label: 'Account', icon: <User className="w-4 h-4" />, subItems: accountSubItems },
    { id: 'company' as const, label: 'Company', icon: <Building2 className="w-4 h-4" />, subItems: companySubItems },
    { id: 'connections' as const, label: 'Connections', icon: <Link2 className="w-4 h-4" />, subItems: connectionsSubItems },
    { id: 'oauth' as const, label: 'OAuth', icon: <KeyRound className="w-4 h-4" />, subItems: oauthSubItems },
    { id: 'api' as const, label: 'API & MCP', icon: <Plug className="w-4 h-4" />, subItems: apiSubItems },
  ];

  // Clients only see Account (their own profile)
  const visibleTabs = role === 'client' ? tabs.filter(t => t.id === 'account') : tabs;

  // Filter tabs by search
  const q = search.toLowerCase();
  const filteredTabs = q
    ? visibleTabs.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.subItems.some(s => s.label.toLowerCase().includes(q))
      )
    : visibleTabs;

  // Build SecondaryPanel sections - each tab is a main item, sub-items are nested
  const sections: SecondaryPanelSection[] = [];

  const sectionItems: { id: string; label: string; icon?: React.ReactNode }[] = [];
  for (const tab of filteredTabs) {
    sectionItems.push({ id: `tab:${tab.id}`, label: tab.label, icon: tab.icon });
    // Show sub-items under active tab
    if (activeTab === tab.id && tab.subItems.length > 0) {
      for (const sub of tab.subItems) {
        sectionItems.push({ id: sub.id, label: sub.label });
      }
    }
  }

  sections.push({
    title: '',
    items: sectionItems,
  });

  // Custom search component for the SecondaryPanel
  const searchComponent = (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search settings..."
        className="w-full pl-9 pr-3 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder:text-white/30 focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-colors outline-none"
      />
    </div>
  );

  return (
    <SettingsContext.Provider value={{ activeTab, isTeams, loading }}>
      {/* Secondary panel */}
      <div className="hidden md:flex">
        <SecondaryPanel
          sections={sections}
          selectedId={`tab:${activeTab}`}
          onSelect={handleSelect}
          customSearch={searchComponent}
        />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header bar */}
        <div className="flex-shrink-0 border-b border-gray-800 px-6 h-[64px] flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold text-white">Settings</h1>
        </div>

        {/* Content */}
        {children}
      </div>
    </SettingsContext.Provider>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SettingsLayoutInner>{children}</SettingsLayoutInner>
    </Suspense>
  );
}
