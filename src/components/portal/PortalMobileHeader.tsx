'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Menu,
  X,
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
  { icon: LayoutDashboard, label: 'Overview', href: '/portal' },
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

export default function PortalMobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { logoUrl } = useAgencyLogo();
  const { role } = usePortalRole();

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

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={cn(
          'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors',
          active
            ? 'bg-gray-800/30 text-white'
            : 'text-white/60 hover:bg-gray-800/30 hover:text-white'
        )}
      >
        <item.icon className="w-5 h-5" />
        <span className="text-base font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-black border-b border-gray-800 px-4 h-14 flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-2">
          <img src={logoUrl || '/logo.svg'} alt="Logo" className="w-9 h-9 object-contain" />
        </Link>
        <button onClick={() => setOpen(true)} className="p-2 text-white">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-800">
              <Link href="/portal" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <img src={logoUrl || '/logo.svg'} alt="Logo" className="w-9 h-9 object-contain" />
              </Link>
              <button onClick={() => setOpen(false)} className="p-2 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 flex flex-col gap-1 p-4 pt-6 overflow-y-auto">
              {role === 'client' ? (
                <>
                  {/* Client mode: Overview + Hosting & Services (clients have paid access) */}
                  {renderItem({ icon: LayoutDashboard, label: 'Overview', href: '/portal' })}
                  {renderItem({ icon: Server, label: 'Hosting', href: '/portal/hosting' })}
                  {renderItem({ icon: Plug, label: 'Services', href: '/portal/services' })}
                </>
              ) : (
                <>
                  {/* Agency/Free mode */}
                  {AGENCY_MAIN_ITEMS.map(renderItem)}

                  {/* Tools separator */}
                  <div className="border-t border-gray-800 mt-2 pt-2">
                    {TOOL_ITEMS.map(renderItem)}
                  </div>
                </>
              )}

              {/* Settings + Exit */}
              <div className="border-t border-gray-800 mt-2 pt-2">
                {BOTTOM_ITEMS.map(renderItem)}
                <button
                  onClick={async () => {
                    setOpen(false);
                    await supabase.auth.signOut();
                    window.location.href = '/auth';
                  }}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors text-white/60 hover:bg-gray-800/30 hover:text-white w-full cursor-pointer"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-base font-medium">Logout</span>
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
