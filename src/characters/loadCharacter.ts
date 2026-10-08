import type { CharacterConfig } from '../types';

export interface SelectedCharacter {
  character: CharacterConfig;
  modelDirectory: string;
}

/** Each URL selects one folder. No bucket listing or client-side credentials. */
export function characterIdFromPath(pathname: string): string | null {
  if (pathname === '/' || pathname === '/index.html') return null;
  const match = /^\/([A-Za-z0-9][A-Za-z0-9_-]{0,63})\/?$/.exec(pathname);
  if (!match) throw new Error('캐릭터 주소가 올바르지 않아요.');
  return match[1];
}

export function modelSourceUrl(source: string, origin: string): URL {
  const url = new URL(source || '/models/', origin);
  const localHttp = url.protocol === 'http:' &&
    (url.origin === origin || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password || url.search || url.hash) {
    throw new Error('모델 저장소 주소 설정을 확인해 주세요.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  // A bare R2 public URL uses the uploaded characters/<id>/model/ layout.
  // An explicit prefix (e.g. /models/) keeps the existing flat-folder layout.
  if (source && url.pathname === '/') url.pathname = '/characters/';
  return url;
}

export function parseCharacterDescriptor(value: unknown, id: string): CharacterConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('캐릭터 정보 파일을 확인해 주세요.');
  const data = value as Record<string, unknown>;
  const model = data.model;
  // The descriptor lives alongside model3.json, not an arbitrary remote URL.
  if (typeof model !== 'string' || !model.endsWith('.model3.json') ||
    /[\/\\?#:%\x00-\x1f]/.test(model) || model === '.model3.json') {
    throw new Error('캐릭터의 모델 파일명을 확인해 주세요.');
  }
  for (const key of ['name', 'credit', 'idleMotion', 'tapMotion', 'shakeMotion']) {
    if (data[key] !== undefined && typeof data[key] !== 'string') throw new Error('캐릭터 정보 파일을 확인해 주세요.');
  }
  return {
    id, model, name: (data.name as string | undefined)?.trim() || id,
    idleMotion: (data.idleMotion as string | undefined) ?? 'Idle',
    tapMotion: (data.tapMotion as string | undefined) ?? 'TapBody',
    shakeMotion: (data.shakeMotion as string | undefined) ?? 'Shake',
    credit: data.credit as string | undefined,
  };
}

export async function loadCharacter(
  pathname: string, source: string, bundled: CharacterConfig, origin: string,
  fetcher: typeof fetch = fetch,
): Promise<SelectedCharacter> {
  const id = characterIdFromPath(pathname);
  if (!source && (id == null || id === bundled.id)) {
    return { character: bundled, modelDirectory: '/model/' };
  }
  const bareSource = source && new URL(source, origin).pathname === '/';
  const selectedId = id ?? bundled.id;
  const directory = new URL(`${selectedId}/${bareSource ? 'model/' : ''}`, modelSourceUrl(source, origin));
  let response: Response;
  try {
    response = await fetcher(new URL('character.json', directory), {
      cache: 'no-store', signal: AbortSignal.timeout(15000), credentials: 'omit',
    });
  } catch {
    throw new Error('캐릭터 저장소에 연결하지 못했어요. 연결 상태를 확인해 주세요.');
  }
  if (response.status === 404) throw new Error('해당 캐릭터를 찾지 못했어요. 주소와 파일 업로드를 확인해 주세요.');
  if (!response.ok) throw new Error('캐릭터 정보를 불러오지 못했어요.');
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error('캐릭터 정보 파일을 읽지 못했어요.'); }
  return { character: parseCharacterDescriptor(data, selectedId), modelDirectory: directory.href };
}
