import { describe, expect, it } from 'vitest';
import { describeRendererStatus } from '../src/live2d/statusMessage';

describe('describeRendererStatus', () => {
  it('hides the status line once the character is ready', () => {
    expect(describeRendererStatus({ state: 'ready' })).toBeNull();
  });

  it.each(['loading', 'sdk_unavailable', 'webgl_unavailable'] as const)('explains %s', (state) => {
    expect(describeRendererStatus({ state })).toMatch(/\S/);
  });

  it('does not show internal error details to visitors', () => {
    expect(describeRendererStatus({ state: 'error', message: 'moc3 consistency failed' })).not.toContain('moc3');
  });
});
