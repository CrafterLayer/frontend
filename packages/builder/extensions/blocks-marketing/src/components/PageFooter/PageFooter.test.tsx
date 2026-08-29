import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { PageFooter } from './PageFooter';
import { pageFooterSchema } from './schema';

const node: Node = { id: 'page-footer-test', type: 'pageFooter', props: {} };

describe('PageFooter', () => {
  it('partitions colour roles, optional text, and defaults exactly', () => {
    const colourRoles = new Set(['background', 'textColor']);
    const optionalText = new Set(['brand', 'statement', 'legal']);
    const defaulted = new Set([
      'columns',
      'social',
      'layout',
      'columnCount',
      'headingCase',
      'linkStyle',
      'bottomBar',
      'border',
      'align',
      'tone',
      'spacing',
      'width',
    ]);
    const allProperties = new Set([...colourRoles, ...optionalText, ...defaulted]);

    expect(allProperties.size).toBe(colourRoles.size + optionalText.size + defaulted.size);
    expect([...allProperties].sort()).toEqual(Object.keys(pageFooterSchema.props.shape).sort());

    const defaults = pageFooterSchema.props.parse({});
    expect(Object.keys(defaults).sort()).toEqual([...defaulted].sort());
    expect(defaults).toStrictEqual({
      align: 'start',
      border: 'none',
      bottomBar: false,
      columnCount: 'auto',
      columns: [],
      headingCase: 'uppercase',
      layout: 'columns',
      linkStyle: 'plain',
      social: [],
      spacing: 'lg',
      tone: 'transparent',
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
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({
          background: 'surfaceInverse',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const footer = screen.getByRole('contentinfo');
    expect(footer.style.background).toBe('var(--t-surface-inverse)');
    expect(footer.style.color).toBe('var(--t-accent-text)');
  });

  it('keeps its root free of inline colour when no role is chosen', () => {
    render(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({})}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const footer = screen.getByRole('contentinfo');
    expect(footer).not.toHaveAttribute('style');
    expect(footer.style.background).toBe('');
    expect(footer.style.color).toBe('');
  });

  it('renders one labelled navigation landmark per column', () => {
    const columns = [
      {
        heading: 'Product',
        links: [
          { label: 'Features', href: '/features' },
          { label: 'Pricing', href: '/pricing' },
        ],
      },
      {
        heading: 'Company',
        links: [{ label: 'About', href: '/about' }],
      },
    ];
    render(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({
          columns,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(columns.length);
    for (const column of columns) {
      const navigation = screen.getByRole('navigation', { name: column.heading });
      expect(
        within(navigation).getByRole('heading', { level: 2, name: column.heading }),
      ).toBeInTheDocument();
    }
  });

  it('renders footer links as anchors inside their column navigation', () => {
    render(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({
          columns: [
            {
              heading: 'Product',
              links: [
                { label: 'Features', href: '/features' },
                { label: 'Pricing', href: '/pricing' },
              ],
            },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const navigation = screen.getByRole('navigation', { name: 'Product' });
    expect(within(navigation).getByRole('link', { name: 'Features' })).toHaveAttribute(
      'href',
      '/features',
    );
    expect(within(navigation).getByRole('link', { name: 'Pricing' })).toHaveAttribute(
      'href',
      '/pricing',
    );
  });

  it('renders a statement only when supplied', () => {
    const statement = 'Composable pages for growing teams.';
    const { container, rerender } = render(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({ statement })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText(statement)).toBeInTheDocument();

    rerender(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({})}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.queryByText(statement)).not.toBeInTheDocument();
    expect(container.querySelector('.mkt-footer__statement')).toBeNull();
  });

  it('renders a legal line only when supplied', () => {
    const legal = '© 2026 CraftKit';
    const { container, rerender } = render(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({ legal })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText(legal)).toBeInTheDocument();

    rerender(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({})}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.queryByText(legal)).not.toBeInTheDocument();
    expect(container.querySelector('.mkt-footer__legal')).toBeNull();
  });
});
