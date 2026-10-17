/**
 * CHECKPOINTS (2026-10-12): the page as it was before each request the Agent ran, so any of
 * them can be taken back — from the record's menu ("Restore the page to before this
 * request") or from the Checkpoints list — and a checkpoint the person saves on purpose.
 *
 * The panel names only this port; the host keeps the pages (the playground's vault shelf).
 * Restoring is one forward change on the page, so it can itself be undone with one Undo.
 */
import type { BuilderDocument } from '@craftkit/builder';

export interface AgentCheckpoint {
  readonly id: string;
  /** The request it was taken before, or the person's own name for it. */
  readonly label: string;
  /** Epoch ms. */
  readonly at: number;
  /** `auto`: before a request; `manual`: saved on purpose. */
  readonly kind: 'auto' | 'manual';
}

export type CheckpointRestore = 'restored' | 'unchanged' | 'missing' | 'failed';

export interface AgentCheckpointPort {
  /** Keep the page as it was before the request of `turnId` (best effort; never throws). */
  readonly before: (turnId: string, label: string, document: BuilderDocument) => void;
  /** Restore the page to before `turnId`'s request. */
  readonly restoreBefore: (turnId: string) => Promise<CheckpointRestore>;
  /** Every checkpoint, newest first. */
  readonly list: () => Promise<readonly AgentCheckpoint[]>;
  readonly restore: (id: string) => Promise<CheckpointRestore>;
  /** Save the page now under the person's name for it. */
  readonly save: (label: string) => Promise<AgentCheckpoint | undefined>;
  /** Called when the list changed (a save, an eviction). */
  readonly subscribe: (listener: () => void) => () => void;
}
