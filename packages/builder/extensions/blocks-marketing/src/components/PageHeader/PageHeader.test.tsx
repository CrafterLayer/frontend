import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { PageHeader } from './PageHeader';
import { pageHeaderSchema } from './schema';

const node: Node = { id: 'page-header-test', type: 'pageHeader', props: {} };

describe('PageHeader', () => {
  it('partitions colour roles, optional text, and defaults exactly', () => {
    const colourRoles = new Set(['background', 'textColor']);
    const optionalText = new Set([
      'tagline',
      'brandHref',
      'actionLabel',
      'actionHref',
      'secondaryActionLabel',
      'secondaryActionHref',
    ]);
    const defaulted = new Set([
      'brand',
      'links',
      'layout',
      'density',
      'brandSize',
      'navStyle',
      'navCase',
      'navWeight',
      'actionStyle',
      'actionSize',
      'border',
      'shadow',
      'sticky',
      'translucent',
      'align',
      'tone',
      'spacing',
      'width',
    ]);
    const allProperties = new Set([...colourRoles, ...optionalText, ...defaulted]);

    expect(allProperties.size).toBe(colourRoles.size + optionalText.size + defaulted.size);
    expect([...allProperties].sort()).toEqual(Object.keys(pageHeaderSchema.props.shape).sort());

    const defaults = pageHeaderSchema.props.parse({});
    expect(Object.keys(defaults).sort()).toEqual([...defaulted].sort());
    expect(defaults).toStrictEqual({
      actionSize: 'md',
      actionStyle: 'solid',
      align: 'start',
      border: 'none',
      brand: 'Your brand',
      brandSize: 'md',
      density: 'regular',
      layout: 'split',
      links: [],
      navCase: 'normal',
      navStyle: 'plain',
      navWeight: 'medium',
      shadow: 'none',
      spacing: 'sm',
      sticky: false,
      tone: 'transparent',
      translucent: false,
      width: 'wide',
    });

    for (const property of colourRoles) {
      expect(Object.hasOwn(defaults, property), property).toBe(false);
    }
    for (const property of optionalText) {
      expect(Object.hasOwn(defaults, property), property).toBe(false);
    }
    for (const property of defaulted) {
      expect(Object.hasOwn(defaults, property), property).toBe(true);
    }
  });

  it('renders chosen roles as kebab-cased page custom properties', () => {
    render(
      <PageHeader
        node={node}
        props={pageHeaderSchema.props.parse({
          background: 'surfaceInverse',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const header = screen.getByRole('banner');
    expect(header.style.background).toBe('var(--t-surface-inverse)');
    expect(header.style.color).toBe('var(--t-accent-text)');
  });

  it('keeps its root free of inline colour when no role is chosen', () => {
    render(
      <PageHeader
        node={node}
        props={pageHeaderSchema.props.parse({})}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const header = screen.getByRole('banner');
    expect(header).not.toHaveAttribute('style');
    expect(header.style.background).toBe('');
    expect(header.style.color).toBe('');
  });

  it('labels the visible brand and nests links in Page navigation', () => {
    const props = pageHeaderSchema.props.parse({
      brand: 'CraftKit',
      links: [
        { label: 'Docs', href: '/docs' },
        { label: 'Pricing', href: '/pricing' },
      ],
    });
    render(<PageHeader node={node} props={props} slots={{}} data={{}} isCanvas={false} />);

    const header = screen.getByRole('banner', { name: 'CraftKit' });
    const brand = screen.getByText('CraftKit', { selector: 'strong' });
    const navigation = screen.getByRole('navigation', { name: 'Page' });

    expect(brand).toHaveAttribute('id', 'page-header-test-brand');
    expect(header).toHaveAttribute('aria-labelledby', brand.id);
    expect(navigation).toContainElement(screen.getByRole('link', { name: 'Docs' }));
    expect(within(navigation).getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
    expect(within(navigation).getByRole('link', { name: 'Pricing' })).toHaveAttribute(
      'href',
      '/pricing',
    );
  });

  it('adds the sticky class only when sticky is true', () => {
    const { rerender } = render(
      <PageHeader
        node={node}
        props={pageHeaderSchema.props.parse({ brand: 'CraftKit', sticky: true })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('banner', { name: 'CraftKit' })).toHaveClass('mkt-header--sticky');

    rerender(
      <PageHeader
        node={node}
        props={pageHeaderSchema.props.parse({ brand: 'CraftKit', sticky: false })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('banner', { name: 'CraftKit' })).not.toHaveClass('mkt-header--sticky');
  });
});
