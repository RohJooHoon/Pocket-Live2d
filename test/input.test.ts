import { describe, expect, it } from 'vitest';
import { ShakeDetector } from '../src/input/shake';
import { TapTracker } from '../src/input/tap';

describe('ShakeDetector', () => {
  it('detects strong linear acceleration with a cooldown', () => {
    const detector = new ShakeDetector();
    const strong = { x: 10, y: 10, z: 0, includesGravity: false };
    expect(detector.update({ x: 3, y: 0, z: 0, includesGravity: false }, 0)).toBe(false);
    expect(detector.update(strong, 100)).toBe(true);
    expect(detector.update(strong, 500)).toBe(false);
    expect(detector.update(strong, 1100)).toBe(true);
  });

  it('ignores gravity while the gravity estimate settles', () => {
    const detector = new ShakeDetector();
    for (let i = 0; i < 40; i += 1) {
      expect(detector.update({ x: 0, y: -9.8, z: 0, includesGravity: true }, i * 16)).toBe(false);
    }
    expect(detector.update({ x: 15, y: -9.8, z: 10, includesGravity: true }, 1000)).toBe(true);
  });
});

describe('TapTracker', () => {
  it('reports a short release without movement as a tap', () => {
    const taps = new TapTracker();
    expect(taps.down(1, 100, 100, 0)).toBe(true);
    taps.move(1, 104, 103);
    expect(taps.up(1, 200)).toEqual({ tracked: true, tap: true });
  });

  it('turns a long or moving press into a drag', () => {
    const taps = new TapTracker();
    taps.down(1, 100, 100, 0);
    taps.move(1, 130, 100);
    expect(taps.up(1, 100)).toEqual({ tracked: true, tap: false });

    taps.down(2, 100, 100, 0);
    expect(taps.up(2, 900)).toEqual({ tracked: true, tap: false });
  });

  it('tracks a single pointer at a time', () => {
    const taps = new TapTracker();
    taps.down(1, 0, 0, 0);
    expect(taps.down(2, 50, 50, 10)).toBe(false);
    expect(taps.move(2, 60, 60)).toBe(false);
    expect(taps.up(2, 20)).toEqual({ tracked: false, tap: false });
    expect(taps.cancel(1)).toBe(true);
    expect(taps.activePointerId).toBeNull();
  });
});
