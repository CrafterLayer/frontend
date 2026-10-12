/**
 * What a failed batch call says (2026-10-12): a 501 or 409 is the server saying it cannot
 * batch, in its own sentence; the runner's refusals and the server's other sentences are
 * shown as they are; anything else is a plain fallback — never a stack — and a person's own
 * cancellation says nothing.
 */
import { AiBatchJobError, RemoteAiProviderError } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { batchFailureMessage, batchUnavailableOf } from './batch-errors';

const status = (code: number, message: string) =>
  new RemoteAiProviderError(message, { code: 'http-status', retryable: false, status: code });

describe('batchUnavailableOf', () => {
  it('reads a 501 and a 409 as the server cannot batch, with its sentence', () => {
    expect(batchUnavailableOf(status(501, 'Background batches are not configured.'))).toEqual({
      status: 501,
      message: 'Background batches are not configured.',
    });
    expect(batchUnavailableOf(status(409, 'This model cannot batch.'))).toEqual({
      status: 409,
      message: 'This model cannot batch.',
    });
    expect(batchUnavailableOf(status(500, 'Boom.'))).toBeUndefined();
    expect(batchUnavailableOf(new Error('x'))).toBeUndefined();
  });
});

describe('batchFailureMessage', () => {
  it("shows the server's and the runner's sentences, and a fallback for anything else", () => {
    expect(batchFailureMessage(status(502, 'The assistant server is down.'), 'Fallback.')).toBe(
      'The assistant server is down.',
    );
    expect(
      batchFailureMessage(new AiBatchJobError('not-ended', 'Still answering.'), 'Fallback.'),
    ).toBe('Still answering.');
    const leaky = new TypeError("Cannot read properties of undefined (reading 'x')");
    expect(batchFailureMessage(leaky, 'Fallback.')).toBe('Fallback.');
    expect(batchFailureMessage('a string', 'Fallback.')).toBe('Fallback.');
    expect(batchFailureMessage(new DOMException('aborted', 'AbortError'), 'Fallback.')).toBe(
      undefined,
    );
  });
});
