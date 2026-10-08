import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('tool/prepare_model_upload.py');
const folders: string[] = [];
afterEach(() => folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })));

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'pocket-model-')); folders.push(root);
  const source = resolve(root, 'source'), output = resolve(root, 'output');
  mkdirSync(resolve(source, 'textures'), { recursive: true });
  mkdirSync(resolve(source, 'motions'), { recursive: true });
  writeFileSync(resolve(source, 'Haru.moc3'), Buffer.from('MOC3'));
  writeFileSync(resolve(source, 'textures/texture.png'), 'texture fixture');
  writeFileSync(resolve(source, 'motions/idle.motion3.json'), '{}');
  writeFileSync(resolve(source, 'private.psd'), 'must not be uploaded');
  const data = { Version: 3, FileReferences: {
    Moc: 'Haru.moc3', Textures: ['textures/texture.png'], Motions: { Idle: [{ File: 'motions/idle.motion3.json' }] },
  } };
  const save = () => writeFileSync(resolve(source, 'Haru.model3.json'), JSON.stringify(data));
  save();
  const run = (...args: string[]) => execFileSync('python3', [script, 'haru', source, '--out', output, ...args], { encoding: 'utf8', stdio: 'pipe' });
  return { source, output, data, save, run };
}

describe('model upload preparation', () => {
  it('copies referenced files and creates metadata without copying authoring sources', () => {
    const f = fixture(); f.run('--name', '하루', '--credit', 'My character');
    expect(JSON.parse(readFileSync(resolve(f.output, 'character.json'), 'utf8'))).toMatchObject({
      id: 'haru', model: 'Haru.model3.json', name: '하루', credit: 'My character', idleMotion: 'Idle', tapMotion: 'Idle', shakeMotion: 'Idle',
    });
    expect(existsSync(resolve(f.output, 'textures/texture.png'))).toBe(true);
    expect(existsSync(resolve(f.output, 'motions/idle.motion3.json'))).toBe(true);
    expect(existsSync(resolve(f.output, 'private.psd'))).toBe(false);
  });

  it('fails before publishing metadata when a required resource is missing', () => {
    const f = fixture(); rmSync(resolve(f.source, 'Haru.moc3'));
    expect(() => f.run()).toThrow('Missing or unsafe model resource');
    expect(existsSync(f.output)).toBe(false);
  });

  it('rejects references outside the upload folder', () => {
    const f = fixture(); f.data.FileReferences.Moc = '../secret.moc3'; f.save();
    expect(() => f.run()).toThrow('Unsafe model reference');
    expect(existsSync(f.output)).toBe(false);
  });
});
