/*
  The remote provider's `reviewScene` (visual self-review, 2026-10-13): the pictures of a rendered
  scene section, its contract and the brief, POSTed to `/v1/scene/review` on the plan endpoint's
  origin with the same transport, auth, size cap and cancellation as every other call
  (`createRemoteAiPlanProvider` hands its `post` in), under a short deadline of its own. Its own
  module because remote-provider.ts is at its size limit.
*/
import type { AiPlanProvider } from '../types';
import { AiProviderError } from './errors';
import { RemoteAiProviderError } from './remote-errors';
import type { RemoteTaskMemory } from './remote-site-plan';
import { AiTaskUnsupportedError } from './remote-task';
import {
  AI_SCENE_REVIEW_MAX_IMAGE_CHARS,
  AI_SCENE_REVIEW_PATH,
  aiSceneReviewWireRequest,
  readAiSceneReviewWireResponse,
  type AiReviewSceneOptions,
  type AiSceneReview,
} from './scene-review-wire';

/** One POST through the provider's transport: where, what, how long, and how it is read. */
export type RemoteSceneReviewPost = <T>(
  exchange: {
    readonly url: string;
    readonly body: unknown;
    readonly accept: string;
    readonly timeoutMs: number;
    readonly read: (payload: unknown) => T;
  },
  live: AiReviewSceneOptions | undefined,
) => Promise<T>;

/** A review is a short call a section waits on: never longer than this, whatever the plan's deadline. */
export const SCENE_REVIEW_TIMEOUT_MS = 45_000;

function throwIfStopped(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;
  const reason: unknown = signal.reason;
  if (reason instanceof Error && reason.name === 'AbortError') throw reason;
  throw new DOMException('The operation was aborted.', 'AbortError');
}

/** A review answer: the verdict, or a typed failure (none of them worth a retry but a refusal's). */
function parseSceneReviewResponse(payload: unknown): AiSceneReview {
  const reading = readAiSceneReviewWireResponse(payload);
  switch (reading.kind) {
    case 'review':
      return reading.review;
    case 'refusal':
      throw new RemoteAiProviderError(reading.message, { code: 'refusal', retryable: false });
    case 'invalid-output':
      throw new RemoteAiProviderError(reading.message, {
        code: 'invalid-output',
        retryable: false,
      });
    case 'unsupported':
      // This server's model cannot see; another model (the person's next pick) may.
      throw new AiTaskUnsupportedError('scene-review', reading.message);
  }
}

/** A server that predates the endpoint answers 404 (or 405): it never will, so it is remembered. */
function predates(cause: unknown): boolean {
  return (
    cause instanceof AiProviderError &&
    cause.code === 'http-status' &&
    (cause.status === 404 || cause.status === 405)
  );
}

/** `reviewScene` over `post`, refused at once on a server known to predate the endpoint. */
export function remoteSceneReview(
  post: RemoteSceneReviewPost,
  options: { readonly endpoint: string; readonly timeoutMs?: number | undefined },
  memory: RemoteTaskMemory,
): Required<Pick<AiPlanProvider, 'reviewScene'>> {
  // Same origin as the plan endpoint, so the provider's endpoint policy already covers it.
  const url = new URL(AI_SCENE_REVIEW_PATH, options.endpoint).toString();
  const timeoutMs = Math.min(options.timeoutMs ?? SCENE_REVIEW_TIMEOUT_MS, SCENE_REVIEW_TIMEOUT_MS);
  return {
    async reviewScene(request, live) {
      throwIfStopped(live?.signal);
      memory.refuseKnownUnsupported('scene-review');
      if (request.image.base64.length > AI_SCENE_REVIEW_MAX_IMAGE_CHARS) {
        throw new RemoteAiProviderError('The scene picture is too large to review.', {
          code: 'resource-limit',
          retryable: false,
        });
      }
      try {
        return await post(
          {
            url,
            body: aiSceneReviewWireRequest(request),
            accept: 'application/json',
            timeoutMs,
            read: parseSceneReviewResponse,
          },
          live,
        );
      } catch (cause) {
        if (!predates(cause)) throw cause;
        const error = new AiTaskUnsupportedError(
          'scene-review',
          'The assistant server does not review scenes yet.',
        );
        memory.remember(error);
        throw error;
      }
    },
  };
}
