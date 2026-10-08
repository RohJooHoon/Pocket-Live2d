// Explicit remote upload. --dry-run validates and prints the plan without contacting Cloudflare.
import { spawnSync } from 'node:child_process';
import { readSiteConfig, root } from './site-config.mjs';
import { createUploadPlan } from './r2-plan.mjs';

function fail(message) { console.error(message); process.exit(1); }
const args = process.argv.slice(2);
let bucket, selectedId, dryRun = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dry-run') dryRun = true;
  else if (args[i] === '--bucket') {
    bucket = args[++i];
    if (!bucket || bucket.startsWith('--')) fail('--bucket requires a bucket name.');
  } else if (!args[i].startsWith('--') && !selectedId) selectedId = args[i];
  else fail(`Unknown argument: ${args[i]}`);
}
const { characters, assetLayout, env } = readSiteConfig();
bucket ??= env.R2_BUCKET;
if (!bucket || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) fail('Set R2_BUCKET in .env.local or pass --bucket <existing-bucket-name>.');
const selected = selectedId ? characters.filter(({ id }) => id === selectedId) : characters;
if (!selected.length) fail(`Unknown character: ${selectedId}`);
const validation = spawnSync('python3', ['tool/validate_model_assets.py'], { cwd: root, stdio: 'inherit' });
if (validation.status !== 0) fail('Model validation failed; nothing was uploaded.');
const plan = createUploadPlan(root, selected, assetLayout);
console.log(`${dryRun ? 'Dry run:' : 'Uploading'} ${plan.length} objects to R2 bucket ${bucket}. Existing objects with these keys will be replaced.`);
for (const { file, key, contentType } of plan) {
  const command = ['--yes', 'wrangler@4', 'r2', 'object', 'put', `${bucket}/${key}`,
    '--remote', '--file', file, '--content-type', contentType, '--cache-control', key.endsWith('/character.json') ? 'no-cache' : 'public, max-age=3600'];
  if (dryRun) console.log(JSON.stringify({ command: 'npx', args: command }));
  else {
    const result = spawnSync('npx', command, { cwd: root, stdio: 'inherit',
      shell: process.platform === 'win32', env: { ...process.env, ...env } });
    if (result.status !== 0) fail(`Upload failed for ${key}; fix the reported error and rerun. No Pages deployment was performed.`);
  }
}
console.log(dryRun ? 'No remote writes performed.' : 'Upload complete. Configure public access and CORS before deploying Pages.');
