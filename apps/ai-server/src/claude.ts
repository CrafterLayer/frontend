import type Anthropic from '@anthropic-ai/sdk';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { SHARED_CACHE_GATE, cacheShape, opened, type CacheGate } from './cache-gate';
import { salvageJson } from './json-salvage';
import { CRAFTKIT_REASONING_EFFORT_HEADER } from './openrouter-client';
import {
  PAGE_PLAN_ANSWER_SCHEMA,
  pagePlanShapeCheck,
  planShapeCheck,
  repairPagePlanAnswer,
} from './plan-shape';
import { buildPrompt } from './prompt';
import { cachedPrompt } from './prompt-cache';
import { withModelThinking } from './thinking-config';

/**
 * The Claude call, and the translation of its failures into the wire contract.
 *
 * The wire has exactly three answers — a plan, a refusal, or a versioned
 * invalid-output report — so every way this can fail has to become one of them
 * or an HTTP status. Collapsing them into "500" would be easier and would cost
 * the client its entire error taxonomy: `remote-provider` distinguishes
 * retryable from terminal, and a UI shows a refusal differently from an outage.
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

export interface ClaudeOptions {
  readonly client: Anthropic;
  readonly model?: string;
  readonly maxTokens?: number;
  /** Forwarded to the SDK so a client disconnect actually stops the work. */
  readonly signal?: AbortSignal;
  /**
   * The reasoning budget for THIS call, when it differs from the backend's
   * default — a section writer works under a direction already decided and
   * needs far less of it than the skeleton that decided it.
   */
  readonly effort?: string;
  /**
   * True turns thinking off for THIS call (`thinking: {type: 'disabled'}`,
   * which the CLI shim maps to its no-thinking settings). For calls whose
   * design is already decided — a section writer, a small low-budget edit —
   * where thinking was over 85% of the output (measured 2026-09-30).
   */
  readonly thinkingOff?: boolean;
  /** Public lifecycle status only; never model reasoning text. */
  readonly onProgress?: (text: string) => void;
  readonly onUsage?: (usage: UsageReport) => void;
  /** Receives the raw answer text before it is parsed — what the model actually said. */
  readonly onAnswer?: (text: string) => void;
  /**
   * Receives the answer's raw text WHILE it is written (DESIGN §5.1): each
   * text delta as `{text}`, and `{reset: true}` when a backend starts the
   * answer over (the routing client's fallback), so earlier text is void.
   * Advisory only — the parsed, repaired answer stays the authority.
   */
  readonly onDraft?: (draft: AnswerDraft) => void;
  /** One line per thing this server did to an answer, for the owner's terminal. */
  readonly onLog?: (line: string) => void;
  /** Staggers same-prefix calls so they read one cache write (cache-gate.ts); the server's own by default. */
  readonly cacheGate?: CacheGate;
}

/** One piece of an answer being written, or the word that it started over. */
export type AnswerDraft = { readonly text: string } | { readonly reset: true };

export type ClaudeOutcome =
  | { readonly kind: 'plan'; readonly plan: unknown; readonly usage: UsageReport }
  | { readonly kind: 'refusal'; readonly message: string }
  | { readonly kind: 'invalid-output'; readonly message: string };

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

function usageOf(message: Anthropic.Message): UsageReport {
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

/**
 * Ask Claude for a plan.
 *
 * The output schema is NOT written here. It travels on the wire as
 * `context.outputContract.schema`, authored by the same package that validates
 * the answer — so the shape the model is constrained to and the shape the door
 * accepts cannot drift apart. A schema restated in this file would be a second
 * source of truth about the plan format, and the first divergence would look
 * like a model failure.
 */
export async function proposePlan(
  request: AiPlanWireRequest,
  options: ClaudeOptions,
): Promise<ClaudeOutcome> {
  const contract = request.context.outputContract;
  /*
    `JsonValue` admits `null` and primitives, so the presence of the field is
    not proof of a schema. Checked rather than asserted: an unusable contract
    forwarded to the API returns a 400 whose message blames the request, and
    the deployment mistake would be read as a model failure.
  */
  const schema = contract?.schema;
  if (
    schema === undefined ||
    typeof schema !== 'object' ||
    schema === null ||
    Array.isArray(schema)
  ) {
    return {
      kind: 'invalid-output',
      message: 'The request carried no usable output contract, so no plan shape could be enforced.',
    };
  }

  const message = await ask(request, options, schema);

  /*
    A safety decline is a REFUSAL, not an error: the wire has a shape for it,
    the UI shows it as a sentence rather than an outage, and the client marks
    it terminal so nothing retries a decision that will not change.
  */
  if (message.stop_reason === 'refusal') {
    return {
      kind: 'refusal',
      message: message.stop_details?.explanation ?? 'The assistant declined this request.',
    };
  }

  if (message.stop_reason === 'max_tokens') {
    return {
      kind: 'invalid-output',
      message:
        'The plan was cut off before it finished. Ask for a smaller change, or split the request in two.',
    };
  }

  const raw = answerText(message);
  /*
    Before parsing, so the host can show what came back even when the answer
    is refused two layers later: "names unknown command "e"" is all the panel
    can say, and a bad model and a bad prompt look the same without this.
  */
  options.onAnswer?.(raw);

  if (raw.trim() === '') {
    return { kind: 'invalid-output', message: 'The assistant returned no plan.' };
  }

  /*
    Structured outputs constrain generation, but this server does not get to
    ASSUME they held: the answer crosses a network into a validator, and a
    parse failure here is a clearer report than a schema violation there.
    First the wrappers every backend sometimes adds — a fence, a sentence, a
    trailing comma — are undone; the plan's content is still judged as it is.
  */
  const text = salvageJson(raw, planShapeCheck(request));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'invalid-output', message: 'The assistant answer was not valid JSON.' };
  }

  /*
    prompt.ts asks for "a plan whose single command is impossible" when a
    request cannot be expressed. No command by that name exists — the wire's
    refusal shape is what it means — so it is translated here, where the
    rationale becomes the sentence the panel shows instead of a validator's
    `names unknown command "impossible"`.
  */
  const declined = impossibleRationale(parsed);
  if (declined !== undefined) return { kind: 'refusal', message: declined };

  return { kind: 'plan', plan: parsed, usage: usageOf(message) };
}

/** The text of an answer, with thinking and every other block left out. */
function answerText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/**
 * The one model call both tasks make: the prompt for the request, decoded into
 * `schema`, with observed public lifecycle phases. Every backend — the Messages
 * API, the CLI shim, OpenRouter — is reached through this same
 * `messages.stream` seam, which is why a task added here needs nothing from
 * any of them.
 */
async function ask(
  request: AiPlanWireRequest,
  options: ClaudeOptions,
  schema: Readonly<Record<string, unknown>>,
): Promise<Anthropic.Message> {
  // Breakpoints for the catalog, the skills and the conversation so far (prompt-cache.ts).
  const { system, messages } = cachedPrompt(buildPrompt(request));
  const effort = API_EFFORT_LEVELS.find((level) => level === options.effort);
  const model = options.model ?? DEFAULT_MODEL;
  // Thinking earns its cost here: choosing a parent and slot that the
  // schema actually permits is the difference between a plan and a retry.
  // Callers that already have a decided design may turn it off (`thinkingOff`).
  const thinking: Anthropic.ThinkingConfigParam = options.thinkingOff
    ? { type: 'disabled' }
    : { type: 'adaptive', display: 'summarized' };

  options.onProgress?.('Understanding the request…');
  // Thinking off in the form this model takes: the 5.5 models refuse `disabled` (thinking-config.ts).
  const params = withModelThinking({
    model,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    thinking,
    system,
    messages,
    output_config: {
      format: { type: 'json_schema' as const, schema },
      /*
        Where the Messages API reads a per-call budget. The header below is
        only ever read by this server's own shims — the real API ignores it,
        so on the `sdk` backend a section writer's `low` used to change
        nothing. A model that does not know the level answers 400 naming it,
        which is louder than a budget silently not applied.
      */
      ...(effort === undefined ? {} : { effort }),
    },
  });
  // A same-prefix call already writing the cache: wait until it streams, then read it.
  const shape = cacheShape([params.model, params.thinking, params.output_config, system]);
  const release = await (options.cacheGate ?? SHARED_CACHE_GATE).enter(shape, options.signal);
  const stream = opened(release, () =>
    options.client.messages.stream(params, {
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      // Kept for the CLI shim, which reads the budget from here and nowhere else.
      ...(options.effort === undefined
        ? {}
        : { headers: { [CRAFTKIT_REASONING_EFFORT_HEADER]: options.effort } }),
    }),
  );

  // The first streamed event means the prefix is cached: same-shape calls may go. The SDK's
  // `streamEvent` (message_start) comes first; the shims keep one listener per event, so
  // `thinking` releases inside the planning listener below.
  (stream as unknown as { on: (event: 'streamEvent', listener: () => void) => unknown }).on(
    'streamEvent',
    () => {
      release(true);
    },
  );
  // Drain private summaries while emitting only the first observable planning signal.
  let planning = false;
  stream.on('thinking', () => {
    release(true);
    if (planning) return;
    planning = true;
    options.onProgress?.('Planning the layout…');
  });
  // SDK signals identify observable phases. Never forward the contents of `thinking`.
  let writing = false;
  const reportWriting = (): void => {
    if (writing) return;
    writing = true;
    options.onProgress?.('Writing the design…');
  };

  if (options.onDraft !== undefined) {
    const onDraft = options.onDraft;
    /** An observer's failure never becomes the answer's. */
    const tell = (draft: AnswerDraft): void => {
      try {
        onDraft(draft);
      } catch {
        // Drafts are advisory; the result frame still carries the answer.
      }
    };
    // The SDK passes (delta, snapshot); the delta is the draft.
    stream.on('text', (delta: string) => {
      reportWriting();
      tell({ text: delta });
    });
    // Not an SDK event: the routing client's own, when it hands the call to its fallback.
    (stream as unknown as { on: (event: 'restart', listener: () => void) => unknown }).on(
      'restart',
      () => {
        tell({ reset: true });
      },
    );
  } else if (options.onProgress !== undefined) {
    stream.on('text', reportWriting);
  }

  const message = await opened(release, () => stream.finalMessage()).finally(() => {
    release(false);
  });
  options.onUsage?.(usageOf(message));
  options.onProgress?.('Checking the generated result…');
  return message;
}

/** The rationale of an `impossible` plan, or undefined when the plan is a real one. */
function impossibleRationale(plan: unknown): string | undefined {
  if (typeof plan !== 'object' || plan === null || Array.isArray(plan)) return undefined;
  const record = plan as Record<string, unknown>;
  const commands = record['commands'];
  if (!Array.isArray(commands) || commands.length !== 1) return undefined;
  const only: unknown = commands[0];
  if (typeof only !== 'object' || only === null) return undefined;
  if ((only as Record<string, unknown>)['command'] !== 'impossible') return undefined;
  const rationale = record['rationale'];
  return typeof rationale === 'string' && rationale.trim() !== ''
    ? rationale.trim()
    : 'The assistant could not express this request as a change to the page.';
}

// ── the page-plan task (2026-09-28) ─────────────────────────────────────────

export type PagePlanOutcome =
  | {
      readonly kind: 'page-plan';
      /** Untrusted and unvalidated: the client's `validatePagePlan` is the only judge. */
      readonly pagePlan: Readonly<Record<string, unknown>>;
      readonly rationale?: string;
      readonly usage: UsageReport;
    }
  | { readonly kind: 'refusal'; readonly message: string }
  | { readonly kind: 'invalid-output'; readonly message: string };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A page plan written without its `{rationale, pagePlan}` wrapper: the plan's
 * own keys at the top. Taken as the plan rather than refused — a repair round
 * is a whole second model call, and the client validates the plan either way.
 */
function barePagePlan(value: Readonly<Record<string, unknown>>): boolean {
  return (
    !Object.hasOwn(value, 'commands') &&
    (isRecord(value['tokens']) || Array.isArray(value['sections']))
  );
}

/** What a parsed page-plan answer is: the plan, the model's refusal, or neither. */
function readPagePlanAnswer(parsed: unknown, usage: UsageReport): PagePlanOutcome {
  if (!isRecord(parsed)) {
    return {
      kind: 'invalid-output',
      message: 'The assistant answered with something that is not a page plan.',
    };
  }
  const refusal = parsed['refusal'];
  if (parsed['pagePlan'] === undefined && typeof refusal === 'string' && refusal.trim() !== '') {
    return { kind: 'refusal', message: refusal.trim() };
  }
  const rawRationale = parsed['rationale'];
  const rationale =
    typeof rawRationale === 'string' && rawRationale.trim() !== ''
      ? rawRationale.trim()
      : undefined;
  const wrapped = parsed['pagePlan'];
  let pagePlan: Readonly<Record<string, unknown>> | undefined;
  if (isRecord(wrapped)) {
    pagePlan = wrapped;
  } else if (wrapped === undefined && barePagePlan(parsed)) {
    // The bare plan's own rationale moves up to where the wire carries it.
    pagePlan = Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== 'rationale'));
  }
  if (pagePlan === undefined) {
    return {
      kind: 'invalid-output',
      message:
        'The assistant answered without a page plan: it wrote no "pagePlan" object (an ordinary plan of commands is the answer to a different task).',
    };
  }
  return { kind: 'page-plan', pagePlan, ...(rationale === undefined ? {} : { rationale }), usage };
}

/**
 * Ask for a PAGE PLAN (`task: 'page-plan'`): the structured design of a whole
 * page, step T1 of a build. The same call as a plan — same backends, same
 * narration, same judged salvage — decoded into `PAGE_PLAN_ANSWER_SCHEMA`
 * instead of the context's `outputContract`, which is the commands plan's
 * (the client assembles one context for both tasks). The server does not
 * validate the plan: `validatePagePlan` on the client does, and its issues
 * come back as `pagePlanAttempt` for the one repair round.
 *
 * Effort is the caller's; the handler gives a planning call the backend
 * default, never the section writers' budget.
 */
export async function proposePagePlan(
  request: AiPlanWireRequest,
  options: ClaudeOptions,
): Promise<PagePlanOutcome> {
  const message = await ask(request, options, PAGE_PLAN_ANSWER_SCHEMA);

  if (message.stop_reason === 'refusal') {
    return {
      kind: 'refusal',
      message: message.stop_details?.explanation ?? 'The assistant declined this request.',
    };
  }
  if (message.stop_reason === 'max_tokens') {
    return {
      kind: 'invalid-output',
      message:
        'The page plan was cut off before it finished. Ask again, or for a page with fewer sections.',
    };
  }

  const raw = answerText(message);
  options.onAnswer?.(raw);
  if (raw.trim() === '') {
    return { kind: 'invalid-output', message: 'The assistant returned no page plan.' };
  }

  /*
    The judge asks about each candidate AFTER the code repairs below, so a
    placeholder phone the next step fills never makes the right rebalance of
    a dropped closer lose to a wrong one that parses.
  */
  const text = salvageJson(raw, (candidate) =>
    pagePlanShapeCheck(repairPagePlanAnswer(candidate).value),
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      kind: 'invalid-output',
      message: 'The assistant answer was not valid JSON, so no page plan could be read from it.',
    };
  }
  /*
    What code can fix without a model round (plan-shape.ts): shade names to
    the hex they mean, placeholder samples filled in their own format. Each
    one was a refused plan and a ~60-120 s repair round when measured live on
    2026-09-28; here it costs nothing, and the log says what changed.
  */
  const repaired = repairPagePlanAnswer(parsed);
  if (repaired.repairs.length > 0) {
    options.onLog?.(`page plan repaired in code: ${repaired.repairs.join('; ')}`);
  }
  return readPagePlanAnswer(repaired.value, usageOf(message));
}
