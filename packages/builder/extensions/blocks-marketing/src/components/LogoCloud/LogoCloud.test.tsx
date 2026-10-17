import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { LogoCloud } from './LogoCloud';
import { logoCloudSchema } from './schema';

const node: Node = { id: 'logos', type: 'logoCloud', props: {} };

describe('LogoCloud', () => {
  it('renders a labelled section with one semantic list item per brand', () => {
    render(
      <LogoCloud
        node={node}
        props={logoCloudSchema.props.parse({
          eyebrow: 'Customer proof',
          heading: 'Trusted by focused teams',
          columns: '3',
          items: [
            { name: 'Northstar', descriptor: 'Analytics' },
            { name: 'Canopy', descriptor: 'Collaboration' },
            { name: 'Arcform' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Trusted by focused teams' })).toHaveClass(
      '@container',
      'bg-surface',
    );
    expect(screen.getByRole('list')).toHaveClass('grid', 'grid-cols-2', '@lg:grid-cols-3');
    expect(screen.getByRole('list')).not.toHaveClass('grid-cols-1');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Northstar')).toHaveClass('break-words');
    expect(screen.getByText('Northstar')).not.toHaveClass('truncate');
    expect(screen.getByText('Northstar').closest('li')).toHaveClass(
      'rounded-xl',
      'px-3',
      '@md:px-5',
      'shadow-soft',
    );
    expect(screen.getByText('Analytics')).toBeVisible();
  });

  it('renders an intentional empty state without invented brand placeholders', () => {
    const { container } = render(
      <LogoCloud
        node={node}
        props={logoCloudSchema.props.parse({ heading: 'Partner network', items: [] })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Partner network' })).toBeVisible();
    expect(container.querySelectorAll('[data-logo-cloud-item]')).toHaveLength(0);
  });

  it('applies variant and optional section design controls', () => {
    render(
      <LogoCloud
        node={node}
        props={logoCloudSchema.props.parse({
          heading: 'Styled partners',
          items: [{ name: 'Kinetic' }],
          variant: 'framed',
          textColor: 'accentText',
          paddingInlineStart: 3,
          fontFamily: 'serif',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled partners' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.color).toBe('var(--t-accent-text)');
    expect(section.style.paddingInlineStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
    expect(screen.getByRole('list')).toHaveClass('rounded-xl', 'shadow-soft');
    expect(screen.getByText('Kinetic').closest('li')).toHaveClass('bg-surface/80');
  });

  it('provides polished defaults and rejects malformed brand data', () => {
    const props = logoCloudSchema.props.parse({});
    expect(props.items).toHaveLength(6);
    expect(props).toMatchObject({
      variant: 'cards',
      columns: '6',
      align: 'center',
      tone: 'light',
      spacing: 'md',
      width: 'wide',
    });
    expect(logoCloudSchema.props.safeParse({ items: [{ name: '' }] }).success).toBe(false);
    expect(logoCloudSchema.props.safeParse({ columns: '7' }).success).toBe(false);
  });

  it('shows a brand’s logo image in place of its monogram, the name still visible', () => {
    const { container } = render(
      <LogoCloud
        node={node}
        props={logoCloudSchema.props.parse({
          heading: 'Pay your way',
          items: [
            { name: 'Visa', logo: 'https://cdn.simpleicons.org/visa' },
            { name: 'Northstar' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={true}
      />,
    );

    const logos = container.querySelectorAll('[data-logo-cloud-logo]');
    expect(logos).toHaveLength(1);
    const logo = logos[0];
    expect(logo).toHaveAttribute('src', 'https://cdn.simpleicons.org/visa');
    // Decorative: the brand's name is the text beside it.
    expect(logo).toHaveAttribute('alt', '');
    expect(logo).toHaveAttribute('data-ck-part', 'item.logo');
    expect(logo).toHaveAttribute('data-ck-bind', 'items.0.logo');
    expect(logo).toHaveClass('object-contain');
    expect(screen.getByText('Visa')).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();
    // The brand without a logo keeps its monogram.
    expect(screen.getByText('N')).toBeInTheDocument();
  });

  it('accepts the art catalog’s addresses as logos and refuses unsafe ones', () => {
    const accepts = (logo: string) =>
      logoCloudSchema.props.safeParse({ items: [{ name: 'Brand', logo }] }).success;
    // The three shapes the agent's art catalog writes (builder-ai art-catalog/art-url.ts).
    expect(accepts('https://cdn.simpleicons.org/stripe')).toBe(true);
    expect(accepts('https://cdn.simpleicons.org/visa/ffffff')).toBe(true);
    expect(
      accepts(
        'https://api.dicebear.com/9.x/lorelei/svg?seed=%D8%B3%D8%A7%D8%B1%D8%A9&backgroundColor=f4e3d7',
      ),
    ).toBe(true);
    expect(accepts('https://api.iconify.design/fluent-emoji-flat/hot-beverage.svg')).toBe(true);
    expect(accepts('/uploads/our-partner.png')).toBe(true);
    // SVG data URLs and scripts stay refused.
    expect(accepts('data:image/svg+xml;base64,PHN2Zy8+')).toBe(false);
    expect(accepts('javascript:alert(1)')).toBe(false);
    expect(accepts('//cdn.simpleicons.org/visa')).toBe(false);
  });

  it('keeps every requested density readable through container-aware breakpoints', () => {
    const props = logoCloudSchema.props.parse({ items: [{ name: 'Northstar' }] });
    const columns = ['3', '4', '5', '6'] as const;
    const { container } = render(
      <>
        {columns.map((count) => (
          <LogoCloud
            key={count}
            node={{ ...node, id: `logos-${count}` }}
            props={{ ...props, columns: count }}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        ))}
      </>,
    );

    const wideBreakpoints = {
      '3': '@lg:grid-cols-3',
      '4': '@3xl:grid-cols-4',
      '5': '@4xl:grid-cols-5',
      '6': '@5xl:grid-cols-6',
    } as const;
    for (const count of columns) {
      const grid = container.querySelector(
        `[aria-labelledby="logos-${count}-heading"] [data-logo-cloud-grid]`,
      );
      /* blocks-polish 2026-10-08: two logos a row on a phone, never one. */
      expect(grid).toHaveClass('grid-cols-2', wideBreakpoints[count]);
      expect(grid).not.toHaveClass('grid-cols-1');
      /* Three a row from 32rem, except four logos, which go 2 → 4 with no orphan. */
      if (count === '4') expect(grid).not.toHaveClass('@lg:grid-cols-3');
      else expect(grid).toHaveClass('@lg:grid-cols-3');
    }
  });
});
