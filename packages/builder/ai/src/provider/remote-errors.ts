import { AiProviderError, type AiProviderErrorDetails } from './errors';

/** A remote provider's failure: the server's status, its stream, or its answer. */
export class RemoteAiProviderError extends AiProviderError {
  override readonly name = 'RemoteAiProviderError';

  constructor(
    message: string,
    details: AiProviderErrorDetails = { code: 'invalid-output', retryable: false },
  ) {
    super(message, details);
  }
}

/**
 * A status the server answered with: on the response itself, or, once a stream has begun and
 * the status line is spent, in an `error` frame (2026-10-12). Before the frame a failure
 * mid-stream reached the client as an invalid answer, so a rate limit or an outage spent a
 * repair call and was never classed as retryable. `message` is the server's own sentence,
 * already free of SDK text and stacks.
 */
export function remoteStatusError(status: number, message?: string): RemoteAiProviderError {
  return new RemoteAiProviderError(
    message ?? `The assistant server answered with status ${String(status)}.`,
    {
      code: 'http-status',
      retryable: status === 408 || status === 425 || status === 429 || status >= 500,
      status,
    },
  );
}
