import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Dialog } from './Dialog';
import { dialogSchema } from './schema';

/*
  Block parts (block-parts DESIGN §4.3): every inner element of this block is
  addressable on the canvas, carries nothing extra when published, takes its
  own classes and direction from `partStyles`, and renders an inline editor
  swapped in at its bind exactly where the text was.
*/
const node: Node = { id: 'dialog-parts', type: 'dialog', props: {} };

const FULL = {
  triggerLabel: 'Open settings',
  title: 'Save changes?',
  body: 'Your edits will be published.',
  primaryAction: { label: 'Save', href: '#save' },
  secondaryAction: { label: 'Cancel', href: '#cancel' },
};

function renderBlock(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swap: Record<string, unknown> = {},
) {
  const props = { ...dialogSchema.props.parse({ ...FULL, ...overrides }), ...swap };
  return render(<Dialog node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

/* Each rendered part, its instance index when repeated, and the bind it must carry. */
const PARTS: readonly (readonly [
  name: string,
  index: string | undefined,
  bind: string | undefined,
])[] = [
  ['trigger', undefined, 'triggerLabel'],
  ['panel', undefined, undefined],
  ['title', undefined, 'title'],
  ['body', undefined, 'body'],
  ['primaryAction', undefined, 'primaryAction.label'],
  ['secondaryAction', undefined, 'secondaryAction.label'],
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

describe('Dialog parts', () => {
  it('stamps every rendered part with its bind on the canvas', () => {
    const { container } = renderBlock({}, true);
    for (const [name, index, bind] of PARTS) {
      expect(dialogSchema.parts?.[name], name).toBeDefined();
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
      { partStyles: { primaryAction: { className: 'ps-4', dir: 'ltr' } } },
      true,
    );
    const styled = partOf(container, 'primaryAction');
    expect(styled).toHaveClass('ps-4');
    expect(styled).toHaveAttribute('dir', 'ltr');
    expect(partOf(container, 'secondaryAction')).not.toHaveClass('ps-4');
  });

  it('gives English text its own direction so the full stop stays at the end', () => {
    renderBlock({}, false);
    for (const text of [
      'Open settings',
      'Save changes?',
      'Your edits will be published.',
      'Save',
    ]) {
      expect(ownerOf(text).closest('[dir]'), text).toHaveAttribute('dir', 'auto');
    }
  });

  it('renders an element swapped in at each text bind in place', () => {
    renderBlock({}, true, {
      triggerLabel: <span data-swap="triggerLabel" />,
      title: <span data-swap="title" />,
      body: <span data-swap="body" />,
      primaryAction: { label: <span data-swap="primaryAction.label" />, href: '#save' },
      secondaryAction: { label: <span data-swap="secondaryAction.label" />, href: '#cancel' },
    });
    expect(document.body.innerHTML).not.toContain('[object Object]');
    for (const bind of [
      'triggerLabel',
      'title',
      'body',
      'primaryAction.label',
      'secondaryAction.label',
    ]) {
      const swapped = document.querySelectorAll(`[data-swap="${bind}"]`);
      expect(swapped, bind).toHaveLength(1);
      expect(swapped[0]?.closest('[data-ck-bind]'), bind).toHaveAttribute('data-ck-bind', bind);
    }
  });

  it('keeps the dialog named and described by its title and body parts', () => {
    const { container } = renderBlock({}, true);
    const dialog = container.querySelector('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', partOf(container, 'title').id);
    expect(dialog).toHaveAttribute('aria-describedby', partOf(container, 'body').id);
  });
});
