'use client';

import React from 'react';
import { Bot, User } from 'lucide-react';
import { AVATAR_ICONS, DEFAULT_BOT_AVATAR_ICON, DEFAULT_USER_AVATAR_ICON } from './constants';

interface AvatarIconProps {
  /** Icon key from AVATAR_ICONS or custom image URL */
  icon?: string;
  /** Image URL (takes priority over icon if provided) */
  imageUrl?: string;
  /** Avatar type for default fallback */
  type: 'bot' | 'user';
  /** Background color for icon avatars */
  backgroundColor?: string;
  /** Icon color for icon avatars */
  iconColor?: string;
  /** Size class (default: 'w-8 h-8') */
  sizeClass?: string;
  /** Icon size class (default: 'w-5 h-5') */
  iconSizeClass?: string;
  /** Additional className for the container */
  className?: string;
}

/**
 * Check if a string is likely an emoji (1-4 characters, non-ASCII or emoji-like)
 */
function isEmoji(str: string): boolean {
  if (!str || str.length > 4) return false;
  // Check for emoji ranges and special characters
  return /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}\u200D]+$/u.test(str);
}

/**
 * Check if a string is a URL
 */
function isUrl(str: string): boolean {
  return str?.startsWith('http://') || str?.startsWith('https://') || str?.startsWith('data:');
}

/**
 * Renders an avatar icon for bot or user messages.
 * Supports custom image URLs, emojis, or Lucide icons.
 */
export function AvatarIcon({
  icon,
  imageUrl,
  type,
  backgroundColor = '#3b82f6',
  iconColor = '#ffffff',
  sizeClass = 'w-8 h-8',
  iconSizeClass = 'w-5 h-5',
  className = '',
}: AvatarIconProps) {
  // Priority 1: If explicit image URL is provided, render image
  if (imageUrl) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ backgroundColor }}
      >
        <img
          src={imageUrl}
          alt={`${type} avatar`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Hide broken images
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Priority 2: Check if icon is a URL
  if (icon && isUrl(icon)) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ backgroundColor }}
      >
        <img
          src={icon}
          alt={`${type} avatar`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Hide broken images
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Priority 3: Check if icon is an emoji
  if (icon && isEmoji(icon)) {
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ backgroundColor }}
      >
        <span className="text-lg">{icon}</span>
      </div>
    );
  }

  // Priority 4: Find icon from AVATAR_ICONS
  const defaultIcon = type === 'bot' ? DEFAULT_BOT_AVATAR_ICON : DEFAULT_USER_AVATAR_ICON;
  const iconKey = icon || defaultIcon;
  const avatarIcon = AVATAR_ICONS.find((a) => a.id === iconKey);
  const IconComponent = avatarIcon?.icon || (type === 'bot' ? Bot : User);

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ backgroundColor }}
    >
      <IconComponent className={iconSizeClass} style={{ color: iconColor }} />
    </div>
  );
}

export default AvatarIcon;
