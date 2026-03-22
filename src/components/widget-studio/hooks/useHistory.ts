'use client';

import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryReturn<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T), recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  history: HistoryState<T>;
}

const MAX_HISTORY_SIZE = 50;

export function useHistory<T>(initialState: T): UseHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Debounce timer for grouping rapid changes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStateRef = useRef<T>(initialState);

  const setState = useCallback((newState: T | ((prev: T) => T), recordHistory = true) => {
    setHistory((prevHistory) => {
      const resolvedNewState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(prevHistory.present)
        : newState;

      if (!recordHistory) {
        return {
          ...prevHistory,
          present: resolvedNewState,
        };
      }

      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Store the last state for debounced history
      lastStateRef.current = prevHistory.present;

      // Create new past array with size limit
      const newPast = [...prevHistory.past, prevHistory.present].slice(-MAX_HISTORY_SIZE);

      return {
        past: newPast,
        present: resolvedNewState,
        future: [], // Clear future when new change is made
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.past.length === 0) return prevHistory;

      const newPast = prevHistory.past.slice(0, -1);
      const newPresent = prevHistory.past[prevHistory.past.length - 1];
      const newFuture = [prevHistory.present, ...prevHistory.future];

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.future.length === 0) return prevHistory;

      const newFuture = prevHistory.future.slice(1);
      const newPresent = prevHistory.future[0];
      const newPast = [...prevHistory.past, prevHistory.present];

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setHistory((prevHistory) => ({
      past: [],
      present: prevHistory.present,
      future: [],
    }));
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clear,
    history,
  };
}

// Debounced version for text inputs
export function useDebouncedHistory<T>(initialState: T, debounceMs = 500): UseHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<T | null>(null);
  const lastCommittedRef = useRef<T>(initialState);

  const commitToHistory = useCallback((newState: T) => {
    setHistory((prevHistory) => {
      const newPast = [...prevHistory.past, lastCommittedRef.current].slice(-MAX_HISTORY_SIZE);
      lastCommittedRef.current = newState;

      return {
        past: newPast,
        present: newState,
        future: [],
      };
    });
  }, []);

  const setState = useCallback((newState: T | ((prev: T) => T), recordHistory = true) => {
    setHistory((prevHistory) => {
      const resolvedNewState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(prevHistory.present)
        : newState;

      if (!recordHistory) {
        return {
          ...prevHistory,
          present: resolvedNewState,
        };
      }

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      pendingStateRef.current = resolvedNewState;

      // Set new timer to commit to history
      debounceTimerRef.current = setTimeout(() => {
        if (pendingStateRef.current !== null) {
          commitToHistory(pendingStateRef.current);
          pendingStateRef.current = null;
        }
      }, debounceMs);

      return {
        ...prevHistory,
        present: resolvedNewState,
      };
    });
  }, [commitToHistory, debounceMs]);

  const undo = useCallback(() => {
    // Clear any pending debounced changes
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingStateRef.current = null;

    setHistory((prevHistory) => {
      if (prevHistory.past.length === 0) return prevHistory;

      const newPast = prevHistory.past.slice(0, -1);
      const newPresent = prevHistory.past[prevHistory.past.length - 1];
      const newFuture = [prevHistory.present, ...prevHistory.future];

      lastCommittedRef.current = newPresent;

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.future.length === 0) return prevHistory;

      const newFuture = prevHistory.future.slice(1);
      const newPresent = prevHistory.future[0];
      const newPast = [...prevHistory.past, prevHistory.present];

      lastCommittedRef.current = newPresent;

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const clear = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    pendingStateRef.current = null;
    lastCommittedRef.current = history.present;

    setHistory((prevHistory) => ({
      past: [],
      present: prevHistory.present,
      future: [],
    }));
  }, [history.present]);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clear,
    history,
  };
}
