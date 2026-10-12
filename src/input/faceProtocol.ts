import type { FaceObservation } from './faceMapping';
import type { BodyObservation } from './bodyMapping';

export interface FacePoint { x: number; y: number; z?: number }

export type FaceWorkerRequest =
  | { type: 'init'; runtimeUrl: string; wasmRoot: string; modelUrl: string; bodyModelUrl: string }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number };

export type FaceWorkerReply =
  | { type: 'ready'; bodyAvailable?: boolean }
  | { type: 'result'; observation: FaceObservation | null; landmarks: FacePoint[]; body?: BodyObservation | null }
  | { type: 'body-error'; message: string }
  | { type: 'error'; message: string };
