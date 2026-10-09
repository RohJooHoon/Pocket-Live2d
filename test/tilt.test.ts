import { describe, expect, it } from 'vitest';
import {
  OrientationFilter,
  TiltCalibrator,
  rotateToScreen,
  tiltToParameters,
  wrapDegrees,
} from '../src/input/tilt';

describe('TiltCalibrator', () => {
  it('uses the first reading as the neutral pose', () => {
    const calibrator = new TiltCalibrator();
    expect(calibrator.update({ alpha: 120, beta: 40, gamma: -5 }, 0)).toEqual({ x: 0, y: 0, z: 0 });
    expect(calibrator.update({ alpha: 120, beta: 40, gamma: -5 }, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('normalizes tilt against the baseline and clamps it', () => {
    const calibrator = new TiltCalibrator();
    calibrator.update({ alpha: 0, beta: 40, gamma: 0 }, 0);

    const right = calibrator.update({ alpha: 0, beta: 40, gamma: 15 }, 0);
    expect(right?.x).toBeCloseTo(0.5);

    const towardUser = calibrator.update({ alpha: 0, beta: 25, gamma: 0 }, 0);
    expect(towardUser?.y).toBeCloseTo(0.5);

    const far = calibrator.update({ alpha: 0, beta: 40, gamma: 80 }, 0);
    expect(far?.x).toBe(1);
  });

  it('wraps the twist across the 0/360 boundary', () => {
    const calibrator = new TiltCalibrator();
    calibrator.update({ alpha: 355, beta: 0, gamma: 0 }, 0);
    expect(calibrator.update({ alpha: 5, beta: 0, gamma: 0 }, 0)?.z).toBeCloseTo(0.5);
  });

  it('ignores readings without tilt angles and recalibrates after reset', () => {
    const calibrator = new TiltCalibrator();
    expect(calibrator.update({ alpha: null, beta: null, gamma: null }, 0)).toBeNull();
    calibrator.update({ alpha: 0, beta: 0, gamma: 0 }, 0);
    calibrator.reset();
    expect(calibrator.update({ alpha: 0, beta: 0, gamma: 20 }, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('keeps equivalent Euler readings neutral when the phone is upright', () => {
    const calibrator = new TiltCalibrator();
    calibrator.update({ alpha: 0, beta: 90, gamma: 0 }, 0);
    const reading = calibrator.update({ alpha: 70, beta: 90, gamma: -70 }, 0)!;
    expect(reading.x).toBeCloseTo(0);
    expect(reading.y).toBeCloseTo(0);
    expect(reading.z).toBeCloseTo(0);
  });

  it('does not reverse left/right at the gamma boundary while tilted down', () => {
    const calibrator = new TiltCalibrator();
    calibrator.update({ alpha: 0, beta: 80, gamma: 89 }, 0);
    // This second representation is Rz(0) Rx(80) Ry(91), constrained to gamma ±90.
    const reading = calibrator.update({ alpha: 180, beta: 100, gamma: -89 }, 0)!;
    expect(reading.x).toBeCloseTo(2 / 30);
    expect(reading.y).toBeCloseTo(0);
    expect(reading.z).toBeCloseTo(0);
  });

  it('maps upright left/right turning to horizontal movement rather than compass twist', () => {
    const calibrator = new TiltCalibrator();
    calibrator.update({ alpha: 0, beta: 90, gamma: 0 }, 0);
    const right = calibrator.update({ alpha: 15, beta: 90, gamma: 0 }, 0)!;
    const left = calibrator.update({ alpha: -15, beta: 90, gamma: 0 }, 0)!;
    expect(right.x).toBeCloseTo(0.5);
    expect(left.x).toBeCloseTo(-0.5);
    expect(right.y).toBeCloseTo(0);
    expect(right.z).toBeCloseTo(0);
  });

  it.each([30, 80, 100, 140])('keeps downward left/right directions stable from beta %s', (beta) => {
    const calibrator = new TiltCalibrator();
    calibrator.update({ alpha: 25, beta, gamma: 0 }, 0);
    for (const gamma of [-15, 15]) {
      const reading = calibrator.update({ alpha: 25, beta, gamma }, 0)!;
      expect(reading.x).toBeCloseTo(gamma / 30);
      expect(reading.y).toBeCloseTo(0);
      expect(reading.z).toBeCloseTo(0);
    }
    const down = calibrator.update({ alpha: 25, beta: beta + 15, gamma: 0 }, 0)!;
    expect(down.y).toBeCloseTo(-0.5);
  });

  it('rejects non-finite sensor readings without poisoning calibration', () => {
    const calibrator = new TiltCalibrator();
    expect(calibrator.update({ alpha: 0, beta: NaN, gamma: 0 }, 0)).toBeNull();
    expect(calibrator.update({ alpha: Infinity, beta: 0, gamma: 0 }, 0)).toBeNull();
    expect(calibrator.update({ alpha: 0, beta: 40, gamma: 0 }, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('rotateToScreen', () => {
  it('keeps portrait axes and rotates them for landscape screens', () => {
    expect(rotateToScreen(10, 20, 0)).toEqual([10, 20]);
    expect(rotateToScreen(10, 20, 90)).toEqual([20, -10]);
    expect(rotateToScreen(10, 20, 180)).toEqual([-10, -20]);
    expect(rotateToScreen(10, 20, 270)).toEqual([-20, 10]);
    expect(rotateToScreen(10, 20, -90)).toEqual([-20, 10]);
  });
});

describe('OrientationFilter', () => {
  it('removes small movement inside the dead zone', () => {
    const filter = new OrientationFilter();
    expect(filter.update({ x: 0.02, y: -0.02, z: 0.01 }, 1)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('approaches the target smoothly and independently of frame rate', () => {
    const first = new OrientationFilter().update({ x: 1, y: 0, z: 0 }, 1 / 60);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(0.2);

    const slow = new OrientationFilter();
    const fast = new OrientationFilter();

    for (let i = 0; i < 6; i += 1) slow.update({ x: 1, y: 0, z: 0 }, 1 / 30);
    for (let i = 0; i < 12; i += 1) fast.update({ x: 1, y: 0, z: 0 }, 1 / 60);
    expect(slow.current.x).toBeCloseTo(fast.current.x, 6);
  });

  it('clamps input and resets to center', () => {
    const filter = new OrientationFilter();
    for (let i = 0; i < 200; i += 1) filter.update({ x: 5, y: -5, z: 0 }, 1 / 60);
    expect(filter.current.x).toBeCloseTo(1, 3);
    expect(filter.current.y).toBeCloseTo(-1, 3);
    filter.reset();
    expect(filter.current).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('tiltToParameters', () => {
  it('maps normalized tilt to head, eye and body ranges', () => {
    expect(tiltToParameters({ x: 0.5, y: -1, z: 1 })).toEqual({
      angleX: 15,
      angleY: -30,
      angleZ: 15,
      eyeBallX: 0.35,
      eyeBallY: -0.7,
      bodyAngleX: 5,
    });
  });

  it('clamps input outside the normalized range', () => {
    const offsets = tiltToParameters({ x: 3, y: 0, z: 0 });
    expect(offsets.angleX).toBe(30);
    expect(offsets.bodyAngleX).toBe(10);
  });
});

describe('wrapDegrees', () => {
  it('wraps into -180..180', () => {
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-190)).toBe(170);
    expect(wrapDegrees(540)).toBe(180);
    expect(wrapDegrees(0)).toBe(0);
  });
});
