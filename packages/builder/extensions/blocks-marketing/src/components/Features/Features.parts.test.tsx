import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Features } from './Features';
import { featuresSchema, type FeaturesProps } from './schema';

/*
  Block parts (DESIGN §4.3): the intro, the card list, each card and each
  card's lines are addressable on the canvas, carry nothing extra when
  published, take classes and direction from `partStyles`, and render an
  inline editor swapped in at its bind exactly where the text was.
*/
const node: Node = { id: 'features-parts', type: 'features', props: {} };

const FULL = {
  eyebrow: 'Why teams switch',
  heading: 'Everything in one place.',
  body: 'Blocks that edit in place.',
  items: [
    { icon: '⚡', kicker: 'Speed', title: 'Fast', body: 'Pages respond immediately.' },
    { title: 'Safe', body: 'Contracts guard every boundary.' },
  ],
};

function renderFeatures(
  overrides: Record<string, unknown>,
  isCanvas: boolean,
  swap?: (props: FeaturesProps) => FeaturesProps,
) {
  const parsed = featuresSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Features node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

describe('Features parts', () => {
  it('stamps each part instance with its index and bind on the canvas', () => {
    const { container } = renderFeatures({}, true);
    expect(partsNamed(container, 'heading')[0]).toHaveAttribute('data-ck-bind', 'heading');
    expect(partsNamed(container, 'items')[0]).toHaveAttribute('data-ck-bind', 'items');
    const cards = partsNamed(container, 'item');
    expect(cards).toHaveLength(2);
    expect(cards[1]).toHaveAttribute('data-ck-part-index', '1');
    expect(cards[1]).toHaveAttribute('data-ck-bind', 'items.1');
    const titles = partsNamed(container, 'item.title');
    expect(titles.map((title) => title.dataset['ckBind'])).toEqual([
      'items.0.title',
      'items.1.title',
    ]);
    expect(titles[1]).toHaveTextContent('Safe');
    expect(partsNamed(container, 'item.body')[0]).toHaveAttribute('data-ck-bind', 'items.0.body');
    /* Only a stored icon or kicker is a part; the numbered fallback is decoration. */
    expect(partsNamed(container, 'item.icon')).toHaveLength(1);
    expect(partsNamed(container, 'item.kicker')).toHaveLength(1);
    expect(partsNamed(container, 'item.icon')[0]).toHaveAttribute('data-ck-bind', 'items.0.icon');
  });

  it('publishes no part markers', () => {
    const { container } = renderFeatures({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(container.querySelector('[data-features-card]')).not.toBeNull();
  });

  it('applies an all-items style to every instance and a this-item style to one, this winning', () => {
    const { container } = renderFeatures(
      {
        partStyles: {
          'item.title': { className: 'ps-4' },
          'item.title@1': { className: 'ps-8', dir: 'rtl' },
          heading: { className: 'pe-2', dir: 'ltr' },
        },
      },
      true,
    );
    const titles = partsNamed(container, 'item.title');
    expect(titles[0]).toHaveClass('ps-4', 'font-semibold');
    expect(titles[0]).toHaveAttribute('dir', 'auto');
    expect(titles[1]).toHaveClass('ps-8');
    expect(titles[1]).not.toHaveClass('ps-4');
    expect(titles[1]).toHaveAttribute('dir', 'rtl');
    expect(partsNamed(container, 'heading')[0]).toHaveClass('pe-2');
    expect(partsNamed(container, 'heading')[0]).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'item.body')[0]).not.toHaveClass('ps-4');
  });

  it('gives text parts their own direction and leaves boxes to the page', () => {
    const { container } = renderFeatures({}, false);
    expect(container.querySelector('h2')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('h3')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('[data-features-card]')).not.toHaveAttribute('dir');
    expect(container.querySelector('[data-features-grid]')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind in place', () => {
    const { container } = renderFeatures({}, true, (props) => ({
      ...props,
      heading: (<span data-swap="heading" />) as unknown as string,
      items: props.items.map((item, index) => ({
        ...item,
        title: (<span data-swap={`items.${String(index)}.title`} />) as unknown as string,
        body: (<span data-swap={`items.${String(index)}.body`} />) as unknown as string,
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'items.0.title',
      'items.1.title',
      'items.0.body',
      'items.1.body',
    ]) {
      const swapped = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(swapped, key).toHaveLength(1);
      expect(swapped[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
