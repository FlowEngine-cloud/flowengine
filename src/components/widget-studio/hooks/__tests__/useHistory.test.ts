/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory, useDebouncedHistory } from '../useHistory';

// ─── useHistory ───────────────────────────────────────────────────────────────

describe('useHistory', () => {
  it('initialises with the provided state', () => {
    const { result } = renderHook(() => useHistory('hello'));
    expect(result.current.state).toBe('hello');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('setState with recordHistory=true pushes to past', () => {
    const { result } = renderHook(() => useHistory('a'));

    act(() => result.current.setState('b'));

    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.history.past).toHaveLength(1);
    expect(result.current.history.past[0]).toBe('a');
  });

  it('setState with recordHistory=false does NOT push to past', () => {
    const { result } = renderHook(() => useHistory('a'));

    act(() => result.current.setState('b', false));

    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(false);
  });

  it('undo restores previous state', () => {
    const { result } = renderHook(() => useHistory<string>('initial'));

    act(() => result.current.setState('second'));
    act(() => result.current.setState('third'));
    act(() => result.current.undo());

    expect(result.current.state).toBe('second');
    expect(result.current.canRedo).toBe(true);
  });

  it('redo moves forward after undo', () => {
    const { result } = renderHook(() => useHistory<string>('a'));

    act(() => result.current.setState('b'));
    act(() => result.current.setState('c'));
    act(() => result.current.undo());  // → b
    act(() => result.current.redo());  // → c

    expect(result.current.state).toBe('c');
    expect(result.current.canRedo).toBe(false);
  });

  it('new setState clears the redo stack', () => {
    const { result } = renderHook(() => useHistory<string>('a'));

    act(() => result.current.setState('b'));
    act(() => result.current.setState('c'));
    act(() => result.current.undo()); // → b, redo has c
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.setState('d')); // clears redo
    expect(result.current.canRedo).toBe(false);
    expect(result.current.state).toBe('d');
  });

  it('undo when canUndo is false does nothing', () => {
    const { result } = renderHook(() => useHistory('only'));

    const before = result.current.state;
    act(() => result.current.undo());
    expect(result.current.state).toBe(before);
  });

  it('redo when canRedo is false does nothing', () => {
    const { result } = renderHook(() => useHistory('only'));

    act(() => result.current.setState('next'));
    const stateBeforeRedo = result.current.state;
    act(() => result.current.redo()); // nothing to redo
    expect(result.current.state).toBe(stateBeforeRedo);
  });

  it('clear removes past and future but keeps present', () => {
    const { result } = renderHook(() => useHistory<string>('a'));

    act(() => result.current.setState('b'));
    act(() => result.current.setState('c'));
    act(() => result.current.undo());
    act(() => result.current.clear());

    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('caps history at MAX_HISTORY_SIZE (50)', () => {
    const { result } = renderHook(() => useHistory(0));

    act(() => {
      for (let i = 1; i <= 60; i++) {
        result.current.setState(i);
      }
    });

    expect(result.current.history.past.length).toBeLessThanOrEqual(50);
  });

  it('supports functional state updates', () => {
    const { result } = renderHook(() => useHistory(0));

    act(() => result.current.setState(prev => prev + 1));
    act(() => result.current.setState(prev => prev + 1));

    expect(result.current.state).toBe(2);
    act(() => result.current.undo());
    expect(result.current.state).toBe(1);
  });

  it('tracks multiple undo/redo cycles correctly', () => {
    const { result } = renderHook(() => useHistory<string>('a'));

    act(() => result.current.setState('b'));
    act(() => result.current.setState('c'));
    act(() => result.current.setState('d'));

    act(() => result.current.undo()); // d → c
    act(() => result.current.undo()); // c → b
    act(() => result.current.undo()); // b → a

    expect(result.current.state).toBe('a');
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo()); // a → b
    act(() => result.current.redo()); // b → c

    expect(result.current.state).toBe('c');
  });

  it('works with object state', () => {
    const initial = { name: 'Alice', age: 30 };
    const { result } = renderHook(() => useHistory(initial));

    act(() => result.current.setState({ name: 'Bob', age: 25 }));

    expect(result.current.state).toEqual({ name: 'Bob', age: 25 });
    act(() => result.current.undo());
    expect(result.current.state).toEqual(initial);
  });
});

// ─── useDebouncedHistory ──────────────────────────────────────────────────────

describe('useDebouncedHistory', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('initialises with the provided state', () => {
    const { result } = renderHook(() => useDebouncedHistory('initial', 200));
    expect(result.current.state).toBe('initial');
    expect(result.current.canUndo).toBe(false);
  });

  it('updates present immediately but commits to history after debounce', () => {
    const { result } = renderHook(() => useDebouncedHistory('a', 200));

    act(() => result.current.setState('b'));
    // Present updated immediately
    expect(result.current.state).toBe('b');
    // But history not yet committed
    expect(result.current.canUndo).toBe(false);

    // Advance past debounce window
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.canUndo).toBe(true);
  });

  it('collapses rapid changes into a single history entry', () => {
    const { result } = renderHook(() => useDebouncedHistory('', 300));

    act(() => {
      result.current.setState('h');
      result.current.setState('he');
      result.current.setState('hel');
      result.current.setState('hell');
      result.current.setState('hello');
    });

    act(() => vi.advanceTimersByTime(300));

    expect(result.current.state).toBe('hello');
    // Only one history commit despite 5 setState calls
    expect(result.current.history.past).toHaveLength(1);
  });

  it('undo clears pending debounce and reverts', () => {
    const { result } = renderHook(() => useDebouncedHistory('start', 200));

    // Commit 'start' → 'step1' to history
    act(() => result.current.setState('step1'));
    act(() => vi.advanceTimersByTime(200));

    // Start typing 'step2' (not yet committed)
    act(() => result.current.setState('step2'));

    // Undo before debounce fires
    act(() => result.current.undo());

    expect(result.current.state).toBe('start');
    expect(result.current.canUndo).toBe(false);
  });

  it('redo moves forward in history', () => {
    const { result } = renderHook(() => useDebouncedHistory('a', 100));

    act(() => result.current.setState('b'));
    act(() => vi.advanceTimersByTime(100)); // commit a→b

    act(() => result.current.setState('c'));
    act(() => vi.advanceTimersByTime(100)); // commit b→c

    act(() => result.current.undo()); // c → b
    act(() => result.current.redo()); // b → c

    expect(result.current.state).toBe('c');
  });

  it('setState with recordHistory=false does not commit to history', () => {
    const { result } = renderHook(() => useDebouncedHistory('a', 200));

    act(() => result.current.setState('b', false));
    act(() => vi.advanceTimersByTime(200));

    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(false);
  });

  it('clear removes all history and resets pending debounce', () => {
    const { result } = renderHook(() => useDebouncedHistory('a', 200));

    act(() => result.current.setState('b'));
    act(() => vi.advanceTimersByTime(200)); // commit

    act(() => result.current.setState('c')); // pending

    act(() => result.current.clear());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    // Advancing timers should not commit (pending was cleared)
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.canUndo).toBe(false);
  });
});
