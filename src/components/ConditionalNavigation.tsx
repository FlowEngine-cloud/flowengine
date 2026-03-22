'use client';

import { usePathname } from 'next/navigation';
import React from 'react';

interface ConditionalNavigationProps {
  children: React.ReactNode;
}

/**
 * Simplified ConditionalNavigation for the open-source portal.
 * The full version includes homepage navigation, footer, and onboarding guides.
 * Since the portal only uses /portal and /auth routes, this just renders children.
 */
export default function ConditionalNavigation({ children }: ConditionalNavigationProps) {
  return <>{children}</>;
}
