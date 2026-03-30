'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type SegmentedControlValue = 'plan' | 'build' | 'edit';

interface SegmentedControlProps {
  value: SegmentedControlValue;
  onChange: (value: SegmentedControlValue) => void;
  className?: string;
}

const segments = [
  {
    value: 'plan' as const,
    label: 'Plan',
    tooltip:
      'Planning only; NO workflow creation or editor updates. Shows concise summary + plan steps.',
  },
  {
    value: 'build' as const,
    label: 'Build',
    tooltip: 'Use community templates to build workflows and load them into the editor.',
  },
  {
    value: 'edit' as const,
    label: 'Edit',
    tooltip:
      'Stick with the current workflow and make adjustments. No new templates will be fetched.',
  },
];

export function SegmentedControl({ value, onChange, className }: SegmentedControlProps) {
  return (
    <div className={cn('relative flex bg-gray-800 rounded-lg p-1', className)}>
      {segments.map(segment => (
        <button
          key={segment.value}
          onClick={() => onChange(segment.value)}
          className={cn(
            'relative flex-1 px-3 py-1.5 text-xs font-medium transition-colors rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800',
            value === segment.value ? 'text-white z-10' : 'text-gray-400 hover:text-white/60'
          )}
          title={segment.tooltip}
        >
          {value === segment.value && (
            <motion.div
              layoutId='activeSegment'
              className='absolute inset-0 bg-gray-900/50 border border-gray-700 rounded-md'
              initial={false}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className='relative z-10'>{segment.label}</span>
        </button>
      ))}
    </div>
  );
}
