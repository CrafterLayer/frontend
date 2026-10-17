import {
  builderError,
  type BuilderDocument,
  type PersistenceAdapter,
  type Transaction,
} from '@craftkit/builder-schema';

interface StoredSession {
  snapshot: BuilderDocument;
  seq: number;
  tail: Transaction[];
}

export interface MemoryPersistence extends PersistenceAdapter {
  /** Initialise a document (test setup). */
  seed(docId: string, doc: BuilderDocument, seq?: number): void;
  /** Inspect the raw stored session (assertion helper). */
  dump(docId: string): StoredSession | undefined;
}

/**
 * The only persistence implementation in B0 (contracts §12): in-memory,
 * optimistic-concurrency append, snapshot compaction. `persist/seq-conflict`
 * rejections leave the stored history untouched.
 */
export function createMemoryPersistence(): MemoryPersistence {
  const sessions = new Map<string, StoredSession>();

  function missing(docId: string): Promise<never> {
    return Promise.reject(new Error(`Unknown document "${docId}"; seed it first.`));
  }

  return {
    seed(docId, doc, seq = 0) {
      sessions.set(docId, { snapshot: structuredClone(doc), seq, tail: [] });
    },
    dump: (docId) => sessions.get(docId),
    load(docId) {
      const session = sessions.get(docId);
      if (session === undefined) {
        return missing(docId);
      }
      return Promise.resolve({
        doc: structuredClone(session.snapshot),
        seq: session.seq,
        tail: structuredClone(session.tail),
      });
    },
    append(docId, txs, expectedSeq) {
      const session = sessions.get(docId);
      if (session === undefined) {
        return missing(docId);
      }
      if (session.seq !== expectedSeq) {
        return Promise.reject(
          builderError(
            'persist/seq-conflict',
            `Append expected position ${String(expectedSeq)}, but the store is at ${String(session.seq)}.`,
            undefined,
            { expected: expectedSeq, actual: session.seq },
          ),
        );
      }
      session.tail.push(...structuredClone(txs));
      session.seq += txs.length;
      return Promise.resolve({ seq: session.seq });
    },
    snapshot(docId, doc, seq) {
      const session = sessions.get(docId);
      if (session === undefined) {
        return missing(docId);
      }
      if (session.seq === seq) {
        sessions.set(docId, { snapshot: structuredClone(doc), seq, tail: [] });
      }
      return Promise.resolve();
    },
  };
}
