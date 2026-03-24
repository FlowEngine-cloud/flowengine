import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retry } from '@/lib/utils/retry';

describe('retry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the result immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retry(fn, { retries: 3, delay: 0, backoff: 1 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and returns result when it eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    const promise = retry(fn, { retries: 3, delay: 0, backoff: 1 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    // Attach .catch() synchronously before advancing timers to prevent unhandled rejection
    const promise = retry(fn, { retries: 3, delay: 0, backoff: 1 });
    const caught = promise.catch(e => e); // handle rejection immediately
    await vi.runAllTimersAsync();
    const err = await caught;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls the function exactly `retries` times on total failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    // Capture the error promise synchronously to avoid unhandled rejection
    const p = retry(fn, { retries: 5, delay: 0, backoff: 1 }).catch(() => {});
    await vi.runAllTimersAsync();
    await p;
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('resolves with one retry when first attempt fails', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValue(42);

    const promise = retry(fn, { retries: 2, delay: 0, backoff: 1 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe(42);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses default retries (3) when no options given', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const p = retry(fn).catch(() => {}); // attach synchronously
    await vi.advanceTimersByTimeAsync(10000); // covers 1000ms + 2000ms delays
    await p;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('waits between attempts (fn is not called again before delay elapses)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const p = retry(fn, { retries: 3, delay: 500, backoff: 1 }).catch(() => {});

    // Only first attempt fires immediately
    expect(fn).toHaveBeenCalledTimes(1);

    // After 500ms, second attempt fires
    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(2);

    // After another 500ms, third attempt fires
    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(3);

    await p; // drain
  });

  it('applies exponential backoff (delay doubles with backoff=2)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const p = retry(fn, { retries: 3, delay: 100, backoff: 2 }).catch(() => {});

    // attempt 1 at 0ms
    expect(fn).toHaveBeenCalledTimes(1);

    // wait 99ms — attempt 2 not yet (needs 100ms)
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);

    // wait 1ms more — attempt 2 fires (100ms elapsed)
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    // wait 199ms — attempt 3 not yet (needs 200ms more)
    await vi.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(2);

    // wait 1ms more — attempt 3 fires (200ms elapsed since attempt 2)
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);

    await p; // drain
  });
});
