import { describe, expect, it } from 'vitest';
import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { expandAgentTools } from '../tools/agent/expand';
import { validateAiPlan } from '../plan/validate-plan';
import { reportKernel, reportPageBlocks } from './report-page.fixtures';

describe('report quality notes reach the page', () => {
  it.each(['en', 'ar'] as const)('applies quality notes through existing blocks in %s', (lang) => {
    const kernel = reportKernel(lang);
    const expanded = expandAgentTools(
      {
        rationale: 'Analyze source data.',
        commands: [
          {
            command: 'tool',
            args: {
              name: 'report.page',
              input: {
                data: 'Month,Revenue,Costs\nJan,$100,€40',
                lang,
              },
            },
          },
        ],
      },
      kernel,
    );
    expect(expanded.issues).toEqual([]);
    const valid = validateAiPlan(expanded.plan, kernel, {
      clock: fixedClock(2),
      ids: seededIds('quality-validation'),
    });
    expect(valid.ok, JSON.stringify(valid)).toBe(true);
    if (!valid.ok) throw new Error('Expected a valid report.');
    const before = kernel.getDocument();
    kernel.dispatchGroup(valid.plan.commands);
    const content = JSON.stringify(kernel.getDocument());
    expect(content).toContain(lang === 'ar' ? 'بوحدات مختلفة' : 'different units');
    expect(content).not.toContain(lang === 'ar' ? 'هامش الربح' : 'Profit margin');
    kernel.undo();
    expect(kernel.getDocument()).toEqual(before);
  });

  it('retains method notes without a rich-text renderer', () => {
    const base = reportKernel();
    const kernel = createBuilder({
      document: base.getDocument(),
      extensions: [
        {
          ...reportPageBlocks,
          contributes: {
            blocks:
              reportPageBlocks.contributes?.blocks?.filter(
                ({ schema }) => schema.type !== 'richText',
              ) ?? [],
          },
        },
      ],
      ports: { clock: fixedClock(1), ids: seededIds('quality') },
    });
    const expanded = expandAgentTools(
      {
        rationale: 'Analyze source data.',
        commands: [
          {
            command: 'tool',
            args: { name: 'report.page', input: { data: 'Month,Revenue,Costs\nJan,$100,€40' } },
          },
        ],
      },
      kernel,
    );
    const valid = validateAiPlan(expanded.plan, kernel, {
      clock: fixedClock(2),
      ids: seededIds('quality-validation'),
    });
    expect(valid.ok, JSON.stringify(valid)).toBe(true);
    if (!valid.ok) throw new Error('Expected a valid report.');
    kernel.dispatchGroup(valid.plan.commands);
    expect(JSON.stringify(kernel.getDocument())).toContain('different units');
  });
});
