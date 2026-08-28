import { describe, expect, it } from 'vitest';

import {
  isSerializableValue,
  isTransformDocumentMessage,
  isTransformRequest,
  isTransformResult,
} from './protocol';

/**
 * The protocol guards are the boundary itself (§3 w1): everything crossing the
 * worker edge is CHECKED, never asserted. A guard that says yes to a shape the
 * other side cannot handle is the same defect as no guard at all, so each one
 * is proven to refuse — not merely to accept.
 */
describe('worker protocol guards (011 §3)', () => {
  it('refuses values that cannot be structured-cloned, however deeply they hide', () => {
    expect(isSerializableValue({ ok: true })).toBe(true);
    expect(isSerializableValue({ nested: [1, { fn: () => undefined }] })).toBe(false);
    expect(isSerializableValue(undefined)).toBe(false);
    expect(isSerializableValue(new Date(0))).toBe(false);

    // A GETTER is the trap: reading it once proves nothing, because
    // postMessage will read it again on the other side.
    const trap = {};
    Object.defineProperty(trap, 'lazy', { enumerable: true, get: () => 1 });
    expect(isSerializableValue(trap)).toBe(false);
  });

  it('refuses a document message that is not one', () => {
    expect(isTransformDocumentMessage(null)).toBe(false);
    expect(isTransformDocumentMessage('document')).toBe(false);
    expect(isTransformDocumentMessage({ kind: 'document' })).toBe(false);
    expect(isTransformDocumentMessage({ kind: 'request', baseRevision: 1, payload: '{}' })).toBe(
      false,
    );
    expect(isTransformDocumentMessage({ kind: 'document', baseRevision: 1, payload: '{}' })).toBe(
      true,
    );
  });

  it('refuses a request with a wrong shape, an unknown operation, or an extra key', () => {
    const valid = {
      operation: 'project',
      requestId: 1,
      generation: 1,
      baseRevision: 1,
      scope: { kind: 'document' },
      projectionId: 'canonical-json',
      payload: null,
    };
    expect(isTransformRequest(valid)).toBe(true);
    expect(isTransformRequest({ ...valid, operation: 'compile' })).toBe(false);
    expect(isTransformRequest({ ...valid, extra: 1 })).toBe(false);
    expect(isTransformRequest({ ...valid, scope: { kind: 'node' } })).toBe(false);
    expect(isTransformRequest([valid])).toBe(false);
  });

  it('refuses a result that carries a patch the other side could not apply', () => {
    // A result carries only its CONTEXT — the envelope's ids live one level up.
    const base = { baseRevision: 1, scope: { kind: 'document' } };
    expect(isTransformResult({ ...base, kind: 'parsed', ok: true, patches: [] })).toBe(true);
    expect(
      isTransformResult({
        ...base,
        kind: 'parsed',
        ok: true,
        patches: [{ op: 'replace', path: ['nodes', 'a'], value: { ok: true }, extra: 1 }],
      }),
    ).toBe(false);
    expect(
      isTransformResult({ ...base, kind: 'parsed', ok: true, patches: [{ op: 'nope', path: [] }] }),
    ).toBe(false);
    expect(isTransformResult({ ...base, kind: 'parsed', ok: true, patches: ['patch'] })).toBe(
      false,
    );
    expect(isTransformResult({ kind: 'projected', text: 'x' })).toBe(false);
  });
});
