import {
  builderError,
  type BuilderDocument,
  type PersistedSession,
  type PersistenceAck,
  type PersistenceAdapter,
  type Transaction,
} from '@craftkit/builder';

import { vaultWriteAcknowledgement, type VaultStore } from './store';

/** Exactly the kernel's `PersistedSession`, as one storable record. */
interface StoredSession {
  doc: BuilderDocument;
  seq: number;
  tail: Transaction[];
}

/**
 * The one key a document's session lives under — EXACT, never a prefix.
 *
 * Exported because "forget this document" belongs to the caller that owns the
 * boot, and it has to name the same key this file writes. A sweep by prefix
 * would take `playground/landing-v2` down with `playground/landing`.
 */
export const sessionKey = (docId: string): string => `vault/session/${docId}`;

/**
 * The kernel's adapter, plus the one door the kernel has no concept of.
 *
 * `append` rejects a stale position with `persist/seq-conflict` and must keep
 * doing so — that rejection is the only thing standing between two sessions and
 * a silently interleaved history. But a rejection is not an ANSWER: a kernel
 * that loses the race can never append again, because its position never moves.
 * `takeOver` is the answer, and it is deliberately not part of
 * `PersistenceAdapter`: only the boot that owns the session may re-base it.
 */
export interface VaultPersistenceAdapter extends PersistenceAdapter {
  append(
    docId: string,
    txs: Transaction[],
    expectedSeq: number,
  ): Promise<{ seq: number; persistence: PersistenceAck }>;
  /** Last observed storage outcome for this document. */
  acknowledgement(docId: string): PersistenceAck;
  /** Compaction with the acknowledgement hidden by the kernel's base port. */
  snapshotAcknowledged(docId: string, doc: BuilderDocument, seq: number): Promise<PersistenceAck>;
  /**
   * Re-base the stored session onto THIS kernel's position: store `doc` at
   * `seq` with an empty tail, whatever the store currently holds.
   *
   * Unconditional on purpose, and the only unconditional write in this file.
   * After it the kernel's next append matches again, so the session that was
   * frozen out resumes saving. It is last-writer-wins between two tabs — the
   * document written is a whole, valid page from one of them, never a splice of
   * both — and the caller is expected to SAY so rather than do it quietly.
   */
  takeOver(docId: string, doc: BuilderDocument, seq: number): Promise<PersistenceAck>;
}

export interface VaultPersistenceOptions {
  readonly store: VaultStore;
  /** Called only when nothing is stored for that docId: the fixture. */
  readonly seed: (docId: string) => BuilderDocument;
}

/**
 * The kernel's `PersistenceAdapter` over a `VaultStore`.
 *
 * It reproduces the in-memory reference's semantics exactly — `seq` counts
 * TRANSACTIONS ever appended (not batches), a stale `expectedSeq` rejects with
 * `persist/seq-conflict` and leaves the stored history untouched, and
 * compaction only happens AT the current position — with one addition the
 * reference does not need: every write for a docId is SERIALISED, because a
 * real async store can interleave two read-modify-writes and lose one.
 */
export function createVaultPersistence(options: VaultPersistenceOptions): VaultPersistenceAdapter {
  const { store, seed } = options;
  /*
    One chain per document. It is deliberately built with `then(work, work)` and
    kept as a settled-either-way promise: a rejected append (a seq conflict is a
    normal outcome, not a bug) must never poison the chain and silently swallow
    every later write — the kernel's own flush chain has that hazard, and the
    vault must not add a second one underneath it.
  */
  const chains = new Map<string, Promise<void>>();
  const acknowledgements = new Map<string, PersistenceAck>();

  function serialise<T>(docId: string, work: () => Promise<T>): Promise<T> {
    const previous = chains.get(docId) ?? Promise.resolve();
    const result = previous.then(work, work);
    chains.set(
      docId,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }

  /** First boot is just an empty history over the fixture — never an error. */
  async function readSession(docId: string): Promise<StoredSession> {
    const stored = await store.get<StoredSession>(sessionKey(docId));
    const session = stored ?? { doc: seed(docId), seq: 0, tail: [] };
    if (!acknowledgements.has(docId)) {
      acknowledgements.set(
        docId,
        store.persistence?.(session.seq) ?? { kind: 'durable', sequence: session.seq },
      );
    }
    return session;
  }

  async function writeSession(docId: string, session: StoredSession): Promise<PersistenceAck> {
    let acknowledgement: PersistenceAck;
    try {
      acknowledgement = vaultWriteAcknowledgement(
        store,
        await store.set(sessionKey(docId), session, session.seq),
        session.seq,
      );
    } catch (error) {
      acknowledgement = {
        kind: 'failed',
        sequence: acknowledgements.get(docId)?.sequence ?? Math.max(0, session.seq - 1),
        reason: error instanceof Error ? error.message : String(error),
        recoverable: true,
      };
    }
    acknowledgements.set(docId, acknowledgement);
    return acknowledgement;
  }

  function requireWrite(acknowledgement: PersistenceAck): PersistenceAck {
    if (acknowledgement.kind === 'failed') throw new Error(acknowledgement.reason);
    return acknowledgement;
  }

  const adapter: VaultPersistenceAdapter = {
    acknowledgement(docId) {
      return (
        acknowledgements.get(docId) ?? store.persistence?.(0) ?? { kind: 'durable', sequence: 0 }
      );
    },

    load: (docId) =>
      serialise(docId, async (): Promise<PersistedSession> => {
        const session = await readSession(docId);
        return { doc: session.doc, seq: session.seq, tail: [...session.tail] };
      }),

    append: (docId, txs, expectedSeq) =>
      serialise(docId, async () => {
        const session = await readSession(docId);
        if (session.seq !== expectedSeq) {
          // The SAME error the in-memory reference raises, down to the meta —
          // callers branch on `code`, and a second dialect would break them.
          throw builderError(
            'persist/seq-conflict',
            `Append expected position ${String(expectedSeq)}, but the store is at ${String(session.seq)}.`,
            undefined,
            { expected: expectedSeq, actual: session.seq },
          );
        }
        const next: StoredSession = {
          doc: session.doc,
          seq: session.seq + txs.length,
          tail: [...session.tail, ...txs],
        };
        // Nothing was written before the conflict check, so a rejection leaves
        // the stored history byte-identical.
        const persistence = requireWrite(await writeSession(docId, next));
        return { seq: next.seq, persistence };
      }),

    /*
      The KERNEL's compaction hook, NOT the user-facing snapshot shelf in
      ./snapshots.ts. It replaces the stored document and TRUNCATES the tail so
      the next load replays nothing, and it is the only cure for undo-then-
      reload divergence: undo/redo never records a transaction (Law S), so an
      undone transaction still sits in the tail and a replay would resurrect it.
      Compacting at the live position is what makes storage agree with the
      screen. Like the reference, it is a NO-OP at any other position.
    */
    snapshot: (docId, doc, seq) =>
      serialise(docId, async () => {
        const session = await readSession(docId);
        if (session.seq !== seq) {
          return;
        }
        const compacted: StoredSession = { doc, seq, tail: [] };
        requireWrite(await writeSession(docId, compacted));
      }),

    snapshotAcknowledged: (docId, doc, seq) =>
      serialise(docId, async () => {
        const session = await readSession(docId);
        if (session.seq !== seq) return adapter.acknowledgement(docId);
        return writeSession(docId, { doc, seq, tail: [] });
      }),

    // Same serialised chain as every other write, so a take-over can never
    // interleave with the append it is answering.
    takeOver: (docId, doc, seq) =>
      serialise(docId, async () => {
        return requireWrite(
          await writeSession(docId, { doc, seq, tail: [] } satisfies StoredSession),
        );
      }),
  };
  return adapter;
}
