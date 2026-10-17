import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { MenuSection } from './MenuSection';
import { menuSectionSchema, type MenuSectionProps } from './schema';

/*
  Block parts (DESIGN §4.3): every category and its name, every dish and its
  name, description, price, tags and photo are addressable on the canvas by
  category and position, carry nothing extra when published, take classes
  from `partStyles`, and render an inline editor swapped in exactly once.
  The currency is one prop printed beside every price: each copy is its part,
  and while it is edited in place only the first dish's copy hosts the editor.
*/
const node: Node = { id: 'menu-parts', type: 'menuSection', props: {} };
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const FULL = {
  note: 'Prices include tax.',
  currency: 'ر.س',
  categories: [
    {
      name: 'Grill',
      description: 'Over charcoal.',
      items: [{ name: 'Kebab', price: '42', tags: ['Popular'], imageSrc: PHOTO }],
    },
    {
      name: 'Sides',
      items: [
        { name: 'Hummus', description: 'With tahini.', price: '14' },
        { name: 'Salad', price: '12' },
      ],
    },
  ],
};

type Swap = (props: MenuSectionProps) => MenuSectionProps;

function renderMenu(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = menuSectionSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<MenuSection node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('MenuSection parts', () => {
  it('addresses every dish by category and position', () => {
    const { container } = renderMenu({}, true);
    expect(partsNamed(container, 'categories')[0]).toHaveAttribute('data-menu-columns', '2');
    expect(partsNamed(container, 'category.name')[1]).toHaveAttribute(
      'data-ck-bind',
      'categories.1.name',
    );
    expect(partsNamed(container, 'category.items')[1]?.tagName).toBe('UL');
    expect(partsNamed(container, 'dish').map((dish) => dish.dataset['ckPartIndex'])).toEqual([
      '0.0',
      '1.0',
      '1.1',
    ]);
    expect(partsNamed(container, 'dish.price')[2]).toHaveAttribute(
      'data-ck-bind',
      'categories.1.items.1.price',
    );
    expect(partsNamed(container, 'dish.tag')[0]).toHaveAttribute(
      'data-ck-bind',
      'categories.0.items.0.tags.0',
    );
    expect(partsNamed(container, 'dish.image')[0]).toHaveAttribute(
      'data-ck-bind',
      'categories.0.items.0.imageSrc',
    );
    expect(partsNamed(container, 'dish.description')[0]).toHaveAttribute(
      'data-ck-bind',
      'categories.1.items.0.description',
    );
    expect(partsNamed(container, 'note')[0]).toHaveTextContent('Prices include tax.');
    const currencies = partsNamed(container, 'currency');
    expect(currencies).toHaveLength(3);
    expect(currencies.every((currency) => currency.textContent === 'ر.س')).toBe(true);
    expect(currencies[2]).toHaveAttribute('data-ck-bind', 'currency');
  });

  it('publishes no part markers', () => {
    const { container } = renderMenu({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('applies an all-items style and a this-item style, this winning', () => {
    const { container } = renderMenu(
      {
        partStyles: {
          'dish.price': { className: 'text-accent' },
          'dish.price@1.1': { className: 'text-success' },
        },
      },
      true,
    );
    const priceParts = partsNamed(container, 'dish.price');
    expect(priceParts[0]).toHaveClass('text-accent');
    expect(priceParts[2]).toHaveClass('text-success');
    expect(priceParts[2]).not.toHaveClass('text-accent');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderMenu({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      currency: swapped('currency'),
      categories: props.categories.map((category, at) => ({
        ...category,
        name: swapped(`categories.${String(at)}.name`),
        items: category.items.map((item, index) => ({
          ...item,
          name: swapped(`categories.${String(at)}.items.${String(index)}.name`),
          price: swapped(`categories.${String(at)}.items.${String(index)}.price`),
        })),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'categories.1.name',
      'categories.1.items.1.name',
      'categories.0.items.0.price',
      'currency',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });

  it('hosts the currency editor at the first dish, past an empty category', () => {
    const { container } = renderMenu(
      { categories: [{ name: 'Soon', items: [] }, ...FULL.categories] },
      true,
      (props) => ({ ...props, currency: swapped('currency') }),
    );
    const found = container.querySelectorAll('[data-swap="currency"]');
    expect(found).toHaveLength(1);
    expect(found[0]?.closest('[data-ck-part="dish"]')).toHaveAttribute('data-ck-part-index', '1.0');
    expect(partsNamed(container, 'currency')).toHaveLength(3);
  });
});
