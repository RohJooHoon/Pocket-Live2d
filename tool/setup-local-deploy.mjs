// Create local deployment settings once; never overwrite an existing user file.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../.env.local', import.meta.url));
try {
  writeFileSync(target, readFileSync(new URL('../.env.example', import.meta.url)), { flag: 'wx' });
  console.log('Created .env.local with the public R2 URL and pocket-live2d Pages settings.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env.local already exists and was preserved. Compare it with .env.example before deploying.');
}
console.log('Next: prepare Cubism Web SDK, then npm run deploy:login, npm run deploy:check, npm run deploy:pages.');
