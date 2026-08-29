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

  it('applies a background colour role without setting text colour', () => {
    render(
      <Hero
        node={node}
        props={heroSchema.props.parse({
          heading: 'Background role hero',
          background: 'surfaceInverse',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Background role hero' });
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('');
  });

  it('applies a text colour role without setting background', () => {
    render(
      <Hero
        node={node}
        props={heroSchema.props.parse({
          heading: 'Text role hero',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Text role hero' });
    expect(section.style.background).toBe('');
    expect(section.style.color).toBe('var(--t-accent-text)');
  });

  it('applies both colour roles', () => {
    render(
      <Hero
        node={node}
        props={heroSchema.props.parse({
          heading: 'Both roles hero',
          background: 'surfaceInverse',
          textColor: 'accentText',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Both roles hero' });
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('var(--t-accent-text)');
  });

  it('does not add an inline colour style when no role is chosen', () => {
    render(
      <Hero
        node={node}
        props={heroSchema.props.parse({ heading: 'Uncoloured hero' })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Uncoloured hero' });
    expect(section).not.toHaveAttribute('style');
    expect(section.style.background).toBe('');
    expect(section.style.color).toBe('');
  });

  it('carries NO style attribute when neither colour nor spacing is set', () => {
    /*
      Nothing chosen ⇒ nothing inline. An inline value outranks the stylesheet,
      so a block that hard-coded one — or a shared helper that started returning
      a default — would silently restyle every page authored before these
      controls existed.

      Stated precisely, because I checked: `undefined` versus `{}` is NOT what
      this pins. React omits the attribute for an empty object too, so that
      distinction has no observable difference and nothing to gate. What this
      catches is a real value arriving when none was asked for.
    */
    const { container } = render(
      <Hero
        node={node}
        props={heroSchema.props.parse({ heading: 'Plain' })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(container.querySelector('.mkt-hero')).not.toHaveAttribute('style');
  });

  it('applies shared typography, spacing, and colour controls on the root', () => {
    render(
      <Hero
        node={node}
        props={heroSchema.props.parse({
          heading: 'Styled hero',
          background: 'accent',
          fontSize: 'xl',
          paddingInlineStart: 3,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled hero' });
    expect(section).toHaveClass('mkt-type--size-xl');
    expect(section.style.paddingInlineStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
    expect(section.style.background).toBe('var(--t-accent)');
  });

  it('renders the optional eyebrow when supplied', () => {
    render(
      <Hero
        node={node}
        props={heroSchema.props.parse({
          heading: 'Eyebrow hero',
          eyebrow: 'New release',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText('New release')).toHaveClass('mkt-hero__eyebrow');
  });

  it('adds a modifier class for every defined action layout property', () => {
    render(
      <Hero
        node={node}
        props={heroSchema.props.parse({
          heading: 'Configured actions',
          layoutDirection: 'row',
          layoutJustify: 'center',
          layoutAlign: 'end',
          layoutGap: 'lg',
          layoutWrap: 'wrap',
        })}
        slots={{ actions: <button type="button">Explore</button> }}
        data={{}}
        isCanvas={false}
      />,
    );

    const actions = screen.getByRole('button', { name: 'Explore' }).parentElement;
    if (actions === null) throw new Error('Expected Hero actions wrapper');
    expect(actions).toHaveClass(
      'mkt-hero__actions--direction-row',
      'mkt-hero__actions--justify-center',
      'mkt-hero__actions--align-end',
      'mkt-hero__actions--gap-lg',
      'mkt-hero__actions--wrap-wrap',
    );
  });

  it('omits every action layout modifier when the layout properties are undefined', () => {
    render(
      <Hero
        node={node}
        props={heroSchema.props.parse({ heading: 'Unconfigured actions' })}
        slots={{ actions: <button type="button">Explore</button> }}
        data={{}}
        isCanvas={false}
      />,
    );

    const actions = screen.getByRole('button', { name: 'Explore' }).parentElement;
    if (actions === null) throw new Error('Expected Hero actions wrapper');
    expect(actions).not.toHaveClass(
      'mkt-hero__actions--direction-row',
      'mkt-hero__actions--justify-center',
      'mkt-hero__actions--align-end',
      'mkt-hero__actions--gap-lg',
      'mkt-hero__actions--wrap-wrap',
    );
    expect(actions.className).not.toContain('mkt-hero__actions--');
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
    for (const sharedProp of [
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
    ] as const) {
      expect(Object.hasOwn(heroSchema.props.shape, sharedProp), sharedProp).toBe(true);
      expect(Object.hasOwn(defaults, sharedProp), `${sharedProp} must not be defaulted`).toBe(
        false,
      );
      expect(heroSchema.propertyGroups?.[sharedProp], `${sharedProp} property group`).toBeDefined();
    }
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
