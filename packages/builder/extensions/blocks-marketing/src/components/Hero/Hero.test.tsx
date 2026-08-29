import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Hero } from './Hero';
import { heroSchema } from './schema';

const node: Node = { id: 'h', type: 'hero', props: {} };

describe('Hero', () => {
  it('renders a labelled section with heading, body, and actions', () => {
    render(
      <Hero
        node={node}
        props={heroSchema.props.parse({
          tone: 'dark',
          align: 'start',
          heading: 'Build faster',
          body: 'Now.',
        })}
        slots={{ actions: <button type="button">Go</button> }}
        data={{}}
        isCanvas={false}
      />,
    );
    const section = screen.getByRole('region', { name: 'Build faster' });
    expect(section).toContainElement(screen.getByRole('heading', { level: 1 }));
    expect(section).toHaveTextContent('Now.');
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('omits body and actions when absent (defaults still render)', () => {
    const props = heroSchema.props.parse({});
    render(<Hero node={node} props={props} slots={{}} data={{}} isCanvas={false} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your headline');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('schema: enforces the heading length and the actions slot vocabulary', () => {
    expect(heroSchema.props.safeParse({ heading: '' }).success).toBe(false);
    expect(heroSchema.slots?.['actions']).toEqual({ allow: ['cta'], max: 2 });
  });

  it('schema: enforces the complete Hero builder-control contract additively', () => {
    const defaults = heroSchema.props.parse({});
    expect(defaults).toMatchObject({
      align: 'center',
      spacing: 'lg',
      tone: 'light',
      width: 'full',
    });
    expect(defaults.eyebrow).toBeUndefined();
    for (const layoutProp of [
      'layoutDirection',
      'layoutJustify',
      'layoutAlign',
      'layoutGap',
      'layoutWrap',
    ]) {
      expect(Object.hasOwn(defaults, layoutProp), layoutProp).toBe(false);
      expect(
        heroSchema.propertyGroups?.[layoutProp as keyof typeof heroSchema.propertyGroups],
      ).toEqual({
        tab: 'design',
        section: 'Layout',
      });
    }

    const accepted = [
      ...['start', 'center', 'end'].map((align) => ({ align })),
      ...['transparent', 'light', 'dark'].map((tone) => ({ tone })),
      ...['none', 'sm', 'md', 'lg'].map((spacing) => ({ spacing })),
      ...['narrow', 'standard', 'wide', 'full'].map((width) => ({ width })),
      ...['row', 'column'].map((layoutDirection) => ({ layoutDirection })),
      ...['start', 'center', 'end'].map((layoutJustify) => ({ layoutJustify })),
      ...['start', 'center', 'end'].map((layoutAlign) => ({ layoutAlign })),
      ...['none', 'sm', 'md', 'lg'].map((layoutGap) => ({ layoutGap })),
      ...['nowrap', 'wrap'].map((layoutWrap) => ({ layoutWrap })),
      { eyebrow: 'New release' },
    ];
    for (const candidate of accepted) {
      expect(heroSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(true);
    }

    const rejected = [
      { eyebrow: '' },
      { eyebrow: 'x'.repeat(61) },
      { eyebrow: 42 },
      { align: 'justify' },
      { tone: 'muted' },
      { spacing: 'xl' },
      { width: 'auto' },
      { layoutDirection: 'row-reverse' },
      { layoutJustify: 'space-between' },
      { layoutAlign: 'stretch' },
      { layoutGap: '16px' },
      { layoutWrap: 'wrap-reverse' },
    ];
    for (const candidate of rejected) {
      expect(heroSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(false);
    }
  });
});
