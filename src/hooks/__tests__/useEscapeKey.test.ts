/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEscapeKey } from '@/hooks/useEscapeKey';

function fireEscape() {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
}

function fireKey(key: string) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('useEscapeKey', () => {
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
  });

  it('calls onClose when Escape is pressed and isOpen is true', () => {
    renderHook(() => useEscapeKey(true, onClose));
    fireEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when isOpen is false', () => {
    renderHook(() => useEscapeKey(false, onClose));
    fireEscape();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT call onClose for non-Escape keys', () => {
    renderHook(() => useEscapeKey(true, onClose));
    fireKey('Enter');
    fireKey('Tab');
    fireKey('ArrowDown');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes the event listener when unmounted', () => {
    const { unmount } = renderHook(() => useEscapeKey(true, onClose));
    unmount();
    fireEscape();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes old listener and adds new one when isOpen changes from true to false', () => {
    const { rerender } = renderHook(
      ({ isOpen }) => useEscapeKey(isOpen, onClose),
      { initialProps: { isOpen: true } }
    );
    // Currently open — Escape fires
    fireEscape();
    expect(onClose).toHaveBeenCalledTimes(1);

    // Close the modal
    rerender({ isOpen: false });
    // Escape should not fire anymore
    fireEscape();
    expect(onClose).toHaveBeenCalledTimes(1); // no additional calls
  });

  it('re-attaches listener when isOpen changes from false to true', () => {
    const { rerender } = renderHook(
      ({ isOpen }) => useEscapeKey(isOpen, onClose),
      { initialProps: { isOpen: false } }
    );
    fireEscape();
    expect(onClose).not.toHaveBeenCalled();

    rerender({ isOpen: true });
    fireEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose multiple times for multiple Escape presses', () => {
    renderHook(() => useEscapeKey(true, onClose));
    fireEscape();
    fireEscape();
    fireEscape();
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
