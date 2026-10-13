import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { BeforeAfter } from './BeforeAfter';
import { beforeAfterSchema, type BeforeAfterProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, both photos, both corner labels
  and the caption are addressable on the canvas, carry nothing extra when
  published, take classes and direction from `partStyles`, and render an
  inline editor swapped in at its bind exactly once — never in an attribute.
*/
const node: Node = { id: 'compare-parts', type: 'beforeAfter', props: {} };
const FULL = {
  eyebrow: 'Our work',
  body: 'Drag to compare.',
  beforeSrc: '/assets/before.jpg',
  beforeAlt: 'Before the works',
  afterSrc: '/assets/after.jpg',
  afterAlt: 'After the works',
  caption: 'Kitchen, 2026.',
};

type Swap = (props: BeforeAfterProps) => BeforeAfterProps;

function renderBlock(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = beforeAfterSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<BeforeAfter node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('BeforeAfter parts', () => {
  it('stamps both photos, both labels and the caption on the canvas', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'beforeImage')[0]).toHaveAttribute('data-ck-bind', 'beforeSrc');
    expect(partsNamed(container, 'afterImage')[0]?.tagName).toBe('IMG');
    expect(partsNamed(container, 'beforeLabel')[0]).toHaveAttribute('data-ck-bind', 'beforeLabel');
    expect(partsNamed(container, 'afterLabel')[0]).toHaveAttribute('data-ck-bind', 'afterLabel');
    expect(partsNamed(container, 'caption')[0]?.tagName).toBe('FIGCAPTION');
    expect(partsNamed(container, 'heading')[0]).toHaveAttribute('id', 'compare-parts-heading');
  });

  it('publishes no part markers', () => {
    const { container } = renderBlock({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('applies a part style and its direction', () => {
    const { container } = renderBlock(
      { partStyles: { afterLabel: { className: 'bg-accent', dir: 'rtl' } } },
      true,
    );
    const label = partsNamed(container, 'afterLabel')[0];
    expect(label).toHaveClass('bg-accent');
    expect(label).not.toHaveClass('bg-surface/90');
    expect(label).toHaveAttribute('dir', 'rtl');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderBlock({ beforeAlt: '', afterAlt: '' }, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      beforeLabel: swapped('beforeLabel'),
      afterLabel: swapped('afterLabel'),
      caption: swapped('caption'),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of ['heading', 'beforeLabel', 'afterLabel', 'caption']) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
