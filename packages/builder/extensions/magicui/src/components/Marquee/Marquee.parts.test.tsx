import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Marquee } from './Marquee';
import { marqueeSchema, type MarqueeProps } from './schema';

/*
  Block parts (DESIGN §4.3): the pause/resume labels, the item row and every
  item's image, title, text, detail and link are parts in every seamless copy,
  carry nothing extra when published, take classes and direction from
  `partStyles`, and render an inline editor swapped in at its bind exactly
  once — in the readable primary copy.
*/
const node: Node = { id: 'marquee-parts', type: 'marquee', props: {} };

const FULL = {
  items: [
    {
      title: 'Harbor Health',
      description: 'Referrals resolved in days.',
      meta: 'Healthcare',
      imageUrl: '/harbor.jpg',
      imageAlt: 'Clinician with a tablet',
      href: '/work/harbor',
    },
    { title: 'Ledger', meta: 'Finance' },
  ],
  presentation: 'cards',
};

type Swap = (props: MarqueeProps) => MarqueeProps;

function renderMarquee(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = marqueeSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Marquee node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('Marquee parts', () => {
  it('stamps every copy of every item, links only on the readable copy', () => {
    const { container } = renderMarquee({}, true);
    /* One row: a primary and a duplicate copy. */
    expect(partsNamed(container, 'items')).toHaveLength(2);
    expect(partsNamed(container, 'item')).toHaveLength(4);
    expect(partsNamed(container, 'item.title').map((title) => title.dataset['ckBind'])).toEqual([
      'items.0.title',
      'items.1.title',
      'items.0.title',
      'items.1.title',
    ]);
    expect(partsNamed(container, 'item.image')[0]).toHaveAttribute(
      'data-ck-bind',
      'items.0.imageUrl',
    );
    expect(partsNamed(container, 'item.description')).toHaveLength(2);
    expect(partsNamed(container, 'item.link')).toHaveLength(1);
    expect(partsNamed(container, 'item.link')[0]).toHaveAttribute('data-ck-bind', 'items.0.title');
    expect(partsNamed(container, 'pauseLabel')[0]).not.toHaveAttribute('hidden');
    expect(partsNamed(container, 'resumeLabel')[0]).toHaveAttribute('hidden');
  });

  it('publishes no part markers and keeps the pause control named by its visible label', () => {
    const { container } = renderMarquee({ pauseLabel: 'Stop' }, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('styles every copy of a part alike and one item over all of them', () => {
    const { container } = renderMarquee(
      {
        partStyles: {
          'item.meta': { className: 'ps-4' },
          'item.meta@1': { className: 'ps-8', dir: 'rtl' },
        },
      },
      true,
    );
    const metas = partsNamed(container, 'item.meta');
    expect(metas).toHaveLength(4);
    expect(metas[0]).toHaveClass('ps-4', 'mgc-marquee__meta');
    expect(metas[2]).toHaveClass('ps-4');
    expect(metas[1]).toHaveClass('ps-8');
    expect(metas[3]).toHaveClass('ps-8');
    expect(metas[3]).toHaveAttribute('dir', 'rtl');
    expect(metas[0]).toHaveAttribute('dir', 'auto');
  });

  it('gives text parts their own direction and leaves items to the page', () => {
    const { container } = renderMarquee({}, false);
    expect(container.querySelector('.mgc-marquee__title')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('.mgc-marquee__item')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, in the primary copy', () => {
    const { container } = renderMarquee({ rows: 'two' }, true, (props) => ({
      ...props,
      pauseLabel: swapped('pauseLabel'),
      resumeLabel: swapped('resumeLabel'),
      items: props.items.map((item, index) => ({
        ...item,
        title: swapped(`items.${String(index)}.title`),
        ...(item.meta === undefined ? {} : { meta: swapped(`items.${String(index)}.meta`) }),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'pauseLabel',
      'resumeLabel',
      'items.0.title',
      'items.1.title',
      'items.1.meta',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
      if (key.startsWith('items.')) {
        expect(found[0]?.closest('[data-marquee-copy]')).toHaveAttribute(
          'data-marquee-copy',
          'primary',
        );
      }
    }
  });
});
