import type { FacePoint } from './faceProtocol';

/** Match the camera's aspect ratio without stretching, with a mirrored view. */
export function projectFacePoints(
  points: readonly FacePoint[], sourceWidth: number, sourceHeight: number,
  width: number, height: number,
): FacePoint[] {
  if (![sourceWidth, sourceHeight, width, height].every((value) => Number.isFinite(value) && value > 0)) return [];
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (sourceWidth * scale - width) / 2;
  const offsetY = (sourceHeight * scale - height) / 2;
  return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).map((point) => ({
    x: width - (point.x * sourceWidth * scale - offsetX),
    y: point.y * sourceHeight * scale - offsetY,
  }));
}

/** Draw only landmark dots; camera pixels are never drawn into this canvas. */
export function drawFacePoints(canvas: HTMLCanvasElement, points: readonly FacePoint[], video: HTMLVideoElement): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#737373';
  context.beginPath();
  for (const point of projectFacePoints(points, video.videoWidth, video.videoHeight, canvas.width, canvas.height)) {
    context.moveTo(point.x + 1.6, point.y);
    context.arc(point.x, point.y, 1.6, 0, Math.PI * 2);
  }
  context.fill();
}
