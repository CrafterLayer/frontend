import type {
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AiProposeOptions,
  AssembledAiContext,
} from '../types';
import { AiProviderError, type AiProviderErrorDetails } from './errors';
import {
  AI_PLAN_WIRE_VERSION,
  boundAiPlanWireInvalidOutputMessage,
  type AiPlanWireRequest,
} from './wire';

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
  /** Development-only escape hatch for an explicitly configured HTTP endpoint. */
  allowInsecureHttp?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;

/**
 * The message a human sees in the refusal bubble. Server refusals pass through
 * verbatim; transport failures get one plain sentence each. A caller's own
 * cancellation is NOT one of these — it rethrows as the platform AbortError.
 */
export class RemoteAiProviderError extends AiProviderError {
  override readonly name = 'RemoteAiProviderError';

  constructor(
    message: string,
    details: AiProviderErrorDetails = { code: 'invalid-output', retryable: false },
  ) {
    super(message, details);
  }
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
    { code: 'response-limit', retryable: false },
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

function countChunk(currentBytes: number, chunk: Uint8Array, maxResponseBytes: number): number {
  const nextBytes = currentBytes + chunk.byteLength;
  if (nextBytes > maxResponseBytes) throw responseTooLarge(maxResponseBytes);
  return nextBytes;
}

function cancelAndReleaseReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    void reader.cancel().catch(() => undefined);
  } catch {
    // Reader cleanup must never replace the provider's real terminal outcome.
  }
  try {
    reader.releaseLock();
  } catch {
    // A host stream may already have released its lock while aborting.
  }
}

function cancelResponseBody(response: Response): void {
  try {
    void response.body?.cancel().catch(() => undefined);
  } catch {
    // Response cleanup is best-effort and must not mask the classified error.
  }
}

async function readBoundedText(response: Response, maxResponseBytes: number): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes = countChunk(bytes, value, maxResponseBytes);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    cancelAndReleaseReader(reader);
  }
}

async function readJsonResponse(response: Response, maxResponseBytes: number): Promise<unknown> {
  const text = await readBoundedText(response, maxResponseBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RemoteAiProviderError('The assistant server answer was not valid JSON.', {
      code: 'invalid-output',
      retryable: true,
    });
  }
}

/**
 * Shallow shape check only: enough to tell "a plan" from "garbage" so the
 * error names the server instead of confusing the kernel-door validator. The
 * real per-command validation still happens in `assertValidAiPlan`.
 */
function parseWireResponse(payload: unknown): AiPlan {
  if (
    isRecord(payload) &&
    Object.hasOwn(payload, 'version') &&
    payload['version'] !== AI_PLAN_WIRE_VERSION
  ) {
    throw new RemoteAiProviderError(
      `The assistant server answered with unsupported wire version ${String(payload['version'])}.`,
      { code: 'invalid-output', retryable: true },
    );
  }
  if (
    isRecord(payload) &&
    payload['version'] === AI_PLAN_WIRE_VERSION &&
    isRecord(payload['invalidOutput']) &&
    typeof payload['invalidOutput']['message'] === 'string'
  ) {
    throw new RemoteAiProviderError(
      boundAiPlanWireInvalidOutputMessage(payload['invalidOutput']['message']),
      { code: 'invalid-output', retryable: true },
    );
  }
  if (isRecord(payload) && typeof payload['refusal'] === 'string') {
    throw new RemoteAiProviderError(payload['refusal'], {
      code: 'refusal',
      retryable: false,
    });
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
    { code: 'invalid-output', retryable: true },
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
    throw new RemoteAiProviderError('The assistant server stream had no body.', {
      code: 'stream-protocol',
      retryable: true,
    });
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
      throw new RemoteAiProviderError('The assistant server streamed invalid JSON.', {
        code: 'invalid-output',
        retryable: true,
      });
    }
    if (event === 'status') {
      if (resultSeen) {
        throw new RemoteAiProviderError('The assistant server streamed data after its result.', {
          code: 'stream-protocol',
          retryable: true,
        });
      }
      if (isRecord(payload) && typeof payload['text'] === 'string') {
        try {
          onProgress?.(payload['text']);
        } catch {
          // Host observers are non-authoritative; their failure cannot alter transport outcome.
        }
      }
    } else if (event === 'result') {
      if (resultSeen) {
        throw new RemoteAiProviderError('The assistant server streamed more than one result.', {
          code: 'stream-protocol',
          retryable: true,
        });
      }
      resultSeen = true;
      result = payload;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      bytes = countChunk(bytes, value, maxResponseBytes);
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
      throw new RemoteAiProviderError('The assistant server stream ended without a result.', {
        code: 'stream-protocol',
        retryable: true,
      });
    }
    return result;
  } finally {
    cancelAndReleaseReader(reader);
  }
}

function endpointPolicyError(message: string): RemoteAiProviderError {
  return new RemoteAiProviderError(message, { code: 'endpoint-policy', retryable: false });
}

function assertEndpointAllowed(endpoint: string, allowInsecureHttp: boolean): void {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw endpointPolicyError('The remote AI endpoint must be an absolute HTTPS URL.');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw endpointPolicyError('The remote AI endpoint must not contain embedded credentials.');
  }
  if (parsed.protocol === 'https:') return;
  if (parsed.protocol === 'http:' && allowInsecureHttp) return;
  throw endpointPolicyError(
    'The remote AI endpoint must use HTTPS unless allowInsecureHttp is explicitly enabled for development.',
  );
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
  assertEndpointAllowed(options.endpoint, options.allowInsecureHttp === true);
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
          redirect: 'error',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
      } catch (cause) {
        throw abortAware(cause, live, timedOut);
      }
      try {
        throwIfEnded(live, timedOut);
      } catch (cause) {
        cancelResponseBody(response);
        throw cause;
      }

      if (response.redirected) {
        cancelResponseBody(response);
        throw endpointPolicyError('The assistant server response was redirected and was refused.');
      }

      if (!response.ok) {
        cancelResponseBody(response);
        throw new RemoteAiProviderError(
          `The assistant server answered with status ${String(response.status)}.`,
          {
            code: 'http-status',
            retryable:
              response.status === 408 ||
              response.status === 425 ||
              response.status === 429 ||
              response.status >= 500,
            status: response.status,
          },
        );
      }

      try {
        assertContentLengthWithinLimit(response, maxResponseBytes);
      } catch (cause) {
        cancelResponseBody(response);
        throw abortAware(cause, live, timedOut);
      }

      let payload: unknown;
      try {
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
      { code: 'timeout', retryable: true },
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
    return new RemoteAiProviderError(`The assistant server could not be reached: ${reason}`, {
      code: 'network',
      retryable: true,
    });
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
