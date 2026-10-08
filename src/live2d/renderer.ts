import type { FaceParameters, ParameterOffsets } from '../types';

export type RendererStatus =
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'sdk_unavailable' }
  | { state: 'webgl_unavailable' }
  | { state: 'error'; message: string };

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  /** Directory that holds the model3.json, ending with '/'. */
  modelDirectory: string;
  modelFile: string;
  /** Directory that holds the Cubism WebGL shader files, ending with '/'. */
  shaderDirectory: string;
  idleMotion: string;
  tapMotion: string;
  onStatus: (status: RendererStatus) => void;
}

/** The page talks to Live2D only through this interface. */
export interface CharacterRenderer {
  /** Points the character's gaze at a position in canvas CSS pixels. */
  lookAt(x: number, y: number): void;
  /** Lets the gaze return to the motion's own direction. */
  releaseLook(): void;
  /** Hit-tests canvas CSS pixels: face cycles expressions, body plays a reaction. */
  tap(x: number, y: number): boolean;
  /** Enable idle motions and body sway; off keeps breathing and explicit input. */
  setAutomaticMotionEnabled(enabled: boolean): void;
  /** Adds tilt offsets on top of motions every frame; null removes them. */
  setTiltOffsets(offsets: ParameterOffsets | null): void;
  /** Absolute camera pose and expression values; null restores normal animation. */
  setFaceParameters(parameters: FaceParameters | null): void;
  playMotion(group: string): void;
  /** Applies the next expression, or clears expressions after the last one. */
  cycleExpression(): string | null;
  setPaused(paused: boolean): void;
  dispose(): void;
}

export type CreateRenderer = (options: RendererOptions) => CharacterRenderer;
