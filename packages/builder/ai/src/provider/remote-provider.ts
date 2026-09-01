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
  /** Maximum decoded response-body bytes accepted from JSON or SSE. */
  maxResponseBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;

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

function callerAbortError(signal: AbortSignal | undefined): Error | undefined {
  if (signal?.aborted !== true) return undefined;
  const reason: unknown = signal.reason;
  if (reason instanceof Error && reason.name === 'AbortError') return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfCallerAborted(signal: AbortSignal | undefined): void {
  const error = callerAbortError(signal);
  if (error !== undefined) throw error;
}

function responseTooLarge(maxResponseBytes: number): RemoteAiProviderError {
  return new RemoteAiProviderError(
    `The assistant server response exceeded the maximum response size of ${String(maxResponseBytes)} bytes.`,
  );
}

function assertContentLengthWithinLimit(response: Response, maxResponseBytes: number): void {
  const header = response.headers.get('content-length');
  if (header === null) return;
  const declaredBytes = Number(header);
  if (Number.isFinite(declaredBytes) && declaredBytes > maxResponseBytes) {
    throw responseTooLarge(maxResponseBytes);
  }
}

function rejectOversizedStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxResponseBytes: number,
): never {
  void reader.cancel().catch(() => undefined);
  throw responseTooLarge(maxResponseBytes);
}

function countChunk(
  currentBytes: number,
  chunk: Uint8Array,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxResponseBytes: number,
): number {
  const nextBytes = currentBytes + chunk.byteLength;
  if (nextBytes > maxResponseBytes) rejectOversizedStream(reader, maxResponseBytes);
  return nextBytes;
}

async function readBoundedText(response: Response, maxResponseBytes: number): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes = countChunk(bytes, value, reader, maxResponseBytes);
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function readJsonResponse(response: Response, maxResponseBytes: number): Promise<unknown> {
  const text = await readBoundedText(response, maxResponseBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RemoteAiProviderError('The assistant server answer was not valid JSON.');
  }
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
    const followUp = payload['followUp'];
    return {
      rationale: payload['rationale'],
      commands: payload['commands'] as AiPlan['commands'],
      ...(typeof followUp === 'string' && followUp.trim() !== '' ? { followUp } : {}),
    };
  }
  throw new RemoteAiProviderError(
    'The assistant server answered with something that is not a plan or a refusal.',
  );
}

/** One `event:`/`data:` pair from an SSE frame; comment and id lines are ignored. */
function parseSseFrame(frame: string): { event: string; data: string } {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split(/\r\n|\r|\n/)) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart());
    }
  }
  return { event, data: data.join('\n') };
}

function nextSseFrameBoundary(buffer: string): { index: number; length: number } | undefined {
  const match = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
  return match?.index === undefined ? undefined : { index: match.index, length: match[0].length };
}

/**
 * Streaming answers: `status` frames narrate, exactly one `result` frame ends
 * the story with the same JSON shape the plain path uses.
 */
async function readSseResponse(
  response: Response,
  onProgress: ((text: string) => void) | undefined,
  maxResponseBytes: number,
): Promise<unknown> {
  if (response.body === null) {
    throw new RemoteAiProviderError('The assistant server stream had no body.');
  }
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  const missing = Symbol('no result yet');
  let bytes = 0;
  let buffer = '';
  let result: unknown = missing;
  let resultSeen = false;

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
      if (resultSeen) {
        throw new RemoteAiProviderError('The assistant server streamed data after its result.');
      }
      if (isRecord(payload) && typeof payload['text'] === 'string') {
        onProgress?.(payload['text']);
      }
    } else if (event === 'result') {
      if (resultSeen) {
        throw new RemoteAiProviderError('The assistant server streamed more than one result.');
      }
      resultSeen = true;
      result = payload;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    bytes = countChunk(bytes, value, reader, maxResponseBytes);
    buffer += decoder.decode(value, { stream: true });
    let boundary = nextSseFrameBoundary(buffer);
    while (boundary !== undefined) {
      handleFrame(buffer.slice(0, boundary.index));
      buffer = buffer.slice(boundary.index + boundary.length);
      boundary = nextSseFrameBoundary(buffer);
    }
  }
  buffer += decoder.decode();
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
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Remote AI provider timeoutMs must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new RangeError('Remote AI provider maxResponseBytes must be a positive safe integer.');
  }
  const fetchImpl = options.fetch ?? fetch;

  async function post(body: AiPlanWireRequest, live?: AiProposeOptions): Promise<AiPlan> {
    throwIfCallerAborted(live?.signal);
    const controller = new AbortController();
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
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
        throw abortAware(cause, live, timedOut);
      }
      throwIfEnded(live, timedOut);

      if (!response.ok) {
        throw new RemoteAiProviderError(
          `The assistant server answered with status ${String(response.status)}.`,
        );
      }

      let payload: unknown;
      try {
        assertContentLengthWithinLimit(response, maxResponseBytes);
        if ((response.headers.get('content-type') ?? '').startsWith('text/event-stream')) {
          payload = await readSseResponse(response, live?.onProgress, maxResponseBytes);
        } else {
          payload = await readJsonResponse(response, maxResponseBytes);
        }
      } catch (cause) {
        throw abortAware(cause, live, timedOut);
      }
      throwIfEnded(live, timedOut);
      return parseWireResponse(payload);
    } finally {
      clearTimeout(deadline);
      live?.signal?.removeEventListener('abort', cancel);
    }
  }

  function timeoutError(): RemoteAiProviderError {
    return new RemoteAiProviderError(
      `The assistant server timed out after ${String(timeoutMs)}ms.`,
    );
  }

  function throwIfEnded(live: AiProposeOptions | undefined, timedOut: boolean): void {
    throwIfCallerAborted(live?.signal);
    if (timedOut) throw timeoutError();
  }

  /** The caller's own cancellation stays an AbortError; everything else becomes ours. */
  function abortAware(
    cause: unknown,
    live: AiProposeOptions | undefined,
    timedOut: boolean,
  ): Error {
    const cancellation = callerAbortError(live?.signal);
    if (cancellation !== undefined) return cancellation;
    if (cause instanceof RemoteAiProviderError) {
      return cause;
    }
    if (timedOut || (cause instanceof Error && cause.name === 'AbortError')) return timeoutError();
    const reason = cause instanceof Error ? cause.message : String(cause);
    return new RemoteAiProviderError(`The assistant server could not be reached: ${reason}`);
  }

  const provider = {
    propose(
      request: string,
      context: AssembledAiContext,
      live?: AiProposeOptions,
    ): Promise<AiPlan> {
      return post(
        {
          version: AI_PLAN_WIRE_VERSION,
          request,
          context,
          ...(live?.history === undefined ? {} : { history: live.history }),
        },
        live,
      );
    },
    repair(
      request: string,
      context: AssembledAiContext,
      plan: AiPlan,
      issues: readonly AiPlanValidationIssue[],
      live?: AiProposeOptions,
    ): Promise<AiPlan> {
      return post(
        {
          version: AI_PLAN_WIRE_VERSION,
          request,
          context,
          ...(live?.history === undefined ? {} : { history: live.history }),
          attempt: { plan, issues },
        },
        live,
      );
    },
  } satisfies AiPlanProvider & Record<'repair', unknown>;

  return provider;
}
