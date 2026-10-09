import type { FaceParameters } from '../types';
import type { FacePoint } from './faceProtocol';

export interface FaceObservation {
  /** MediaPipe's column-major 4x4 pose matrix. */
  matrix: number[];
  scores: Record<string, number>;
  /** Normalized camera landmarks and width / height, used to check eyelid closure. */
  landmarks?: FacePoint[];
  aspectRatio?: number;
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

// MediaPipe contours, in anatomical left/right order: corners, two upper/lower pairs.
const EYE_POINTS = { left: [362, 263, 385, 380, 387, 373], right: [33, 133, 160, 144, 158, 153] };
const EYELID_RATIOS = { closing: 0.55, closed: 0.35, open: 0.75 };

function eyeAperture(observation: FaceObservation, side: keyof typeof EYE_POINTS): number | null {
  const { landmarks, aspectRatio } = observation;
  if (!landmarks || !aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
  const points = EYE_POINTS[side].map((index) => landmarks[index]);
  if (points.some((point) => !point || ![point.x, point.y, point.z ?? 0].every(Number.isFinite))) return null;
  // MediaPipe z uses the same scale as x. Correct y for the camera aspect ratio;
  // 3D distances also keep a head turn/roll from looking like a closed eye.
  const distance = (a: FacePoint, b: FacePoint): number => Math.hypot(
    a.x - b.x, (a.y - b.y) / aspectRatio, (a.z ?? 0) - (b.z ?? 0),
  );
  const width = distance(points[0], points[1]);
  if (width < 0.0001) return null;
  const aperture = (distance(points[2], points[3]) + distance(points[4], points[5])) / (2 * width);
  return aperture >= 0 && aperture <= 0.6 ? aperture : null;
}

/** Calibrates the starting head pose and each open eye; blendshape scores remain absolute. */
export class FaceMapper {
  private baseline: { yaw: number; pitch: number; roll: number } | null = null;
  private openEyes: { left: number | null; right: number | null } = { left: null, right: null };

  reset(): void {
    this.baseline = null;
    this.openEyes = { left: null, right: null };
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
    const eyes = (['left', 'right'] as const).map((side) => {
      const blink = score(side === 'left' ? 'eyeBlinkLeft' : 'eyeBlinkRight');
      const aperture = eyeAperture(observation, side);
      // Learn each open eye independently; never calibrate from a blink/wink.
      if (aperture != null && aperture >= 0.12 && blink <= EXPRESSION_RANGES.blink.rest) {
        const baseline = this.openEyes[side];
        this.openEyes[side] = baseline == null ? aperture : baseline * 0.95 + aperture * 0.05;
      }
      const baseline = this.openEyes[side];
      const relative = aperture != null && baseline != null ? aperture / baseline : null;
      const closure = relative != null ? clamp((EYELID_RATIOS.closing - relative) /
        (EYELID_RATIOS.closing - EYELID_RATIOS.closed), 0, 1) : 0;
      return { blink, relative, open: 1 - Math.max(expressionStrength(blink, EXPRESSION_RANGES.blink), closure) };
    });
    // A geometrically closed eye plus an open opposite eye is a wink. Ignore
    // small sympathetic blink scores in that opposite eye, but keep real blinks.
    for (const [closed, opposite] of [[eyes[0], eyes[1]], [eyes[1], eyes[0]]]) {
      if (closed.relative != null && closed.relative <= EYELID_RATIOS.closed &&
        opposite.relative != null && opposite.relative >= EYELID_RATIOS.open && opposite.blink <= 0.25) {
        opposite.open = 1;
      }
    }
    return {
      angleX,
      // MediaPipe's pitch direction is opposite to Cubism ParamAngleY.
      angleY: clamp(-angleDifference(pose.pitch, this.baseline.pitch), -30, 30),
      angleZ: clamp(-angleDifference(pose.roll, this.baseline.roll), -30, 30),
      bodyAngleX: angleX / 3,
      eyeBallX,
      eyeBallY: (score('eyeLookUpLeft') + score('eyeLookUpRight') -
        score('eyeLookDownLeft') - score('eyeLookDownRight')) / 2,
      eyeLOpen: eyes[0].open,
      eyeROpen: eyes[1].open,
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
