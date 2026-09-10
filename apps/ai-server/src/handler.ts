import Anthropic from '@anthropic-ai/sdk';

import { AI_PLAN_WIRE_VERSION, type AiPlanWireRequest } from '@craftkit/builder/wire';
import type { ExportPage, RuntimeSnapshot } from '@craftkit/builder/code-runtime';

import { proposePlan, type UsageReport } from './claude';
import type { CodeRuntimeService } from './code-runtime-service';
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
  /** Receives one line per completed request. */
  readonly onUsage?: (report: UsageReport & { readonly cachedShare: number }) => void;
  /** Receives every answer's raw text before it is parsed; for the owner's log. */
  readonly onAnswer?: (text: string) => void;
  /** Isolated compiler/prerender boundary. Omitted deployments keep the legacy plan endpoint only. */
  readonly codeRuntime?: CodeRuntimeService;
  readonly authoredRuns?: AuthoredRunCoordinator;
}

const DEFAULT_MAX_REQUEST_BYTES = 4 * 1024 * 1024;

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
function refusal(message: string): Response {
  return json({ version: AI_PLAN_WIRE_VERSION, refusal: message });
}

function invalidOutput(message: string): Response {
  return json({ version: AI_PLAN_WIRE_VERSION, invalidOutput: { message } });
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

/** The header a request names its model in. Also granted by `cors.ts` for preflights. */
export const MODEL_HEADER = 'x-craftkit-ai-model';

/**
 * The model this request runs on. The panel may name one; the SERVER decides
 * whether it is allowed, because a public endpoint must not let a browser
 * pick the most expensive model on someone else's key. The configured default
 * is always allowed by name; anything else has to be in `models`.
 */
function resolveModel(
  request: Request,
  options: HandlerOptions,
): { readonly model: string | undefined } | { readonly refused: string } {
  const named = (request.headers.get(MODEL_HEADER) ?? '').trim();
  if (named === '') return { model: options.model };
  if (named === options.model || (options.models ?? []).includes(named)) return { model: named };
  return { refused: `Model "${named}" is not one this server allows.` };
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
    if (url.pathname !== '/plan' && url.pathname !== '/') {
      return json({ error: 'Endpoint not found.' }, 404);
    }
    if (!isWireRequest(body)) {
      return json(
        { error: `Expected an AiPlanWireRequest of version ${String(AI_PLAN_WIRE_VERSION)}.` },
        400,
      );
    }

    const chosen = resolveModel(request, options);
    if ('refused' in chosen) {
      return json({ error: chosen.refused }, 400);
    }
    const run: HandlerOptions = {
      ...options,
      ...(chosen.model === undefined ? {} : { model: chosen.model }),
    };

    const wantsStream = (request.headers.get('accept') ?? '').includes('text/event-stream');
    return wantsStream ? streamed(body, run, request.signal) : unary(body, run, request.signal);
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

function reportUsage(options: HandlerOptions, usage: UsageReport): void {
  if (options.onUsage === undefined) return;
  const billedInput = usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
  options.onUsage({
    ...usage,
    // The number worth watching: a cached share near zero means a silent
    // invalidator got into the prefix and the catalog is being re-billed.
    cachedShare: billedInput === 0 ? 0 : usage.cacheReadTokens / billedInput,
  });
}

async function unary(
  wire: AiPlanWireRequest,
  options: HandlerOptions,
  signal: AbortSignal,
): Promise<Response> {
  try {
    const outcome = await proposePlan(wire, {
      client: options.client,
      signal,
      ...(options.model === undefined ? {} : { model: options.model }),
      ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
      ...(options.onAnswer === undefined ? {} : { onAnswer: options.onAnswer }),
    });
    if (outcome.kind === 'refusal') return refusal(outcome.message);
    if (outcome.kind === 'invalid-output') return invalidOutput(outcome.message);
    reportUsage(options, outcome.usage);
    return json(outcome.plan);
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
        const outcome = await proposePlan(wire, {
          client: options.client,
          signal,
          ...(options.model === undefined ? {} : { model: options.model }),
          ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
          ...(options.onAnswer === undefined ? {} : { onAnswer: options.onAnswer }),
          onProgress: (text) => {
            send('status', { text });
          },
        });
        if (outcome.kind === 'refusal') {
          send('result', { version: AI_PLAN_WIRE_VERSION, refusal: outcome.message });
        } else if (outcome.kind === 'invalid-output') {
          send('result', {
            version: AI_PLAN_WIRE_VERSION,
            invalidOutput: { message: outcome.message },
          });
        } else {
          reportUsage(options, outcome.usage);
          send('result', outcome.plan);
        }
      } catch (cause) {
        /*
          The stream has already begun, so there is no status code left to
          send. The client's taxonomy still needs an answer, and an
          invalid-output result is the one shape that reaches it here.
        */
        send('result', {
          version: AI_PLAN_WIRE_VERSION,
          invalidOutput: { message: describeFailure(cause) },
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
