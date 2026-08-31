import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionCustomGroups } from '../section-custom';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';

import { PageHeader } from './PageHeader';
import { pageHeaderSchema } from './schema';

const node: Node = { id: 'page-header-test', type: 'pageHeader', props: {} };

describe('PageHeader', () => {
  it('declares exactly the start center and end slots with the shared allow list', () => {
    const allowed = ['richText', 'cta', 'navLinks', 'stack'];

    expect(pageHeaderSchema.slots).toStrictEqual({
      start: { allow: allowed },
      center: { allow: allowed },
      end: { allow: allowed },
    });
    expect(Object.keys(pageHeaderSchema.slots ?? {})).toEqual(['start', 'center', 'end']);
    expect(pageHeaderSchema).not.toHaveProperty('inlineEditable');
  });

  it('keeps exactly the surviving container properties and their intentional defaults', () => {
    const colourRoles = ['background', 'textColor'];
    /*
      Optional and defaulted by nothing, exactly like the colour roles: a header
      that has always been still must not start moving because a new property
      arrived with an opinion.
    */
    const motionKeys = Object.keys(sectionMotionProps);
    const defaulted = [
      'layout',
      'density',
      'border',
      'shadow',
      'align',
      'tone',
      'spacing',
      'width',
      'sticky',
      'translucent',
    ];
    const declared = [...colourRoles, ...motionKeys, ...defaulted, 'gutter', 'className'];
    const defaults = pageHeaderSchema.props.parse({});

    expect(Object.keys(pageHeaderSchema.props.shape).sort()).toEqual(declared.sort());
    expect(Object.keys(defaults).sort()).toEqual(defaulted.sort());
    expect(defaults).toStrictEqual({
      layout: 'split',
      density: 'regular',
      border: 'none',
      shadow: 'none',
      align: 'start',
      tone: 'transparent',
      spacing: 'sm',
      width: 'wide',
      sticky: false,
      translucent: false,
    });

    for (const role of colourRoles) {
      expect(Object.hasOwn(defaults, role), `${role} must let tone decide`).toBe(false);
    }
  });

  it('groups every surviving property under design except sticky and translucent under advanced', () => {
    expect(pageHeaderSchema.propertyGroups).toStrictEqual({
      layout: { tab: 'design', section: 'Layout' },
      density: { tab: 'design', section: 'Layout' },
      align: { tab: 'design', section: 'Layout' },
      width: { tab: 'design', section: 'Layout' },
      background: { tab: 'design', section: 'Colour', kind: 'color-role' },
      textColor: { tab: 'design', section: 'Colour', kind: 'color-role' },
      tone: { tab: 'design', section: 'Colour' },
      border: { tab: 'design', section: 'Edge' },
      shadow: { tab: 'design', section: 'Edge' },
      spacing: { tab: 'design', section: 'Spacing' },
      sticky: { tab: 'advanced', section: 'Behaviour' },
      translucent: { tab: 'advanced', section: 'Behaviour' },
      ...sectionMotionGroups,
      ...sectionCustomGroups,
    });
    expect(Object.keys(pageHeaderSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(pageHeaderSchema.props.shape).sort(),
    );
  });

  it('renders all three slot children in start center end reading order', () => {
    const { container } = render(
      <PageHeader
        node={node}
        props={pageHeaderSchema.props.parse({})}
        slots={{
          start: <span>Start child</span>,
          center: <span>Center child</span>,
          end: <span>End child</span>,
        }}
        data={{}}
        isCanvas={false}
      />,
    );

    const header = screen.getByRole('banner');
    const slotElements = [...container.querySelectorAll('[data-page-header-slot]')];
    const bar = header.firstElementChild;

    expect(slotElements.map((element) => element.getAttribute('data-page-header-slot'))).toEqual([
      'start',
      'center',
      'end',
    ]);
    expect(slotElements.map((element) => element.textContent)).toEqual([
      'Start child',
      'Center child',
      'End child',
    ]);
    expect(header).not.toHaveAttribute('aria-labelledby');
    expect(header).toHaveClass(
      'box-border',
      'w-full',
      'bg-transparent',
      'text-inherit',
      'py-section-sm',
    );
    expect(bar).toHaveClass('max-w-content-wide', 'text-start', 'min-h-bar-regular');
    expect(slotElements[1]).toHaveClass('ms-auto');
    expect(slotElements[2]).toHaveClass('ms-gap-lg');
  });

  it('renders chosen colour roles as kebab cased theme variables', () => {
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

  it('applies translucent only when the header is sticky', () => {
    const { rerender } = render(
      <PageHeader
        node={node}
        props={pageHeaderSchema.props.parse({ sticky: false, translucent: true })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const header = screen.getByRole('banner');
    expect(header).not.toHaveClass('sticky', 'bg-current/5');

    rerender(
      <PageHeader
        node={node}
        props={pageHeaderSchema.props.parse({ sticky: true, translucent: true })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(header).toHaveClass(
      'sticky',
      'top-0',
      'z-20',
      'bg-current/5',
      'backdrop-blur-md',
      'backdrop-saturate-150',
    );

    rerender(
      <PageHeader
        node={node}
        props={pageHeaderSchema.props.parse({ sticky: true, translucent: false })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(header).toHaveClass('sticky');
    expect(header).not.toHaveClass('bg-current/5');
  });
});
