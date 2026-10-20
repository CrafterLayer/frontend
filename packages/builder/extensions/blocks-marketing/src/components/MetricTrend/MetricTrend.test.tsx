import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricTrend } from './MetricTrend';

describe('MetricTrend', () => {
  it('names the metric and exposes every observation in order', () => {
    render(<MetricTrend label="Revenue by month" values={[10, -5, 0, 20]} />);
    expect(screen.getByRole('img', { name: 'Revenue by month' })).toHaveAccessibleDescription(
      '10 → -5 → 0 → 20',
    );
  });

  it('keeps extreme finite and flat values drawable', () => {
    const { container, rerender } = render(
      <MetricTrend label="Net" values={[-Number.MAX_VALUE, Number.MAX_VALUE]} />,
    );
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/u);
    rerender(<MetricTrend label="Stable" values={[5, 5, 5]} />);
    expect(screen.getByRole('img', { name: 'Stable' })).toHaveAccessibleDescription('5 → 5 → 5');
    expect(container.querySelector('polyline')?.getAttribute('points')).toContain(',20');
  });

  it.each(
    [
      [],
      [1],
      [0, Number.NaN],
      [1, Number.POSITIVE_INFINITY],
      Array.from({ length: 25 }, () => 1),
    ].map((values) => ({ values })),
  )('omits unavailable or invalid trends: %j', ({ values }) => {
    render(<MetricTrend label="Unavailable" values={values} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
