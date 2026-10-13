/**
 * The cached prefix holds still (2026-10-13). The person saw runs that wrote the prompt cache
 * and read none back. Reproduced end to end — the real remote provider, this server's real
 * handler and prompt, a fake Messages API that records what it is sent, a headless kernel with
 * the real 32-block marketing catalog and the real skills, the catalog policy the playground
 * sends — the prefix itself is sound. Ours to keep so:
 * - the same request on the same page sends byte-identical cached blocks, so it can read them;
 * - a selection may change the catalog block, and new words the skills block, but never the
 *   rules before them, so a request always reads at least the rules;
 * - the server says why it wrote (cache-doctor.ts), and the client receives the reason.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import {
  createBuilder,
  createRemoteAiPlanProvider,
  craftkitHeadlessBlocks,
  headlessBlockManifest,
  marketingBlockSchemas,
  runAiAgent,
  type AiPlanProvider,
  type BuilderKernel,
  type IdPort,
} from '@craftkit/builder/headless';

import { createCacheDoctor } from './cache-doctor';
import { createHandler } from './handler';

/** What a provider reports per call, as the client reads it. */
interface Usage {
  readonly cacheMiss?: unknown;
}

function ids(seed: string): IdPort {
  let n = 0;
  return { newId: () => `${seed}-${String((n += 1))}` };
}

interface Sent {
  readonly system: readonly { readonly text: string; readonly cache_control?: unknown }[];
}

async function skillRegistry(): Promise<unknown> {
  const url = new URL('../../../packages/builder/ai/src/skills/index.ts', import.meta.url).href;
  const skills = (await import(/* @vite-ignore */ url)) as {
    createCraftkitAiSkillRegistry: () => unknown;
  };
  return skills.createCraftkitAiSkillRegistry();
}

function harness(write: number) {
  const sent: Sent[] = [];
  const client = {
    messages: {
      stream: (params: Sent) => {
        sent.push(params);
        const message = {
          id: `msg_${String(sent.length)}`,
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify({ rationale: 'ok', commands: [] }) }],
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: write,
          },
        };
        return { on: () => undefined, finalMessage: () => Promise.resolve(message) };
      },
    },
  } as unknown as Anthropic;
  const handle = createHandler({ client, cacheDoctor: createCacheDoctor({ apiDiagnosis: false }) });
  const provider = createRemoteAiPlanProvider({
    endpoint: 'https://assistant.example.test/plan',
    fetch: (input, init) => handle(new Request(input, init)),
  });
  const kernel = createBuilder({
    extensions: [
      craftkitHeadlessBlocks,
      headlessBlockManifest('marketing', '0.0.0', [...marketingBlockSchemas]),
    ],
    ports: { clock: { now: () => 1 }, ids: ids('n') },
  });
  return { sent, provider, kernel };
}

async function edit(
  provider: AiPlanProvider,
  kernel: BuilderKernel,
  request: string,
  options: { selection?: readonly string[]; onUsage?: (usage: Usage) => void } = {},
): Promise<void> {
  await runAiAgent({
    runId: `run-${request.length.toString()}`,
    clock: { now: () => 1 },
    kernel,
    provider: options.onUsage === undefined ? provider : withUsage(provider, options.onUsage),
    request,
    validationPorts: { clock: { now: () => 1 }, ids: ids('v') },
    selection: options.selection ?? [],
    skillRegistry: (await skillRegistry()) as never,
    apply: 'never',
    // The playground's remote catalog policy (catalogPolicyFor): no catalog but what is in scope.
    composition: { catalogMode: 'none' },
  }).catch(() => undefined); // An empty plan is refused; the requests are what this reads.
}

function withUsage(provider: AiPlanProvider, onUsage: (usage: Usage) => void): AiPlanProvider {
  return {
    ...provider,
    propose: (request: string, context: never, options: Record<string, unknown> = {}) =>
      provider.propose(request, context, { ...options, onUsage }),
  };
}

const cached = (sent: Sent | undefined) =>
  (sent?.system ?? []).filter((block) => block.cache_control !== undefined).map((b) => b.text);

describe('the cached prefix', () => {
  it('is byte-identical for the same request on the same page', async () => {
    const { sent, provider, kernel } = harness(0);
    await edit(provider, kernel, 'Make the page title shorter');
    const first = sent.length;
    await edit(provider, kernel, 'Make the page title shorter');
    expect(first).toBeGreaterThan(0);
    expect(cached(sent[first])).toEqual(cached(sent[0]));
    expect(cached(sent[0]).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the rules when a selection or new words change what follows them', async () => {
    const { sent, provider, kernel } = harness(0);
    const doc = kernel.getDocument();
    const node = Object.keys(doc.nodes).find((id) => id !== doc.rootId) ?? doc.rootId;
    await edit(provider, kernel, 'Make the page title shorter');
    const base = cached(sent[0]);
    await edit(provider, kernel, 'Change this heading to Hello', { selection: [node] });
    await edit(provider, kernel, 'Make the background colours warmer and calmer');
    for (const later of sent.slice(1)) expect(cached(later)[0]).toBe(base[0]);
  });

  it('tells the client why it wrote the cache', async () => {
    const { provider, kernel } = harness(1_200);
    const usages: Usage[] = [];
    await edit(provider, kernel, 'Make the page title shorter', {
      onUsage: (usage) => usages.push(usage),
    });
    expect(usages[0]?.cacheMiss).toEqual({ reason: 'first', missedTokens: null, source: 'local' });
  });
});
