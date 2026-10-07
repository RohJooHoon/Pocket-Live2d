import type { OrientationState } from '../types';
import { ShakeDetector } from './shake';
import { TiltCalibrator } from './tilt';

export type MotionPermission = 'granted' | 'denied' | 'insecure' | 'unsupported';

interface PermissionRequestable {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Asks for motion and orientation access. iOS Safari requires this to be
 * called from a tap handler; other browsers grant it on secure pages.
 */
export async function requestMotionPermission(): Promise<MotionPermission> {
  if (!('DeviceOrientationEvent' in window)) return 'unsupported';
  if (!window.isSecureContext) return 'insecure';

  // On iOS one prompt covers both orientation and motion events.
  const orientationEvent = window.DeviceOrientationEvent as unknown as PermissionRequestable;
  if (typeof orientationEvent.requestPermission !== 'function') return 'granted';
  try {
    return (await orientationEvent.requestPermission()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export interface MotionSensorHandlers {
  onTilt(state: OrientationState): void;
  onShake(): void;
}

/** Subscribes to device orientation and motion events while started. */
export class MotionSensors {
  private readonly calibrator = new TiltCalibrator();
  private readonly shake = new ShakeDetector();
  private running = false;

  constructor(private readonly handlers: MotionSensorHandlers) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.calibrator.reset();
    this.shake.reset();
    window.addEventListener('deviceorientation', this.handleOrientation);
    window.addEventListener('devicemotion', this.handleMotion);
    screen.orientation?.addEventListener('change', this.recalibrate);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener('deviceorientation', this.handleOrientation);
    window.removeEventListener('devicemotion', this.handleMotion);
    screen.orientation?.removeEventListener('change', this.recalibrate);
  }

  /** Makes the current pose the new neutral pose. */
  readonly recalibrate = (): void => {
    this.calibrator.reset();
  };

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    const state = this.calibrator.update(
      { alpha: event.alpha, beta: event.beta, gamma: event.gamma },
      screenAngle(),
    );
    if (state) this.handlers.onTilt(state);
  };

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const linear = event.acceleration;
    const withGravity = event.accelerationIncludingGravity;
    const sample =
      linear && linear.x != null && linear.y != null && linear.z != null
        ? { x: linear.x, y: linear.y, z: linear.z, includesGravity: false }
        : withGravity && withGravity.x != null && withGravity.y != null && withGravity.z != null
          ? { x: withGravity.x, y: withGravity.y, z: withGravity.z, includesGravity: true }
          : null;
    if (sample && this.shake.update(sample, event.timeStamp)) this.handlers.onShake();
  };
}

function screenAngle(): number {
  if (screen.orientation) return screen.orientation.angle;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}
