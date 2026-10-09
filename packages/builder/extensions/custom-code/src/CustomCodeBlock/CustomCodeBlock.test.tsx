import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BlockRenderProps, CustomCodeRoot, Node } from '@craftkit/builder-schema';

import { CustomCodeBlock } from './CustomCodeBlock';
import type { CustomCodeBlockProps } from './schema';

const node: Node = { id: 'r1', type: 'customCode', props: {} };

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [{ kind: 'element', tag: 'p', className: 'ck-lede', text: 'Handmade in Amman' }],
};

function renderBlock(overrides: Partial<CustomCodeBlockProps> = {}, isCanvas = false) {
  const props: CustomCodeBlockProps = { label: 'Region', css: '', js: '', tree: TREE, ...overrides };
  const renderProps: BlockRenderProps<CustomCodeBlockProps> = {
    node,
    props,
    slots: {},
    data: {},
    isCanvas,
  };
  return render(<CustomCodeBlock {...renderProps} />);
}

/** The one `<style>` this block writes, or null when it wrote none. */
function styleText(container: HTMLElement): string | null {
  return container.querySelector('style')?.textContent ?? null;
}

describe('CustomCodeBlock', () => {
  it('renders the tree through the shared renderer', () => {
    renderBlock();
    expect(screen.getByText('Handmade in Amman')).toBeInTheDocument();
  });

  it('roots the region at the hosting node, so its stylesheet can reach it', () => {
    const { container } = renderBlock();
    expect(container.querySelector('[data-ck="r1"]')).toBeInTheDocument();
  });

  describe('the stylesheet', () => {
    it('writes none at all when there is no CSS', () => {
      expect(styleText(renderBlock().container)).toBeNull();
    });

    it('SCOPES every selector to this block, so one region cannot restyle another', () => {
      const { container } = renderBlock({
        css: '.ck-lede { color: red } .ck-lede:hover { color: blue }',
      });
      const css = styleText(container) ?? '';
      /*
        Counted, not merely present. "Contains the scope" passes for a sheet
        that scoped its first selector and left the second bare — and that
        second selector is the one that would reach into another region.
      */
      const selectors = [...css.matchAll(/\.ck-lede/gu)];
      const scoped = [...css.matchAll(/\[data-ck="r1"\]\s*\.ck-lede/gu)];
      expect(selectors).toHaveLength(2);
      expect(scoped).toHaveLength(selectors.length);
    });

    it('is dropped WHOLE when one rule is refused — a partial sheet is a lie', () => {
      const { container } = renderBlock({
        css: '.ck-lede { color: red } .bad { background: url(http://evil.test/p.png) }',
      });
      expect(styleText(container)).toBeNull();
    });
  });

  describe('the refusal note', () => {
    it('says WHY on the canvas, naming the rule that was refused', () => {
      renderBlock({ css: '@import url("https://evil.test/x.css"); .a { color: red }' }, true);
      const note = screen.getByRole('note');
      expect(note).toHaveTextContent('Custom CSS not applied');
      expect(note).toHaveAttribute('data-css-rejected', '@import');
    });

    it('is NEVER published — the page carries no explanation of its own chrome', () => {
      renderBlock({ css: '@import url("https://evil.test/x.css"); .a { color: red }' }, false);
      expect(screen.queryByRole('note')).toBeNull();
    });

    it('is absent when the stylesheet was accepted', () => {
      renderBlock({ css: '.ck-lede { color: red }' }, true);
      expect(screen.queryByRole('note')).toBeNull();
    });

    it('is absent when there is no stylesheet to refuse', () => {
      renderBlock({}, true);
      expect(screen.queryByRole('note')).toBeNull();
    });

    it('still renders the tree beside it — a bad sheet costs the styling, not the region', () => {
      renderBlock({ css: '.a { width: expression(alert(1)) }' }, true);
      expect(screen.getByRole('note')).toBeInTheDocument();
      expect(screen.getByText('Handmade in Amman')).toBeInTheDocument();
    });
  });

  it('renders an empty region without a stylesheet or a note', () => {
    const { container } = renderBlock({ tree: { kind: 'root', children: [] } }, true);
    expect(styleText(container)).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
    expect(container.querySelector('[data-ck="r1"]')).toBeInTheDocument();
  });
});
