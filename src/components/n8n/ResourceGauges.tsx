'use client';

import { RefreshCw } from 'lucide-react';

interface HistoryPoint {
  cpu_percent: number;
  ram_usage_mb: number;
  disk_usage_mb: number;
  recorded_at: string;
}

interface ResourceGaugesProps {
  cpu: { usagePercent: number; limitCores: number } | null;
  ram: { usageMb: number; limitMb: number } | null;
  storage: { usageMb: number; limitGb: number } | null;
  history?: HistoryPoint[];
  loading: boolean;
  cached?: boolean;
  onRefresh: () => void;
  instanceId?: string;
}

function getStroke(pct: number): string {
  if (pct >= 90) return '#f87171'; // red-400
  if (pct >= 70) return '#facc15'; // yellow-400
  return '#4ade80'; // green-400
}

/** Real SVG sparkline from history data */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    // Single point or no data — flat line
    return (
      <svg width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none" className="opacity-30">
        <line x1="0" y1="18" x2="100" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 22 - (v / max) * 18;
    return `${x},${y}`;
  });

  const areaPoints = `0,24 ${points.join(' ')} 100,24`;

  return (
    <svg width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none">
      <polygon points={areaPoints} fill={color} opacity="0.1" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  sparkData,
  percentage,
}: {
  label: string;
  value: string;
  sparkData: number[];
  percentage: number;
}) {
  const stroke = getStroke(percentage);

  return (
    <div className="bg-black/30 border border-gray-700 rounded-lg p-3 flex flex-col gap-1.5">
      <span className="text-white/40 text-[11px]">{label}</span>
      <Sparkline data={sparkData} color={stroke} />
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}

export function ResourceGauges({
  cpu,
  ram,
  storage,
  history = [],
  loading,
  onRefresh,
}: ResourceGaugesProps) {
  const cpuPct = cpu?.usagePercent ?? 0;
  const ramGb = ram ? (ram.usageMb / 1024).toFixed(1) : '0';
  const ramPct = ram && ram.limitMb > 0 ? Math.round((ram.usageMb / ram.limitMb) * 100) : 0;
  const storageGb = storage ? (storage.usageMb / 1024).toFixed(1) : '0';
  const storagePct = storage && storage.limitGb > 0 ? Math.round(((storage.usageMb / 1024) / storage.limitGb) * 100) : 0;

  // Extract sparkline data from 24h history
  const cpuSpark = history.map(h => h.cpu_percent);
  const ramSpark = history.map(h => h.ram_usage_mb);
  const diskSpark = history.map(h => h.disk_usage_mb);

  if (loading && !cpu && !ram && !storage) {
    return (
      <div className="bg-black/30 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Loading metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label="CPU usage"
          value={`${cpuPct}%`}
          sparkData={cpuSpark.length > 0 ? cpuSpark : [cpuPct]}
          percentage={cpuPct}
        />
        <MetricCard
          label="Memory usage"
          value={`${ramGb} GB`}
          sparkData={ramSpark.length > 0 ? ramSpark : [ram?.usageMb ?? 0]}
          percentage={ramPct}
        />
        <MetricCard
          label="Disk usage"
          value={`${storageGb} GB`}
          sparkData={diskSpark.length > 0 ? diskSpark : [storage?.usageMb ?? 0]}
          percentage={storagePct}
        />
      </div>
    </div>
  );
}
