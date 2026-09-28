import type { AiBuildSkipReasonCode, AiRunFailure } from '@craftkit/builder';

import type { ErrorClass, FailureClass } from './view-types';

/**
 * Engine failure → the words the panel may say (SPEC §7.6 E5, §4.8 `reason.*`, §4.14
 * class table).
 *
 * Data first, prose second. Since 2026-09-28 the engine names why a section was skipped
 * as data (`task.skipped.reasonCode`, `AiBuildTaskReport.reasonCode`), and that code is
 * read before anything else. A build recorded before it (a v1 session, a replay) carries
 * only `reason: string`, so this module still reads the engine's OWN messages, the ones it
 * writes itself (`run-build.ts`, `remote-provider.ts`, `validate-plan.ts`). Model prose, a
 * kernel's words, anything it does not recognise, is `unknown`: guessing a class from
 * free text would print a confident reason that may be false. The raw text is never
 * rendered (SPEC §6.5 "No internals on screen"); it goes to the clipboard only.
 *
 * A writer's own `run.failed` carries `AiRunFailure.code` (and an HTTP `status`), which
 * `build-progress.ts` keeps on the task: it refines the one reason code that merges two
 * causes (`unreachable`: not reached, or refused), and stands in when there is no code.
 */

/** The part of `AiRunFailure` a classification reads; a whole `AiRunFailure` fits. */
export type RunFailureEvidence = Pick<AiRunFailure, 'code'> &
  Partial<Pick<AiRunFailure, 'source' | 'retryable'>> & {
    readonly message?: string | undefined;
    readonly status?: number | undefined;
  };

export interface SectionFailureEvidence {
  /** `task.skipped.reason`, or a report's `reason`: read here, never rendered. */
  readonly reason?: string | undefined;
  /** `task.skipped.reasonCode`, or a report's: the engine's own class, read first. */
  readonly reasonCode?: AiBuildSkipReasonCode | undefined;
  /** The writer's own last run failure, from `run.failed`/`run.cancelled` on `<build>/fill-N`. */
  readonly failure?: RunFailureEvidence | undefined;
  /**
   * The writer had drafted its section (`run.completed {proposed}`) before the skip.
   * Past the draft only two things skip a section: the target guard (its own message)
   * and the lander, whose refusal means the page moved under the writer (run-build.ts
   * "Written fine, refused on landing").
   */
  readonly drafted?: boolean | undefined;
}

/** Why a section was never written, from the engine's not-started reasons. */
export type StopCause = 'signal' | 'budget' | 'maxTasks';

/* ── The engine's own sentences ─────────────────────────────────────────────── */

/** run-build.ts `writeSection`: the target guard dropped every step the writer wrote. */
const OUT_OF_SCOPE = /\bwrote nothing inside its own region\b/u;
/** run-build.ts `runFill` (the section deadline) and remote-provider.ts `timeoutError`. */
const TIMED_OUT = /^Section ".*" exceeded its \d+ms budget\.|\btimed out after \d+ms\b/su;
/** remote-provider.ts `abortAware`: fetch itself failed. */
const UNREACHABLE = /^The assistant server could not be reached\b/u;
/** remote-provider.ts `post`: a non-2xx answer, with its status. */
const HTTP_STATUS = /^The assistant server answered with status (\d{3})\./u;
/** remote-provider.ts parse failures, outline-plan.ts, validate-plan.ts issues. */
const INVALID: readonly RegExp[] = [
  /^The assistant server (answer was not valid JSON|streamed invalid JSON|streamed data after its result|streamed more than one result|stream ended without a result|stream had no body)\b/u,
  /^The assistant server answered with (something that is not a plan or a refusal|unsupported wire version)\b/u,
  /^The assistant server response exceeded the maximum response size\b/u,
  /^The assistant returned an empty plan\./u,
  /^(An AI plan|AI plan step \d+) (must|needs)\b/u,
  /^Step \d+ (names unknown command|has invalid arguments for|command "[^"]*" is not allowed|authors utility-classes|writes|names icons|uses utility classes|inserts)\b/u,
  /^The active AI policy allows at most\b/u,
  /\bwas rejected by the kernel door\b/u,
  /^The plan leaves an invalid document\b/u,
];
/** generate-plan.ts `AiContextBudgetError`: the request did not fit the model. */
const TOO_LARGE = /^AI context budget exceeded\b/u;

/** run-build.ts `notStartedReason`, `STOPPED_WHILE_WRITING`, `STOPPED_BEFORE_LANDING`. */
const STOP_CAUSES: readonly (readonly [RegExp, StopCause])[] = [
  [
    /^The build was stopped (before this section started|while this section was being written|before this section landed)\b/u,
    'signal',
  ],
  [/^The build budget ran out before this section started\./u, 'budget'],
  [/^The build reached its task limit before this section started\./u, 'maxTasks'],
];

/**
 * An HTTP status in the panel's words. 429 and 503/529 are a service at its limit, 408
 * and 504 a timeout on the way, the rest of 5xx a server that did not answer. Any 4xx
 * left is the request itself, which the panel has no honest words for.
 */
function classOfStatus(status: number): 'busy' | 'timeout' | 'unreachable' | 'unknown' {
  if (status === 429 || status === 503 || status === 529) return 'busy';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500 && status <= 599) return 'unreachable';
  return 'unknown';
}

/**
 * A failure code in the panel's words, or null when the code says nothing a person can
 * use (`cancelled` is a stop or a deadline; its message decides which).
 */
function classOfCode(failure: RunFailureEvidence): ErrorClass | null {
  switch (failure.code) {
    case 'timeout':
      return 'timeout';
    case 'network':
      return 'unreachable';
    case 'http-status':
      return failure.status === undefined ? null : classOfStatus(failure.status);
    case 'refusal':
      return 'declined';
    case 'invalid-output':
    case 'stream-protocol':
    case 'response-limit':
    case 'plan-rejected':
    case 'proposal-integrity':
      return 'invalid';
    case 'context-budget':
      return 'tooLarge';
    default:
      return null;
  }
}

/** The engine's own sentence in the panel's words, or null when it is not one of them. */
function classOfMessage(message: string): ErrorClass | null {
  if (TIMED_OUT.test(message)) return 'timeout';
  if (UNREACHABLE.test(message)) return 'unreachable';
  const status = HTTP_STATUS.exec(message)?.[1];
  if (status !== undefined) return classOfStatus(Number(status));
  if (INVALID.some((pattern) => pattern.test(message))) return 'invalid';
  if (TOO_LARGE.test(message)) return 'tooLarge';
  return null;
}

/** A whole-run class a section can wear; `tooLarge` and `offline` never describe one section. */
function asSectionClass(errorClass: ErrorClass | null): FailureClass | null {
  switch (errorClass) {
    case 'timeout':
    case 'invalid':
    case 'unreachable':
    case 'busy':
    case 'declined':
      return errorClass;
    case null:
      return null;
    default:
      return 'unknown';
  }
}

/*
  The engine's reason code in the panel's words, or null when the code does not settle it:
  `stopped` and `budget` are not failures (a not-written row shows no reason), and
  `unknown` is the engine saying it does not know either, so the evidence below decides.
*/
function classOfReasonCode(
  code: AiBuildSkipReasonCode | undefined,
  failure: RunFailureEvidence | undefined,
): FailureClass | null {
  switch (code) {
    case 'timeout':
      return 'timeout';
    case 'invalid':
      return 'invalid';
    case 'out-of-scope':
      return 'outOfScope';
    case 'page-changed':
      return 'pageChanged';
    case 'unreachable': {
      // "Could not be reached or refused": the writer's own failure says which, and a 429
      // is a busy service, not a missing one. Nothing else may overrule the code.
      const refined = failure === undefined ? null : classOfCode(failure);
      return refined === 'busy' || refined === 'declined' || refined === 'timeout'
        ? refined
        : 'unreachable';
    }
    case 'stopped':
    case 'budget':
    case 'unknown':
    case undefined:
      return null;
  }
}

/**
 * Why one section failed (SPEC §4.8 `reason.*`). Precedence, most specific first: the
 * engine's reason code; out of scope (its own message); refused on landing (drafted, then
 * skipped); a timeout (the deadline aborts the writer, so its code is only `cancelled`);
 * the writer's failure code; then the engine's message. Everything else is `unknown`.
 */
export function classifySectionFailure(evidence: SectionFailureEvidence): FailureClass {
  const byCode = classOfReasonCode(evidence.reasonCode, evidence.failure);
  if (byCode !== null) return byCode;
  const reason = evidence.reason ?? '';
  if (OUT_OF_SCOPE.test(reason)) return 'outOfScope';
  if (evidence.drafted === true) return 'pageChanged';
  if (TIMED_OUT.test(reason)) return 'timeout';
  const failure = evidence.failure;
  return (
    (failure === undefined ? null : asSectionClass(classOfCode(failure))) ??
    asSectionClass(classOfMessage(reason)) ??
    'unknown'
  );
}

/**
 * Why a section was never written, when its reason code or its message says it was a
 * stop; null for a failure. A not-written row shows no reason (SPEC §4.8), so this only
 * tells a stop from a failure when the report is all there is. The code `budget` covers
 * both the time budget and the task limit, so its message tells those two apart.
 */
export function stopCauseOf(
  reason: string | undefined,
  reasonCode?: AiBuildSkipReasonCode,
): StopCause | null {
  const byMessage =
    reason === undefined
      ? null
      : (STOP_CAUSES.find(([pattern]) => pattern.test(reason))?.[1] ?? null);
  if (reasonCode === 'stopped') return 'signal';
  if (reasonCode === 'budget') return byMessage === 'maxTasks' ? 'maxTasks' : 'budget';
  return byMessage;
}

/**
 * Why a whole run failed (SPEC §4.14). `offline` is the caller's `navigator.onLine`
 * reading at the time: only a request that never left is "You're offline"; a refusal
 * while offline is still a refusal.
 */
export function classifyRunFailure(
  failure: RunFailureEvidence | undefined,
  options: { readonly offline?: boolean | undefined } = {},
): ErrorClass {
  if (failure === undefined) return 'unknown';
  const byCode = classOfCode(failure);
  if (options.offline === true && (failure.code === 'network' || byCode === 'unreachable')) {
    return 'offline';
  }
  return byCode ?? classOfMessage(failure.message ?? '') ?? 'unknown';
}

/** SPEC §4.14's Retry column: every class offers Try again except a decline. */
export function isRetryableErrorClass(errorClass: ErrorClass): boolean {
  return errorClass !== 'declined';
}

/**
 * A build in which every section failed is shown as one ErrorRecord (SPEC §4.8 phase
 * `failed`): named by the most common section class, the first in page order on a tie.
 * `outOfScope`, `pageChanged` and `unknown` have no whole-run words, so they read as
 * `unknown`.
 */
export function errorClassOfSections(failures: readonly FailureClass[]): ErrorClass {
  const counts = new Map<FailureClass, number>();
  let best: FailureClass | null = null;
  for (const failure of failures) {
    const count = (counts.get(failure) ?? 0) + 1;
    counts.set(failure, count);
    if (best === null || count > (counts.get(best) ?? 0)) best = failure;
  }
  switch (best) {
    case 'timeout':
    case 'invalid':
    case 'unreachable':
    case 'busy':
    case 'declined':
      return best;
    default:
      return 'unknown';
  }
}
