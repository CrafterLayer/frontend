import { describe, expect, it } from 'vitest';

import {
  AI_PLAN_WIRE_VERSION,
  DEFAULT_AI_CONTEXT_TOKEN_BUDGET,
  estimateAiPlanWireRequestTokens,
  runAiAgent,
  type AiPlanProvider,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';

import { createPlaygroundKernel, type PlaygroundFixture } from './create-playground-kernel';

const REQUEST = 'Change the page direction to RTL.';
const DUPLICATED_BUILTIN_FRAGMENT_SOURCES = new Set([
  'craftkit.block-catalog',
  'craftkit.template-catalog',
  'craftkit.document-shape',
  'craftkit.selection',
]);
const LANDING_BLOCK_COUNT = 54;
const LANDING_NODE_COUNT = 27;

async function probeFixture(fixture: Extract<PlaygroundFixture, 'landing' | 'empty'>) {
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
      expect(context.templates).toHaveLength(4);
      expect(context.document.nodes).toHaveLength(Object.keys(kernel.getDocument().nodes).length);
      if (fixture === 'landing') {
        expect(context.blocks).toHaveLength(LANDING_BLOCK_COUNT);
        expect(context.document.nodes).toHaveLength(LANDING_NODE_COUNT);
        expect(context.document.nodes.find(({ id }) => id === 'hero')?.responsive).toEqual({
          mobile: { align: 'start', motion: { reveal: 'none' } },
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
    apply: 'never',
  });

  return { result, providerCalls, completeWireTokens, duplicateBuiltinFragments };
}

describe('real Playground AI agent readiness', () => {
  it.each(['landing', 'empty'] as const)(
    'fits the complete %s request under the default budget and reaches the provider once',
    async (fixture) => {
      const evidence = await probeFixture(fixture);

      expect(evidence.result.status).toBe('proposed');
      expect(evidence.providerCalls).toBe(1);
      expect(evidence.completeWireTokens).toBeGreaterThan(0);
      expect(evidence.completeWireTokens).toBeLessThan(DEFAULT_AI_CONTEXT_TOKEN_BUDGET);
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
      apply: 'never',
    });

    expect(result.status).toBe('proposed');
    expect(completeWireTokens).toBeLessThan(DEFAULT_AI_CONTEXT_TOKEN_BUDGET);
  });
});
