import { describe, expect, it } from 'vitest';
import { MotionSequence } from '../src/live2d/motionSequence';

describe('automatic motion sequence', () => {
  it('includes all unique motions in every pass instead of repeating one random clip', () => {
    const sequence = new MotionSequence<string>(() => 0);
    sequence.reset(['idle-1', 'idle-2', 'tap', 'shake', 'tap']);
    const seen: string[] = [];
    for (let pass = 0; pass < 4; pass++) {
      const motions = Array.from({ length: 4 }, () => sequence.next());
      expect(new Set(motions)).toEqual(new Set(['idle-1', 'idle-2', 'tap', 'shake']));
      seen.push(...motions as string[]);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it('handles motionless and single-motion models and discards a replaced model', () => {
    const sequence = new MotionSequence<string>();
    expect(sequence.next()).toBeNull();
    sequence.reset(['only']);
    expect(sequence.next()).toBe('only');
    expect(sequence.next()).toBe('only');
    sequence.reset(['new']);
    expect(sequence.next()).toBe('new');
    sequence.reset([]);
    expect(sequence.next()).toBeNull();
  });
});
