import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Fundraiser } from './Fundraiser';
import { fundraiserSchema, type FundraiserProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, the currency beside both
  amounts, the words around them, every stat, every preset amount, the
  button, the note and the photo are addressable on the canvas, carry nothing
  extra when published, and render an inline editor at its bind exactly once.
*/
const node: Node = { id: 'appeal-parts', type: 'fundraiser', props: {} };
const FULL = {
  eyebrow: 'Appeal',
  body: 'Every gift counts.',
  amounts: [
    { label: '$25', href: '/d?a=25' },
    { label: '$50', href: '/d?a=50' },
  ],
  note: 'Tax-deductible.',
  imageSrc: '/assets/photo.jpg',
  imageAlt: 'Pupils reading',
  layout: 'split',
};

type Swap = (props: FundraiserProps) => FundraiserProps;

function renderBlock(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = fundraiserSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Fundraiser node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('Fundraiser parts', () => {
  it('stamps the currency beside both amounts and every word around them', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'currency')).toHaveLength(2);
    expect(partsNamed(container, 'raisedLabel')[0]).toHaveAttribute('data-ck-bind', 'raisedLabel');
    expect(partsNamed(container, 'goalLabel')[0]).toHaveAttribute('data-ck-bind', 'goalLabel');
    expect(partsNamed(container, 'stat.value')[1]).toHaveAttribute('data-ck-bind', 'stats.1.value');
    expect(partsNamed(container, 'amount')[1]).toHaveAttribute('data-ck-bind', 'amounts.1.label');
    for (const name of ['stats', 'amounts', 'action', 'note', 'image']) {
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
          'stat.label': { className: 'uppercase' },
          'stat.label@1': { className: 'normal-case', dir: 'rtl' },
        },
      },
      true,
    );
    const labels = partsNamed(container, 'stat.label');
    expect(labels[0]).toHaveClass('uppercase');
    expect(labels[1]).toHaveClass('normal-case');
    expect(labels[1]).toHaveAttribute('dir', 'rtl');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderBlock({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      currency: swapped('currency'),
      raisedLabel: swapped('raisedLabel'),
      stats: props.stats.map((stat, index) => ({
        ...stat,
        label: swapped(`stats.${String(index)}.label`),
      })),
      amounts: props.amounts.map((option, index) => ({
        ...option,
        label: swapped(`amounts.${String(index)}.label`),
      })),
      actionLabel: swapped('actionLabel'),
      note: swapped('note'),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'currency',
      'raisedLabel',
      'stats.1.label',
      'amounts.0.label',
      'actionLabel',
      'note',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
