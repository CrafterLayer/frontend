import Anthropic from '@anthropic-ai/sdk';

import { AI_PLAN_WIRE_VERSION, type AiPlanWireRequest } from '@craftkit/builder/wire';
import type { ExportPage, RuntimeSnapshot } from '@craftkit/builder/code-runtime';

import { proposePagePlan, proposePlan, type ClaudeOptions, type UsageReport } from './claude';
import type { CodeRuntimeService } from './code-runtime-service';
import { ENHANCE_PATH, ENHANCE_TIMEOUT_MS, enhancePrompt, readEnhanceRequest } from './enhance';
import { fastestModel } from './model-policy';
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
  readonly maxTokens?: number;
  /** Bearer token required on every request. Omitted ⇒ no auth (local only). */
  readonly authToken?: string;
  /** Largest request body accepted, in bytes. */
  readonly maxRequestBytes?: number;
  /** Receives one line per completed request; `task` says which endpoint's call it was. */
  readonly onUsage?: (
    report: UsageReport & { readonly cachedShare: number; readonly task?: UsageTask },
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

/** SSE frame. `status` narrates; exactly one `result` ends the stream. */
function frame(event: 'status' | 'unit' | 'result', data: unknown): string {
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
 * Two places may name it (2026-09-28). The header is the picker's standing
 * choice for every call of a provider; the body's `model` is ONE call's —
 * the fast model a host names for a small edit (the fast-edits contract:
 * `RunAiAgentOptions.editModel`), while page builds keep the picker's. The
 * call's own wins, under the same allowlist.
 */
function resolveModel(
  request: Request,
  wire: AiPlanWireRequest,
  options: HandlerOptions,
): { readonly model: string | undefined } | { readonly refused: string } {
  const perCall: unknown = (wire as { model?: unknown }).model;
  if (perCall !== undefined && typeof perCall !== 'string') {
    return { refused: 'The request\'s "model" must be a model name.' };
  }
  const called = (perCall ?? '').trim();
  const named = called !== '' ? called : (request.headers.get(MODEL_HEADER) ?? '').trim();
  if (named === '') return { model: options.model };
  /*
    Match by the model's name WITHOUT its `cli:` prefix, and answer with the
    server's own spelling. 2026-09-30: the playground lists `cli:haiku` while
    this server's .env allows `haiku`; the panel started sending its edit model
    on every call, and every request came back 400 — the owner saw «حدث خطأ غير
    متوقع» on everything. Both spellings name the same CLI model.
  */
  const bare = (name: string): string => name.replace(/^cli:/u, '');
  const allowed = [...(options.model === undefined ? [] : [options.model]), ...(options.models ?? [])];
  const match = allowed.find((entry) => entry === named) ?? allowed.find((entry) => bare(entry) === bare(named));
  if (match !== undefined) return { model: match };
  return { refused: `Model "${named}" is not one this server allows.` };
}

/**
 * The reasoning budgets ONE call may ask for in its body's `effort`
 * (2026-09-28, the fast-edits contract's `editEffort`): the two a small edit
 * needs, never more — a browser must not raise the thinking bill any more
 * than it may pick the model.
 */
const CALL_EFFORTS: ReadonlySet<unknown> = new Set(['low', 'medium']);

/**
 * The header a call may name its budget in instead (2026-09-28). The
 * fast-edits contract says a provider names the edit model "the way the model
 * picker does" — `MODEL_HEADER` — and a provider that sets headers per call
 * sets the budget beside it. The body's `effort` wins; both are held to
 * `CALL_EFFORTS`. `cors.ts` echoes the preflight's requested headers, so a
 * browser may send it with no CORS change.
 */
export const EFFORT_HEADER = 'x-craftkit-ai-effort';

/** The budget one call asked for — its body's, else its header's — or undefined. */
function askedEffort(request: Request, wire: AiPlanWireRequest): unknown {
  const inBody: unknown = (wire as { effort?: unknown }).effort;
  if (inBody !== undefined) return inBody;
  const inHeader = (request.headers.get(EFFORT_HEADER) ?? '').trim();
  return inHeader === '' ? undefined : inHeader;
}

export function createHandler(options: HandlerOptions) {
  const maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.startsWith('/artifacts/')) {
      return options.codeRuntime?.serveArtifact(url) ?? json({ error: 'Artifact not found.' }, 404);
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
      return enhanceResponse(body, options, request.signal);
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

    const chosen = resolveModel(request, body, options);
    if ('refused' in chosen) {
      return json({ error: chosen.refused }, 400);
    }
    const effort = askedEffort(request, body);
    if (effort !== undefined && !CALL_EFFORTS.has(effort)) {
      return json(
        {
          error: `Effort ${JSON.stringify(effort).slice(0, 40)} is not one a call may ask for (low or medium).`,
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
  requestSignal: AbortSignal,
): Promise<Response> {
  const read = readEnhanceRequest(body);
  if ('error' in read) return json({ error: read.error }, 400);
  const timeoutMs = options.enhanceTimeoutMs ?? ENHANCE_SERVER_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(timeoutMs);
  const model = options.enhanceModel ?? fastestModel([options.model, ...(options.models ?? [])]);
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
  const billedInput = usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
  options.onUsage({
    ...usage,
    // The number worth watching: a cached share near zero means a silent
    // invalidator got into the prefix and the catalog is being re-billed.
    cachedShare: billedInput === 0 ? 0 : usage.cacheReadTokens / billedInput,
    task,
  });
}

/** The skill a build pins on every section writer (run-build.ts). */
const SECTION_WRITER_SKILL = 'craftkit.build-fill';

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
  // The body's budget never reaches a page plan; its thinking is the deployment's choice (planThinking).
  if (wire.task === 'page-plan') return options.planThinking === true ? {} : { thinkingOff: true };
  // The call's own budget, already held to CALL_EFFORTS by the handler.
  const asked: unknown = (wire as { effort?: unknown }).effort;
  const writesASection = (wire.context.skills ?? []).some((pin) => pin.id === SECTION_WRITER_SKILL);
  /*
    Thinking off for a section writer (the skeleton already decided its
    design) and for any call that asked for `low`. Measured 2026-09-30 on
    cli:haiku with thinking on at effort low: 8,001-20,747 output tokens for a
    1.1k-2.7k-character section, 49 s-3 min each — over 85% of it thinking.
  */
  const thinkingOff = writesASection || asked === 'low';
  const off = thinkingOff ? ({ thinkingOff: true } as const) : {};
  if (asked === 'low' || asked === 'medium') return { effort: asked, ...off };
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
): Promise<Answered> {
  const call: ClaudeOptions = {
    client: options.client,
    signal,
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
    ...(options.onAnswer === undefined ? {} : { onAnswer: options.onAnswer }),
    ...(options.onLog === undefined ? {} : { onLog: options.onLog }),
    ...callEffort(wire, options),
    ...(onProgress === undefined ? {} : { onProgress }),
  };
  if (wire.task === 'page-plan') {
    const outcome = await proposePagePlan(wire, call);
    if (outcome.kind === 'refusal') return { body: refusalBody(outcome.message) };
    if (outcome.kind === 'invalid-output') return { body: invalidOutputBody(outcome.message) };
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
  if (outcome.kind === 'refusal') return { body: refusalBody(outcome.message) };
  if (outcome.kind === 'invalid-output') return { body: invalidOutputBody(outcome.message) };
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
    return json(answered.body);
  } catch (cause) {
    return errorResponse(cause);
  }
}

/**
 * The streaming answer.
 *
 * Worth the extra code for one reason: a plan takes tens of seconds and a
 * silent wait of that length reads as a hang. `status` frames carry Claude's
 * own reasoning summary, so the narration is what the model is actually
 * considering rather than a spinner's worth of invented reassurance.
 */
function streamed(wire: AiPlanWireRequest, options: HandlerOptions, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: 'status' | 'result', data: unknown): void => {
        controller.enqueue(encoder.encode(frame(event, data)));
      };
      try {
        const answered = await answer(wire, options, signal, (text) => {
          send('status', { text });
        });
        if (answered.usage !== undefined) reportUsage(options, answered.usage, taskOf(wire));
        send('result', answered.body);
      } catch (cause) {
        /*
          The stream has already begun, so there is no status code left to
          send. The client's taxonomy still needs an answer, and an
          invalid-output result is the one shape that reaches it here.
        */
        send('result', invalidOutputBody(describeFailure(cause)));
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
