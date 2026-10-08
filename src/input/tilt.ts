import type { OrientationState, ParameterOffsets } from '../types';

export const NEUTRAL_ORIENTATION: OrientationState = Object.freeze({ x: 0, y: 0, z: 0 });

export interface TiltReading {
  /** Rotation around the screen normal in degrees (DeviceOrientationEvent.alpha). */
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
  private baseline: { alpha: number; beta: number; gamma: number } | null = null;

  reset(): void {
    this.baseline = null;
  }

  /** @param screenAngle `screen.orientation.angle` (0, 90, 180 or 270). */
  update(reading: TiltReading, screenAngle: number): OrientationState | null {
    if (reading.beta == null || reading.gamma == null) return null;
    const alpha = reading.alpha ?? 0;

    if (this.baseline == null) {
      this.baseline = { alpha, beta: reading.beta, gamma: reading.gamma };
      return { ...NEUTRAL_ORIENTATION };
    }

    const [screenX, screenY] = rotateToScreen(
      wrapDegrees(reading.gamma - this.baseline.gamma),
      wrapDegrees(reading.beta - this.baseline.beta),
      screenAngle,
    );

    return {
      x: clampUnit(screenX / MAX_TILT_DEGREES),
      y: clampUnit(-screenY / MAX_TILT_DEGREES),
      z: clampUnit(wrapDegrees(alpha - this.baseline.alpha) / MAX_TWIST_DEGREES),
    };
  }
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
