import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ComparisonTable } from './ComparisonTable';
import { comparisonTableSchema, type ComparisonTableProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, every plan header line and
  button, every row name and cell value, the shared empty-cell text and the
  footnote are addressable on the canvas, carry nothing extra when published,
  take classes and direction from `partStyles`, and render an inline editor
  swapped in at its bind exactly once.
*/
const node: Node = { id: 'comparison-parts', type: 'comparisonTable', props: {} };

const FULL = {
  eyebrow: 'Pricing',
  heading: 'Compare plans.',
  body: 'Pick the right fit.',
  featureLabel: 'Features',
  note: 'Cancel anytime.',
  plans: [
    {
      name: 'Starter',
      description: 'For small teams',
      price: '$19',
      period: '/ month',
      actionLabel: 'Start free',
      actionHref: '/signup/starter',
    },
    {
      name: 'Growth',
      badge: 'Popular',
      price: '$49',
      actionLabel: 'Go',
      actionHref: '/signup/growth',
    },
  ],
  rows: [
    { feature: 'Projects', values: ['3', 'Unlimited'] },
    { feature: 'Phone support', values: [] },
  ],
};

type Swap = (props: ComparisonTableProps) => ComparisonTableProps;

function renderTable(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = comparisonTableSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(
    <ComparisonTable node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

/*
  The table's parts. The phone cards (blocks-polish 2026-10-08) carry the same
  parts again so a click on a card edits the same value; they are counted in
  their own test below.
*/
function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) =>
      element.dataset['ckPart'] === name && element.closest('[data-comparison-cards]') === null,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('ComparisonTable parts', () => {
  it('stamps plan headers, rows and every cell value on the canvas', () => {
    const { container } = renderTable({}, true);
    expect(partsNamed(container, 'featureLabel')[0]).toHaveAttribute(
      'data-ck-bind',
      'featureLabel',
    );
    expect(partsNamed(container, 'plans')[0]?.tagName).toBe('TR');
    expect(partsNamed(container, 'plan')[1]).toHaveAttribute('data-ck-bind', 'plans.1');
    expect(partsNamed(container, 'plan.name').map((name) => name.dataset['ckBind'])).toEqual([
      'plans.0.name',
      'plans.1.name',
    ]);
    expect(partsNamed(container, 'plan.action')[1]).toHaveAttribute(
      'data-ck-bind',
      'plans.1.actionLabel',
    );
    expect(partsNamed(container, 'rows')[0]?.tagName).toBe('TBODY');
    expect(partsNamed(container, 'row.feature')[1]).toHaveAttribute(
      'data-ck-bind',
      'rows.1.feature',
    );
    const values = partsNamed(container, 'row.value');
    expect(values.map((value) => value.dataset['ckPartIndex'])).toEqual(['0.0', '0.1']);
    expect(values[1]).toHaveAttribute('data-ck-bind', 'rows.0.values.1');
    /* Both missing cells of the second row show the one shared empty text. */
    expect(partsNamed(container, 'emptyValue')).toHaveLength(2);
    expect(partsNamed(container, 'note')[0]).toHaveTextContent('Cancel anytime.');
  });

  it('publishes no part markers and names the table and its buttons without copies', () => {
    const { container } = renderTable({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    const table = screen.getByRole('table', { name: 'Compare plans.' });
    expect(container.querySelector('caption')).toBeNull();
    /* The phone cards repeat the action; the table's own is the one named here. */
    expect(within(table).getByRole('link', { name: 'Go Growth' })).toHaveAttribute(
      'href',
      '/signup/growth',
    );
  });

  it('applies an all-items style to every cell and a this-item style to one, this winning', () => {
    const { container } = renderTable(
      {
        partStyles: {
          'row.value': { className: 'ps-4' },
          'row.value@0.1': { className: 'ps-8', dir: 'ltr' },
        },
      },
      true,
    );
    const values = partsNamed(container, 'row.value');
    expect(values[0]).toHaveClass('ps-4', 'text-center');
    expect(values[0]).toHaveAttribute('dir', 'auto');
    expect(values[1]).toHaveClass('ps-8');
    expect(values[1]).not.toHaveClass('ps-4');
    expect(values[1]).toHaveAttribute('dir', 'ltr');
    for (const empty of partsNamed(container, 'emptyValue')) expect(empty).not.toHaveClass('ps-4');
  });

  it('gives text parts their own direction and leaves rows to the page', () => {
    const { container } = renderTable({}, false);
    expect(container.querySelector('tbody th')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('tbody tr')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderTable({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      emptyValue: swapped('emptyValue'),
      plans: props.plans.map((plan, index) => ({
        ...plan,
        name: swapped(`plans.${String(index)}.name`),
        actionLabel: swapped(`plans.${String(index)}.actionLabel`),
      })),
      rows: props.rows.map((row, index) => ({
        ...row,
        feature: swapped(`rows.${String(index)}.feature`),
        values: row.values.map((_, at) => swapped(`rows.${String(index)}.values.${String(at)}`)),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'emptyValue',
      'plans.0.name',
      'plans.1.actionLabel',
      'rows.1.feature',
      'rows.0.values.1',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});

// blocks-polish additions (2026-10-08)
describe('ComparisonTable phone card parts', () => {
  it('binds each card text to the same value the table cell edits', () => {
    const { container } = renderTable({}, true);
    const cards = container.querySelector<HTMLElement>('[data-comparison-cards]')!;
    const names = [...cards.querySelectorAll<HTMLElement>('[data-ck-part="plan.name"]')];
    expect(names.map((name) => name.dataset['ckBind'])).toEqual(['plans.0.name', 'plans.1.name']);
    const values = [...cards.querySelectorAll<HTMLElement>('[data-ck-part="row.value"]')];
    expect(values.map((value) => value.dataset['ckBind'])).toEqual(
      expect.arrayContaining(['rows.0.values.0', 'rows.0.values.1']),
    );
  });

  it('publishes cards without part markers', () => {
    const { container } = renderTable({}, false);
    expect(
      container.querySelector('[data-comparison-cards] [data-ck-part],[data-comparison-cards] [data-ck-bind]'),
    ).toBeNull();
  });
});
