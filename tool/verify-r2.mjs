// Verify public access, CORS and exact bytes before publishing a site that depends on R2.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as http from 'node:http';
import { createUploadPlan } from './r2-plan.mjs';
import { readSiteConfig, root } from './site-config.mjs';

// Node 24 supports the cloud's HTTP(S) proxy for global fetch through this API.
// Keep certificate verification enabled; ordinary direct connections still work.
if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv();

const { characters, modelBase, assetLayout, env } = readSiteConfig();
if (!modelBase) throw new Error('Set VITE_MODEL_BASE_URL to the public R2 address.');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--origin')) throw new Error('Usage: npm run verify:models -- [--origin https://<project>.pages.dev]');
const origin = new URL(args[1] ?? `https://${env.PAGES_PROJECT ?? 'motionmate'}.pages.dev`).origin;
const plan = createUploadPlan(root, characters, assetLayout);
const digest = (data) => createHash('sha256').update(data).digest('hex');
for (const { file, key, contentType } of plan) {
  const url = `${new URL(modelBase).origin}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const response = await fetch(url, { headers: { Origin: origin }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`R2 resource unavailable: ${key} (HTTP ${response.status})`);
  const allowed = response.headers.get('access-control-allow-origin');
  if (allowed !== '*' && allowed !== origin) throw new Error(`R2 CORS does not allow ${origin}: ${key}`);
  if (response.headers.get('content-type')?.split(';')[0] !== contentType) throw new Error(`Incorrect R2 Content-Type for ${key}: expected ${contentType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== digest(readFileSync(file))) throw new Error(`R2 asset differs from local file: ${key}`);
  console.log(`PASS ${key}: public access, CORS, Content-Type, SHA-256`);
}
console.log(`Verified ${plan.length} R2 objects for ${origin}.`);
