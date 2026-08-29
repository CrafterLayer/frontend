import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { createLocalAiPlanProvider } from '../provider';
import { applyAiPlan } from './apply-plan';
import { generateAiPlan } from './generate-plan';
import { validateAiPlan } from './validate-plan';

const RUNS = 1_000;
const DETERMINISM_SEED = 0x0a11c0de;
const UNDO_SEED = 0x0a11d00d;
const DOOR_SEED = 0x0a11b10c;
const TIMEOUT = 120_000;

const requestArbitrary = fc.constantFrom(
  'add a hero',
  'insert a section',
  'add a text block',
  'add a button',
  'add a box',
);

function propertyKernel(seed: string) {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(0), ids: seededIds(seed) },
  });
}

function validationPorts(seed: string) {
  return { clock: fixedClock(100), ids: seededIds(seed) };
}

describe('AI command-plan properties', () => {
  it(
    `same seed => identical plan (${String(RUNS)} cases, seed ${String(DETERMINISM_SEED)})`,
    async () => {
      await fc.assert(
        fc.asyncProperty(requestArbitrary, async (request) => {
          const left = await generateAiPlan({
            kernel: propertyKernel('same-live'),
            provider: createLocalAiPlanProvider(),
            request,
            validationPorts: validationPorts('same-validation'),
          });
          const right = await generateAiPlan({
            kernel: propertyKernel('same-live'),
            provider: createLocalAiPlanProvider(),
            request,
            validationPorts: validationPorts('same-validation'),
          });
          expect(right).toEqual(left);
          expect(JSON.stringify(right)).toBe(JSON.stringify(left));
        }),
        { numRuns: RUNS, seed: DETERMINISM_SEED },
      );
    },
    TIMEOUT,
  );

  it(
    `apply then undo restores the document exactly (${String(RUNS)} cases, seed ${String(UNDO_SEED)})`,
    async () => {
      await fc.assert(
        fc.asyncProperty(requestArbitrary, async (request) => {
          const kernel = propertyKernel('undo-live');
          const before = structuredClone(kernel.getDocument());
          const plan = await generateAiPlan({
            kernel,
            provider: createLocalAiPlanProvider(),
            request,
            validationPorts: validationPorts('undo-generate'),
          });
          const applied = applyAiPlan({
            kernel,
            plan,
            validationPorts: validationPorts('undo-apply'),
          });

          expect(applied.transactions).toHaveLength(1);
          expect(applied.transactions[0]?.patches.length).toBeGreaterThan(0);
          expect(kernel.undo()).toBe(true);
          expect(kernel.getDocument()).toEqual(before);
        }),
        { numRuns: RUNS, seed: UNDO_SEED },
      );
    },
    TIMEOUT,
  );

  it(
    `every generated plan survives the kernel door (${String(RUNS)} cases, seed ${String(DOOR_SEED)})`,
    async () => {
      await fc.assert(
        fc.asyncProperty(requestArbitrary, async (request) => {
          const kernel = propertyKernel('door-live');
          const plan = await generateAiPlan({
            kernel,
            provider: createLocalAiPlanProvider(),
            request,
            validationPorts: validationPorts('door-generate'),
          });
          expect(validateAiPlan(plan, kernel, validationPorts('door-recheck'))).toMatchObject({
            ok: true,
          });
          const applied = applyAiPlan({
            kernel,
            plan,
            validationPorts: validationPorts('door-apply'),
          });
          expect(applied.transactions.every((transaction) => transaction.author === 'ai')).toBe(
            true,
          );
          expect(kernel.validate()).toEqual([]);
        }),
        { numRuns: RUNS, seed: DOOR_SEED },
      );
    },
    TIMEOUT,
  );
});
