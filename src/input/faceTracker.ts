import type { FaceParameters } from '../types';
import { FaceMapper, FaceSmoother } from './faceMapping';
import type { FacePoint, FaceWorkerReply, FaceWorkerRequest } from './faceProtocol';

export type CameraStatus =
  | { state: 'starting' }
  | { state: 'running'; faceFound: boolean }
  | { state: 'stopped' }
  | { state: 'error'; message: string };

export interface FaceTrackerOptions {
  video: HTMLVideoElement;
  onParameters: (parameters: FaceParameters | null) => void;
  onLandmarks: (points: FacePoint[]) => void;
  onStatus: (status: CameraStatus) => void;
}

/** Injected in lifecycle tests so late permission/model promises can be exercised. */
export interface CameraPlatform {
  available(): boolean;
  secure(): boolean;
  getStream(): Promise<MediaStream>;
  createWorker(): Worker;
  capture(video: HTMLVideoElement): Promise<ImageBitmap>;
  assetUrl(path: string): string;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
}

interface Session {
  stream: MediaStream | null;
  worker: Worker | null;
  finishReady?: (ready: boolean) => void;
  initTimer?: ReturnType<typeof setTimeout>;
  replyTimer?: ReturnType<typeof setTimeout>;
  frame: number;
  busy: boolean;
  active: boolean;
  lastFrame: number;
  lastVideoTime: number;
  lastFaceTime: number;
  lastParameterTime: number;
}

const FRAME_INTERVAL_MS = 1000 / 15;

function browserPlatform(): CameraPlatform {
  return {
    secure: () => window.isSecureContext,
    available: () => Boolean(typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof Worker !== 'undefined' && typeof createImageBitmap === 'function' &&
      typeof OffscreenCanvas !== 'undefined'),
    getStream: () => navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 30 } },
    }),
    createWorker: () => new Worker(new URL('./face.worker.ts', import.meta.url)),
    capture: (video) => createImageBitmap(video),
    assetUrl: (path) => new URL(path, document.baseURI).href,
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
  };
}

function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return '카메라 접근이 거부됐어요. 브라우저 설정에서 허용해 주세요.';
  if (name === 'NotFoundError') return '사용할 수 있는 카메라가 없어요.';
  if (name === 'NotReadableError') return '카메라를 열 수 없어요. 다른 앱에서 사용 중인지 확인해 주세요.';
  return '얼굴 따라하기를 준비하지 못했어요. 연결 상태를 확인하고 다시 켜 주세요.';
}

/** Owns one camera session. Stopping invalidates all pending asynchronous work. */
export class FaceTracker {
  private session: Session | null = null;
  private readonly mapper = new FaceMapper();
  private readonly smoother = new FaceSmoother();

  constructor(private readonly options: FaceTrackerOptions, private readonly platform = browserPlatform()) {}

  get isEnabled(): boolean { return this.session != null; }

  async start(): Promise<void> {
    this.stop();
    if (!this.platform.secure()) {
      this.options.onStatus({ state: 'error', message: '카메라는 https 주소에서만 쓸 수 있어요.' });
      return;
    }
    if (!this.platform.available()) {
      this.options.onStatus({ state: 'error', message: '이 브라우저에서는 얼굴 따라하기를 지원하지 않아요.' });
      return;
    }
    const session: Session = {
      stream: null, worker: null, frame: 0, busy: false, active: false,
      lastFrame: -Infinity, lastVideoTime: -1, lastFaceTime: 0, lastParameterTime: 0,
    };
    this.session = session;
    this.options.onStatus({ state: 'starting' });
    try {
      const stream = await this.platform.getStream();
      if (this.session !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      session.stream = stream;
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => {
        this.fail(session, '카메라 연결이 끊겼어요. 다시 켜 주세요.');
      }, { once: true }));
      this.options.video.srcObject = stream;
      await this.options.video.play();
      if (this.session !== session) return;
      const worker = this.platform.createWorker();
      session.worker = worker;
      const ready = new Promise<boolean>((resolve) => { session.finishReady = resolve; });
      session.initTimer = setTimeout(() => this.fail(session, '얼굴 추적 준비가 오래 걸려요. 다시 켜 주세요.'), 30000);
      worker.onmessage = (event: MessageEvent<FaceWorkerReply>) => {
        if (this.session !== session) return;
        const reply = event.data;
        if (reply.type === 'ready') {
          clearTimeout(session.initTimer);
          session.finishReady?.(true);
        } else if (reply.type === 'error') {
          console.error('Face tracking:', reply.message);
          this.fail(session, '얼굴 추적을 실행하지 못했어요. 다시 켜 주세요.');
        } else {
          session.busy = false;
          clearTimeout(session.replyTimer);
          this.applyResult(session, reply);
        }
      };
      worker.onerror = () => this.fail(session, '얼굴 추적을 불러오지 못했어요. 다시 켜 주세요.');
      const request: FaceWorkerRequest = {
        type: 'init', runtimeUrl: this.platform.assetUrl('/face/vision_bundle.js'),
        wasmRoot: this.platform.assetUrl('/face/wasm'),
        modelUrl: this.platform.assetUrl('/face/face_landmarker.task'),
      };
      worker.postMessage(request);
      if (!await ready || this.session !== session) return;
      session.active = true;
      this.options.onStatus({ state: 'running', faceFound: false });
      session.frame = this.platform.requestFrame((time) => this.tick(session, time));
    } catch (error) {
      this.fail(session, cameraError(error));
    }
  }

  stop(): void {
    const session = this.session;
    this.session = null;
    if (session) {
      this.platform.cancelFrame(session.frame);
      clearTimeout(session.initTimer);
      clearTimeout(session.replyTimer);
      session.finishReady?.(false);
      session.worker?.terminate();
      session.stream?.getTracks().forEach((track) => track.stop());
    }
    this.options.video.pause();
    this.options.video.srcObject = null;
    this.mapper.reset();
    this.smoother.reset();
    this.options.onParameters(null);
    this.options.onLandmarks([]);
    this.options.onStatus({ state: 'stopped' });
  }

  private fail(session: Session, message: string): void {
    if (this.session !== session) return;
    this.stop();
    this.options.onStatus({ state: 'error', message });
  }

  private applyResult(session: Session, reply: Extract<FaceWorkerReply, { type: 'result' }>): void {
    this.options.onLandmarks(reply.landmarks);
    const parameters = reply.observation ? this.mapper.map({
      ...reply.observation, landmarks: reply.landmarks,
      aspectRatio: this.options.video.videoWidth / this.options.video.videoHeight,
    }) : null;
    const now = session.lastFrame;
    if (parameters) {
      const elapsed = session.lastParameterTime ? (now - session.lastParameterTime) / 1000 : 0;
      session.lastParameterTime = now;
      session.lastFaceTime = now;
      this.options.onParameters(this.smoother.update(parameters, elapsed));
    } else if (now - session.lastFaceTime > 500) {
      this.smoother.reset();
      session.lastParameterTime = 0;
      this.options.onParameters(null);
    }
    this.options.onStatus({ state: 'running', faceFound: parameters != null });
  }

  private tick(session: Session, time: number): void {
    if (this.session !== session || !session.active) return;
    session.frame = this.platform.requestFrame((next) => this.tick(session, next));
    const video = this.options.video;
    if (session.busy || video.readyState < 2 || video.currentTime === session.lastVideoTime ||
      time - session.lastFrame < FRAME_INTERVAL_MS) return;
    session.busy = true;
    session.lastFrame = time;
    session.lastVideoTime = video.currentTime;
    void this.platform.capture(video).then((bitmap) => {
      if (this.session !== session) { bitmap.close(); return; }
      session.replyTimer = setTimeout(() => this.fail(session, '얼굴 추적이 멈춰 카메라를 종료했어요. 다시 켜 주세요.'), 10000);
      const message: FaceWorkerRequest = { type: 'frame', bitmap, timestamp: time };
      try {
        session.worker!.postMessage(message, [bitmap]);
      } catch (error) {
        bitmap.close();
        throw error;
      }
    }).catch(() => this.fail(session, '카메라 영상을 읽지 못했어요. 다시 켜 주세요.'));
  }
}
