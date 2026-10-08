export interface AccelerationSample {
  x: number;
  y: number;
  z: number;
  /** True when the sample is accelerationIncludingGravity (m/s²). */
  includesGravity: boolean;
}

export interface ShakeDetectorConfig {
  /** Linear acceleration magnitude that counts as a shake, in m/s². */
  threshold: number;
  /** Minimum time between two shakes, in milliseconds. */
  cooldownMs: number;
  /** Samples used to settle the gravity estimate before shakes are reported. */
  warmupSamples: number;
}

export const DEFAULT_SHAKE_CONFIG: ShakeDetectorConfig = Object.freeze({
  threshold: 12,
  cooldownMs: 900,
  warmupSamples: 10,
});

/**
 * Detects shakes from DeviceMotionEvent samples. Browsers that only report
 * acceleration including gravity are handled with a low-pass gravity estimate.
 */
export class ShakeDetector {
  private gravity = { x: 0, y: 0, z: 0 };
  private gravitySamples = 0;
  private lastShakeAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly config: ShakeDetectorConfig = DEFAULT_SHAKE_CONFIG) {}

  /** Returns true when this sample completes a shake. */
  update(sample: AccelerationSample, timeMs: number): boolean {
    let { x, y, z } = sample;
    if (sample.includesGravity) {
      this.gravity = {
        x: this.gravity.x * 0.8 + x * 0.2,
        y: this.gravity.y * 0.8 + y * 0.2,
        z: this.gravity.z * 0.8 + z * 0.2,
      };
      this.gravitySamples += 1;
      if (this.gravitySamples <= this.config.warmupSamples) return false;
      x -= this.gravity.x;
      y -= this.gravity.y;
      z -= this.gravity.z;
    }

    if (Math.hypot(x, y, z) <= this.config.threshold) return false;
    if (timeMs - this.lastShakeAt < this.config.cooldownMs) return false;
    this.lastShakeAt = timeMs;
    return true;
  }

  reset(): void {
    this.gravity = { x: 0, y: 0, z: 0 };
    this.gravitySamples = 0;
    this.lastShakeAt = Number.NEGATIVE_INFINITY;
  }
}
