import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { PortfolioGrid } from './PortfolioGrid';
import { portfolioGridSchema, type PortfolioGridProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, each case study, its lines, its
  image and every outcome metric are addressable on the canvas, carry nothing
  extra when published, take classes and direction from `partStyles`, and
  render an inline editor swapped in at its bind exactly where the text was.
*/
const node: Node = { id: 'portfolio-parts', type: 'portfolioGrid', props: {} };

const FULL = {
  eyebrow: 'Portfolio',
  heading: 'Selected work.',
  body: 'Outcomes from recent partnerships.',
  items: [
    {
      category: 'Fintech',
      title: 'A clearer finance workspace',
      summary: 'A dependable operating view for growing finance teams.',
      imageSrc: '/finance.jpg',
      imageAlt: 'Finance dashboard',
      href: '/work/finance',
      metrics: [
        { label: 'Faster reporting', value: '4.2×' },
        { label: 'Adoption', value: '86%' },
      ],
    },
    {
      category: 'Commerce',
      title: 'A storefront built for repeat customers',
      summary: 'Editorial storytelling meets a frictionless purchase path.',
      href: '/work/commerce',
    },
  ],
};

type Swap = (props: PortfolioGridProps) => PortfolioGridProps;

function renderPortfolio(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = portfolioGridSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(
    <PortfolioGrid node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('PortfolioGrid parts', () => {
  it('stamps each part instance, nested metrics included, on the canvas', () => {
    const { container } = renderPortfolio({}, true);
    expect(partsNamed(container, 'heading')[0]).toHaveAttribute('data-ck-bind', 'heading');
    expect(partsNamed(container, 'items')[0]).toHaveAttribute('data-ck-bind', 'items');
    expect(partsNamed(container, 'item')[1]).toHaveAttribute('data-ck-bind', 'items.1');
    expect(partsNamed(container, 'item.title').map((title) => title.dataset['ckBind'])).toEqual([
      'items.0.title',
      'items.1.title',
    ]);
    expect(partsNamed(container, 'item.image')).toHaveLength(1);
    expect(partsNamed(container, 'item.metrics')[0]).toHaveAttribute(
      'data-ck-bind',
      'items.0.metrics',
    );
    const metrics = partsNamed(container, 'item.metric');
    expect(metrics).toHaveLength(2);
    expect(metrics[1]).toHaveAttribute('data-ck-part-index', '0.1');
    expect(partsNamed(container, 'item.metric.value')[1]).toHaveAttribute(
      'data-ck-bind',
      'items.0.metrics.1.value',
    );
    expect(partsNamed(container, 'item.metric.label')[0]).toHaveTextContent('Faster reporting');
    expect(partsNamed(container, 'item.link')[1]).toHaveAttribute('data-ck-bind', 'items.1.title');
    expect(partsNamed(container, 'actionLabel')).toHaveLength(2);
  });

  it('publishes no part markers and names each link through its label and title', () => {
    const { container } = renderPortfolio({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(
      screen.getByRole('link', { name: 'View case study A storefront built for repeat customers' }),
    ).toHaveAttribute('href', '/work/commerce');
    expect(container.querySelector('a[aria-label]')).toBeNull();
  });

  it('applies an all-items style everywhere and a this-item style to one metric', () => {
    const { container } = renderPortfolio(
      {
        partStyles: {
          'item.summary': { className: 'ps-4' },
          'item.metric.value@0.1': { className: 'ps-8', dir: 'ltr' },
        },
      },
      true,
    );
    for (const summary of partsNamed(container, 'item.summary'))
      expect(summary).toHaveClass('ps-4');
    const values = partsNamed(container, 'item.metric.value');
    expect(values[0]).not.toHaveClass('ps-8');
    expect(values[0]).toHaveAttribute('dir', 'auto');
    expect(values[1]).toHaveClass('ps-8', 'font-bold');
    expect(values[1]).toHaveAttribute('dir', 'ltr');
  });

  it('gives text parts their own direction and leaves cards and lists to the page', () => {
    const { container } = renderPortfolio({}, false);
    expect(container.querySelector('h3')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('dt')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('[data-portfolio-card]')).not.toHaveAttribute('dir');
    expect(container.querySelector('dl')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderPortfolio({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      actionLabel: swapped('actionLabel'),
      items: props.items.map((item, index) => ({
        ...item,
        title: swapped(`items.${String(index)}.title`),
        metrics: item.metrics.map((metric, metricIndex) => ({
          ...metric,
          value: swapped(`items.${String(index)}.metrics.${String(metricIndex)}.value`),
        })),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'actionLabel',
      'items.0.title',
      'items.1.title',
      'items.0.metrics.1.value',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
