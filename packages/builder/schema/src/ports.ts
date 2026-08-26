import type { z } from 'zod';

import type { BuilderDocument, DataPath, Surface } from './document/types';
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
