import { describe, expect, it } from 'vitest';
import { selectTapTarget } from '../src/live2d/tapTarget';

describe('character tap targets', () => {
  it('uses named face HitAreas even when body areas also overlap', () => {
    expect(selectTapTarget(['Body', 'Head'])).toBe('face');
    expect(selectTapTarget(['Face', 'Body'])).toBe('face');
    expect(selectTapTarget(['Body'])).toBe('body');
  });

  it.each(['PartHead', 'PartFace', 'PartEyeL', 'PartMouth', 'PartEyeBallR'])(
    'recognizes Mark face drawables by their parent part %s', (part) => {
      expect(selectTapTarget(['PartBody ArtMesh1', `${part} ArtMesh2`])).toBe('face');
    },
  );

  it('keeps body and arm hits as reactions and leaves empty space alone', () => {
    expect(selectTapTarget(['PartBody Body'])).toBe('body');
    expect(selectTapTarget(['PartArmL ArmL'])).toBe('body');
    expect(selectTapTarget([])).toBeNull();
  });
});
