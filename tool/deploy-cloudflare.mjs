// Builds one character site with the locally staged Cubism SDK and uploads it
// to Cloudflare Pages (Direct Upload), so Cubism Core never goes through git.
//
//   npm run deploy -- <character-id> [--dry-run]
//
// The Pages project name is `pagesProject` in characters/<id>/character.json,
// or pocket-live2d-<id> when unset. Mark uses pocket-live2d for the main website.
// Log in once with `npx wrangler login`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WRANGLER = 'wrangler@4';
const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const characterId = args.find((arg) => !arg.startsWith('--')) ?? process.env.CHARACTER ?? 'mark';

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  console.log(`\n> ${command} ${commandArgs.join(' ')}`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ...options.env },
  });
  if (options.capture) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  return result;
}

const configPath = resolve(root, 'characters', characterId, 'character.json');
if (!existsSync(configPath)) fail(`Unknown character "${characterId}" (${configPath} is missing).`);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const project = config.pagesProject ?? `pocket-live2d-${characterId}`;
if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(project)) {
  fail(`Pages project name "${project}" must use lowercase letters, numbers and dashes.`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22) fail(`Wrangler needs Node.js 22 or newer (current ${process.versions.node}).`);

if (!existsSync(resolve(root, 'vendor/cubism/Core/live2dcubismcore.min.js'))) {
  fail(
    'The Cubism SDK for Web is not staged, so the site would only show an SDK notice.\n' +
      'Run: python3 tool/prepare_cubism_web.py <path to CubismSdkForWeb-5-r.5>',
  );
}

if (run('npm', ['run', 'build'], { env: { CHARACTER: characterId } }).status !== 0) fail('Build failed.');

const out = resolve(root, 'dist', characterId);
if (!existsSync(resolve(out, 'cubism/live2dcubismcore.min.js'))) {
  fail(`The build in ${out} does not contain Cubism Core; refusing to deploy it.`);
}

const create = ['--yes', WRANGLER, 'pages', 'project', 'create', project, '--production-branch=main'];
const deploy = ['--yes', WRANGLER, 'pages', 'deploy', out, `--project-name=${project}`, '--branch=main', '--commit-dirty=true'];

if (dryRun) {
  console.log(`\nDry run. Would upload ${out} to Cloudflare Pages project "${project}":`);
  console.log(`  npx ${create.join(' ')}`);
  console.log(`  npx ${deploy.join(' ')}`);
  process.exit(0);
}

// Creating an existing project fails harmlessly; anything else is a real error.
const created = run('npx', create, { capture: true });
const createOutput = `${created.stdout ?? ''}${created.stderr ?? ''}`;
if (created.status !== 0 && !/already exists/i.test(createOutput)) {
  fail('Could not create the Pages project. Log in first with: npx wrangler login');
}

if (run('npx', deploy).status !== 0) fail('Upload failed.');
console.log(`\nDeployed. Production URL: https://${project}.pages.dev`);
console.log('Add a custom domain in the Cloudflare dashboard: Workers & Pages → project → Custom domains.');
