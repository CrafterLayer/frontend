import type { Author } from './document/types';

export type PatchOp = 'add' | 'remove' | 'replace';

/** Immer-compatible patch (verified against immer 11's published shape). */
export interface Patch {
  op: PatchOp;
  path: (string | number)[];
  value?: unknown;
}

/**
 * The audit unit. Every observable document change is exactly one transaction
 * (Law S); `id` and `ts` come only from the injected ports (Law D).
 */
export interface Transaction {
  id: string;
  command: string;
  author: Author;
  /** Forward change set — appended to the log. */
  patches: Patch[];
  /** Inverse change set — undo for free. */
  inverse: Patch[];
  ts: number;
}
