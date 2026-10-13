import { describe, expect, it } from 'vitest';

import type { CompositionDef, Node } from '@craftkit/builder-schema';

import { TEMPLATE_COMPOSITIONS } from './index';

/*
  Page rhythm, for every template in both languages: the difference between
  a page that was designed and sections that were stacked. Each rule is one a
  reviewer flagged on the first library (monotone grounds, the same layout
  twice in a row, a page that ends without asking for anything) and is cheap
  to keep true as data. How it looks at 390–1440 px stays the capture's job.
*/

/** Chrome around the content: the date bar, the header and the footer. */
const CHROME = new Set(['announcementBar', 'pageHeader', 'pageFooter']);

/** Sections that end a page by asking the visitor to act. */
const CLOSERS = new Set(['promoBanner', 'formSection', 'contact', 'newsletter']);

const sectionNodes = (composition: CompositionDef): Node[] =>
  (composition.nodes[composition.rootId]?.slots?.['default'] ?? []).flatMap((id) => {
    const node = composition.nodes[id];
    return node === undefined ? [] : [node];
  });

/** The content between the header and the footer, in order. */
const contentOf = (composition: CompositionDef): Node[] =>
  sectionNodes(composition).filter((node) => !CHROME.has(node.type));

const groundOf = (node: Node | undefined): string => {
  const tone = node?.props['tone'];
  return typeof tone === 'string' ? tone : 'none';
};

const describeSections = (nodes: readonly Node[]) =>
  nodes.map((node) => `${node.type}:${groundOf(node)}`).join(' → ');

describe('template rhythm (every template, both languages)', () => {
  it('covers the whole library', () => {
    expect(TEMPLATE_COMPOSITIONS.length).toBeGreaterThanOrEqual(30);
  });

  it('opens with the hero straight after the header', () => {
    for (const composition of TEMPLATE_COMPOSITIONS) {
      expect(contentOf(composition)[0]?.type, composition.id).toBe('hero');
    }
  });

  it('gives every page at least one dark band', () => {
    for (const composition of TEMPLATE_COMPOSITIONS) {
      const content = contentOf(composition);
      expect(
        content.some((node) => groundOf(node) === 'dark'),
        `${composition.id}: ${describeSections(content)}`,
      ).toBe(true);
    }
  });

  it('never runs three sections on the same ground', () => {
    for (const composition of TEMPLATE_COMPOSITIONS) {
      const grounds = contentOf(composition).map(groundOf);
      grounds.forEach((ground, index) => {
        if (index < 2) return;
        expect(
          ground === grounds[index - 1] && ground === grounds[index - 2],
          `${composition.id}: ${grounds.join(' → ')}`,
        ).toBe(false);
      });
    }
  });

  it('never repeats a layout back to back', () => {
    for (const composition of TEMPLATE_COMPOSITIONS) {
      const types = contentOf(composition).map((node) => node.type);
      types.forEach((type, index) => {
        expect(type === types[index - 1], `${composition.id}: ${types.join(' → ')}`).toBe(false);
      });
    }
  });

  it('closes with a call to action that stands apart from the footer', () => {
    for (const composition of TEMPLATE_COMPOSITIONS) {
      const content = contentOf(composition);
      const last = content.at(-1);
      const footer = sectionNodes(composition).at(-1);
      expect(CLOSERS.has(last?.type ?? ''), `${composition.id}: ${last?.type ?? '?'}`).toBe(true);
      expect(groundOf(last), `${composition.id}: ${describeSections(content)}`).not.toBe(
        groundOf(footer),
      );
    }
  });

  it('spaces every section on the same two-step rhythm', () => {
    for (const composition of TEMPLATE_COMPOSITIONS) {
      for (const node of contentOf(composition)) {
        expect(['md', 'lg'], `${composition.id}/${node.id}`).toContain(node.props['spacing']);
      }
    }
  });
});
