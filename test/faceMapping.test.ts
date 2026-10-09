import { describe, expect, it } from 'vitest';
import { FaceMapper, FaceSmoother, type FaceObservation } from '../src/input/faceMapping';
import type { FacePoint } from '../src/input/faceProtocol';

function eyeLandmarks(left = 0.3, right = 0.3, aspectRatio = 4 / 3, yaw = 0, roll = 0): FacePoint[] {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [indices, center, aperture] of [
    [[362, 263, 385, 380, 387, 373], 0.6, left],
    [[33, 133, 160, 144, 158, 153], 0.4, right],
  ] as const) {
    const width = 0.1, height = aperture * width;
    const offsets = [[-width / 2, 0], [width / 2, 0], [-width / 4, -height / 2],
      [-width / 4, height / 2], [width / 4, -height / 2], [width / 4, height / 2]];
    indices.forEach((index, i) => {
      const [x, y] = offsets[i];
      const turnedX = x * Math.cos(yaw), z = -x * Math.sin(yaw);
      points[index] = {
        x: center + turnedX * Math.cos(roll) - y * Math.sin(roll),
        y: 0.4 + (turnedX * Math.sin(roll) + y * Math.cos(roll)) * aspectRatio, z,
      };
    });
  }
  return points;
}

function matrix(yaw = 0, pitch = 0, roll = 0): number[] {
  const [y, p, r] = [yaw, pitch, roll].map((value) => value * Math.PI / 180);
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p), cr = Math.cos(r), sr = Math.sin(r);
  // Column-major Rz * Ry * Rx, with translation that must not affect pose.
  return [cr * cy, sr * cy, -sy, 0,
    cr * sy * sp - sr * cp, sr * sy * sp + cr * cp, cy * sp, 0,
    cr * sy * cp + sr * sp, sr * sy * cp - cr * sp, cy * cp, 0, 2, 3, -50, 1];
}

describe('camera parameter mapping', () => {
  it('uses the first head pose as neutral, then maps independent head axes', () => {
    const mapper = new FaceMapper();
    expect(mapper.map({ matrix: matrix(5, 8, 4), scores: {} })?.angleX).toBeCloseTo(0);
    const pose = mapper.map({ matrix: matrix(20, 18, -6), scores: {} })!;
    expect(pose.angleX).toBeCloseTo(-15);
    expect(pose.angleY).toBeCloseTo(-10);
    expect(pose.angleZ).toBeCloseTo(10);
    expect(pose.bodyAngleX).toBeCloseTo(-5);
  });

  it('limits extreme movement and handles the 180 degree wrap', () => {
    const mapper = new FaceMapper();
    mapper.map({ matrix: matrix(0, 0, 179), scores: {} });
    const pose = mapper.map({ matrix: matrix(80, 80, -179), scores: {} })!;
    expect(pose.angleX).toBe(-30);
    expect(pose.angleY).toBe(-30);
    expect(pose.angleZ).toBeCloseTo(-2);
    mapper.reset();
    expect(mapper.map({ matrix: matrix(50), scores: {} })?.angleX).toBeCloseTo(0);
  });

  it('maps independent blinking, jaw opening, smiling and brows without NaN', () => {
    const pose = new FaceMapper().map({ matrix: matrix(), scores: {
      eyeBlinkLeft: 1, eyeBlinkRight: 0.2, jawOpen: 0.5,
      mouthSmileLeft: 0.8, mouthSmileRight: 0.6,
      browInnerUp: 0.4, browDownLeft: 0.7, browOuterUpRight: 0.6,
      eyeLookUpLeft: NaN, eyeLookOutLeft: 2,
    } })!;
    expect(pose.eyeLOpen).toBe(0);
    expect(pose.eyeROpen).toBe(0.8);
    expect(pose.mouthOpen).toBeCloseTo(0.75);
    expect(pose.mouthForm).toBeCloseTo(0.7);
    expect(pose.browLY).toBeCloseTo(-0.3);
    expect(pose.browRY).toBe(1);
    expect(Object.values(pose).every(Number.isFinite)).toBe(true);
  });

  it('rejects malformed pose matrices and defaults missing expressions to neutral', () => {
    const mapper = new FaceMapper();
    expect(mapper.map({ matrix: [], scores: {} })).toBeNull();
    expect(mapper.map({ matrix: Array(16).fill(NaN), scores: {} })).toBeNull();
    const face = mapper.map({ matrix: matrix(), scores: {} })!;
    expect(face.eyeLOpen).toBe(1);
    expect(face.eyeROpen).toBe(1);
    expect(face.mouthOpen).toBe(0);
  });

  it('inverts pitch in both directions relative to the calibrated starting pose', () => {
    const mapper = new FaceMapper();
    mapper.map({ matrix: matrix(0, 8), scores: {} });
    expect(mapper.map({ matrix: matrix(0, 28), scores: {} })?.angleY).toBeCloseTo(-20);
    expect(mapper.map({ matrix: matrix(0, -12), scores: {} })?.angleY).toBeCloseTo(20);
  });

  it('opens a rounded O mouth from funnel even with little jaw movement', () => {
    const pose = new FaceMapper().map({ matrix: matrix(), scores: { mouthFunnel: 0.65, jawOpen: 0.08 } })!;
    expect(pose.mouthForm).toBe(-1);
    expect(pose.mouthOpen).toBeCloseTo(0.65);
  });

  it('maps a closed lip pucker separately and lets rounding override incidental smile scores', () => {
    const pose = new FaceMapper().map({ matrix: matrix(), scores: {
      mouthPucker: 0.7, jawOpen: 0.03, mouthSmileLeft: 0.4, mouthSmileRight: 0.4,
    } })!;
    expect(pose.mouthForm).toBe(-1);
    expect(pose.mouthOpen).toBe(0);
  });

  it('ignores neutral mouth noise and reaches full jaw opening before scores reach one', () => {
    const mapper = new FaceMapper();
    const neutral = mapper.map({ matrix: matrix(), scores: { jawOpen: 0.04, mouthPucker: 0.08, mouthFunnel: 0.09 } })!;
    expect(neutral.mouthOpen).toBe(0);
    expect(neutral.mouthForm).toBe(0);
    expect(mapper.map({ matrix: matrix(), scores: { jawOpen: 0.65 } })?.mouthOpen).toBe(1);
  });

  it('fully closes each eye at realistic blink scores and preserves the other open eye', () => {
    const mapper = new FaceMapper();
    const left = mapper.map({ matrix: matrix(), scores: { eyeBlinkLeft: 0.65, eyeBlinkRight: 0.09 } })!;
    expect(left.eyeLOpen).toBe(0);
    expect(left.eyeROpen).toBe(1);
    const right = mapper.map({ matrix: matrix(), scores: { eyeBlinkLeft: 0.09, eyeBlinkRight: 0.7 } })!;
    expect(right.eyeLOpen).toBe(1);
    expect(right.eyeROpen).toBe(0);
    expect(mapper.map({ matrix: matrix(), scores: { eyeBlinkLeft: 0.4 } })?.eyeLOpen).toBeCloseTo(0.4);
  });

  it('keeps out-of-range and non-finite new expression scores bounded', () => {
    const face = new FaceMapper().map({ matrix: matrix(), scores: {
      mouthFunnel: Infinity, mouthPucker: 2, jawOpen: -1, eyeBlinkLeft: 2, eyeBlinkRight: NaN,
    } })!;
    expect(face.mouthForm).toBe(-1);
    expect(face.mouthOpen).toBe(0);
    expect(face.eyeLOpen).toBe(0);
    expect(face.eyeROpen).toBe(1);
    expect(Object.values(face).every(Number.isFinite)).toBe(true);
  });

  it.each(['left', 'right'] as const)('fully closes a low-score %s wink without closing the opposite eye', (side) => {
    const mapper = new FaceMapper();
    mapper.map({ matrix: matrix(), scores: {}, landmarks: eyeLandmarks(), aspectRatio: 4 / 3 });
    const left = side === 'left';
    const pose = mapper.map({ matrix: matrix(), scores: {
      eyeBlinkLeft: left ? 0.4 : 0.2, eyeBlinkRight: left ? 0.2 : 0.4,
    }, landmarks: eyeLandmarks(left ? 0.04 : 0.3, left ? 0.3 : 0.04), aspectRatio: 4 / 3 })!;
    expect(pose.eyeLOpen).toBe(left ? 0 : 1);
    expect(pose.eyeROpen).toBe(left ? 1 : 0);
    const smoother = new FaceSmoother();
    smoother.update(mapper.map({ matrix: matrix(), scores: {} })!, 0);
    const smoothed = smoother.update(pose, 1 / 15);
    expect(smoothed.eyeLOpen).toBe(pose.eyeLOpen);
    expect(smoothed.eyeROpen).toBe(pose.eyeROpen);
  });

  it('keeps bilateral closure and intentional opposite-eye squint independent', () => {
    const mapper = new FaceMapper();
    mapper.map({ matrix: matrix(), scores: {}, landmarks: eyeLandmarks(), aspectRatio: 4 / 3 });
    const closed = mapper.map({ matrix: matrix(), scores: { eyeBlinkLeft: 0.4, eyeBlinkRight: 0.4 },
      landmarks: eyeLandmarks(0.04, 0.04), aspectRatio: 4 / 3 })!;
    expect([closed.eyeLOpen, closed.eyeROpen]).toEqual([0, 0]);
    const squint = mapper.map({ matrix: matrix(), scores: { eyeBlinkLeft: 0.4, eyeBlinkRight: 0.4 },
      landmarks: eyeLandmarks(0.04, 0.15), aspectRatio: 4 / 3 })!;
    expect(squint.eyeLOpen).toBe(0);
    expect(squint.eyeROpen).toBeCloseTo(0.4);
  });

  it.each([4 / 3, 3 / 4, 16 / 9])('does not infer a wink from head rotation at camera aspect ratio %s', (aspectRatio) => {
    const mapper = new FaceMapper();
    mapper.map({ matrix: matrix(), scores: {}, landmarks: eyeLandmarks(0.3, 0.2, aspectRatio), aspectRatio });
    const turned = mapper.map({ matrix: matrix(30, 0, 25), scores: {},
      landmarks: eyeLandmarks(0.3, 0.2, aspectRatio, Math.PI / 6, Math.PI / 7), aspectRatio })!;
    expect([turned.eyeLOpen, turned.eyeROpen]).toEqual([1, 1]);
  });

  it('requires an open-eye reference and clears it when tracking restarts', () => {
    const mapper = new FaceMapper();
    const wink: FaceObservation = { matrix: matrix(), scores: { eyeBlinkLeft: 0.4 },
      landmarks: eyeLandmarks(0.04, 0.3), aspectRatio: 4 / 3 };
    expect(mapper.map(wink)?.eyeLOpen).toBeCloseTo(0.4);
    mapper.map({ matrix: matrix(), scores: {}, landmarks: eyeLandmarks(), aspectRatio: 4 / 3 });
    expect(mapper.map(wink)?.eyeLOpen).toBe(0);
    mapper.reset();
    expect(mapper.map(wink)?.eyeLOpen).toBeCloseTo(0.4);
  });

  it('falls back to blink scores for missing, malformed or collapsed landmarks', () => {
    const mapper = new FaceMapper();
    mapper.map({ matrix: matrix(), scores: {}, landmarks: eyeLandmarks(), aspectRatio: 4 / 3 });
    const invalid = eyeLandmarks();
    invalid[385].z = NaN;
    for (const extras of [{}, { landmarks: [] }, { landmarks: invalid, aspectRatio: 4 / 3 },
      { landmarks: eyeLandmarks(), aspectRatio: NaN },
      { landmarks: Array(478).fill({ x: 0.5, y: 0.5, z: 0 }), aspectRatio: 4 / 3 }]) {
      expect(mapper.map({ matrix: matrix(), scores: { eyeBlinkLeft: 0.4 }, ...extras })?.eyeLOpen).toBeCloseTo(0.4);
    }
  });

  it.each([15, 30, 60])('finishes a brief wink within 70 ms at %s fps while smoothing head movement', (fps) => {
    const neutral = new FaceMapper().map({ matrix: matrix(), scores: {} })!;
    const smoother = new FaceSmoother();
    smoother.update(neutral, 0);
    const target = { ...neutral, eyeLOpen: 0, angleX: 30 };
    let result = neutral;
    for (let i = 0; i < Math.ceil(fps / 15); i++) result = smoother.update(target, 1 / fps);
    expect(result.eyeLOpen).toBe(0);
    expect(result.eyeROpen).toBe(1);
    expect(result.angleX).toBeGreaterThan(0);
    expect(result.angleX).toBeLessThan(30);
    const reopened = smoother.update(neutral, 1 / fps);
    expect(reopened.eyeLOpen).toBeGreaterThan(0);
    expect(reopened.eyeLOpen).toBeLessThan(1);
  });

  it('smooths equally over the same elapsed time at different inference rates', () => {
    const neutral = new FaceMapper().map({ matrix: matrix(), scores: {} })!;
    const target = { ...neutral, angleX: 30, mouthOpen: 1 };
    const run = (fps: number) => {
      const smoother = new FaceSmoother();
      smoother.update(neutral, 0);
      let result = neutral;
      for (let i = 0; i < fps; i++) result = smoother.update(target, 1 / fps);
      return result;
    };
    expect(run(15).angleX).toBeCloseTo(run(30).angleX, 8);
    expect(run(15).mouthOpen).toBeCloseTo(run(30).mouthOpen, 8);
  });
});
