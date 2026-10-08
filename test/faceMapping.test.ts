import { describe, expect, it } from 'vitest';
import { FaceMapper, FaceSmoother } from '../src/input/faceMapping';

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
    expect(pose.angleY).toBeCloseTo(10);
    expect(pose.angleZ).toBeCloseTo(10);
    expect(pose.bodyAngleX).toBeCloseTo(-5);
  });

  it('limits extreme movement and handles the 180 degree wrap', () => {
    const mapper = new FaceMapper();
    mapper.map({ matrix: matrix(0, 0, 179), scores: {} });
    const pose = mapper.map({ matrix: matrix(80, 80, -179), scores: {} })!;
    expect(pose.angleX).toBe(-30);
    expect(pose.angleY).toBe(30);
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
    expect(pose.mouthOpen).toBe(0.75);
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
