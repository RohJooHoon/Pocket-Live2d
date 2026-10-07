export interface CharacterConfig {
  /** Folder name under characters/ and the build output name. */
  id: string;
  /** Name shown on the page. */
  name: string;
  /** model3.json file name inside characters/<id>/model/. */
  model: string;
  idleMotion: string;
  tapMotion: string;
  shakeMotion: string;
  /** Rights notice required by the character's license, shown in the info dialog. */
  credit?: string;
}

export interface OrientationState {
  /** Left/right tilt, -1 (left) … 1 (right). */
  x: number;
  /** Up/down tilt, -1 (down) … 1 (up). */
  y: number;
  /** Twist around the screen axis, -1 … 1. */
  z: number;
}

/** Live2D parameter values added on top of motions for the current frame. */
export interface ParameterOffsets {
  angleX: number;
  angleY: number;
  angleZ: number;
  eyeBallX: number;
  eyeBallY: number;
  bodyAngleX: number;
}
