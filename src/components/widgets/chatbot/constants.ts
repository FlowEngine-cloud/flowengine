import {
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Bot,
  Headphones,
  HelpCircle,
  User,
  UserCircle,
  Smile,
  Heart,
  Star,
  Zap,
  Coffee,
  Ghost,
  Cat,
  Dog,
  Bird,
  type LucideIcon,
} from 'lucide-react';

// Bubble icon options for the floating chat button
export const BUBBLE_ICON_MAP: Record<string, LucideIcon> = {
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  'messages-square': MessagesSquare,
  'bot': Bot,
  'headphones': Headphones,
  'help-circle': HelpCircle,
};

// Avatar icon map for quick lookup by ID
export const AVATAR_ICON_MAP: Record<string, LucideIcon> = {
  'bot': Bot,
  'message': MessageCircle,
  'headphones': Headphones,
  'ghost': Ghost,
  'cat': Cat,
  'bird': Bird,
  'user': User,
  'user-circle': UserCircle,
  'smile': Smile,
  'dog': Dog,
  'heart': Heart,
  'star': Star,
  'zap': Zap,
  'coffee': Coffee,
};

// Avatar icon options for UI selectors (with labels)
export const AVATAR_ICONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'bot', icon: Bot, label: 'Bot' },
  { id: 'user', icon: User, label: 'User' },
  { id: 'user-circle', icon: UserCircle, label: 'User Circle' },
  { id: 'smile', icon: Smile, label: 'Smile' },
  { id: 'ghost', icon: Ghost, label: 'Ghost' },
  { id: 'cat', icon: Cat, label: 'Cat' },
  { id: 'dog', icon: Dog, label: 'Dog' },
  { id: 'bird', icon: Bird, label: 'Bird' },
  { id: 'heart', icon: Heart, label: 'Heart' },
  { id: 'star', icon: Star, label: 'Star' },
  { id: 'zap', icon: Zap, label: 'Zap' },
  { id: 'coffee', icon: Coffee, label: 'Coffee' },
  { id: 'headphones', icon: Headphones, label: 'Headphones' },
  { id: 'message', icon: MessageCircle, label: 'Message' },
];

// Default bubble icon
export const DEFAULT_BUBBLE_ICON = 'message-circle';

// Default avatar icons
export const DEFAULT_BOT_AVATAR_ICON = 'bot';
export const DEFAULT_USER_AVATAR_ICON = 'user';
