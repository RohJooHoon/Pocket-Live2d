const HOLD_MS = 10000;
const MAX_MOVE_PX = 16;

/** A continuous, stationary press restores the UI. Release or interruption cancels it. */
export class HoldToRestore {
  private press: { id: number; x: number; y: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly restore: () => void) {}

  down(id: number, x: number, y: number): void {
    if (this.press) { this.cancelAll(); return; }
    this.press = { id, x, y };
    this.timer = setTimeout(() => {
      this.cancelAll();
      this.restore();
    }, HOLD_MS);
  }

  move(id: number, x: number, y: number): void {
    if (this.press?.id === id && Math.hypot(x - this.press.x, y - this.press.y) > MAX_MOVE_PX) this.cancelAll();
  }

  cancel(id: number): void {
    if (this.press?.id === id) this.cancelAll();
  }

  cancelAll(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.press = null;
  }
}
