import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixtureBlocks, landingFixture } from '@craftkit/builder-core/testing';

import { assembleAiContext } from '../context';
import type { AiEffectiveCommandPolicy, AiSkillActivationPin } from '../skills';
import type { AiPlan } from '../types';
import {
  AiValidatedProposalError,
  assertAuthenticatedAiValidatedProposal,
  createAiValidatedProposal,
  type AiValidatedProposal,
} from './validated-proposal';

function kernel() {
  return createBuilder({ document: landingFixture(), extensions: [fixtureBlocks] });
}

function proposalInputs() {
  const live = kernel();
  const allowedCommands = ['setProp'];
  const policy: AiEffectiveCommandPolicy = {
    allowedCommands,
    maxCommands: 4,
    maxOperations: 8,
  };
  const args = { id: 'hero1', key: 'heading', value: 'Pinned heading' };
  const commands: AiPlan['commands'][number][] = [{ command: 'setProp', args }];
  const plan: AiPlan = { rationale: 'Pin this edit.', commands };
  const skillActivations: AiSkillActivationPin[] = [
    {
      id: 'craftkit.hero-copy',
      version: '1.0.0',
      contentFingerprint: `skill-v1-sha256-${'a'.repeat(64)}`,
      reason: 'explicit',
    },
  ];
  return {
    live,
    plan,
    policy,
    skillActivations,
    allowedCommands,
    commands,
    args,
  };
}

describe('AiValidatedProposal', () => {
  it('detaches and deeply freezes the plan, effective policy, and active Skill pins', () => {
    const inputs = proposalInputs();
    const proposal = createAiValidatedProposal({
      plan: inputs.plan,
      policy: inputs.policy,
      skillActivations: inputs.skillActivations,
      context: assembleAiContext(inputs.live.context),
    });

    inputs.allowedCommands.push('removeNode');
    inputs.commands.push({ command: 'removeNode', args: { id: 'hero1' } });
    inputs.args.value = 'Caller mutation';
    inputs.skillActivations[0]!.contentFingerprint = 'caller mutation';

    expect(proposal.plan).toEqual({
      rationale: 'Pin this edit.',
      commands: [
        {
          command: 'setProp',
          args: { id: 'hero1', key: 'heading', value: 'Pinned heading' },
        },
      ],
    });
    expect(proposal.policy.allowedCommands).toEqual(['setProp']);
    expect(proposal.skillActivations[0]?.contentFingerprint).toMatch(
      /^skill-v1-sha256-[a-f0-9]{64}$/,
    );
    expect(Object.isFrozen(proposal)).toBe(true);
    expect(Object.isFrozen(proposal.plan)).toBe(true);
    expect(Object.isFrozen(proposal.plan.commands)).toBe(true);
    expect(Object.isFrozen(proposal.plan.commands[0]?.args)).toBe(true);
    expect(Object.isFrozen(proposal.policy)).toBe(true);
    expect(Object.isFrozen(proposal.policy.allowedCommands)).toBe(true);
    expect(Object.isFrozen(proposal.skillActivations)).toBe(true);
    expect(Object.isFrozen(proposal.skillActivations[0])).toBe(true);
  });

  it('pins deterministic context and proposal fingerprints', () => {
    const first = proposalInputs();
    const second = proposalInputs();
    const firstProposal = createAiValidatedProposal({
      plan: first.plan,
      policy: first.policy,
      skillActivations: first.skillActivations,
      context: assembleAiContext(first.live.context),
    });
    const equalProposal = createAiValidatedProposal({
      plan: second.plan,
      policy: second.policy,
      skillActivations: second.skillActivations,
      context: assembleAiContext(second.live.context),
    });

    second.live.dispatch('setProp', {
      id: 'hero1',
      key: 'heading',
      value: 'A different context identity',
    });
    const changedContextProposal = createAiValidatedProposal({
      plan: second.plan,
      policy: second.policy,
      skillActivations: second.skillActivations,
      context: assembleAiContext(second.live.context),
    });

    expect(firstProposal.contextFingerprint).toMatch(/^ai-context-v1-sha256-[a-f0-9]{64}$/);
    expect(firstProposal.proposalFingerprint).toMatch(/^ai-proposal-v1-sha256-[a-f0-9]{64}$/);
    expect(equalProposal.contextFingerprint).toBe(firstProposal.contextFingerprint);
    expect(equalProposal.proposalFingerprint).toBe(firstProposal.proposalFingerprint);
    expect(changedContextProposal.contextFingerprint).not.toBe(firstProposal.contextFingerprint);
    expect(changedContextProposal.proposalFingerprint).not.toBe(firstProposal.proposalFingerprint);
  });

  it('rejects cloned, plan-substituted, or policy-broadened values as unauthenticated', () => {
    const inputs = proposalInputs();
    const proposal = createAiValidatedProposal({
      plan: inputs.plan,
      policy: inputs.policy,
      skillActivations: inputs.skillActivations,
      context: assembleAiContext(inputs.live.context),
    });
    const clone = { ...proposal } as AiValidatedProposal;
    const substituted = {
      ...proposal,
      plan: { rationale: 'Substituted.', commands: [] },
    } as AiValidatedProposal;
    const broadened = {
      ...proposal,
      policy: {
        ...proposal.policy,
        allowedCommands: [...proposal.policy.allowedCommands, 'removeNode'],
      },
    } as AiValidatedProposal;

    expect(() => {
      assertAuthenticatedAiValidatedProposal(clone);
    }).toThrow(AiValidatedProposalError);
    expect(() => {
      assertAuthenticatedAiValidatedProposal(substituted);
    }).toThrow(AiValidatedProposalError);
    expect(() => {
      assertAuthenticatedAiValidatedProposal(broadened);
    }).toThrow(AiValidatedProposalError);
  });
});
