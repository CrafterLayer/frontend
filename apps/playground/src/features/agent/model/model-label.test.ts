import { describe, expect, it } from 'vitest';

import { modelLabel, modelOption, modelOptions, modelSelection } from './model-label';

describe('modelLabel: the Claude CLI', () => {
  it('names the family, never the transport (SPEC §4.17, cli:sonnet → Sonnet)', () => {
    expect(modelLabel('cli:sonnet')).toEqual({ tier: 'careful', product: 'Sonnet' });
    expect(modelLabel('cli:opus')).toEqual({ tier: 'careful', product: 'Opus' });
    expect(modelLabel('cli:haiku')).toEqual({ tier: 'fast', product: 'Haiku' });
  });

  it('reads a bare cli: as the CLI’s own default Claude', () => {
    expect(modelLabel('cli:')).toEqual({ tier: 'careful', product: 'Claude' });
  });
});

describe('modelLabel: OpenRouter slugs', () => {
  it.each([
    ['minimax/minimax-m3:free', 'free', 'MiniMax M3'],
    ['nvidia/nemotron-3-ultra-550b-a55b:free', 'free', 'Nemotron 3 Ultra 550B'],
    ['poolside/laguna-s-2.1:free', 'free', 'Laguna S 2.1'],
    ['anthropic/claude-sonnet-4.5', 'careful', 'Claude Sonnet 4.5'],
    ['anthropic/claude-haiku-4.5', 'fast', 'Claude Haiku 4.5'],
    ['google/gemini-2.5-flash', 'fast', 'Gemini 2.5 Flash'],
    ['google/gemini-2.5-pro', 'careful', 'Gemini 2.5 Pro'],
    ['openai/gpt-5-mini', 'fast', 'GPT-5 Mini'],
    ['openai/gpt-5', 'careful', 'GPT-5'],
    ['openai/gpt-oss-120b', 'careful', 'GPT-OSS 120B'],
    ['openai/gpt-4o-mini', 'fast', 'GPT-4o Mini'],
    ['openai/o3', 'careful', 'o3'],
    ['deepseek/deepseek-chat-v3.1', 'careful', 'DeepSeek Chat V3.1'],
    ['x-ai/grok-4-fast', 'fast', 'Grok 4 Fast'],
    ['qwen/qwen3-coder', 'careful', 'Qwen3 Coder'],
    ['moonshotai/kimi-k2', 'careful', 'Kimi K2'],
    ['z-ai/glm-4.6', 'careful', 'GLM 4.6'],
    ['meta-llama/llama-3.3-70b-instruct', 'careful', 'Llama 3.3 70B'],
  ] as const)('%s → %s, %s', (id, tier, product) => {
    expect(modelLabel(id)).toEqual({ tier, product });
  });

  it('marks every :free model free, whatever its size, because that is what the person pays', () => {
    expect(modelLabel('google/gemini-2.5-pro:free').tier).toBe('free');
    expect(modelLabel('anthropic/claude-haiku-4.5:free').tier).toBe('free');
  });

  it('drops date stamps, which are release bookkeeping rather than a name', () => {
    expect(modelLabel('qwen/qwen3-235b-a22b-2507').product).toBe('Qwen3 235B');
  });

  it('reads an Anthropic API id the same way as its OpenRouter slug', () => {
    expect(modelLabel('claude-sonnet-4-5')).toEqual({
      tier: 'careful',
      product: 'Claude Sonnet 4.5',
    });
    expect(modelLabel('claude-haiku-4-5-20251001')).toEqual({
      tier: 'fast',
      product: 'Claude Haiku 4.5',
    });
  });
});

describe('modelLabel: never a raw slug as the primary label (SPEC §4.17)', () => {
  const ids = [
    'cli:sonnet',
    'cli:',
    'minimax/minimax-m3:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'some-vendor/some_model-x:beta',
    'weird',
  ];

  it.each(ids)('%j reads as a name', (id) => {
    const { product } = modelLabel(id);
    expect(product.trim()).not.toBe('');
    expect(product).not.toBe(id);
    expect(product).not.toMatch(/[/:_]/u);
  });

  it.each(['', '/', ':free'])(
    '%j carries no name, and gets no English stand-in: the tier word names it',
    (id) => {
      // "Model" was an English word outside the catalog, on an Arabic menu too.
      expect(modelLabel(id).product).toBe('');
      expect(modelLabel(id).tier).toMatch(/^(?:fast|careful|free)$/u);
    },
  );

  it('reads an unknown paid model as careful: it promises neither speed nor low cost', () => {
    expect(modelLabel('acme/widget-7').tier).toBe('careful');
  });
});

describe('modelOption, modelOptions, modelSelection', () => {
  it('keeps the raw id only for setModel', () => {
    expect(modelOption('cli:haiku')).toEqual({ id: 'cli:haiku', tier: 'fast', product: 'Haiku' });
  });

  it('keeps the host’s order and each id once', () => {
    expect(
      modelOptions(['minimax/minimax-m3:free', 'cli:haiku', 'cli:haiku']).map(({ id }) => id),
    ).toEqual(['minimax/minimax-m3:free', 'cli:haiku']);
  });

  it('offers no picker for one model or none: one model is a fact, not a choice', () => {
    expect(modelSelection([], undefined)).toBeNull();
    expect(modelSelection(['cli:haiku'], 'cli:haiku')).toBeNull();
  });

  it('selects the chosen id, or the first offered when the choice is not on offer', () => {
    const ids = ['cli:haiku', 'minimax/minimax-m3:free'];
    expect(modelSelection(ids, 'minimax/minimax-m3:free')?.selected.id).toBe(
      'minimax/minimax-m3:free',
    );
    expect(modelSelection(ids, 'gone/model')?.selected.id).toBe('cli:haiku');
    expect(modelSelection(ids, undefined)?.options).toHaveLength(2);
  });
});
