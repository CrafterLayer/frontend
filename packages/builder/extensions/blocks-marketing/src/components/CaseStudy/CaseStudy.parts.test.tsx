import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { CaseStudy } from './CaseStudy';
import { caseStudySchema, type CaseStudyProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction and client, every result and
  its value and label, every story point, the quote and its author and role,
  the image and the action are addressable on the canvas, carry nothing extra
  when published, and render an inline editor at its bind exactly once.
*/
const node: Node = { id: 'story-parts', type: 'caseStudy', props: {} };
const FULL = {
  eyebrow: 'Case study',
  client: 'Northwind',
  body: 'Six weeks.',
  quote: 'Same parcel, same moment.',
  quoteAuthor: 'Omar',
  quoteRole: 'COO',
  imageSrc: '/assets/team.jpg',
  imageAlt: 'The team',
  actionLabel: 'Read more',
  actionHref: '/more',
};

type Swap = (props: CaseStudyProps) => CaseStudyProps;

function renderBlock(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = caseStudySchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<CaseStudy node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('CaseStudy parts', () => {
  it('stamps the client, every result, every story point, the quote and the image', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'client')[0]).toHaveAttribute('data-ck-bind', 'client');
    expect(partsNamed(container, 'metric')[1]).toHaveAttribute('data-ck-bind', 'metrics.1');
    expect(partsNamed(container, 'metric.value')[2]).toHaveAttribute(
      'data-ck-bind',
      'metrics.2.value',
    );
    expect(partsNamed(container, 'point.label').map((label) => label.dataset['ckBind'])).toEqual([
      'points.0.label',
      'points.1.label',
      'points.2.label',
    ]);
    for (const name of [
      'quote',
      'quoteAuthor',
      'quoteRole',
      'image',
      'action',
      'metrics',
      'points',
    ]) {
      expect(partsNamed(container, name), name).toHaveLength(1);
    }
  });

  it('publishes no part markers', () => {
    const { container } = renderBlock({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('applies an all-items style and a this-item style, this winning', () => {
    const { container } = renderBlock(
      {
        partStyles: {
          'metric.value': { className: 'text-accent' },
          'metric.value@0': { className: 'text-inherit', dir: 'ltr' },
        },
      },
      true,
    );
    const values = partsNamed(container, 'metric.value');
    expect(values[1]).toHaveClass('text-accent');
    expect(values[0]).toHaveClass('text-inherit');
    expect(values[0]).toHaveAttribute('dir', 'ltr');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderBlock({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      client: swapped('client'),
      metrics: props.metrics.map((metric, index) => ({
        value: swapped(`metrics.${String(index)}.value`),
        label: swapped(`metrics.${String(index)}.label`),
      })),
      points: props.points.map((point, index) => ({
        ...point,
        text: swapped(`points.${String(index)}.text`),
      })),
      quote: swapped('quote'),
      actionLabel: swapped('actionLabel'),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'client',
      'metrics.0.value',
      'metrics.2.label',
      'points.1.text',
      'quote',
      'actionLabel',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
