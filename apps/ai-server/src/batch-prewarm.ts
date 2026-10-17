import type Anthropic from '@anthropic-ai/sdk';

import { cacheShape } from './cache-gate';
import { usageOf, type UsageReport } from './plan-params';
import { estimateTokens } from './prompt';
import { minCacheableTokens } from './prompt-cache';

/*
  One live call before a batch, so its items READ a shared prefix instead of each WRITING it
  (2026-10-13). A cache entry is readable only once the request writing it has started to
  answer, and a batch runs its items side by side: three pages of one job each wrote the same
  rules at the batch's write price and read none of each other's. Sent first, alone, with
  exactly that prefix and `max_tokens: 0`, a warm call writes the entry and bills no output; the
  items then read it (their breakpoints live an hour, prompt-cache.ts, as a batch needs).

  What it costs, per prefix of P tokens shared by N items (base input price 1; a batch bills
  half of every rate; a one-hour write is 2x, a read 0.1x — 0.05x on Opus 5.5):
    no warm call, items run together:  N x (0.5 x 2P)          = N x P
    no warm call, items run in turn:   P + (N - 1) x 0.05P
    one warm call, live:               2P + N x 0.05P
  It repays its own write only once three or more items would each have written the prefix
  (2P + 0.05NP < NP needs N > 2.1), so it is sent for a prefix three or more items share — at
  N = 2 it costs 2.1P against at most 2P without it. At most one per batch: the prefix with the
  most tokens x items, among those that clear the model's minimum (below it nothing caches).

  Only where the warm call can match the items' prefix byte for byte:
  - `max_tokens: 0` is refused with structured outputs (`output_config.format`), and the format
    is part of what the prompt renders — a request carrying it cannot be reshaped into a warm call
    that matches it (prompt-caching.md, keep-alive and pre-warming). Items on the `sdk` backend
    carry it, so they are never warmed; an `api:` model's items carry the schema as system text
    instead (`apiParams`), so theirs are.
  - nor with extended thinking (`thinking.type: 'enabled'`) or a forced tool choice.
  The warm call copies the items' model, tools, thinking and effort verbatim (both are part of
  the cached prefix) and their system blocks up to the shared breakpoint; its one user line is
  a placeholder after the breakpoint. Never inside the batch: a batch refuses `max_tokens: 0`.
*/

/** Items that must share a prefix before a warm call repays its own write (see above). */
export const PREWARM_MIN_SHARERS = 3;
/** A warm call is prefill only: seconds. Past this the batch goes without it. */
export const PREWARM_TIMEOUT_MS = 20_000;

type ItemParams = Anthropic.Messages.BatchCreateParams.Request['params'];

/** The one warm call worth sending, how many items share its prefix, and its estimated size. */
export interface WarmPlan {
  readonly params: Anthropic.MessageCreateParamsNonStreaming;
  readonly sharers: number;
  readonly tokens: number;
}

/** Whether a zero-token warm call can carry this request's settings (see above). */
function warmable(params: ItemParams): boolean {
  const choice = params.tool_choice?.type;
  return (
    params.output_config?.format == null &&
    params.thinking?.type !== 'enabled' &&
    choice !== 'tool' &&
    choice !== 'any' &&
    Array.isArray(params.system)
  );
}

/** `params`'s prefix up to its system block `depth`, as a zero-token warm call. */
function warmParams(
  params: ItemParams,
  system: readonly Anthropic.TextBlockParam[],
  depth: number,
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: params.model,
    max_tokens: 0,
    ...(params.tools === undefined ? {} : { tools: params.tools }),
    ...(params.thinking === undefined ? {} : { thinking: params.thinking }),
    ...(params.output_config == null ? {} : { output_config: params.output_config }),
    system: system.slice(0, depth + 1),
    messages: [{ role: 'user', content: 'warmup' }],
  };
}

/**
 * The warm call for a batch's `requests`, or undefined when none would pay: the system prefix,
 * up to one of its breakpoints, with the most tokens x items among those at least
 * `PREWARM_MIN_SHARERS` items share and that clear the model's minimum.
 */
export function prewarmPlan(
  requests: readonly Anthropic.Messages.BatchCreateParams.Request[],
): WarmPlan | undefined {
  const shared = new Map<string, { params: WarmPlan['params']; tokens: number; items: number }>();
  for (const { params } of requests) {
    if (!warmable(params)) continue;
    const system = params.system as readonly Anthropic.TextBlockParam[];
    let tokens = 0;
    for (const [depth, block] of system.entries()) {
      tokens += estimateTokens(block.text);
      if (block.cache_control == null) continue;
      const warm = warmParams(params, system, depth);
      const key = cacheShape([
        warm.model,
        warm.tools,
        warm.thinking,
        warm.output_config,
        warm.system,
      ]);
      const entry = shared.get(key) ?? { params: warm, tokens, items: 0 };
      entry.items += 1;
      shared.set(key, entry);
    }
  }
  let best: WarmPlan | undefined;
  for (const { params, tokens, items } of shared.values()) {
    if (items < PREWARM_MIN_SHARERS || tokens < minCacheableTokens(params.model)) continue;
    if (best === undefined || items * tokens > best.sharers * best.tokens) {
      best = { params, sharers: items, tokens };
    }
  }
  return best;
}

/** Send the warm call (live, not streamed) and say what it cost; rejects as the API does. */
export async function prewarm(
  client: Anthropic,
  plan: WarmPlan,
  signal: AbortSignal,
): Promise<UsageReport> {
  const message = await client.messages.create(plan.params, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(PREWARM_TIMEOUT_MS)]),
  });
  return usageOf(message);
}
