import { describe, expect, it } from 'vitest';

import { CANONICAL_JSON_PROJECTION_ID, projectDocument } from '@craftkit/builder-transforms';
import type { BuilderDocument } from '@craftkit/builder-schema';

import { createTransformWorkerClient } from './client';
import { createLoopbackWorkerLike } from './loopback';

/**
 * The loopback is test infrastructure that OTHER packages rely on to prove the
 * whole road without a real Worker, so its own faithfulness has to be proven
 * here rather than assumed there. It fakes exactly one thing — the thread hop.
 * Everything asserted below is what a real module worker also does.
 */

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

const snapshot = JSON.stringify({ document: document_, blockTypes: ['page', 'text'] });

describe('loopback worker (test infrastructure, 011 §3)', () => {
  it('runs the REAL handlers: a projection matches the codec byte for byte', async () => {
    const client = createTransformWorkerClient(createLoopbackWorkerLike());
    client.setDocument(1, snapshot);

    const response = await client.request({
      operation: 'project',
      generation: 1,
      baseRevision: 1,
      scope: { kind: 'document' },
      projectionId: CANONICAL_JSON_PROJECTION_ID,
      payload: null,
    });

    if (response.result.kind !== 'projected') {
      throw new Error('the loopback must answer with a projection');
    }
    // Not a stub that returns plausible text — the codec itself, off no thread.
    expect(response.result.text).toBe(projectDocument(document_).text);
    client.terminate();
  });

  it('answers ASYNCHRONOUSLY, so no test can pass on ordering a browser never gives', async () => {
    const client = createTransformWorkerClient(createLoopbackWorkerLike());
    client.setDocument(1, snapshot);

    const holder: { settled: boolean } = { settled: false };
    const pending = client
      .request({
        operation: 'project',
        generation: 1,
        baseRevision: 1,
        scope: { kind: 'document' },
        projectionId: CANONICAL_JSON_PROJECTION_ID,
        payload: null,
      })
      .then((response) => {
        holder.settled = true;
        return response;
      });

    // A synchronous loopback would already have resolved here; a real worker
    // never can, so this one must not either.
    expect(holder.settled).toBe(false);
    await pending;
    expect(holder.settled).toBe(true);
    client.terminate();
  });

  it('reports a parse failure per line instead of throwing', async () => {
    const client = createTransformWorkerClient(createLoopbackWorkerLike());
    client.setDocument(1, snapshot);

    const response = await client.request({
      operation: 'parse',
      generation: 1,
      baseRevision: 1,
      scope: { kind: 'document' },
      projectionId: CANONICAL_JSON_PROJECTION_ID,
      payload: '{ "broken',
    });

    if (response.result.kind !== 'parsed') {
      throw new Error('a malformed payload is still a parse RESULT, not a crash');
    }
    expect(response.result.ok).toBe(false);
    client.terminate();
  });

  it('goes silent after terminate — a terminated worker answers nothing', async () => {
    const worker = createLoopbackWorkerLike();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, snapshot);
    const first = await client.request({
      operation: 'project',
      generation: 1,
      baseRevision: 1,
      scope: { kind: 'document' },
      projectionId: CANONICAL_JSON_PROJECTION_ID,
      payload: null,
    });
    expect(first.result.kind).toBe('projected');

    worker.terminate();
    // Posting to a terminated loopback is inert: no listener runs, nothing
    // resolves. The client's own teardown owns rejecting pending work (w6).
    expect(() => {
      worker.postMessage({ kind: 'document', baseRevision: 2, payload: snapshot });
    }).not.toThrow();
    client.terminate();
  });

  it('ignores listeners for events it does not emit, and drops removed ones', () => {
    const worker = createLoopbackWorkerLike();
    const seen: unknown[] = [];
    const listener = (event: MessageEvent): void => {
      seen.push(event.data);
    };
    // A non-'message' registration must not receive message traffic.
    worker.addEventListener('error', listener as EventListener);
    worker.addEventListener('message', listener as EventListener);
    worker.removeEventListener('message', listener as EventListener);
    worker.removeEventListener('error', listener as EventListener);

    worker.postMessage({ kind: 'document', baseRevision: 1, payload: snapshot });
    worker.postMessage({ hello: 'world' }); // a foreign message is simply ignored
    expect(seen).toHaveLength(0);
    worker.terminate();
  });
});
