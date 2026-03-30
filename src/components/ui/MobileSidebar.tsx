'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileSidebarProps {
  children: React.ReactNode;
  trigger?: React.ReactNode;
  title?: string;
  className?: string;
  side?: 'left' | 'right';
}

export function MobileSidebar({
  children,
  trigger,
  title = 'Menu',
  className,
  side = 'left'
}: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle touch events for swipe to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    const diff = side === 'left'
      ? startXRef.current - currentX
      : currentX - startXRef.current;

    if (diff > 0) {
      setDragOffset(Math.min(diff, 300));
    }
  }, [isDragging, side]);

  const handleTouchEnd = useCallback(() => {
    if (dragOffset > 100) {
      setIsOpen(false);
    }
    setDragOffset(0);
    setIsDragging(false);
  }, [dragOffset]);

  // Handle edge swipe to open (only when closed)
  useEffect(() => {
    if (isOpen) return;

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = Math.abs(endY - startY);

      // Check if it's a horizontal swipe from the edge
      const edgeThreshold = 30;
      const swipeThreshold = 50;

      if (side === 'left' && startX < edgeThreshold && diffX > swipeThreshold && diffY < 100) {
        setIsOpen(true);
      } else if (side === 'right' && startX > window.innerWidth - edgeThreshold && diffX < -swipeThreshold && diffY < 100) {
        setIsOpen(true);
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, side]);

  const sidebarTransform = side === 'left'
    ? `translateX(${isOpen ? -dragOffset : -100}${isOpen && dragOffset === 0 ? '%' : 'px'})`
    : `translateX(${isOpen ? dragOffset : 100}${isOpen && dragOffset === 0 ? '%' : 'px'})`;

  return (
    <>
      {/* Trigger button - only show on mobile */}
      <div className="lg:hidden">
        {trigger ? (
          <div onClick={() => setIsOpen(true)}>{trigger}</div>
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 left-4 z-30 flex items-center gap-2 px-4 py-3 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-full text-white shadow-lg hover:bg-gray-800/50 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
            <span className="text-sm font-medium">{title}</span>
          </button>
        )}
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
          style={{ opacity: 1 - dragOffset / 300 }}
        />
      )}

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        className={cn(
          'fixed top-0 bottom-0 w-[280px] max-w-[85vw] bg-gray-900 border-gray-800 z-50 lg:hidden',
          'transition-transform duration-300 ease-out',
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
          !isOpen && !isDragging && 'pointer-events-none',
          className
        )}
        style={{
          transform: isOpen
            ? (side === 'left' ? `translateX(-${dragOffset}px)` : `translateX(${dragOffset}px)`)
            : (side === 'left' ? 'translateX(-100%)' : 'translateX(100%)'),
          transition: isDragging ? 'none' : undefined
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <span className="text-white font-semibold">{title}</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-60px)] p-4">
          {/* Pass setIsOpen to children so they can close the sidebar */}
          {React.Children.map(children, child => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, {
                onNavigate: () => setIsOpen(false)
              });
            }
            return child;
          })}
        </div>
      </div>
    </>
  );
}

// Companion component for sidebar content that should close on click
interface MobileSidebarLinkProps {
  children: React.ReactNode;
  onClick?: () => void;
  onNavigate?: () => void;
  className?: string;
  active?: boolean;
}

export function MobileSidebarLink({
  children,
  onClick,
  onNavigate,
  className,
  active
}: MobileSidebarLinkProps) {
  const handleClick = () => {
    onClick?.();
    onNavigate?.();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
        active
          ? 'bg-white text-black'
          : 'text-gray-400 hover:text-white hover:bg-gray-800/50',
        className
      )}
    >
      {children}
    </button>
  );
}
