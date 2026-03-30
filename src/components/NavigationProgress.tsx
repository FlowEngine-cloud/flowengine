'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Global navigation progress bar
 * Shows at top of screen during route transitions
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Reset progress when route changes
    setLoading(false);
    setProgress(0);
  }, [pathname]);

  useEffect(() => {
    if (!loading) return;

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [loading]);

  // Listen for link clicks to start loading
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && link.href.startsWith(window.location.origin)) {
        const targetPath = new URL(link.href).pathname;
        if (targetPath !== pathname && !link.href.includes('#')) {
          setLoading(true);
          setProgress(10);
        }
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [pathname]);

  if (!loading) return null;

  return (
    <div
      className='fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 z-[100] transition-all duration-300'
      style={{
        width: `${progress}%`,
        boxShadow: '0 0 10px rgba(168, 85, 247, 0.5)',
      }}
    />
  );
}
