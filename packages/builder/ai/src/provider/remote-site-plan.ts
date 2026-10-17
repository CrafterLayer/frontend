/*
  The remote provider's `proposeSitePlan` (T230, 2026-10-12): the same POST, transport
  and deadline as a plan (`createRemoteAiPlanProvider` hands its `post` in), with
  `task: 'site-plan'` and the empty context a site plan needs. Its own module because
  remote-provider.ts is at its size limit.
*/
import type { AiPlanProvider, AiProposeSitePlanOptions, AiSitePlanProposal } from '../types';
import { RemoteAiProviderError } from './remote-errors';
import { AiTaskUnsupportedError, type AiRemoteTask } from './remote-task';
import { aiSitePlanWireRequest, readAiSitePlanWireResponse } from './site-plan-wire';
import type { AiPlanWireRequest } from './wire';

/** One plan-endpoint POST: the body, how its answer is read, and the call's live options. */
export type RemoteSitePlanPost = <T>(
  body: AiPlanWireRequest,
  read: (payload: unknown) => T,
  live: AiProposeSitePlanOptions | undefined,
) => Promise<T>;

/** What the provider knows about tasks its server predates (`AiTaskUnsupportedError`). */
export interface RemoteTaskMemory {
  readonly refuseKnownUnsupported: (task: AiRemoteTask) => void;
  readonly remember: (error: AiTaskUnsupportedError) => void;
}

/** A site-plan answer: the pages (validated by the caller), or a typed failure. */
function parseSitePlanResponse(
  payload: unknown,
  onUnsupported: (error: AiTaskUnsupportedError) => void,
): AiSitePlanProposal {
  const reading = readAiSitePlanWireResponse(payload);
  switch (reading.kind) {
    case 'site-plan':
      return reading.proposal;
    case 'refusal':
      throw new RemoteAiProviderError(reading.message, { code: 'refusal', retryable: false });
    case 'invalid-output':
      throw new RemoteAiProviderError(reading.message, {
        code: 'invalid-output',
        retryable: true,
      });
    case 'unsupported': {
      const error = new AiTaskUnsupportedError('site-plan', reading.message);
      onUnsupported(error);
      throw error;
    }
  }
}

function throwIfStopped(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;
  const reason: unknown = signal.reason;
  if (reason instanceof Error && reason.name === 'AbortError') throw reason;
  throw new DOMException('The operation was aborted.', 'AbortError');
}

/** `proposeSitePlan` over `post`, refused at once on a server known to predate the task. */
export function remoteSitePlan(
  post: RemoteSitePlanPost,
  memory: RemoteTaskMemory,
): Required<Pick<AiPlanProvider, 'proposeSitePlan'>> {
  return {
    async proposeSitePlan(request, live) {
      throwIfStopped(live?.signal);
      memory.refuseKnownUnsupported('site-plan');
      return post(
        aiSitePlanWireRequest(request, live?.history),
        (payload) => parseSitePlanResponse(payload, memory.remember),
        live,
      );
    },
  };
}
