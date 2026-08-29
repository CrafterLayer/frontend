import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { NavLinks } from './NavLinks';
import { navLinksSchema } from './schema';

const node: Node = { id: 'nav-links', type: 'navLinks', props: {} };

describe('NavLinks', () => {
  it('renders a labelled navigation list of real links with the design modifiers', () => {
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
          weight: 'semibold',
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
    expect(navigation).toHaveClass(
      'mkt-nav-links--direction-column',
      'mkt-nav-links--style-pill',
      'mkt-nav-links--case-uppercase',
      'mkt-nav-links--weight-semibold',
      'mkt-nav-links--gap-lg',
      'mkt-nav-links--wrap-nowrap',
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
    render(
      <NavLinks node={node} props={navLinksSchema.props.parse({})} slots={{}} data={{}} isCanvas />,
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByText('This block has no links yet.')).toHaveClass('mkt-section__hint');
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

  it('schema: enforces defaults, enums, surfaces, and an inspector group for every property', () => {
    expect(navLinksSchema.type).toBe('navLinks');
    expect(navLinksSchema.surfaces).toEqual(['site', 'store', 'docs']);
    expect(navLinksSchema.props.parse({})).toStrictEqual({
      links: [],
      direction: 'row',
      style: 'plain',
      textCase: 'normal',
      weight: 'medium',
      gap: 'md',
      wrap: 'wrap',
    });

    const accepted = [
      ...['row', 'column'].map((direction) => ({ direction })),
      ...['plain', 'underline', 'pill'].map((style) => ({ style })),
      ...['normal', 'uppercase'].map((textCase) => ({ textCase })),
      ...['regular', 'medium', 'semibold'].map((weight) => ({ weight })),
      ...['none', 'sm', 'md', 'lg'].map((gap) => ({ gap })),
      ...['nowrap', 'wrap'].map((wrap) => ({ wrap })),
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
      { weight: 'bold' },
      { gap: 'xl' },
      { wrap: 'balance' },
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
      textCase: { tab: 'design', section: 'Typography' },
      weight: { tab: 'design', section: 'Typography' },
      gap: { tab: 'design', section: 'Spacing' },
      wrap: { tab: 'advanced', section: 'Layout' },
      background: { tab: 'design', section: 'Colour', kind: 'color-role' },
      textColor: { tab: 'design', section: 'Colour', kind: 'color-role' },
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
  });
});
