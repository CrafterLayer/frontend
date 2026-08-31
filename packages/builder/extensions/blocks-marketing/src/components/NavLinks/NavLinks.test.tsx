import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionCustomGroups } from '../section-custom';
import { sectionColorGroups } from '../section-color';
import { sectionMotionGroups } from '../section-motion';
import { sectionSpacingGroups } from '../section-spacing';
import { sectionTypographyGroups } from '../section-typography';
import { NavLinks } from './NavLinks';
import { navLinksSchema } from './schema';

const node: Node = { id: 'nav-links', type: 'navLinks', props: {} };

describe('NavLinks', () => {
  it('renders a labelled navigation list of real links with the design utilities', () => {
    render(
      <NavLinks
        node={node}
        props={navLinksSchema.props.parse({
          links: [
            { label: 'About', href: '/about' },
            { label: 'Pricing', href: '/pricing' },
          ],
          direction: 'column',
          style: 'pill',
          textCase: 'uppercase',
          fontWeight: 'semibold',
          gap: 'lg',
          wrap: 'nowrap',
          background: 'surfaceInverse',
          textColor: 'textInverse',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const navigation = screen.getByRole('navigation', { name: 'Navigation links' });
    expect(navigation).toHaveClass('mkt-type--case-uppercase', 'mkt-type--weight-semibold');
    expect(navigation.firstElementChild).toHaveClass(
      'flex-col',
      'items-start',
      'gap-gap-lg',
      'flex-nowrap',
    );
    expect(screen.getByRole('link', { name: 'About' })).toHaveClass(
      'rounded-base',
      'border-current',
      'px-control-inline-sm',
      'py-control-block-sm',
    );
    expect(navigation).toHaveStyle({
      background: 'var(--t-surface-inverse)',
      color: 'var(--t-text-inverse)',
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the empty editing hint on the canvas without creating a navigation landmark', () => {
    const { rerender } = render(
      <NavLinks node={node} props={navLinksSchema.props.parse({})} slots={{}} data={{}} isCanvas />,
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    let hint = screen.getByText('This block has no links yet.');
    expect(hint).toHaveClass(
      'rounded-base',
      'bg-text-muted/10',
      'p-gap-sm',
      'text-center',
      'text-text-muted',
    );
    expect(hint).not.toHaveAttribute('style');

    rerender(
      <NavLinks
        node={node}
        props={navLinksSchema.props.parse({
          textColor: 'textMuted',
          textAlign: 'center',
          marginInlineStart: 2,
        })}
        slots={{}}
        data={{}}
        isCanvas
      />,
    );

    hint = screen.getByText('This block has no links yet.');
    expect(hint).toHaveClass('mkt-type--align-center');
    expect(hint.style.color).toBe('var(--t-text-muted)');
    expect(hint.style.marginInlineStart).toBe('calc(var(--t-space-unit, 4px) * 2)');
  });

  it('renders no editing scaffold or landmark for an empty published block', () => {
    const { container } = render(
      <NavLinks
        node={node}
        props={navLinksSchema.props.parse({})}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('This block has no links yet.')).not.toBeInTheDocument();
  });

  it('applies shared typography and spacing with colour roles on the navigation root', () => {
    render(
      <NavLinks
        node={node}
        props={navLinksSchema.props.parse({
          links: [{ label: 'Docs', href: '/docs' }],
          background: 'accent',
          fontFamily: 'mono',
          paddingBlockStart: 4,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const navigation = screen.getByRole('navigation', { name: 'Navigation links' });
    expect(navigation).toHaveClass('mkt-type--family-mono');
    expect(navigation.style.background).toBe('var(--t-accent)');
    expect(navigation.style.paddingBlockStart).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });

  it('maps persisted NavLinks typography to shared classes without restoring schema controls', () => {
    const legacyNode = { ...node, props: { textCase: 'uppercase', weight: 'regular' } };
    const { rerender } = render(
      <NavLinks
        node={legacyNode}
        props={navLinksSchema.props.parse({
          links: [{ label: 'Legacy docs', href: '/legacy' }],
          textCase: 'uppercase',
          weight: 'regular',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const navigation = screen.getByRole('navigation', { name: 'Navigation links' });
    expect(navigation).toHaveClass(
      'mkt-type--case-uppercase',
      'mkt-type--letter-spacing-wide',
      'mkt-type--weight-regular',
    );
    expect(navLinksSchema.props.shape).not.toHaveProperty('weight');

    rerender(
      <NavLinks
        node={legacyNode}
        props={navLinksSchema.props.parse({
          links: [{ label: 'Legacy docs', href: '/legacy' }],
          fontWeight: 'bold',
          textCase: 'uppercase',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(navigation).toHaveClass(
      'mkt-type--case-uppercase',
      'mkt-type--letter-spacing-wide',
      'mkt-type--weight-bold',
    );
    expect(navigation).not.toHaveClass('mkt-type--weight-regular');
  });

  it('schema: enforces defaults, enums, surfaces, and an inspector group for every property', () => {
    expect(navLinksSchema.type).toBe('navLinks');
    expect(navLinksSchema.surfaces).toEqual(['site', 'store', 'docs']);
    const defaults = navLinksSchema.props.parse({});
    expect(defaults).toStrictEqual({
      links: [],
      direction: 'row',
      style: 'plain',
      gap: 'md',
      wrap: 'wrap',
    });

    const optionalSharedStyleProps = [
      'background',
      'textColor',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
      'textAlign',
      'textCase',
      'paddingBlockStart',
      'paddingBlockEnd',
      'paddingInlineStart',
      'paddingInlineEnd',
      'marginBlockStart',
      'marginBlockEnd',
      'marginInlineStart',
      'marginInlineEnd',
    ] as const;
    for (const property of optionalSharedStyleProps) {
      expect(navLinksSchema.props.shape).toHaveProperty(property);
      expect(navLinksSchema.propertyGroups).toHaveProperty(property);
      expect(defaults).not.toHaveProperty(property);
    }
    expect(navLinksSchema.props.shape).not.toHaveProperty('weight');
    expect(navLinksSchema.propertyGroups).not.toHaveProperty('weight');

    const accepted = [
      ...['row', 'column'].map((direction) => ({ direction })),
      ...['plain', 'underline', 'pill'].map((style) => ({ style })),
      ...['sans', 'serif', 'mono'].map((fontFamily) => ({ fontFamily })),
      ...['xs', 'sm', 'base', 'lg', 'xl', 'xxl'].map((fontSize) => ({ fontSize })),
      ...['regular', 'medium', 'semibold', 'bold'].map((fontWeight) => ({ fontWeight })),
      ...['tight', 'normal', 'relaxed'].map((lineHeight) => ({ lineHeight })),
      ...['tight', 'normal', 'wide'].map((letterSpacing) => ({ letterSpacing })),
      ...['start', 'center', 'end'].map((textAlign) => ({ textAlign })),
      ...['normal', 'uppercase'].map((textCase) => ({ textCase })),
      ...['none', 'sm', 'md', 'lg'].map((gap) => ({ gap })),
      ...['nowrap', 'wrap'].map((wrap) => ({ wrap })),
      { paddingBlockStart: 64 },
      { marginInlineEnd: -32 },
    ];
    for (const candidate of accepted) {
      expect(navLinksSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
        true,
      );
    }

    const rejected = [
      { direction: 'grid' },
      { style: 'button' },
      { textCase: 'capitalize' },
      { fontWeight: 'black' },
      { gap: 'xl' },
      { wrap: 'balance' },
      { paddingBlockStart: 65 },
      { marginInlineEnd: -33 },
    ];
    for (const candidate of rejected) {
      expect(navLinksSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
        false,
      );
    }

    expect(navLinksSchema.propertyGroups).toEqual({
      links: { tab: 'content', section: 'Links' },
      direction: { tab: 'design', section: 'Layout' },
      style: { tab: 'design', section: 'Style' },
      gap: { tab: 'design', section: 'Spacing' },
      wrap: { tab: 'advanced', section: 'Layout' },
      ...sectionColorGroups,
      ...sectionMotionGroups,
      ...sectionTypographyGroups,
      ...sectionSpacingGroups,
      ...sectionCustomGroups,
    });
    expect(Object.keys(navLinksSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(navLinksSchema.props.shape).sort(),
    );
  });

  it('schema rejects malformed links and more than ten entries', () => {
    const validLinks = Array.from({ length: 10 }, (_, index) => ({
      label: `Link ${String(index + 1)}`,
      href: `/link-${String(index + 1)}`,
    }));

    expect(navLinksSchema.props.safeParse({ links: validLinks }).success).toBe(true);
    expect(
      navLinksSchema.props.safeParse({
        links: [...validLinks, { label: 'Link 11', href: '/link-11' }],
      }).success,
    ).toBe(false);
    expect(navLinksSchema.props.safeParse({ links: [{ label: '', href: '/' }] }).success).toBe(
      false,
    );
    expect(
      navLinksSchema.props.safeParse({ links: [{ label: 'x'.repeat(25), href: '/' }] }).success,
    ).toBe(false);
    expect(navLinksSchema.props.safeParse({ links: [{ label: 'Home', href: '' }] }).success).toBe(
      false,
    );
    expect(
      navLinksSchema.props.safeParse({ links: [{ label: 'Home', href: 'x'.repeat(201) }] }).success,
    ).toBe(false);
    expect(
      navLinksSchema.props.safeParse({
        links: [{ label: 'Unsafe', href: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
  });
});
