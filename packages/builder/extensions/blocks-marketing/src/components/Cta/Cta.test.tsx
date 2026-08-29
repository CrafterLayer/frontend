import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionColorProps } from '../section-color';
import { sectionSpacingProps } from '../section-spacing';
import { sectionTypographyProps } from '../section-typography';
import { Cta } from './Cta';
import { ctaSchema } from './schema';

const node: Node = { id: 'c', type: 'cta', props: {} };

describe('Cta', () => {
  it('renders a real button labelled by its text, with the optional note', () => {
    render(
      <Cta
        node={node}
        props={ctaSchema.props.parse({
          label: 'Learn more',
          emphasis: 'ghost',
          note: 'Free trial',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    const button = screen.getByRole('button', { name: 'Learn more' });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Free trial')).toBeInTheDocument();
    expect(button.parentElement).toHaveAttribute('class', 'mkt-cta mkt-cta--fit');
    expect(button.parentElement).not.toHaveAttribute('style');
  });

  it('renderer: applies shared typography and merged colour/spacing to the root', () => {
    render(
      <Cta
        node={node}
        props={ctaSchema.props.parse({
          background: 'surfaceInverse',
          fontSize: 'xl',
          paddingInlineStart: 3,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const button = screen.getByRole('button', { name: 'Get started' });
    const root = button.parentElement;
    expect(root).toHaveClass('mkt-type--size-xl');
    expect(root?.style.background).toBe('var(--t-surface-inverse)');
    expect(root?.style.paddingInlineStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
    expect(button).not.toHaveAttribute('style');
  });

  it('schema rejects empty and oversized labels', () => {
    expect(ctaSchema.props.safeParse({ label: '' }).success).toBe(false);
    expect(ctaSchema.props.safeParse({ label: 'x'.repeat(41) }).success).toBe(false);
  });

  it('schema: enforces the complete CTA builder-control contract', () => {
    const props = ctaSchema.props.parse({});
    const colorKeys = Object.keys(sectionColorProps);
    const typographyKeys = Object.keys(sectionTypographyProps);
    const spacingKeys = Object.keys(sectionSpacingProps);
    const sharedOptionalKeys = [...colorKeys, ...typographyKeys, ...spacingKeys];
    const noDefaultKeys = ['note', ...sharedOptionalKeys];

    expect(colorKeys.sort()).toEqual(['background', 'textColor']);
    expect(typographyKeys.sort()).toEqual([
      'fontFamily',
      'fontSize',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'textAlign',
      'textCase',
    ]);
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
    for (const key of sharedOptionalKeys) {
      expect(ctaSchema.props.shape, key).toHaveProperty(key);
      expect(props, key).not.toHaveProperty(key);
    }
    expect(Object.keys(props).sort()).toEqual(
      Object.keys(ctaSchema.props.shape)
        .filter((key) => !noDefaultKeys.includes(key))
        .sort(),
    );
    expect(props).toEqual({
      emphasis: 'primary',
      label: 'Get started',
      size: 'md',
      width: 'fit',
    });
    expect(Object.keys(ctaSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(ctaSchema.props.shape).sort(),
    );

    for (const size of ['sm', 'md', 'lg']) {
      expect(ctaSchema.props.safeParse({ size }).success, `size=${size}`).toBe(true);
    }
    for (const width of ['fit', 'full']) {
      expect(ctaSchema.props.safeParse({ width }).success, `width=${width}`).toBe(true);
    }
    expect(ctaSchema.props.safeParse({ size: 'xl' }).success).toBe(false);
    expect(ctaSchema.props.safeParse({ width: 'auto' }).success).toBe(false);
  });
});
