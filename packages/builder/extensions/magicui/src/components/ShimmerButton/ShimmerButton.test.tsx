import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ShimmerButton } from './ShimmerButton';
import { shimmerButtonSchema } from './schema';

const node: Node = { id: 'shimmer-button', type: 'shimmerButton', props: {} };

function renderShimmerButton(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <ShimmerButton
      node={node}
      props={shimmerButtonSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('ShimmerButton', () => {
  it('renders a native button with the authored semantic type', () => {
    renderShimmerButton({ label: 'Send enquiry', type: 'submit' });
    const button = screen.getByRole('button', { name: 'Send enquiry' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass('mgc-shimmer-button', 'bg-accent', 'rounded-full');
  });

  it('renders a safe link and protects a new browsing context', () => {
    renderShimmerButton({
      label: 'Open guide',
      href: 'https://example.com/guide',
      openInNewTab: true,
    });
    const link = screen.getByRole('link', { name: 'Open guide' });
    expect(link).toHaveAttribute('href', 'https://example.com/guide');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('prevents navigation on the canvas without hiding the authored destination', () => {
    renderShimmerButton({ label: 'Canvas shimmer', href: '/destination' }, true);
    const link = screen.getByRole('link', { name: 'Canvas shimmer' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveAttribute('href', '/destination');
  });

  it('maps visual controls to token utilities and named effect variables', () => {
    renderShimmerButton({
      align: 'end',
      intensity: 'strong',
      radius: 'large',
      size: 'large',
      speed: 'slow',
      tone: 'surface',
      width: 'full',
    });
    const button = screen.getByRole('button');
    expect(button.parentElement).toHaveClass('justify-end');
    expect(button).toHaveClass('w-full', 'min-h-12', 'rounded-xl', 'bg-surface', 'text-text');
    expect(button.style.getPropertyValue('--mgc-shimmer-duration')).toBe('4.8s');
    expect(button.style.getPropertyValue('--mgc-shimmer-strength')).toBe('48%');
    expect(button.style.getPropertyValue('--mgc-shimmer-color')).toBe('var(--t-accent)');
  });

  it('provides an explicit static state when animation is disabled', () => {
    renderShimmerButton({ animate: false });
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-shimmer-animate', 'false');
    expect(button.style.getPropertyValue('--mgc-shimmer-play')).toBe('paused');
  });

  it('passes closed-vocabulary motion through renderer attributes', () => {
    renderShimmerButton({ motion: { reveal: 'fade' } });
    expect(screen.getByRole('button')).toHaveAttribute('data-reveal', 'fade');
  });

  it('exposes every prop and refuses unsafe links or unreachable utilities', () => {
    const defaults = shimmerButtonSchema.props.parse({});
    expect(defaults).toEqual({
      align: 'start',
      animate: true,
      intensity: 'balanced',
      label: 'Get started',
      openInNewTab: false,
      radius: 'pill',
      size: 'medium',
      speed: 'normal',
      tone: 'accent',
      type: 'button',
      width: 'auto',
    });
    expect(Object.keys(shimmerButtonSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(shimmerButtonSchema.props.shape).sort(),
    );
    expect(shimmerButtonSchema.props.safeParse({ href: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(shimmerButtonSchema.props.safeParse({ href: '//example.com' }).success).toBe(false);
    expect(shimmerButtonSchema.props.safeParse({ href: '/\\example.com' }).success).toBe(false);
    expect(shimmerButtonSchema.props.safeParse({ className: 'bg-blue-500' }).success).toBe(false);
    expect(shimmerButtonSchema.props.safeParse({ className: 'md:w-full' }).success).toBe(true);
  });
});
