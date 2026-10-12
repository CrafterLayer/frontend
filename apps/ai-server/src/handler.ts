import type Anthropic from '@anthropic-ai/sdk';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';
import type { ExportPage, RuntimeSnapshot } from '@craftkit/builder/code-runtime';

import { proposerFor, type AnswerDraft, type ClaudeOptions } from './claude';
import type { CodeRuntimeService } from './code-runtime-service';
import { ENHANCE_PATH, ENHANCE_TIMEOUT_MS, enhancePrompt, readEnhanceRequest } from './enhance';
import type { FreeModelCatalog } from './free-models';
import { enhancerModelFor } from './enhance-route';
import {
  isAuthoredRunRequest,
  type AuthoredRunCoordinator,
  type AuthoredRunRequest,
} from './authored-run';
import { createBatchRoutes, isBatchPath, type BatchCapability } from './batch-routes';
import {
  answerBody,
  invalidOutputBody,
  reportUsage,
  type Answered,
  type UsageTask,
} from './plan-answer';
import { errorResponse, describeFailure } from './plan-errors';
import type { UsageReport } from './plan-params';
import {
  CALL_EFFORT_LEVELS,
  DEFAULT_CALL_EFFORT,
  DEFAULT_MAX_REQUEST_BYTES,
  authorized,
  callEffort,
  pickedModel,
  readJsonBody,
  readPlanCall,
  type CallEffort,
} from './plan-request';

// Moved with the checks they belong to (2026-10-12); still answered here.
export {
  CALL_EFFORT_LEVELS,
  DEFAULT_CALL_EFFORT,
  EFFORT_HEADER,
  MODEL_HEADER,
} from './plan-request';
export type { CallEffort } from './plan-request';
export { NO_CREDENTIALS_MESSAGE } from './plan-errors';
export type { UsageTask } from './plan-answer';

/**
 * The HTTP surface: one POST, three possible answers.
 *
 * Written against the platform `Request`/`Response` rather than a framework so
 * the same function serves a Node server, a worker, and a test with no adapter
 * — and so this app's dependency list stays at the SDK plus the workspace.
 */

export interface HandlerOptions {
  readonly client: Anthropic;
  /** The default model, and the one a request may always name. */
  readonly model?: string;
  /** The OTHER models a request may name through `x-craftkit-ai-model`. Unset ⇒ only the default. */
  readonly models?: readonly string[];
  /**
   * The free OpenRouter models listed right now. A request may name any of them
   * (the allowlist above is no longer the only door), and `GET /v1/models`
   * offers them to the picker. Omitted ⇒ only the configured models.
   */
  readonly freeModels?: FreeModelCatalog;
  readonly maxTokens?: number;
  /** Bearer token required on every request. Omitted ⇒ no auth (local only). */
  readonly authToken?: string;
  /** Largest request body accepted, in bytes. */
  readonly maxRequestBytes?: number;
  /** Receives one line per completed request; `task` says which endpoint's call it was. */
  readonly onUsage?: (
    report: UsageReport & { readonly cachedShare: number | null; readonly task?: UsageTask },
  ) => void;
  /** Receives every answer's raw text before it is parsed; for the owner's log. */
  readonly onAnswer?: (text: string) => void;
  /** One line per thing the server did to an answer (a code repair, a guard); for the owner's log. */
  readonly onLog?: (line: string) => void;
  /**
   * The model `/v1/prompt/enhance` runs on. Unset ⇒ the fastest of `model`
   * and `models` (`fastestModel`) — the enhancer is a small call a person
   * waits on, so it never takes the picker's choice.
   */
  readonly enhanceModel?: string;
  /** The enhancer's whole-call cap; defaults to `ENHANCE_SERVER_TIMEOUT_MS`. */
  readonly enhanceTimeoutMs?: number;
  /**
   * The reasoning budget for a build's SECTION writers. They compose one
   * section under a direction the skeleton already decided, so thinking is
   * the part of their time worth cutting (measured 2026-09-27: 2,050-3,885
   * output tokens for 2,000-4,500 characters of section — most of it
   * thinking). Unset ⇒ every call uses the backend default.
   */
  readonly sectionEffort?: string;
  /**
   * Whether the PAGE PLAN call thinks. Default false (speed first): measured
   * live 2026-09-30 on cli:haiku at medium, the plan took 172 s / 17,044
   * output tokens for a 3.8k-character Arabic plan and 94 s / 9,938 for
   * English — 78% of the Arabic build — while the kit index, the direction
   * deck and the validator already make the design decisions thinking was
   * paying for. `true` restores adaptive thinking.
   */
  readonly planThinking?: boolean;
  /**
   * Whether a STREAMED page plan also sends the model's raw text as it is
   * written, as `event: draft` frames before the one `result` (DESIGN §5.1),
   * so the client can start building on each finished part of the plan.
   * Default true; `CRAFTKIT_AI_PLAN_DRAFTS=off` sets it false. Additive to wire
   * v1: a client that does not know the event ignores it.
   */
  readonly planDrafts?: boolean;
  /** Isolated compiler/prerender boundary. Omitted deployments keep the legacy plan endpoint only. */
  readonly codeRuntime?: CodeRuntimeService;
  readonly authoredRuns?: AuthoredRunCoordinator;
  /**
   * Who runs background batches (`/batch`, batch-routes.ts): the Messages API, or why this
   * server cannot (the CLI and OpenRouter cannot batch). Omitted ⇒ `/batch` answers 501.
   */
  readonly batches?: BatchCapability;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * SSE frame. `status` narrates; `draft` carries a page plan's raw text as it
 * is written (`{text}`, or `{reset: true}` when the answer starts over);
 * exactly one `result` ends the stream.
 */
type FrameEvent = 'status' | 'unit' | 'draft' | 'usage' | 'error' | 'result';
function frame(event: FrameEvent, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const MODELS_PATH = '/v1/models';

/** One model the picker may offer; `live` ones come from OpenRouter's listing, not the owner's file. */
export interface OfferedModel {
  readonly id: string;
  readonly kind: 'configured' | 'live';
  /** The vendor's display name, when OpenRouter gave one. */
  readonly name?: string;
  readonly contextLength?: number;
  readonly structuredOutputs?: boolean;
}

/**
 * `GET /v1/models` — what the picker may offer, and how hard it may make a model
 * think. The owner's configured models first (the default leading), then every free
 * model OpenRouter lists right now. A configured `:free` slug the live listing no
 * longer carries is left out: it was withdrawn, and a request naming it would fail.
 * While the listing is unreadable nothing is left out — the configured models are
 * all there is to go on — and `error` says why the live part is missing.
 */
async function modelsListing(options: HandlerOptions): Promise<{
  readonly version: 1;
  readonly default: string | undefined;
  readonly defaultEffort: CallEffort;
  readonly efforts: readonly CallEffort[];
  readonly models: readonly OfferedModel[];
  readonly fetchedAt: number;
  readonly error?: string;
}> {
  const live = await options.freeModels?.list();
  const liveById = new Map((live?.models ?? []).map((model) => [model.id, model]));
  const liveKnown = live !== undefined && live.fetchedAt > 0;
  const configured = [
    ...new Set([
      ...(options.model === undefined ? [] : [options.model]),
      ...(options.models ?? []),
    ]),
  ].filter((id) => !(liveKnown && id.endsWith(':free') && !liveById.has(id)));
  const models: OfferedModel[] = configured.map((id) => {
    const facts = liveById.get(id);
    return facts === undefined
      ? { id, kind: 'configured' }
      : {
          id,
          kind: 'configured',
          name: facts.name,
          contextLength: facts.contextLength,
          structuredOutputs: facts.structuredOutputs,
        };
  });
  for (const model of live?.models ?? []) {
    if (configured.includes(model.id)) continue;
    models.push({
      id: model.id,
      kind: 'live',
      name: model.name,
      contextLength: model.contextLength,
      structuredOutputs: model.structuredOutputs,
    });
  }
  return {
    version: 1,
    default: options.model,
    defaultEffort: DEFAULT_CALL_EFFORT,
    efforts: CALL_EFFORT_LEVELS,
    models,
    fetchedAt: live?.fetchedAt ?? 0,
    ...(live?.error === undefined ? {} : { error: live.error }),
  };
}

export function createHandler(options: HandlerOptions) {
  const maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
  const batches = createBatchRoutes(options);

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.startsWith('/artifacts/')) {
      return options.codeRuntime?.serveArtifact(url) ?? json({ error: 'Artifact not found.' }, 404);
    }
    if (request.method === 'GET' && url.pathname === MODELS_PATH) {
      if (!authorized(request, options.authToken)) return json({ error: 'Unauthorized.' }, 401);
      return json(await modelsListing(options));
    }
    if (isBatchPath(url.pathname)) return batches(request, url);
    if (request.method !== 'POST') {
      return json({ error: 'Use POST.' }, 405);
    }
    if (!authorized(request, options.authToken)) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    const read = await readJsonBody(request, maxRequestBytes);
    if ('error' in read) return json({ error: read.error }, read.status);
    const body = read.body;
    if (url.pathname === '/v1/code/compile') {
      return compileResponse(body, options, request.signal);
    }
    if (url.pathname === '/v1/code/export') {
      return exportResponse(body, options, request.signal);
    }
    if (url.pathname === '/v1/agent/run') {
      return authoredRunResponse(body, options, request);
    }
    if (url.pathname === ENHANCE_PATH) {
      return enhanceResponse(body, options, request);
    }
    if (url.pathname !== '/plan' && url.pathname !== '/') {
      return json({ error: 'Endpoint not found.' }, 404);
    }
    const call = await readPlanCall(request.headers, body, options);
    if ('error' in call) return json({ error: call.error }, call.status);
    const { wire, run } = call;

    const wantsStream = (request.headers.get('accept') ?? '').includes('text/event-stream');
    return wantsStream ? streamed(wire, run, request.signal) : unary(wire, run, request.signal);
  };
}

async function authoredRunResponse(
  body: unknown,
  options: HandlerOptions,
  request: Request,
): Promise<Response> {
  if (!isAuthoredRunRequest(body)) {
    return json({ error: 'Expected an authored run request of version 1.' }, 400);
  }
  if (options.authoredRuns === undefined) {
    return json({ error: 'Authored Agent runs are not enabled on this server.' }, 503);
  }
  const wantsStream = (request.headers.get('accept') ?? '').includes('text/event-stream');
  if (!wantsStream) {
    try {
      return json(await options.authoredRuns.run(body, { signal: request.signal }));
    } catch (cause) {
      return authoredRunFailure(cause);
    }
  }
  return streamAuthoredRun(body, options.authoredRuns, request.signal);
}

function streamAuthoredRun(
  body: AuthoredRunRequest,
  coordinator: AuthoredRunCoordinator,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: 'unit' | 'result', data: unknown): void => {
        controller.enqueue(encoder.encode(frame(event, data)));
      };
      try {
        const result = await coordinator.run(body, {
          signal,
          onUnit: (unit) => {
            send('unit', unit);
          },
        });
        send('result', result);
      } catch (cause) {
        send('result', {
          version: 1,
          runId: body.runId,
          error:
            cause instanceof Error && cause.name === 'AbortError'
              ? 'Run stopped.'
              : 'The authored Agent run failed.',
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    },
  });
}

function authoredRunFailure(cause: unknown): Response {
  if (cause instanceof Error && cause.name === 'AbortError') {
    return new Response(null, { status: 499 });
  }
  if (
    cause instanceof Error &&
    /active mutating run|two writers|Concurrency/u.test(cause.message)
  ) {
    return json({ error: cause.message.slice(0, 1_000) }, 409);
  }
  return json({ error: 'The authored Agent run failed.' }, 502);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRuntimeSnapshot(value: unknown): value is RuntimeSnapshot {
  if (!isRecord(value) || !isRecord(value['project']) || !isRecord(value['inputs'])) return false;
  const project = value['project'];
  return (
    typeof value['projectId'] === 'string' &&
    typeof value['pageId'] === 'string' &&
    typeof value['address'] === 'string' &&
    typeof value['entry'] === 'string' &&
    project['formatVersion'] === 1 &&
    project['runtimeProfile'] === 'craftkit-react-v1' &&
    typeof project['revision'] === 'string' &&
    isRecord(project['files']) &&
    isRecord(project['dependencyLock'])
  );
}

function isExportPage(value: unknown): value is ExportPage {
  if (!isRuntimeSnapshot(value)) return false;
  const page = value as unknown as Record<string, unknown>;
  return (
    typeof page['title'] === 'string' &&
    typeof page['description'] === 'string' &&
    (page['canonicalUrl'] === undefined || typeof page['canonicalUrl'] === 'string') &&
    (page['language'] === undefined || typeof page['language'] === 'string') &&
    (page['direction'] === undefined || page['direction'] === 'ltr' || page['direction'] === 'rtl')
  );
}

async function compileResponse(
  body: unknown,
  options: HandlerOptions,
  signal: AbortSignal,
): Promise<Response> {
  if (!isRecord(body) || !isRuntimeSnapshot(body['snapshot'])) {
    return json({ error: 'Expected a versioned code runtime snapshot.' }, 400);
  }
  if (options.codeRuntime === undefined) {
    return json({ error: 'The code runtime is not enabled on this server.' }, 503);
  }
  try {
    return json(await options.codeRuntime.compile(body['snapshot'], signal));
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError')
      return new Response(null, { status: 499 });
    return json(
      {
        ok: false,
        diagnostics: [
          {
            code: 'compile-failed',
            severity: 'error',
            message: cause instanceof Error ? cause.message.slice(0, 4_000) : 'Compilation failed.',
          },
        ],
      },
      422,
    );
  }
}

async function exportResponse(
  body: unknown,
  options: HandlerOptions,
  signal: AbortSignal,
): Promise<Response> {
  if (
    !isRecord(body) ||
    !Array.isArray(body['pages']) ||
    !body['pages'].every(isExportPage) ||
    !Array.isArray(body['artifactIds']) ||
    !body['artifactIds'].every((artifactId) => typeof artifactId === 'string')
  ) {
    return json({ error: 'Expected versioned export pages and artifact ids.' }, 400);
  }
  if (options.codeRuntime === undefined) {
    return json({ error: 'The code runtime is not enabled on this server.' }, 503);
  }
  try {
    const result = await options.codeRuntime.export(body['pages'], body['artifactIds'], signal);
    return json(result, result.ok ? 200 : 409);
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError')
      return new Response(null, { status: 499 });
    return json({ error: 'The isolated export worker failed.' }, 502);
  }
}

/**
 * `POST /v1/prompt/enhance` (enhance.ts has the contract). The same door as
 * the plan: bearer and body limits were checked before routing, and every
 * failure leaves in the plan endpoint's envelope and statuses — 400 a
 * malformed request, 422 the model's refusal, 502 an answer that was not an
 * enhancement, 504 the enhancer's own cap, 499 a caller that hung up, and a
 * backend's own sentence and status as the plan gives them.
 *
 * The model is never the picker's: the header names the model a person chose
 * for BUILDING, and an enhancement is a small call they wait on.
 */
/**
 * The enhancer's cap when none is configured: 40 s, inside the 45 s the
 * builder client waits (remote-provider.ts, DEFAULT_ENHANCE_TIMEOUT_MS). At
 * the contract's 60 s the client always hung up first, and the panel could
 * only say "took longer than allowed" while this server — the side that knows
 * why — was still waiting. Never longer than enhance.ts's own cap.
 */
const ENHANCE_SERVER_TIMEOUT_MS = Math.min(ENHANCE_TIMEOUT_MS, 40_000);

async function enhanceResponse(
  body: unknown,
  options: HandlerOptions,
  request: Request,
): Promise<Response> {
  const read = readEnhanceRequest(body);
  if ('error' in read) return json({ error: read.error }, 400);
  const timeoutMs = options.enhanceTimeoutMs ?? ENHANCE_SERVER_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = request.signal;
  const model = enhancerModelFor(options, pickedModel(request.headers)); // the picked route's fastest
  try {
    const outcome = await enhancePrompt(read.request, {
      client: options.client,
      signal: AbortSignal.any([requestSignal, timeout]),
      ...(model === undefined ? {} : { model }),
      ...(options.onAnswer === undefined ? {} : { onAnswer: options.onAnswer }),
      ...(options.onLog === undefined ? {} : { onLog: options.onLog }),
    });
    if (outcome.kind === 'refusal') return json({ error: outcome.message }, 422);
    if (outcome.kind === 'invalid-output') return json({ error: outcome.message }, 502);
    reportUsage(options, outcome.usage, 'enhance');
    return json(outcome.response);
  } catch (cause) {
    if (timeout.aborted && !requestSignal.aborted) {
      return json(
        {
          error: `Improving the request took longer than ${String(Math.round(timeoutMs / 1000))} s, so it was stopped; send the request as written.`,
        },
        504,
      );
    }
    return errorResponse(cause);
  }
}

function taskOf(wire: AiPlanWireRequest): UsageTask {
  return wire.task ?? 'plan';
}

/**
 * The one answer both transports send: an `AiPlan` (or a page plan for
 * `task: 'page-plan'`), a refusal, or the versioned invalid-output report —
 * the shapes `remote-provider` reads, and nothing else.
 */
async function answer(
  wire: AiPlanWireRequest,
  options: HandlerOptions,
  signal: AbortSignal,
  onProgress?: (text: string) => void,
  onDraft?: (draft: AnswerDraft) => void,
): Promise<Answered> {
  let measured: UsageReport | undefined;
  const call: ClaudeOptions = {
    client: options.client,
    signal,
    onUsage: (usage) => {
      measured = usage;
    },
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
    ...(options.onAnswer === undefined ? {} : { onAnswer: options.onAnswer }),
    ...(options.onLog === undefined ? {} : { onLog: options.onLog }),
    ...callEffort(wire, options),
    ...(onProgress === undefined ? {} : { onProgress }),
    ...(onDraft === undefined ? {} : { onDraft }),
  };
  // A plan, a page plan, or a site plan (T230), by the request's task.
  const outcome = await proposerFor(wire)(wire, call);
  return answerBody(outcome, measured);
}

async function unary(
  wire: AiPlanWireRequest,
  options: HandlerOptions,
  signal: AbortSignal,
): Promise<Response> {
  try {
    const answered = await answer(wire, options, signal);
    if (answered.usage !== undefined) reportUsage(options, answered.usage, taskOf(wire));
    const response = json(answered.body);
    if (answered.usage !== undefined) {
      response.headers.set('x-craftkit-ai-usage', JSON.stringify(answered.usage));
      response.headers.set('access-control-expose-headers', 'x-craftkit-ai-usage');
    }
    return response;
  } catch (cause) {
    return errorResponse(cause);
  }
}

/**
 * The streaming answer.
 *
 * Worth the extra code for one reason: a plan takes tens of seconds and a
 * silent wait of that length reads as a hang. `status` frames carry bounded
 * public lifecycle phases observed by the adapter, never private reasoning.
 */
function streamed(wire: AiPlanWireRequest, options: HandlerOptions, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: FrameEvent, data: unknown): void => {
        controller.enqueue(encoder.encode(frame(event, data)));
      };
      const drafts =
        wire.task === 'page-plan' && options.planDrafts !== false
          ? createDraftFrames((data) => {
              /*
                A timer may flush after the client hung up (the stream is
                cancelled, enqueue throws); a draft nobody reads is no failure,
                and a throw from a timer would take the server down.
              */
              try {
                send('draft', data);
              } catch {
                // The reader is gone.
              }
            })
          : undefined;
      try {
        const answered = await answer(
          wire,
          options,
          signal,
          (text) => {
            send('status', { text });
          },
          drafts?.take,
        );
        if (answered.usage !== undefined) reportUsage(options, answered.usage, taskOf(wire));
        if (answered.usage !== undefined) send('usage', answered.usage);
        // Every draft before the one result, never after it.
        drafts?.flush();
        send('result', answered.body);
      } catch (cause) {
        /* The status line is spent: the status rides an `error` frame (a 429 stays retryable,
           a key problem terminal), then the invalid-output result an older client still reads. */
        drafts?.flush();
        const { status } = errorResponse(cause);
        if (status !== 499) send('error', { status, message: describeFailure(cause) });
        send('result', invalidOutputBody(describeFailure(cause)));
      } finally {
        drafts?.dispose();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    },
  });
}

/** Coalescing for `draft` frames: one frame per this many ms, at most. */
export const DRAFT_FLUSH_MS = 100;
/** …or as soon as this many characters wait, whichever comes first. */
export const DRAFT_FLUSH_CHARS = 512;

interface DraftFrames {
  /** The `onDraft` the model call reports to. */
  readonly take: (draft: AnswerDraft) => void;
  /** Sends whatever text waits, now. */
  readonly flush: () => void;
  /** Stops the timer; nothing more is sent. */
  readonly dispose: () => void;
}

/**
 * Coalesces a model's text deltas — dozens a second, a few characters each
 * — into `draft` frames: flushed every `DRAFT_FLUSH_MS`, or at
 * `DRAFT_FLUSH_CHARS` waiting. A reset drops the text not yet sent (it
 * belongs to an answer that was abandoned) and is sent as `{reset: true}`.
 */
function createDraftFrames(send: (data: unknown) => void): DraftFrames {
  let waiting = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const stopTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const flush = (): void => {
    stopTimer();
    if (disposed || waiting === '') return;
    const text = waiting;
    waiting = '';
    send({ text });
  };
  return {
    take: (draft) => {
      if (disposed) return;
      if ('reset' in draft) {
        stopTimer();
        waiting = '';
        send({ reset: true });
        return;
      }
      if (draft.text === '') return;
      waiting += draft.text;
      if (waiting.length >= DRAFT_FLUSH_CHARS) {
        flush();
        return;
      }
      timer ??= setTimeout(flush, DRAFT_FLUSH_MS);
    },
    flush,
    dispose: () => {
      disposed = true;
      stopTimer();
      waiting = '';
    },
  };
}
