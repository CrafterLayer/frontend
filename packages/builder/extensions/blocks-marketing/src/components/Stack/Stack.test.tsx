import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionColorProps } from '../section-color';
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
    ];
    const refused = ['page', 'image', 'button', 'unknown'];
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

  it('schema: defaults every layout property, and deliberately defaults no colour', () => {
    const props = stackSchema.props.parse({});

    /*
      Every LAYOUT property carries a default, because a container whose
      direction is undefined renders per a stylesheet nobody can see from the
      inspector. Colour is the deliberate exception and is asserted as such
      rather than excused: an unset role means "the tone decides", and a default
      here would have repainted every page written before colour existed.
    */
    const colorKeys = Object.keys(sectionColorProps);
    expect(colorKeys.sort()).toEqual(['background', 'textColor']);
    for (const key of colorKeys) {
      expect(stackSchema.props.shape, key).toHaveProperty(key);
      expect(props, key).not.toHaveProperty(key);
    }
    expect(Object.keys(props).sort()).toEqual(
      Object.keys(stackSchema.props.shape)
        .filter((key) => !colorKeys.includes(key))
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

    expect(container.querySelector(`[data-bldr-stack="${node.id}"]`)).toHaveClass(
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
    expect(container.querySelector('.mkt-section__content')).toHaveClass(
      'mkt-section__content--width-standard',
    );
    expect(screen.getByText('Empty container — drop a block here.')).toBeInTheDocument();
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

  it('accessibility: announces an empty Stack as a discoverable drop target', () => {
    const props = stackSchema.props.parse({});

    render(<Stack node={node} props={props} slots={{}} data={{}} isCanvas={false} />);

    expect(screen.getByRole('status')).toHaveTextContent('Empty container — drop a block here.');
  });
});
