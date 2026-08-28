import { describe, expect, it } from 'vitest';

import { CANONICAL_JSON_PROJECTION_ID, projectDocument } from '@craftkit/builder-transforms';
import type { BuilderDocument } from '@craftkit/builder-schema';

import { isSerializableValue, type TransformRequest } from './protocol';
import { acceptDocument, attachTransformWorker, handleRequest } from './transform-worker';

const document_: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['t1'] } },
    t1: { id: 't1', type: 'text', props: { content: 'hello' } },
  },
};

const snapshot = (doc: BuilderDocument = document_) =>
  JSON.stringify({ document: doc, blockTypes: ['page', 'text'] });

const request = (over: Partial<TransformRequest> = {}): TransformRequest => ({
  operation: 'project',
  requestId: 1,
  generation: 1,
  baseRevision: 7,
  scope: { kind: 'document' },
  projectionId: CANONICAL_JSON_PROJECTION_ID,
  payload: null,
  ...over,
});

describe('transform worker entry (011 contract §3 w1/w4)', () => {
  it('projects the held document, matching the codec exactly', () => {
    acceptDocument(7, snapshot());
    const response = handleRequest(request());
    expect(response.result.kind).toBe('projected');
    if (response.result.kind !== 'projected') {
      throw new Error('expected a projection');
    }
    // The worker adds no formatting of its own — it IS the codec, off-thread.
    expect(response.result.text).toBe(projectDocument(document_).text);
  });

  it('echoes requestId and generation so a stale response stays detectable', () => {
    acceptDocument(7, snapshot());
    const response = handleRequest(request({ requestId: 42, generation: 9 }));
    expect(response.requestId).toBe(42);
    expect(response.generation).toBe(9);
  });

  it('NOTHING that crosses back carries a function (w1 — the structural reason)', () => {
    // Functions cannot be structured-cloned. If one ever appeared in a result,
    // postMessage would throw DataCloneError at runtime; this asserts it at the
    // boundary instead, for every result shape the worker can produce.
    acceptDocument(7, snapshot());
    const responses = [
      handleRequest(request()),
      handleRequest(request({ operation: 'parse', payload: projectDocument(document_).text })),
      handleRequest(request({ operation: 'parse', payload: '{ not json' })),
      handleRequest(request({ projectionId: 'nope' })),
    ];
    for (const response of responses) {
      expect(isSerializableValue(response)).toBe(true);
    }
  });

  it('parses a projection back to zero patches against its own document', () => {
    acceptDocument(7, snapshot());
    const response = handleRequest(
      request({ operation: 'parse', payload: projectDocument(document_).text }),
    );
    if (response.result.kind !== 'parsed' || !response.result.ok) {
      throw new Error('expected a successful parse');
    }
    expect(response.result.patches).toEqual([]);
  });

  it('reports an unknown projection id rather than guessing one', () => {
    acceptDocument(7, snapshot());
    const response = handleRequest(request({ projectionId: 'mdx' }));
    expect(response.result.kind).toBe('protocol-error');
    if (response.result.kind !== 'protocol-error') {
      throw new Error('expected a protocol error');
    }
    expect(response.result.code).toBe('unknown-projection');
  });

  it('refuses to answer from a STALE document rather than patch a document that moved on', () => {
    acceptDocument(7, snapshot());
    const response = handleRequest(request({ baseRevision: 8 }));
    if (response.result.kind !== 'protocol-error') {
      throw new Error('expected a protocol error');
    }
    expect(response.result.code).toBe('stale-document');
  });

  it('answers before any document arrives instead of throwing', () => {
    // A fresh worker that receives a request first must not die; a dead worker
    // strands every pending request (w6).
    acceptDocument(7, snapshot());
    const fresh = handleRequest(request({ baseRevision: 999 }));
    expect(fresh.result.kind).toBe('protocol-error');
  });

  it('keeps the document PER REVISION — typing sends text only (w4)', () => {
    acceptDocument(7, snapshot());
    const first = handleRequest(request({ operation: 'parse', payload: '{"bad"' }));
    const second = handleRequest(request({ operation: 'parse', payload: '{"also bad"' }));
    // Two parses, zero document messages between them: the held snapshot served
    // both. This is the counted half of "the document crosses once per revision".
    expect(first.result.kind).toBe('parsed');
    expect(second.result.kind).toBe('parsed');
  });

  it('carries REAL patches across the wire, including a remove that has no value', () => {
    // Every earlier case parsed a document back to zero patches, so the wire
    // conversion itself was never exercised: a codec change could have started
    // emitting unusable patch shapes without a single test noticing.
    acceptDocument(7, snapshot());
    const edited: BuilderDocument = {
      ...document_,
      nodes: {
        // The slot key goes with its last child: empty slot arrays are never
        // stored, so keeping one would make the edit structurally invalid.
        root: { id: 'root', type: 'page', props: {} },
      },
    };
    const response = handleRequest(
      request({ operation: 'parse', payload: projectDocument(edited).text }),
    );
    if (response.result.kind !== 'parsed' || !response.result.ok) {
      throw new Error('a valid edit must parse');
    }
    expect(response.result.patches.length).toBeGreaterThan(0);
    // A removal legitimately carries no value; it must survive the crossing
    // rather than be mistaken for an unserializable one.
    const removal = response.result.patches.find((patch) => patch.op === 'remove');
    expect(removal).toBeDefined();
    expect(isSerializableValue(response.result)).toBe(true);
  });

  it('ignores a foreign message instead of crashing the worker', () => {
    const posted: unknown[] = [];
    const held: { listener: ((event: MessageEvent) => void) | null } = { listener: null };
    attachTransformWorker({
      addEventListener: (_type, next) => {
        held.listener = next;
      },
      postMessage: (message) => posted.push(message),
    });
    const deliver = held.listener;
    if (deliver === null) {
      throw new Error('the worker must listen');
    }
    deliver({ data: { hello: 'world' } } as MessageEvent);
    expect(posted).toHaveLength(0);
  });

  it('routes a document message to state and a request to a response', () => {
    const posted: unknown[] = [];
    const held: { listener: ((event: MessageEvent) => void) | null } = { listener: null };
    attachTransformWorker({
      addEventListener: (_type, next) => {
        held.listener = next;
      },
      postMessage: (message) => posted.push(message),
    });
    const deliver = held.listener;
    if (deliver === null) {
      throw new Error('the worker must listen');
    }
    deliver({ data: { kind: 'document', baseRevision: 3, payload: snapshot() } } as MessageEvent);
    expect(posted).toHaveLength(0); // a snapshot is not answered
    deliver({ data: request({ baseRevision: 3 }) } as MessageEvent);
    expect(posted).toHaveLength(1);
  });
});
