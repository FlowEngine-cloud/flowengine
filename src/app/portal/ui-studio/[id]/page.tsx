'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UIStudioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace('/portal/ui-studio');
  }, [router]);

  return null;
}
