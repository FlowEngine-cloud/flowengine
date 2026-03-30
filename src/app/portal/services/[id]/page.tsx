'use client';

/**
 * Service Connection Detail Page
 * Renders WhatsAppConnectionDetail for a single connection.
 * Header is provided by the services layout.
 */
import { use } from 'react';
import WhatsAppConnectionDetail from '@/components/portal/WhatsAppConnectionDetail';

export default function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="flex-1 overflow-y-auto">
      <WhatsAppConnectionDetail connectionId={id} />
    </div>
  );
}
