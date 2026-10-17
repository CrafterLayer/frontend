import { detectPromptLanguage } from '../prompt-enhance/language';
import type {
  AiEnhancePromptOptions,
  AiPagePlanDraftEvent,
  AiPagePlanProposal,
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AiPromptEnhanceInput,
  AiPromptEnhancement,
  AiProposeOptions,
  AiProposePagePlanOptions,
  AssembledAiContext,
} from '../types';
import { AiProviderError } from './errors';
import { RemoteAiProviderError, remoteStatusError } from './remote-errors';
import { remoteSceneReview } from './remote-scene-review';
import { remoteSitePlan } from './remote-site-plan';
import { AiTaskUnsupportedError, type AiRemoteTask } from './remote-task';
import { notifyProviderUsage } from './usage';
import {
  AI_PLAN_WIRE_VERSION,
  AI_PROMPT_ENHANCE_PATH,
  aiPromptEnhanceWireRequest,
  boundAiPlanWireInvalidOutputMessage,
  readAiPagePlanWireResponse,
  readAiPromptEnhanceWireResponse,
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
  /**
   * Deadline for one `enhancePrompt` call. Default: `timeoutMs`, capped at
   * 45 s. Its own number because the plan deadline is sized for a whole page
   * (the playground's is 660 s), and the enhancer sits between the person and
   * their Send button: the contract caps its answer at 900 output tokens, and
   * past 45 s the person is better served by their own words.
   */
  enhanceTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ENHANCE_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
/** What a plan POST advertises: the SSE narration when the server streams, JSON when not. */
const ACCEPT_STREAM_OR_JSON = 'text/event-stream, application/json';

/**
 * The message a human sees in the refusal bubble. Server refusals pass through
 * verbatim; transport failures get one plain sentence each. A caller's own
 * cancellation is NOT one of these — it rethrows as the platform AbortError.
 */
export { RemoteAiProviderError } from './remote-errors';

// The tasks a server may predate, and the error that says so (T230: remote-task.ts).
export { AiTaskUnsupportedError, isAiTaskUnsupportedError, type AiRemoteTask } from './remote-task';

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
export function parseWireResponse(payload: unknown): AiPlan {
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

/**
 * A page-plan answer, read by the wire's own classifier. A refusal and an
 * invalid-output report fail exactly as they do for a plan; an ordinary plan
 * means the server predates the task (`onUnsupported` remembers that).
 */
function parsePagePlanResponse(
  payload: unknown,
  onUnsupported: (error: AiTaskUnsupportedError) => void,
): AiPagePlanProposal {
  const reading = readAiPagePlanWireResponse(payload);
  switch (reading.kind) {
    case 'page-plan':
      return {
        pagePlan: reading.pagePlan,
        ...(reading.rationale === undefined ? {} : { rationale: reading.rationale }),
      };
    case 'refusal':
      throw new RemoteAiProviderError(reading.message, { code: 'refusal', retryable: false });
    case 'invalid-output':
      throw new RemoteAiProviderError(reading.message, {
        code: 'invalid-output',
        retryable: true,
      });
    case 'unsupported': {
      const error = new AiTaskUnsupportedError('page-plan', reading.message);
      onUnsupported(error);
      throw error;
    }
  }
}

/** An enhance answer: the contract's shape, held to its limits, or a typed failure. */
function parseEnhanceResponse(
  payload: unknown,
  input: AiPromptEnhanceInput,
  onUnsupported: (error: AiTaskUnsupportedError) => void,
): AiPromptEnhancement {
  const reading = readAiPromptEnhanceWireResponse(
    payload,
    detectPromptLanguage(input.text) ?? input.locale,
  );
  switch (reading.kind) {
    case 'enhancement':
      return reading.enhancement;
    case 'invalid-output':
      throw new RemoteAiProviderError(reading.message, {
        code: 'invalid-output',
        retryable: true,
      });
    case 'unsupported': {
      const error = new AiTaskUnsupportedError('prompt-enhance', reading.message);
      onUnsupported(error);
      throw error;
    }
  }
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

/** Calls a host observer; its failure never alters the transport outcome. */
function notifyDraft(
  onDraft: ((event: AiPagePlanDraftEvent) => void) | undefined,
  event: AiPagePlanDraftEvent,
): void {
  if (onDraft === undefined) return;
  try {
    onDraft(event);
  } catch {
    // Draft observers are advisory; the resolved proposal is the authority.
  }
}

/**
 * Streaming answers: `status` frames narrate, `draft` frames carry the raw
 * answer text while the model writes it (page plans only), exactly one
 * `result` frame ends the story with the same JSON shape the plain path uses.
 *
 * `onDraft` is given only by `proposePagePlan`: it hears `start` when the
 * stream begins and on every `{reset: true}` draft, and `text` for every
 * draft with a string `text`. Any other draft payload, and any draft after
 * the result, is ignored rather than treated as a protocol error — drafts are
 * advisory. Without `onDraft` (every other task) draft frames are ignored, as
 * any unknown event is.
 */
async function readSseResponse(
  response: Response,
  onProgress: ((text: string) => void) | undefined,
  maxResponseBytes: number,
  onDraft?: (event: AiPagePlanDraftEvent) => void,
  onUsage?: (value: unknown) => void,
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
  notifyDraft(onDraft, { kind: 'start' });

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
    } else if (event === 'usage') {
      if (!resultSeen) onUsage?.(payload);
    } else if (event === 'result') {
      if (resultSeen) {
        throw new RemoteAiProviderError('The assistant server streamed more than one result.', {
          code: 'stream-protocol',
          retryable: true,
        });
      }
      resultSeen = true;
      result = payload;
    } else if (event === 'error') {
      // A failure after the stream began, with the status a plain answer would have carried.
      if (resultSeen || !isRecord(payload) || typeof payload['status'] !== 'number') return;
      const said = payload['message'];
      throw remoteStatusError(payload['status'], typeof said === 'string' ? said : undefined);
    } else if (event === 'draft') {
      if (resultSeen || onDraft === undefined || !isRecord(payload)) return;
      if (payload['reset'] === true) {
        notifyDraft(onDraft, { kind: 'start' });
      } else if (typeof payload['text'] === 'string') {
        notifyDraft(onDraft, { kind: 'text', text: payload['text'] });
      }
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

export function assertEndpointAllowed(endpoint: string, allowInsecureHttp: boolean): void {
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
 * The live options a POST reads: every task's cancellation, a plan's
 * narration, and a page plan's draft observer (read only when the exchange
 * says `drafts: true`).
 */
interface RemoteLive {
  onUsage?: AiProposeOptions['onUsage'];
  readonly signal?: AbortSignal | undefined;
  readonly onProgress?: ((text: string) => void) | undefined;
  readonly onDraft?: ((event: AiPagePlanDraftEvent) => void) | undefined;
}

/**
 * The model choice a run put on the live options (`withModel` in run-agent:
 * `{ ...live, model, effort }`), carried into the body the server reads.
 * Without this the edit model and effort never left the client.
 */
function modelChoiceFields(live: unknown): { model?: string; effort?: 'low' | 'medium' } {
  if (live === null || typeof live !== 'object') return {};
  const { model, effort } = live as { model?: unknown; effort?: unknown };
  return {
    ...(typeof model === 'string' && model !== '' ? { model } : {}),
    ...(effort === 'low' || effort === 'medium' ? { effort } : {}),
  };
}

/**
 * Free code mode, when a run turned it on (`AiProposeOptions.freeCode`): the
 * body carries `freeCode: true` and nothing otherwise, so a request from a run
 * without the mode is byte-identical to one written before the field existed.
 */
function freeCodeField(live: unknown): { freeCode?: true } {
  if (live === null || typeof live !== 'object') return {};
  return (live as { freeCode?: unknown }).freeCode === true ? { freeCode: true } : {};
}

/** One POST: where, what, how long it may take, and how its answer is read. */
interface RemoteExchange<T> {
  readonly url: string;
  readonly body: unknown;
  readonly accept: string;
  readonly timeoutMs: number;
  readonly read: (payload: unknown) => T;
  /** Forward `draft` frames to `live.onDraft` — the page plan only. */
  readonly drafts?: boolean;
}

/**
 * `AiPlanProvider` backed by one HTTP endpoint speaking the wire contract in
 * `wire.ts`. The provider proposes; it never applies. Everything it returns
 * still has to survive the live registry and the scratch-kernel dry run.
 *
 * Both answer styles are accepted from the same POST: a plain JSON body, or —
 * when the server honours the advertised `text/event-stream` — an SSE stream
 * whose `status` frames feed `onProgress` and whose `result` frame carries the
 * final wire response. For `proposePagePlan` only, the stream's `draft` frames
 * (the model's raw answer text) feed `live.onDraft` — `start` when the stream
 * begins or the server resets it, then `text` slices; a JSON answer emits none.
 *
 * Several tasks, one transport (auth, deadline, cancellation, size cap, SSE): `propose`/`repair`
 * post a plan request to the endpoint; `proposePagePlan` posts the same request with
 * `task: 'page-plan'` (and the refused candidate as `pagePlanAttempt` on its one repair);
 * `enhancePrompt` posts the draft to `/v1/prompt/enhance` on the endpoint's origin, and
 * `reviewScene` a scene's pictures to `/v1/scene/review`, each under its own shorter deadline.
 * A server that turns out to predate a task is remembered for the provider's lifetime
 * (`AiTaskUnsupportedError`), so its misread answer is paid for once, not once per build.
 */
export function createRemoteAiPlanProvider(options: RemoteAiPlanProviderOptions) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const enhanceTimeoutMs =
    options.enhanceTimeoutMs ?? Math.min(timeoutMs, DEFAULT_ENHANCE_TIMEOUT_MS);
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Remote AI provider timeoutMs must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(enhanceTimeoutMs) || enhanceTimeoutMs <= 0) {
    throw new RangeError('Remote AI provider enhanceTimeoutMs must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new RangeError('Remote AI provider maxResponseBytes must be a positive safe integer.');
  }
  assertEndpointAllowed(options.endpoint, options.allowInsecureHttp === true);
  const fetchImpl = options.fetch ?? fetch;
  // Same origin as the plan endpoint, so the endpoint policy above already covers it.
  const enhanceEndpoint = new URL(AI_PROMPT_ENHANCE_PATH, options.endpoint).toString();
  /** Tasks this server has shown it predates, and the error that showed it. */
  const unsupported = new Map<AiRemoteTask, AiTaskUnsupportedError>();
  const remember = (error: AiTaskUnsupportedError): void => {
    unsupported.set(error.task, error);
  };
  /** A fresh error per refusal, so each caller's stack is its own. */
  const refuseKnownUnsupported = (task: AiRemoteTask): void => {
    const known = unsupported.get(task);
    if (known !== undefined) throw new AiTaskUnsupportedError(task, known.message);
  };

  async function post<T>(exchange: RemoteExchange<T>, live: RemoteLive | undefined): Promise<T> {
    throwIfCallerAborted(live?.signal);
    const controller = new AbortController();
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, exchange.timeoutMs);
    const cancel = () => {
      controller.abort(live?.signal?.reason);
    };
    live?.signal?.addEventListener('abort', cancel, { once: true });
    let usageSeen = false;
    const takeUsage = (value: unknown): void => {
      if (usageSeen || controller.signal.aborted) return;
      notifyProviderUsage((usage) => {
        usageSeen = true;
        live?.onUsage?.(usage);
      }, value);
    };

    try {
      let response: Response;
      try {
        response = await fetchImpl(exchange.url, {
          method: 'POST',
          headers: {
            ...options.headers,
            accept: exchange.accept,
            'content-type': 'application/json',
          },
          body: JSON.stringify(exchange.body),
          signal: controller.signal,
          redirect: 'error',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
      } catch (cause) {
        throw abortAware(cause, live, timedOut, exchange.timeoutMs);
      }
      try {
        throwIfEnded(live, timedOut, exchange.timeoutMs);
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
        throw remoteStatusError(response.status);
      }

      try {
        assertContentLengthWithinLimit(response, maxResponseBytes);
      } catch (cause) {
        cancelResponseBody(response);
        throw abortAware(cause, live, timedOut, exchange.timeoutMs);
      }

      let payload: unknown;
      const usageHeader = response.headers.get('x-craftkit-ai-usage');
      if (usageHeader !== null && usageHeader.length <= 2_048) {
        try {
          takeUsage(JSON.parse(usageHeader) as unknown);
        } catch {
          /* Advisory metadata. */
        }
      }
      try {
        if ((response.headers.get('content-type') ?? '').startsWith('text/event-stream')) {
          payload = await readSseResponse(
            response,
            live?.onProgress,
            maxResponseBytes,
            exchange.drafts === true ? live?.onDraft : undefined,
            takeUsage,
          );
        } else {
          payload = await readJsonResponse(response, maxResponseBytes);
        }
      } catch (cause) {
        throw abortAware(cause, live, timedOut, exchange.timeoutMs);
      }
      throwIfEnded(live, timedOut, exchange.timeoutMs);
      // Before parsing refusals/invalid output: a failed answer may still have incurred usage.
      if (isRecord(payload)) takeUsage(payload['usage']);
      return exchange.read(payload);
    } finally {
      clearTimeout(deadline);
      live?.signal?.removeEventListener('abort', cancel);
    }
  }

  function timeoutError(ms: number): RemoteAiProviderError {
    return new RemoteAiProviderError(`The assistant server timed out after ${String(ms)}ms.`, {
      code: 'timeout',
      retryable: true,
    });
  }

  function throwIfEnded(live: RemoteLive | undefined, timedOut: boolean, ms: number): void {
    throwIfCallerAborted(live?.signal);
    if (timedOut) throw timeoutError(ms);
  }

  /** The caller's own cancellation stays an AbortError; everything else becomes ours. */
  function abortAware(
    cause: unknown,
    live: RemoteLive | undefined,
    timedOut: boolean,
    ms: number,
  ): Error {
    const cancellation = callerAbortError(live?.signal);
    if (cancellation !== undefined) return cancellation;
    if (cause instanceof AiProviderError) {
      return cause;
    }
    if (timedOut || (cause instanceof Error && cause.name === 'AbortError')) {
      return timeoutError(ms);
    }
    const reason = cause instanceof Error ? cause.message : String(cause);
    return new RemoteAiProviderError(`The assistant server could not be reached: ${reason}`, {
      code: 'network',
      retryable: true,
    });
  }

  /** A plan-shaped POST to the endpoint: plans, repairs and page plans alike. */
  function planExchange<T>(
    body: AiPlanWireRequest,
    read: (payload: unknown) => T,
    drafts = false,
  ): RemoteExchange<T> {
    return { url: options.endpoint, body, accept: ACCEPT_STREAM_OR_JSON, timeoutMs, read, drafts };
  }

  const provider = {
    propose(
      request: string,
      context: AssembledAiContext,
      live?: AiProposeOptions,
    ): Promise<AiPlan> {
      return post(
        planExchange(
          {
            version: AI_PLAN_WIRE_VERSION,
            request,
            context,
            ...(live?.history === undefined ? {} : { history: live.history }),
            ...modelChoiceFields(live),
            ...freeCodeField(live),
          },
          parseWireResponse,
        ),
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
        planExchange(
          {
            version: AI_PLAN_WIRE_VERSION,
            request,
            context,
            ...(live?.history === undefined ? {} : { history: live.history }),
            attempt: { plan, issues },
            ...modelChoiceFields(live),
            ...freeCodeField(live),
          },
          parseWireResponse,
        ),
        live,
      );
    },
    /*
      Step T1 over the page-plan wire (2026-09-28). Before this the playground's provider had no
      `proposePagePlan`, so every build silently took the scaffold path — the ~25k-character
      model-written skeleton the PagePlan pipeline was built to replace (wave-2 verifier).
    */
    async proposePagePlan(
      request: string,
      context: AssembledAiContext,
      live?: AiProposePagePlanOptions,
    ): Promise<AiPagePlanProposal> {
      throwIfCallerAborted(live?.signal);
      refuseKnownUnsupported('page-plan');
      const attempt = live?.attempt;
      return post(
        planExchange(
          {
            version: AI_PLAN_WIRE_VERSION,
            request,
            context,
            ...(live?.history === undefined ? {} : { history: live.history }),
            task: 'page-plan',
            ...(attempt === undefined
              ? {}
              : { pagePlanAttempt: { pagePlan: attempt.pagePlan, issues: attempt.issues } }),
            ...freeCodeField(live),
          },
          (payload) => parsePagePlanResponse(payload, remember),
          true,
        ),
        live,
      );
    },
    // The site plan (remote-site-plan.ts) and the scene review (remote-scene-review.ts).
    ...remoteSitePlan((body, read, live) => post(planExchange(body, read), live), {
      refuseKnownUnsupported,
      remember,
    }),
    ...remoteSceneReview(post, options, { refuseKnownUnsupported, remember }),
    async enhancePrompt(
      input: AiPromptEnhanceInput,
      live?: AiEnhancePromptOptions,
    ): Promise<AiPromptEnhancement> {
      throwIfCallerAborted(live?.signal);
      refuseKnownUnsupported('prompt-enhance');
      return post(
        {
          url: enhanceEndpoint,
          body: aiPromptEnhanceWireRequest(input),
          accept: 'application/json',
          timeoutMs: enhanceTimeoutMs,
          read: (payload) => parseEnhanceResponse(payload, input, remember),
        },
        live,
      );
    },
  } satisfies AiPlanProvider & Record<'repair' | 'proposePagePlan' | 'enhancePrompt', unknown>;

  return provider;
}
