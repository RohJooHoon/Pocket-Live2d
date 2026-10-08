import { describe, expect, it, vi } from 'vitest';
import { DeferredRenderer } from '../src/live2d/deferred';
import type { CharacterRenderer } from '../src/live2d/renderer';

function fakeRenderer(): CharacterRenderer {
  return {
    lookAt: vi.fn(),
    releaseLook: vi.fn(),
    tap: vi.fn(() => true),
    setAutomaticMotionEnabled: vi.fn(),
    setTiltOffsets: vi.fn(),
    setFaceParameters: vi.fn(),
    playMotion: vi.fn(),
    cycleExpression: vi.fn(() => 'happy'),
    setPaused: vi.fn(),
    dispose: vi.fn(),
  };
}

const tilt = { angleX: 1, angleY: 2, angleZ: 3, eyeBallX: 0.1, eyeBallY: 0.2, bodyAngleX: 4 };

describe('DeferredRenderer', () => {
  it('ignores input until the real renderer arrives', () => {
    const deferred = new DeferredRenderer();
    expect(deferred.tap(1, 2)).toBe(false);
    expect(deferred.cycleExpression()).toBeNull();
    expect(() => {
      deferred.lookAt(1, 2);
      deferred.releaseLook();
      deferred.playMotion('TapBody');
    }).not.toThrow();
  });

  it('applies the latest tilt and pause state on attach, then forwards calls', () => {
    const deferred = new DeferredRenderer();
    deferred.setTiltOffsets(tilt);
    deferred.setPaused(true);

    const target = fakeRenderer();
    deferred.attach(target);
    expect(target.setAutomaticMotionEnabled).toHaveBeenCalledWith(false);
    expect(target.setTiltOffsets).toHaveBeenCalledWith(tilt);
    expect(target.setPaused).toHaveBeenCalledWith(true);

    expect(deferred.tap(5, 6)).toBe(true);
    expect(target.tap).toHaveBeenCalledWith(5, 6);
    expect(deferred.cycleExpression()).toBe('happy');
    deferred.playMotion('Shake');
    expect(target.playMotion).toHaveBeenCalledWith('Shake');
  });

  it('disposes a renderer that arrives after the page gave up on it', () => {
    const deferred = new DeferredRenderer();
    deferred.dispose();
    const target = fakeRenderer();
    deferred.attach(target);
    expect(target.dispose).toHaveBeenCalled();
    expect(deferred.tap(0, 0)).toBe(false);
  });

  it('forwards camera values, including clearing them before lazy loading completes', () => {
    const deferred = new DeferredRenderer();
    const face = { ...tilt, eyeLOpen: 0, eyeROpen: 1, mouthOpen: 1, mouthForm: 0, browLY: 0, browRY: 0 };
    deferred.setFaceParameters(face);
    deferred.setFaceParameters(null);
    const target = fakeRenderer();
    deferred.attach(target);
    expect(target.setFaceParameters).toHaveBeenCalledWith(null);
    deferred.setFaceParameters(face);
    expect(target.setFaceParameters).toHaveBeenLastCalledWith(face);
  });

  it('retains the latest automatic motion selection during lazy loading', () => {
    const deferred = new DeferredRenderer();
    deferred.setAutomaticMotionEnabled(true);
    deferred.setAutomaticMotionEnabled(false);
    const target = fakeRenderer();
    deferred.attach(target);
    expect(target.setAutomaticMotionEnabled).toHaveBeenLastCalledWith(false);
    deferred.setAutomaticMotionEnabled(true);
    expect(target.setAutomaticMotionEnabled).toHaveBeenLastCalledWith(true);
  });
});
