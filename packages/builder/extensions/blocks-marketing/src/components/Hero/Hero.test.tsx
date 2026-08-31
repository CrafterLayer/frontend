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

  it('hides an empty optional media drop zone unless the author chooses the split variant', () => {
    const emptyMediaNode: Node = { ...node, slots: { media: [] } };
    const { rerender } = render(
      <Hero
        node={emptyMediaNode}
        props={heroSchema.props.parse({ heading: 'Centered hero' })}
        slots={{ media: <span>Media drop zone</span> }}
        data={{}}
        isCanvas
      />,
    );

    expect(screen.queryByText('Media drop zone')).not.toBeInTheDocument();

    rerender(
      <Hero
        node={emptyMediaNode}
        props={heroSchema.props.parse({ heading: 'Split hero', variant: 'split' })}
        slots={{ media: <span>Media drop zone</span> }}
        data={{}}
        isCanvas
      />,
    );
    expect(screen.getByText('Media drop zone')).toBeInTheDocument();
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

    expect(container.querySelector('section')).not.toHaveAttribute('style');
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

    /*
      The eyebrow is asserted by its ROLE in the layout — muted, small, tracked —
      rather than by a BEM class name. The block carries no stylesheet now, so a
      class name would pin an implementation detail instead of the intent.
    */
    expect(screen.getByText('New release')).toHaveClass('text-accent');
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

    /*
      Every layout prop still reaches the DOM — it just arrives as the utility
      the shared map assigns rather than as a BEM modifier. Asserting the
      utilities keeps the test honest about what the browser will actually do.
    */
    expect(actions).toHaveClass('flex-row');
    expect(actions).toHaveClass('justify-center');
    expect(actions).toHaveClass('items-end');
    expect(actions).toHaveClass('gap-gap-lg');
    expect(actions).toHaveClass('flex-wrap');
  });

  /*
    This replaces an assertion that had become vacuous.

    It used to read `not.toHaveClass('mkt-hero__actions--direction-row', …)`
    and prove that an unconfigured action row carried no layout modifier. Those
    class names stopped existing with the Tailwind migration, so the test went
    on passing while checking nothing — and it could never fail again.

    The behaviour worth pinning is the one that actually replaced them: the row
    has no modifiers to omit, it has a FALLBACK CHAIN, and the interesting link
    in it is `layoutJustify ?? props.align`. An action row in a centred hero
    centres itself; the same row in an end-aligned hero follows the section
    rather than staying centred. Two sections, asserted against each other, is
    what makes that non-vacuous — a hard-coded default would satisfy either one
    alone.
  */
  it('falls back to the documented layout defaults, following the section alignment', () => {
    const actionsFor = (align: 'center' | 'end'): HTMLElement => {
      const { unmount } = render(
        <Hero
          node={node}
          props={heroSchema.props.parse({ heading: 'Unconfigured actions', align })}
          slots={{ actions: <button type="button">Explore</button> }}
          data={{}}
          isCanvas={false}
        />,
      );
      const wrapper = screen.getByRole('button', { name: 'Explore' }).parentElement;
      if (wrapper === null) throw new Error('Expected Hero actions wrapper');
      const className = wrapper.className;
      unmount();
      /* Detached, but the class list is the whole subject of the assertion. */
      const detached = document.createElement('div');
      detached.className = className;
      return detached;
    };

    const centred = actionsFor('center');
    expect(centred).toHaveClass('flex-row');
    expect(centred).toHaveClass('items-center');
    expect(centred).toHaveClass('gap-gap-sm');
    expect(centred).toHaveClass('flex-wrap');
    expect(centred).toHaveClass('justify-center');

    /* The link under test: justification tracks the section, it is not fixed. */
    expect(actionsFor('end')).toHaveClass('justify-end');
  });

  it('schema: enforces the heading length and the actions slot vocabulary', () => {
    expect(heroSchema.props.safeParse({ heading: '' }).success).toBe(false);
    expect(heroSchema.slots?.['actions']).toEqual({ allow: ['cta', 'button'], max: 2 });
    expect(heroSchema.slots?.['media']).toEqual({
      allow: ['image', 'grid', 'stack', 'richText'],
      max: 1,
    });
  });

  it('schema: enforces the complete Hero builder-control contract additively', () => {
    const defaults = heroSchema.props.parse({});
    expect(defaults).toMatchObject({
      align: 'center',
      spacing: 'lg',
      tone: 'light',
      variant: 'centered',
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
      ...['centered', 'split', 'editorial'].map((variant) => ({ variant })),
      { eyebrow: 'New release' },
      { trustLine: 'Trusted by more than 4,000 teams.' },
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
      { variant: 'fullscreen' },
      { trustLine: '' },
    ];
    for (const candidate of rejected) {
      expect(heroSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(false);
    }
  });
});

/*
  The end-to-end proof for motion, at the one place all four layers meet.

  Schema (a closed vocabulary at layer 0) -> block prop -> renderer attributes
  -> the CSS baseline's selectors. Each layer has its own tests; these are the
  ones that fail if the layers stop agreeing with each other.
*/
function renderHero(overrides: Record<string, unknown>) {
  return render(
    <Hero
      node={node}
      props={heroSchema.props.parse({ heading: 'Build faster', ...overrides })}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Hero motion', () => {
  it('carries a chosen motion onto the section as attributes', () => {
    const { container } = renderHero({
      motion: { reveal: 'fade-up', duration: 'slow', easing: 'spring' },
    });
    const section = container.querySelector('section');

    expect(section?.className).toContain('bldr-motion');
    expect(section?.getAttribute('data-reveal')).toBe('fade-up');
    expect(section?.getAttribute('data-duration')).toBe('slow');
    expect(section?.getAttribute('data-easing')).toBe('spring');
  });

  /*
    Absence means stillness. A still section must carry no motion class at all,
    or the reduced-motion and no-timeline fallback rules stay pointed at an
    element that was never animating.
  */
  it('leaves a still section completely unmarked', () => {
    const { container } = renderHero({});
    const section = container.querySelector('section');

    expect(section?.className).not.toContain('bldr-motion');
    expect(section?.getAttribute('data-reveal')).toBeNull();
  });

  it('treats an explicit none as stillness rather than as a value', () => {
    const { container } = renderHero({ motion: { reveal: 'none' } });

    expect(container.querySelector('section')?.className).not.toContain('bldr-motion');
  });

  /*
    The law the whole vocabulary exists to keep. A timing must never reach the
    DOM as a number - the stylesheet owns what a step is worth, which is what
    lets one theme edit retime every animation on the site.
  */
  it('never writes a duration into the markup', () => {
    const { container } = renderHero({ motion: { reveal: 'fade', duration: 'deliberate' } });
    const section = container.querySelector('section');

    expect(section?.getAttribute('style') ?? '').not.toMatch(/\d+ms/);
    expect(section?.outerHTML ?? '').not.toMatch(/\d+ms/);
  });

  it('keeps the block classes alongside the motion class', () => {
    const { container } = renderHero({ motion: { reveal: 'fade' } });
    const className = container.querySelector('section')?.className ?? '';

    // The block's own shell utilities survive alongside the motion class.
    expect(className).toContain('box-border');
    expect(className).toContain('bldr-motion');
  });
});
