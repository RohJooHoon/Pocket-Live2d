// WebGL renderer built on the Cubism SDK for Web. Loaded lazily by adapter.ts
// after Cubism Core is confirmed, because Framework modules read Core on import.
import { CubismFramework, LogLevel, Option } from '@framework/live2dcubismframework';
import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { CubismWebGLOffscreenManager } from '@framework/rendering/cubismoffscreenmanager';

import type { FaceParameters, ParameterOffsets } from '../../types';
import type { CharacterRenderer, RendererOptions } from '../renderer';
import { CharacterModel } from './characterModel';

/** Rendering above 2x density costs battery without a visible gain on phones. */
const MAX_PIXEL_RATIO = 2;
/** Long pauses (tab switches) should not make motions jump. */
const MAX_FRAME_SECONDS = 0.1;

let frameworkStarted = false;

function startFramework(): void {
  if (frameworkStarted) return;
  const option = new Option();
  option.logFunction = (message: string) => console.info(message);
  option.loggingLevel = LogLevel.LogLevel_Warning;
  CubismFramework.startUp(option);
  CubismFramework.initialize();
  frameworkStarted = true;
}

export class CubismCharacterRenderer implements CharacterRenderer {
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private model: CharacterModel | null = null;
  private frameBuffer: WebGLFramebuffer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frame = 0;
  private lastTime = 0;
  private needsResize = true;
  private paused = false;
  private disposed = false;
  /** Scale the projection applied in the last frame, used to map touches into model space. */
  private projectionScale = { x: 1, y: 1 };

  constructor(private readonly options: RendererOptions) {
    this.canvas = options.canvas;

    const gl =
      this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true }) ??
      this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (!gl) {
      options.onStatus({ state: 'webgl_unavailable' });
      return;
    }
    this.gl = gl;
    this.frameBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.resizeObserver = new ResizeObserver(() => {
      this.needsResize = true;
    });
    this.resizeObserver.observe(this.canvas);
    this.resize();

    startFramework();
    const model = new CharacterModel(gl, options);
    this.model = model;
    model
      .load(this.canvas.width, this.canvas.height)
      .then(() => {
        if (!this.disposed) options.onStatus({ state: 'ready' });
      })
      .catch((error: unknown) => {
        if (this.disposed) return;
        options.onStatus({
          state: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });

    this.frame = requestAnimationFrame(this.tick);
  }

  lookAt(x: number, y: number): void {
    const point = this.toModelSpace(x, y);
    this.model?.lookAt(point.x, point.y);
  }

  releaseLook(): void {
    this.model?.releaseLook();
  }

  tap(x: number, y: number): boolean {
    const model = this.model;
    if (!model?.isReady) return false;
    const point = this.toModelSpace(x, y);
    const target = model.hitTest(point.x, point.y);
    if (target == null) return false;
    if (target === 'face') model.cycleExpression();
    else model.playTapMotion();
    return true;
  }

  setTiltOffsets(offsets: ParameterOffsets | null): void {
    this.model?.setTiltOffsets(offsets);
  }

  setAutomaticMotionEnabled(enabled: boolean): void {
    this.model?.setAutomaticMotionEnabled(enabled);
  }

  setFaceParameters(parameters: FaceParameters | null): void {
    this.model?.setFaceParameters(parameters);
  }

  playMotion(group: string): void {
    this.model?.playMotion(group);
  }

  cycleExpression(): string | null {
    return this.model?.cycleExpression() ?? null;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.lastTime = 0;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.model?.release();
    this.model = null;
  }

  private readonly tick = (time: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    const deltaSeconds = this.lastTime
      ? Math.min((time - this.lastTime) / 1000, MAX_FRAME_SECONDS)
      : 0;
    this.lastTime = time;

    const gl = this.gl;
    const model = this.model;
    if (this.paused || !gl || gl.isContextLost()) return;
    if (this.needsResize) this.resize();

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    if (!model?.isReady) return;

    const offscreen = CubismWebGLOffscreenManager.getInstance();
    offscreen.beginFrameProcess(gl);
    model.update(deltaSeconds);
    model.draw(this.projection(model), this.frameBuffer, [
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    ]);
    offscreen.endFrameProcess(gl);
    offscreen.releaseStaleRenderTextures(gl);
  };

  /** Fits the model into the canvas like the official sample does. */
  private projection(model: CharacterModel): CubismMatrix44 {
    const { width, height } = this.canvas;
    const projection = new CubismMatrix44();
    if (model.getModel().getCanvasWidth() > 1.0 && width < height) {
      model.getModelMatrix().setWidth(2.0);
      this.projectionScale = { x: 1, y: width / height };
    } else {
      this.projectionScale = { x: height / width, y: 1 };
    }
    projection.scale(this.projectionScale.x, this.projectionScale.y);
    return projection;
  }

  /** Converts canvas CSS pixels into the coordinate space the model matrix works in. */
  private toModelSpace(x: number, y: number): { x: number; y: number } {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    const clipX = (x / width) * 2 - 1;
    const clipY = 1 - (y / height) * 2;
    return { x: clipX / this.projectionScale.x, y: clipY / this.projectionScale.y };
  }

  private resize(): void {
    this.needsResize = false;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.model?.isReady) this.model.setRenderTargetSize(width, height);
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.options.onStatus({ state: 'error', message: 'WebGL context was lost' });
  };
}
