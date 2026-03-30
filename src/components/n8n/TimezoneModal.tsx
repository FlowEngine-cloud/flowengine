'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useEscapeKey } from '@/hooks/useEscapeKey';

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Phoenix', label: 'Arizona' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Rome' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'Mumbai, New Delhi' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Beijing, Shanghai' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Australia/Melbourne', label: 'Melbourne' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
  { value: 'UTC', label: 'UTC' },
];

interface TimezoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  currentTimezone?: string;
  onTimezoneChanged: (timezone: string) => void;
}

export default function TimezoneModal({
  isOpen,
  onClose,
  instanceId,
  currentTimezone = 'America/New_York',
  onTimezoneChanged,
}: TimezoneModalProps) {
  // Close on ESC key
  useEscapeKey(isOpen, onClose);

  const [selectedTimezone, setSelectedTimezone] = useState(currentTimezone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTimezone(currentTimezone);
  }, [currentTimezone]);

  const handleSave = async () => {
    if (selectedTimezone === currentTimezone) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/n8n/timezone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          instanceId,
          timezone: selectedTimezone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update timezone');
      }

      onTimezoneChanged(selectedTimezone);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update timezone');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4' onClick={onClose}>
      {/* Modal */}
      <div className='relative bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl' onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-3'>
            <div className='p-2 bg-gray-800/30 rounded-lg'>
              <Clock className='w-5 h-5 text-white' />
            </div>
            <h2 className='text-lg font-semibold text-white'>Change Timezone</h2>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-800 rounded-lg transition-colors'
          >
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>

        {/* Content */}
        <div className='space-y-4'>
          <p className='text-white/60 text-sm'>
            Select your timezone. The instance will restart to apply changes.
          </p>

          <select
            value={selectedTimezone}
            onChange={(e) => setSelectedTimezone(e.target.value)}
            className='w-full px-4 py-3 pr-10 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-white focus:border-white transition-colors appearance-none bg-no-repeat'
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
              backgroundSize: '1.5rem 1.5rem',
              backgroundPosition: 'right 0.5rem center'
            }}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label} ({tz.value})
              </option>
            ))}
          </select>

          {error && (
            <div className='px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm'>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex gap-3 mt-6'>
          <button
            onClick={onClose}
            disabled={loading}
            className='flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || selectedTimezone === currentTimezone}
            className='flex-1 px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2'
          >
            {loading ? (
              <>
                <Loader2 className='w-4 h-4 animate-spin' />
                Updating...
              </>
            ) : (
              'Save & Restart'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
