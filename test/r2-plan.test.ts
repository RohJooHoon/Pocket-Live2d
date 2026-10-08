import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUploadPlan } from '../tool/r2-plan.mjs';
import type { CharacterConfig } from '../src/types';

const character: CharacterConfig = { id: 'mark', name: 'Mark', model: 'Mark.model3.json', idleMotion: 'Idle', tapMotion: 'TapBody', shakeMotion: 'Shake' };
let root: string;
let directory: string;
function manifest(moc = 'Mark.moc3') {
  writeFileSync(resolve(directory, character.model), JSON.stringify({ FileReferences: {
    Moc: moc, Textures: ['textures/body.png'], Motions: { Idle: [{ File: 'idle.motion3.json', Sound: 'voice.wav' }] },
  } }));
}
beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), 'r2-plan-'));
  directory = resolve(root, 'characters/mark/model');
  mkdirSync(resolve(directory, 'textures'), { recursive: true });
  writeFileSync(resolve(root, 'characters/mark/character.json'), JSON.stringify(character));
  for (const file of ['Mark.moc3', 'textures/body.png', 'idle.motion3.json', 'voice.wav', 'README.md', 'unrelated.json']) {
    writeFileSync(resolve(directory, file), 'fixture');
  }
  manifest();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
describe('R2 upload plan', () => {
  it('preserves nested paths and MIME types, includes audio, excludes unrelated files and publishes manifest last', () => {
    const plan = createUploadPlan(root, [character]);
    expect(plan.map(({ key }) => key)).toEqual([
      'characters/mark/model/Mark.moc3', 'characters/mark/model/textures/body.png',
      'characters/mark/model/idle.motion3.json', 'characters/mark/model/voice.wav',
      'characters/mark/model/Mark.model3.json',
      'characters/mark/model/character.json',
    ]);
    expect(plan[1].contentType).toBe('image/png');
    expect(plan[4].contentType).toBe('application/json');
  });
  it('supports the existing explicit /models/ prefix without nesting a model subfolder', () => {
    const plan = createUploadPlan(root, [character], { prefix: 'models', nested: false });
    expect(plan[0].key).toBe('models/mark/Mark.moc3');
    expect(plan.at(-1)?.key).toBe('models/mark/character.json');
  });
  it('fails before uploads if a referenced resource is missing', () => {
    rmSync(resolve(directory, 'voice.wav'));
    expect(() => createUploadPlan(root, [character])).toThrow();
  });
  it('rejects references outside the character directory', () => {
    manifest('../outside.moc3');
    expect(() => createUploadPlan(root, [character])).toThrow(/Unsafe model reference/);
  });
  it('rejects symlinked external assets', () => {
    writeFileSync(resolve(root, 'outside.moc3'), 'fixture');
    rmSync(resolve(directory, 'Mark.moc3'));
    symlinkSync(resolve(root, 'outside.moc3'), resolve(directory, 'Mark.moc3'));
    expect(() => createUploadPlan(root, [character])).toThrow(/external model resource/);
  });
});
