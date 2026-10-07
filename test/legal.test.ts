import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGAL_CONSENT_STORAGE_KEY, LEGAL_CONSENT_VERSION, SERVICE_NAME } from '../src/config';
import { hasAcceptedCurrentTerms, recordAcceptance, type KeyValueStore } from '../src/legal/consent';
import { parseLegalMarkdown } from '../src/legal/markdown';

const terms = readFileSync('legal/terms_of_service.md', 'utf8');
const privacy = readFileSync('legal/privacy_policy.md', 'utf8');

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('parseLegalMarkdown', () => {
  it('maps headings, bullets, sub-bullets and plain lines', () => {
    const blocks = parseLegalMarkdown('# Title\n\nIntro line\n## Section\n- item\n  - detail\n');
    expect(blocks).toEqual([
      { type: 'heading1', text: 'Title' },
      { type: 'paragraph', text: 'Intro line' },
      { type: 'heading2', text: 'Section' },
      { type: 'bullet', text: 'item' },
      { type: 'subBullet', text: 'detail' },
    ]);
  });
});

describe('legal documents', () => {
  it.each([
    ['terms', terms],
    ['privacy', privacy],
  ])('%s is titled with the service name and never with the Live2D trademark', (_, source) => {
    const [title] = parseLegalMarkdown(source);
    expect(title).toEqual({ type: 'heading1', text: expect.stringMatching(new RegExp(`^${SERVICE_NAME} `)) });
    expect(title.text).not.toContain('Live2D');
  });

  it('terms protect the bundled Cubism Core and character data', () => {
    expect(terms).toContain('Live2D Cubism Core');
    expect(terms).toContain('리버스 엔지니어링');
    expect(terms).toContain('웹 브라우저가 내려받은 파일');
  });

  it('privacy policy matches what the page and its hosting do', () => {
    expect(privacy).toContain('카메라와 마이크를 사용하지 않습니다');
    expect(privacy).toContain('쿠키는 사용하지 않습니다');
    expect(privacy).toContain('접속 기록');
    expect(privacy).toContain('개인정보의 국외 이전');
    expect(privacy).toContain('Cloudflare, Inc.');
  });

  it('only uses Markdown the in-page renderer supports', () => {
    for (const source of [terms, privacy]) {
      expect(source).not.toMatch(/\*\*|\]\(|`|\|/);
    }
  });
});

describe('consent storage', () => {
  it('requires acceptance of the current version', () => {
    expect(hasAcceptedCurrentTerms(memoryStore())).toBe(false);
    expect(hasAcceptedCurrentTerms(memoryStore({ [LEGAL_CONSENT_STORAGE_KEY]: 'old' }))).toBe(false);
    expect(
      hasAcceptedCurrentTerms(memoryStore({ [LEGAL_CONSENT_STORAGE_KEY]: LEGAL_CONSENT_VERSION })),
    ).toBe(true);
  });

  it('records acceptance and survives blocked storage', () => {
    const store = memoryStore();
    recordAcceptance(store);
    expect(store.data[LEGAL_CONSENT_STORAGE_KEY]).toBe(LEGAL_CONSENT_VERSION);

    const blocked: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => recordAcceptance(blocked)).not.toThrow();
    expect(hasAcceptedCurrentTerms(blocked)).toBe(false);
    expect(hasAcceptedCurrentTerms(null)).toBe(false);
  });
});
