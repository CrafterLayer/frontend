import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { MenuSection } from './MenuSection';
import { menuSectionExamples } from './examples';
import { menuSectionSchema } from './schema';

const node: Node = { id: 'menu', type: 'menuSection', props: {} };
const NBSP = ' ';
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

function renderMenu(overrides: Record<string, unknown> = {}) {
  return render(
    <MenuSection
      node={node}
      props={menuSectionSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

function prices(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-menu-price]')].map((price) => price.textContent);
}

describe('MenuSection', () => {
  it('renders categories as headings and dishes as list items with their prices', () => {
    const { container } = renderMenu({
      eyebrow: 'Fresh daily',
      body: 'Roasted on Mondays.',
      note: 'Prices include tax.',
    });
    expect(screen.getByRole('region', { name: 'Our menu' })).toHaveClass('@container');
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Coffee', 'Bakery']);
    const coffee = screen.getByRole('heading', { level: 3, name: 'Coffee' }).parentElement!;
    expect(within(coffee).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(prices(container)[0]).toBe('3.00');
    expect(screen.getByText('Prices include tax.')).toBeInTheDocument();
    expect(screen.getByText('Fresh daily')).toBeInTheDocument();
    expect(container.querySelector('[data-menu-columns]')).toHaveClass('@3xl:grid-cols-2');
  });

  it('isolates each price with its currency, a code after with a no-break space', () => {
    const { container } = renderMenu({
      currency: 'ر.س',
      categories: [{ name: 'Grill', items: [{ name: 'Kebab', price: '٤٢' }] }],
    });
    const price = container.querySelector('[data-menu-price]');
    expect(price?.firstElementChild?.tagName).toBe('BDI');
    expect(price?.textContent).toBe(`٤٢${NBSP}ر.س`);
    expect(price).toHaveClass('whitespace-nowrap', 'tabular-nums');
  });

  it('puts a symbol before the price tight, and a code before it spaced', () => {
    const one = [{ name: 'Tea', items: [{ name: 'Mint tea', price: '3' }] }];
    expect(
      prices(renderMenu({ currency: '$', currencyPosition: 'before', categories: one }).container),
    ).toEqual(['$3']);
    expect(
      prices(
        renderMenu({ currency: 'AED', currencyPosition: 'before', categories: one }).container,
      ),
    ).toEqual([`AED${NBSP}3`]);
    expect(prices(renderMenu({ currency: '  ', categories: one }).container)).toEqual(['3']);
  });

  it('draws dotted leaders to an end-aligned price, or none, or a price inline after the name', () => {
    const dotted = renderMenu().container.querySelector('[data-menu-leader]');
    expect(dotted).toHaveAttribute('data-menu-leader', 'dotted');
    expect(dotted).toHaveClass('border-dotted', 'flex-1');
    expect(dotted).toHaveAttribute('aria-hidden', 'true');
    const plain = renderMenu({ leaders: false }).container.querySelector('[data-menu-leader]');
    expect(plain).toHaveAttribute('data-menu-leader', 'none');
    expect(plain).not.toHaveClass('border-dotted');
    const inline = renderMenu({ priceAlign: 'inline' }).container;
    expect(inline.querySelector('[data-menu-leader]')).toBeNull();
  });

  it('lists tags and shows a photo unless photos are turned off', () => {
    const categories = [
      {
        name: 'Mains',
        items: [
          {
            name: 'Mansaf',
            price: '12',
            tags: ['Signature', 'Spicy'],
            imageSrc: PHOTO,
            imageAlt: 'Mansaf on rice',
          },
        ],
      },
    ];
    renderMenu({ categories });
    expect(screen.getByRole('img', { name: 'Mansaf on rice' })).toHaveAttribute('loading', 'lazy');
    const tags = screen.getByText('Signature').closest('ul') as HTMLElement;
    expect(
      within(tags)
        .getAllByRole('listitem')
        .map((tag) => tag.textContent),
    ).toEqual(['Signature', 'Spicy']);
    const hidden = renderMenu({ categories, showImages: false, columns: '1' });
    expect(within(hidden.container).queryByRole('img')).toBeNull();
    expect(hidden.container.querySelector('[data-menu-columns]')).not.toHaveClass(
      '@3xl:grid-cols-2',
    );
  });

  it('keeps secondary text legible on a dark section', () => {
    renderMenu({ tone: 'dark', body: 'Intro.' });
    expect(screen.getByText('Intro.')).toHaveClass('opacity-80');
    expect(screen.getByText('A double shot, house blend.')).toHaveClass('opacity-80');
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderMenu({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', { name: 'Our menu' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('MenuSection schema', () => {
  it('defaults to a two-category café sample with no currency and maps every inspector prop', () => {
    const defaults = menuSectionSchema.props.parse({});
    expect(defaults.categories).toHaveLength(2);
    expect(defaults).toMatchObject({
      currency: '',
      currencyPosition: 'after',
      priceAlign: 'end',
      leaders: true,
    });
    expect(Object.keys(menuSectionSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(menuSectionSchema.props.shape).sort(),
    );
  });

  it('bounds the menu and refuses an unsafe photo', () => {
    const parse = (props: unknown) => menuSectionSchema.props.safeParse(props).success;
    expect(parse({ categories: Array.from({ length: 9 }, () => ({ name: 'C' })) })).toBe(false);
    expect(
      parse({
        categories: [
          { name: 'C', items: [{ name: 'N', price: '1', imageSrc: 'javascript:alert(1)' }] },
        ],
      }),
    ).toBe(false);
    expect(
      parse({
        categories: [
          { name: 'C', items: [{ name: 'N', price: '1', tags: ['a', 'b', 'c', 'd', 'e'] }] },
        ],
      }),
    ).toBe(false);
    expect(parse({ currency: 'a currency far too long' })).toBe(false);
    expect(
      menuSectionSchema.props.parse({ categories: [{ name: 'C' }] }).categories[0]?.items,
    ).toEqual([]);
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of menuSectionExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('menuSection');
      expect(menuSectionSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(
        true,
      );
    }
    expect(menuSectionExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
