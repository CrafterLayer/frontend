import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Timeline } from './Timeline';
import { timelineSchema, type TimelineProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, the list, every milestone and
  its date, title, description and badge are addressable on the canvas, carry
  nothing extra when published, take classes and direction from `partStyles`,
  and render an inline editor swapped in at its bind exactly once.
*/
const node: Node = { id: 'timeline-parts', type: 'timeline', props: {} };
const FULL = { eyebrow: 'Since 2019', body: 'How we got here.' };

type Swap = (props: TimelineProps) => TimelineProps;

function renderTimeline(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = timelineSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Timeline node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('Timeline parts', () => {
  it('stamps the list, every milestone and its texts on the canvas', () => {
    const { container } = renderTimeline({}, true);
    expect(partsNamed(container, 'items')[0]?.tagName).toBe('OL');
    expect(partsNamed(container, 'item')[2]).toHaveAttribute('data-ck-bind', 'items.2');
    expect(partsNamed(container, 'item.date').map((date) => date.dataset['ckBind'])).toEqual([
      'items.0.date',
      'items.1.date',
      'items.2.date',
      'items.3.date',
    ]);
    expect(partsNamed(container, 'item.title')[1]).toHaveAttribute('data-ck-bind', 'items.1.title');
    expect(partsNamed(container, 'item.badge')).toHaveLength(1);
    expect(partsNamed(container, 'item.badge')[0]).toHaveAttribute('data-ck-bind', 'items.2.badge');
    expect(partsNamed(container, 'item.description')).toHaveLength(4);
    expect(partsNamed(container, 'heading')[0]).toHaveAttribute('id', 'timeline-parts-heading');
  });

  it('publishes no part markers', () => {
    const { container } = renderTimeline({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('applies an all-items style and a this-item style, this winning', () => {
    const { container } = renderTimeline(
      {
        partStyles: {
          'item.title': { className: 'font-bold' },
          'item.title@1': { className: 'font-regular', dir: 'rtl' },
        },
      },
      true,
    );
    const titles = partsNamed(container, 'item.title');
    expect(titles[0]).toHaveClass('font-bold');
    expect(titles[0]).toHaveAttribute('dir', 'auto');
    expect(titles[1]).toHaveClass('font-regular');
    expect(titles[1]).not.toHaveClass('font-bold');
    expect(titles[1]).toHaveAttribute('dir', 'rtl');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderTimeline({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      body: swapped('body'),
      items: props.items.map((item, index) => ({
        ...item,
        date: swapped(`items.${String(index)}.date`),
        title: swapped(`items.${String(index)}.title`),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of ['heading', 'body', 'items.0.date', 'items.3.title']) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
