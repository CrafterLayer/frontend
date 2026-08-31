import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { SpotlightSurface } from './SpotlightSurface';
import { spotlightSurfaceSchema } from './schema';

const node: Node = { id: 'spotlight', type: 'spotlightSurface', props: {} };

function renderSpotlight(overrides: Record<string, unknown> = {}) {
  return render(
    <SpotlightSurface
      node={node}
      props={spotlightSurfaceSchema.props.parse(overrides)}
      slots={{ default: <h2>Launch with clarity</h2> }}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('SpotlightSurface', () => {
  it('renders slotted content above a decorative token-bound effect', () => {
    renderSpotlight();
    const content = screen.getByRole('heading', { name: 'Launch with clarity' });
    expect(content.parentElement).toHaveClass('ace-spotlight__content');
    expect(content.parentElement?.parentElement).toHaveClass('ace-spotlight', 'bg-surface-inverse');
  });

  it('applies every named appearance control as a stable contract', () => {
    renderSpotlight({
      animate: false,
      intensity: 'strong',
      minHeight: 'viewport',
      position: 'end',
      tone: 'light',
      variant: 'dual',
    });
    const wrapper = screen.getByRole('heading').parentElement?.parentElement;
    expect(wrapper).toHaveAttribute('data-spotlight-animate', 'false');
    expect(wrapper).toHaveAttribute('data-spotlight-intensity', 'strong');
    expect(wrapper).toHaveAttribute('data-spotlight-position', 'end');
    expect(wrapper).toHaveAttribute('data-spotlight-variant', 'dual');
    expect(wrapper).toHaveClass('min-h-svh', 'bg-surface');
  });

  it('accepts the complete marketing and primary composition vocabulary', () => {
    expect(spotlightSurfaceSchema.slots?.['default']?.allow).toEqual(
      expect.arrayContaining(['hero', 'carousel', 'formSection', 'marquee', 'card', 'button']),
    );
  });

  it('exposes all props and rejects unsafe custom utilities', () => {
    expect(Object.keys(spotlightSurfaceSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(spotlightSurfaceSchema.props.shape).sort(),
    );
    expect(spotlightSurfaceSchema.props.safeParse({ className: 'bg-red-500' }).success).toBe(false);
    expect(spotlightSurfaceSchema.props.safeParse({ className: 'md:p-8' }).success).toBe(true);
  });
});
