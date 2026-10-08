export interface TapConfig {
  /** Movement beyond this many CSS pixels turns the gesture into a drag. */
  maxMovePx: number;
  /** Presses longer than this are not taps. */
  maxDurationMs: number;
}

export const DEFAULT_TAP_CONFIG: TapConfig = Object.freeze({ maxMovePx: 8, maxDurationMs: 500 });

/** Tracks one active pointer and reports whether its release was a tap. */
export class TapTracker {
  private active: { id: number; x: number; y: number; time: number; dragged: boolean } | null =
    null;

  constructor(private readonly config: TapConfig = DEFAULT_TAP_CONFIG) {}

  get activePointerId(): number | null {
    return this.active?.id ?? null;
  }

  /** Returns false when another pointer is already being tracked. */
  down(id: number, x: number, y: number, timeMs: number): boolean {
    if (this.active) return false;
    this.active = { id, x, y, time: timeMs, dragged: false };
    return true;
  }

  /** Returns true when the move belongs to the tracked pointer. */
  move(id: number, x: number, y: number): boolean {
    if (!this.active || this.active.id !== id) return false;
    if (Math.hypot(x - this.active.x, y - this.active.y) > this.config.maxMovePx) {
      this.active.dragged = true;
    }
    return true;
  }

  /** Ends the tracked pointer; `tracked` is false for unrelated pointers. */
  up(id: number, timeMs: number): { tracked: boolean; tap: boolean } {
    if (!this.active || this.active.id !== id) return { tracked: false, tap: false };
    const { time, dragged } = this.active;
    this.active = null;
    return { tracked: true, tap: !dragged && timeMs - time <= this.config.maxDurationMs };
  }

  cancel(id: number): boolean {
    if (!this.active || this.active.id !== id) return false;
    this.active = null;
    return true;
  }
}
