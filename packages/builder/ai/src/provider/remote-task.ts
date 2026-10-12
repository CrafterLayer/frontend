/*
  The optional tasks a plan server may predate, and the error that says so (moved out of
  remote-provider.ts on 2026-10-12, T230, when the site plan became the third such task
  and its client got a module of its own: remote-site-plan.ts).
*/
import { AiProviderError } from './errors';

/** The optional tasks a server may predate: the page plan (T1), the enhancer, the site plan. */
export type AiRemoteTask = 'page-plan' | 'prompt-enhance' | 'site-plan';

/**
 * The server does not do this task: it answered a page-plan (or enhance)
 * request with an ORDINARY plan, the mark of a server written before the
 * task existed (wire.ts reads it as `'unsupported'`).
 *
 * Typed so a caller can tell "this server is older" from "this answer was
 * broken": the build treats it as it treats a provider with no
 * `proposePagePlan` — it reports the step failed and builds from the scaffold
 * — and `enhanceRequest` falls back to its tidy. Never retryable: the same
 * server gives the same answer. The provider REMEMBERS it (see
 * `createRemoteAiPlanProvider`), because such a server ignores the unknown
 * `task` and runs a whole plan generation to produce the wrong answer —
 * minutes and 15–25k output tokens per build (measured plan size, prompt
 * notes in planProviderFromEnv.ts).
 *
 * Its code is `'invalid-output'` because `AiProviderErrorCode` (errors.ts,
 * not this module's) has no `'unsupported'` yet; the class and `task` are the
 * stable signal until it does.
 */
export class AiTaskUnsupportedError extends AiProviderError {
  override readonly name: string = 'AiTaskUnsupportedError';
  readonly task: AiRemoteTask;

  constructor(task: AiRemoteTask, message: string) {
    super(message, { code: 'invalid-output', retryable: false });
    this.task = task;
  }
}

/** Whether `value` says the server does not do `task` (any task when omitted). */
export function isAiTaskUnsupportedError(
  value: unknown,
  task?: AiRemoteTask,
): value is AiTaskUnsupportedError {
  return value instanceof AiTaskUnsupportedError && (task === undefined || value.task === task);
}
