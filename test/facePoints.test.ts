import { describe, expect, it, vi } from 'vitest';
import { drawFacePoints, projectFacePoints } from '../src/input/facePoints';

describe('landmark-only preview', () => {
  it('centres and mirrors points while preserving the camera aspect ratio', () => {
    const result = projectFacePoints([
      { x: 0.5, y: 0.5 }, { x: 0.4, y: 0.5 }, { x: 0.5, y: 0.6 },
    ], 640, 480, 240, 320);
    expect(result[0]).toEqual({ x: 120, y: 160 });
    expect(result[1].x).toBeCloseTo(120 + 640 * 0.1 * 320 / 480);
    expect(result[2].y).toBeCloseTo(192);
  });

  it('ignores nonfinite points and unavailable video dimensions', () => {
    expect(projectFacePoints([{ x: NaN, y: 0.5 }, { x: 0.5, y: Infinity }], 640, 480, 240, 320)).toEqual([]);
    expect(projectFacePoints([{ x: 0.5, y: 0.5 }], 0, 0, 240, 320)).toEqual([]);
  });

  it('draws only dots and clears the previous face when landmarks disappear', () => {
    const context = { clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillStyle: '', drawImage: vi.fn() };
    const canvas = { width: 240, height: 320, getContext: () => context } as unknown as HTMLCanvasElement;
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
    drawFacePoints(canvas, [{ x: 0.5, y: 0.5 }], video);
    expect(context.arc).toHaveBeenCalledWith(120, 160, 1.6, 0, Math.PI * 2);
    expect(context.drawImage).not.toHaveBeenCalled();
    drawFacePoints(canvas, [], video);
    expect(context.clearRect).toHaveBeenCalledTimes(2);
    expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, 240, 320);
    expect(context.arc).toHaveBeenCalledOnce();
  });
});
