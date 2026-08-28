import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createTransformWorkerClient,
  TransformWorkerClientError,
  type TransformRequestInput,
  type TransformWorkerClient,
  type WorkerEventType,
  type WorkerLike,
} from './client';
import {
  isTransformDocumentMessage,
  isTransformRequest,
  type TransformRequest,
  type TransformResponse,
  type TransformScope,
} from './protocol';

class FakeWorker implements WorkerLike {
  readonly messages: unknown[] = [];
  readonly listeners: Record<WorkerEventType, Set<EventListenerOrEventListenerObject>> = {
    message: new Set(),
    error: new Set(),
    messageerror: new Set(),
  };
  attachCount = 0;
  detachCount = 0;
  terminateCount = 0;
  onPost: ((message: unknown) => void) | null = null;

  postMessage(message: unknown): void {
    this.messages.push(message);
    this.onPost?.(message);
  }

  addEventListener(type: WorkerEventType, listener: EventListenerOrEventListenerObject): void {
    this.attachCount += 1;
    this.listeners[type].add(listener);
  }

  removeEventListener(type: WorkerEventType, listener: EventListenerOrEventListenerObject): void {
    this.detachCount += 1;
    this.listeners[type].delete(listener);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  emit(type: WorkerEventType, event: Event): void {
    for (const listener of [...this.listeners[type]]) {
      if (typeof listener === 'function') {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    }
  }

  respond(response: TransformResponse): void {
    this.emit('message', new MessageEvent<unknown>('message', { data: response }));
  }

  requests(): TransformRequest[] {
    return this.messages.filter(isTransformRequest);
  }

  documentMessages(): unknown[] {
    return this.messages.filter(isTransformDocumentMessage);
  }

  listenerCount(): number {
    return Object.values(this.listeners).reduce((total, listeners) => total + listeners.size, 0);
  }
}

const documentScope = { kind: 'document' } as const;

function input(
  generation: number,
  overrides: Partial<TransformRequestInput> = {},
): TransformRequestInput {
  return {
    operation: 'parse',
    generation,
    baseRevision: 4,
    scope: documentScope,
    projectionId: 'canonical-json',
    payload: `text-${String(generation)}`,
    ...overrides,
  };
}

function responseFor(
  request: TransformRequest,
  overrides: {
    requestId?: number;
    generation?: number;
    baseRevision?: number;
    scope?: TransformScope;
  } = {},
): TransformResponse {
  const generation = overrides.generation ?? request.generation;
  return {
    requestId: overrides.requestId ?? request.requestId,
    generation,
    result: {
      kind: 'projected',
      baseRevision: overrides.baseRevision ?? request.baseRevision,
      scope: overrides.scope ?? request.scope,
      text: `generation-${String(generation)}`,
    },
  };
}

function rejectionCode(error: unknown): string {
  return error instanceof TransformWorkerClientError ? error.code : 'unexpected-error';
}

function observe(promise: Promise<TransformResponse>): Promise<string> {
  return promise.then(
    (response) => `applied:${String(response.generation)}`,
    (error: unknown) => `rejected:${rejectionCode(error)}`,
  );
}

function captureThrown(action: () => void): unknown {
  try {
    action();
  } catch (error: unknown) {
    return error;
  }
  return null;
}

function harness() {
  const worker = new FakeWorker();
  const client = createTransformWorkerClient(worker);
  client.setDocument(4, '{"rootId":"root"}');
  return { worker, client };
}

function requestAt(worker: FakeWorker, index: number): TransformRequest {
  const request = worker.requests()[index];
  if (request === undefined) {
    throw new Error(`Expected posted request at index ${String(index)}.`);
  }
  return request;
}

describe('createTransformWorkerClient (011 §3)', () => {
  it('w2: keeps ONE active request plus ONE coalesced newest input across a burst', async () => {
    const { worker, client } = harness();
    const outcomes: Promise<string>[] = [];
    for (let generation = 1; generation <= 8; generation += 1) {
      outcomes.push(observe(client.request(input(generation))));
    }

    expect(worker.requests()).toHaveLength(1);
    expect(client.getSnapshot().active?.generation).toBe(1);
    expect(client.getSnapshot().coalesced?.generation).toBe(8);

    worker.respond(responseFor(requestAt(worker, 0)));
    expect(worker.requests()).toHaveLength(2);
    expect(worker.requests()[1]?.generation).toBe(8);
    worker.respond(responseFor(requestAt(worker, 1)));

    expect(await Promise.all(outcomes)).toEqual([
      'rejected:stale-response',
      'rejected:superseded',
      'rejected:superseded',
      'rejected:superseded',
      'rejected:superseded',
      'rejected:superseded',
      'rejected:superseded',
      'applied:8',
    ]);
    expect(client.getSnapshot().counts).toMatchObject({
      requestPosts: 2,
      responses: 2,
      staleDrops: 1,
      applications: 1,
    });
  });

  const staleCases: readonly [
    label: string,
    advance: (client: TransformWorkerClient) => Promise<TransformResponse> | null,
  ][] = [
    ['generation', (client) => client.request(input(2))],
    [
      'baseRevision',
      (client) => {
        client.setDocument(5, '{"rootId":"root","revision":5}');
        return null;
      },
    ],
    [
      'scope',
      (client) => client.request(input(1, { scope: { kind: 'node', nodeId: 'other-node' } })),
    ],
  ];

  it.each(staleCases)(
    'w2: drops an internally valid response when current %s no longer matches',
    async (_field, advance) => {
      const { worker, client } = harness();
      const outcome = observe(client.request(input(1)));
      const posted = requestAt(worker, 0);
      const newer = advance(client);
      const newerOutcome = newer === null ? null : observe(newer);
      worker.respond(responseFor(posted));

      expect(await outcome).toBe('rejected:stale-response');
      expect(client.getSnapshot().counts).toMatchObject({
        responses: 1,
        staleDrops: 1,
        applications: 0,
      });
      client.terminate();
      if (newerOutcome !== null) {
        expect(await newerOutcome).toBe('rejected:terminated');
      }
    },
  );

  it('w2 trap 3: fake worker resolves N+1 before N ⇒ exactly one application, final state N+1', async () => {
    const { worker, client } = harness();
    const settlements: string[] = [];
    const first = client.request(input(1)).then(
      (response) => {
        settlements.push(`applied:${String(response.generation)}`);
      },
      () => {
        settlements.push('rejected:N');
      },
    );
    const second = client.request(input(2)).then((response) => {
      settlements.push(`applied:${String(response.generation)}`);
      return response.generation;
    });

    worker.onPost = (message) => {
      if (isTransformRequest(message) && message.generation === 2) {
        worker.respond(responseFor(message));
      }
    };
    worker.respond(responseFor(requestAt(worker, 0)));

    const finalState = await second;
    await first;
    expect(settlements).toEqual(['applied:2', 'rejected:N']);
    expect(client.getSnapshot().counts).toMatchObject({
      responses: 2,
      staleDrops: 1,
      applications: 1,
    });
    expect(finalState).toBe(2);
  });

  it('w3: request ids suppress stale APPLICATION only; they do not pretend to interrupt work', async () => {
    const { worker, client } = harness();
    const applied = client.request(input(1));
    const posted = requestAt(worker, 0);

    worker.respond(responseFor(posted, { requestId: posted.requestId + 1_000 }));
    expect(client.getSnapshot().busy).toBe(true);
    expect(client.getSnapshot().counts).toMatchObject({ staleDrops: 1, applications: 0 });

    worker.respond(responseFor(posted));
    expect((await applied).generation).toBe(1);
    expect(client.getSnapshot().counts.applications).toBe(1);
  });

  it('w4: sends the document once per revision while every posted parse carries TEXT only', async () => {
    const { worker, client } = harness();
    client.setDocument(4, '{"rootId":"root"}');
    const outcomes: Promise<string>[] = [];
    for (let generation = 1; generation <= 5; generation += 1) {
      outcomes.push(observe(client.request(input(generation))));
    }

    expect(worker.documentMessages()).toHaveLength(1);
    expect(worker.requests()).toHaveLength(1);
    expect(worker.requests()[0]?.payload).toBe('text-1');
    expect(client.getSnapshot().coalesced?.payload).toBe('text-5');

    worker.respond(responseFor(requestAt(worker, 0)));
    expect(worker.requests()[1]?.payload).toBe('text-5');
    worker.respond(responseFor(requestAt(worker, 1)));
    await Promise.all(outcomes);

    client.setDocument(5, '{"rootId":"root","revision":5}');
    client.setDocument(5, '{"rootId":"root","revision":5}');
    expect(worker.documentMessages()).toHaveLength(2);
    expect(client.getSnapshot().counts.documentPosts).toBe(2);
  });

  it('w4 regression: a different payload at the same revision terminates with a typed conflict', () => {
    const { worker, client } = harness();

    const error = captureThrown(() => {
      client.setDocument(4, '{"rootId":"different-kernel"}');
    });

    expect(error).toBeInstanceOf(TransformWorkerClientError);
    expect(error).toMatchObject({
      name: 'TransformWorkerClientError',
      code: 'document-revision-conflict',
      message: 'Document revision 4 was already supplied with a different payload.',
    });
    expect(worker.documentMessages()).toHaveLength(1);
    expect(client.getSnapshot()).toMatchObject({
      busy: false,
      terminated: true,
      counts: { documentPosts: 1, teardowns: 1 },
    });
    expect(worker.listenerCount()).toBe(0);
    expect(worker.terminateCount).toBe(1);
  });

  it('w5: the real Worker matches the injected port and every event remains countable', async () => {
    expectTypeOf<Worker>().toExtend<WorkerLike>();
    const { worker, client } = harness();
    const result = client.request(input(1));
    worker.respond(responseFor(requestAt(worker, 0)));
    await result;

    expect(client.getSnapshot().counts).toEqual({
      posts: 2,
      requestPosts: 1,
      documentPosts: 1,
      responses: 1,
      staleDrops: 0,
      applications: 1,
      rejections: 0,
      teardowns: 0,
      terminationErrors: 0,
    });
    client.terminate();
    expect(client.getSnapshot().counts.teardowns).toBe(1);
  });

  const failureCases: readonly [
    label: string,
    expectedCode: string,
    trigger: (worker: FakeWorker, client: TransformWorkerClient) => void,
  ][] = [
    [
      'error',
      'worker-error',
      (worker) => {
        worker.emit('error', new ErrorEvent('error', { message: 'worker crashed' }));
      },
    ],
    [
      'messageerror',
      'message-error',
      (worker) => {
        worker.emit('messageerror', new MessageEvent('messageerror'));
      },
    ],
    [
      'terminate()',
      'terminated',
      (_worker, client) => {
        client.terminate();
      },
    ],
  ];

  it.each(failureCases)(
    'w6: %s rejects every pending request EXACTLY once and detaches every listener',
    async (_label, expectedCode, trigger) => {
      const { worker, client } = harness();
      const rejectionCalls = { first: 0, second: 0 };
      const first = client.request(input(1)).then(
        () => 'applied',
        (error: unknown) => {
          rejectionCalls.first += 1;
          return rejectionCode(error);
        },
      );
      const second = client.request(input(2)).then(
        () => 'applied',
        (error: unknown) => {
          rejectionCalls.second += 1;
          return rejectionCode(error);
        },
      );

      expect(worker.attachCount).toBe(3);
      expect(worker.listenerCount()).toBe(3);
      trigger(worker, client);
      trigger(worker, client);

      expect(await Promise.all([first, second])).toEqual([expectedCode, expectedCode]);
      expect(rejectionCalls).toEqual({ first: 1, second: 1 });
      expect(client.getSnapshot()).toMatchObject({
        busy: false,
        terminated: true,
        documentRevision: 4,
        active: null,
        coalesced: null,
        counts: { rejections: 2, teardowns: 1 },
      });
      expect(worker.detachCount).toBe(3);
      expect(worker.listenerCount()).toBe(0);
      expect(worker.terminateCount).toBe(1);
    },
  );

  it('w6: a malformed response fails closed through the same exactly-once teardown', async () => {
    const { worker, client } = harness();
    const first = observe(client.request(input(1)));
    const second = observe(client.request(input(2)));
    worker.emit('message', new MessageEvent('message', { data: { requestId: 1 } }));

    expect(await Promise.all([first, second])).toEqual([
      'rejected:protocol-error',
      'rejected:protocol-error',
    ]);
    expect(client.getSnapshot().counts).toMatchObject({
      responses: 1,
      applications: 0,
      rejections: 2,
      teardowns: 1,
    });
    expect(worker.listenerCount()).toBe(0);
  });
});

describe('client failure paths (011 §3 w6)', () => {
  const snapshotOf = (revision: number): string =>
    JSON.stringify({ document: { revision }, blockTypes: [] });

  const silent = (): WorkerLike & { listeners: Map<string, Set<EventListener>> } => {
    const listeners = new Map<string, Set<EventListener>>();
    return {
      listeners,
      postMessage: () => undefined,
      addEventListener: (type: string, listener: EventListener) => {
        const set = listeners.get(type) ?? new Set<EventListener>();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      },
      terminate: () => undefined,
    };
  };

  const anyRequest = (): TransformRequestInput => ({
    operation: 'project',
    generation: 1,
    baseRevision: 1,
    scope: { kind: 'document' },
    projectionId: 'canonical-json',
    payload: null,
  });

  it('refuses BOTH doors once terminated rather than pretending to work', async () => {
    const client = createTransformWorkerClient(silent());
    client.terminate();

    expect(() => {
      client.setDocument(1, snapshotOf(1));
    }).toThrow(/terminated/i);
    await expect(client.request(anyRequest())).rejects.toThrow(/terminated/i);
  });

  it('rejects a structurally invalid request instead of posting it', async () => {
    const client = createTransformWorkerClient(silent());
    client.setDocument(1, snapshotOf(1));
    await expect(
      client.request({ ...anyRequest(), operation: 'nonsense' as 'project' }),
    ).rejects.toThrow(/invalid/i);
    client.terminate();
  });

  it('treats a non-message event as a protocol error, not as an answer', async () => {
    const worker = silent();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, snapshotOf(1));
    const pending = client.request(anyRequest());

    for (const listener of worker.listeners.get('message') ?? []) {
      // A real worker can only ever deliver MessageEvents here; anything else
      // means the channel is not what the client thinks it is.
      listener(new Event('message'));
    }
    await expect(pending).rejects.toThrow(/non-message/i);
  });

  it('survives a worker whose terminate() throws, and counts it', () => {
    const worker: WorkerLike = {
      ...silent(),
      terminate: () => {
        throw new Error('worker refused to stop');
      },
    };
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, snapshotOf(1));

    // Teardown must not throw at the caller: a host unmounting a panel cannot
    // be made to handle a worker's dying breath.
    expect(() => {
      client.terminate();
    }).not.toThrow();
    expect(client.getSnapshot().counts.terminationErrors).toBe(1);
    expect(client.getSnapshot().terminated).toBe(true);
  });

  it('rejects every pending request exactly once when the worker errors', async () => {
    const worker = silent();
    const client = createTransformWorkerClient(worker);
    client.setDocument(1, snapshotOf(1));
    const pending = client.request(anyRequest());

    for (const listener of worker.listeners.get('error') ?? []) {
      listener(new Event('error'));
    }
    await expect(pending).rejects.toThrow();
    expect(client.getSnapshot().terminated).toBe(true);
    // Listener bookkeeping returns to zero — a dead client leaks nothing.
    expect([...worker.listeners.values()].every((set) => set.size === 0)).toBe(true);
  });
});
