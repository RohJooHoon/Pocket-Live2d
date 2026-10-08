import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import LegalDocument from '../src/components/LegalDocument.vue';
import { groupLegalBlocks, parseLegalMarkdown } from '../src/legal/markdown';

function render(source: string): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(LegalDocument, { source }) }));
}

describe('groupLegalBlocks', () => {
  it('nests sub-bullets under the preceding bullet and splits lists at other blocks', () => {
    const nodes = groupLegalBlocks(parseLegalMarkdown('# T\n- a\n  - a1\n  - a2\n- b\nText\n- c\n'));
    expect(nodes).toEqual([
      { type: 'heading1', text: 'T' },
      { type: 'list', items: [{ text: 'a', children: ['a1', 'a2'] }, { text: 'b', children: [] }] },
      { type: 'paragraph', text: 'Text' },
      { type: 'list', items: [{ text: 'c', children: [] }] },
    ]);
  });

  it('keeps a sub-bullet without a parent as a top-level item', () => {
    expect(groupLegalBlocks(parseLegalMarkdown('  - orphan\n'))).toEqual([
      { type: 'list', items: [{ text: 'orphan', children: [] }] },
    ]);
  });
});

describe('LegalDocument', () => {
  it('renders headings, paragraphs and nested lists', async () => {
    const html = (await render('# Title\n## Section\n- item\n  - detail\nPlain\n')).replace(/<!--.*?-->/g, '');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<h3>Section</h3>');
    expect(html).toContain('<ul><li>item <ul><li>detail</li></ul></li></ul>');
    expect(html).toContain('<p>Plain</p>');
  });

  it('never turns document text into markup', async () => {
    const html = await render('<img src=x onerror=alert(1)>\n- <b>bold</b>\n');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
