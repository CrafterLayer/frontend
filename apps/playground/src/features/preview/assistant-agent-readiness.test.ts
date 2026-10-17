import { describe, expect, it } from 'vitest';

import {
  AI_PLAN_WIRE_VERSION,
  DEFAULT_AI_CONTEXT_TOKEN_BUDGET,
  estimateAiPlanWireRequestTokens,
  runAiAgent,
  type AiPlanProvider,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';

import { catalogPolicyFor } from './components/AssistantPanel/catalogPolicyFor';
import { createPlaygroundKernel, type PlaygroundFixture } from './create-playground-kernel';
import { loadPlaygroundTemplates } from './playground-templates';

const REQUEST = 'Change the page direction to RTL.';
const DUPLICATED_BUILTIN_FRAGMENT_SOURCES = new Set([
  'craftkit.block-catalog',
  'craftkit.template-catalog',
  'craftkit.document-shape',
  'craftkit.selection',
]);
/*
  55 since the free-composition block (`customCode`) joined the registry: the
  count is asserted rather than derived so that a pack silently failing to
  register shows up here as a number, not as an assistant that quietly stops
  offering half the catalog.
*/
// 56 since 9521efa (2026-10-05) registered the symbol-instance block beside customCode.
// 56 → 62 on 2026-10-12: table, chart, timeline, menuSection, location and countdown.
// 62 → 63 on 2026-10-12: report (one dataset as KPI cards, a chart and a table).
// 63 → 71 on 2026-10-13: beforeAfter, pullQuote, reviewSummary, caseStudy, jobsList,
// downloadList, appDownload and fundraiser.
const LANDING_BLOCK_COUNT = 71;
// 27 → 28 since c4fee26 (2026-10-09), which gave the landing one more node.
const LANDING_NODE_COUNT = 28;
/*
  The FULL catalog is what the panel sends the offline provider, and it sends
  it with that path's own budget (catalogPolicyFor.ts): 55 blocks no longer
  fit the 64k wire default (65,308 measured 2026-10-06 on the landing fixture,
  after the svg and media vocabulary joined customCode's schema). The remote
  path sends no catalog and keeps the default (ai-context-cost.test.ts).
*/
const FULL_CATALOG = catalogPolicyFor('offline', []);
const FULL_CATALOG_BUDGET =
  FULL_CATALOG.policy?.maxContextTokens ?? DEFAULT_AI_CONTEXT_TOKEN_BUDGET;

async function probeFixture(fixture: Extract<PlaygroundFixture, 'landing' | 'empty'>) {
  // A ready agent has its templates: they load on demand (2026-10-13), so this waits for them.
  await loadPlaygroundTemplates();
  const kernel = createPlaygroundKernel({ fixture });
  let providerCalls = 0;
  let completeWireTokens = 0;
  let duplicateBuiltinFragments: string[] = [];

  const provider: AiPlanProvider = {
    propose: (_request, context) => {
      providerCalls += 1;
      completeWireTokens = estimateAiPlanWireRequestTokens({
        version: AI_PLAN_WIRE_VERSION,
        request: REQUEST,
        context,
      });
      duplicateBuiltinFragments = context.fragments
        .map(({ source }) => source)
        .filter((source) => DUPLICATED_BUILTIN_FRAGMENT_SOURCES.has(source));

      expect(context.blocks).toHaveLength(kernel.context.registry.blocks('site').length);
      // Only the templates written in the page's direction are offered (template-context.ts).
      const { dir } = kernel.getDocument();
      const offered = kernel.context.registry
        .compositions('site')
        .filter((entry) => entry.dir === undefined || entry.dir === dir);
      expect(context.templates).toHaveLength(offered.length);
      expect(offered.length).toBeLessThan(kernel.context.registry.compositions('site').length);
      expect(context.document.nodes).toHaveLength(Object.keys(kernel.getDocument().nodes).length);
      if (fixture === 'landing') {
        expect(context.blocks).toHaveLength(LANDING_BLOCK_COUNT);
        expect(context.document.nodes).toHaveLength(LANDING_NODE_COUNT);
        expect(context.document.nodes.find(({ id }) => id === 'hero')?.responsive).toEqual({
          mobile: { align: 'start', motion: { reveal: 'none' }, gutter: 'md' },
        });
      }
      expect(context.commands?.some(({ name }) => name === 'setDocMeta')).toBe(true);
      expect(context.outputContract?.version).toBe(1);

      return Promise.resolve({
        rationale: 'Use one registered command to change page direction.',
        commands: [{ command: 'setDocMeta', args: { dir: 'rtl' } }],
      });
    },
  };

  const result = await runAiAgent({
    runId: `readiness-${fixture}`,
    clock: fixedClock(100),
    kernel,
    provider,
    request: REQUEST,
    validationPorts: { clock: fixedClock(200), ids: seededIds(`readiness-${fixture}`) },
    ...FULL_CATALOG,
    apply: 'never',
  });

  return { result, providerCalls, completeWireTokens, duplicateBuiltinFragments };
}

describe('real Playground AI agent readiness', () => {
  it.each(['landing', 'empty'] as const)(
    'fits the complete %s request under the full-catalog budget and reaches the provider once',
    async (fixture) => {
      const evidence = await probeFixture(fixture);

      expect(evidence.result.status).toBe('proposed');
      expect(evidence.providerCalls).toBe(1);
      expect(evidence.completeWireTokens).toBeGreaterThan(0);
      expect(evidence.completeWireTokens).toBeLessThan(FULL_CATALOG_BUDGET);
      expect(evidence.duplicateBuiltinFragments).toEqual([]);
    },
  );

  it('keeps all selected landing nodes as focus ids without duplicating node facts', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const selectedIds = Object.keys(kernel.getDocument().nodes);
    kernel.setSelection(selectedIds);
    let completeWireTokens = 0;
    const provider: AiPlanProvider = {
      propose: (request, context) => {
        expect(context.selection).toEqual({ ids: selectedIds });
        expect(JSON.stringify(context.selection)).not.toContain(
          'Build pages your kernel can prove',
        );
        completeWireTokens = estimateAiPlanWireRequestTokens({
          version: AI_PLAN_WIRE_VERSION,
          request,
          context,
        });
        return Promise.resolve({
          rationale: 'Use one registered command to preserve direction.',
          commands: [{ command: 'setDocMeta', args: { dir: 'ltr' } }],
        });
      },
    };

    const result = await runAiAgent({
      runId: 'readiness-all-selected',
      clock: fixedClock(100),
      kernel,
      provider,
      request: REQUEST,
      validationPorts: { clock: fixedClock(200), ids: seededIds('readiness-all-selected') },
      ...FULL_CATALOG,
      apply: 'never',
    });

    expect(result.status).toBe('proposed');
    expect(completeWireTokens).toBeLessThan(FULL_CATALOG_BUDGET);
  });
});
