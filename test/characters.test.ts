import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CharacterConfig } from '../src/types';

const characterIds = readdirSync('characters', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe.each(characterIds)('character %s', (id) => {
  const config = JSON.parse(readFileSync(join('characters', id, 'character.json'), 'utf8')) as CharacterConfig;
  const modelPath = join('characters', id, 'model', config.model);

  it('matches its folder and points to a bundled model', () => {
    expect(config.id).toBe(id);
    expect(config.name.trim()).not.toBe('');
    expect(existsSync(modelPath)).toBe(true);
  });

  it('uses motion groups that the model defines', () => {
    const model = JSON.parse(readFileSync(modelPath, 'utf8'));
    const groups = Object.keys(model.FileReferences.Motions ?? {});
    for (const group of [config.idleMotion, config.tapMotion, config.shakeMotion]) {
      expect(groups).toContain(group);
    }
  });
});
