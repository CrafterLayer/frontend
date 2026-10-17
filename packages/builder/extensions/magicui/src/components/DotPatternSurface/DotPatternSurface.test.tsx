import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { DotPatternSurface } from './DotPatternSurface';
import { dotPatternSurfaceSchema } from './schema';

const node: Node = { id: 'dot-pattern', type: 'dotPatternSurface', props: {} };

function renderDotPattern(
  overrides: Record<string, unknown> = {},
  children: React.ReactNode = <p>Composed content</p>,
) {
  return render(
    <DotPatternSurface
      node={node}
      props={dotPatternSurfaceSchema.props.parse(overrides)}
      slots={{ default: children }}
      data={{}}
      isCanvas={false}
    />,
  );
}

function root(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe('DotPatternSurface', () => {
  it('renders composed slot content above a decorative pattern', () => {
    const { container } = renderDotPattern();
    expect(screen.getByText('Composed content')).toBeInTheDocument();
    expect(root(container)).toHaveClass('mgc-dot-surface', 'rounded-xl', 'p-6');
    expect(root(container).firstElementChild).toHaveClass('mgc-dot-surface__content');
  });

  it('maps density, size, intensity, and tone through named token-derived variables', () => {
    const { container } = renderDotPattern({
      density: 'dense',
      intensity: 'strong',
      size: 'bold',
      tone: 'accent',
    });
    const surface = root(container);
    expect(surface.style.getPropertyValue('--mgc-dot-gap')).toBe(
      'calc(var(--t-space-unit, 4px) * 3)',
    );
    expect(surface.style.getPropertyValue('--mgc-dot-size')).toBe(
      'calc(var(--t-border-width, 1px) * 3)',
    );
    expect(surface.style.getPropertyValue('--mgc-dot-opacity')).toBe('0.36');
    expect(surface.style.getPropertyValue('--mgc-dot-color')).toBe('var(--t-accent)');
  });

  it('exposes fade, logical mask position, animation, padding, and radius controls', () => {
    const { container } = renderDotPattern({
      animate: true,
      fade: 'strong',
      maskPosition: 'inlineEnd',
      padding: 'compact',
      radius: 'regular',
    });
    const surface = root(container);
    expect(surface).toHaveAttribute('data-dot-fade', 'strong');
    expect(surface).toHaveAttribute('data-dot-mask', 'inlineEnd');
    expect(surface).toHaveAttribute('data-dot-animate', 'true');
    expect(surface).toHaveClass('p-4', 'rounded-base');
    expect(surface.style.getPropertyValue('--mgc-dot-play')).toBe('running');
  });

  it('is still by default and passes closed-vocabulary reveal motion separately', () => {
    const { container } = renderDotPattern({ motion: { reveal: 'fade' } });
    const surface = root(container);
    expect(surface).toHaveAttribute('data-dot-animate', 'false');
    expect(surface.style.getPropertyValue('--mgc-dot-play')).toBe('paused');
    expect(surface).toHaveAttribute('data-reveal', 'fade');
  });

  it('accepts the broad explicit marketing and primary component vocabulary', () => {
    const allow = dotPatternSurfaceSchema.slots?.['default']?.allow ?? [];
    for (const type of [
      'portfolioGrid',
      'productGrid',
      'formSection',
      'gallery',
      'button',
      'avatarGroup',
      'separator',
      'progress',
      'shimmerButton',
    ]) {
      expect(allow).toContain(type);
    }
    expect(allow).not.toContain('dotPatternSurface');
  });

  it('exposes every prop and rejects unsafe utilities or unsupported intents', () => {
    const defaults = dotPatternSurfaceSchema.props.parse({});
    expect(defaults).toEqual({
      animate: false,
      density: 'balanced',
      fade: 'soft',
      intensity: 'balanced',
      maskPosition: 'center',
      padding: 'regular',
      radius: 'large',
      size: 'fine',
      tone: 'muted',
    });
    expect(Object.keys(dotPatternSurfaceSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(dotPatternSurfaceSchema.props.shape).sort(),
    );
    expect(dotPatternSurfaceSchema.props.safeParse({ maskPosition: 'random' }).success).toBe(false);
    expect(dotPatternSurfaceSchema.props.safeParse({ className: 'text-red-500' }).success).toBe(
      false,
    );
    expect(dotPatternSurfaceSchema.props.safeParse({ className: 'md:p-8' }).success).toBe(true);
  });
});
