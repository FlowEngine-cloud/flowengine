'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { useAuth } from './AuthContext';
import AuthModal from './AuthModal';
import { getCachedClientStatus, setCachedClientStatus, getCachedAuthState } from './ui/loading-logo';
import { supabase } from '@/lib/supabase';

// Utility to join class names
function cn(...inputs: (string | undefined | null | boolean)[]) {
  return inputs.filter(Boolean).join(' ');
}

// Button component (shadcn/ui pattern)
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (asChild) {
      return (
        <div
          className={cn(buttonVariants({ variant, size, className }))}
          {...(props as any)}
        />
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

const Navigation = () => {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuState, setMenuState] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  // Initialize with cached values to prevent flicker
  const [isClient, setIsClient] = useState(() => {
    const cached = getCachedClientStatus();
    return cached?.isClient || false;
  });
  const [agencyBranding, setAgencyBranding] = useState<{ name: string; logoUrl: string | null } | null>(() => {
    const cached = getCachedClientStatus();
    return cached?.isClient ? { name: cached.agencyName || '', logoUrl: cached.agencyLogoUrl } : null;
  });

  // Check if user is truly authenticated (not anonymous trial user)
  // While loading, use cached auth state to prevent menu flash
  const isAuthenticated = loading ? getCachedAuthState() : !!(user && !user.is_anonymous);

  // Check if user is a client (has a client_instances record) and get tier
  useEffect(() => {
    const checkUserStatus = async () => {
      if (!user || user.is_anonymous) {
        setIsClient(false);
        return;
      }

      try {
        // Get session for API call
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsClient(false);
          return;
        }

        // Use API endpoint for reliable client status check (bypasses RLS)
        const clientStatusRes = await fetch('/api/user/client-status', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });

        const clientStatus = await clientStatusRes.json();
        console.log('[Navigation] Client status API response:', clientStatus);

        const userIsClient = clientStatus.isClient === true;
        setIsClient(userIsClient);

        // Store agency branding for client users and cache for instant rendering
        // Priority: If user has their own instances, show FlowEngine logo (they're a FlowEngine user, not just an agency client)
        // Only show agency branding if they're ONLY a client (no own instances)
        const userHasOwnInstances = clientStatus.hasOwnInstances === true;
        if (userIsClient && clientStatus.agency && !userHasOwnInstances) {
          // Pure client (no own instances) - show agency branding
          const branding = {
            name: clientStatus.agency.name,
            logoUrl: clientStatus.agency.logoUrl || null,
          };
          setAgencyBranding(branding);
          setCachedClientStatus(true, userHasOwnInstances, branding.name, branding.logoUrl);
        } else {
          // User has own instances OR is client of multiple agencies OR is not a client
          // Show FlowEngine logo
          setAgencyBranding(null);
          setCachedClientStatus(userIsClient, userHasOwnInstances, null, null);
        }
      } catch (error) {
        console.error('[Navigation] Error checking client status:', error);
        setIsClient(false);
        setCachedClientStatus(false, false, null, null);
      }
    };

    checkUserStatus();
  }, [user?.id]); // Only re-fetch when user changes, not on every route

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const beforeAuthItems = [
    { name: 'AI Workflow Builder', href: '/chat' },
    { name: 'Tools', href: '/free-tools' },
    { name: 'Workflows', href: '/workflows' },
    { name: 'UI Studio', href: '/n8n-ui-studio' },
    { name: 'WhatsApp API', href: '/whatsapp-api' },
    { name: 'Partners', href: '/partners' },
    { name: 'n8n Hosting', href: '/n8n-hosting' },
    { name: 'OpenClaw Hosting', href: '/openclaw-hosting' },
    { name: 'Docs', href: '/docs' },
    { name: 'Pricing', href: '/#pricing' },
  ];

  // Same menu for all authenticated users
  const afterAuthItems = [
    { name: 'AI Flow Builder', href: '/chat' },
    { name: 'Tools', href: '/free-tools' },
    { name: 'Workflows', href: '/workflows' },
    { name: 'Partners', href: '/partners' },
    { name: 'Templates', href: '/n8n-templates' },
    { name: 'UI Studio', href: '/ui-studio' },
    { name: 'Docs', href: '/docs' },
    { name: 'Settings', href: '/settings' },
  ];

  const menuItems = isAuthenticated ? afterAuthItems : beforeAuthItems;

  // Clear loading state when pathname changes
  React.useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Close mobile menu for all clicks
    setMenuState(false);

    // Handle hash links (pricing, hosting, etc.)
    if (href.startsWith('/#')) {
      const elementId = href.replace('/#', '');

      if (pathname === '/') {
        // Already on homepage — prevent navigation and smooth scroll with retries
        e.preventDefault();
        const scrollToElement = (retries = 0) => {
          const element = document.getElementById(elementId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else if (retries < 10) {
            setTimeout(() => scrollToElement(retries + 1), 100);
          }
        };
        scrollToElement();
      }
      // On other pages, let browser navigate to /#pricing normally
      return;
    }

    // Skip if same page
    if (pathname === href) {
      return;
    }

    e.preventDefault();
    setLoadingHref(href);

    // Navigate immediately - loading state will clear when pathname changes
    router.push(href);
  };

  return (
    <header>
      {showAuthModal && (
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialMode={authMode} redirectTo={pathname || '/'} />
      )}
      <nav data-state={menuState && 'active'} className='fixed z-40 w-full px-4 md:px-8 lg:px-12 group'>
        <div
          className={cn(
            'mx-auto mt-2 max-w-7xl transition-all duration-300',
            isScrolled && 'bg-background/50 max-w-4xl rounded-2xl border backdrop-blur-lg px-5'
          )}
        >
          <div className='relative flex flex-wrap items-center justify-between gap-6 py-3 min-[1060px]:gap-0 min-[1060px]:py-4'>
            <div className='flex w-full justify-between min-[1060px]:w-auto'>
              <Link href='/' aria-label='home' className='flex items-center space-x-2'>
                <Logo agencyBranding={isClient ? agencyBranding : null} />
              </Link>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                className='relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 min-[1060px]:hidden'
              >
                <Menu className='in-data-[state=active]:rotate-180 group-data-[state=active]:scale-0 group-data-[state=active]:opacity-0 m-auto size-6 duration-200' />
                <X className='group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200' />
              </button>
            </div>

            {/* Desktop Menu */}
            <div className='absolute inset-0 m-auto hidden size-fit min-[1060px]:block'>
              <ul className={`flex gap-5 text-sm ${isAuthenticated ? '' : 'flex-row-reverse'}`}>
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <Link
                      id={item.name === 'Hosting' ? 'n8n-hosting-link' : item.name === 'My n8n Account' ? 'my-n8n-account-link' : undefined}
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.href)}
                      className='text-gray-400 hover:text-white block duration-150 cursor-pointer flex items-center gap-2'
                    >
                      <span>{item.name}</span>
                      {loadingHref === item.href && (
                        <Loader2 className='w-3 h-3 animate-spin' />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mobile & CTA */}
            <div className='bg-background group-data-[state=active]:block min-[1060px]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap min-[1060px]:m-0 min-[1060px]:w-fit min-[1060px]:gap-6 min-[1060px]:space-y-0 min-[1060px]:border-transparent min-[1060px]:bg-transparent min-[1060px]:p-0 min-[1060px]:shadow-none shadow-none min-[1060px]:bg-transparent'>
              {/* Mobile menu items */}
              <div className='min-[1060px]:hidden'>
                <ul className='space-y-6 text-base'>
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      <Link
                        href={item.href}
                        onClick={(e) => handleNavClick(e, item.href)}
                        className='text-gray-400 hover:text-white block duration-150 cursor-pointer flex items-center gap-2'
                      >
                        <span>{item.name}</span>
                        {loadingHref === item.href && (
                          <Loader2 className='w-3 h-3 animate-spin' />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Auth buttons */}
              {loading ? (
                <div className='w-16 h-9 bg-gray-800/50 rounded-md animate-pulse' />
              ) : isAuthenticated ? (
                <div className='flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 sm:items-center md:w-fit'>
                  {/* Portal button - always routes to /portal (handles both clients and agency owners) */}
                  <Link
                    href='/portal'
                    onClick={(e) => handleNavClick(e, '/portal')}
                    className='px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap'
                  >
                    Portal
                    {loadingHref === '/portal' && (
                      <Loader2 className='w-3 h-3 animate-spin' />
                    )}
                  </Link>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={async () => {
                      await signOut();
                      router.push('/');
                    }}
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className='flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit'>
                  <Button
                    variant='outline'
                    size='sm'
                    className='cursor-pointer'
                    onClick={() => {
                      setAuthMode('signin');
                      setShowAuthModal(true);
                    }}
                  >
                    Login
                  </Button>
                  <Button
                    id="get-started-button"
                    size='sm'
                    className='cursor-pointer border border-white'
                    onClick={() => {
                      setAuthMode('signup');
                      setShowAuthModal(true);
                    }}
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

const Logo = ({ className, agencyBranding }: { className?: string; agencyBranding?: { name: string; logoUrl: string | null } | null }) => {
  // Show agency branding for clients
  if (agencyBranding) {
    return (
      <span className={cn('text-2xl font-bold flex items-center space-x-2', className)}>
        {agencyBranding.logoUrl ? (
          <img
            src={agencyBranding.logoUrl}
            alt={agencyBranding.name}
            className='h-8 w-auto max-w-[120px] object-contain flex-shrink-0'
          />
        ) : (
          <span className='text-white font-semibold'>{agencyBranding.name}</span>
        )}
      </span>
    );
  }

  return (
    <span className={cn('text-2xl font-semibold tracking-tight flex items-center space-x-2', className)}>
      <img
        src='/logo.svg'
        alt='FlowEngine Logo'
        className='h-5 w-5 flex-shrink-0 brightness-0 invert'
        style={{ minWidth: '20px', minHeight: '20px' }}
      />
      <span className='text-white/90'>
        FlowEngine
      </span>
    </span>
  );
};

export default Navigation;
