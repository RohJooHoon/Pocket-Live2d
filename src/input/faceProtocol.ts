import type { FaceObservation } from './faceMapping';

export type FaceWorkerRequest =
  | { type: 'init'; runtimeUrl: string; wasmRoot: string; modelUrl: string }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number };

export type FaceWorkerReply =
  | { type: 'ready' }
  | { type: 'result'; observation: FaceObservation | null }
  | { type: 'error'; message: string };
