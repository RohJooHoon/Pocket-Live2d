import type { FaceParameters } from '../types';

export interface FaceObservation {
  /** MediaPipe's column-major 4x4 pose matrix. */
  matrix: number[];
  scores: Record<string, number>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function angleDifference(value: number, baseline: number): number {
  return ((value - baseline + 540) % 360) - 180;
}

/** Calibrates the first visible head pose; expressions remain absolute. */
export class FaceMapper {
  private baseline: { yaw: number; pitch: number; roll: number } | null = null;

  reset(): void {
    this.baseline = null;
  }

  map(observation: FaceObservation): FaceParameters | null {
    const { matrix: m, scores } = observation;
    if (m.length !== 16 || !m.every(Number.isFinite)) return null;
    const degrees = 180 / Math.PI;
    const pose = {
      yaw: Math.atan2(-m[2], Math.hypot(m[0], m[1])) * degrees,
      pitch: Math.atan2(m[6], m[10]) * degrees,
      roll: Math.atan2(m[1], m[0]) * degrees,
    };
    this.baseline ??= pose;
    const score = (name: string): number => {
      const value = scores[name] ?? 0;
      return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
    };
    const angleX = clamp(-angleDifference(pose.yaw, this.baseline.yaw), -30, 30);
    const eyeBallX = clamp((score('eyeLookOutLeft') - score('eyeLookInLeft') +
      score('eyeLookInRight') - score('eyeLookOutRight')) / 2, -1, 1);
    return {
      angleX,
      angleY: clamp(angleDifference(pose.pitch, this.baseline.pitch), -30, 30),
      angleZ: clamp(-angleDifference(pose.roll, this.baseline.roll), -30, 30),
      bodyAngleX: angleX / 3,
      eyeBallX,
      eyeBallY: (score('eyeLookUpLeft') + score('eyeLookUpRight') -
        score('eyeLookDownLeft') - score('eyeLookDownRight')) / 2,
      eyeLOpen: 1 - score('eyeBlinkLeft'),
      eyeROpen: 1 - score('eyeBlinkRight'),
      mouthOpen: clamp(score('jawOpen') * 1.5, 0, 1),
      mouthForm: clamp((score('mouthSmileLeft') + score('mouthSmileRight') -
        score('mouthFrownLeft') - score('mouthFrownRight')) / 2, -1, 1),
      browLY: clamp(score('browInnerUp') + score('browOuterUpLeft') - score('browDownLeft'), -1, 1),
      browRY: clamp(score('browInnerUp') + score('browOuterUpRight') - score('browDownRight'), -1, 1),
    };
  }
}

/** Time-based smoothing keeps tracking stable at varying inference rates. */
export class FaceSmoother {
  private current: FaceParameters | null = null;

  reset(): void { this.current = null; }

  update(target: FaceParameters, deltaSeconds: number): FaceParameters {
    if (!this.current) this.current = { ...target };
    const weight = 1 - Math.exp(-Math.max(0, deltaSeconds) / 0.06);
    for (const key of Object.keys(target) as (keyof FaceParameters)[]) {
      this.current[key] += (target[key] - this.current[key]) * weight;
    }
    return { ...this.current };
  }
}
