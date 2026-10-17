import type { z } from 'zod';

import type { BuilderDocument, DataPath, Surface } from './document/types';
import type { BuilderSite } from './site/types';
import type { Transaction } from './transactions';

/** Law D: time is an injected capability. */
export interface ClockPort {
  now(): number;
}

/** Law D: identity is an injected capability. */
export interface IdPort {
  newId(): string;
}

export interface PersistedSession {
  doc: BuilderDocument;
  seq: number;
  /** Transactions recorded after the snapshot `doc` represents. */
  tail: Transaction[];
}

/**
 * The only contact with storage. `append` uses optimistic concurrency: a stale
 * `expectedSeq` rejects with `persist/seq-conflict` and never touches the stored
 * history.
 */
export interface PersistenceAdapter {
  load(docId: string): Promise<PersistedSession>;
  append(docId: string, txs: Transaction[], expectedSeq: number): Promise<{ seq: number }>;
  snapshot?(docId: string, doc: BuilderDocument, seq: number): Promise<void>;
}

/** A stored site: the snapshot, its position, and everything recorded after it. */
export interface PersistedSiteSession {
  site: BuilderSite;
  seq: number;
  /** Transactions recorded after the snapshot `site` represents. */
  tail: Transaction[];
}

/**
 * The site's only contact with storage — the same optimistic-concurrency
 * contract as `PersistenceAdapter`, over a site root.
 *
 * A SEPARATE interface rather than a generic one: the two roots are stored
 * under different keys, migrated by different runners, and validated by
 * different validators. A single generic adapter would let a document be
 * appended to a site's log, and the failure would surface as a patch path that
 * does not resolve, arbitrarily far from the mistake.
 *
 * One log for the whole site is the point. A group that edits three pages
 * appends ONCE; with a log per page, a conflict on page 3 — after pages 1 and 2
 * already appended — is a torn write that `persist/seq-conflict` cannot express.
 */
export interface SitePersistenceAdapter {
  load(siteId: string): Promise<PersistedSiteSession>;
  append(siteId: string, txs: Transaction[], expectedSeq: number): Promise<{ seq: number }>;
  snapshot?(siteId: string, site: BuilderSite, seq: number): Promise<void>;
}

export interface ResolveCtx {
  surface: Surface;
  locale: string;
  signal?: AbortSignal;
}

/** Named data source; resolution is out of scope for B0, the contract is not. */
export interface DataSource {
  id: 'mock' | 'engine' | 'releaseo' | (string & {});
  resolve(path: DataPath, ctx: ResolveCtx): Promise<unknown>;
  /** Powers the mapping UI and binding validation (B1+). */
  schema(path: DataPath): z.ZodType | undefined;
  subscribe?(path: DataPath, cb: (value: unknown) => void): () => void;
}
