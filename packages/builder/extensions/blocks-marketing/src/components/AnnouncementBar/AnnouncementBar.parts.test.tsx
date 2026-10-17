import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { AnnouncementBar } from './AnnouncementBar';
import { announcementBarSchema } from './schema';

/*
  Block parts (block-parts DESIGN §4.3): every inner element of this block is
  addressable on the canvas, carries nothing extra when published, takes its
  own classes and direction from `partStyles`, and renders an inline editor
  swapped in at its bind exactly where the text was.
*/
const node: Node = { id: 'bar-parts', type: 'announcementBar', props: {} };

const FULL = {
  label: 'New',
  message: 'Version 2 is live.',
  linkLabel: 'Read more',
  href: '/changelog',
};

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swap: Record<string, unknown> = {},
) {
  const props = {
    ...announcementBarSchema.props.parse({ ...FULL, ...overrides }),
    ...swap,
  };
  return render(
    <AnnouncementBar node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

/* Each rendered part, its instance index when repeated, and the bind it must carry. */
const PARTS: readonly (readonly [
  name: string,
  index: string | undefined,
  bind: string | undefined,
])[] = [
  ['label', undefined, 'label'],
  ['message', undefined, 'message'],
  ['link', undefined, 'linkLabel'],
];

function partOf(container: HTMLElement, name: string, index?: string): HTMLElement {
  const selector =
    index === undefined
      ? `[data-ck-part="${name}"]:not([data-ck-part-index])`
      : `[data-ck-part="${name}"][data-ck-part-index="${index}"]`;
  const found = container.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`no part ${selector}`);
  return found;
}

/* The element that directly holds a visible text. */
function ownerOf(text: string): HTMLElement {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
    if (current.textContent?.includes(text) === true && current.parentElement !== null) {
      return current.parentElement;
    }
  }
  throw new Error(`no text "${text}"`);
}

describe('AnnouncementBar parts', () => {
  it('stamps every rendered part with its bind on the canvas', () => {
    const { container } = renderBlock({}, true);
    for (const [name, index, bind] of PARTS) {
      expect(announcementBarSchema.parts?.[name], name).toBeDefined();
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
      { partStyles: { link: { className: 'ps-4', dir: 'ltr' } } },
      true,
    );
    const styled = partOf(container, 'link');
    expect(styled).toHaveClass('ps-4');
    expect(styled).toHaveAttribute('dir', 'ltr');
    expect(partOf(container, 'message')).not.toHaveClass('ps-4');
  });

  it('gives English text its own direction so the full stop stays at the end', () => {
    renderBlock({}, false);
    for (const text of ['Version 2 is live.', 'Read more']) {
      expect(ownerOf(text).closest('[dir]'), text).toHaveAttribute('dir', 'auto');
    }
  });

  it('renders an element swapped in at each text bind in place', () => {
    renderBlock({}, true, {
      label: <span data-swap="label" />,
      message: <span data-swap="message" />,
      linkLabel: <span data-swap="linkLabel" />,
    });
    expect(document.body.innerHTML).not.toContain('[object Object]');
    for (const bind of ['label', 'message', 'linkLabel']) {
      const swapped = document.querySelectorAll(`[data-swap="${bind}"]`);
      expect(swapped, bind).toHaveLength(1);
      expect(swapped[0]?.closest('[data-ck-bind]'), bind).toHaveAttribute('data-ck-bind', bind);
    }
  });

  it('keeps the bar named by its visible message part', () => {
    const { container } = renderBlock({}, true);
    expect(container.querySelector('aside')).toHaveAttribute(
      'aria-labelledby',
      partOf(container, 'message').id,
    );
    expect(partOf(container, 'link')).toHaveAttribute('href', '/changelog');
  });
});
