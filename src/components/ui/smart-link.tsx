'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, ComponentProps } from 'react';

/**
 * Smart Link component with intelligent prefetching
 * Prefetches routes when user hovers or when link becomes visible
 */
export function SmartLink({ href, prefetch = true, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!prefetch || typeof href !== 'string') return;

    // Prefetch when link enters viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            router.prefetch(href);
          }
        });
      },
      { rootMargin: '50px' } // Start prefetching 50px before visible
    );

    if (linkRef.current) {
      observer.observe(linkRef.current);
    }

    return () => {
      if (linkRef.current) {
        observer.unobserve(linkRef.current);
      }
    };
  }, [href, prefetch, router]);

  return <Link ref={linkRef} href={href} prefetch={prefetch} {...props} />;
}
