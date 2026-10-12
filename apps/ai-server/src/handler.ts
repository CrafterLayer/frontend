import Anthropic from '@anthropic-ai/sdk';

import { AI_PLAN_WIRE_VERSION, type AiPlanWireRequest } from '@craftkit/builder/wire';
import type { ExportPage, RuntimeSnapshot } from '@craftkit/builder/code-runtime';

import {
  proposePagePlan,
  proposePlan,
  type AnswerDraft,
  type ClaudeOptions,
  type UsageReport,
} from './claude';
import type { CodeRuntimeService } from './code-runtime-service';
import { ENHANCE_PATH, ENHANCE_TIMEOUT_MS, enhancePrompt, readEnhanceRequest } from './enhance';
import type { FreeModelCatalog } from './free-models';
import { enhancerModelFor } from './enhance-route';
import {
  isAuthoredRunRequest,
  type AuthoredRunCoordinator,
  type AuthoredRunRequest,
} from './authored-run';

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
}

const DEFAULT_MAX_REQUEST_BYTES = 4 * 1024 * 1024;

/** Which call a usage line belongs to: a plan, a page plan, or an enhancement. */
export type UsageTask = 'plan' | 'page-plan' | 'enhance';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * A refusal is a 200, not a 4xx.
 *
 * It is an ANSWER — the model considered the request and declined — and the
 * wire has a shape for it that the client turns into a sentence in the chat.
 * Returning 4xx would make `remote-provider` report a transport failure and
 * lose the explanation the user needs.
 */
function refusalBody(message: string): unknown {
  return { version: AI_PLAN_WIRE_VERSION, refusal: message };
}

function invalidOutputBody(message: string): unknown {
  return { version: AI_PLAN_WIRE_VERSION, invalidOutput: { message } };
}

function isWireRequest(value: unknown): value is AiPlanWireRequest {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record['version'] === AI_PLAN_WIRE_VERSION &&
    typeof record['request'] === 'string' &&
    typeof record['context'] === 'object' &&
    record['context'] !== null
  );
}

/** Constant-time-ish comparison, so a wrong token leaks no length information. */
function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let difference = 0;
  for (let at = 0; at < provided.length; at += 1) {
    difference |= provided.charCodeAt(at) ^ expected.charCodeAt(at);
  }
  return difference === 0;
}

function authorized(request: Request, expected: string | undefined): boolean {
  if (expected === undefined || expected === '') return true;
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  return tokenMatches(provided, expected);
}

/**
 * SSE frame. `status` narrates; `draft` carries a page plan's raw text as it
 * is written (`{text}`, or `{reset: true}` when the answer starts over);
 * exactly one `result` ends the stream.
 */
function frame(event: 'status' | 'unit' | 'draft' | 'usage' | 'result', data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * The tasks the plan endpoint answers (`AiPlanWireRequest.task`): absent or
 * `'plan'` is an `AiPlan`, exactly as before 2026-09-28; `'page-plan'` is a
 * page plan (`AiPagePlanWireResponse` in builder-ai's provider/wire.ts).
 */
const KNOWN_TASKS: ReadonlySet<unknown> = new Set(['plan', 'page-plan']);

/** The header a request names its model in. Also granted by `cors.ts` for preflights. */
export const MODEL_HEADER = 'x-craftkit-ai-model';

/**
 * The model this request runs on. The panel may name one; the SERVER decides
 * whether it is allowed, because a public endpoint must not let a browser
 * pick the most expensive model on someone else's key. The configured default
 * is always allowed by name; anything else has to be in `models`.
 *
 * Two places may name it (2026-09-28). The header is the PERSON's choice in
 * the picker; the body's `model` is the fast model a host names for a small
 * edit (the fast-edits contract: `RunAiAgentOptions.editModel`). The person's
 * choice wins (2026-10-08): the owner picked Opus and the log showed every edit
 * running on `haiku, effort low`, because the body used to win. The host's fast
 * model now applies only when the person picked nothing. Same allowlist either way.
 */
async function resolveModel(
  request: Request,
  wire: AiPlanWireRequest,
  options: HandlerOptions,
): Promise<{ readonly model: string | undefined } | { readonly refused: string }> {
  const perCall: unknown = (wire as { model?: unknown }).model;
  if (perCall !== undefined && typeof perCall !== 'string') {
    return { refused: 'The request\'s "model" must be a model name.' };
  }
  const called = (perCall ?? '').trim();
  const picked = pickedModel(request);
  const named = picked !== '' ? picked : called;
  if (named === '') return { model: options.model };
  /*
    Match by the model's name WITHOUT its `cli:` prefix, and answer with the
    server's own spelling. 2026-09-30: the playground lists `cli:haiku` while
    this server's .env allows `haiku`; the panel started sending its edit model
    on every call, and every request came back 400 — the owner saw «حدث خطأ غير
    متوقع» on everything. Both spellings name the same CLI model.
  */
  const bare = (name: string): string => name.replace(/^cli:/u, '');
  const allowed = [
    ...(options.model === undefined ? [] : [options.model]),
    ...(options.models ?? []),
  ];
  const match =
    allowed.find((entry) => entry === named) ??
    allowed.find((entry) => bare(entry) === bare(named));
  if (match !== undefined) return { model: match };
  // A free model OpenRouter lists right now costs nothing, so it needs no place in the owner's list.
  if (named.endsWith(':free') && (await options.freeModels?.has(named)) === true) {
    return { model: named };
  }
  return { refused: `Model "${named}" is not one this server allows.` };
}

/**
 * The reasoning budgets a call may ask for, in the order the picker lists them.
 * Born as a small edit's `low | medium` (2026-09-28, the fast-edits contract's
 * `editEffort`); 2026-10-06 the picker's standing choice joined it, so a person
 * can spend `high`, `xhigh` or `max` on a page build. The model allowlist is
 * still what keeps a browser from picking a bill; the budget only decides how
 * long an allowed model thinks. `medium` is the default everywhere.
 */
export const CALL_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type CallEffort = (typeof CALL_EFFORT_LEVELS)[number];
export const DEFAULT_CALL_EFFORT: CallEffort = 'medium';
const CALL_EFFORTS: ReadonlySet<unknown> = new Set(CALL_EFFORT_LEVELS);
/** The budgets that are asking for depth: thinking stays ON for every call at these. */
const DEEP_EFFORTS: ReadonlySet<unknown> = new Set(['high', 'xhigh', 'max']);

/**
 * The header a call may name its budget in instead (2026-09-28). The
 * fast-edits contract says a provider names the edit model "the way the model
 * picker does" — `MODEL_HEADER` — and a provider that sets headers per call
 * sets the budget beside it. The body's `effort` wins; both are held to
 * `CALL_EFFORTS`. `cors.ts` echoes the preflight's requested headers, so a
 * browser may send it with no CORS change.
 */
export const EFFORT_HEADER = 'x-craftkit-ai-effort';

/** The model the person picked in the panel's picker (the header), or ''. */
function pickedModel(request: Request): string {
  return (request.headers.get(MODEL_HEADER) ?? '').trim();
}

/**
 * The budget one call asked for, or undefined. When the person picked a model,
 * the whole call is theirs: their header budget (or the default), never the
 * host's small-edit `effort` in the body, which belongs to the host's fast
 * model (2026-10-08, the owner's Opus edits ran at `effort low`). With no pick,
 * the body's budget, else the header's.
 */
function askedEffort(request: Request, wire: AiPlanWireRequest): unknown {
  const inHeader = (request.headers.get(EFFORT_HEADER) ?? '').trim();
  if (pickedModel(request) !== '') return inHeader === '' ? undefined : inHeader;
  const inBody: unknown = (wire as { effort?: unknown }).effort;
  if (inBody !== undefined) return inBody;
  return inHeader === '' ? undefined : inHeader;
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

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.startsWith('/artifacts/')) {
      return options.codeRuntime?.serveArtifact(url) ?? json({ error: 'Artifact not found.' }, 404);
    }
    if (request.method === 'GET' && url.pathname === MODELS_PATH) {
      if (!authorized(request, options.authToken)) return json({ error: 'Unauthorized.' }, 401);
      return json(await modelsListing(options));
    }
    if (request.method !== 'POST') {
      return json({ error: 'Use POST.' }, 405);
    }
    if (!authorized(request, options.authToken)) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    const declared = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > maxRequestBytes) {
      return json({ error: 'Request too large.' }, 413);
    }

    let body: unknown;
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > maxRequestBytes) {
        return json({ error: 'Request too large.' }, 413);
      }
      body = JSON.parse(text) as unknown;
    } catch {
      return json({ error: 'Body is not JSON.' }, 400);
    }
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
    if (!isWireRequest(body)) {
      return json(
        { error: `Expected an AiPlanWireRequest of version ${String(AI_PLAN_WIRE_VERSION)}.` },
        400,
      );
    }

    /*
      An unknown task is refused, not answered as a plan: a newer client asking
      for something this server has never heard of would read a plan as
      garbage — or, worse, as the thing it asked for. 400 is terminal, so
      nothing retries it.
    */
    const task: unknown = body.task;
    if (task !== undefined && !KNOWN_TASKS.has(task)) {
      const named =
        typeof task === 'string' ? task.slice(0, 60) : JSON.stringify(task).slice(0, 60);
      return json({ error: `Unknown task "${named}".` }, 400);
    }

    /*
      The composer's free-code switch (2026-10-09) is a mode, so it is a
      boolean or absent; like `task` and `effort`, anything else is refused. A
      client that sends "true" thinks it asked, and a prompt without the card
      would answer as if it had not. `buildPrompt` reads it with `=== true`
      and nothing more.
    */
    const freeCode: unknown = body.freeCode;
    if (freeCode !== undefined && typeof freeCode !== 'boolean') {
      return json({ error: 'freeCode must be true or false when present.' }, 400);
    }

    const chosen = await resolveModel(request, body, options);
    if ('refused' in chosen) {
      return json({ error: chosen.refused }, 400);
    }
    const effort = askedEffort(request, body);
    if (effort !== undefined && !CALL_EFFORTS.has(effort)) {
      return json(
        {
          error:
            `Effort ${JSON.stringify(effort).slice(0, 40)} is not one a call may ask for ` +
            `(${CALL_EFFORT_LEVELS.join(', ')}).`,
        },
        400,
      );
    }
    const run: HandlerOptions = {
      ...options,
      ...(chosen.model === undefined ? {} : { model: chosen.model }),
    };
    // One place `callEffort` reads the call's budget from, wherever it was named.
    const wire: AiPlanWireRequest =
      effort === undefined ? body : ({ ...body, effort } as AiPlanWireRequest);

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
  const model = enhancerModelFor(options, pickedModel(request)); // the picked route's fastest
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

function reportUsage(options: HandlerOptions, usage: UsageReport, task: UsageTask): void {
  if (options.onUsage === undefined) return;
  const billedInput =
    usage.inputTokens === null || usage.cacheWriteTokens === null || usage.cacheReadTokens === null
      ? null
      : usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
  try {
    options.onUsage({
      ...usage,
      // The number worth watching: a cached share near zero means a silent invalidator got into the prefix and the catalog is being re-billed.
      cachedShare:
        billedInput === null || usage.cacheReadTokens === null
          ? null
          : billedInput === 0
            ? 0
            : usage.cacheReadTokens / billedInput,
      task,
    });
  } catch {
    /* Telemetry must not turn a valid answer into a failure. */
  }
}

/** The skill a build pins on every section writer (run-build.ts). */
const SECTION_WRITER_SKILL = 'craftkit.build-fill';
/** The skill a build pins on its scaffold call — the fallback after a refused page plan (run-build.ts). */
const SCAFFOLD_SKILL = 'craftkit.build-scaffold';

/**
 * This call's own reasoning budget: the one its body asks for (low or
 * medium, a small edit's), else the section budget for a section writer,
 * else none. A page plan is a PLANNING call — the design every section writer
 * then builds from — so a body budget or a pinned writer skill never changes
 * it; it runs with thinking OFF unless the deployment sets `planThinking`. Measured live 2026-09-28 (cli:haiku at the
 * deployment's `medium`): 6,341–12,435 output tokens for a 2.0k–3.3k-character
 * plan, most of it thinking — so effort IS this call's speed lever, and
 * lowering it is a deliberate deployment choice, never a side effect of a pin.
 */
function callEffort(
  wire: AiPlanWireRequest,
  options: HandlerOptions,
): { effort?: string; thinkingOff?: true } {
  // The call's own budget, already held to CALL_EFFORTS by the handler.
  const asked: unknown = (wire as { effort?: unknown }).effort;
  const deep = DEEP_EFFORTS.has(asked);
  /*
    The body's budget never reaches a page plan; its thinking is the deployment's choice
    (planThinking) — unless the person asked for depth (`high` and up): then the plan
    thinks, at the budget they named. Their picker is the only thing that sends those.
  */
  if (wire.task === 'page-plan') {
    if (deep) return { effort: asked as string };
    return options.planThinking === true ? {} : { thinkingOff: true };
  }
  const pins = wire.context.skills ?? [];
  const writesASection = pins.some((pin) => pin.id === SECTION_WRITER_SKILL);
  const scaffoldsABuild = pins.some((pin) => pin.id === SCAFFOLD_SKILL);
  /*
    Thinking off for a section writer (the skeleton already decided its
    design), for a build's scaffold call, and for any call that asked for
    `low`. Measured 2026-09-30 on cli:haiku with thinking on at effort low:
    8,001-20,747 output tokens for a 1.1k-2.7k-character section, 49 s-3 min
    each — over 85% of it thinking. The scaffold is the fallback after a
    refused page plan; with thinking on (2026-10-05) one took 3:28 and 22,035
    output tokens, so any T1 failure made the build slower than the old
    221 s baseline. It is a planning call like the page plan, which already
    runs with thinking off.
  */
  const thinkingOff = !deep && (writesASection || scaffoldsABuild || asked === 'low');
  const off = thinkingOff ? ({ thinkingOff: true } as const) : {};
  if (CALL_EFFORTS.has(asked)) return { effort: asked as string, ...off };
  if (options.sectionEffort === undefined || !writesASection) return off;
  return { effort: options.sectionEffort, ...off };
}

function taskOf(wire: AiPlanWireRequest): UsageTask {
  return wire.task === 'page-plan' ? 'page-plan' : 'plan';
}

/** What one request answers on the wire, and what it cost when the model produced it. */
interface Answered {
  readonly body: unknown;
  readonly usage?: UsageReport;
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
  if (wire.task === 'page-plan') {
    const outcome = await proposePagePlan(wire, call);
    if (outcome.kind === 'refusal')
      return {
        body: refusalBody(outcome.message),
        ...(measured === undefined ? {} : { usage: measured }),
      };
    if (outcome.kind === 'invalid-output')
      return {
        body: invalidOutputBody(outcome.message),
        ...(measured === undefined ? {} : { usage: measured }),
      };
    return {
      body: {
        version: AI_PLAN_WIRE_VERSION,
        ...(outcome.rationale === undefined ? {} : { rationale: outcome.rationale }),
        pagePlan: outcome.pagePlan,
      },
      usage: outcome.usage,
    };
  }
  const outcome = await proposePlan(wire, call);
  if (outcome.kind === 'refusal')
    return {
      body: refusalBody(outcome.message),
      ...(measured === undefined ? {} : { usage: measured }),
    };
  if (outcome.kind === 'invalid-output')
    return {
      body: invalidOutputBody(outcome.message),
      ...(measured === undefined ? {} : { usage: measured }),
    };
  return { body: outcome.plan, usage: outcome.usage };
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
      const send = (event: 'status' | 'draft' | 'usage' | 'result', data: unknown): void => {
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
        /*
          The stream has already begun, so there is no status code left to
          send. The client's taxonomy still needs an answer, and an
          invalid-output result is the one shape that reaches it here.
        */
        drafts?.flush();
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

/**
 * A server started with no credentials at all. The SDK reports this as a
 * plain Error at request time — not an AuthenticationError (that is a 401
 * from the API for a WRONG key) — so it is matched by its message. Without
 * this the panel showed "failed unexpectedly", which told the owner nothing.
 */
export const NO_CREDENTIALS_MESSAGE =
  'The assistant server has no credentials: set ANTHROPIC_API_KEY (apps/ai-server/.env) and restart it.';

function isMissingCredentials(cause: unknown): boolean {
  return (
    cause instanceof Error && cause.message.startsWith('Could not resolve authentication method')
  );
}

/**
 * The non-SDK backends write their own owner-facing sentences — the dev CLI's
 * timeout with its length or a missing `claude`; OpenRouter's rejected key,
 * empty balance, or unknown model slug. They are authored text, not SDK prose
 * and not stacks, so they pass through as they are. Matched by `name` rather
 * than by import: the contract layer must not depend on either backend module.
 */
const BACKEND_ERROR_NAMES: ReadonlySet<string> = new Set([
  'CliBackendError',
  'OpenRouterBackendError',
]);

function isBackendFailure(cause: unknown): cause is Error {
  return cause instanceof Error && BACKEND_ERROR_NAMES.has(cause.name);
}

/**
 * A backend that knows whether its failure is retryable says so with an
 * `httpStatus`; one that does not gets the retryable default, since a dev CLI
 * dying mid-plan is worth one more try.
 */
function backendStatusOf(cause: Error): number {
  const status: unknown = (cause as Error & { httpStatus?: unknown }).httpStatus;
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 502;
}

/** One plain sentence per failure kind — never a stack, never a raw SDK message. */
function describeFailure(cause: unknown): string {
  if (isBackendFailure(cause)) {
    return cause.message;
  }
  if (cause instanceof Anthropic.RateLimitError) {
    return 'The assistant is rate limited right now. Try again in a moment.';
  }
  if (cause instanceof Anthropic.AuthenticationError) {
    return 'The assistant server is not configured with a valid API key.';
  }
  if (isMissingCredentials(cause)) {
    return NO_CREDENTIALS_MESSAGE;
  }
  if (cause instanceof Anthropic.BadRequestError) {
    return 'The assistant rejected this request as malformed.';
  }
  if (cause instanceof Anthropic.APIConnectionError) {
    return 'The assistant could not be reached. Check the connection and try again.';
  }
  if (cause instanceof Anthropic.APIError) {
    return 'The assistant service failed to answer.';
  }
  return 'The assistant server failed unexpectedly.';
}

/**
 * HTTP status carries the RETRYABILITY, which is the part the client acts on:
 * `remote-provider` maps 429 and 5xx to retryable and 4xx to terminal.
 */
function errorResponse(cause: unknown): Response {
  if (cause instanceof Error && cause.name === 'AbortError') {
    // The caller hung up. Nothing to send; nothing to log as a failure.
    return new Response(null, { status: 499 });
  }
  const message = describeFailure(cause);
  if (isBackendFailure(cause)) return json({ error: message }, backendStatusOf(cause));
  if (cause instanceof Anthropic.RateLimitError) return json({ error: message }, 429);
  if (cause instanceof Anthropic.AuthenticationError || isMissingCredentials(cause)) {
    return json({ error: message }, 500);
  }
  if (cause instanceof Anthropic.BadRequestError) return json({ error: message }, 400);
  return json({ error: message }, 502);
}
