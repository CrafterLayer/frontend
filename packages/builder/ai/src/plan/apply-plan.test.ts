import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { assembleAiContext } from '../context';
import type { AiPlan } from '../types';
import { applyAiPlan } from './apply-plan';
import { createAiValidatedProposal, type AiValidatedProposal } from './validated-proposal';

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(10), ids: seededIds('proposal-apply-live') },
  });
}

function ports(seed: string) {
  return { clock: fixedClock(20), ids: seededIds(seed) };
}

const plan: AiPlan = {
  rationale: 'Apply the pinned edit.',
  commands: [
    {
      command: 'setProp',
      args: { id: 'hero1', key: 'heading', value: 'Authenticated proposal' },
    },
  ],
};

function proposalFor(live: ReturnType<typeof kernel>) {
  return createAiValidatedProposal({
    plan,
    policy: { allowedCommands: ['setProp'], maxCommands: 2, maxOperations: 2 },
    skillActivations: [],
    context: assembleAiContext(live.context),
  });
}

function broaderProposalFor(live: ReturnType<typeof kernel>) {
  return createAiValidatedProposal({
    plan: {
      rationale: 'Apply a broader direction edit.',
      commands: [{ command: 'setDocMeta', args: { dir: 'rtl' } }],
    },
    policy: { allowedCommands: ['setDocMeta'], maxCommands: 2, maxOperations: 2 },
    skillActivations: [],
    context: assembleAiContext(live.context),
  });
}

describe('applyAiPlan validated proposal authority', () => {
  it('applies an authenticated proposal through one grouped AI transaction', () => {
    const live = kernel();
    const proposal = proposalFor(live);

    const applied = applyAiPlan({
      kernel: live,
      proposal,
      validationPorts: ports('authenticated-apply'),
    });

    expect(applied.transactions).toHaveLength(1);
    expect(applied.transactions[0]).toMatchObject({ author: 'ai' });
    expect(live.getDocument().nodes['hero1']?.props['heading']).toBe('Authenticated proposal');
  });

  it('rejects a policy supplied beside a proposal before live dispatch, even when broader', () => {
    const live = kernel();
    const before = live.getDocument();
    const proposal = proposalFor(live);

    expect(() =>
      applyAiPlan({
        kernel: live,
        proposal,
        policy: {
          allowedCommands: ['setProp', 'removeNode'],
          maxCommands: 20,
          maxOperations: 20,
        },
        validationPorts: ports('substituted-policy'),
      } as never),
    ).toThrow(/proposal.*policy|policy.*proposal/i);

    expect(live.getDocument()).toBe(before);
    expect(live.transactions()).toEqual([]);
  });

  it('rejects a cloned proposal whose pinned policy was broadened', () => {
    const live = kernel();
    const before = live.getDocument();
    const proposal = proposalFor(live);
    const broadened = {
      ...proposal,
      policy: {
        ...proposal.policy,
        allowedCommands: ['setProp', 'removeNode'],
      },
    } as AiValidatedProposal;

    expect(() =>
      applyAiPlan({
        kernel: live,
        proposal: broadened,
        validationPorts: ports('broadened-proposal'),
      }),
    ).toThrow(/authenticated|proposal/i);
    expect(live.getDocument()).toBe(before);
    expect(live.transactions()).toEqual([]);
  });

  it('snapshots a proposal getter once so authenticated authorities cannot be mixed', () => {
    const live = kernel();
    const strict = proposalFor(live);
    const broader = broaderProposalFor(live);
    let proposalReads = 0;
    const options = {
      kernel: live,
      validationPorts: ports('proposal-getter-snapshot'),
      get proposal() {
        proposalReads += 1;
        return proposalReads === 1 ? strict : broader;
      },
    };

    const applied = applyAiPlan(options);

    expect(proposalReads).toBe(1);
    expect(applied.proposal).toBe(strict);
    expect(live.getDocument().dir).toBe('ltr');
    expect(live.getDocument().nodes['hero1']?.props['heading']).toBe('Authenticated proposal');
    expect(live.transactions()).toHaveLength(1);
  });

  it('retains an explicit plan plus policy compatibility path', () => {
    const live = kernel();

    const applied = applyAiPlan({
      kernel: live,
      plan,
      policy: { allowedCommands: ['setProp'], maxCommands: 2, maxOperations: 2 },
      validationPorts: ports('explicit-compatibility'),
    });

    expect(applied.transactions).toHaveLength(1);
  });

  it.each([
    ['NaN command bound', { allowedCommands: ['setProp'], maxCommands: Number.NaN }],
    [
      'infinite operation bound',
      { allowedCommands: ['setProp'], maxCommands: 2, maxOperations: Number.POSITIVE_INFINITY },
    ],
    ['oversized command bound', { allowedCommands: ['setProp'], maxCommands: 10_001 }],
  ])('rejects malformed compatibility policy: %s', (_name, policy) => {
    const live = kernel();
    const before = live.getDocument();

    expect(() =>
      applyAiPlan({
        kernel: live,
        plan,
        policy,
        validationPorts: ports('invalid-compatibility-policy'),
      }),
    ).toThrow(/invalid-policy|positive safe integer/i);
    expect(live.getDocument()).toBe(before);
    expect(live.transactions()).toEqual([]);
  });
});
