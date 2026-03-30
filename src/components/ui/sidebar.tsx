'use client';

import { cn } from '@/lib/utils';
import Link, { LinkProps } from 'next/link';
import React, { useState, createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Pin, PinOff } from 'lucide-react';

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
  pinned: boolean;
  setPinned: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
  pinned: pinnedProp,
  setPinned: setPinnedProp,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
  pinned?: boolean;
  setPinned?: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [openState, setOpenState] = useState(false);
  const [pinnedState, setPinnedState] = useState(true); // Default to pinned

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;
  const pinned = pinnedProp !== undefined ? pinnedProp : pinnedState;
  const setPinned = setPinnedProp !== undefined ? setPinnedProp : setPinnedState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate, pinned, setPinned }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
  pinned,
  setPinned,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
  pinned?: boolean;
  setPinned?: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <SidebarProvider
      open={open}
      setOpen={setOpen}
      animate={animate}
      pinned={pinned}
      setPinned={setPinned}
    >
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div> & { workflowButton?: React.ReactNode }) => {
  const { workflowButton, ...rest } = props;
  return (
    <>
      <DesktopSidebar {...(rest as any)} />
      <MobileSidebar {...(rest as unknown as React.ComponentProps<'div'>)} workflowButton={workflowButton} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div> & { children?: React.ReactNode }) => {
  const { open, setOpen, animate, pinned, setPinned } = useSidebar();

  // When pinned, sidebar should always be open
  const shouldBeOpen = pinned || open;

  return (
    <motion.div
      className={cn(
        'h-full px-4 py-4 hidden md:flex md:flex-col bg-black w-[300px] flex-shrink-0 relative border-r border-gray-800 z-30',
        className
      )}
      animate={{
        width: animate ? (shouldBeOpen ? '300px' : '70px') : '300px',
      }}
      onMouseEnter={() => !pinned && setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
      {...props}
    >
      {/* Pin/Unpin Button */}
      <div className='absolute top-4 right-4 z-50'>
        <button
          onClick={() => setPinned(!pinned)}
          className={cn(
            'p-2 rounded-md transition-colors hover:bg-gray-900 min-w-[32px] min-h-[32px] flex items-center justify-center relative z-50 cursor-pointer',
            shouldBeOpen ? 'opacity-100' : 'opacity-0 hover:opacity-100'
          )}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
          style={{ pointerEvents: 'auto' }}
        >
          {pinned ? (
            <PinOff className='h-5 w-5 text-white/70 pointer-events-none' />
          ) : (
            <Pin className='h-5 w-5 text-white/70 pointer-events-none' />
          )}
        </button>
      </div>
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  workflowButton,
  ...props
}: React.ComponentProps<'div'> & { workflowButton?: React.ReactNode }) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      {/* Mobile Header with Logo and Menu */}
      <div
        className={cn(
          'px-4 py-2 flex flex-col md:hidden bg-black w-full fixed top-0 left-0 right-0 z-50 border-b border-gray-800'
        )}
        {...props}
      >
        {/* Top row: Logo and Menu */}
        <div className='flex flex-row items-center justify-between h-12'>
          {/* FlowEngine Logo */}
          <Link href='/' className='flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity'>
            <img
              src='/logo.svg'
              alt='FlowEngine Logo'
              className='h-7 w-7 flex-shrink-0'
            />
            <span className='text-white/90 font-semibold text-lg tracking-tight'>
              FlowEngine
            </span>
          </Link>

          {/* Menu Button */}
          {!open && (
            <div className='flex justify-end'>
              <Menu
                className='text-white cursor-pointer'
                onClick={() => setOpen(!open)}
              />
            </div>
          )}
        </div>

        {/* Workflow Preview Button - Full width below header */}
        {workflowButton && (
          <div className='pb-3 pt-2'>
            {workflowButton}
          </div>
        )}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: 'easeInOut',
              }}
              className={cn(
                'fixed h-full w-full inset-0 bg-gray-950 p-10 z-[100] flex flex-col justify-between',
                className
              )}
            >
              <div
                className='absolute right-10 top-10 z-50 text-white cursor-pointer'
                onClick={() => setOpen(!open)}
              >
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

interface SidebarLinkProps extends Omit<LinkProps, 'href' | 'onClick'> {
  link: Links;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const SidebarLink = ({ link, className, onClick, ...props }: SidebarLinkProps) => {
  const { open, animate, pinned } = useSidebar();
  const shouldShowText = pinned || open;

  return (
    <Link
      href={link.href}
      className={cn('flex items-center justify-start gap-2 group/sidebar py-2', className)}
      onClick={event => {
        if (onClick) {
          event.preventDefault();
          void onClick(event);
        }
      }}
      {...props}
    >
      {link.icon}
      <motion.span
        animate={{
          display: animate ? (shouldShowText ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (shouldShowText ? 1 : 0) : 1,
        }}
        className='text-white text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0'
      >
        {link.label}
      </motion.span>
    </Link>
  );
};
