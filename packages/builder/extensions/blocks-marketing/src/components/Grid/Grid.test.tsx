import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { containerCustomGroups } from '../section-custom';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { stackSchema } from '../Stack/schema';
import { Grid } from './Grid';
import { gridSchema, type GridProps } from './schema';

const node: Node = { id: 'grid-1', type: 'grid', props: {} };

describe('Grid', () => {
  it('schema: accepts exactly the shared composition vocabulary with Grid self-nesting', () => {
    expect(gridSchema.slots?.['default']?.allow).toEqual([
      'stack',
      'grid',
      'hero',
      'announcementBar',
      'promoBanner',
      'carousel',
      'videoSection',
      'gallery',
      'logoCloud',
      'features',
      'bento-grid',
      'content-section',
      'stats',
      'processSteps',
      'team',
      'portfolioGrid',
      'productGrid',
      'pricing',
      'testimonials',
      'comparisonTable',
      'table',
      'chart',
      'faq',
      'blogGrid',
      'contact',
      'formSection',
      'newsletter',
      'cta',
      'richText',
      'navLinks',
      'image',
      'button',
      'separator',
      'avatarGroup',
      'progress',
      'breadcrumbs',
      'dialog',
      'pagination',
      'card',
      'tabs',
      'shadcnAlert',
      'accordion',
      'auroraBackground',
      'cloudShader',
      'spotlightSurface',
      'shineBorder',
      'marquee',
      'dotPatternSurface',
      'shimmerButton',
    ]);
    // templates-core additions
    // Page chrome rides only in a template's root column (a Stack), never a grid cell.
    const pageChrome = new Set(['pageHeader', 'pageFooter']);
    expect(new Set(gridSchema.slots?.['default']?.allow)).toEqual(
      new Set(stackSchema.slots?.['default']?.allow.filter((type) => !pageChrome.has(type))),
    );
    // end templates-core additions
  });

  it('schema: defaults layout properties and deliberately defaults no colour or spacing', () => {
    const props = gridSchema.props.parse({});
    const colorKeys = Object.keys(sectionColorProps);
    const motionKeys = Object.keys(sectionMotionProps);
    const spacingKeys = Object.keys(sectionSpacingProps);
    // gutter and className are the shared per-section customisation props: in shape, never defaulted.
    const optionalKeys = [...motionKeys, ...colorKeys, ...spacingKeys, 'gutter', 'className'];

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
      expect(gridSchema.props.shape, key).toHaveProperty(key);
      expect(props, key).not.toHaveProperty(key);
    }
    expect(Object.keys(props).sort()).toEqual(
      Object.keys(gridSchema.props.shape)
        .filter((key) => !optionalKeys.includes(key))
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
    const root = container.querySelector(`[data-bldr-grid="${node.id}"]`);
    expect(root).toHaveClass('box-border', 'w-full', 'bg-transparent', 'text-inherit', 'py-0');
    expect(root).not.toHaveAttribute('style');
    expect(root?.firstElementChild).toHaveClass(
      'max-w-content-standard',
      'grid',
      '@lg:grid-cols-3',
      'gap-gap',
      'items-start',
      'justify-items-start',
      'grid-flow-row',
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
      ...sectionMotionGroups,
      ...sectionSpacingGroups,
      ...containerCustomGroups, // block-parts: a container takes no partStyles
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

    const expected = {
      '1': 'grid-cols-1',
      '2': '@sm:grid-cols-2',
      '3': '@lg:grid-cols-3',
      '4': '@xl:grid-cols-4',
      '6': '@2xl:grid-cols-6',
    } as const;
    for (const count of columns) {
      expect(
        container.querySelector(`[data-bldr-grid="grid-${count}"]`)?.firstElementChild,
      ).toHaveClass(expected[count]);
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

  it('renderer: merges a colour role and spacing step on the root', () => {
    const { container } = render(
      <Grid
        node={node}
        props={gridSchema.props.parse({ textColor: 'textInverse', paddingInlineEnd: 5 })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const root = container.querySelector<HTMLElement>(`[data-bldr-grid="${node.id}"]`);
    expect(root?.style.color).toBe('var(--t-text-inverse)');
    expect(root?.style.paddingInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 5)');
  });
});
