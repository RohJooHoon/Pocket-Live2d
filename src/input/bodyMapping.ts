import type { BodyParameters } from '../types';

export interface BodyPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export interface BodyObservation {
  landmarks: BodyPoint[];
  worldLandmarks: BodyPoint[];
}

function difference(value: number, baseline: number): number {
  return ((value - baseline + 540) % 360) - 180;
}

/** Camera-facing shoulder line controls yaw/roll; visible hips also enable pitch. */
export class BodyMapper {
  private baseline: { yaw: number | null; pitch: number | null; roll: number | null } =
    { yaw: null, pitch: null, roll: null };

  reset(): void { this.baseline = { yaw: null, pitch: null, roll: null }; }

  map(observation: BodyObservation, aspectRatio: number): BodyParameters | null {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
    const point = (index: number): BodyPoint | null => {
      const image = observation.landmarks[index], world = observation.worldLandmarks[index];
      if (!image || !world || ![image.x, image.y, world.x, world.y, world.z,
        image.visibility ?? 0, image.presence ?? 1].every(Number.isFinite) ||
        image.x < 0 || image.x > 1 || image.y < 0 || image.y > 1 ||
        (image.visibility ?? 0) < 0.6 || (image.presence ?? 1) < 0.6) return null;
      return world;
    };
    const left = point(11), right = point(12);
    if (!left || !right) return null;
    const shoulderX = left.x - right.x, shoulderZ = left.z - right.z;
    if (Math.hypot(shoulderX, shoulderZ) < 0.1) return null;
    const il = observation.landmarks[11], ir = observation.landmarks[12];
    if (Math.hypot(il.x - ir.x, (il.y - ir.y) / aspectRatio) < 0.03) return null;
    const degrees = 180 / Math.PI;
    const yaw = Math.atan2(shoulderZ, shoulderX) * degrees;
    const roll = Math.atan2(-(il.y - ir.y) / aspectRatio, il.x - ir.x) * degrees;
    this.baseline.yaw ??= yaw;
    this.baseline.roll ??= roll;
    const hipLeft = point(23), hipRight = point(24);
    let pitchOffset = 0;
    if (hipLeft && hipRight) {
      const upY = (hipLeft.y + hipRight.y - left.y - right.y) / 2;
      const depth = (left.z + right.z - hipLeft.z - hipRight.z) / 2;
      if (upY > 0.1) {
        const pitch = Math.atan2(depth, upY) * degrees;
        this.baseline.pitch ??= pitch;
        pitchOffset = difference(pitch, this.baseline.pitch);
      }
    }
    const output = (angle: number, gain: number): number => {
      const offset = Math.abs(angle) <= 1.5 ? 0 : Math.sign(angle) * (Math.abs(angle) - 1.5);
      return Math.max(-10, Math.min(10, offset * gain)) + 0;
    };
    return {
      bodyAngleX: output(difference(yaw, this.baseline.yaw), 0.5),
      bodyAngleY: output(pitchOffset, 0.5),
      bodyAngleZ: output(difference(roll, this.baseline.roll), 0.7),
    };
  }
}

/** Smooth the slower body inference separately from eyes and facial expressions. */
export class BodySmoother {
  private current: BodyParameters | null = null;
  reset(): void { this.current = null; }
  update(target: BodyParameters, deltaSeconds: number): BodyParameters {
    this.current ??= { ...target };
    const weight = 1 - Math.exp(-Math.max(0, deltaSeconds) / 0.12);
    for (const key of Object.keys(target) as (keyof BodyParameters)[]) {
      this.current[key] += (target[key] - this.current[key]) * weight;
    }
    return { ...this.current };
  }
}
