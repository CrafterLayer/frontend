import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ProductGrid } from './ProductGrid';
import { productGridSchema } from './schema';

const node: Node = { id: 'products', type: 'productGrid', props: {} };

const products = [
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
    featured: true,
  },
  {
    name: 'Still carafe',
    price: '$92',
    href: '/products/carafe',
  },
];

function renderProducts(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <ProductGrid
      node={node}
      props={productGridSchema.props.parse({
        heading: 'Shop the collection',
        products,
        ...overrides,
      })}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('ProductGrid', () => {
  it('renders semantic products with pricing, badges, lazy imagery, ratings, and actions', () => {
    renderProducts({ eyebrow: 'New collection', body: 'Objects made for everyday use.' });

    expect(screen.getByRole('region', { name: 'Shop the collection' })).toHaveClass('@container');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Black task lamp on an oak desk' })).toHaveAttribute(
      'loading',
      'lazy',
    );
    expect(screen.getByText('Bestseller')).toBeInTheDocument();
    expect(screen.getByText('$219')).toHaveProperty('tagName', 'DEL');
    expect(
      screen.getByRole('img', { name: 'Rated 4.9 out of 5, 128 reviews' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View product Arc task lamp' })).toHaveAttribute(
      'href',
      '/products/lamp',
    );
    expect(screen.getByText('Arc task lamp').closest('article')).toHaveClass(
      'rounded-xl',
      'shadow-soft',
      'motion-reduce:transition-none',
    );
  });

  it('promotes exactly the authored featured product and keeps the remaining cards standard', () => {
    renderProducts({ variant: 'featured', columns: '3' });

    expect(screen.getAllByRole('article')[0]).toHaveAttribute('data-product-card', 'featured');
    expect(screen.getAllByRole('article')[0]).toHaveClass('@lg:grid-cols-2', 'border-accent');
    expect(screen.getAllByRole('article')[1]).toHaveAttribute('data-product-card', 'standard');
  });

  it('falls back to the first product when no featured product is authored', () => {
    renderProducts({
      variant: 'featured',
      products: products.map((product) => ({ ...product, featured: false })),
    });

    expect(screen.getAllByRole('article')[0]).toHaveAttribute('data-product-card', 'featured');
    expect(screen.getAllByRole('article')[1]).toHaveAttribute('data-product-card', 'standard');
  });

  it('can hide ratings and renders a decorative initial for missing product imagery', () => {
    renderProducts({ showRatings: false });
    expect(screen.queryByRole('img', { name: /Rated/ })).not.toBeInTheDocument();
    expect(screen.getByText('S', { selector: '[aria-hidden="true"]' })).toBeInTheDocument();
    expect(screen.getByText('Still carafe')).toBeInTheDocument();
  });

  it('uses an authored localized rating label as the complete accessible name', () => {
    renderProducts({
      products: [
        {
          ...products[0],
          ratingLabel: 'تقييم ٤٫٩ من ٥، بناءً على ١٢٨ مراجعة',
        },
      ],
    });

    expect(
      screen.getByRole('img', { name: 'تقييم ٤٫٩ من ٥، بناءً على ١٢٨ مراجعة' }),
    ).toBeInTheDocument();
  });

  it('renders the authored fractional rating rather than rounding to whole stars', () => {
    renderProducts({ products: [{ ...products[0], rating: 4.7 }] });

    const rating = screen.getByRole('img', { name: 'Rated 4.7 out of 5, 128 reviews' });
    expect(rating.querySelector('[data-rating-fill="0.7"]')).toBeInTheDocument();
  });

  it('renders a professional empty state on canvas only', () => {
    const { rerender } = renderProducts({ products: [] }, true);
    expect(
      screen.getByText('Add products to build a polished, shoppable collection.'),
    ).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    rerender(
      <ProductGrid
        node={node}
        props={productGridSchema.props.parse({ heading: 'Shop the collection', products: [] })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(
      screen.queryByText('Add products to build a polished, shoppable collection.'),
    ).not.toBeInTheDocument();
  });

  it('preserves product anchors but prevents navigation on the builder canvas', () => {
    renderProducts({}, true);
    const action = screen.getByRole('link', { name: 'View product Arc task lamp' });
    expect(action).toHaveAttribute('href', '/products/lamp');
    expect(fireEvent.click(action)).toBe(false);
  });

  it('combines shared token colour, typography, and logical spacing on the section', () => {
    renderProducts({ background: 'surfaceInverse', fontSize: 'lg', marginInlineEnd: 3 });
    const section = screen.getByRole('region', { name: 'Shop the collection' });
    expect(section).toHaveClass('mkt-type--size-lg');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 3)');
  });

  it('rejects unsafe links and invalid ratings while exposing every prop to the inspector', () => {
    const defaults = productGridSchema.props.parse({});
    expect(defaults).toMatchObject({
      actionLabel: 'View product',
      columns: '4',
      heading: 'Featured products',
      imageRatio: 'square',
      products: [],
      ratingPrefix: 'Rated',
      ratingSuffix: 'out of 5',
      reviewCountLabel: 'reviews',
      showRatings: true,
      spacing: 'lg',
      variant: 'grid',
      width: 'wide',
    });
    expect(Object.keys(productGridSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(productGridSchema.props.shape).sort(),
    );
    expect(
      productGridSchema.props.safeParse({
        products: [{ name: 'Unsafe', price: '$10', href: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(
      productGridSchema.props.safeParse({
        products: [{ name: 'Unsafe', price: '$10', href: '/\\evil.example/product' }],
      }).success,
    ).toBe(false);
    expect(
      productGridSchema.props.safeParse({
        products: [
          {
            name: 'Executable image',
            price: '$10',
            imageSrc: 'javascript:alert(1)',
            href: '/',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      productGridSchema.props.safeParse({
        products: [
          {
            name: 'Unsafe image',
            price: '$10',
            imageSrc: '//evil.example/product.jpg',
            href: '/',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      productGridSchema.props.safeParse({
        products: [
          {
            name: 'Unsafe image',
            price: '$10',
            imageSrc: '/\\evil.example/product.jpg',
            href: '/',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      productGridSchema.props.safeParse({
        products: [{ name: 'Unsafe', price: '$10', href: '//evil.example/product' }],
      }).success,
    ).toBe(false);
    expect(
      productGridSchema.props.safeParse({
        products: [{ name: 'Invalid rating', price: '$10', href: '/', rating: 5.1 }],
      }).success,
    ).toBe(false);
  });
});
