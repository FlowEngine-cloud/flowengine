// Animation keyframes CSS - inject into page with <style> tag
export const animationStyles = `
@keyframes bubble-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes bubble-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
@keyframes bubble-shake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  25% { transform: translateX(-5px) rotate(-5deg); }
  75% { transform: translateX(5px) rotate(5deg); }
}
@keyframes bubble-glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 10px var(--glow-color)); }
  50% { filter: drop-shadow(0 0 25px var(--glow-color)); }
}
@keyframes window-slide-up {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes window-fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes window-scale-in {
  0% { opacity: 0; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes typing-dots {
  0%, 20% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-4px); }
  80%, 100% { opacity: 0.3; transform: translateY(0); }
}
@keyframes typing-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}
@keyframes typing-wave {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
`;

// Get bubble animation style based on animation type
export function getBubbleAnimationStyle(
  animation: string,
  glowColor: string = '#ffffff'
): React.CSSProperties {
  const baseStyle: React.CSSProperties = {};

  switch (animation) {
    case 'bounce':
      return { ...baseStyle, animation: 'bubble-bounce 1s ease-in-out infinite' };
    case 'pulse':
      return { ...baseStyle, animation: 'bubble-pulse 2s ease-in-out infinite' };
    case 'shake':
      return { ...baseStyle, animation: 'bubble-shake 0.5s ease-in-out infinite' };
    case 'glow':
      return {
        ...baseStyle,
        '--glow-color': glowColor,
        animation: 'bubble-glow-pulse 2s ease-in-out infinite',
      } as React.CSSProperties;
    default:
      return baseStyle;
  }
}

// Get window animation style based on animation type
// Supports both kebab-case (slide-up) and camelCase (slideUp) formats
export function getWindowAnimationStyle(animation: string): React.CSSProperties {
  switch (animation) {
    case 'slide-up':
    case 'slideUp':
      return { animation: 'window-slide-up 0.3s ease-out forwards' };
    case 'fade-in':
    case 'fadeIn':
      return { animation: 'window-fade-in 0.3s ease-out forwards' };
    case 'scale-in':
    case 'scaleIn':
      return { animation: 'window-scale-in 0.3s ease-out forwards' };
    default:
      return {};
  }
}

// Animation options for UI selectors
export const BUBBLE_ANIMATION_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'shake', label: 'Shake' },
  { id: 'glow', label: 'Glow' },
];

export const WINDOW_ANIMATION_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'slide-up', label: 'Slide Up' },
  { id: 'fade-in', label: 'Fade In' },
  { id: 'scale-in', label: 'Scale In' },
];

export const TYPING_INDICATOR_OPTIONS = [
  { id: 'dots', label: 'Dots' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'wave', label: 'Wave' },
  { id: 'none', label: 'None' },
];

// Get typing indicator animation delay for each dot
export function getTypingDotStyle(
  indicator: string,
  dotIndex: number
): React.CSSProperties {
  const baseDelay = dotIndex * 0.15; // Stagger each dot

  switch (indicator) {
    case 'dots':
      return {
        animation: `typing-dots 1.4s ease-in-out infinite`,
        animationDelay: `${baseDelay}s`,
      };
    case 'pulse':
      return {
        animation: `typing-pulse 1.4s ease-in-out infinite`,
        animationDelay: `${baseDelay}s`,
      };
    case 'wave':
      return {
        animation: `typing-wave 1.2s ease-in-out infinite`,
        animationDelay: `${baseDelay}s`,
      };
    default:
      return {};
  }
}
