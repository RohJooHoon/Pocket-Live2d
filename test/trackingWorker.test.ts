import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import type { FaceWorkerReply } from '../src/input/faceProtocol';
import { bodyObservation } from './bodyFixture';

const source = ts.transpileModule(readFileSync(new URL('../src/input/face.worker.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

async function fixture(failInit = false) {
  const replies: FaceWorkerReply[] = [];
  const body = bodyObservation();
  const detectBody = vi.fn(() => ({ landmarks: [body.landmarks], worldLandmarks: [body.worldLandmarks] }));
  const closeBody = vi.fn();
  const faceResult = { facialTransformationMatrixes: [{ data: Array(16).fill(0) }],
    faceBlendshapes: [{ categories: [{ categoryName: 'jawOpen', score: 0.5 }] }],
    faceLandmarks: [[{ x: 0.5, y: 0.4, z: 0.1 }]] };
  const scope = {
    onmessage: (_event: { data: unknown }) => {},
    postMessage: (reply: FaceWorkerReply) => replies.push(reply), importScripts: vi.fn(),
    Vision: { FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
      FaceLandmarker: { createFromOptions: vi.fn(async () => ({ detectForVideo: vi.fn(() => faceResult) })) },
      PoseLandmarker: { createFromOptions: vi.fn(async () => {
        if (failInit) throw new Error('Pose unavailable');
        return { detectForVideo: detectBody, close: closeBody };
      }) },
    },
  };
  runInNewContext(source, { self: scope, console: { warn: vi.fn() } });
  scope.onmessage({ data: { type: 'init', runtimeUrl: 'runtime', wasmRoot: 'wasm', modelUrl: 'face.task', bodyModelUrl: 'body.task' } });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  const frame = (timestamp: number) => {
    const close = vi.fn();
    scope.onmessage({ data: { type: 'frame', timestamp, bitmap: { close } } });
    expect(close).toHaveBeenCalledOnce();
  };
  return { replies, detectBody, closeBody, frame };
}

describe('camera inference worker', () => {
  it('shares camera frames, returns pose depth/visibility and runs body inference at most five times a second', async () => {
    const f = await fixture();
    expect(f.replies[0]).toEqual({ type: 'ready', bodyAvailable: true });
    f.frame(1000); f.frame(1067); f.frame(1134); f.frame(1201);
    expect(f.detectBody).toHaveBeenCalledTimes(2);
    const results = f.replies.filter((reply) => reply.type === 'result');
    expect(results[0].body?.worldLandmarks[11].z).toBe(0);
    expect(results[0].body?.landmarks[11].visibility).toBe(1);
    expect(results[1].body).toBeUndefined();
    expect(results[1].landmarks[0].z).toBe(0.1);
    expect(results[3].body).not.toBeNull();
  });

  it('still returns facial tracking if pose initialization or inference fails', async () => {
    const unavailable = await fixture(true);
    expect(unavailable.replies[0]).toEqual({ type: 'ready', bodyAvailable: false });
    unavailable.frame(1000);
    expect(unavailable.replies.at(-1)).toMatchObject({ type: 'result', observation: { scores: { jawOpen: 0.5 } } });
    const failed = await fixture();
    failed.detectBody.mockImplementationOnce(() => { throw new Error('Pose failed'); });
    failed.frame(1000);
    expect(failed.closeBody).toHaveBeenCalledOnce();
    expect(failed.replies).toContainEqual({ type: 'body-error', message: expect.stringContaining('Pose failed') });
    expect(failed.replies.at(-1)).toMatchObject({ type: 'result', body: null, observation: { scores: { jawOpen: 0.5 } } });
    failed.frame(1200);
    expect(failed.detectBody).toHaveBeenCalledOnce();
  });
});
