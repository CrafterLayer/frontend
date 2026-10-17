import type { BuilderDocument, BuilderKernel } from '@craftkit/builder';

import type {
  AgentCheckpoint,
  AgentCheckpointPort,
  CheckpointRestore,
} from '../features/agent/model/checkpoints';
import { restoreDocument } from '../features/vault/restore';
import type { SnapshotShelf, VaultSnapshotMeta } from '../features/vault/snapshots';

/** Which checkpoint was taken before which request, kept per viewer across reloads. */
export const AGENT_CHECKPOINT_TURNS_KEY = 'pg-agent-checkpoint-turns-v1';
const MAX_REMEMBERED_TURNS = 100;
const MAX_LABEL = 120;

export interface CheckpointTurnStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

export interface AgentCheckpointsOptions {
  readonly shelf: SnapshotShelf;
  /** The page the agent writes, which a restore writes back to. */
  readonly kernel: BuilderKernel;
  readonly now?: (() => number) | undefined;
  readonly storage?: CheckpointTurnStorage | undefined;
  /** "Restore: {label}", the history line a restore writes. */
  readonly restoreLabel?: ((label: string) => string) | undefined;
}

function readTurns(storage: CheckpointTurnStorage | undefined): Map<string, string> {
  try {
    const text = storage?.getItem(AGENT_CHECKPOINT_TURNS_KEY) ?? null;
    const parsed: unknown = text === null ? [] : JSON.parse(text);
    if (!Array.isArray(parsed)) return new Map();
    const pairs = parsed.filter(
      (pair): pair is [string, string] =>
        Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string',
    );
    return new Map(pairs);
  } catch {
    return new Map();
  }
}

function checkpointOf(meta: VaultSnapshotMeta): AgentCheckpoint {
  return { id: meta.id, label: meta.label, at: meta.ts, kind: meta.kind ?? 'manual' };
}

function shortLabel(label: string): string {
  const flat = label.replace(/\s+/gu, ' ').trim();
  return flat.length <= MAX_LABEL ? flat : `${flat.slice(0, MAX_LABEL - 1).trimEnd()}…`;
}

/**
 * The agent's checkpoints over the page's restore-point shelf (2026-10-12). The page is kept
 * as an `auto` snapshot before every build and edit, and a person's own save is `manual` —
 * the same shelf the rail's History lists, so both places show one truth. A restore is one
 * forward transaction (`restoreDocument`): a mistaken restore is one Undo away.
 */
export function createAgentCheckpoints(options: AgentCheckpointsOptions): AgentCheckpointPort {
  const { shelf, kernel, storage } = options;
  const now = options.now ?? Date.now;
  const turns = readTurns(storage);
  const listeners = new Set<() => void>();
  // Saves land in order, and a restore waits for the save of its own request.
  let pending: Promise<void> = Promise.resolve();

  const changed = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const rememberTurn = (turnId: string, id: string): void => {
    turns.delete(turnId);
    turns.set(turnId, id);
    while (turns.size > MAX_REMEMBERED_TURNS) {
      const oldest = turns.keys().next().value;
      if (oldest === undefined) break;
      turns.delete(oldest);
    }
    try {
      storage?.setItem(AGENT_CHECKPOINT_TURNS_KEY, JSON.stringify([...turns]));
    } catch {
      // Blocked storage: the checkpoints still serve this session.
    }
  };
  const keep = (label: string, document: BuilderDocument, kind: 'auto' | 'manual') =>
    shelf.save({
      label: shortLabel(label),
      ts: now(),
      seq: kernel.context.store.getState().seq,
      document,
      kind,
    });

  const restore = async (id: string): Promise<CheckpointRestore> => {
    const snapshot = await shelf.read(id).catch(() => undefined);
    if (snapshot === undefined) return 'missing';
    const label = options.restoreLabel?.(snapshot.label) ?? `Restore: ${snapshot.label}`;
    const outcome = restoreDocument(kernel, snapshot.document, { author: 'user', label });
    if (!outcome.ok) return 'failed';
    return outcome.changed ? 'restored' : 'unchanged';
  };

  return {
    before: (turnId, label, document) => {
      pending = pending.then(async () => {
        try {
          const meta = await keep(label, document, 'auto');
          rememberTurn(turnId, meta.id);
          changed();
        } catch {
          // A checkpoint is a safety net: failing to keep one never fails the request.
        }
      });
    },
    restoreBefore: async (turnId) => {
      await pending;
      const id = turns.get(turnId);
      return id === undefined ? 'missing' : restore(id);
    },
    list: async () => {
      // A point kept a moment ago is on the list it is read with.
      await pending;
      return (await shelf.list()).map(checkpointOf);
    },
    restore,
    save: (label) => {
      const document = kernel.getDocument();
      const saved = pending.then(async () => {
        try {
          const meta = await keep(label, document, 'manual');
          changed();
          return checkpointOf(meta);
        } catch {
          return undefined;
        }
      });
      pending = saved.then(() => undefined);
      return saved;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
