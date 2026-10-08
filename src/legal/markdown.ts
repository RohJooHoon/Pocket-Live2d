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

export interface LegalListItem {
  text: string;
  children: string[];
}

export type LegalNode =
  | { type: 'heading1' | 'heading2' | 'paragraph'; text: string }
  | { type: 'list'; items: LegalListItem[] };

/**
 * Groups consecutive bullets into lists, with sub-bullets nested under the
 * preceding bullet. A sub-bullet without a parent becomes a top-level item.
 */
export function groupLegalBlocks(blocks: readonly LegalBlock[]): LegalNode[] {
  const nodes: LegalNode[] = [];
  let list: LegalListItem[] | null = null;

  for (const block of blocks) {
    if (block.type === 'bullet' || block.type === 'subBullet') {
      if (!list) {
        list = [];
        nodes.push({ type: 'list', items: list });
      }
      const parent = list.at(-1);
      if (block.type === 'subBullet' && parent) parent.children.push(block.text);
      else list.push({ text: block.text, children: [] });
      continue;
    }
    list = null;
    nodes.push({ type: block.type, text: block.text });
  }
  return nodes;
}
