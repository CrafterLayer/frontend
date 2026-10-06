import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ProductGrid } from './ProductGrid';
import { productGridSchema, type ProductGridProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, each product card, its image,
  badge, name, description and prices are addressable on the canvas, carry
  nothing extra when published, take classes and direction from `partStyles`,
  and render an inline editor swapped in at its bind exactly where the text was.
*/
const node: Node = { id: 'products-parts', type: 'productGrid', props: {} };

const FULL = {
  eyebrow: 'New collection',
  heading: 'Shop the collection.',
  body: 'Objects made for everyday use.',
  products: [
    {
      name: 'Arc task lamp',
      description: 'Warm, focused light for a calmer desk.',
      price: '$189',
      originalPrice: '$219',
      imageSrc: '/lamp.jpg',
      imageAlt: 'Black task lamp on an oak desk',
      badge: 'Bestseller',
      href: '/products/lamp',
      rating: 4.9,
      reviewCount: 128,
    },
    { name: 'Still carafe', price: '$92', href: '/products/carafe' },
  ],
};

type Swap = (props: ProductGridProps) => ProductGridProps;

function renderProducts(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = productGridSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<ProductGrid node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('ProductGrid parts', () => {
  it('stamps each part instance with its index and bind on the canvas', () => {
    const { container } = renderProducts({}, true);
    expect(partsNamed(container, 'products')[0]).toHaveAttribute('data-ck-bind', 'products');
    expect(partsNamed(container, 'product')[1]).toHaveAttribute('data-ck-bind', 'products.1');
    expect(partsNamed(container, 'product.name').map((name) => name.dataset['ckBind'])).toEqual([
      'products.0.name',
      'products.1.name',
    ]);
    expect(partsNamed(container, 'product.price')[1]).toHaveTextContent('$92');
    expect(partsNamed(container, 'product.image')[0]).toHaveAttribute(
      'data-ck-bind',
      'products.0.imageSrc',
    );
    for (const name of ['product.badge', 'product.description', 'product.originalPrice']) {
      expect(partsNamed(container, name), name).toHaveLength(1);
    }
    expect(partsNamed(container, 'product.link')[0]).toHaveAttribute(
      'data-ck-bind',
      'products.0.name',
    );
    expect(partsNamed(container, 'actionLabel')).toHaveLength(2);
  });

  it('publishes no part markers and names each button through its label and the product', () => {
    const { container } = renderProducts({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'View product Still carafe' })).toHaveAttribute(
      'href',
      '/products/carafe',
    );
    expect(container.querySelector('a[aria-label]')).toBeNull();
  });

  it('applies an all-items style to every price and a this-item style to one, this winning', () => {
    const { container } = renderProducts(
      {
        partStyles: {
          'product.price': { className: 'ps-4' },
          'product.price@1': { className: 'ps-8', dir: 'ltr' },
        },
      },
      true,
    );
    const prices = partsNamed(container, 'product.price');
    expect(prices[0]).toHaveClass('ps-4', 'font-bold');
    expect(prices[0]).toHaveAttribute('dir', 'auto');
    expect(prices[1]).toHaveClass('ps-8');
    expect(prices[1]).not.toHaveClass('ps-4');
    expect(prices[1]).toHaveAttribute('dir', 'ltr');
  });

  it('gives text parts their own direction and leaves cards to the page', () => {
    const { container } = renderProducts({}, false);
    expect(container.querySelector('h3')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('del')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('[data-product-card]')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderProducts({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      actionLabel: swapped('actionLabel'),
      products: props.products.map((product, index) => ({
        ...product,
        name: swapped(`products.${String(index)}.name`),
        price: swapped(`products.${String(index)}.price`),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'actionLabel',
      'products.0.name',
      'products.1.name',
      'products.1.price',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
