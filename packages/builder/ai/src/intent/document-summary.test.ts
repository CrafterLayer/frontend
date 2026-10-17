import { emptyDocument, type BuilderDocument, type Node } from '@craftkit/builder-schema';
import { describe, expect, it } from 'vitest';

import { summarizeDocumentForIntent } from './document-summary';

/** A page whose root holds `children`, in order. */
function page(children: readonly Node[], extra: readonly Node[] = []): BuilderDocument {
  const nodes: Record<string, Node> = {
    root: {
      id: 'root',
      type: 'page',
      props: {},
      ...(children.length === 0 ? {} : { slots: { default: children.map((node) => node.id) } }),
    },
  };
  for (const node of [...children, ...extra]) nodes[node.id] = node;
  return { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes };
}

/** The skeleton build-scaffold lays: an empty labelled region with its heading only. */
function placeholder(id: string, label: string, heading = label): Node {
  return {
    id,
    type: 'customCode',
    props: {
      label,
      tree: {
        kind: 'root',
        children: [
          {
            kind: 'element',
            tag: 'section',
            className: 'py-16 md:py-24',
            children: [
              {
                kind: 'element',
                tag: 'div',
                className: 'mx-auto max-w-6xl px-4 md:px-8',
                children: [{ kind: 'element', tag: 'h2', text: heading }],
              },
            ],
          },
        ],
      },
    },
  };
}

/** The same region after a writer filled it. */
function filled(id: string, label: string): Node {
  return {
    id,
    type: 'customCode',
    props: {
      label,
      tree: {
        kind: 'root',
        children: [
          {
            kind: 'element',
            tag: 'section',
            children: [
              { kind: 'element', tag: 'h2', text: label },
              { kind: 'element', tag: 'p', text: 'Fresh bread every morning.' },
              {
                kind: 'element',
                tag: 'a',
                text: 'Order',
                attributes: { href: '#order' },
              },
            ],
          },
        ],
      },
    },
  };
}

describe('summarizeDocumentForIntent', () => {
  it('reads a fresh page as empty', () => {
    expect(summarizeDocumentForIntent(emptyDocument('site', 'rtl'))).toEqual({
      nodeCount: 0,
      placeholderOnly: false,
      sectionLabels: [],
    });
  });

  it('reads an unfilled skeleton as placeholders only, keeping its labels in page order', () => {
    const document = page([
      placeholder('a', 'Hero'),
      placeholder('b', 'Menu'),
      placeholder('c', 'Contact'),
    ]);
    expect(summarizeDocumentForIntent(document)).toEqual({
      nodeCount: 3,
      placeholderOnly: true,
      sectionLabels: ['Hero', 'Menu', 'Contact'],
    });
  });

  it('counts the roles the scaffold marks — an h1 opener, a header, a footer — as placeholders', () => {
    const header: Node = {
      id: 'h',
      type: 'customCode',
      props: {
        label: 'Header',
        tree: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'header',
              children: [{ kind: 'element', tag: 'h2', text: 'Header' }],
            },
          ],
        },
      },
    };
    const opener = placeholder('o', 'Hero');
    const openerTree = opener.props['tree'] as {
      children: { children: { children: { tag: string }[] }[] }[];
    };
    const heading = openerTree.children[0]?.children[0]?.children[0];
    if (heading !== undefined) heading.tag = 'h1';
    expect(summarizeDocumentForIntent(page([header, opener])).placeholderOnly).toBe(true);
  });

  it('counts an empty custom region as a placeholder too', () => {
    const empty: Node = {
      id: 'e',
      type: 'customCode',
      props: { label: 'Blank', tree: { kind: 'root', children: [] } },
    };
    expect(summarizeDocumentForIntent(page([empty])).placeholderOnly).toBe(true);
  });

  it('reads one filled region among placeholders as content', () => {
    const document = page([placeholder('a', 'Hero'), filled('b', 'Menu')]);
    expect(summarizeDocumentForIntent(document)).toMatchObject({
      nodeCount: 2,
      placeholderOnly: false,
    });
  });

  it('reads a region with a component, an icon or a link as content', () => {
    const withIcon: Node = {
      id: 'i',
      type: 'customCode',
      props: { label: 'Icon', tree: { kind: 'root', children: [{ kind: 'icon', name: 'mail' }] } },
    };
    const withComponent: Node = {
      id: 'c',
      type: 'customCode',
      props: {
        label: 'Card',
        tree: { kind: 'root', children: [{ kind: 'component', component: 'hero' }] },
      },
    };
    expect(summarizeDocumentForIntent(page([withIcon])).placeholderOnly).toBe(false);
    expect(summarizeDocumentForIntent(page([withComponent])).placeholderOnly).toBe(false);
  });

  it('reads a region with more than its heading as content', () => {
    const twoHeadings: Node = {
      id: 't',
      type: 'customCode',
      props: {
        label: 'Two',
        tree: {
          kind: 'root',
          children: [
            { kind: 'element', tag: 'h2', text: 'One' },
            { kind: 'element', tag: 'h2', text: 'Two' },
          ],
        },
      },
    };
    expect(summarizeDocumentForIntent(page([twoHeadings])).placeholderOnly).toBe(false);
  });

  it('reads a registered block as content, labelled by its type in words', () => {
    const hero: Node = { id: 'hero', type: 'hero', props: { heading: 'Hello', label: 'New' } };
    const logos: Node = { id: 'logos', type: 'logoCloud', props: {} };
    expect(summarizeDocumentForIntent(page([hero, logos]))).toEqual({
      nodeCount: 2,
      placeholderOnly: false,
      // A block's own `label` prop is its content (an announcement's "New"), not its name.
      sectionLabels: ['hero', 'logo cloud'],
    });
  });

  it('counts every node under the root, however deep', () => {
    const section: Node = { id: 's', type: 'section', props: {}, slots: { default: ['x', 'y'] } };
    const x: Node = { id: 'x', type: 'text', props: {} };
    const y: Node = { id: 'y', type: 'text', props: {} };
    expect(summarizeDocumentForIntent(page([section], [x, y])).nodeCount).toBe(3);
  });

  it('never reads a region whose tree is not a tree as a placeholder', () => {
    const odd: Node = { id: 'o', type: 'customCode', props: { label: 'Odd', tree: 'markup' } };
    expect(summarizeDocumentForIntent(page([odd])).placeholderOnly).toBe(false);
  });

  it('survives a slot that names a node the document does not hold', () => {
    const document = page([placeholder('a', 'Hero')]);
    const root = document.nodes['root'];
    if (root?.slots !== undefined) root.slots['default'] = ['a', 'ghost'];
    expect(summarizeDocumentForIntent(document)).toEqual({
      nodeCount: 1,
      placeholderOnly: true,
      sectionLabels: ['Hero'],
    });
  });
});
