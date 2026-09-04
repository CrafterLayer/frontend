import {
  builderError,
  type BuilderSite,
  type PersistedSiteSession,
  type SitePersistenceAdapter,
  type Transaction,
} from '@craftkit/builder';

import type { VaultStore } from './store';

/** Exactly the kernel's `PersistedSiteSession`, as one storable record. */
interface StoredSiteSession {
  site: BuilderSite;
  seq: number;
  tail: Transaction[];
}

/**
 * The one key a site's session lives under — EXACT, never a prefix.
 *
 * A different namespace from `vault/session/`, on purpose: a site and a document
 * are different roots with different validators, and sharing a key space would
 * let one be loaded as the other. The failure would surface much later as a
 * patch path that does not resolve.
 */
export const siteSessionKey = (siteId: string): string => `vault/site/${siteId}`;

export interface VaultSitePersistenceAdapter extends SitePersistenceAdapter {
  /**
   * Re-base the stored session onto THIS kernel's position: store `site` at
   * `seq` with an empty tail, whatever the store currently holds.
   *
   * The same door, and the same reasoning, as the document adapter's: a
   * rejection is not an answer, because a kernel that loses the race can never
   * append again. Unconditional, last-writer-wins between two tabs, and
   * deliberately not part of `SitePersistenceAdapter` — only the boot that owns
   * the session may re-base it, and it is expected to SAY so.
   */
  takeOverSite(siteId: string, site: BuilderSite, seq: number): Promise<void>;
}

export interface VaultSitePersistenceOptions {
  readonly store: VaultStore;
  /** Called only when nothing is stored for that siteId. */
  readonly seed: (siteId: string) => Promise<BuilderSite> | BuilderSite;
}

/**
 * The kernel's `SitePersistenceAdapter` over a `VaultStore`.
 *
 * Semantics identical to the document adapter — `seq` counts TRANSACTIONS ever
 * appended, a stale `expectedSeq` rejects with `persist/seq-conflict` and leaves
 * the stored history untouched, compaction only happens AT the current position,
 * and every write for a siteId is SERIALISED because a real async store can
 * interleave two read-modify-writes and lose one.
 *
 * `seed` may be asynchronous here and is not in the document adapter, for one
 * reason: a site's first boot may have to LIFT an existing document session out
 * of the same store, and that is a read.
 */
export function createVaultSitePersistence(
  options: VaultSitePersistenceOptions,
): VaultSitePersistenceAdapter {
  const { store, seed } = options;
  const chains = new Map<string, Promise<void>>();

  /*
    One chain per site, built with `then(work, work)` and kept settled-either-way
    so a rejected append — a seq conflict is a normal outcome, not a bug — cannot
    poison it and silently swallow every later write.
  */
  function serialise<T>(siteId: string, work: () => Promise<T>): Promise<T> {
    const previous = chains.get(siteId) ?? Promise.resolve();
    const result = previous.then(work, work);
    chains.set(
      siteId,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }

  /** First boot is an empty history over the seed — never an error. */
  async function readSession(siteId: string): Promise<StoredSiteSession> {
    const stored = await store.get<StoredSiteSession>(siteSessionKey(siteId));
    if (stored !== undefined) return stored;
    return { site: await seed(siteId), seq: 0, tail: [] };
  }

  return {
    load: (siteId: string) =>
      serialise(siteId, async (): Promise<PersistedSiteSession> => {
        const session = await readSession(siteId);
        return { site: session.site, seq: session.seq, tail: [...session.tail] };
      }),

    append: (siteId: string, txs: Transaction[], expectedSeq: number) =>
      serialise(siteId, async () => {
        const session = await readSession(siteId);
        if (session.seq !== expectedSeq) {
          // The SAME error the document adapter raises, down to the meta —
          // callers branch on `code`, and a second dialect would break them.
          throw builderError(
            'persist/seq-conflict',
            `Append expected position ${String(expectedSeq)}, but the store is at ${String(session.seq)}.`,
            undefined,
            { expected: expectedSeq, actual: session.seq },
          );
        }
        const next: StoredSiteSession = {
          site: session.site,
          seq: session.seq + txs.length,
          tail: [...session.tail, ...txs],
        };
        // Nothing was written before the conflict check, so a rejection leaves
        // the stored history byte-identical.
        await store.set(siteSessionKey(siteId), next);
        return { seq: next.seq };
      }),

    snapshot: (siteId: string, site: BuilderSite, seq: number) =>
      serialise(siteId, async () => {
        const session = await readSession(siteId);
        if (session.seq !== seq) {
          return;
        }
        await store.set(siteSessionKey(siteId), { site, seq, tail: [] } satisfies StoredSiteSession);
      }),

    takeOverSite: (siteId: string, site: BuilderSite, seq: number) =>
      serialise(siteId, async () => {
        await store.set(siteSessionKey(siteId), {
          site,
          seq,
          tail: [],
        } satisfies StoredSiteSession);
      }),
  };
}
