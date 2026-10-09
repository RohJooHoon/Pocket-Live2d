/** Plays every available item before repeating, without an immediate repeat at the boundary. */
export class MotionSequence<T> {
  private items: T[] = [];
  private remaining: T[] = [];
  private last: T | null = null;

  constructor(private readonly random: () => number = Math.random) {}

  reset(items: Iterable<T>): void {
    this.items = [...new Set(items)];
    this.remaining = [];
    this.last = null;
  }

  next(): T | null {
    if (this.items.length === 0) return null;
    if (this.remaining.length === 0) {
      this.remaining = [...this.items];
      for (let i = this.remaining.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.remaining[i], this.remaining[j]] = [this.remaining[j], this.remaining[i]];
      }
      const end = this.remaining.length - 1;
      if (end > 0 && this.remaining[end] === this.last) {
        [this.remaining[0], this.remaining[end]] = [this.remaining[end], this.remaining[0]];
      }
    }
    this.last = this.remaining.pop()!;
    return this.last;
  }
}
