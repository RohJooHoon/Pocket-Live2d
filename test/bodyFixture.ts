import type { BodyObservation, BodyPoint } from '../src/input/bodyMapping';

/** Independent synthetic shoulder/hip rotations with image coordinates in the camera's aspect ratio. */
export function bodyObservation(yaw = 0, pitch = 0, roll = 0, aspectRatio = 4 / 3): BodyObservation {
  const [y, p, r] = [yaw, pitch, roll].map((value) => value * Math.PI / 180);
  const landmarks: BodyPoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
  const worldLandmarks = landmarks.map((point) => ({ ...point }));
  const rotate = (x: number, ty: number, z: number) => {
    const py = ty * Math.cos(p) - z * Math.sin(p), pz = ty * Math.sin(p) + z * Math.cos(p);
    const yx = x * Math.cos(y) + pz * Math.sin(y), yz = -x * Math.sin(y) + pz * Math.cos(y);
    return { x: yx * Math.cos(r) + py * Math.sin(r),
      y: -yx * Math.sin(r) + py * Math.cos(r), z: yz, visibility: 1, presence: 1 };
  };
  for (const [index, x, ty] of [[11, 0.2, -0.45], [12, -0.2, -0.45], [23, 0.15, 0], [24, -0.15, 0]]) {
    const point = rotate(x, ty, 0);
    worldLandmarks[index] = point;
    landmarks[index] = { ...point, x: 0.5 + point.x * 0.5, y: 0.65 + point.y * 0.5 * aspectRatio };
  }
  return { landmarks, worldLandmarks };
}
