import { readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';

const mimeTypes = {
  '.json': 'application/json', '.moc3': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

/** Upload only the model manifest and resources it references; never SDK or unrelated files. */
export function createUploadPlan(root, characters, layout = { prefix: 'characters', nested: true }) {
  const plan = [];
  for (const character of characters) {
    const directory = realpathSync(resolve(root, 'characters', character.id, 'model'));
    const manifest = JSON.parse(readFileSync(resolve(directory, character.model), 'utf8'));
    const refs = manifest.FileReferences;
    const resources = [refs.Moc, ...refs.Textures];
    for (const key of ['Physics', 'Pose', 'UserData', 'DisplayInfo']) {
      if (refs[key]) resources.push(refs[key]);
    }
    for (const entry of refs.Expressions ?? []) resources.push(entry.File);
    for (const motions of Object.values(refs.Motions ?? {})) {
      for (const entry of motions) {
        resources.push(entry.File);
        if (entry.Sound) resources.push(entry.Sound);
      }
    }
    // Publish the manifest last, after the assets it refers to exist.
    for (const name of [...new Set(resources), character.model]) {
      if (typeof name !== 'string' || !name || name.includes('\\') || name.startsWith('/') ||
          name.split('/').some((part) => !part || part === '..' || part === '.') || /[:?#]/.test(name)) {
        throw new Error(`Unsafe model reference for ${character.id}: ${name}`);
      }
      const file = realpathSync(resolve(directory, name));
      const rel = relative(directory, file);
      if (rel.startsWith(`..${sep}`) || rel === '..' || !statSync(file).isFile() || !statSync(file).size) {
        throw new Error(`Missing, empty or external model resource: ${name}`);
      }
      const contentType = mimeTypes[extname(name).toLowerCase()];
      if (!contentType) throw new Error(`Unsupported model asset type: ${name}`);
      const folder = `${layout.prefix}/${character.id}/${layout.nested ? 'model/' : ''}`;
      plan.push({ file, key: folder + name, contentType });
    }
    // Runtime path selection reads this descriptor; publish it after all model assets.
    const file = resolve(root, 'characters', character.id, 'character.json');
    const folder = `${layout.prefix}/${character.id}/${layout.nested ? 'model/' : ''}`;
    plan.push({ file, key: folder + 'character.json', contentType: 'application/json' });
  }
  return plan;
}
