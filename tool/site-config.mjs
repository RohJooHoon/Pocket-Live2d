import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

export const root = fileURLToPath(new URL('../', import.meta.url));

export function readSiteConfig(mode = 'production') {
  const env = { ...loadEnv(mode, root, ''), ...process.env };
  const characters = readdirSync(resolve(root, 'characters'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name: id }) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)) throw new Error(`Invalid character id: ${id}`);
      const character = JSON.parse(readFileSync(resolve(root, 'characters', id, 'character.json'), 'utf8'));
      if (character.id !== id) throw new Error(`Character id must match folder: ${id}`);
      for (const key of ['name', 'model', 'idleMotion', 'tapMotion', 'shakeMotion']) {
        if (typeof character[key] !== 'string' || (['name', 'model'].includes(key) && !character[key].trim())) {
          throw new Error(`Missing ${key} for character ${id}`);
        }
      }
      if (!character.model.endsWith('.model3.json') || character.model.includes('/') || character.model.includes('\\') || character.model.startsWith('/') ||
          character.model.split('/').some((part) => !part || part === '..' || part === '.') ||
          /[:?#]/.test(character.model)) throw new Error(`Unsafe model filename for ${id}`);
      return character;
    });
  const defaultId = env.CHARACTER ?? 'mark';
  if (!characters.some(({ id }) => id === defaultId)) throw new Error(`Unknown default character: ${defaultId}`);
  let modelBase = env.VITE_MODEL_BASE_URL?.trim() ?? '';
  if (modelBase) {
    const url = new URL(modelBase);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash) {
      throw new Error('VITE_MODEL_BASE_URL must be a public HTTPS URL without credentials, query or fragment (HTTP loopback allowed for testing).');
    }
    modelBase = url.href.replace(/\/+$/, '');
  }
  const path = modelBase ? new URL(modelBase).pathname.replace(/^\/+|\/+$/g, '') : '';
  const assetLayout = path ? { prefix: path, nested: false } : { prefix: 'characters', nested: true };
  return { characters, defaultId, modelBase, assetLayout, env };
}
