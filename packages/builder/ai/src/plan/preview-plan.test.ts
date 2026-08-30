import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import type { AiPlan } from '../types';
import { previewAiPlan } from './preview-plan';
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

describe('previewAiPlan', () => {
  it('returns the WOULD-BE document without touching the live kernel', () => {
    const kernel = planKernel();
    const before = kernel.getDocument();

    const previewed = previewAiPlan({
      kernel,
      plan,
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
      }),
    ).toThrow(AiPlanRejectedError);
  });
});
