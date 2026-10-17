import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { SiteDesignContext, StaticDocument } from '@craftkit/builder-renderer';
import type {
  BlockRenderProps,
  BuilderDocument,
  Node,
  SiteLibrary,
  SymbolOverride,
} from '@craftkit/builder-schema';

import { builderCustomCode } from '../index';
import { customCodeSymbolSchema, type SymbolInstanceBlockProps } from './schema';
import { SymbolInstanceBlock } from './SymbolInstanceBlock';

const node: Node = { id: 'inst', type: 'customCodeSymbol', props: {} };

function libraryWith(title: string, cta = 'Start'): SiteLibrary {
  return {
    symbols: {
      banner: {
        id: 'banner',
        name: 'Banner',
        css: '.ck-banner { letter-spacing: 0.02em }',
        tree: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              className: 'ck-banner p-8',
              children: [
                { kind: 'element', tag: 'h2', text: title },
                { kind: 'element', tag: 'a', text: cta, attributes: { href: 'https://example.com' } },
              ],
            },
          ],
        },
      },
    },
  };
}

function renderInstance(library: SiteLibrary | undefined, overrides: SymbolOverride[] = [], isCanvas = false) {
  const props: SymbolInstanceBlockProps = { label: 'Banner', symbolId: 'banner', overrides };
  const renderProps: BlockRenderProps<SymbolInstanceBlockProps> = { node, props, slots: {}, data: {}, isCanvas };
  return (
    <SiteDesignContext.Provider value={{ library }}>
      <SymbolInstanceBlock {...renderProps} />
    </SiteDesignContext.Provider>
  );
}

describe('SymbolInstanceBlock', () => {
  it('renders the master from the site library, with its scoped css', () => {
    const { container } = render(renderInstance(libraryWith('Summer sale')));
    expect(screen.getByRole('heading', { name: 'Summer sale' })).toBeVisible();
    expect(container.querySelector('style')?.textContent).toContain('[data-ck="inst"] .ck-banner');
  });

  it('applies this instance’s overrides without touching the master', () => {
    const library = libraryWith('Summer sale');
    render(renderInstance(library, [{ path: [0, 1], text: 'Shop now', className: 'underline' }]));
    expect(screen.getByRole('link', { name: 'Shop now' })).toHaveClass('underline');
    expect(library.symbols?.['banner']?.tree.children[0]).toMatchObject({ kind: 'element' });
  });

  it('keeps an override when the master is edited, and skips one whose path vanished', () => {
    const overrides: SymbolOverride[] = [
      { path: [0, 1], text: 'Shop now' },
      { path: [0, 9], text: 'Gone' },
    ];
    const { rerender } = render(renderInstance(libraryWith('Summer sale'), overrides));
    rerender(renderInstance(libraryWith('Winter sale', 'Begin'), overrides));

    expect(screen.getByRole('heading', { name: 'Winter sale' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Shop now' })).toBeVisible();
    expect(screen.queryByText('Gone')).toBeNull();
  });

  it('says on the canvas when its symbol is missing, and publishes nothing', () => {
    const { container, rerender } = render(renderInstance(undefined, [], true));
    expect(screen.getByRole('note')).toHaveTextContent('Symbol “banner” is not in this site’s library');
    rerender(renderInstance(undefined, [], false));
    expect(container).toBeEmptyDOMElement();
  });

  it('stamps element paths on the canvas so instance elements are focusable', () => {
    const { container } = render(renderInstance(libraryWith('Hi'), [], true));
    expect(container.querySelector('[data-ck-path="0.0"]')?.textContent).toBe('Hi');
  });

  it('renders in StaticDocument (the export path) from the site design context', () => {
    const document: BuilderDocument = {
      schemaVersion: 1,
      surface: 'site',
      dir: 'rtl',
      rootId: 'inst',
      nodes: {
        inst: {
          id: 'inst',
          type: 'customCodeSymbol',
          props: { label: 'Banner', symbolId: 'banner', overrides: [{ path: [0, 0], text: 'تخفيضات الصيف' }] },
        },
      },
    };
    const kernel = createBuilder({
      document,
      extensions: [builderCustomCode],
      ports: { clock: fixedClock(1), ids: seededIds('sym') },
    });
    const html = renderToStaticMarkup(
      <SiteDesignContext.Provider value={{ library: libraryWith('Summer sale') }}>
        <StaticDocument document={document} blocks={(type) => kernel.context.registry.block(type)} />
      </SiteDesignContext.Provider>,
    );
    expect(html).toContain('تخفيضات الصيف');
    expect(html).toContain('Start');
    expect(html).not.toContain('data-ck-path');
  });

  it('validates its props: a symbol id and well-formed overrides', () => {
    const props = customCodeSymbolSchema.props;
    expect(props.safeParse({ symbolId: 'banner' }).success).toBe(true);
    expect(props.safeParse({ symbolId: 'Not An Id' }).success).toBe(false);
    expect(props.safeParse({ symbolId: 'banner', overrides: [{ path: [] }] }).success).toBe(false);
    expect(builderCustomCode.contributes?.blocks?.map((block) => block.schema.type)).toContain('customCodeSymbol');
  });
});
