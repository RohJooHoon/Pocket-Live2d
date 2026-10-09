import type { OrientationState, ParameterOffsets } from '../types';

export const NEUTRAL_ORIENTATION: OrientationState = Object.freeze({ x: 0, y: 0, z: 0 });

export interface TiltReading {
  /** Heading in degrees (DeviceOrientationEvent.alpha), around the world vertical. */
  alpha: number | null;
  /** Front/back tilt in degrees (DeviceOrientationEvent.beta). */
  beta: number | null;
  /** Left/right tilt in degrees (DeviceOrientationEvent.gamma). */
  gamma: number | null;
}

const MAX_TILT_DEGREES = 30;
const MAX_TWIST_DEGREES = 20;

/**
 * Turns device orientation angles into a normalized tilt relative to the pose
 * the device had when tracking started, in the current screen orientation.
 */
export class TiltCalibrator {
  private baseline: Quaternion | null = null;

  reset(): void {
    this.baseline = null;
  }

  /** @param screenAngle `screen.orientation.angle` (0, 90, 180 or 270). */
  update(reading: TiltReading, screenAngle: number): OrientationState | null {
    if (reading.beta == null || reading.gamma == null) return null;
    const alpha = reading.alpha ?? 0;
    if (![alpha, reading.beta, reading.gamma, screenAngle].every(Number.isFinite)) return null;
    const orientation = deviceQuaternion(alpha, reading.beta, reading.gamma);

    if (this.baseline == null) {
      this.baseline = orientation;
      return { ...NEUTRAL_ORIENTATION };
    }

    // Euler angles can jump by 180 degrees near an upright phone. Compute the
    // actual rotation in the starting device frame before mapping screen axes.
    const [beta, gamma, twist] = relativeRotation(this.baseline, orientation);
    const [screenX, screenY] = rotateToScreen(gamma, beta, screenAngle);

    return {
      x: clampUnit(screenX / MAX_TILT_DEGREES),
      y: clampUnit(-screenY / MAX_TILT_DEGREES),
      z: clampUnit(twist / MAX_TWIST_DEGREES),
    };
  }
}

type Quaternion = [number, number, number, number]; // x, y, z, w

function multiply(a: Quaternion, b: Quaternion): Quaternion {
  const [x, y, z, w] = a, [bx, by, bz, bw] = b;
  return [w * bx + x * bw + y * bz - z * by,
    w * by - x * bz + y * bw + z * bx,
    w * bz + x * by - y * bx + z * bw,
    w * bw - x * bx - y * by - z * bz];
}

/** DeviceOrientation uses the intrinsic Z(alpha) X(beta) Y(gamma) order. */
function deviceQuaternion(alpha: number, beta: number, gamma: number): Quaternion {
  const [a, b, g] = [alpha, beta, gamma].map((value) => value * Math.PI / 360);
  return multiply(multiply([0, 0, Math.sin(a), Math.cos(a)],
    [Math.sin(b), 0, 0, Math.cos(b)]), [0, Math.sin(g), 0, Math.cos(g)]);
}

function relativeRotation(baseline: Quaternion, orientation: Quaternion): [number, number, number] {
  const [bx, by, bz, bw] = baseline;
  const rotation = multiply([-bx, -by, -bz, bw], orientation);
  // q and -q represent the same rotation; choose the shortest path.
  const sign = rotation[3] < 0 ? -1 : 1;
  const [x, y, z, w] = rotation.map((value) => value * sign);
  const length = Math.hypot(x, y, z);
  if (length < 1e-8) return [0, 0, 0];
  const scale = 2 * Math.atan2(length, w) * 180 / Math.PI / length;
  return [x * scale, y * scale, z * scale];
}

/** Maps portrait device axes (gamma, beta) onto the axes of the rotated screen. */
export function rotateToScreen(gamma: number, beta: number, screenAngle: number): [number, number] {
  switch (((Math.round(screenAngle / 90) % 4) + 4) % 4) {
    case 1:
      return [beta, -gamma];
    case 2:
      return [-gamma, -beta];
    case 3:
      return [-beta, gamma];
    default:
      return [gamma, beta];
  }
}

export interface OrientationFilterConfig {
  /** Inputs closer to center than this are treated as zero. */
  deadZone: number;
  /** How quickly the output follows the input, per second. */
  responsiveness: number;
}

export const DEFAULT_FILTER_CONFIG: OrientationFilterConfig = Object.freeze({
  deadZone: 0.03,
  responsiveness: 6,
});

/** Dead zone plus frame-rate independent exponential smoothing. */
export class OrientationFilter {
  private value: OrientationState = { ...NEUTRAL_ORIENTATION };

  constructor(private readonly config: OrientationFilterConfig = DEFAULT_FILTER_CONFIG) {}

  get current(): OrientationState {
    return { ...this.value };
  }

  update(target: OrientationState, deltaSeconds: number): OrientationState {
    const factor = 1 - Math.exp(-Math.max(0, deltaSeconds) * this.config.responsiveness);
    const step = (current: number, next: number) =>
      current + (this.applyDeadZone(clampUnit(next)) - current) * factor;
    this.value = {
      x: step(this.value.x, target.x),
      y: step(this.value.y, target.y),
      z: step(this.value.z, target.z),
    };
    return this.current;
  }

  reset(): void {
    this.value = { ...NEUTRAL_ORIENTATION };
  }

  private applyDeadZone(value: number): number {
    const { deadZone } = this.config;
    if (Math.abs(value) <= deadZone) return 0;
    return (Math.sign(value) * (Math.abs(value) - deadZone)) / (1 - deadZone);
  }
}

export interface TiltMappingConfig {
  maxHeadX: number;
  maxHeadY: number;
  maxHeadZ: number;
  maxBodyX: number;
  eyeGain: number;
}

export const DEFAULT_TILT_MAPPING: TiltMappingConfig = Object.freeze({
  maxHeadX: 30,
  maxHeadY: 30,
  maxHeadZ: 15,
  maxBodyX: 10,
  eyeGain: 0.7,
});

/** Converts a filtered tilt into head, eye and body parameter offsets. */
export function tiltToParameters(
  state: OrientationState,
  config: TiltMappingConfig = DEFAULT_TILT_MAPPING,
): ParameterOffsets {
  const x = clampUnit(state.x);
  const y = clampUnit(state.y);
  const z = clampUnit(state.z);
  return {
    angleX: x * config.maxHeadX,
    angleY: y * config.maxHeadY,
    angleZ: z * config.maxHeadZ,
    eyeBallX: clampUnit(x * config.eyeGain),
    eyeBallY: clampUnit(y * config.eyeGain),
    bodyAngleX: x * config.maxBodyX,
  };
}

export function wrapDegrees(value: number): number {
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

function clampUnit(value: number): number {
  // `+ 0` turns -0 into 0 so neutral readings compare equal.
  return Math.min(1, Math.max(-1, value)) + 0;
}
