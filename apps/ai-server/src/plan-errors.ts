import Anthropic from '@anthropic-ai/sdk';

/*
  A failed model call, said as the wire says it (2026-10-12: moved out of handler.ts, so
  `/plan` and the batch routes answer the same failure with the same sentence and status).
*/

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
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
  'PlanCallTimeoutError',
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
export function describeFailure(cause: unknown): string {
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
export function errorResponse(cause: unknown): Response {
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
