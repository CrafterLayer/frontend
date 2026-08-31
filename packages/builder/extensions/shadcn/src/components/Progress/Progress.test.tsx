import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Progress } from './Progress';
import { progressSchema } from './schema';

afterEach(cleanup);

const node: Node = { id: 'progress-status', type: 'progress', props: {} };

function renderProgress(overrides: Record<string, unknown> = {}) {
  return render(
    <Progress
      node={node}
      props={progressSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Progress', () => {
  it('announces its visible label, determinate value, maximum, and percentage', () => {
    renderProgress({ label: 'Upload progress', value: 30, max: 50 });

    const progressbar = screen.getByRole('progressbar', { name: 'Upload progress' });
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuenow', '30');
    expect(progressbar).toHaveAttribute('aria-valuemax', '50');
    expect(progressbar).toHaveAttribute('aria-valuetext', '60%');
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('clamps rendered values to the configured range without corrupting aria state', () => {
    renderProgress({ label: 'Over target', value: 125, max: 100 });

    const progressbar = screen.getByRole('progressbar', { name: 'Over target' });
    const indicator = progressbar.firstElementChild;
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
    expect(progressbar).toHaveAttribute('aria-valuetext', '100%');
    expect(indicator).toHaveStyle({ inlineSize: '100%' });
    expect(indicator).toHaveAttribute('data-progress-percent', '100');
  });

  it('can hide the printed value while retaining an accessible value', () => {
    renderProgress({ showValue: false, value: 25 });

    expect(screen.queryByText('25%')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '25%');
  });

  it('applies size, role-token variant, radius, reduced-motion, and custom utilities', () => {
    const { container } = renderProgress({
      size: 'large',
      variant: 'success',
      radius: 'large',
      className: 'max-w-content-narrow',
    });

    const progressbar = screen.getByRole('progressbar');
    expect(container.firstElementChild).toHaveClass('max-w-content-narrow');
    expect(progressbar).toHaveClass('h-4', 'rounded-xl', 'bg-text/10');
    expect(progressbar.firstElementChild).toHaveClass(
      'bg-success',
      'rounded-xl',
      'ms-0',
      'me-auto',
      'motion-reduce:transition-none',
    );
  });

  it('exposes every prop and rejects invalid ranges or unsafe utilities', () => {
    expect(Object.keys(progressSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(progressSchema.props.shape).sort(),
    );
    expect(progressSchema.props.safeParse({ max: 0 }).success).toBe(false);
    expect(progressSchema.props.safeParse({ value: -1 }).success).toBe(false);
    expect(progressSchema.props.safeParse({ className: 'bg-red-500' }).success).toBe(false);
    expect(progressSchema.props.safeParse({ className: 'md:max-w-content-wide' }).success).toBe(
      true,
    );
  });
});
