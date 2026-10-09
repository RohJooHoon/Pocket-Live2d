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

// Neutral scores contain noise, and deliberate gestures often stop short of 1.
const EXPRESSION_RANGES = {
  blink: { rest: 0.1, full: 0.6 },
  jaw: { rest: 0.05, full: 0.65 },
  round: { rest: 0.1, full: 0.65 },
};

function expressionStrength(value: number, range: { rest: number; full: number }): number {
  return clamp((value - range.rest) / (range.full - range.rest), 0, 1);
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
    const funnel = expressionStrength(score('mouthFunnel'), EXPRESSION_RANGES.round);
    const round = Math.max(funnel, expressionStrength(score('mouthPucker'), EXPRESSION_RANGES.round));
    const smile = (score('mouthSmileLeft') + score('mouthSmileRight') -
      score('mouthFrownLeft') - score('mouthFrownRight')) / 2;
    return {
      angleX,
      // MediaPipe's pitch direction is opposite to Cubism ParamAngleY.
      angleY: clamp(-angleDifference(pose.pitch, this.baseline.pitch), -30, 30),
      angleZ: clamp(-angleDifference(pose.roll, this.baseline.roll), -30, 30),
      bodyAngleX: angleX / 3,
      eyeBallX,
      eyeBallY: (score('eyeLookUpLeft') + score('eyeLookUpRight') -
        score('eyeLookDownLeft') - score('eyeLookDownRight')) / 2,
      eyeLOpen: 1 - expressionStrength(score('eyeBlinkLeft'), EXPRESSION_RANGES.blink),
      eyeROpen: 1 - expressionStrength(score('eyeBlinkRight'), EXPRESSION_RANGES.blink),
      // Funnel ('O') opens the lips even when the jaw barely moves. Pucker alone
      // can keep them closed ('U'); both drive the negative, rounded mouth form.
      mouthOpen: Math.max(expressionStrength(score('jawOpen'), EXPRESSION_RANGES.jaw), funnel * 0.65),
      mouthForm: clamp(smile * (1 - round) - round, -1, 1),
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
    for (const key of Object.keys(target) as (keyof FaceParameters)[]) {
      const eye = key === 'eyeLOpen' || key === 'eyeROpen';
      // A blink must close during its brief detection window, not lag behind
      // the head smoothing. Reopening remains smooth and independent per eye.
      const responseSeconds = eye ? (target[key] < this.current[key] ? 0.02 : 0.04) : 0.06;
      const weight = 1 - Math.exp(-Math.max(0, deltaSeconds) / responseSeconds);
      this.current[key] += (target[key] - this.current[key]) * weight;
      if (eye && target[key] === 0 && this.current[key] < 0.05) this.current[key] = 0;
    }
    return { ...this.current };
  }
}
