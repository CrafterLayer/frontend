import type Anthropic from '@anthropic-ai/sdk';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import {
  SHARED_CACHE_DOCTOR,
  isDiagnosisRefusal,
  type CacheDoctor,
  type CacheVisit,
} from './cache-doctor';
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
  type PlanParams,
  type UsageReport,
} from './plan-params';
import { PAGE_PLAN_ANSWER_SCHEMA, planShapeCheck } from './plan-shape';
import {
  SITE_PLAN_ANSWER_SCHEMA,
  readSitePlanMessage,
  sitePlanParams,
  type SitePlanOutcome,
} from './site-plan';

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
  /** Why a call did not read the cache (cache-doctor.ts); the server's shared one by default. */
  readonly cacheDoctor?: CacheDoctor;
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
  // A site plan (T230) brings its own short prompt: site-plan.ts `sitePlanParams`.
  build: typeof planParams = planParams,
): Promise<Anthropic.Message> {
  const { params, system } = build(request, options, schema);
  options.onProgress?.('Understanding the request…');
  // Why the cache was not read, when it was not (cache-doctor.ts).
  const doctor = options.cacheDoctor ?? SHARED_CACHE_DOCTOR;
  let visit = doctor.visit({ ...params, system });
  let message: Anthropic.Message;
  try {
    message = await streamOnce(params, system, visit, options);
  } catch (error) {
    if (Object.keys(visit.body).length === 0 || !isDiagnosisRefusal(error)) throw error;
    doctor.disableApiDiagnosis();
    options.onLog?.('cache diagnosis: the API refused the beta; comparing locally from now on');
    visit = doctor.visit({ ...params, system });
    message = await streamOnce(params, system, visit, options);
  }
  options.signal?.throwIfAborted();
  const miss = visit.done(message);
  const usage = usageOf(message);
  if (miss !== undefined) {
    options.onLog?.(
      `cache: read ${String(usage.cacheReadTokens ?? '?')}, wrote ${String(usage.cacheWriteTokens ?? '?')} — ` +
        `${miss.reason} (${miss.source}${miss.missedTokens === null ? '' : `, ~${String(miss.missedTokens)} tokens missed`})`,
    );
  }
  options.onUsage?.(miss === undefined ? usage : { ...usage, cacheMiss: miss });
  options.onProgress?.('Checking the generated result…');
  return message;
}

/** One streamed call, behind the cache gate, with the doctor's fields on the request. */
async function streamOnce(
  params: PlanParams['params'],
  system: PlanParams['system'],
  visit: CacheVisit,
  options: ClaudeOptions,
): Promise<Anthropic.Message> {
  // A same-prefix call already writing the cache: wait until it streams, then read it.
  const shape = cacheShape([params.model, params.thinking, params.output_config, system]);
  const release = await (options.cacheGate ?? SHARED_CACHE_GATE).enter(shape, options.signal);
  if (options.signal?.aborted === true) {
    release(false);
    options.signal.throwIfAborted();
  }
  const headers = {
    ...visit.headers,
    // Kept for the CLI shim, which reads the budget from here and nowhere else.
    ...(options.effort === undefined ? {} : { [CRAFTKIT_REASONING_EFFORT_HEADER]: options.effort }),
  };
  const stream = opened(release, () =>
    options.client.messages.stream(
      { ...params, ...visit.body },
      {
        // The app owns proposal/repair retries; SDK retries must not multiply them.
        maxRetries: 0,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        ...(Object.keys(headers).length === 0 ? {} : { headers }),
      },
    ),
  );
  const releaseOnAbort = (): void => {
    release(false);
  };
  if (options.signal?.aborted === true) releaseOnAbort();
  else options.signal?.addEventListener('abort', releaseOnAbort, { once: true });

  // Real backend activity releases the prefix; a shim's timed narration proves nothing.
  (stream as unknown as { on: (event: 'streamEvent', listener: () => void) => unknown }).on(
    'streamEvent',
    () => {
      if (options.signal?.aborted !== true) release(true);
    },
  );
  // Drain private summaries while emitting only the first observable planning signal.
  let planning = false;
  stream.on('thinking', () => {
    if (planning || options.signal?.aborted === true) return;
    planning = true;
    options.onProgress?.('Planning the layout…');
  });
  // SDK signals identify observable phases. Never forward the contents of `thinking`.
  let writing = false;
  const reportWriting = (): void => {
    if (options.signal?.aborted === true) return;
    release(true);
    if (writing) return;
    writing = true;
    options.onProgress?.('Writing the design…');
  };

  if (options.onDraft !== undefined) {
    const onDraft = options.onDraft;
    const tell = (draft: AnswerDraft): void => {
      if (options.signal?.aborted === true) return;
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
  } else {
    stream.on('text', reportWriting);
  }

  return opened(release, () => stream.finalMessage()).finally(() => {
    options.signal?.removeEventListener('abort', releaseOnAbort);
    release(false);
  });
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

// ── the site-plan task (T230, 2026-10-12) ───────────────────────────────────

/**
 * Ask for a SITE PLAN (`task: 'site-plan'`): the pages a multi-page request asks for, each
 * with its own brief. The same call and narration as a plan, with site-plan.ts's prompt,
 * schema and reader; the client validates the pages.
 */
export async function proposeSitePlan(
  request: AiPlanWireRequest,
  options: ClaudeOptions,
): Promise<SitePlanOutcome> {
  const message = await ask(request, options, SITE_PLAN_ANSWER_SCHEMA, sitePlanParams);
  return readSitePlanMessage(message, options);
}

/** The model call a request's task asks for: a plan, a page plan, or a site plan. */
export function proposerFor(
  wire: AiPlanWireRequest,
): typeof proposePlan | typeof proposePagePlan | typeof proposeSitePlan {
  if (wire.task === 'page-plan') return proposePagePlan;
  return wire.task === 'site-plan' ? proposeSitePlan : proposePlan;
}
