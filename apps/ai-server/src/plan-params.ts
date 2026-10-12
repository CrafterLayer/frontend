import type Anthropic from '@anthropic-ai/sdk';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { buildPrompt } from './prompt';
import { cachedPrompt } from './prompt-cache';
import { withModelThinking } from './thinking-config';

/*
  The Messages API request for one plan call, built in ONE place (2026-10-12).

  A live plan (`claude.ts`, streamed) and a background batch item (`batch-routes.ts`, the
  Message Batches API at half price) send the same request for the same wire body: the same
  prompt, the same cache breakpoints (one-hour entries, which is what a batch wants — its
  requests run minutes apart), the same thinking in the form the model takes, the same
  schema and budget. Two builders would drift on the first edit, and a batch answer would
  then be judged by a door tuned for a different request.
*/

/**
 * `claude-opus-5` by default, and the default is not a placeholder.
 *
 * A plan is a schema-constrained edit to someone's live page, judged by a
 * validator that rejects near-misses outright — so a cheaper model that is
 * right 85% of the time costs more in rejected round trips than it saves per
 * token. Override deliberately, per deployment, with a measurement in hand.
 */
export const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Generous, because a plan is not a chat reply: it composes a whole page as a
 * JSON tree — a landing page of six regions with scoped CSS runs to 15–25k
 * output tokens, and a cut-off plan is not a smaller plan, it is no plan (the
 * JSON does not close). 16k was the first value and it truncated exactly that
 * request. Streaming is what makes a ceiling this size safe: a non-streaming
 * request of this length risks an HTTP timeout.
 */
const DEFAULT_MAX_TOKENS = 32_000;

/**
 * The budgets the Messages API takes as `output_config.effort` — the same
 * five the CLI takes as `--effort`, so one setting means one thing on both.
 */
const API_EFFORT_LEVELS = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const satisfies readonly NonNullable<Anthropic.OutputConfig['effort']>[];

/** What one call is asked for beyond its wire body: the handler's model and budget for it. */
export interface PlanCallSettings {
  readonly model?: string | undefined;
  readonly maxTokens?: number | undefined;
  /** The reasoning budget for THIS call, when it differs from the backend's default. */
  readonly effort?: string | undefined;
  /** True turns thinking off for THIS call (thinking-config.ts says in which form). */
  readonly thinkingOff?: boolean | undefined;
}

export interface UsageReport {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly costUsd?: number | null;
}

function measuredCount(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 1_000_000_000_000
    ? value
    : null;
}

export function usageOf(message: Anthropic.Message): UsageReport {
  const usage = message.usage as unknown as Record<string, unknown> | undefined;
  const cost = usage?.['cost_usd'];
  return {
    inputTokens: measuredCount(usage?.['input_tokens']),
    outputTokens: measuredCount(usage?.['output_tokens']),
    cacheReadTokens: measuredCount(usage?.['cache_read_input_tokens']),
    cacheWriteTokens: measuredCount(usage?.['cache_creation_input_tokens']),
    costUsd: typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null,
  };
}

/** What a plan request without a usable output contract is answered with. */
export const NO_CONTRACT_MESSAGE =
  'The request carried no usable output contract, so no plan shape could be enforced.';

/**
 * The plan schema a request carries, or undefined when it carries none usable.
 *
 * The output schema is NOT written in this server. It travels on the wire as
 * `context.outputContract.schema`, authored by the same package that validates
 * the answer — so the shape the model is constrained to and the shape the door
 * accepts cannot drift apart. `JsonValue` admits `null` and primitives, so the
 * presence of the field is not proof of a schema. Checked rather than asserted:
 * an unusable contract forwarded to the API returns a 400 whose message blames
 * the request, and the deployment mistake would be read as a model failure.
 */
export function contractSchemaOf(
  request: AiPlanWireRequest,
): Readonly<Record<string, unknown>> | undefined {
  const schema = request.context.outputContract?.schema;
  if (
    schema === undefined ||
    typeof schema !== 'object' ||
    schema === null ||
    Array.isArray(schema)
  ) {
    return undefined;
  }
  return schema;
}

/** The request for one call, and the system blocks its cache shape is read from. */
export interface PlanParams {
  readonly params: Anthropic.MessageCreateParamsNonStreaming;
  readonly system: readonly Anthropic.TextBlockParam[];
}

/**
 * The Messages API request for `request`, decoded into `schema`: the prompt with its
 * breakpoints for the catalog, the skills and the conversation so far (prompt-cache.ts),
 * thinking in the form the model takes (thinking-config.ts), the budget in `effort`.
 */
export function planParams(
  request: AiPlanWireRequest,
  settings: PlanCallSettings,
  schema: Readonly<Record<string, unknown>>,
): PlanParams {
  const { system, messages } = cachedPrompt(buildPrompt(request));
  const effort = API_EFFORT_LEVELS.find((level) => level === settings.effort);
  // Thinking earns its cost here: choosing a parent and slot that the
  // schema actually permits is the difference between a plan and a retry.
  // Callers that already have a decided design may turn it off (`thinkingOff`).
  const thinking: Anthropic.ThinkingConfigParam = settings.thinkingOff
    ? { type: 'disabled' }
    : { type: 'adaptive', display: 'summarized' };
  // Thinking off in the form this model takes: the 5.5 models refuse `disabled` (thinking-config.ts).
  const params = withModelThinking({
    model: settings.model ?? DEFAULT_MODEL,
    max_tokens: settings.maxTokens ?? DEFAULT_MAX_TOKENS,
    thinking,
    system,
    messages,
    output_config: {
      format: { type: 'json_schema' as const, schema },
      /*
        Where the Messages API reads a per-call budget. The header claude.ts
        sends is only ever read by this server's own shims — the real API
        ignores it, so on the `sdk` backend a section writer's `low` used to
        change nothing. A model that does not know the level answers 400
        naming it, which is louder than a budget silently not applied.
      */
      ...(effort === undefined ? {} : { effort }),
    },
  });
  return { params, system };
}
