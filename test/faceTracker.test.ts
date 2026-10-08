import { afterEach, describe, expect, it, vi } from 'vitest';
import { FaceTracker, type CameraPlatform } from '../src/input/faceTracker';
import type { FaceWorkerReply } from '../src/input/faceProtocol';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function stream() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  return { track, value: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream };
}

function fixture() {
  const cameraStream = stream();
  const video = { srcObject: null, play: vi.fn(async () => {}), pause: vi.fn(), readyState: 2, currentTime: 0 };
  const worker = {
    onmessage: null as ((event: MessageEvent<FaceWorkerReply>) => void) | null,
    onerror: null as (() => void) | null,
    postMessage: vi.fn(), terminate: vi.fn(),
    emit(data: FaceWorkerReply) { this.onmessage?.({ data } as MessageEvent<FaceWorkerReply>); },
  };
  let frame: FrameRequestCallback = () => {};
  const platform: CameraPlatform = {
    available: () => true, secure: () => true,
    getStream: vi.fn(async () => cameraStream.value),
    createWorker: vi.fn(() => worker as unknown as Worker),
    capture: vi.fn(async () => ({ close: vi.fn() }) as unknown as ImageBitmap),
    assetUrl: (path) => 'https://example.com/' + path,
    requestFrame: vi.fn((callback) => { frame = callback; return 1; }),
    cancelFrame: vi.fn(),
  };
  const onParameters = vi.fn(), onStatus = vi.fn();
  const tracker = new FaceTracker({ video: video as unknown as HTMLVideoElement, onParameters, onStatus }, platform);
  return { tracker, video, worker, platform, cameraStream, onParameters, onStatus, frame: (time: number) => frame(time) };
}

async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function started(f: ReturnType<typeof fixture>) {
  const pending = f.tracker.start();
  await flush();
  f.worker.emit({ type: 'ready' });
  await pending;
}

afterEach(() => { vi.useRealTimers(); });

describe('camera lifecycle', () => {
  it('does not request a camera on HTTP or unsupported browsers', async () => {
    const f = fixture();
    f.platform.secure = () => false;
    await f.tracker.start();
    expect(f.platform.getStream).not.toHaveBeenCalled();
    expect(f.onStatus).toHaveBeenLastCalledWith({ state: 'error', message: expect.stringContaining('https') });
    f.platform.secure = () => true;
    f.platform.available = () => false;
    await f.tracker.start();
    expect(f.platform.getStream).not.toHaveBeenCalled();
  });

  it('releases a permission result that arrives after cancellation', async () => {
    const f = fixture(), permission = deferred<MediaStream>();
    f.platform.getStream = () => permission.promise;
    const pending = f.tracker.start();
    f.tracker.stop();
    permission.resolve(f.cameraStream.value);
    await pending;
    expect(f.cameraStream.track.stop).toHaveBeenCalledOnce();
    expect(f.video.srcObject).toBeNull();
    expect(f.platform.createWorker).not.toHaveBeenCalled();
    expect(f.tracker.isEnabled).toBe(false);
  });

  it('cancels a pending model load without leaving a camera or worker alive', async () => {
    const f = fixture();
    const pending = f.tracker.start();
    await flush();
    f.tracker.stop();
    await pending;
    f.worker.emit({ type: 'ready' });
    expect(f.cameraStream.track.stop).toHaveBeenCalledOnce();
    expect(f.worker.terminate).toHaveBeenCalledOnce();
    expect(f.platform.requestFrame).not.toHaveBeenCalled();
  });

  it('does not let an old permission promise terminate a newer session', async () => {
    const f = fixture(), permission = deferred<MediaStream>(), oldStream = stream();
    f.platform.getStream = vi.fn().mockReturnValueOnce(permission.promise).mockResolvedValue(f.cameraStream.value);
    const oldStart = f.tracker.start();
    await started(f);
    permission.resolve(oldStream.value);
    await oldStart;
    expect(oldStream.track.stop).toHaveBeenCalledOnce();
    expect(f.cameraStream.track.stop).not.toHaveBeenCalled();
    expect(f.tracker.isEnabled).toBe(true);
    f.tracker.stop();
  });

  it('captures at most one frame in flight and closes late bitmaps on stop', async () => {
    const f = fixture(), bitmap = deferred<ImageBitmap>(), close = vi.fn();
    f.platform.capture = vi.fn(() => bitmap.promise);
    await started(f);
    f.frame(1000);
    f.video.currentTime = 1;
    f.frame(1100);
    expect(f.platform.capture).toHaveBeenCalledOnce();
    f.tracker.stop();
    bitmap.resolve({ close } as unknown as ImageBitmap);
    await flush();
    expect(close).toHaveBeenCalledOnce();
    expect(f.worker.postMessage).toHaveBeenCalledTimes(1); // init only
  });

  it('clears stale facial values when no face is found for 500 ms', async () => {
    const f = fixture();
    await started(f);
    f.frame(1000);
    await flush();
    f.worker.emit({ type: 'result', observation: {
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -50, 1], scores: { jawOpen: 0.5 },
    } });
    expect(f.onParameters).toHaveBeenLastCalledWith(expect.objectContaining({ mouthOpen: 0.75 }));
    f.video.currentTime = 2;
    f.frame(1600);
    await flush();
    f.worker.emit({ type: 'result', observation: null });
    expect(f.onParameters).toHaveBeenLastCalledWith(null);
    f.tracker.stop();
  });

  it('stops the camera on a model timeout or camera disconnect', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const pending = f.tracker.start();
    await flush();
    await vi.advanceTimersByTimeAsync(30000);
    await pending;
    expect(f.tracker.isEnabled).toBe(false);
    expect(f.cameraStream.track.stop).toHaveBeenCalledOnce();
    const next = fixture();
    await started(next);
    const onEnded = next.cameraStream.track.addEventListener.mock.calls[0][1] as () => void;
    onEnded();
    expect(next.tracker.isEnabled).toBe(false);
    expect(next.worker.terminate).toHaveBeenCalledOnce();
  });

  it('cleans up video when autoplay fails and explains denied permissions', async () => {
    const f = fixture();
    f.video.play.mockRejectedValueOnce(new Error('play failed'));
    await f.tracker.start();
    expect(f.cameraStream.track.stop).toHaveBeenCalledOnce();
    expect(f.video.srcObject).toBeNull();
    f.platform.getStream = vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    await f.tracker.start();
    expect(f.onStatus).toHaveBeenLastCalledWith({ state: 'error', message: expect.stringContaining('거부') });
  });
});
