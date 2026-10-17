/**
 * data.show on the landing fixture (2026-10-12): rows pasted (or dropped) under an instruction
 * line become a real Chart or Table block — the marketing blocks' own schemas judging every
 * value — with no model. The instruction lines are the ones the panel's drop writes.
 */
import { describe, expect, it } from 'vitest';

import { tryDirectTool } from '@craftkit/builder';

import { dropLabels } from '../agent/copy/drop-labels';
import { dataDraft } from '../agent/hooks/use-data-drop';
import { createPlaygroundKernel } from './create-playground-kernel';

const ROWS = 'Month,Bookings,Walk-ins\nJan,120,40\nFeb,135,38\nMar,160,52';

function insertedNode(request: string) {
  const kernel = createPlaygroundKernel({ fixture: 'landing' });
  const before = new Set(Object.keys(kernel.getDocument().nodes));
  const direct = tryDirectTool(request, kernel);
  if (direct === undefined) return { direct, node: undefined };
  kernel.dispatchGroup(direct.plan.commands.map(({ command, args }) => ({ command, args })));
  const nodes = kernel.getDocument().nodes;
  const id = Object.keys(nodes).find((key) => !before.has(key));
  return { direct, node: id === undefined ? undefined : nodes[id] };
}

describe('data.show on the landing page', () => {
  it('turns dropped rows under the English instruction into a line chart', () => {
    const { direct, node } = insertedNode(dataDraft('', ROWS, dropLabels('en').instruction));
    expect(direct?.label).toBe('Add a chart from the data');
    expect(node?.type).toBe('chart');
    expect(node?.props).toMatchObject({
      chartType: 'line',
      categories: ['Jan', 'Feb', 'Mar'],
      series: [
        { name: 'Bookings', values: [120, 135, 160] },
        { name: 'Walk-ins', values: [40, 38, 52] },
      ],
    });
  });

  it('reads the Arabic instruction, Arabic digits and a currency', () => {
    const rows = 'الفرع,الإيرادات\nالشمال,"$١٬٢٠٠"\nالجنوب,$900';
    const { direct, node } = insertedNode(dataDraft('', rows, dropLabels('ar').instruction));
    expect(direct?.label).toBe('إضافة مخطط من البيانات');
    expect(node?.props).toMatchObject({
      chartType: 'bar',
      valuePrefix: '$',
      series: [{ name: 'الإيرادات', values: [1200, 900] }],
    });
  });

  it('makes a real table from a markdown table', () => {
    const { node } = insertedNode(
      'Put this in a table\n| Service | Duration | Price |\n|---|---|---:|\n| Consultation | 30 min | $40 |',
    );
    expect(node?.type).toBe('table');
    // `sortAs` is the Table schema's default (2026-10-12: sortable tables read it).
    expect(node?.props['columns']).toEqual([
      { label: 'Service', align: 'start', sortAs: 'auto' },
      { label: 'Duration', align: 'end', sortAs: 'auto' },
      { label: 'Price', align: 'end', sortAs: 'auto' },
    ]);
  });
});
