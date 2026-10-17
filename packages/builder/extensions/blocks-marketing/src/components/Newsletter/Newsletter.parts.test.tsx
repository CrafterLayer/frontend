import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Newsletter } from './Newsletter';
import { newsletterSchema } from './schema';

/*
  Block parts (block-parts DESIGN §4.3): every inner element of this block is
  addressable on the canvas, carries nothing extra when published, takes its
  own classes and direction from `partStyles`, and renders an inline editor
  swapped in at its bind exactly where the text was.
*/
const node: Node = { id: 'news-parts', type: 'newsletter', props: {} };

const FULL = {
  eyebrow: 'Newsletter',
  heading: 'Stay in the loop.',
  body: 'One email a month.',
  emailLabel: 'Email address',
  buttonLabel: 'Subscribe',
  privacy: 'We never share your email.',
};

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swap: Record<string, unknown> = {},
) {
  const props = {
    ...newsletterSchema.props.parse({ ...FULL, ...overrides }),
    ...swap,
  };
  return render(<Newsletter node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

/* Each rendered part, its instance index when repeated, and the bind it must carry. */
const PARTS: readonly (readonly [
  name: string,
  index: string | undefined,
  bind: string | undefined,
])[] = [
  ['panel', undefined, undefined],
  ['eyebrow', undefined, 'eyebrow'],
  ['heading', undefined, 'heading'],
  ['body', undefined, 'body'],
  ['emailLabel', undefined, 'emailLabel'],
  ['button', undefined, 'buttonLabel'],
  ['privacy', undefined, 'privacy'],
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

describe('Newsletter parts', () => {
  it('stamps every rendered part with its bind on the canvas', () => {
    const { container } = renderBlock({}, true);
    for (const [name, index, bind] of PARTS) {
      expect(newsletterSchema.parts?.[name], name).toBeDefined();
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
      { partStyles: { button: { className: 'ps-4', dir: 'ltr' } } },
      true,
    );
    const styled = partOf(container, 'button');
    expect(styled).toHaveClass('ps-4');
    expect(styled).toHaveAttribute('dir', 'ltr');
    expect(partOf(container, 'heading')).not.toHaveClass('ps-4');
  });

  it('gives English text its own direction so the full stop stays at the end', () => {
    renderBlock({}, false);
    for (const text of ['Stay in the loop.', 'One email a month.', 'We never share your email.']) {
      expect(ownerOf(text).closest('[dir]'), text).toHaveAttribute('dir', 'auto');
    }
  });

  it('renders an element swapped in at each text bind in place', () => {
    renderBlock({}, true, {
      eyebrow: <span data-swap="eyebrow" />,
      heading: <span data-swap="heading" />,
      body: <span data-swap="body" />,
      emailLabel: <span data-swap="emailLabel" />,
      buttonLabel: <span data-swap="buttonLabel" />,
      privacy: <span data-swap="privacy" />,
    });
    expect(document.body.innerHTML).not.toContain('[object Object]');
    for (const bind of ['eyebrow', 'heading', 'body', 'emailLabel', 'buttonLabel', 'privacy']) {
      const swapped = document.querySelectorAll(`[data-swap="${bind}"]`);
      expect(swapped, bind).toHaveLength(1);
      expect(swapped[0]?.closest('[data-ck-bind]'), bind).toHaveAttribute('data-ck-bind', bind);
    }
  });

  it('keeps the email input described by the privacy part', () => {
    const { container } = renderBlock({}, true);
    expect(container.querySelector('input[type="email"]')).toHaveAttribute(
      'aria-describedby',
      partOf(container, 'privacy').id,
    );
  });
});
