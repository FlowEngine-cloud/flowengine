'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { BUBBLE_ICON_MAP, DEFAULT_BUBBLE_ICON } from './constants';

interface BubbleIconProps {
  icon?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a bubble icon for the floating chat button.
 * Supports Lucide icons (by key) or emoji characters.
 */
export function BubbleIcon({ icon, className, style }: BubbleIconProps) {
  const iconKey = icon || DEFAULT_BUBBLE_ICON;
  const IconComponent = BUBBLE_ICON_MAP[iconKey];

  // Lucide icon
  if (IconComponent) {
    return <IconComponent className={className} style={style} />;
  }

  // Emoji (1-2 characters)
  if (iconKey && iconKey.length <= 2) {
    return (
      <span className="text-3xl" style={style}>
        {iconKey}
      </span>
    );
  }

  // Fallback to default
  return <MessageCircle className={className} style={style} />;
}

export default BubbleIcon;
