import { describe, expect, it, vi } from 'vitest';
import { characterIdFromPath, loadCharacter, modelSourceUrl, parseCharacterDescriptor } from '../src/characters/loadCharacter';
import type { CharacterConfig } from '../src/types';

const bundled: CharacterConfig = {
  id: 'mark', name: 'Mark-kun', model: 'Mark.model3.json', idleMotion: 'Idle', tapMotion: 'TapBody', shakeMotion: 'Shake',
};
const origin = 'https://pocket-live2d.pages.dev';
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

describe('URL-selected characters', () => {
  it('keeps the bundled root and unconfigured demo alias without network requests', async () => {
    const fetcher = vi.fn();
    for (const path of ['/', '/index.html', '/mark', '/mark/']) {
      expect(await loadCharacter(path, '', bundled, origin, fetcher)).toEqual({ character: bundled, modelDirectory: '/model/' });
    }
    expect((await loadCharacter('/', 'https://models.example.com/models/', bundled, origin, fetcher)).character).toEqual(bundled);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('matches a folder on R2 and keeps every model resource under that folder', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ model: 'Haru.model3.json', name: '하루', credit: 'Author', tapMotion: 'Touch' }));
    const selected = await loadCharacter('/haru/', 'https://models.example.com/models', bundled, origin, fetcher);
    expect(String(fetcher.mock.calls[0][0])).toBe('https://models.example.com/models/haru/character.json');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'omit' });
    expect(selected.modelDirectory + selected.character.model).toBe('https://models.example.com/models/haru/Haru.model3.json');
    expect(selected.character).toMatchObject({ id: 'haru', name: '하루', idleMotion: 'Idle', tapMotion: 'Touch', credit: 'Author' });
  });

  it('uses R2 even for the demo alias when a storage source is configured', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ model: 'NewMark.model3.json' }));
    const selected = await loadCharacter('/mark', 'https://models.example.com/models/', bundled, origin, fetcher);
    expect(selected.character.model).toBe('NewMark.model3.json');
  });

  it('can use same-origin prepared folders without R2', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ model: 'Haru.model3.json' }));
    const selected = await loadCharacter('/Haru_2', '', bundled, origin, fetcher);
    expect(String(fetcher.mock.calls[0][0])).toBe(origin + '/models/Haru_2/character.json');
    expect(selected.character.name).toBe('Haru_2');
  });

  it.each(['/a/b', '/..', '/%2e%2e', '/%2fharu', '//haru', '/haru.json', '/' + 'a'.repeat(65)])('rejects invalid route %s before fetching', async (path) => {
    const fetcher = vi.fn();
    await expect(loadCharacter(path, 'https://models.example.com/models/', bundled, origin, fetcher)).rejects.toThrow('주소');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects credentials, insecure external URLs, and signed or ambiguous prefixes', () => {
    for (const value of ['http://models.example.com/models/', 'https://key:secret@models.example.com/', 'https://models.example.com/?token=secret', 'https://models.example.com/#models', 'javascript:alert(1)']) {
      expect(() => modelSourceUrl(value, origin)).toThrow('저장소');
    }
    expect(modelSourceUrl('http://localhost:9000/models', origin).href).toBe('http://localhost:9000/models/');
  });

  it.each(['../Haru.model3.json', 'https://evil.example/Haru.model3.json', 'model/Haru.model3.json', 'Haru.model3.json#x', '%2e%2e.model3.json', 'Haru.moc3'])('rejects unsafe descriptor filename %s', (model) => {
    expect(() => parseCharacterDescriptor({ model }, 'haru')).toThrow('파일명');
  });

  it('does not fall back to another character when a path is missing or a response is invalid', async () => {
    await expect(loadCharacter('/haru', '', bundled, origin, async () => new Response('', { status: 404 }))).rejects.toThrow('찾지');
    await expect(loadCharacter('/haru', '', bundled, origin, async () => new Response('<html>SPA fallback</html>'))).rejects.toThrow('읽지');
    await expect(loadCharacter('/haru', '', bundled, origin, async () => { throw new TypeError('CORS'); })).rejects.toThrow('연결');
    expect(() => parseCharacterDescriptor({ model: 'Haru.model3.json', name: {} }, 'haru')).toThrow('정보');
    expect(characterIdFromPath('/haru/')).toBe('haru');
  });
});
