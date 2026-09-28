import { describe, expect, it } from 'vitest';

import {
  MODEL_POLICY_VERSION,
  createModelRouter,
  defaultModelCandidates,
  fastestModel,
  selectLowestQualifiedModel,
  type ModelCapabilityProbe,
  type ModelProbePort,
} from './model-policy';

const checkedAt = 42;
const available: ModelProbePort = {
  probe: (candidate) =>
    Promise.resolve({
      available: true,
      capabilities: candidate.declaredCapabilities,
      efforts: candidate.efforts,
      checkedAt,
    }),
};

describe('model policy', () => {
  it('uses the lowest-cost model whose live probe satisfies the role', async () => {
    const router = await createModelRouter({ probe: available });

    expect(router.select('context')).toMatchObject({
      policyVersion: MODEL_POLICY_VERSION,
      model: 'gpt-5.6-luna',
      effort: 'low',
    });
    expect(router.select('design')).toMatchObject({ model: 'gpt-5.6-terra', effort: 'medium' });
    expect(router.select('visual-review')).toMatchObject({
      model: 'gpt-5.6-sol',
      effort: 'high',
    });
  });

  it('does not trust declared capability when the account probe denies it', async () => {
    const router = await createModelRouter({
      probe: {
        probe: (candidate): Promise<ModelCapabilityProbe> =>
          Promise.resolve({
            available: true,
            capabilities:
              candidate.model === 'gpt-5.6-sol'
                ? candidate.declaredCapabilities.filter((item) => item !== 'vision')
                : candidate.declaredCapabilities,
            efforts: candidate.efforts,
            checkedAt,
          }),
      },
    });

    expect(router.select('visual-review').model).toBe('gpt-6-astra');
  });

  it('records a failed probe as unavailable without hiding the reason', async () => {
    const router = await createModelRouter({
      candidates: defaultModelCandidates().slice(0, 2),
      probe: {
        probe: (candidate) =>
          candidate.model.endsWith('luna')
            ? Promise.reject(new Error('model not enabled'))
            : available.probe(candidate),
      },
    });

    expect(router.select('context').model).toBe('gpt-5.6-terra');
    expect(router.models[0]?.probe).toMatchObject({
      available: false,
      reason: 'model not enabled',
    });
  });

  it('fails closed when no probed model qualifies', () => {
    expect(() =>
      selectLowestQualifiedModel('code', [
        {
          ...defaultModelCandidates()[0]!,
          probe: { available: false, capabilities: [], efforts: [], checkedAt },
        },
      ]),
    ).toThrow('No capability-probed model qualifies');
  });

  it('rejects duplicate configured model identities', async () => {
    const luna = defaultModelCandidates()[0]!;
    await expect(createModelRouter({ candidates: [luna, luna], probe: available })).rejects.toThrow(
      'Duplicate model candidate',
    );
  });
});

/*
  The prompt enhancer's model (2026-09-28): the fastest the server allows, by
  what the slug says — and never a free queue ahead of a model the owner runs
  (nemotron-3.5-lightning:free took 7 min 18 s for one page plan, measured).
*/
describe('fastestModel', () => {
  it("picks the owner's own small model over the default and the free queues", () => {
    expect(fastestModel(['cli:sonnet', 'nvidia/nemotron-3.5-lightning:free', 'cli:haiku'])).toBe(
      'cli:haiku',
    );
    expect(fastestModel(['anthropic/claude-opus-5', 'anthropic/claude-haiku-4.5'])).toBe(
      'anthropic/claude-haiku-4.5',
    );
    expect(fastestModel(['google/gemini-2.5-pro', 'google/gemini-2.5-flash'])).toBe(
      'google/gemini-2.5-flash',
    );
  });

  it('ranks a free slug after every paid or subscription model of its tier', () => {
    expect(fastestModel(['vendor/model-mini:free', 'vendor/model-mini'])).toBe('vendor/model-mini');
    expect(fastestModel(['vendor/any:free', 'cli:'])).toBe('cli:');
  });

  it('reads a tier word only as a whole word of the slug', () => {
    // "gemini" is not "mini", "minimax" is not "mini": neither outranks sonnet.
    expect(fastestModel(['google/gemini-3-pro', 'cli:sonnet'])).toBe('cli:sonnet');
    expect(fastestModel(['minimax/minimax-m3', 'cli:sonnet'])).toBe('cli:sonnet');
  });

  it('keeps the order given on a tie, and answers nothing when nothing is configured', () => {
    expect(fastestModel(['a/one', 'b/two'])).toBe('a/one');
    expect(fastestModel([undefined, ' ', ''])).toBeUndefined();
    expect(fastestModel([])).toBeUndefined();
  });
});
