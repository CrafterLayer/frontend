import { RemoteAiProviderError, remoteStatusError } from './remote-errors';

/** Error pages never receive the generation response's much larger allowance. */
const MAX_ERROR_RESPONSE_BYTES = 8_192;

function responseTooLarge(maxResponseBytes: number): RemoteAiProviderError {
  return new RemoteAiProviderError(
    `The assistant server response exceeded the maximum response size of ${String(maxResponseBytes)} bytes.`,
    { code: 'response-limit', retryable: false },
  );
}

export function assertContentLengthWithinLimit(response: Response, maxResponseBytes: number): void {
  const header = response.headers.get('content-length');
  if (header === null) return;
  const declaredBytes = Number(header);
  if (Number.isFinite(declaredBytes) && declaredBytes > maxResponseBytes) {
    throw responseTooLarge(maxResponseBytes);
  }
}

export function countChunk(
  currentBytes: number,
  chunk: Uint8Array,
  maxResponseBytes: number,
): number {
  const nextBytes = currentBytes + chunk.byteLength;
  if (nextBytes > maxResponseBytes) throw responseTooLarge(maxResponseBytes);
  return nextBytes;
}

export function cancelAndReleaseReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    void reader.cancel().catch(() => undefined);
  } catch {
    // Reader cleanup must never replace the provider's real terminal outcome.
  }
  try {
    reader.releaseLock();
  } catch {
    // A host stream may already have released its lock while aborting.
  }
}

export function cancelResponseBody(response: Response): void {
  try {
    void response.body?.cancel().catch(() => undefined);
  } catch {
    // Response cleanup is best-effort and must not mask the classified error.
  }
}

async function readBoundedText(
  response: Response,
  maxResponseBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  let onAbort = (): void => undefined;
  const stopped = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(new DOMException('The response read was cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted === true) onAbort();
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), stopped]);
      if (done) break;
      bytes = countChunk(bytes, value, maxResponseBytes);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    signal?.removeEventListener('abort', onAbort);
    cancelAndReleaseReader(reader);
  }
}

export async function readJsonResponse(
  response: Response,
  maxResponseBytes: number,
): Promise<unknown> {
  const text = await readBoundedText(response, maxResponseBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RemoteAiProviderError('The assistant server answer was not valid JSON.', {
      code: 'invalid-output',
      retryable: true,
    });
  }
}

/** Preserve HTTP classification even when an untrusted error body is unreadable. */
export async function readHttpStatusError(
  response: Response,
  maxResponseBytes: number,
  signal: AbortSignal,
): Promise<RemoteAiProviderError> {
  const fallback = remoteStatusError(response.status);
  const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    cancelResponseBody(response);
    return fallback;
  }
  const limit = Math.min(maxResponseBytes, MAX_ERROR_RESPONSE_BYTES);
  try {
    assertContentLengthWithinLimit(response, limit);
    const value: unknown = JSON.parse(await readBoundedText(response, limit, signal));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return fallback;
    const payload = value as Record<string, unknown>;
    if (typeof payload['error'] !== 'string') return fallback;
    return remoteStatusError(response.status, payload['error'], payload['retryable']);
  } catch {
    if (signal.aborted) {
      throw new DOMException('The response read was cancelled.', 'AbortError');
    }
    cancelResponseBody(response);
    return fallback;
  }
}
