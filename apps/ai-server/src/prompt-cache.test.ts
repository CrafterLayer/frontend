/**
 * The plan request's cache layout (2026-10-12), after a run that wrote 11,465 tokens to the
 * cache and read none. Ours to prove: every breakpoint lives an hour; the skills sit behind
 * their own breakpoint, split so the joined text is unchanged; the conversation so far is
 * cached on a follow-up; nothing is marked when the system segment is too small to cache;
 * and what the request builder really sends to the SDK carries the same layout.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { createCacheGate } from './cache-gate';
import { proposePlan } from './claude';
import type { PromptParts } from './prompt';
import { PROMPT_CACHE, cachedPrompt, turnText } from './prompt-cache';

const STABLE = '# Block catalog\n[]\n\n# Active skills\nExpertise the host activated.\n\n## Copy';

function parts(stable: string, turns: readonly string[], cache = true): PromptParts {
  return {
    system: [
      { type: 'text', text: 'RULES' },
      { type: 'text', text: stable, ...(cache ? { cache_control: { type: 'ephemeral' } } : {}) },
    ],
    messages: turns.map((content, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content,
    })),
  };
}

describe('cachedPrompt', () => {
  it('puts the skills behind their own one-hour breakpoint, the text unchanged', () => {
    const { system } = cachedPrompt(parts(STABLE, ['Make it blue']));
    expect(system.map((block) => block.cache_control ?? null)).toEqual([
      null,
      PROMPT_CACHE,
      PROMPT_CACHE,
    ]);
    expect(PROMPT_CACHE).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(system[2]?.text.startsWith('# Active skills\n')).toBe(true);
    // Joined as the CLI shim joins system blocks: byte for byte what prompt.ts wrote.
    expect(
      system
        .slice(1)
        .map((block) => block.text)
        .join('\n\n'),
    ).toBe(STABLE);
  });

  it('keeps one breakpoint when no skill is active', () => {
    const { system } = cachedPrompt(parts('# Block catalog\n[]', ['Make it blue']));
    expect(system.map((block) => block.cache_control ?? null)).toEqual([null, PROMPT_CACHE]);
  });

  it('caches the conversation so far on a follow-up, never the new turn', () => {
    const { messages } = cachedPrompt(parts(STABLE, ['Build a cafe', 'Built it.', 'Make it blue']));
    expect(messages[0]?.content).toBe('Build a cafe');
    expect(messages[1]?.content).toEqual([
      { type: 'text', text: 'Built it.', cache_control: PROMPT_CACHE },
    ]);
    expect(messages[2]?.content).toBe('Make it blue');
    // A first turn has no conversation to cache.
    expect(cachedPrompt(parts(STABLE, ['Build a cafe'])).messages[0]?.content).toBe('Build a cafe');
  });

  it('marks nothing when the system segment is too small to cache', () => {
    const { system, messages } = cachedPrompt(parts(STABLE, ['Hi', 'Hello.', 'Again'], false));
    expect(system.some((block) => block.cache_control !== undefined)).toBe(false);
    expect(messages.every((turn) => typeof turn.content === 'string')).toBe(true);
  });

  it('reads a turn back as text, whichever form it came in', () => {
    expect(turnText('plain')).toBe('plain');
    expect(turnText([{ type: 'text', text: 'Built it.', cache_control: PROMPT_CACHE }])).toBe(
      'Built it.',
    );
    expect(turnText([{ type: 'image' }])).toBe('[{"type":"image"}]');
  });
});

const REQUEST = {
  version: 1,
  request: 'Make the hero warmer',
  history: [
    { role: 'user', text: 'Build a cafe page' },
    { role: 'assistant', text: 'Built the cafe page.' },
  ],
  context: {
    fragments: [
      {
        source: 'skill.copy',
        kind: 'instruction',
        trust: 'reviewed',
        title: 'Active AI skill: skill.copy',
        body: 'Write short sentences.',
      },
    ],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
    commands: [],
    outputContract: { version: 1, schema: { type: 'object' } },
  },
} as unknown as AiPlanWireRequest;

interface Sent {
  readonly system: readonly Anthropic.TextBlockParam[];
  readonly messages: readonly Anthropic.MessageParam[];
}

describe('what the plan request sends', () => {
  it('sends the one-hour layout, and a same-shape call waits for the first to stream', async () => {
    const sent: Sent[] = [];
    const streamStarts: (() => void)[] = [];
    const client = {
      messages: {
        stream: (params: Sent) => {
          sent.push(params);
          const listeners: (() => void)[] = [];
          streamStarts.push(() => {
            for (const listener of listeners) listener();
          });
          return {
            on: (event: string, listener: () => void) => {
              if (event === 'streamEvent') listeners.push(listener);
            },
            finalMessage: () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve({
                    stop_reason: 'end_turn',
                    stop_details: null,
                    content: [{ type: 'text', text: '{"commands":[]}' }],
                    usage: { input_tokens: 1, output_tokens: 1 },
                  });
                }, 30);
              }),
          };
        },
      },
    } as unknown as Anthropic;
    const cacheGate = createCacheGate();
    const first = proposePlan(REQUEST, { client, cacheGate });
    const second = proposePlan(REQUEST, { client, cacheGate });
    await new Promise((resolve) => setTimeout(resolve, 5));
    // The second has not been sent: the first is still writing the shared prefix.
    expect(sent).toHaveLength(1);
    streamStarts[0]?.();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(sent).toHaveLength(2);
    await Promise.all([first, second]);

    const [request] = sent;
    expect(request?.system.map((block) => block.cache_control ?? null)).toEqual([
      null,
      PROMPT_CACHE,
      PROMPT_CACHE,
    ]);
    expect(request?.messages.map((turn) => typeof turn.content)).toEqual([
      'string',
      'object',
      'string',
    ]);
  });
});
