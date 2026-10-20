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

export const MAX_REMOTE_ERROR_MESSAGE_LENGTH = 1_000;

/** Only bounded plain text is suitable for the host's error presentation. */
function safeMessage(message: string | undefined): string | undefined {
  if (message === undefined || /<\/?[a-z][^>]*>/iu.test(message)) return undefined;
  const text = message.replace(/\s+/gu, ' ').trim();
  return text === '' ? undefined : text.slice(0, MAX_REMOTE_ERROR_MESSAGE_LENGTH);
}

/** JSON and SSE failures share bounded prose, HTTP classification and terminal restrictions. */
export function remoteStatusError(
  status: number,
  message?: string,
  retryable?: unknown,
): RemoteAiProviderError {
  return new RemoteAiProviderError(
    safeMessage(message) ?? `The assistant server answered with status ${String(status)}.`,
    {
      code: 'http-status',
      // Server metadata may forbid a retry; it cannot make a terminal status retryable.
      retryable:
        retryable !== false &&
        (status === 408 || status === 425 || status === 429 || status >= 500),
      status,
    },
  );
}
