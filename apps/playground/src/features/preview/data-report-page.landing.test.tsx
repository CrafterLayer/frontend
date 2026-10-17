/**
 * report.page on the landing fixture (2026-10-14): pasted rows under "make a detailed report from
 * this:" become a whole report page of real marketing blocks — a stats header with the key
 * figures, the charts the data supports, the findings and two interactive tables — every value
 * judged by the blocks' own schemas, with no model, in English and Arabic.
 */
import { describe, expect, it } from 'vitest';

import { tryDirectTool, type Node } from '@craftkit/builder';

import { createPlaygroundKernel } from './create-playground-kernel';

const SALES = 'Month,Revenue,Costs\nJan,18400,12100\nFeb,21250,12900\nMar,23900,13300';

function inserted(request: string): { label: string | undefined; nodes: Node[] } {
  const kernel = createPlaygroundKernel({ fixture: 'landing' });
  const before = new Set(Object.keys(kernel.getDocument().nodes));
  const direct = tryDirectTool(request, kernel);
  if (direct === undefined) return { label: undefined, nodes: [] };
  kernel.dispatchGroup(direct.plan.commands.map(({ command, args }) => ({ command, args })));
  expect(kernel.validate()).toEqual([]);
  const document = kernel.getDocument();
  const order = (document.nodes[document.rootId]?.slots?.['default'] ?? []).filter(
    (id) => !before.has(id),
  );
  return {
    label: direct.label,
    nodes: order.flatMap((id) => {
      const node = document.nodes[id];
      return node === undefined ? [] : [node];
    }),
  };
}

describe('report.page on the landing page', () => {
  it('builds the whole page from pasted rows with no model', () => {
    const { label, nodes } = inserted(`Make a detailed report from this:\n${SALES}`);
    expect(label).toBe('Add a computed report page from the data');
    expect(nodes.map(({ type }) => type)).toEqual([
      'stats',
      'chart',
      'chart',
      'richText',
      'table',
      'table',
    ]);
    const [header, trend, comparison, , summary, data] = nodes;
    expect(header?.props).toMatchObject({
      eyebrow: 'Jan → Mar',
      heading: 'Revenue report',
      items: [
        { value: '63,550', label: 'Revenue · total' },
        { value: '21,183', label: 'Revenue · average' },
        { value: '23,900', label: 'Revenue · latest' },
        { value: '23,900', label: 'Revenue · highest', detail: 'Mar' },
      ],
    });
    expect(trend?.props).toMatchObject({ chartType: 'line', categories: ['Jan', 'Feb', 'Mar'] });
    expect(comparison?.props).toMatchObject({ chartType: 'combo', title: 'Revenue vs Costs' });
    for (const table of [summary, data])
      expect(table?.props).toMatchObject({ sortable: true, stickyHeader: true });
    expect(data?.props['columns']).toEqual([
      { label: 'Month', align: 'start', sortAs: 'auto' },
      { label: 'Revenue', align: 'end', sortAs: 'number' },
      { label: 'Costs', align: 'end', sortAs: 'number' },
    ]);
  });

  it('reads «اعمل تقرير مفصل» over Arabic rows and writes the page in Arabic', () => {
    const rows = 'المنطقة,المبيعات\nالرياض,١٢٠٠\nجدة,٩٠٠\nالدمام,٤٠٠';
    const { label, nodes } = inserted(`اعمل تقرير مفصل من هذه البيانات:\n${rows}`);
    expect(label).toBe('إضافة صفحة تقرير محسوبة من البيانات');
    expect(nodes.map(({ type }) => type)).toEqual([
      'stats',
      'chart',
      'chart',
      'richText',
      'table',
      'table',
    ]);
    expect(nodes[1]?.props).toMatchObject({ chartType: 'bar', title: 'المبيعات حسب المنطقة' });
    expect(nodes[2]?.props).toMatchObject({ chartType: 'donut', otherLabel: 'أخرى' });
    expect(nodes[4]?.props).toMatchObject({ searchLabel: 'ابحث في الجدول', nextLabel: 'التالي' });
  });
});
