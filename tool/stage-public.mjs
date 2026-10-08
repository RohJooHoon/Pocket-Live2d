// Assembles the static files for one character site into .public/<id>/.
// Vite serves and copies that folder, so dev and build see the same layout:
//   model/                      characters/<id>/model/
//   cubism/live2dcubismcore.min.js, cubism/shaders/WebGL/   (only when the SDK is staged)
//   _headers                    deploy/cloudflare/_headers (Cloudflare Pages)
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { stageFaceAssets } from './face-assets.mjs';
import { readSiteConfig } from './site-config.mjs';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const { defaultId: characterId, modelBase } = readSiteConfig(modeIndex < 0 ? 'development' : args[modeIndex + 1]);
const characterDir = resolve(root, 'characters', characterId);

const out = resolve(root, '.public', characterId);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
if (!modelBase) {
  cpSync(resolve(characterDir, 'model'), resolve(out, 'model'), {
    recursive: true,
    filter: (source) => !source.endsWith('README.md'),
  });
}
cpSync(resolve(root, 'deploy/cloudflare/_headers'), resolve(out, '_headers'));
// Optional prepared folders support same-origin /<slug> testing without R2.
const preparedModels = resolve(root, '.model-uploads/models');
if (!modelBase && existsSync(preparedModels)) cpSync(preparedModels, resolve(out, 'models'), { recursive: true });
await stageFaceAssets(root, out);

const core = resolve(root, 'vendor/cubism/Core/live2dcubismcore.min.js');
const shaders = resolve(root, 'vendor/cubism/Framework/Shaders/WebGL');
if (existsSync(core) && existsSync(shaders)) {
  cpSync(core, resolve(out, 'cubism/live2dcubismcore.min.js'));
  cpSync(shaders, resolve(out, 'cubism/shaders/WebGL'), { recursive: true });
  console.log(`Staged ${characterId} with Cubism SDK for Web.`);
} else {
  console.log(`Staged ${characterId} without the Cubism SDK (the page will show an SDK notice).`);
}

console.log(modelBase ? `Models load from R2 (${modelBase}); no models bundled in Pages.` : 'Using local model assets.');
