import type Anthropic from '@anthropic-ai/sdk';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { SHARED_CACHE_GATE, cacheShape, opened, type CacheGate } from './cache-gate';
import { CRAFTKIT_REASONING_EFFORT_HEADER } from './openrouter-client';
import {
  readPagePlanMessage,
  readPlanMessage,
  type ClaudeOutcome,
  type PagePlanOutcome,
} from './plan-answer';
import {
  NO_CONTRACT_MESSAGE,
  contractSchemaOf,
  planParams,
  usageOf,
  type UsageReport,
} from './plan-params';
import { PAGE_PLAN_ANSWER_SCHEMA, planShapeCheck } from './plan-shape';

/**
 * The Claude call, and the translation of its failures into the wire contract.
 *
 * The wire has exactly three answers — a plan, a refusal, or a versioned
 * invalid-output report — so every way this can fail has to become one of them
 * or an HTTP status. Collapsing them into "500" would be easier and would cost
 * the client its entire error taxonomy: `remote-provider` distinguishes
 * retryable from terminal, and a UI shows a refusal differently from an outage.
 */

// Moved to plan-params.ts / plan-answer.ts (2026-10-12), so a batch item is built and read the same way.
export { DEFAULT_MODEL, type UsageReport } from './plan-params';
export type { ClaudeOutcome, PagePlanOutcome } from './plan-answer';

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
  const schema = contractSchemaOf(request);
  if (schema === undefined) return { kind: 'invalid-output', message: NO_CONTRACT_MESSAGE };
  const message = await ask(request, options, schema);
  // The answer is read as a batch item's is (plan-answer.ts), judged by the request's shape.
  return readPlanMessage(message, planShapeCheck(request), options);
}

/**
 * The one model call both tasks make: the prompt for the request, decoded into
 * `schema`, with observed public lifecycle phases. Every backend — the Messages
 * API, the CLI shim, OpenRouter — is reached through this same
 * `messages.stream` seam, which is why a task added here needs nothing from
 * any of them. The request itself is built by plan-params.ts, as a batch item's is.
 */
async function ask(
  request: AiPlanWireRequest,
  options: ClaudeOptions,
  schema: Readonly<Record<string, unknown>>,
): Promise<Anthropic.Message> {
  const { params, system } = planParams(request, options, schema);
  options.onProgress?.('Understanding the request…');
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

// ── the page-plan task (2026-09-28) ─────────────────────────────────────────

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
  return readPagePlanMessage(message, options);
}
