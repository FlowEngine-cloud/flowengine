'use client';

/**
 * Instance portal layout — now just a passthrough since /portal/[id] redirects
 * to /portal?instance=[id]. The tab navigation lives in the Overview page's
 * secondary panel.
 */
export default function InstanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
