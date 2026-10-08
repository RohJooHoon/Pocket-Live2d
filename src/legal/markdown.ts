export type LegalBlockType = 'heading1' | 'heading2' | 'bullet' | 'subBullet' | 'paragraph';

export interface LegalBlock {
  type: LegalBlockType;
  text: string;
}

/**
 * Parses the small Markdown subset used by the legal documents:
 * `#`/`##` headings, `-` bullets, two-space `-` sub-bullets and plain lines.
 */
export function parseLegalMarkdown(source: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    if (line.startsWith('## ')) blocks.push({ type: 'heading2', text: line.slice(3).trim() });
    else if (line.startsWith('# ')) blocks.push({ type: 'heading1', text: line.slice(2).trim() });
    else if (line.startsWith('  - ')) blocks.push({ type: 'subBullet', text: line.slice(4).trim() });
    else if (line.startsWith('- ')) blocks.push({ type: 'bullet', text: line.slice(2).trim() });
    else blocks.push({ type: 'paragraph', text: line.trim() });
  }
  return blocks;
}

/** Renders parsed blocks with text nodes only, so document text is never parsed as HTML. */
export function renderLegalBlocks(blocks: LegalBlock[], doc: Document = document): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  let list: HTMLUListElement | null = null;
  let subList: HTMLUListElement | null = null;

  for (const block of blocks) {
    if (block.type === 'bullet' || block.type === 'subBullet') {
      if (!list) {
        list = doc.createElement('ul');
        fragment.append(list);
      }
      const item = doc.createElement('li');
      item.textContent = block.text;
      const parentItem = list.lastElementChild;
      if (block.type === 'bullet' || !parentItem) {
        list.append(item);
        subList = null;
      } else {
        if (!subList) {
          subList = doc.createElement('ul');
          parentItem.append(subList);
        }
        subList.append(item);
      }
      continue;
    }

    list = null;
    subList = null;
    const element = doc.createElement(
      block.type === 'heading1' ? 'h2' : block.type === 'heading2' ? 'h3' : 'p',
    );
    element.textContent = block.text;
    fragment.append(element);
  }
  return fragment;
}
