import { acceptDocument, handleRequest } from './transform-worker';
import { isTransformDocumentMessage, isTransformRequest, type TransformResponse } from './protocol';
import type { WorkerLike } from './client';

/**
 * A TEST-ONLY worker: the real entry's handlers, driven synchronously on the
 * calling thread. jsdom has no `Worker`, and an app's end-to-end test still has
 * to prove the whole road — panel → client → protocol → codec → patches —
 * without faking any of it. This loopback fakes exactly ONE thing: the thread
 * hop. Everything else is the same code the module worker runs.
 *
 * It must never appear in production wiring; thread placement there is proven
 * by the real-browser gate, which a loopback cannot stand in for.
 */
export function createLoopbackWorkerLike(): WorkerLike {
  const listeners = new Set<(event: MessageEvent) => void>();
  let terminated = false;

  const deliver = (response: TransformResponse): void => {
    // Delivered on a microtask, matching the asynchrony a real worker has —
    // a synchronous callback would let tests pass on ordering a browser never
    // provides.
    queueMicrotask(() => {
      if (terminated) {
        return;
      }
      for (const listener of [...listeners]) {
        // A REAL MessageEvent, not a structural stand-in: consumers may check
        // `event instanceof MessageEvent`, and jsdom constructs it fine.
        listener(new MessageEvent('message', { data: response }));
      }
    });
  };

  return {
    postMessage: (message: unknown) => {
      if (terminated) {
        return;
      }
      if (isTransformDocumentMessage(message)) {
        acceptDocument(message.baseRevision, message.payload);
        return;
      }
      if (isTransformRequest(message)) {
        deliver(handleRequest(message));
      }
    },
    addEventListener: (type, listener) => {
      if (type === 'message') {
        listeners.add(listener as (event: MessageEvent) => void);
      }
    },
    removeEventListener: (type, listener) => {
      if (type === 'message') {
        listeners.delete(listener as (event: MessageEvent) => void);
      }
    },
    terminate: () => {
      terminated = true;
      listeners.clear();
    },
  };
}
