/**
 * What a failed batch call says to a person (2026-10-12). The server's own sentence when it
 * sent one (already free of SDK text and stacks), the runner's when it refused a job, and a
 * plain fallback otherwise: an unexpected error's message or stack never reaches the screen.
 */
import { isAiBatchJobError, isAiProviderError } from '@craftkit/builder';

/**
 * A server that cannot run background jobs: 501 when its backend cannot batch at all (the
 * local CLI, OpenRouter, no API key), 409 when the model it was asked for cannot.
 */
export interface BatchUnavailable {
  readonly status: 501 | 409;
  readonly message: string;
}

export function batchUnavailableOf(cause: unknown): BatchUnavailable | undefined {
  if (!isAiProviderError(cause) || cause.code !== 'http-status') return undefined;
  if (cause.status !== 501 && cause.status !== 409) return undefined;
  return { status: cause.status, message: cause.message };
}

/** A caller's own cancellation: the platform's AbortError (a DOMException, not always an Error). */
function isAbort(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { readonly name?: unknown }).name === 'AbortError'
  );
}

/** The sentence for a failed call, or nothing when the person cancelled it themselves. */
export function batchFailureMessage(cause: unknown, fallback: string): string | undefined {
  if (isAbort(cause)) return undefined;
  if (isAiBatchJobError(cause) || isAiProviderError(cause)) {
    const said = cause.message.trim();
    return said === '' ? fallback : said;
  }
  return fallback;
}
