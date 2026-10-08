import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoldToRestore } from '../src/input/holdToRestore';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('hold to restore UI', () => {
  it('restores at ten seconds without requiring release, only once', () => {
    const restore = vi.fn(), hold = new HoldToRestore(restore);
    hold.down(1, 100, 100);
    vi.advanceTimersByTime(9999);
    expect(restore).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(restore).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10000);
    expect(restore).toHaveBeenCalledOnce();
  });

  it('requires one continuous press, not the sum of shorter presses', () => {
    const restore = vi.fn(), hold = new HoldToRestore(restore);
    hold.down(1, 100, 100);
    vi.advanceTimersByTime(6000);
    hold.cancel(1);
    hold.down(2, 100, 100);
    vi.advanceTimersByTime(6000);
    expect(restore).not.toHaveBeenCalled();
    hold.cancel(2);
    vi.advanceTimersByTime(10000);
    expect(restore).not.toHaveBeenCalled();
  });

  it('allows finger jitter but cancels a drag even if it comes back', () => {
    const restore = vi.fn(), hold = new HoldToRestore(restore);
    hold.down(1, 100, 100);
    hold.move(1, 110, 110);
    vi.advanceTimersByTime(10000);
    expect(restore).toHaveBeenCalledOnce();
    restore.mockClear();
    hold.down(1, 100, 100);
    hold.move(1, 117, 100);
    hold.move(1, 100, 100);
    vi.advanceTimersByTime(10000);
    expect(restore).not.toHaveBeenCalled();
  });

  it('cancels on interruption and starts a fresh timer on the next press', () => {
    const restore = vi.fn(), hold = new HoldToRestore(restore);
    hold.down(1, 100, 100);
    vi.advanceTimersByTime(9000);
    hold.cancelAll(); // visibility, rotation, pagehide, blur or lost capture
    vi.advanceTimersByTime(1000);
    expect(restore).not.toHaveBeenCalled();
    hold.down(2, 100, 100);
    vi.advanceTimersByTime(9999);
    expect(restore).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(restore).toHaveBeenCalledOnce();
  });

  it('ignores unrelated pointer moves/releases and cancels multi-touch', () => {
    const restore = vi.fn(), hold = new HoldToRestore(restore);
    hold.down(1, 100, 100);
    hold.move(2, 1000, 1000);
    hold.cancel(2);
    vi.advanceTimersByTime(10000);
    expect(restore).toHaveBeenCalledOnce();
    restore.mockClear();
    hold.down(1, 100, 100);
    vi.advanceTimersByTime(9000);
    hold.down(2, 100, 100);
    vi.advanceTimersByTime(10000);
    expect(restore).not.toHaveBeenCalled();
  });
});
