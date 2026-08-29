import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { Grid } from './Grid';
import { gridSchema, type GridProps } from './schema';

const node: Node = { id: 'grid-1', type: 'grid', props: {} };

describe('Grid', () => {
  it('schema: accepts exactly the shared composition vocabulary with Grid self-nesting', () => {
    expect(gridSchema.slots?.['default']?.allow).toEqual([
      'stack',
      'grid',
      'hero',
      'features',
      'pricing',
      'testimonials',
      'cta',
      'richText',
      'navLinks',
    ]);
  });

  it('schema: defaults every non-colour property and deliberately defaults no colour role', () => {
    const props = gridSchema.props.parse({});
    const colorKeys = Object.keys(sectionColorProps);

    expect(colorKeys.sort()).toEqual(['background', 'textColor']);
    for (const key of colorKeys) {
      expect(gridSchema.props.shape, key).toHaveProperty(key);
      expect(props, key).not.toHaveProperty(key);
    }
    expect(Object.keys(props).sort()).toEqual(
      Object.keys(gridSchema.props.shape)
        .filter((key) => !colorKeys.includes(key))
        .sort(),
    );
    expect(props).toStrictEqual({
      columns: '3',
      gap: 'md',
      align: 'start',
      justify: 'start',
      flow: 'row',
      tone: 'transparent',
      spacing: 'none',
      width: 'standard',
    });

    const { container } = render(
      <Grid node={node} props={props} slots={{}} data={{}} isCanvas={false} />,
    );
    expect(container.querySelector(`[data-bldr-grid="${node.id}"]`)).toHaveClass(
      'mkt-section',
      'mkt-grid',
      'mkt-section--tone-transparent',
      'mkt-section--spacing-none',
      'mkt-grid--columns-3',
      'mkt-grid--gap-md',
      'mkt-grid--align-start',
      'mkt-grid--justify-start',
      'mkt-grid--flow-row',
    );
    expect(container.querySelector('.mkt-section__content')).toHaveClass(
      'mkt-section__content--width-standard',
    );
  });

  it('schema: assigns every property to its required inspector group', () => {
    expect(gridSchema.propertyGroups).toStrictEqual({
      columns: { tab: 'design', section: 'Layout' },
      gap: { tab: 'design', section: 'Layout' },
      align: { tab: 'design', section: 'Layout' },
      justify: { tab: 'design', section: 'Layout' },
      flow: { tab: 'advanced', section: 'Layout' },
      tone: { tab: 'design', section: 'Colour' },
      spacing: { tab: 'design', section: 'Spacing' },
      width: { tab: 'design', section: 'Width' },
      ...sectionColorGroups,
    });
    expect(Object.keys(gridSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(gridSchema.props.shape).sort(),
    );
  });

  it('renderer: applies the selected class for every supported column count', () => {
    const props = gridSchema.props.parse({});
    const columns = ['1', '2', '3', '4', '6'] as const;
    const { container } = render(
      <>
        {columns.map((count) => (
          <Grid
            key={count}
            node={{ ...node, id: `grid-${count}` }}
            props={{ ...props, columns: count } satisfies GridProps}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        ))}
      </>,
    );

    for (const count of columns) {
      expect(container.querySelector(`[data-bldr-grid="grid-${count}"]`)).toHaveClass(
        `mkt-grid--columns-${count}`,
      );
    }
  });

  it('renderer: maps a colour role to its kebab-cased theme token and renders slot content', () => {
    const { container } = render(
      <Grid
        node={node}
        props={gridSchema.props.parse({ background: 'surfaceInverse' })}
        slots={{ default: <span>Grid child</span> }}
        data={{}}
        isCanvas={false}
      />,
    );

    const root = container.querySelector<HTMLElement>(`[data-bldr-grid="${node.id}"]`);
    expect(root?.style.background).toBe('var(--t-surface-inverse)');
    expect(root?.style.color).toBe('');
    expect(screen.getByText('Grid child')).toBeInTheDocument();
  });
});
