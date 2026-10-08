import type { FaceParameters, ParameterOffsets } from '../types';
import type { CharacterRenderer } from './renderer';

/**
 * Stands in for a renderer that is still being loaded (the Cubism Framework is
 * fetched as a separate chunk). Calls made before it arrives are dropped, except
 * the latest tilt offsets, which are applied once it attaches.
 */
export class DeferredRenderer implements CharacterRenderer {
  private target: CharacterRenderer | null = null;
  private pendingTilt: ParameterOffsets | null = null;
  private pendingFace: FaceParameters | null = null;
  private paused = false;
  private automaticMotionEnabled = false;
  private disposed = false;

  attach(target: CharacterRenderer): void {
    if (this.disposed) {
      target.dispose();
      return;
    }
    this.target = target;
    target.setAutomaticMotionEnabled(this.automaticMotionEnabled);
    target.setTiltOffsets(this.pendingTilt);
    target.setFaceParameters(this.pendingFace);
    if (this.paused) target.setPaused(true);
  }

  lookAt(x: number, y: number): void {
    this.target?.lookAt(x, y);
  }

  releaseLook(): void {
    this.target?.releaseLook();
  }

  tap(x: number, y: number): boolean {
    return this.target?.tap(x, y) ?? false;
  }

  setAutomaticMotionEnabled(enabled: boolean): void {
    this.automaticMotionEnabled = enabled;
    this.target?.setAutomaticMotionEnabled(enabled);
  }

  setTiltOffsets(offsets: ParameterOffsets | null): void {
    this.pendingTilt = offsets;
    this.target?.setTiltOffsets(offsets);
  }

  setFaceParameters(parameters: FaceParameters | null): void {
    this.pendingFace = parameters;
    this.target?.setFaceParameters(parameters);
  }

  playMotion(group: string): void {
    this.target?.playMotion(group);
  }

  cycleExpression(): string | null {
    return this.target?.cycleExpression() ?? null;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.target?.setPaused(paused);
  }

  dispose(): void {
    this.disposed = true;
    this.target?.dispose();
    this.target = null;
  }
}
