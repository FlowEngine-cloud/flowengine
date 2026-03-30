'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useClientsContext } from './context';
import { Users, Plus, Server, Search, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortKey = 'email' | 'instances' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER = { active: 0, pending: 1, inactive: 2 } as const;

const statusTags: Record<string, { label: string; badgeClass: string; dotColor: string }> = {
  active: { label: 'Active', badgeClass: 'bg-green-500/10 text-green-400 border border-green-500/20', dotColor: 'bg-green-400' },
  pending: { label: 'Pending', badgeClass: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20', dotColor: 'bg-yellow-400' },
  inactive: { label: 'Inactive', badgeClass: 'bg-gray-800/30 text-white/50 border border-gray-700', dotColor: 'bg-white/30' },
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
];

export default function ClientsPage() {
  const { grouped: clients, loading, openInvite, statusFilter, setStatusFilter } = useClientsContext();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('email');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3.5 h-3.5 text-white/20" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-white/60" />
      : <ChevronDown className="w-3.5 h-3.5 text-white/60" />;
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: clients.length };
    for (const c of clients) {
      counts[c.bestStatus] = (counts[c.bestStatus] || 0) + 1;
    }
    return counts;
  }, [clients]);

  const filtered = useMemo(() => {
    let result = clients;

    if (statusFilter !== 'all') {
      result = result.filter(c => c.bestStatus === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.email.toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        c.instances.some(i => i.instance_name?.toLowerCase().includes(q))
      );
    }

    result = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'email') {
        return dir * a.email.localeCompare(b.email);
      }
      if (sortKey === 'instances') {
        const aCount = a.instances.filter(i => !i.instance_id.startsWith('invite:') && i.status !== 'deleted').length;
        const bCount = b.instances.filter(i => !i.instance_id.startsWith('invite:') && i.status !== 'deleted').length;
        return dir * (aCount - bCount);
      }
      if (sortKey === 'status') {
        return dir * ((STATUS_ORDER[a.bestStatus] ?? 9) - (STATUS_ORDER[b.bestStatus] ?? 9));
      }
      return 0;
    });

    return result;
  }, [clients, statusFilter, search, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-4">
          {/* Toolbar skeleton */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="h-9 w-full sm:max-w-xs bg-gray-900/50 border border-gray-800 rounded-lg animate-pulse" />
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 w-16 bg-gray-900/50 border border-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          {/* Table skeleton */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_100px] md:grid-cols-[1fr_200px_120px_100px] border-b border-gray-800 px-4 py-3">
              <div className="h-4 w-12 bg-gray-800/30 rounded animate-pulse" />
              <div className="hidden md:block h-4 w-16 bg-gray-800/30 rounded animate-pulse" />
              <div className="h-4 w-12 bg-gray-800/30 rounded animate-pulse" />
              <div className="h-4 w-12 bg-gray-800/30 rounded animate-pulse ml-auto" />
            </div>
            <div className="divide-y divide-gray-800">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="grid grid-cols-[1fr_120px_100px] md:grid-cols-[1fr_200px_120px_100px] items-center px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-800/30 animate-pulse" />
                    <div className="h-4 w-36 bg-gray-800/30 rounded animate-pulse" />
                  </div>
                  <div className="hidden md:block h-4 w-20 bg-gray-800/30 rounded animate-pulse" />
                  <div className="h-6 w-16 bg-gray-800/30 rounded-full animate-pulse" />
                  <div className="h-4 w-8 bg-gray-800/30 rounded animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-gray-800/30 border border-gray-700 rounded-2xl flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-white/40" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No clients yet</h3>
        <p className="text-white/60 text-base mb-6 max-w-sm">
          Add a client by name, or invite them via email to give portal access.
        </p>
        <button
          onClick={openInvite}
          className="px-4 py-3 rounded-lg text-base font-medium transition-colors bg-white text-black hover:bg-gray-100 cursor-pointer"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          Add Client
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-9 pr-3 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(f => {
              const count = statusCounts[f.value] || 0;
              if (f.value !== 'all' && count === 0) return null;
              const isActive = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-white text-black"
                      : "bg-gray-900/50 border border-gray-800 text-white/60 hover:text-white hover:border-gray-700"
                  )}
                >
                  {f.label}
                  <span className={cn("ml-1.5", isActive ? "text-black/60" : "text-white/30")}>{count}</span>
                </button>
              );
            })}
          </div>

          <span className="text-sm text-white/40 ml-auto hidden sm:block">
            {filtered.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_100px] md:grid-cols-[1fr_200px_120px_100px] border-b border-gray-800 px-4 py-3">
            <button
              onClick={() => handleSort('email')}
              className="flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white transition-colors cursor-pointer text-left"
            >
              Client <SortIcon column="email" />
            </button>
            <button
              onClick={() => handleSort('instances')}
              className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white transition-colors cursor-pointer text-left"
            >
              Instances <SortIcon column="instances" />
            </button>
            <button
              onClick={() => handleSort('status')}
              className="flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white transition-colors cursor-pointer text-left"
            >
              Status <SortIcon column="status" />
            </button>
            <span className="text-sm font-semibold text-white/60 text-right">Actions</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-white/40">
                {search ? 'No clients match your search.' : 'No clients match this filter.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filtered.map(client => {
                const realInsts = client.instances.filter(i => !i.instance_id.startsWith('invite:') && i.status !== 'deleted');
                const tag = statusTags[client.bestStatus] || statusTags.inactive;
                return (
                  <button
                    key={client.userId}
                    onClick={() => router.push(`/portal/clients/${client.userId}`)}
                    className="w-full grid grid-cols-[1fr_120px_100px] md:grid-cols-[1fr_200px_120px_100px] items-center px-4 py-3.5 text-left hover:bg-gray-800/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate group-hover:text-white/90">
                          {client.email}
                        </p>
                        <p className="text-sm text-white/40 md:hidden">
                          {realInsts.length} instance{realInsts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-1.5 min-w-0">
                      {realInsts.length === 0 ? (
                        <span className="text-sm text-white/30">-</span>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Server className="w-3.5 h-3.5 text-white/30 shrink-0" />
                          <span className="text-sm text-white/60 truncate">
                            {realInsts.length} instance{realInsts.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className={cn('px-2.5 py-1 text-xs rounded-full inline-flex items-center gap-1.5', tag.badgeClass)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', tag.dotColor)} />
                        {tag.label}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-sm text-white/30 group-hover:text-white/60 transition-colors">
                        View
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
