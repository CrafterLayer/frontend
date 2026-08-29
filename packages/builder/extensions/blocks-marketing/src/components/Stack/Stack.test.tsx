import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionColorProps } from '../section-color';
import { sectionSpacingProps } from '../section-spacing';
import { Stack } from './Stack';
import { stackSchema } from './schema';

const node: Node = { id: 'stack-1', type: 'stack', props: {} };

describe('Stack', () => {
  it('schema: accepts exactly the composition vocabulary, including Stack self-nesting', () => {
    const accepted = [
      'stack',
      'hero',
      'features',
      'pricing',
      'testimonials',
      'cta',
      'richText',
      // A link row is a composition primitive, so a container holds one.
      'navLinks',
      // And so are the other two layout primitives: a grid nests in a stack the
      // way a stack nests in a grid, and a picture goes wherever content goes.
      'grid',
      'image',
    ];
    /*
      `image` moved from refused to accepted when the Image block arrived — a
      picture belongs wherever content belongs. `page` stays refused because the
      document root is never nested, and the other two never existed.
    */
    const refused = ['page', 'button', 'unknown'];
    const allowed = stackSchema.slots?.['default']?.allow;

    expect(allowed).toEqual(accepted);
    for (const type of accepted) {
      expect(allowed, type).toContain(type);
    }
    for (const type of refused) {
      expect(allowed, type).not.toContain(type);
    }
    expect(allowed).toContain(stackSchema.type);
  });

  it('schema: defaults every layout property, and deliberately defaults no colour or spacing', () => {
    const props = stackSchema.props.parse({});

    /*
      Every LAYOUT property carries a default, because a container whose
      direction is undefined renders per a stylesheet nobody can see from the
      inspector. Colour and spacing are deliberate exceptions and are asserted
      as such rather than excused: unset means "the tone/block decides", and a
      default here would have restyled every page written before these controls.
    */
    const colorKeys = Object.keys(sectionColorProps);
    const spacingKeys = Object.keys(sectionSpacingProps);
    const optionalKeys = [...colorKeys, ...spacingKeys];
    expect(colorKeys.sort()).toEqual(['background', 'textColor']);
    expect(spacingKeys.sort()).toEqual([
      'marginBlockEnd',
      'marginBlockStart',
      'marginInlineEnd',
      'marginInlineStart',
      'paddingBlockEnd',
      'paddingBlockStart',
      'paddingInlineEnd',
      'paddingInlineStart',
    ]);
    for (const key of optionalKeys) {
      expect(stackSchema.props.shape, key).toHaveProperty(key);
      expect(props, key).not.toHaveProperty(key);
    }
    expect(Object.keys(props).sort()).toEqual(
      Object.keys(stackSchema.props.shape)
        .filter((key) => !optionalKeys.includes(key))
        .sort(),
    );
    expect(props).toStrictEqual({
      direction: 'column',
      justify: 'start',
      align: 'start',
      gap: 'md',
      wrap: 'wrap',
      tone: 'transparent',
      spacing: 'none',
      width: 'standard',
    });

    const { container } = render(
      <Stack node={node} props={props} slots={{}} data={{}} isCanvas={false} />,
    );

    const root = container.querySelector(`[data-bldr-stack="${node.id}"]`);
    expect(root).toHaveClass(
      'mkt-section',
      'mkt-stack',
      'mkt-section--tone-transparent',
      'mkt-section--spacing-none',
      'mkt-stack--direction-column',
      'mkt-stack--justify-start',
      'mkt-stack--align-start',
      'mkt-stack--gap-md',
      'mkt-stack--wrap-wrap',
    );
    expect(root).not.toHaveAttribute('style');
    expect(container.querySelector('.mkt-section__content')).toHaveClass(
      'mkt-section__content--width-standard',
    );
    /*
      No empty-state assertion here any more: the drop affordance for an empty
      slot moved to the RENDERER, which emits one measurable, labelled box for
      every block. It is gated there (NodeView.test.tsx) rather than
      re-implemented and re-asserted per block.
    */
  });

  it('renderer: merges a colour role and spacing step on the root', () => {
    const { container } = render(
      <Stack
        node={node}
        props={stackSchema.props.parse({
          background: 'surfaceInverse',
          paddingBlockStart: 3,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const root = container.querySelector<HTMLElement>(`[data-bldr-stack="${node.id}"]`);
    expect(root?.style.background).toBe('var(--t-surface-inverse)');
    expect(root?.style.paddingBlockStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
  });

  it('schema: assigns every declared property to an explicit inspector tab', () => {
    const declaredProperties = Object.keys(stackSchema.props.shape).sort();
    const propertyGroups = stackSchema.propertyGroups ?? {};

    expect(Object.keys(propertyGroups).sort()).toEqual(declaredProperties);
    for (const property of declaredProperties) {
      const group = Object.entries(propertyGroups).find(([name]) => name === property)?.[1];
      expect(group?.tab, `${property} must declare an inspector tab`).toBeDefined();
    }
  });
});
