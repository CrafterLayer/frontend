import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import type { AiPlan } from '../types';
import { assembleAiContext } from '../context';
import { previewAiPlan } from './preview-plan';
import { createAiValidatedProposal, type AiValidatedProposal } from './validated-proposal';
import { AiPlanRejectedError } from './validate-plan';

function planKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(10), ids: seededIds('live') },
  });
}

const plan: AiPlan = {
  rationale: 'Add supporting copy.',
  commands: [
    {
      command: 'insertNode',
      args: { type: 'text', props: { content: 'Previewed copy' }, parentId: 'sec1' },
    },
  ],
};

function proposalFor(live: ReturnType<typeof planKernel>) {
  return createAiValidatedProposal({
    plan,
    policy: { allowedCommands: ['insertNode'], maxCommands: 10, maxOperations: 10 },
    skillActivations: [],
    context: assembleAiContext(live.context),
  });
}

function broaderProposalFor(live: ReturnType<typeof planKernel>) {
  return createAiValidatedProposal({
    plan: {
      rationale: 'Preview a broader direction edit.',
      commands: [{ command: 'setDocMeta', args: { dir: 'rtl' } }],
    },
    policy: { allowedCommands: ['setDocMeta'], maxCommands: 10, maxOperations: 10 },
    skillActivations: [],
    context: assembleAiContext(live.context),
  });
}

describe('previewAiPlan', () => {
  it('returns the WOULD-BE document without touching the live kernel', () => {
    const kernel = planKernel();
    const before = kernel.getDocument();

    const previewed = previewAiPlan({
      kernel,
      proposal: proposalFor(kernel),
      validationPorts: { clock: fixedClock(20), ids: seededIds('preview') },
    });

    // The live document and history are untouched…
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
    // …and the preview contains the change the plan describes.
    const contents = Object.values(previewed.nodes).map((node) => node.props['content']);
    expect(contents).toContain('Previewed copy');
    expect(Object.keys(previewed.nodes).length).toBe(Object.keys(before.nodes).length + 1);
  });

  it('throws the same rejection a bad plan gets everywhere else', () => {
    expect(() =>
      previewAiPlan({
        kernel: planKernel(),
        plan: { rationale: 'Bad.', commands: [{ command: 'invent', args: {} }] },
        validationPorts: { clock: fixedClock(20), ids: seededIds('preview-bad') },
        policy: { allowedCommands: ['insertNode'], maxCommands: 10 },
      }),
    ).toThrow(AiPlanRejectedError);
  });

  it('requires and rechecks policy before producing a preview', () => {
    const live = planKernel();

    expect(() =>
      previewAiPlan({
        kernel: live,
        plan,
        validationPorts: { clock: fixedClock(20), ids: seededIds('preview-denied') },
        policy: { allowedCommands: ['setProp'], maxCommands: 10 },
      }),
    ).toThrow(/not allowed/);

    expect(() =>
      previewAiPlan({
        kernel: live,
        plan,
        validationPorts: { clock: fixedClock(20), ids: seededIds('preview-missing') },
      } as never),
    ).toThrow(/policy/i);
  });

  it('rejects an added broader policy or a policy-broadened proposal before preview work', () => {
    const live = planKernel();
    const proposal = proposalFor(live);
    const broadened = {
      ...proposal,
      policy: {
        ...proposal.policy,
        allowedCommands: [...proposal.policy.allowedCommands, 'removeNode'],
      },
    } as AiValidatedProposal;

    expect(() =>
      previewAiPlan({
        kernel: live,
        proposal,
        policy: { allowedCommands: ['insertNode', 'removeNode'], maxCommands: 20 },
        validationPorts: { clock: fixedClock(20), ids: seededIds('preview-substitution') },
      } as never),
    ).toThrow(/proposal.*policy|policy.*proposal/i);
    expect(() =>
      previewAiPlan({
        kernel: live,
        proposal: broadened,
        validationPorts: { clock: fixedClock(20), ids: seededIds('preview-broadened') },
      }),
    ).toThrow(/authenticated|proposal/i);
    expect(live.transactions()).toEqual([]);
  });

  it('snapshots a proposal getter once so preview cannot mix authenticated authorities', () => {
    const live = planKernel();
    const strict = proposalFor(live);
    const broader = broaderProposalFor(live);
    let proposalReads = 0;
    const options = {
      kernel: live,
      validationPorts: { clock: fixedClock(20), ids: seededIds('preview-getter-snapshot') },
      get proposal() {
        proposalReads += 1;
        return proposalReads === 1 ? strict : broader;
      },
    };

    const previewed = previewAiPlan(options);

    expect(proposalReads).toBe(1);
    expect(previewed.dir).toBe('ltr');
    expect(Object.values(previewed.nodes).map((node) => node.props['content'])).toContain(
      'Previewed copy',
    );
    expect(live.getDocument().dir).toBe('ltr');
    expect(live.transactions()).toEqual([]);
  });
});
