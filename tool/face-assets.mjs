// Self-host the runtime and official model: visitors make no CDN requests.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as http from 'node:http';

if (typeof http.setGlobalProxyFromEnv === 'function') http.setGlobalProxyFromEnv();

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MODEL_HASH = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';

export async function stageFaceAssets(root, publicDir) {
  const cache = resolve(root, 'vendor/mediapipe/face_landmarker.task');
  let model = existsSync(cache) ? readFileSync(cache) : null;
  if (!model || createHash('sha256').update(model).digest('hex') !== MODEL_HASH) {
    console.log('Downloading the official MediaPipe Face Landmarker model (3.8 MB)…');
    const response = await fetch(MODEL_URL, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Face model download failed (${response.status})`);
    model = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(model).digest('hex') !== MODEL_HASH) {
      throw new Error('Face model checksum mismatch; refusing to stage it.');
    }
    mkdirSync(resolve(root, 'vendor/mediapipe'), { recursive: true });
    writeFileSync(cache, model);
  }
  const out = resolve(publicDir, 'face');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'face_landmarker.task'), model);
  cpSync(resolve(root, 'node_modules/@mediapipe/tasks-vision/vision_bundle.js'), resolve(out, 'vision_bundle.js'));
  cpSync(resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm'), resolve(out, 'wasm'), { recursive: true });
  cpSync(resolve(root, 'legal/mediapipe_notice.txt'), resolve(out, 'NOTICE.txt'));
  cpSync(resolve(root, 'legal/mediapipe_license.txt'), resolve(out, 'LICENSE.txt'));
}
