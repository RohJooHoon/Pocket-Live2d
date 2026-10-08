import type { MotionPermission } from './motionSensors';

interface InputModeOptions {
  motionEnabled(): boolean;
  setMotionEnabled(enabled: boolean): void;
  cameraEnabled(): boolean;
  startCamera(): Promise<void>;
  stopCamera(): void;
  canStartCamera(): boolean;
  paused(): boolean;
  requestMotionPermission(): Promise<MotionPermission>;
  onMotionPermission(permission: MotionPermission): void;
}

/** Switch input modes and ignore permission results superseded by another action. */
export class ExclusiveInputModes {
  private pendingMotion: object | null = null;

  constructor(private readonly options: InputModeOptions) {}

  async toggleMotion(): Promise<void> {
    const pending = this.pendingMotion;
    this.cancelPendingMotion();
    if (this.options.motionEnabled() || pending) {
      this.options.setMotionEnabled(false);
      return;
    }
    if (this.options.paused()) return;
    const request = {};
    this.pendingMotion = request;
    const permission = await this.options.requestMotionPermission();
    if (this.pendingMotion !== request) return;
    this.pendingMotion = null;
    if (this.options.paused()) return;
    if (permission === 'granted') {
      // FaceTracker.stop also invalidates a camera startup still awaiting permission.
      this.options.stopCamera();
      this.options.setMotionEnabled(true);
    }
    this.options.onMotionPermission(permission);
  }

  toggleCamera(): void {
    if (this.options.cameraEnabled()) {
      this.cancelPendingMotion();
      this.options.stopCamera();
    } else if (this.options.canStartCamera() && !this.options.paused()) {
      this.cancelPendingMotion();
      this.options.setMotionEnabled(false);
      void this.options.startCamera();
    }
  }

  cancelPendingMotion(): void {
    this.pendingMotion = null;
  }
}
