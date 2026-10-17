/** Stable machine-readable failure categories shared by AI plan providers. */
export type AiProviderErrorCode =
  | 'cancelled'
  | 'endpoint-policy'
  | 'http-status'
  | 'invalid-output'
  | 'network'
  | 'observer-failure'
  | 'refusal'
  | 'resource-limit'
  | 'response-limit'
  | 'stream-protocol'
  | 'timeout';

export interface AiProviderErrorDetails {
  code: AiProviderErrorCode;
  retryable: boolean;
  status?: number;
}

/** Base class for provider failures that a host may classify without reading prose. */
export class AiProviderError extends Error {
  override readonly name: string = 'AiProviderError';
  readonly code: AiProviderErrorCode;
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(message: string, details: AiProviderErrorDetails) {
    super(message);
    this.code = details.code;
    this.retryable = details.retryable;
    this.status = details.status;
  }
}

export function isAiProviderError(value: unknown): value is AiProviderError {
  return value instanceof AiProviderError;
}
