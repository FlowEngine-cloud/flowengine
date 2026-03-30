import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, debounce } from '@/lib/utils';

// ─── cn (classname merging) ───────────────────────────────────────────────────

describe('cn', () => {
  it('merges simple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles undefined/null/false values gracefully', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('handles conditional class objects', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
    expect(cn({ active: false, disabled: true })).toBe('disabled');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    // tailwind-merge should keep only the last conflicting utility
    expect(cn('p-4', 'p-8')).toBe('p-8');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles arrays of class names', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });

  it('preserves non-conflicting classes', () => {
    const result = cn('flex', 'items-center', 'gap-2');
    expect(result).toContain('flex');
    expect(result).toContain('items-center');
    expect(result).toContain('gap-2');
  });

  it('handles mixed conditional and string classes', () => {
    const isActive = true;
    const result = cn('base-class', isActive && 'active', !isActive && 'inactive');
    expect(result).toBe('base-class active');
  });
});

// ─── debounce ────────────────────────────────────────────────────────────────

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('only calls the function once after the wait period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls with the last set of arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('does not call the function before the wait period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on each call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced(); // Reset timer
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled(); // Not yet — timer reset

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('can be called again after the wait period fires', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first-call');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);

    debounced('second-call');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second-call');
  });

  it('passes multiple arguments to the underlying function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);
    debounced('a', 'b', 'c');
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith('a', 'b', 'c');
  });
});
