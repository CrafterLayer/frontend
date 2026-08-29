import type {
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AiProposeOptions,
  AssembledAiContext,
} from '../types';
import { AI_PLAN_WIRE_VERSION, type AiPlanWireRequest } from './wire';

export interface RemoteAiPlanProviderOptions {
  /** Absolute URL of the plan endpoint. One POST per proposal. */
  endpoint: string;
  /** Extra headers, e.g. authorization. Content type is always set by the provider. */
  headers?: Readonly<Record<string, string>>;
  /** Injected for tests and non-browser hosts; defaults to the ambient fetch. */
  fetch?: typeof fetch;
  /** Whole-request deadline. The request is aborted when it elapses. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The message a human sees in the refusal bubble. Server refusals pass through
 * verbatim; transport failures get one plain sentence each. A caller's own
 * cancellation is NOT one of these — it rethrows as the platform AbortError.
 */
export class RemoteAiProviderError extends Error {
  override readonly name = 'RemoteAiProviderError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Shallow shape check only: enough to tell "a plan" from "garbage" so the
 * error names the server instead of confusing the kernel-door validator. The
 * real per-command validation still happens in `assertValidAiPlan`.
 */
function parseWireResponse(payload: unknown): AiPlan {
  if (isRecord(payload) && typeof payload['refusal'] === 'string') {
    throw new RemoteAiProviderError(payload['refusal']);
  }
  if (
    isRecord(payload) &&
    typeof payload['rationale'] === 'string' &&
    Array.isArray(payload['commands'])
  ) {
    return { rationale: payload['rationale'], commands: payload['commands'] as AiPlan['commands'] };
  }
  throw new RemoteAiProviderError(
    'The assistant server answered with something that is not a plan or a refusal.',
  );
}

/** One `event:`/`data:` pair from an SSE frame; comment and id lines are ignored. */
function parseSseFrame(frame: string): { event: string; data: string } {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart());
    }
  }
  return { event, data: data.join('\n') };
}

/**
 * Streaming answers: `status` frames narrate, exactly one `result` frame ends
 * the story with the same JSON shape the plain path uses.
 */
async function readSseResponse(
  response: Response,
  onProgress: ((text: string) => void) | undefined,
): Promise<unknown> {
  if (response.body === null) {
    throw new RemoteAiProviderError('The assistant server stream had no body.');
  }
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  const missing = Symbol('no result yet');
  let buffer = '';
  let result: unknown = missing;

  const handleFrame = (frame: string) => {
    const { event, data } = parseSseFrame(frame);
    if (data === '') {
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new RemoteAiProviderError('The assistant server streamed invalid JSON.');
    }
    if (event === 'status') {
      if (isRecord(payload) && typeof payload['text'] === 'string') {
        onProgress?.(payload['text']);
      }
    } else if (event === 'result') {
      result = payload;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      handleFrame(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
    }
  }
  if (result === missing) {
    throw new RemoteAiProviderError('The assistant server stream ended without a result.');
  }
  return result;
}

/**
 * `AiPlanProvider` backed by one HTTP endpoint speaking the wire contract in
 * `wire.ts`. The provider proposes; it never applies. Everything it returns
 * still has to survive the live registry and the scratch-kernel dry run.
 *
 * Both answer styles are accepted from the same POST: a plain JSON body, or —
 * when the server honours the advertised `text/event-stream` — an SSE stream
 * whose `status` frames feed `onProgress` and whose `result` frame carries the
 * final wire response.
 */
export function createRemoteAiPlanProvider(options: RemoteAiPlanProviderOptions) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetch ?? fetch;

  async function post(body: AiPlanWireRequest, live?: AiProposeOptions): Promise<AiPlan> {
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    const cancel = () => {
      controller.abort(live?.signal?.reason);
    };
    live?.signal?.addEventListener('abort', cancel, { once: true });

    try {
      let response: Response;
      try {
        response = await fetchImpl(options.endpoint, {
          method: 'POST',
          headers: {
            ...options.headers,
            accept: 'text/event-stream, application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (cause) {
        throw abortAware(cause, live);
      }

      if (!response.ok) {
        throw new RemoteAiProviderError(
          `The assistant server answered with status ${String(response.status)}.`,
        );
      }

      let payload: unknown;
      try {
        if ((response.headers.get('content-type') ?? '').startsWith('text/event-stream')) {
          payload = await readSseResponse(response, live?.onProgress);
        } else {
          payload = await response.json().catch(() => {
            throw new RemoteAiProviderError('The assistant server answer was not valid JSON.');
          });
        }
      } catch (cause) {
        throw abortAware(cause, live);
      }
      return parseWireResponse(payload);
    } finally {
      clearTimeout(deadline);
      live?.signal?.removeEventListener('abort', cancel);
    }
  }

  /** The caller's own cancellation stays an AbortError; everything else becomes ours. */
  function abortAware(cause: unknown, live: AiProposeOptions | undefined): Error {
    if (live?.signal?.aborted) {
      return cause instanceof Error ? cause : new DOMException('Aborted', 'AbortError');
    }
    if (cause instanceof RemoteAiProviderError) {
      return cause;
    }
    if (cause instanceof Error && cause.name === 'AbortError') {
      return new RemoteAiProviderError(
        `The assistant server timed out after ${String(timeoutMs)}ms.`,
      );
    }
    const reason = cause instanceof Error ? cause.message : String(cause);
    return new RemoteAiProviderError(`The assistant server could not be reached: ${reason}`);
  }

  const provider = {
    propose(
      request: string,
      context: AssembledAiContext,
      live?: AiProposeOptions,
    ): Promise<AiPlan> {
      return post({ version: AI_PLAN_WIRE_VERSION, request, context }, live);
    },
    repair(
      request: string,
      context: AssembledAiContext,
      plan: AiPlan,
      issues: readonly AiPlanValidationIssue[],
      live?: AiProposeOptions,
    ): Promise<AiPlan> {
      return post(
        { version: AI_PLAN_WIRE_VERSION, request, context, attempt: { plan, issues } },
        live,
      );
    },
  } satisfies AiPlanProvider & Record<'repair', unknown>;

  return provider;
}
