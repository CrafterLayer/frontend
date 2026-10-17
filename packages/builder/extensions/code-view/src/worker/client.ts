import {
  isTransformDocumentMessage,
  isTransformRequest,
  isTransformResponse,
  type TransformRequest,
  type TransformResponse,
  type TransformScope,
} from './protocol';

export type WorkerEventType = 'message' | 'error' | 'messageerror';

/** The browser Worker satisfies this structurally; tests inject the same narrow port. */
export interface WorkerLike {
  postMessage(message: unknown): void;
  addEventListener(type: WorkerEventType, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: WorkerEventType, listener: EventListenerOrEventListenerObject): void;
  terminate(): void;
}

export type TransformRequestInput = Omit<TransformRequest, 'requestId'>;

export type TransformWorkerClientErrorCode =
  | 'invalid-request'
  | 'missing-document'
  | 'document-revision-conflict'
  | 'superseded'
  | 'stale-response'
  | 'protocol-error'
  | 'post-message-failed'
  | 'worker-error'
  | 'message-error'
  | 'terminated';

export class TransformWorkerClientError extends Error {
  readonly code: TransformWorkerClientErrorCode;

  constructor(code: TransformWorkerClientErrorCode, message: string) {
    super(message);
    this.name = 'TransformWorkerClientError';
    this.code = code;
  }
}

export interface TransformWorkerClientCounts {
  readonly posts: number;
  readonly requestPosts: number;
  readonly documentPosts: number;
  readonly responses: number;
  readonly staleDrops: number;
  readonly applications: number;
  readonly rejections: number;
  readonly teardowns: number;
  readonly terminationErrors: number;
}

export interface TransformWorkerClientSnapshot {
  readonly busy: boolean;
  readonly terminated: boolean;
  readonly documentRevision: number | null;
  readonly active: TransformRequest | null;
  readonly coalesced: TransformRequest | null;
  readonly counts: TransformWorkerClientCounts;
}

export interface TransformWorkerClient {
  /**
   * Sends one document snapshot per revision. Repeating the exact revision and
   * payload is a no-op. Reusing a sent revision with different payload data
   * terminates the worker and throws `document-revision-conflict`; the caller
   * must discard this client and create a fresh one. This fails closed instead
   * of inventing an internal epoch that the revision-based request/response
   * protocol cannot correlate, so colliding document lifetimes never share a
   * worker snapshot silently.
   */
  setDocument(baseRevision: number, payload: string): void;
  request(input: TransformRequestInput): Promise<TransformResponse>;
  getSnapshot(): TransformWorkerClientSnapshot;
  terminate(): void;
}

interface PendingRequest {
  readonly request: TransformRequest;
  readonly promise: Promise<TransformResponse>;
  readonly resolve: (response: TransformResponse) => void;
  readonly reject: (error: TransformWorkerClientError) => void;
  settled: boolean;
}

interface CurrentContext {
  readonly generation: number;
  readonly baseRevision: number;
  readonly scope: TransformScope;
}

function cloneScope(scope: TransformScope): TransformScope {
  switch (scope.kind) {
    case 'node':
      return { kind: 'node', nodeId: scope.nodeId };
    case 'page':
      return { kind: 'page', pageId: scope.pageId };
    case 'site':
      return { kind: 'site' };
    default:
      return { kind: 'document' };
  }
}

function sameScope(left: TransformScope, right: TransformScope): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'node') {
    return right.kind === 'node' && left.nodeId === right.nodeId;
  }
  if (left.kind === 'page') {
    return right.kind === 'page' && left.pageId === right.pageId;
  }
  return true;
}

function makePending(request: TransformRequest): PendingRequest {
  const { promise, resolve, reject } = Promise.withResolvers<TransformResponse>();
  return { request, promise, resolve, reject, settled: false };
}

function clientError(
  code: TransformWorkerClientErrorCode,
  message: string,
): TransformWorkerClientError {
  return new TransformWorkerClientError(code, message);
}

function causeMessage(cause: unknown): string {
  return cause instanceof Error && cause.message.length > 0
    ? cause.message
    : 'Unknown worker error.';
}

export function createTransformWorkerClient(worker: WorkerLike): TransformWorkerClient {
  let active: PendingRequest | null = null;
  let coalesced: PendingRequest | null = null;
  let currentContext: CurrentContext | null = null;
  let documentRevision: number | null = null;
  let nextRequestId = 1;
  let terminated = false;
  const sentDocumentPayloads = new Map<number, string>();
  const pending = new Set<PendingRequest>();
  const counts = {
    posts: 0,
    requestPosts: 0,
    documentPosts: 0,
    responses: 0,
    staleDrops: 0,
    applications: 0,
    rejections: 0,
    teardowns: 0,
    terminationErrors: 0,
  };

  const rejectPending = (request: PendingRequest, error: TransformWorkerClientError) => {
    if (request.settled) {
      return;
    }
    request.settled = true;
    pending.delete(request);
    counts.rejections += 1;
    request.reject(error);
  };

  const applyResponse = (request: PendingRequest, response: TransformResponse) => {
    if (request.settled) {
      return;
    }
    request.settled = true;
    pending.delete(request);
    counts.applications += 1;
    request.resolve(response);
  };

  const detach = () => {
    worker.removeEventListener('message', onMessage);
    worker.removeEventListener('error', onError);
    worker.removeEventListener('messageerror', onMessageError);
  };

  const shutdown = (error: TransformWorkerClientError) => {
    if (terminated) {
      return;
    }
    terminated = true;
    counts.teardowns += 1;
    active = null;
    coalesced = null;
    detach();
    for (const request of [...pending]) {
      rejectPending(request, error);
    }
    try {
      worker.terminate();
    } catch {
      // Local teardown still completes even when a test double or host throws here.
      counts.terminationErrors += 1;
    }
  };

  /**
   * `postMessage` only queues work on the recipient event loop. Replacing a
   * coalesced input or terminating this client cannot interrupt a parse already
   * running there; request ids and generations suppress stale APPLICATION only.
   */
  const postRequest = (request: PendingRequest) => {
    active = request;
    counts.posts += 1;
    counts.requestPosts += 1;
    try {
      worker.postMessage(request.request);
    } catch (cause) {
      shutdown(
        clientError('post-message-failed', `Worker postMessage failed: ${causeMessage(cause)}`),
      );
    }
  };

  const responseMatches = (response: TransformResponse, request: TransformRequest) => {
    return (
      response.generation === request.generation &&
      response.result.baseRevision === request.baseRevision &&
      sameScope(response.result.scope, request.scope)
    );
  };

  const responseIsCurrent = (response: TransformResponse) => {
    return (
      currentContext !== null &&
      response.generation === currentContext.generation &&
      response.result.baseRevision === currentContext.baseRevision &&
      sameScope(response.result.scope, currentContext.scope)
    );
  };

  const receive = (response: TransformResponse) => {
    const completed = active;
    if (completed?.request.requestId !== response.requestId) {
      counts.staleDrops += 1;
      return;
    }

    active = null;
    const next = coalesced;
    coalesced = null;
    if (next !== null) {
      // Promote before settling the old promise. A synchronous fake can now prove N+1
      // is safe even when it resolves re-entrantly before N finishes settling.
      postRequest(next);
    }

    if (completed.settled) {
      return;
    }
    if (!responseMatches(response, completed.request) || !responseIsCurrent(response)) {
      counts.staleDrops += 1;
      rejectPending(
        completed,
        clientError(
          'stale-response',
          `Dropped stale worker response ${String(response.requestId)}.`,
        ),
      );
      return;
    }
    applyResponse(completed, response);
  };

  const onMessage: EventListener = (event) => {
    counts.responses += 1;
    if (!(event instanceof MessageEvent)) {
      shutdown(clientError('protocol-error', 'Worker emitted a non-message response event.'));
      return;
    }
    const data: unknown = event.data;
    if (!isTransformResponse(data)) {
      shutdown(clientError('protocol-error', 'Worker emitted an invalid transform response.'));
      return;
    }
    receive(data);
  };

  const onError: EventListener = (event) => {
    const message = event instanceof ErrorEvent ? event.message : '';
    shutdown(
      clientError(
        'worker-error',
        message.length > 0 ? `Transform worker failed: ${message}` : 'Transform worker failed.',
      ),
    );
  };

  const onMessageError: EventListener = () => {
    shutdown(clientError('message-error', 'Transform worker could not deserialize a message.'));
  };

  worker.addEventListener('message', onMessage);
  worker.addEventListener('error', onError);
  worker.addEventListener('messageerror', onMessageError);

  return {
    setDocument: (baseRevision, payload) => {
      if (terminated) {
        throw clientError('terminated', 'Transform worker client is terminated.');
      }
      const message = { kind: 'document', baseRevision, payload } as const;
      if (!isTransformDocumentMessage(message)) {
        throw clientError('invalid-request', 'Document snapshot is not a valid worker message.');
      }

      const sentPayload = sentDocumentPayloads.get(baseRevision);
      if (sentPayload !== undefined && sentPayload !== payload) {
        const error = clientError(
          'document-revision-conflict',
          `Document revision ${String(baseRevision)} was already supplied with a different payload.`,
        );
        shutdown(error);
        throw error;
      }

      documentRevision = baseRevision;
      if (currentContext !== null) {
        currentContext = { ...currentContext, baseRevision };
      }
      if (sentPayload !== undefined) {
        return;
      }

      sentDocumentPayloads.set(baseRevision, payload);
      counts.posts += 1;
      counts.documentPosts += 1;
      try {
        worker.postMessage(message);
      } catch (cause) {
        const error = clientError(
          'post-message-failed',
          `Worker postMessage failed: ${causeMessage(cause)}`,
        );
        shutdown(error);
        throw error;
      }
    },
    request: (input) => {
      if (terminated) {
        return Promise.reject(clientError('terminated', 'Transform worker client is terminated.'));
      }
      if (documentRevision === null || documentRevision !== input.baseRevision) {
        return Promise.reject(
          clientError(
            'missing-document',
            `Document revision ${String(input.baseRevision)} has not been supplied.`,
          ),
        );
      }

      const request: TransformRequest = {
        ...input,
        requestId: nextRequestId,
        scope: cloneScope(input.scope),
      };
      if (!isTransformRequest(request)) {
        return Promise.reject(clientError('invalid-request', 'Transform request is invalid.'));
      }
      nextRequestId += 1;
      currentContext = {
        generation: request.generation,
        baseRevision: request.baseRevision,
        scope: request.scope,
      };

      const pendingRequest = makePending(request);
      pending.add(pendingRequest);
      if (active === null) {
        postRequest(pendingRequest);
      } else {
        if (coalesced !== null) {
          rejectPending(
            coalesced,
            clientError('superseded', 'A newer transform input replaced this queued request.'),
          );
        }
        coalesced = pendingRequest;
      }
      return pendingRequest.promise;
    },
    getSnapshot: () => ({
      busy: active !== null || coalesced !== null,
      terminated,
      documentRevision,
      active: active?.request ?? null,
      coalesced: coalesced?.request ?? null,
      counts: { ...counts },
    }),
    terminate: () => {
      shutdown(clientError('terminated', 'Transform worker client was terminated.'));
    },
  };
}
