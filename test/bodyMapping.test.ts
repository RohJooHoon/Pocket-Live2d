import { describe, expect, it } from 'vitest';
import { BodyMapper, BodySmoother } from '../src/input/bodyMapping';
import { bodyObservation } from './bodyFixture';

describe('upper-body tracking', () => {
  it('calibrates the first posture and follows independent left/right twist, bend and lean', () => {
    const mapper = new BodyMapper();
    expect(mapper.map(bodyObservation(), 4 / 3)).toEqual({ bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0 });
    for (const direction of [-1, 1]) {
      const twist = mapper.map(bodyObservation(20 * direction), 4 / 3)!;
      expect(twist.bodyAngleX * direction).toBeLessThan(0);
      expect(twist.bodyAngleZ).toBeCloseTo(0);
      const bend = mapper.map(bodyObservation(0, 20 * direction), 4 / 3)!;
      expect(bend.bodyAngleY * direction).toBeLessThan(0);
      expect(bend.bodyAngleX).toBeCloseTo(0);
      const lean = mapper.map(bodyObservation(0, 0, 15 * direction), 4 / 3)!;
      expect(lean.bodyAngleZ * direction).toBeGreaterThan(0);
      expect(lean.bodyAngleY).toBeCloseTo(0);
    }
  });

  it('uses the starting seated posture and resets for the next session', () => {
    const mapper = new BodyMapper();
    expect(mapper.map(bodyObservation(10, 8, 4), 4 / 3)).toEqual({ bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0 });
    expect(mapper.map(bodyObservation(10, 8, 4), 4 / 3)?.bodyAngleZ).toBe(0);
    mapper.reset();
    expect(mapper.map(bodyObservation(-15, -10, -8), 4 / 3)).toEqual({ bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0 });
  });

  it.each([4 / 3, 3 / 4, 16 / 9])('preserves leaning direction at camera aspect ratio %s', (ratio) => {
    const mapper = new BodyMapper();
    mapper.map(bodyObservation(0, 0, 0, ratio), ratio);
    expect(mapper.map(bodyObservation(0, 0, 12, ratio), ratio)?.bodyAngleZ).toBeCloseTo(7.35);
  });

  it('keeps shoulder tracking when hips are out of frame and enables pitch on their first appearance', () => {
    const mapper = new BodyMapper();
    const cropped = bodyObservation();
    cropped.landmarks[23].visibility = cropped.landmarks[24].visibility = 0;
    mapper.map(cropped, 4 / 3);
    const leaning = bodyObservation(0, 0, 15);
    leaning.landmarks[23].y = leaning.landmarks[24].y = 1.5;
    expect(mapper.map(leaning, 4 / 3)).toMatchObject({ bodyAngleY: 0, bodyAngleZ: 9.45 });
    expect(mapper.map(bodyObservation(0, 20), 4 / 3)?.bodyAngleY).toBe(0);
    expect(mapper.map(bodyObservation(0, 35), 4 / 3)?.bodyAngleY).toBeLessThan(0);
  });

  it('rejects occluded, missing, non-finite and collapsed shoulders without calibrating', () => {
    for (const mutate of [
      (o: ReturnType<typeof bodyObservation>) => { o.landmarks[11].visibility = 0.2; },
      (o: ReturnType<typeof bodyObservation>) => { o.worldLandmarks[12].z = NaN; },
      (o: ReturnType<typeof bodyObservation>) => { o.landmarks[11].visibility = NaN; },
      (o: ReturnType<typeof bodyObservation>) => { o.worldLandmarks[12] = o.worldLandmarks[11]; },
      (o: ReturnType<typeof bodyObservation>) => { o.landmarks = []; },
    ]) {
      const mapper = new BodyMapper(), invalid = bodyObservation();
      mutate(invalid);
      expect(mapper.map(invalid, 4 / 3)).toBeNull();
      expect(mapper.map(bodyObservation(10, 10, 10), 4 / 3)).toEqual({ bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0 });
    }
  });

  it('ignores small posture jitter and bounds extreme motion to the supported body ranges', () => {
    const mapper = new BodyMapper();
    mapper.map(bodyObservation(), 4 / 3);
    expect(mapper.map(bodyObservation(1, 1, 1), 4 / 3)).toEqual({ bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0 });
    const extreme = mapper.map(bodyObservation(70, 60, 40), 4 / 3)!;
    expect(Object.values(extreme).every((value) => Number.isFinite(value) && Math.abs(value) <= 10)).toBe(true);
  });

  it('smooths body values consistently at different inference rates and clears a lost pose', () => {
    const run = (fps: number) => {
      const smoother = new BodySmoother();
      smoother.update({ bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0 }, 0);
      let result;
      for (let i = 0; i < fps; i++) result = smoother.update({ bodyAngleX: 8, bodyAngleY: -8, bodyAngleZ: 10 }, 1 / fps);
      return result!;
    };
    expect(run(5).bodyAngleZ).toBeCloseTo(run(15).bodyAngleZ);
    const smoother = new BodySmoother();
    smoother.update(run(5), 0);
    smoother.reset();
    expect(smoother.update({ bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0 }, 0).bodyAngleZ).toBe(0);
  });
});
