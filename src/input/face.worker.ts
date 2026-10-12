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
let bodyLandmarker: import('@mediapipe/tasks-vision').PoseLandmarker | null = null;
let lastBodyTime = -Infinity;

scope.onmessage = (event) => { void handle(event.data); };

async function handle(message: WorkerRequest): Promise<void> {
  try {
    if (message.type === 'init') {
      scope.importScripts(message.runtimeUrl);
      const { FaceLandmarker, PoseLandmarker, FilesetResolver } = scope.Vision;
      const files = await FilesetResolver.forVisionTasks(message.wasmRoot);
      landmarker = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: message.modelUrl, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1,
        outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      });
      try {
        bodyLandmarker = await PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: message.bodyModelUrl, delegate: 'CPU' },
          runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false,
          minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6,
        });
      } catch (error) {
        console.warn('Body tracking initialization:', error);
      }
      scope.postMessage({ type: 'ready', bodyAvailable: bodyLandmarker != null });
      return;
    }
    try {
      if (!landmarker) throw new Error('Face landmarker is not initialized');
      const result = landmarker.detectForVideo(message.bitmap, message.timestamp);
      const matrix = result.facialTransformationMatrixes[0];
      const categories = result.faceBlendshapes[0]?.categories;
      let body: import('./bodyMapping').BodyObservation | null | undefined;
      // Body inference is heavier; run it at most five times a second, reusing
      // the same local camera bitmap without slowing every facial expression.
      if (bodyLandmarker && message.timestamp - lastBodyTime >= 200) {
        lastBodyTime = message.timestamp;
        try {
          const pose = bodyLandmarker.detectForVideo(message.bitmap, message.timestamp);
          body = pose.landmarks[0] && pose.worldLandmarks[0] ? {
            landmarks: pose.landmarks[0], worldLandmarks: pose.worldLandmarks[0],
          } : null;
        } catch (error) {
          bodyLandmarker.close();
          bodyLandmarker = null;
          body = null;
          scope.postMessage({ type: 'body-error', message: error instanceof Error ? error.message : String(error) });
        }
      }
      scope.postMessage({
        type: 'result',
        body,
        landmarks: (result.faceLandmarks[0] ?? []).map(({ x, y, z }) => ({ x, y, z })),
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
