import {
  builderError,
  type BuilderSite,
  type PersistedSiteSession,
  type PersistenceAck,
  type SitePersistenceAdapter,
  type Transaction,
} from '@craftkit/builder';

import { vaultWriteAcknowledgement, type VaultStore } from './store';

/** Exactly the kernel's `PersistedSiteSession`, as one storable record. */
interface StoredSiteSession {
  site: BuilderSite;
  seq: number;
  tail: Transaction[];
  /** Rebuildable last-good identities only; source remains inside `site.codeProjects`. */
  artifacts?: Record<string, SiteArtifactMetadata>;
}

export interface SiteArtifactMetadata {
  readonly artifactId: string;
  readonly projectId: string;
  readonly pageId: string;
  readonly sourceRevision: string;
  readonly sourceFingerprint: string;
  readonly dependencyFingerprint: string;
  readonly compilerFingerprint: string;
  readonly runtimeFingerprint: string;
  readonly catalogFingerprint: string;
  readonly routeEntries: Readonly<Record<string, string>>;
  readonly createdAt: number;
}

export interface SiteSourceDownload {
  readonly fileName: string;
  readonly mediaType: 'application/json';
  readonly contents: string;
}

/** A dependency-free recovery payload that preserves every source byte, valid or invalid. */
export function createSiteSourceDownload(siteId: string, site: BuilderSite): SiteSourceDownload {
  const stem =
    siteId
      .trim()
      .replace(/[^a-z0-9._-]+/giu, '-')
      .replace(/^-+|-+$/g, '') || 'craftkit-project';
  return {
    fileName: `${stem}.craftkit.json`,
    mediaType: 'application/json',
    contents: JSON.stringify(site, null, 2),
  };
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
  append(
    siteId: string,
    txs: Transaction[],
    expectedSeq: number,
  ): Promise<{ seq: number; persistence: PersistenceAck }>;
  acknowledgement(siteId: string): PersistenceAck;
  snapshotAcknowledged(siteId: string, site: BuilderSite, seq: number): Promise<PersistenceAck>;
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
  takeOverSite(siteId: string, site: BuilderSite, seq: number): Promise<PersistenceAck>;
  /** Latest successful artifact identity per page. The artifact body remains rebuildable. */
  loadArtifactMetadata(siteId: string): Promise<Readonly<Record<string, SiteArtifactMetadata>>>;
  saveArtifactMetadata(siteId: string, metadata: SiteArtifactMetadata): Promise<void>;
  removeArtifactMetadata(siteId: string, pageId: string): Promise<void>;
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
  const acknowledgements = new Map<string, PersistenceAck>();

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
    const session = stored ?? { site: await seed(siteId), seq: 0, tail: [] };
    if (!acknowledgements.has(siteId)) {
      acknowledgements.set(
        siteId,
        store.persistence?.(session.seq) ?? { kind: 'durable', sequence: session.seq },
      );
    }
    return session;
  }

  async function writeSession(siteId: string, session: StoredSiteSession): Promise<PersistenceAck> {
    let acknowledgement: PersistenceAck;
    try {
      acknowledgement = vaultWriteAcknowledgement(
        store,
        await store.set(siteSessionKey(siteId), session, session.seq),
        session.seq,
      );
    } catch (error) {
      acknowledgement = {
        kind: 'failed',
        sequence: acknowledgements.get(siteId)?.sequence ?? Math.max(0, session.seq - 1),
        reason: error instanceof Error ? error.message : String(error),
        recoverable: true,
      };
    }
    acknowledgements.set(siteId, acknowledgement);
    return acknowledgement;
  }

  function requireWrite(acknowledgement: PersistenceAck): PersistenceAck {
    if (acknowledgement.kind === 'failed') throw new Error(acknowledgement.reason);
    return acknowledgement;
  }

  const adapter: VaultSitePersistenceAdapter = {
    acknowledgement(siteId) {
      return (
        acknowledgements.get(siteId) ?? store.persistence?.(0) ?? { kind: 'durable', sequence: 0 }
      );
    },

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
          ...(session.artifacts === undefined ? {} : { artifacts: session.artifacts }),
        };
        // Nothing was written before the conflict check, so a rejection leaves
        // the stored history byte-identical.
        const persistence = requireWrite(await writeSession(siteId, next));
        return { seq: next.seq, persistence };
      }),

    snapshot: (siteId: string, site: BuilderSite, seq: number) =>
      serialise(siteId, async () => {
        const session = await readSession(siteId);
        if (session.seq !== seq) {
          return;
        }
        requireWrite(
          await writeSession(siteId, {
            site,
            seq,
            tail: [],
            ...(session.artifacts === undefined ? {} : { artifacts: session.artifacts }),
          } satisfies StoredSiteSession),
        );
      }),

    snapshotAcknowledged: (siteId: string, site: BuilderSite, seq: number) =>
      serialise(siteId, async () => {
        const session = await readSession(siteId);
        if (session.seq !== seq) return adapter.acknowledgement(siteId);
        return writeSession(siteId, {
          site,
          seq,
          tail: [],
          ...(session.artifacts === undefined ? {} : { artifacts: session.artifacts }),
        });
      }),

    takeOverSite: (siteId: string, site: BuilderSite, seq: number) =>
      serialise(siteId, async () => {
        const session = await readSession(siteId);
        return requireWrite(
          await writeSession(siteId, {
            site,
            seq,
            tail: [],
            ...(session.artifacts === undefined ? {} : { artifacts: session.artifacts }),
          } satisfies StoredSiteSession),
        );
      }),

    loadArtifactMetadata: (siteId: string) =>
      serialise(siteId, async () => {
        const session = await readSession(siteId);
        return Object.fromEntries(
          Object.entries(session.artifacts ?? {}).map(([pageId, metadata]) => [
            pageId,
            structuredClone(metadata),
          ]),
        );
      }),

    saveArtifactMetadata: (siteId: string, metadata: SiteArtifactMetadata) =>
      serialise(siteId, async () => {
        validateArtifactMetadata(metadata);
        const session = await readSession(siteId);
        requireWrite(
          await writeSession(siteId, {
            ...session,
            artifacts: {
              ...session.artifacts,
              [metadata.pageId]: structuredClone(metadata),
            },
          } satisfies StoredSiteSession),
        );
      }),

    removeArtifactMetadata: (siteId: string, pageId: string) =>
      serialise(siteId, async () => {
        const session = await readSession(siteId);
        if (session.artifacts?.[pageId] === undefined) return;
        const artifacts = Object.fromEntries(
          Object.entries(session.artifacts).filter(([candidate]) => candidate !== pageId),
        );
        const next: StoredSiteSession = { ...session, artifacts };
        if (Object.keys(artifacts).length === 0) delete next.artifacts;
        requireWrite(await writeSession(siteId, next));
      }),
  };
  return adapter;
}

function validateArtifactMetadata(metadata: SiteArtifactMetadata): void {
  const required = [
    metadata.artifactId,
    metadata.projectId,
    metadata.pageId,
    metadata.sourceRevision,
    metadata.sourceFingerprint,
    metadata.dependencyFingerprint,
    metadata.compilerFingerprint,
    metadata.runtimeFingerprint,
    metadata.catalogFingerprint,
  ];
  if (
    required.some((value) => value.length === 0) ||
    !Number.isFinite(metadata.createdAt) ||
    metadata.createdAt < 0
  ) {
    throw new TypeError('Artifact metadata must contain complete finite revision identity.');
  }
}
