import { describe, expect, it, vi } from 'vitest';
import { ExclusiveInputModes } from '../src/input/exclusiveInputModes';
import { FaceTracker, type CameraPlatform } from '../src/input/faceTracker';
import type { MotionPermission } from '../src/input/motionSensors';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  const state = { motion: false, camera: false, paused: false, ready: true };
  const check = () => expect(state.motion && state.camera).toBe(false);
  const options = {
    motionEnabled: () => state.motion,
    setMotionEnabled: vi.fn((enabled: boolean) => { state.motion = enabled; check(); }),
    cameraEnabled: () => state.camera,
    startCamera: vi.fn(async () => { state.camera = true; check(); }),
    stopCamera: vi.fn(() => { state.camera = false; check(); }),
    canStartCamera: () => state.ready,
    paused: () => state.paused,
    requestMotionPermission: vi.fn(async (): Promise<MotionPermission> => 'granted'),
    onMotionPermission: vi.fn(),
  };
  return { state, options, modes: new ExclusiveInputModes(options) };
}

describe('exclusive tilt and face tracking modes', () => {
  it('stops tilt before starting camera and does not restore tilt when camera is stopped', () => {
    const f = fixture();
    f.state.motion = true;
    f.modes.toggleCamera();
    expect(f.state).toMatchObject({ motion: false, camera: true });
    f.modes.toggleCamera();
    expect(f.state).toMatchObject({ motion: false, camera: false });
  });

  it('stops camera before enabling tilt after permission is granted', async () => {
    const f = fixture();
    f.state.camera = true;
    await f.modes.toggleMotion();
    expect(f.state).toMatchObject({ motion: true, camera: false });
    await f.modes.toggleMotion();
    expect(f.state).toMatchObject({ motion: false, camera: false });
  });

  it('keeps camera running when motion permission is denied', async () => {
    const f = fixture();
    f.state.camera = true;
    f.options.requestMotionPermission.mockResolvedValue('denied');
    await f.modes.toggleMotion();
    expect(f.state).toMatchObject({ motion: false, camera: true });
    expect(f.options.onMotionPermission).toHaveBeenCalledWith('denied');
  });

  it('releases late camera permission after switching from camera startup to tilt', async () => {
    const f = fixture(), permission = deferred<MediaStream>(), stopTrack = vi.fn();
    const video = { pause: vi.fn(), play: vi.fn(async () => {}), srcObject: null };
    const platform: CameraPlatform = {
      secure: () => true, available: () => true, getStream: () => permission.promise,
      createWorker: vi.fn(), capture: vi.fn(), assetUrl: (path) => path,
      requestFrame: vi.fn(), cancelFrame: vi.fn(),
    };
    const tracker = new FaceTracker({
      video: video as unknown as HTMLVideoElement, onParameters: vi.fn(), onLandmarks: vi.fn(),
      onStatus: () => { f.state.camera = tracker.isEnabled; expect(f.state.motion && f.state.camera).toBe(false); },
    }, platform);
    let cameraStart!: Promise<void>;
    f.options.cameraEnabled = () => tracker.isEnabled;
    f.options.startCamera = vi.fn(() => { cameraStart = tracker.start(); return cameraStart; });
    f.options.stopCamera = vi.fn(() => tracker.stop());
    f.modes.toggleCamera();
    expect(tracker.isEnabled).toBe(true);
    await f.modes.toggleMotion();
    permission.resolve({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream);
    await cameraStart;
    expect(f.state).toMatchObject({ motion: true, camera: false });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(platform.createWorker).not.toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
  });

  it('ignores a late motion permission after the user selects camera', async () => {
    const f = fixture(), permission = deferred<MotionPermission>();
    f.options.requestMotionPermission.mockReturnValue(permission.promise);
    const pending = f.modes.toggleMotion();
    f.modes.toggleCamera();
    permission.resolve('granted');
    await pending;
    expect(f.state).toMatchObject({ motion: false, camera: true });
    expect(f.options.onMotionPermission).not.toHaveBeenCalled();
  });

  it('cancels motion permission on a second tap without issuing another request', async () => {
    const f = fixture(), permission = deferred<MotionPermission>();
    f.options.requestMotionPermission.mockReturnValue(permission.promise);
    const pending = f.modes.toggleMotion();
    await f.modes.toggleMotion();
    permission.resolve('granted');
    await pending;
    expect(f.state.motion).toBe(false);
    expect(f.options.requestMotionPermission).toHaveBeenCalledOnce();
  });

  it('does not let an older permission override a new request', async () => {
    const f = fixture(), oldPermission = deferred<MotionPermission>(), newPermission = deferred<MotionPermission>();
    f.options.requestMotionPermission.mockReturnValueOnce(oldPermission.promise).mockReturnValueOnce(newPermission.promise);
    const old = f.modes.toggleMotion();
    f.modes.toggleCamera();
    const latest = f.modes.toggleMotion();
    oldPermission.resolve('granted');
    await old;
    expect(f.state).toMatchObject({ motion: false, camera: true });
    newPermission.resolve('granted');
    await latest;
    expect(f.state).toMatchObject({ motion: true, camera: false });
  });

  it('invalidates pending permission on page hide even if the page becomes visible again', async () => {
    const f = fixture(), permission = deferred<MotionPermission>();
    f.options.requestMotionPermission.mockReturnValue(permission.promise);
    const pending = f.modes.toggleMotion();
    f.modes.cancelPendingMotion();
    permission.resolve('granted');
    await pending;
    expect(f.state.motion).toBe(false);
  });

  it('does not start an unavailable camera or either mode while paused', async () => {
    const f = fixture();
    f.state.motion = true;
    f.state.ready = false;
    f.modes.toggleCamera();
    expect(f.state.motion).toBe(true);
    expect(f.options.startCamera).not.toHaveBeenCalled();
    f.state.motion = false;
    f.state.ready = true;
    f.state.paused = true;
    f.modes.toggleCamera();
    await f.modes.toggleMotion();
    expect(f.options.startCamera).not.toHaveBeenCalled();
    expect(f.options.requestMotionPermission).not.toHaveBeenCalled();
  });
});
