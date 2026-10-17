import type { EvalCase } from '../corpus/types';
import type { EvalPlanShape, EvalRunOutput } from '../harness/output';

/**
 * Fixtures for the grader tests.
 *
 * A grader that cannot fail a bad plan is worthless, so every grader test
 * builds BOTH a plan that should pass and a plan that should fail, from the
 * same base. Keeping the base here means a test says only what it is varying,
 * which is the difference between a test that documents a rule and a test that
 * documents JSON.
 */

/** Node ids the `starter` fixture really has — see harness/kernel.ts. */
export const STARTER_NODE_IDS = ['root', 'ev-0001', 'ev-0002'] as const;

export function runOutput(overrides: Partial<EvalRunOutput> = {}): EvalRunOutput {
  return {
    caseId: 'test-case',
    fixture: 'starter',
    dir: 'ltr',
    request: 'Add an FAQ section.',
    mode: 'offline',
    outcome: 'plan',
    plan: {
      rationale: 'Add an FAQ.',
      commands: [
        {
          command: 'insertNode',
          args: { type: 'faq', props: { heading: 'Questions' }, parentId: 'root', slot: 'default' },
        },
      ],
    },
    failure: null,
    policy: {
      allowedCommands: ['insertNode', 'insertComposition', 'setProp', 'removeNode', 'moveNode'],
      maxCommands: 64,
      maxOperations: 256,
    },
    metrics: {
      commandCount: 1,
      contextFragments: 4,
      contextTokens: 3000,
      elapsedMs: 40,
      attempts: 1,
      repaired: false,
      salvaged: null,
    },
    document: {
      rootId: 'root',
      rootType: 'page',
      nodeIds: [...STARTER_NODE_IDS],
    },
    ...overrides,
  };
}

export function planWith(commands: EvalPlanShape['commands']): EvalPlanShape {
  return { rationale: 'Test plan.', commands };
}

export function evalCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 'test-case',
    title: 'Test case',
    category: 'test',
    fixture: 'starter',
    dir: 'ltr',
    request: 'Add an FAQ section.',
    must: {
      outcome: 'plan',
      forbiddenCommands: ['applyPatches'],
      forbiddenText: [],
      requiredTargetNodeIds: [],
    },
    should: { minCommands: 1, maxCommands: 4, allBlockTypes: ['faq'] },
    budget: { maxCommands: 4, maxContextTokens: 120_000, maxElapsedMs: 120_000 },
    rubric: 'Does it read like a real FAQ?',
    why: 'Fixture.',
    ...overrides,
  };
}
