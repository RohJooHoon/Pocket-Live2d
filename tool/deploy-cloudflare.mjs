// Build and deploy one shared Pages site at /<character-id>. Model assets live in R2.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readSiteConfig, root } from './site-config.mjs';

function fail(message) { console.error(message); process.exit(1); }
const args = process.argv.slice(2);
let project, selectedId, dryRun = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dry-run') dryRun = true;
  else if (args[i] === '--project') {
    project = args[++i];
    if (!project || project.startsWith('--')) fail('--project requires a project name.');
  } else if (!args[i].startsWith('--') && !selectedId) selectedId = args[i];
  else fail(`Unknown argument: ${args[i]}. Use npm run deploy -- [--project <name>] [--dry-run].`);
}
const { env, modelBase, characters, defaultId } = readSiteConfig();
const characterId = selectedId ?? defaultId;
const character = characters.find(({ id }) => id === characterId);
if (!character) fail(`Unknown character: ${characterId}`);
project ??= env.PAGES_PROJECT ?? character.pagesProject ?? 'pocket-live2d';
if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(project)) fail('Pages project name must use lowercase letters, numbers and dashes.');
if (Number(process.versions.node.split('.')[0]) < 22) fail('Wrangler needs Node.js 22 or newer.');
if (!modelBase.startsWith('https://')) fail('Set VITE_MODEL_BASE_URL to the public HTTPS R2 address in .env.local.');
const sdkReady = [
  'vendor/cubism/Core/live2dcubismcore.min.js',
  'vendor/cubism/Framework/src/live2dcubismframework.ts',
  'vendor/cubism/Framework/Shaders/WebGL',
].every((file) => existsSync(resolve(root, file)));
if (!sdkReady && !dryRun) fail('Prepare Cubism SDK for Web 5-r.5 before deploying: python3 tool/prepare_cubism_web.py <SDK path>');
function run(command, commandArgs, capture = false) {
  // npm scripts expose their JS entry point. Invoke it through Node on Windows
  // so local checkout paths with spaces do not go through cmd.exe quoting.
  if (process.platform === 'win32' && process.env.npm_execpath) {
    const entry = command === 'npm' ? process.env.npm_execpath
      : command === 'npx' ? resolve(dirname(process.env.npm_execpath), 'npx-cli.js') : null;
    if (entry && existsSync(entry)) {
      commandArgs = [entry, ...commandArgs];
      command = process.execPath;
    }
  }
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    shell: process.platform === 'win32' && command !== process.execPath,
    env: { ...process.env, ...env, CHARACTER: characterId } });
  if (capture) { process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); }
  return result;
}
if (!dryRun && run('npm', ['run', 'typecheck:sdk']).status !== 0) fail('SDK renderer typecheck failed; no deployment was performed.');
if (run('npm', ['run', 'build']).status !== 0) fail('Build failed.');
const out = resolve(root, 'dist', characterId);
if (['model', 'models', 'characters'].some((name) => existsSync(resolve(out, name)))) fail('R2 build unexpectedly contains local models; refusing to deploy.');
if (!dryRun) {
  if (!existsSync(resolve(out, 'cubism/live2dcubismcore.min.js'))) fail('Build is missing Cubism Core.');
  if (run('node', ['tool/verify-r2.mjs', '--origin', `https://${project}.pages.dev`]).status !== 0) {
    fail('R2 assets or CORS are not ready; no Pages deployment was performed.');
  }
}
const create = ['--yes', 'wrangler@4', 'pages', 'project', 'create', project, '--production-branch=main'];
const deploy = ['--yes', 'wrangler@4', 'pages', 'deploy', out, `--project-name=${project}`, '--branch=main', '--commit-dirty=true'];
if (dryRun) {
  if (!sdkReady) console.log('SDK is absent: this dry-run build shows the SDK notice. Actual deployment requires the SDK.');
  console.log('Dry run; R2 readiness has not been checked and no remote writes performed.');
  console.log(JSON.stringify({ command: 'npx', args: create }));
  console.log(JSON.stringify({ command: 'npx', args: deploy }));
} else {
  const created = run('npx', create, true);
  if (created.status !== 0 && !/already exists/i.test(`${created.stdout ?? ''}${created.stderr ?? ''}`)) fail('Could not create Pages project; check Cloudflare authentication and permissions.');
  if (run('npx', deploy).status !== 0) fail('Pages upload failed.');
}
console.log(`${dryRun ? 'Planned' : 'Deployed'}: https://${project}.pages.dev/${characterId}`);
