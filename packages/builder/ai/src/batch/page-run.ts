import type { BuilderKernel } from '@craftkit/builder-core';
import type { ClockPort } from '@craftkit/builder-schema';

import { runAiAgent } from '../agent/run-agent';
import { AiPlanRejectedError } from '../plan/validate-plan';
import { createRemoteAiPlanProvider } from '../provider/remote-provider';
import type { AiPlanWireRequest } from '../provider/wire';
import type { AiPlan, AiPlanProvider } from '../types';
import type { AiBatchAgentOptions, AiBatchPageOutcome } from './types';

/*
  One page of a batch job, asked and answered through `runAiAgent` — the ONE path a live
  request takes (refine-site.ts makes the same choice, for the same reason): a second
  arrangement of context assembly, skills, routing and the door would be a second set of
  rules about what an agent may write, and the day the two disagreed nobody would know.

  ASK: the run goes as far as its first model call and no further. Its provider is the real
  remote provider, so the body the batch carries is byte for byte the body `/plan` would have
  been POSTed for this page — the routed intent, the focused document, the skills, the edit
  model, free code — and its fetch keeps that body and stops the run there.

  ANSWER: the run goes again, its provider answering with the batch's plan. The plan meets the
  live door (expansion, normalisation, validation, salvage) and lands through `applyAiPlan`
  as one transaction: one Undo per page.
*/

/** Never fetched: the capture's fetch answers every call itself. */
const CAPTURE_ENDPOINT = 'https://batch-capture.invalid/plan';

export interface PageRunInput {
  readonly kernel: BuilderKernel;
  readonly request: string;
  readonly agent: AiBatchAgentOptions;
  readonly clock: ClockPort;
  /** Never contains "/": a run id with one is a build step, which is not routed. */
  readonly runId: string;
  readonly signal?: AbortSignal | undefined;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error && cause.message.trim() !== ''
    ? cause.message
    : 'The request could not be prepared for this page.';
}

/** A run id `runAiAgent` accepts and treats as a person's request (no "/", at most 160). */
export function pageRunId(jobId: string, index: number, phase: 'ask' | 'apply'): string {
  return `batch-${jobId.replace(/[^A-Za-z0-9_.:-]/gu, '_')}-${String(index)}-${phase}`.slice(
    0,
    160,
  );
}

/** The wire request a live run on this page would send, or why there is none. */
export async function askPage(
  input: PageRunInput,
): Promise<{ readonly wire: AiPlanWireRequest } | { readonly message: string }> {
  let captured: AiPlanWireRequest | undefined;
  const provider = createRemoteAiPlanProvider({
    endpoint: CAPTURE_ENDPOINT,
    fetch: (_url, init) => {
      if (captured === undefined && typeof init?.body === 'string') {
        captured = JSON.parse(init.body) as AiPlanWireRequest;
      }
      // Stops the run at its first call; the body is all a batch needs of it.
      return Promise.reject(new Error('Kept for the batch.'));
    },
  });
  try {
    await runAiAgent({
      ...input.agent,
      runId: input.runId,
      clock: input.clock,
      kernel: input.kernel,
      provider,
      request: input.request,
      apply: 'never',
      // A batch is for model calls; an edit a page can make without one is a live run's.
      directEdits: false,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
  } catch (cause) {
    input.signal?.throwIfAborted();
    if (captured === undefined) return { message: messageOf(cause) };
  }
  return captured === undefined
    ? { message: 'This request asks no model on this page; run it live instead.' }
    : { wire: captured };
}

/** Lands the batch's plan on this page through the live door, and says what became of it. */
export async function answerPage(
  input: PageRunInput & {
    readonly pageId: string;
    readonly plan: AiPlan;
    readonly label?: string | undefined;
  },
): Promise<AiBatchPageOutcome> {
  const { pageId } = input;
  const provider: AiPlanProvider = { propose: () => Promise.resolve(input.plan) };
  let salvaged: { kept: number; dropped: number } | undefined;
  try {
    const run = await runAiAgent({
      ...input.agent,
      runId: input.runId,
      clock: input.clock,
      kernel: input.kernel,
      provider,
      request: input.request,
      apply: 'auto',
      directEdits: false,
      ...(input.label === undefined ? {} : { label: input.label }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      onEvent: (event) => {
        if (event.type === 'plan.salvaged') {
          salvaged = { kept: event.kept, dropped: event.dropped.length };
        }
      },
    });
    return {
      pageId,
      status: 'applied',
      transactionIds: (run.applied?.transactions ?? []).map((transaction) => transaction.id),
      ...(salvaged === undefined ? {} : { salvaged }),
    };
  } catch (cause) {
    input.signal?.throwIfAborted();
    if (cause instanceof AiPlanRejectedError) {
      return { pageId, status: 'rejected', message: cause.message, issues: cause.issues };
    }
    return { pageId, status: 'error', message: messageOf(cause), retryable: false };
  }
}
