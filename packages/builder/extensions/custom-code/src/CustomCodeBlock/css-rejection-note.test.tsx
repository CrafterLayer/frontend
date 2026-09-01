import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BlockRenderProps, Node } from '@craftkit/builder-schema';

import { CustomCodeBlock } from './CustomCodeBlock';
import type { CustomCodeBlockProps } from './schema';

const node: Node = { id: 'r1', type: 'customCode', props: {} };

function renderBlock(css: string, isCanvas: boolean) {
  const props: CustomCodeBlockProps = {
    label: 'Region',
    css,
    tree: { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'hello' }] },
  };
  const renderProps: BlockRenderProps<CustomCodeBlockProps> = {
    node,
    props,
    slots: {},
    data: {},
    isCanvas,
  };
  return render(<CustomCodeBlock {...renderProps} />);
}

/**
 * A refused stylesheet is dropped whole. The first live user saw an unstyled
 * panel and had no way to know why: the reason has to be SAID, on the canvas,
 * and never published.
 */
describe('refused custom CSS is explained on the canvas', () => {
  it('names the refused construct next to the region', () => {
    const { container } = renderBlock('@import url("https://evil.test/x.css"); .ck-a{color:red}', true);

    const note = container.querySelector('[role="note"]');
    expect(note?.textContent).toContain('Custom CSS not applied');
    expect(note?.textContent).toContain('@import');
    expect(container.querySelector('style')).toBeNull();
  });

  it('says nothing when the stylesheet is accepted', () => {
    const { container } = renderBlock('.ck-a { color: red }', true);

    expect(container.querySelector('[role="note"]')).toBeNull();
    expect(container.querySelector('style')?.textContent).toContain('[data-ck="r1"] .ck-a');
  });

  it('never carries the note into a published render', () => {
    const { container } = renderBlock('@import url("https://evil.test/x.css");', false);

    expect(container.querySelector('[role="note"]')).toBeNull();
    expect(container.querySelector('style')).toBeNull();
  });

  it('applies an https background image — the case that used to vanish silently', () => {
    const { container } = renderBlock(
      '.ck-dua { background-image: url("https://images.unsplash.com/photo-1?auto=format"); background-size: cover }',
      true,
    );

    expect(container.querySelector('[role="note"]')).toBeNull();
    expect(container.querySelector('style')?.textContent).toContain('images.unsplash.com');
  });
});
