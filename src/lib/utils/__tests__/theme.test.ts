import { describe, it, expect } from 'vitest';
import { theme } from '../theme';

describe('theme', () => {
  it('has a colors object', () => {
    expect(theme.colors).toBeDefined();
  });

  it('each color group has light and dark variants', () => {
    for (const [, value] of Object.entries(theme.colors)) {
      expect((value as any).light).toBeTruthy();
      expect((value as any).dark).toBeTruthy();
    }
  });

  it('has spacing with xs through xl', () => {
    expect(theme.spacing.xs).toBeTruthy();
    expect(theme.spacing.sm).toBeTruthy();
    expect(theme.spacing.md).toBeTruthy();
    expect(theme.spacing.lg).toBeTruthy();
    expect(theme.spacing.xl).toBeTruthy();
  });

  it('has borderRadius values', () => {
    expect(theme.borderRadius.sm).toBeTruthy();
    expect(theme.borderRadius.md).toBeTruthy();
    expect(theme.borderRadius.lg).toBeTruthy();
    expect(theme.borderRadius.full).toBe('9999px');
  });

  it('has animation values', () => {
    expect(theme.animation.bounce).toContain('bounce');
    expect(theme.animation.pulse).toContain('pulse');
    expect(theme.animation.fadeIn).toContain('fadeIn');
  });

  it('primary colors use indigo/hex values', () => {
    expect(theme.colors.primary.light).toBe('#6366f1');
    expect(theme.colors.primary.dark).toBe('#818cf8');
  });
});
