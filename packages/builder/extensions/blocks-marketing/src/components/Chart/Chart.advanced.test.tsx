import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Node } from '@craftkit/builder-schema';
import { advancedChartTypes, type AdvancedChartType } from './advanced-contract';
import { exampleDrawing } from './AdvancedChart/fixtures';
import { Chart } from './Chart';

const node: Node = { id: 'advanced-integration', type: 'chart', props: {} };

function chart(kind: AdvancedChartType, overrides: Record<string, unknown> = {}, isCanvas = false) {
  const { props } = exampleDrawing(kind, overrides, isCanvas);
  return render(<Chart node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

describe('Chart advanced integration', () => {
  it.each(advancedChartTypes)('publishes %s with a named image and source table', (kind) => {
    const { container } = chart(kind);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-labelledby',
      'advanced-integration-title',
    );
    expect(screen.getByRole('table')).toHaveClass('sr-only');
    expect(container.querySelector('figure')).toHaveAttribute('data-chart', kind);
    expect(container.querySelector('[data-chart-plot]')).toHaveAttribute('data-chart-plot', kind);
    expect(container.querySelector('[data-ck-bind]')).toBeNull();
  });

  it('keeps semantic bubble roles and independent Size units in the accessible table', () => {
    chart('bubble');
    const table = within(screen.getByRole('table'));
    expect(table.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'X',
      'Revenue (Y)',
      'Conversions (Size)',
    ]);
    const firstRow = table.getByRole('rowheader', { name: '500' }).parentElement;
    expect(firstRow?.textContent).toBe('500$1,90012');
  });

  it('keeps histogram counts unitless even if unrelated value affixes are supplied', () => {
    const { container } = chart('histogram', { valuePrefix: '$' });
    expect(screen.getByRole('table').textContent).not.toContain('$');
    expect(container.querySelector('[data-chart-axis]')?.textContent).not.toContain('$');
    expect(container.querySelector('[data-chart-values]')?.textContent).not.toContain('$');
  });

  it('does not publish a misleading table or image for a missing specialized role', () => {
    chart('boxplot', { series: [] });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it.each(['boxplot', 'candlestick', 'bullet'] as const)(
    'prints positional roles after user-facing names for %s',
    (kind) => {
      const drawing = exampleDrawing(kind);
      chart(kind, {
        series: drawing.props.series.map((series, index) => ({
          ...series,
          name: `Measure ${String(index + 1)}`,
        })),
      });
      const headers = within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent);
      expect(headers[0]).toMatch(/Measure 1 \((Min|Open|Actual)\)/u);
    },
  );

  it.each(advancedChartTypes.filter((kind) => kind !== 'histogram'))(
    'retains each category editor and a single unit editor for %s',
    (kind) => {
      const drawing = exampleDrawing(kind, { showValues: true, valuePrefix: '$' }, true);
      const swapped = (key: string) => (<span data-editor={key} />) as unknown as string;
      const props = {
        ...drawing.props,
        valuePrefix: swapped('valuePrefix'),
        categories: drawing.props.categories.map((_, index) =>
          swapped(`categories.${String(index)}`),
        ),
        series: drawing.props.series.map((series, index) => ({
          ...series,
          name: swapped(`series.${String(index)}.name`),
        })),
      };
      const { container } = render(
        <Chart node={node} props={props} slots={{}} data={{}} isCanvas />,
      );
      const editors = [...container.querySelectorAll('[data-editor]')];
      const names = editors.map((element) => element.getAttribute('data-editor'));
      expect(new Set(names).size).toBe(names.length);
      expect(names).toContain('valuePrefix');
      props.categories.forEach((_, index) => {
        expect(names).toContain(`categories.${String(index)}`);
      });
      editors.forEach((element) =>
        expect(element.closest('[data-ck-bind]')).toHaveAttribute(
          'data-ck-bind',
          element.getAttribute('data-editor'),
        ),
      );
      expect(container.innerHTML).not.toContain('[object Object]');
      expect(container.querySelector('title')).toBeNull();
    },
  );
});
