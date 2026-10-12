/**
 * Reports and the added chart types on the landing fixture (2026-10-12): rows pasted under an
 * instruction line become a real Report block, or a real chart of the new types — the
 * marketing blocks' own schemas judging every value — with no model, in English and Arabic.
 */
import { render, screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';

import { tryDirectTool, type BlockRenderProps, type Node } from '@craftkit/builder';

import { createPlaygroundKernel } from './create-playground-kernel';

const SALES = 'Month,Revenue,Refunds\nJan,18400,900\nFeb,21250,1100\nMar,23900,950';

function inserted(request: string) {
  const kernel = createPlaygroundKernel({ fixture: 'landing' });
  const before = new Set(Object.keys(kernel.getDocument().nodes));
  const direct = tryDirectTool(request, kernel);
  if (direct === undefined) return { direct, node: undefined, kernel };
  kernel.dispatchGroup(direct.plan.commands.map(({ command, args }) => ({ command, args })));
  expect(kernel.validate()).toEqual([]);
  const nodes = kernel.getDocument().nodes;
  const id = Object.keys(nodes).find((key) => !before.has(key));
  return { direct, node: id === undefined ? undefined : nodes[id], kernel };
}

/** Render the node with the block the playground registers for it, as the published page does. */
function renderPublished(kernel: ReturnType<typeof createPlaygroundKernel>, node: Node) {
  const block = kernel.context.registry.block(node.type);
  if (block?.render === undefined) throw new Error(`no renderer for ${node.type}`);
  const Block = block.render as unknown as ComponentType<BlockRenderProps>;
  const props = block.schema.props.parse(node.props) as Record<string, unknown>;
  return render(<Block node={node} props={props} slots={{}} data={{}} isCanvas={false} />);
}

describe('report.build on the landing page', () => {
  it('turns pasted rows under "make a report from this:" into a real Report', () => {
    const { direct, node, kernel } = inserted(`Make a report from this:\n${SALES}`);
    expect(direct?.label).toBe('Add a report from the data');
    expect(node?.type).toBe('report');
    expect(node?.props).toMatchObject({
      title: 'Revenue · Refunds',
      chartType: 'line',
      categories: ['Jan', 'Feb', 'Mar'],
      kpis: [
        { label: 'Revenue', series: 0, measure: 'last', better: 'up' },
        { label: 'Refunds', series: 1, measure: 'last', better: 'down' },
      ],
    });
    if (node === undefined) return;
    const { container } = renderPublished(kernel, node);
    const cards = within(container.querySelector<HTMLElement>('[data-report-kpis]')!).getAllByRole(
      'listitem',
    );
    expect(cards[0]).toHaveTextContent('Revenue23,900▲');
    /* Refunds fell: a good change for a cost. */
    expect(cards[1]?.querySelector('[data-report-change]')).toHaveAttribute(
      'data-report-good',
      'true',
    );
    expect(screen.getByRole('img', { name: 'Revenue · Refunds' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('rowheader')).toHaveLength(3);
  });

  it('reads «اعمل تقرير/لوحة من هذه البيانات:» over Arabic rows', () => {
    const rows =
      'الربع,الحجوزات,الإلغاءات\nالربع الأول,١٢٠,١٨\nالربع الثاني,١٥٠,١٥\nالربع الثالث,١٩٠,١٦';
    const { direct, node } = inserted(`اعمل تقرير/لوحة من هذه البيانات:\n${rows}`);
    expect(direct?.label).toBe('إضافة تقرير من البيانات');
    expect(node?.type).toBe('report');
    expect(node?.props).toMatchObject({
      chartType: 'line',
      series: [
        { name: 'الحجوزات', values: [120, 150, 190] },
        { name: 'الإلغاءات', values: [18, 15, 16] },
      ],
      kpis: [{ better: 'up' }, { better: 'down' }],
    });
  });
});

describe('data.show draws the added chart types on the landing page', () => {
  it.each([
    [
      'Show this as a horizontal bar chart',
      'Reason,Share\nClose to home or work,41\nRecommended by a friend,27',
      'hbar',
    ],
    ['Make a funnel chart', 'Stage,People\nVisitors,12000\nSign-ups,3100\nPaying,600', 'funnel'],
    ['Chart this:', 'Spend,Revenue\n500,2100\n800,2900\n1200,4300', 'scatter'],
    ['Chart this:', 'Metric,Score,Max,Target\nSatisfaction,86,100,90', 'gauge'],
    ['اعمل مخطط راداري', 'المعيار,منتجنا\nالسعر,7\nالجودة,8\nالدعم,9', 'radar'],
    ['اعرض البيانات كخطوط اتجاه', 'اليوم,المبيعات\nالسبت,42\nالأحد,45\nالاثنين,51', 'sparkline'],
    ['Make a combo chart', 'Month,Orders,Returns\nJan,320,40\nFeb,360,42', 'combo'],
  ])('%s → %s', (instruction, rows, chartType) => {
    const { node, kernel } = inserted(`${instruction}\n${rows}`);
    expect(node?.type).toBe('chart');
    expect(node?.props['chartType']).toBe(chartType);
    if (node === undefined) return;
    const { container } = renderPublished(kernel, node);
    expect(container.querySelector('[data-chart-plot]')).toHaveAttribute(
      'data-chart-plot',
      chartType,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(container.querySelector('[data-chart-table]')).toHaveClass('sr-only');
  });

  it('keeps the gauge’s maximum and target from the Max and Target columns', () => {
    const { node } = inserted('Chart this:\nMetric,Score,Max,Target\nNPS,72,100,80');
    expect(node?.props).toMatchObject({ chartType: 'gauge', maxValue: 100, targetValue: 80 });
  });
});
