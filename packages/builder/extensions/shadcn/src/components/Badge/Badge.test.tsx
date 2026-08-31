import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';
import { badgeSchema } from './schema';

afterEach(cleanup);

const node = { id: 'badge-1', type: 'badge', props: {} };

const renderBadge = (overrides: Record<string, unknown> = {}) =>
  render(
    <Badge
      node={node}
      props={badgeSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );

describe('Badge', () => {
  it('renders its label', () => {
    renderBadge({ label: 'Most popular' });

    expect(screen.getByText('Most popular')).toBeInTheDocument();
  });

  /*
    A badge is small, and small is where contrast fails. Every variant carries
    its ink with its ground rather than inheriting whatever it landed on.
  */
  it('pairs every variant with ink that reads on it', () => {
    for (const [variant, ground, ink] of [
      ['accent', 'bg-accent', 'text-accent-text'],
      ['success', 'bg-success', 'text-success-text'],
      ['neutral', 'bg-surface-inverse', 'text-text-inverse'],
    ] as const) {
      const { container, unmount } = renderBadge({ variant });
      expect(container.firstElementChild).toHaveClass(ground);
      expect(container.firstElementChild).toHaveClass(ink);
      unmount();
    }
  });

  it('draws the outline variant from a role rather than a border colour', () => {
    const { container } = renderBadge({ variant: 'outline' });

    expect(container.firstElementChild).toHaveClass('border-accent');
    expect(container.firstElementChild).toHaveClass('text-accent');
  });

  it('schema: keeps the label short enough to stay one line', () => {
    expect(badgeSchema.props.safeParse({ label: 'x'.repeat(33) }).success).toBe(false);
    expect(badgeSchema.props.safeParse({ label: '' }).success).toBe(false);
  });

  it('schema: edits in place, because the label IS the visible text', () => {
    expect(badgeSchema.inlineEditable).toBe('label');
  });
});
