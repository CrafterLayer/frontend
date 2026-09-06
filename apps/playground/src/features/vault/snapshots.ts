import type { BuilderDocument } from '@craftkit/builder';

import type { VaultStore } from './store';

/**
 * Who asked for this restore point.
 *
 * `manual` is a person pressing save. `auto` is one the product took on their
 * behalf — today, the snapshot before a writing run, so "undo the whole
 * generation" has a known state to go back to.
 *
 * The distinction earns its place by giving each kind its OWN cap. Sharing one
 * meant a build of twelve sections could push a person's own restore points off
 * the end of the shelf, and — worse in the other direction — a run of ordinary
 * saves could evict the pre-run snapshot the generation undo depends on, so the
 * button stayed on screen pointing at nothing.
 */
export type VaultSnapshotKind = 'manual' | 'auto';

export interface VaultSnapshotMeta {
  readonly id: string;
  readonly label: string;
  readonly ts: number;
  readonly seq: number;
  /** Serialised size of `document`, in UTF-8 bytes. */
  readonly bytes: number;
  /**
   * Absent on a shelf written before kinds existed, and read as `manual`.
   *
   * Optional rather than back-filled: nothing in an old entry says which it
   * was, and every one of them WAS a person pressing save, because nothing else
   * could write to the shelf then.
   */
  readonly kind?: VaultSnapshotKind;
}

export interface VaultSnapshot extends VaultSnapshotMeta {
  readonly document: BuilderDocument;
}

export interface SnapshotShelf {
  save(entry: {
    readonly label: string;
    readonly ts: number;
    readonly seq: number;
    readonly document: BuilderDocument;
    /** Defaults to `manual`: the shelf's original and still commonest writer. */
    readonly kind?: VaultSnapshotKind;
  }): Promise<VaultSnapshotMeta>;
  /** Newest first, both kinds together. */
  list(): Promise<readonly VaultSnapshotMeta[]>;
  read(id: string): Promise<VaultSnapshot | undefined>;
  clear(): Promise<void>;
}

export interface SnapshotShelfOptions {
  readonly store: VaultStore;
  readonly docId: string;
  readonly maxCount?: number;
  readonly maxBytes?: number;
  /** How many `auto` snapshots are kept, on their own budget. */
  readonly maxAutoCount?: number;
}

const DEFAULT_MAX_COUNT = 20;
const DEFAULT_MAX_BYTES = 4_000_000;

/**
 * Few, deliberately. An automatic snapshot is only ever useful for the run it
 * preceded, and the run before that; keeping twenty would spend a person's
 * storage on states nobody will ask for.
 */
const DEFAULT_MAX_AUTO_COUNT = 3;

/**
 * The USER-facing shelf: labelled restore points a person made on purpose,
 * newest first, capped by count AND by total bytes with the oldest evicted
 * first. This is not the kernel's compaction hook (`PersistenceAdapter.snapshot`
 * in ./persistence.ts) — that one keeps replay cheap and is invisible.
 *
 * The metadata index is stored apart from the bodies so `list()` costs one read
 * instead of deserialising every document a person ever kept.
 */
export function createSnapshotShelf(options: SnapshotShelfOptions): SnapshotShelf {
  const { store, docId } = options;
  const maxCount = options.maxCount ?? DEFAULT_MAX_COUNT;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxAutoCount = options.maxAutoCount ?? DEFAULT_MAX_AUTO_COUNT;

  const prefix = `vault/shelf/${docId}/`;
  const indexKey = `${prefix}index`;
  const bodyKey = (id: string): string => `${prefix}entry/${id}`;

  // A shelf write is a read-modify-write over the index; two of them in flight
  // at once would lose one. Same law as the persistence adapter.
  let chain: Promise<void> = Promise.resolve();
  function serialise<T>(work: () => Promise<T>): Promise<T> {
    const result = chain.then(work, work);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function readIndex(): Promise<VaultSnapshotMeta[]> {
    const stored = await store.get<VaultSnapshotMeta[]>(indexKey);
    return stored === undefined ? [] : [...stored];
  }

  return {
    save: (entry) =>
      serialise(async () => {
        const index = await readIndex();
        const bytes = measure(entry.document);
        const kind: VaultSnapshotKind = entry.kind ?? 'manual';
        const meta: VaultSnapshotMeta = {
          id: nextId(entry.ts, new Set(index.map(({ id }) => id))),
          label: entry.label,
          ts: entry.ts,
          seq: entry.seq,
          bytes,
          kind,
        };
        const body: VaultSnapshot = { ...meta, document: entry.document };
        await store.set(bodyKey(meta.id), body);

        // Newest at the head; eviction always takes from the tail, so the entry
        // just saved can never be the one thrown away.
        const kept = [meta, ...index];
        const evicted: VaultSnapshotMeta[] = [];
        const evictOldest = (): void => {
          const gone = kept.pop();
          if (gone !== undefined) {
            evicted.push(gone);
          }
        };
        /*
          The AUTO budget first, and only over auto entries.

          Each kind pays for itself. A twelve-section build must not push a
          person's own restore points off the shelf, and a run of ordinary saves
          must not evict the pre-run snapshot that "undo the whole generation"
          points at — a button that is still on screen and no longer works is
          worse than no button.
        */
        const evictOldestOfKind = (target: VaultSnapshotKind): void => {
          for (let index = kept.length - 1; index >= 0; index -= 1) {
            if (kindOf(kept[index]) !== target) continue;
            const [gone] = kept.splice(index, 1);
            if (gone !== undefined) evicted.push(gone);
            return;
          }
        };
        while (kept.filter((entry) => kindOf(entry) === 'auto').length > maxAutoCount) {
          evictOldestOfKind('auto');
        }
        while (kept.filter((entry) => kindOf(entry) === 'manual').length > maxCount) {
          evictOldestOfKind('manual');
        }
        // `kept.length > 1` is the deliberate floor: a single snapshot bigger
        // than the whole byte cap is still stored, because refusing to save is
        // worse than evicting it later.
        while (kept.length > 1 && totalBytes(kept) > maxBytes) {
          evictOldest();
        }

        for (const gone of evicted) {
          await store.remove(bodyKey(gone.id));
        }
        await store.set(indexKey, kept);
        return meta;
      }),

    list: () => serialise(async (): Promise<readonly VaultSnapshotMeta[]> => readIndex()),

    read: (id) => serialise(() => store.get<VaultSnapshot>(bodyKey(id))),

    clear: () =>
      serialise(async () => {
        // Sweep by PREFIX rather than by index: an index that lost an entry to a
        // half-finished write would otherwise strand that body forever.
        const owned = await store.keys(prefix);
        for (const key of owned) {
          await store.remove(key);
        }
      }),
  };
}

/** A shelf written before kinds existed held nothing but manual saves. */
export function kindOf(meta: VaultSnapshotMeta | undefined): VaultSnapshotKind {
  return meta?.kind ?? 'manual';
}

/**
 * Deterministic ids: the timestamp plus the lowest free ordinal. Two snapshots
 * taken on the same injected clock tick still get distinct, reproducible ids —
 * `Math.random` would make every stored shelf unreproducible.
 */
function nextId(ts: number, taken: ReadonlySet<string>): string {
  let ordinal = 0;
  let candidate = `${String(ts)}-${String(ordinal)}`;
  while (taken.has(candidate)) {
    ordinal += 1;
    candidate = `${String(ts)}-${String(ordinal)}`;
  }
  return candidate;
}

function measure(document: BuilderDocument): number {
  return new TextEncoder().encode(JSON.stringify(document)).length;
}

function totalBytes(entries: readonly VaultSnapshotMeta[]): number {
  return entries.reduce((sum, entry) => sum + entry.bytes, 0);
}
