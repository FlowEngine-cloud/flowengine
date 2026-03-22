'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useServicesContext } from './context';
import { MessageSquare, Search, Phone, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ServicesPage() {
  const { connections, loading, liveStatus, statusLoading } = useServicesContext();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = connections.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.display_name || '').toLowerCase().includes(q) ||
      c.instance_name.toLowerCase().includes(q) ||
      (c.phone_number || '').toLowerCase().includes(q)
    );
  });

  const getStatusDisplay = (status: string) => {
    if (status === 'open' || status === 'connected' || status === 'active') {
      return { label: 'Connected', dotColor: 'bg-green-400', badgeClass: 'bg-green-500/10 text-green-400 border border-green-500/20' };
    }
    if (status === 'connecting' || status === 'pending' || status === 'pending_scan') {
      return { label: 'Waiting for scan', dotColor: 'bg-yellow-400', badgeClass: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' };
    }
    if (status === 'close' || status === 'error' || status === 'disconnected') {
      return { label: 'Disconnected', dotColor: 'bg-red-400', badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20' };
    }
    return { label: status, dotColor: 'bg-gray-500', badgeClass: 'bg-gray-800/30 text-gray-400 border border-gray-700' };
  };

  if (loading) return null; // Layout handles skeleton

  if (connections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-900/50 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-white/40" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No services yet</h3>
          <p className="text-white/60 text-base mb-6 max-w-sm">
            Add a WhatsApp number to get started with messaging services.
          </p>
          <p className="text-white/40 text-sm">Use the Add button in the sidebar to connect a WhatsApp number.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-4">
        {/* Search */}
        {connections.length > 3 && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search connections..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none"
              />
            </div>
          </div>
        )}

        {/* Connection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(conn => {
            const statusDisplay = getStatusDisplay(liveStatus[conn.id] || conn.status);
            return (
              <button
                key={conn.id}
                onClick={() => router.push(`/portal/services/${conn.id}`)}
                className="group bg-gray-900/50 border border-gray-800 hover:border-gray-600 rounded-xl p-5 text-left transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate group-hover:text-white/90">
                      {conn.display_name || conn.instance_name}
                    </h3>
                    <span className="text-sm text-white/40">WhatsApp</span>
                  </div>
                  {statusLoading ? (
                    <span className="px-2.5 py-0.5 text-xs rounded-full inline-flex items-center gap-1.5 shrink-0 bg-gray-800/30 text-gray-400 border border-gray-700">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking
                    </span>
                  ) : (
                    <span className={cn('px-2.5 py-0.5 text-xs rounded-full inline-flex items-center gap-1.5 shrink-0', statusDisplay.badgeClass)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', statusDisplay.dotColor)} />
                      {statusDisplay.label}
                    </span>
                  )}
                </div>
                {conn.phone_number && (
                  <div className="flex items-center gap-1 text-sm text-white/30 mt-2">
                    <Phone className="w-3 h-3" />
                    {conn.phone_number}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
