import Anthropic from '@anthropic-ai/sdk';

import { AI_PLAN_WIRE_VERSION, type AiPlanWireRequest } from '@craftkit/builder-ai';

import { proposePlan, type UsageReport } from './claude';

/**
 * The HTTP surface: one POST, three possible answers.
 *
 * Written against the platform `Request`/`Response` rather than a framework so
 * the same function serves a Node server, a worker, and a test with no adapter
 * — and so this app's dependency list stays at the SDK plus the workspace.
 */

export interface HandlerOptions {
  readonly client: Anthropic;
  readonly model?: string;
  readonly maxTokens?: number;
  /** Bearer token required on every request. Omitted ⇒ no auth (local only). */
  readonly authToken?: string;
  /** Largest request body accepted, in bytes. */
  readonly maxRequestBytes?: number;
  /** Receives one line per completed request. */
  readonly onUsage?: (report: UsageReport & { readonly cachedShare: number }) => void;
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
function frame(event: 'status' | 'result', data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createHandler(options: HandlerOptions) {
  const maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;

  return async function handle(request: Request): Promise<Response> {
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
      body = await request.json();
    } catch {
      return json({ error: 'Body is not JSON.' }, 400);
    }
    if (!isWireRequest(body)) {
      return json({ error: `Expected an AiPlanWireRequest of version ${String(AI_PLAN_WIRE_VERSION)}.` }, 400);
    }

    const wantsStream = (request.headers.get('accept') ?? '').includes('text/event-stream');
    return wantsStream
      ? streamed(body, options, request.signal)
      : unary(body, options, request.signal);
  };
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
function streamed(
  wire: AiPlanWireRequest,
  options: HandlerOptions,
  signal: AbortSignal,
): Response {
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
  return cause instanceof Error && cause.message.startsWith('Could not resolve authentication method');
}

/** One plain sentence per failure kind — never a stack, never a raw SDK message. */
function describeFailure(cause: unknown): string {
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
  if (cause instanceof Anthropic.RateLimitError) return json({ error: message }, 429);
  if (cause instanceof Anthropic.AuthenticationError || isMissingCredentials(cause)) {
    return json({ error: message }, 500);
  }
  if (cause instanceof Anthropic.BadRequestError) return json({ error: message }, 400);
  return json({ error: message }, 502);
}
