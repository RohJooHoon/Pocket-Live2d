import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, type Plugin } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));
const characterId = process.env.CHARACTER ?? 'mark';
const characterFile = resolve(root, 'characters', characterId, 'character.json');
if (!existsSync(characterFile)) {
  throw new Error(`Unknown character "${characterId}": ${characterFile} is missing.`);
}
const character = JSON.parse(readFileSync(characterFile, 'utf8'));

// The licensed SDK is never committed; tool/prepare_cubism_web.py stages it locally.
const sdkReady = [
  'vendor/cubism/Core/live2dcubismcore.min.js',
  'vendor/cubism/Framework/src/live2dcubismframework.ts',
  'vendor/cubism/Framework/Shaders/WebGL',
].every((path) => existsSync(resolve(root, path)));

/** Loads Cubism Core as a classic script before the app module, as the SDK requires. */
function cubismCoreScript(): Plugin {
  return {
    name: 'cubism-core-script',
    transformIndexHtml(html) {
      if (!sdkReady) return html;
      return html.replace(
        '<!-- cubism-core -->',
        '<script src="./cubism/live2dcubismcore.min.js"></script>',
      );
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: resolve(root, '.public', characterId),
  // Phones only allow motion sensors on secure pages, so `npm run dev:https`
  // serves a self-signed https address for testing over Wi-Fi.
  plugins: [cubismCoreScript(), ...(mode === 'https' ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@cubism-adapter': resolve(
        root,
        sdkReady ? 'src/live2d/cubism/adapter.ts' : 'src/live2d/unavailable.ts',
      ),
      '@framework': resolve(root, 'vendor/cubism/Framework/src'),
    },
  },
  define: {
    __CHARACTER__: JSON.stringify(character),
  },
  build: {
    outDir: resolve(root, 'dist', characterId),
    emptyOutDir: true,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
}));
