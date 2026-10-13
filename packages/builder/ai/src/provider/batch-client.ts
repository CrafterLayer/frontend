import type { AiPagePlanProposal, AiPlan, AiProviderUsage } from '../types';
import { AiProviderError } from './errors';
import { RemoteAiProviderError, remoteStatusError } from './remote-errors';
import { assertEndpointAllowed, parseWireResponse } from './remote-provider';
import { readProviderUsage } from './usage';
import {
  AI_BATCH_PATH,
  type AiBatchWireCounts,
  type AiBatchWireItem,
  type AiBatchWireReviewItem,
  type AiBatchWireStatus,
} from './batch-wire';
import { readAiSceneReviewWireResponse, type AiSceneReview } from './scene-review-wire';
import { readAiPagePlanWireResponse, type AiPlanWireTask } from './wire';

/*
  The client half of background batches (batch-wire.ts has the contract). Submit, poll,
  read, cancel — four calls, each one plain JSON request with the remote provider's endpoint
  policy, deadline and size cap. An item's answer is decoded by the SAME reader a live plan
  goes through (`parseWireResponse`; `readAiPagePlanWireResponse` for a page plan), so a
  batch answer can only ever be a plan, a refusal, or an invalid answer — never a document.
  A scene review item (2026-10-13) is read by the live review's reader
  (`readAiSceneReviewWireResponse`): a verdict, a refusal or an invalid answer.
*/

export interface RemoteBatchClientOptions {
  /** The PLAN endpoint, as the remote provider takes it; the batch routes are on its origin. */
  endpoint: string;
  /** Extra headers, e.g. authorization. Content type is always set by the client. */
  headers?: Readonly<Record<string, string>>;
  /** Injected for tests and non-browser hosts; defaults to the ambient fetch. */
  fetch?: typeof fetch;
  /** Deadline for ONE call (a batch takes hours; a call about it, seconds). */
  timeoutMs?: number;
  /** Maximum response-body bytes: results of a hundred page plans run to megabytes. */
  maxResponseBytes?: number;
  /** Development-only escape hatch for an explicitly configured HTTP endpoint. */
  allowInsecureHttp?: boolean;
}

/** A batch's state: what the panel polls. */
export interface AiBatchState {
  readonly batchId: string;
  readonly status: AiBatchWireStatus;
  readonly counts: AiBatchWireCounts;
  readonly createdAt: string;
  readonly endedAt: string | null;
  /** What the one live call that warmed the items' shared prefix cost, when one was sent. */
  readonly warmUsage?: AiProviderUsage;
}

/** One item's answer, read by the live decoders, or the reason it has none. */
export type AiBatchItemResult =
  | {
      readonly id: string;
      readonly outcome: 'plan';
      readonly plan: AiPlan;
      readonly usage?: AiProviderUsage;
    }
  | {
      readonly id: string;
      readonly outcome: 'page-plan';
      readonly proposal: AiPagePlanProposal;
      readonly usage?: AiProviderUsage;
    }
  | {
      readonly id: string;
      readonly outcome: 'scene-review';
      readonly review: AiSceneReview;
      readonly usage?: AiProviderUsage;
    }
  | {
      readonly id: string;
      readonly outcome: 'refusal' | 'invalid-output';
      readonly message: string;
      readonly usage?: AiProviderUsage;
    }
  | {
      readonly id: string;
      readonly outcome: 'error';
      /** The API's error type, `canceled` or `expired`. */
      readonly type: string;
      readonly message: string;
      /** Whether sending the same request again may succeed. */
      readonly retryable: boolean;
    };

export interface AiBatchCallOptions {
  readonly signal?: AbortSignal | undefined;
}

export interface AiBatchSubmitOptions extends AiBatchCallOptions {
  /** The person's model pick for every item; the server holds it to its allowlist. */
  readonly model?: string | undefined;
}

/** How a batch's answers are read: as plans, page plans, or scene reviews. */
export type AiBatchResultsTask = AiPlanWireTask | 'scene-review';

export interface AiBatchResultsOptions extends AiBatchCallOptions {
  /** How to read the answers: as plans (the default), page plans or scene reviews. */
  readonly task?: AiBatchResultsTask | undefined;
}

export interface AiBatchClient {
  submit(
    items: readonly (AiBatchWireItem | AiBatchWireReviewItem)[],
    options?: AiBatchSubmitOptions,
  ): Promise<AiBatchState>;
  status(batchId: string, options?: AiBatchCallOptions): Promise<AiBatchState>;
  results(batchId: string, options?: AiBatchResultsOptions): Promise<readonly AiBatchItemResult[]>;
  cancel(batchId: string, options?: AiBatchCallOptions): Promise<AiBatchState>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
/** Server error sentences are short; a longer body is not one. */
const MAX_ERROR_MESSAGE_LENGTH = 1_000;
const STATUSES: ReadonlySet<unknown> = new Set(['in_progress', 'canceling', 'ended']);
/** Item errors worth sending again: an outage, a rate limit, a batch that ran out of time. */
const RETRYABLE_ITEM_ERRORS: ReadonlySet<string> = new Set([
  'api_error',
  'overloaded_error',
  'rate_limit_error',
  'timeout_error',
  'expired',
  'canceled',
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function protocolError(message: string): RemoteAiProviderError {
  return new RemoteAiProviderError(message, { code: 'invalid-output', retryable: true });
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function readState(payload: unknown): AiBatchState {
  if (!isRecord(payload) || typeof payload['id'] !== 'string' || !STATUSES.has(payload['status'])) {
    throw protocolError('The assistant server answered with something that is not a batch.');
  }
  const counts = isRecord(payload['counts']) ? payload['counts'] : {};
  const endedAt = payload['endedAt'];
  const warmUsage = readProviderUsage(payload['warmUsage']);
  return {
    batchId: payload['id'],
    status: payload['status'] as AiBatchWireStatus,
    counts: {
      processing: count(counts['processing']),
      succeeded: count(counts['succeeded']),
      errored: count(counts['errored']),
      canceled: count(counts['canceled']),
      expired: count(counts['expired']),
    },
    createdAt: typeof payload['createdAt'] === 'string' ? payload['createdAt'] : '',
    endedAt: typeof endedAt === 'string' ? endedAt : null,
    ...(warmUsage === undefined ? {} : { warmUsage }),
  };
}

/** A plan answer, read exactly as a live one is; a refusal or an invalid answer is said so. */
function readPlanBody(
  id: string,
  body: unknown,
  usage: AiProviderUsage | undefined,
): AiBatchItemResult {
  const cost = usage === undefined ? {} : { usage };
  try {
    return { id, outcome: 'plan', plan: parseWireResponse(body), ...cost };
  } catch (cause) {
    if (!(cause instanceof AiProviderError)) throw cause;
    const outcome = cause.code === 'refusal' ? 'refusal' : 'invalid-output';
    return { id, outcome, message: cause.message, ...cost };
  }
}

function readPagePlanBody(
  id: string,
  body: unknown,
  usage: AiProviderUsage | undefined,
): AiBatchItemResult {
  const cost = usage === undefined ? {} : { usage };
  const reading = readAiPagePlanWireResponse(body);
  if (reading.kind === 'page-plan') {
    const { pagePlan, rationale } = reading;
    const proposal = { pagePlan, ...(rationale === undefined ? {} : { rationale }) };
    return { id, outcome: 'page-plan', proposal, ...cost };
  }
  const outcome = reading.kind === 'refusal' ? 'refusal' : 'invalid-output';
  return { id, outcome, message: reading.message, ...cost };
}

function readReviewBody(
  id: string,
  body: unknown,
  usage: AiProviderUsage | undefined,
): AiBatchItemResult {
  const cost = usage === undefined ? {} : { usage };
  const reading = readAiSceneReviewWireResponse(body);
  if (reading.kind === 'review')
    return { id, outcome: 'scene-review', review: reading.review, ...cost };
  const outcome = reading.kind === 'refusal' ? 'refusal' : 'invalid-output';
  return { id, outcome, message: reading.message, ...cost };
}

function readItem(entry: unknown, task: AiBatchResultsTask): AiBatchItemResult | undefined {
  if (!isRecord(entry) || typeof entry['id'] !== 'string') return undefined;
  const id = entry['id'];
  const error = entry['error'];
  if (isRecord(error)) {
    const type = typeof error['type'] === 'string' ? error['type'] : 'api_error';
    const message =
      typeof error['message'] === 'string'
        ? error['message'].slice(0, MAX_ERROR_MESSAGE_LENGTH)
        : 'The assistant service failed to answer this request.';
    return { id, outcome: 'error', type, message, retryable: RETRYABLE_ITEM_ERRORS.has(type) };
  }
  if (!Object.hasOwn(entry, 'body')) return undefined;
  const usage = readProviderUsage(entry['usage']);
  if (task === 'scene-review') return readReviewBody(id, entry['body'], usage);
  return task === 'page-plan'
    ? readPagePlanBody(id, entry['body'], usage)
    : readPlanBody(id, entry['body'], usage);
}

async function readBounded(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(maxBytes);
  if (response.body === null) return '';
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw tooLarge(maxBytes);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    void reader.cancel().catch(() => undefined);
  }
}

function tooLarge(maxBytes: number): RemoteAiProviderError {
  return new RemoteAiProviderError(
    `The assistant server response exceeded the maximum response size of ${String(maxBytes)} bytes.`,
    { code: 'response-limit', retryable: false },
  );
}

/** The server's own sentence from an error body, when it sent one. */
function errorSentence(text: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    const said = isRecord(parsed) ? parsed['error'] : undefined;
    return typeof said === 'string' && said.trim() !== ''
      ? said.slice(0, MAX_ERROR_MESSAGE_LENGTH)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The batch routes of a plan server (`AI_BATCH_PATH` on the endpoint's origin). A failed
 * call throws a `RemoteAiProviderError` carrying the server's own sentence and status — a
 * 501 says the server cannot batch at all, a 409 that a model cannot or that results are
 * not ready — and a caller's own cancellation stays the platform AbortError.
 */
export function createRemoteBatchClient(options: RemoteBatchClientOptions): AiBatchClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Remote batch client timeoutMs must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new RangeError('Remote batch client maxResponseBytes must be a positive safe integer.');
  }
  assertEndpointAllowed(options.endpoint, options.allowInsecureHttp === true);
  const fetchImpl = options.fetch ?? fetch;
  const base = new URL(AI_BATCH_PATH, options.endpoint).toString();

  async function call(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    // Aborted, and not by the caller: the deadline passed.
    const timedOut = (): boolean => controller.signal.aborted && signal?.aborted !== true;
    const cancel = (): void => {
      controller.abort(signal?.reason);
    };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      let response: Response;
      try {
        response = await fetchImpl(`${base}${path}`, {
          method,
          headers: {
            ...options.headers,
            accept: 'application/json',
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
          redirect: 'error',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
      } catch (cause) {
        signal?.throwIfAborted();
        if (timedOut()) throw timeoutError(timeoutMs);
        const reason = cause instanceof Error ? cause.message : String(cause);
        throw new RemoteAiProviderError(`The assistant server could not be reached: ${reason}`, {
          code: 'network',
          retryable: true,
        });
      }
      let text: string;
      try {
        text = await readBounded(response, maxResponseBytes);
      } catch (cause) {
        signal?.throwIfAborted();
        if (timedOut()) throw timeoutError(timeoutMs);
        throw cause;
      }
      if (!response.ok) throw remoteStatusError(response.status, errorSentence(text));
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw protocolError('The assistant server answer was not valid JSON.');
      }
    } finally {
      clearTimeout(deadline);
      signal?.removeEventListener('abort', cancel);
    }
  }

  const at = (batchId: string, action = ''): string => {
    if (!/^[A-Za-z0-9_-]{1,200}$/u.test(batchId)) {
      throw new RangeError(`"${batchId.slice(0, 60)}" is not a batch id.`);
    }
    return `/${batchId}${action}`;
  };

  return {
    async submit(items, live) {
      const model = live?.model?.trim() ?? '';
      const body = { version: 1, ...(model === '' ? {} : { model }), items };
      return readState(await call('POST', '', body, live?.signal));
    },
    async status(batchId, live) {
      return readState(await call('GET', at(batchId), undefined, live?.signal));
    },
    async results(batchId, live) {
      const payload = await call('GET', at(batchId, '/results'), undefined, live?.signal);
      if (!isRecord(payload) || !Array.isArray(payload['items'])) {
        throw protocolError(
          'The assistant server answered with something that is not batch results.',
        );
      }
      const task = live?.task ?? 'plan';
      return (payload['items'] as unknown[]).flatMap((entry) => {
        const item = readItem(entry, task);
        return item === undefined ? [] : [item];
      });
    },
    async cancel(batchId, live) {
      return readState(await call('POST', at(batchId, '/cancel'), undefined, live?.signal));
    },
  };
}

function timeoutError(ms: number): RemoteAiProviderError {
  return new RemoteAiProviderError(`The assistant server timed out after ${String(ms)}ms.`, {
    code: 'timeout',
    retryable: true,
  });
}
