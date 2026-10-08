// Type queries generate no ESM imports. This must be a classic script both in
// Vite development and production: MediaPipe loads its WASM with importScripts.
type WorkerRequest = import('./faceProtocol').FaceWorkerRequest;
type WorkerReply = import('./faceProtocol').FaceWorkerReply;
const scope = self as unknown as {
  onmessage: (event: MessageEvent<WorkerRequest>) => void;
  postMessage: (message: WorkerReply) => void;
  importScripts: (url: string) => void;
  Vision: typeof import('@mediapipe/tasks-vision');
};
let landmarker: import('@mediapipe/tasks-vision').FaceLandmarker | null = null;

scope.onmessage = (event) => { void handle(event.data); };

async function handle(message: WorkerRequest): Promise<void> {
  try {
    if (message.type === 'init') {
      scope.importScripts(message.runtimeUrl);
      const { FaceLandmarker, FilesetResolver } = scope.Vision;
      const files = await FilesetResolver.forVisionTasks(message.wasmRoot);
      landmarker = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: message.modelUrl, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1,
        outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      });
      scope.postMessage({ type: 'ready' });
      return;
    }
    try {
      if (!landmarker) throw new Error('Face landmarker is not initialized');
      const result = landmarker.detectForVideo(message.bitmap, message.timestamp);
      const matrix = result.facialTransformationMatrixes[0];
      const categories = result.faceBlendshapes[0]?.categories;
      scope.postMessage({
        type: 'result',
        observation: matrix && categories ? {
          matrix: matrix.data,
          scores: Object.fromEntries(categories.map((value) => [value.categoryName, value.score])),
        } : null,
      });
    } finally {
      message.bitmap.close();
    }
  } catch (error) {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}
