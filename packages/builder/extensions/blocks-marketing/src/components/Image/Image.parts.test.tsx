import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Image } from './Image';
import { imageSchema } from './schema';

/*
  Block parts (block-parts DESIGN §4.3): every inner element of this block is
  addressable on the canvas, carries nothing extra when published, takes its
  own classes and direction from `partStyles`, and renders an inline editor
  swapped in at its bind exactly where the text was.
*/
const node: Node = { id: 'image-parts', type: 'image', props: {} };

const FULL = { src: '/photo.jpg', alt: 'A kiln glowing in a workshop' };

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swap: Record<string, unknown> = {},
) {
  const props = { ...imageSchema.props.parse({ ...FULL, ...overrides }), ...swap };
  return render(<Image node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

/* Each rendered part, its instance index when repeated, and the bind it must carry. */
const PARTS: readonly (readonly [
  name: string,
  index: string | undefined,
  bind: string | undefined,
])[] = [['image', undefined, 'src']];

function partOf(container: HTMLElement, name: string, index?: string): HTMLElement {
  const selector =
    index === undefined
      ? `[data-ck-part="${name}"]:not([data-ck-part-index])`
      : `[data-ck-part="${name}"][data-ck-part-index="${index}"]`;
  const found = container.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`no part ${selector}`);
  return found;
}

describe('Image parts', () => {
  it('stamps every rendered part with its bind on the canvas', () => {
    const { container } = renderBlock({}, true);
    for (const [name, index, bind] of PARTS) {
      expect(imageSchema.parts?.[name], name).toBeDefined();
      const element = partOf(container, name, index);
      if (bind === undefined) expect(element, name).not.toHaveAttribute('data-ck-bind');
      else expect(element, name).toHaveAttribute('data-ck-bind', bind);
    }
  });

  it('publishes no part markers', () => {
    renderBlock({}, false);
    expect(
      document.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('lands a part style and direction override on that part only', () => {
    const { container } = renderBlock(
      { partStyles: { image: { className: 'ps-4', dir: 'ltr' } } },
      true,
    );
    const styled = partOf(container, 'image');
    expect(styled).toHaveClass('ps-4');
    expect(styled).toHaveAttribute('dir', 'ltr');
  });

  it('keeps the picture an img with its alt text, never an editor', () => {
    const { container } = renderBlock({}, false);
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', '/photo.jpg');
    expect(image).toHaveAttribute('alt', 'A kiln glowing in a workshop');
    expect(image).not.toHaveAttribute('dir');
  });

  it('makes the empty frame on the canvas the image part, so it opens the picker', () => {
    const { container } = renderBlock({ src: undefined }, true);
    const frame = partOf(container, 'image');
    expect(frame.tagName).toBe('DIV');
    expect(frame).toHaveTextContent('Add an image URL');
  });
});
