'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Server,
  Plug,
  Users,
  FileText,
  Layers,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAgencyLogo } from '@/hooks/useAgencyLogo';
import { usePortalRole } from '@/components/portal/usePortalRole';
import { supabase } from '@/lib/supabase';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const AGENCY_MAIN_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Manage', href: '/portal' },
  { icon: Server, label: 'Hosting', href: '/portal/hosting' },
  { icon: Plug, label: 'Services', href: '/portal/services' },
  { icon: Users, label: 'Clients', href: '/portal/clients' },
];

const TOOL_ITEMS: NavItem[] = [
  { icon: FileText, label: 'Templates', href: '/portal/templates' },
  { icon: Layers, label: 'Embeds', href: '/portal/ui-studio' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { icon: Settings, label: 'Settings', href: '/portal/settings' },
];

export default function PortalSidebar() {
  const pathname = usePathname();
  const { logoUrl } = useAgencyLogo();
  const { role, allowFullAccess } = usePortalRole();

  const knownSections = ['/portal/hosting', '/portal/services', '/portal/clients', '/portal/templates', '/portal/ui-studio', '/portal/settings'];

  const isActive = (href: string) => {
    if (href === '/portal') return pathname === '/portal';
    if (href === '/portal/clients') {
      if (pathname?.startsWith('/portal/clients')) return true;
      if (pathname?.startsWith('/portal/') && pathname !== '/portal') {
        return !knownSections.some((s) => pathname.startsWith(s));
      }
      return false;
    }
    return pathname?.startsWith(href) ?? false;
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);

    const handleClick = (e: React.MouseEvent) => {
      // When clicking a nav item for the current pathname (e.g. Overview while on /portal?instance=xxx),
      // Next.js Link is a no-op since the pathname matches. Force a reset via custom event.
      if (pathname === item.href && window.location.search) {
        e.preventDefault();
        window.history.replaceState(null, '', item.href);
        window.dispatchEvent(new CustomEvent('portal-nav-reset'));
      }
    };

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={handleClick}
        className={cn(
          'flex flex-col items-center justify-center w-[60px] h-[56px] rounded-xl transition-colors group relative',
          active
            ? 'bg-gray-800/30 text-white'
            : 'text-white/60 hover:text-white hover:bg-gray-800/30'
        )}
      >
        <item.icon className={cn('w-[22px] h-[22px]', active ? 'text-white' : 'text-white/60 group-hover:text-white')} />
        <span className={cn('text-xs mt-1 font-medium leading-tight', active ? 'text-white' : 'text-white/60 group-hover:text-white')}>
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <div className="h-full w-[80px] flex-shrink-0 bg-black border-r border-gray-800 flex flex-col items-center py-4 gap-1">
      {/* Logo + Version */}
      <div className="mb-3 flex flex-col items-center gap-1">
        <Link href="/portal" onClick={(e) => { if (pathname === '/portal' && window.location.search) { e.preventDefault(); window.history.replaceState(null, '', '/portal'); window.dispatchEvent(new CustomEvent('portal-nav-reset')); } }} className="flex items-center justify-center w-12 h-12">
          <img
            src={logoUrl || '/logo.svg'}
            alt="Portal"
            className="w-10 h-10 object-contain"
          />
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto scrollbar-hide">
        {role === 'client' ? (
          <>
            {/* Client: Manage always visible */}
            {renderNavItem({ icon: LayoutDashboard, label: 'Manage', href: '/portal' })}
            {/* Full access clients also get Hosting + Services */}
            {allowFullAccess && renderNavItem({ icon: Server, label: 'Hosting', href: '/portal/hosting' })}
            {allowFullAccess && renderNavItem({ icon: Plug, label: 'Services', href: '/portal/services' })}
          </>
        ) : (
          <>
            {/* Agency/Free mode: standard navigation */}
            {AGENCY_MAIN_ITEMS.map(renderNavItem)}

            {/* Separator */}
            <div className="w-10 border-t border-gray-800 my-1" />

            {/* Tools */}
            {TOOL_ITEMS.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 pt-3 border-t border-gray-800">
        {role !== 'client' && BOTTOM_ITEMS.map(renderNavItem)}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = '/auth';
          }}
          className="flex flex-col items-center justify-center w-[60px] h-[56px] rounded-xl transition-colors group text-white/60 hover:text-white hover:bg-gray-800/30 cursor-pointer"
        >
          <LogOut className="w-[22px] h-[22px] text-white/60 group-hover:text-white" />
          <span className="text-xs mt-1 font-medium leading-tight text-white/60 group-hover:text-white">Logout</span>
        </button>
      </div>
    </div>
  );
}
