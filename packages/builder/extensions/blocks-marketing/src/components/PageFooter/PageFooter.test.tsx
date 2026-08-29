import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionColorProps } from '../section-color';
import { PageFooter } from './PageFooter';
import { footerBorders, footerLayouts, pageFooterSchema } from './schema';

const node: Node = { id: 'page-footer-test', type: 'pageFooter', props: {} };

describe('PageFooter', () => {
  it('schema declares exactly the default and bottom slots', () => {
    const allowed = ['richText', 'cta', 'navLinks', 'stack'];
    const slots = pageFooterSchema.slots ?? {};

    expect(Object.keys(slots)).toEqual(['default', 'bottom']);
    expect(slots['default']).toEqual({ allow: allowed });
    expect(slots['bottom']).toEqual({ allow: allowed });
  });

  it('schema defaults every container property and deliberately defaults no colour', () => {
    const colourRoles = Object.keys(sectionColorProps);
    const defaulted = ['layout', 'border', 'align', 'tone', 'spacing', 'width', 'bottomBar'];
    const declared = Object.keys(pageFooterSchema.props.shape);
    const defaults = pageFooterSchema.props.parse({});

    expect(footerLayouts).toEqual(['columns', 'centered', 'split']);
    expect(footerBorders).toEqual(['none', 'top']);
    expect(declared.sort()).toEqual([...defaulted, ...colourRoles].sort());
    expect(defaults).toStrictEqual({
      layout: 'columns',
      border: 'none',
      align: 'start',
      tone: 'transparent',
      spacing: 'lg',
      width: 'wide',
      bottomBar: false,
    });

    for (const property of defaulted) {
      expect(Object.hasOwn(defaults, property), property).toBe(true);
    }
    for (const property of colourRoles) {
      expect(Object.hasOwn(defaults, property), property).toBe(false);
    }

    const groups = pageFooterSchema.propertyGroups ?? {};
    expect(Object.keys(groups).sort()).toEqual([...declared].sort());
    for (const [property, group] of Object.entries(groups)) {
      expect(group.tab, property).toBe(property === 'bottomBar' ? 'advanced' : 'design');
    }
  });

  it('renders each slot child in its own region', () => {
    const { container } = render(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({})}
        slots={{
          default: <p>Composable footer body</p>,
          bottom: (
            <nav aria-label="Footer utilities">
              <a href="/terms">Terms</a>
            </nav>
          ),
        }}
        data={{}}
        isCanvas={false}
      />,
    );

    const bodyRegion = container.querySelector('[data-page-footer-slot="default"]');
    const bottomRegion = container.querySelector('[data-page-footer-slot="bottom"]');

    expect(bodyRegion).toContainElement(screen.getByText('Composable footer body'));
    expect(bottomRegion).toContainElement(
      screen.getByRole('navigation', { name: 'Footer utilities' }),
    );
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });

  it('bottomBar moves the bottom slot into a ruled row', () => {
    const slots = {
      default: <p>Body</p>,
      bottom: <p>Bottom</p>,
    };
    const { container, rerender } = render(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({ bottomBar: false })}
        slots={slots}
        data={{}}
        isCanvas={false}
      />,
    );

    let bottomRegion = container.querySelector('[data-page-footer-slot="bottom"]');
    expect(bottomRegion?.parentElement).toHaveClass('mkt-footer__body');
    expect(container.querySelector('.mkt-footer__bottom')).not.toBeInTheDocument();

    rerender(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({ bottomBar: true })}
        slots={slots}
        data={{}}
        isCanvas={false}
      />,
    );

    bottomRegion = container.querySelector('[data-page-footer-slot="bottom"]');
    expect(bottomRegion?.parentElement).toHaveClass('mkt-footer__bottom');
    expect(
      container.querySelector('.mkt-footer__body > [data-page-footer-slot="bottom"]'),
    ).toBeNull();
    expect(screen.getAllByText('Bottom')).toHaveLength(1);
  });

  it('renders a chosen colour role as a kebab-cased page custom property', () => {
    render(
      <PageFooter
        node={node}
        props={pageFooterSchema.props.parse({ background: 'surfaceInverse' })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('contentinfo').style.background).toBe('var(--t-surface-inverse)');
  });
});
