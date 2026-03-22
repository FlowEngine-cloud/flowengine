'use client';

import { use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/**
 * Redirect /portal/[id] → /portal?instance=[id]
 * Preserves query params (tab, OAuth callbacks, etc.)
 * The unified portal at /portal handles all instance views.
 */
function RedirectToPortal({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('instance', id);
    router.replace(`/portal?${params.toString()}`);
  }, [id, router, searchParams]);

  return null;
}

export default function ClientPanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <RedirectToPortal id={id} />
    </Suspense>
  );
}
