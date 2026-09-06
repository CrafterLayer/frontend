import {
  canonicalJsonStringify,
  openDocument,
  sha256Hex,
  type OpenDocumentOptions,
  type BuilderDocument,
  type BuilderKernel,
  type BuilderSite,
  type TrustedExtensionManifest,
} from '@craftkit/builder';

import { sessionKey, type VaultPersistenceAdapter } from './persistence';
import type { VaultStore } from './store';

/**
 * A scratch document a run writes into, so the live page is never half built.
 *
 * ## Why a stored draft and not an in-memory kernel
 *
 * An in-memory scratch kernel would give isolation and nothing else. A build is
 * minutes long; a reload in the middle of one loses everything it had done, and
 * "reload during a long run" is not an edge case — it is what a person does
 * when they think something has hung. A draft that lives in the vault survives
 * that, which is what makes Resume possible at all.
 *
 * ## How it is seeded, and why it looks roundabout
 *
 * `takeOver(draftId, live, 0)` and THEN `openDocument`. The obvious route —
 * `createBuilder({ document, persistence })` followed by `flush()` — does not
 * store the seed: `flush()` returns early with no pending transactions, so the
 * document the kernel was built with never reaches storage. Worse than storing
 * nothing: the first real dispatch DOES get appended, on top of whatever base
 * the adapter falls back to, and the draft then either opens as a plausible
 * document that was never the page being edited, or fails to open at all. Both
 * are pinned in `drafts.spike.test.ts`.
 */

/** The one key a draft's session lives under. Matches `sessionKey`'s shape. */
export const draftDocId = (runId: string): string => `draft:${runId}`;

/** Where a draft's metadata lives — beside the session, never inside it. */
const draftMetaKey = (runId: string): string => `vault/draft/${runId}`;

const DRAFT_META_PREFIX = 'vault/draft/';

/** How long an abandoned draft is kept before the next boot sweeps it. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** How many drafts are kept at once, newest first, whatever their age. */
export const DRAFT_LIMIT = 5;

export interface DraftMeta {
  readonly runId: string;
  /**
   * What the live document looked like when this run started.
   *
   * The whole point of the draft: a commit compares this against the live
   * document as it stands and refuses if they differ. Without it a run that
   * took four minutes would overwrite four minutes of a person's own edits and
   * call it success.
   */
  readonly baseFingerprint: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * A site or a document, fingerprinted the same way.
 *
 * Prefixed with what it is, so two fingerprints of different KINDS can never
 * compare equal by accident — a bare hash of `{}` is the same string whether it
 * came from an empty document or an empty site.
 */
export function fingerprintDocument(document: BuilderDocument): string {
  return `doc-v1-sha256-${sha256Hex(canonicalJsonStringify(document))}`;
}

export function fingerprintSite(site: BuilderSite): string {
  return `site-v1-sha256-${sha256Hex(canonicalJsonStringify(site))}`;
}

export interface DraftsOptions {
  readonly store: VaultStore;
  readonly adapter: VaultPersistenceAdapter;
  /** Time comes from the caller. Nothing in this file reads a clock. */
  readonly now: () => number;
  readonly extensions?: readonly TrustedExtensionManifest[];
  readonly ports?: OpenDocumentOptions['ports'];
}

export interface OpenedDraft {
  readonly kernel: BuilderKernel;
  readonly meta: DraftMeta;
}

export interface Drafts {
  /** Seed a draft from the live document and open a kernel bound to it. */
  create(runId: string, live: BuilderDocument): Promise<OpenedDraft>;
  /** Re-open a draft that already exists, transactions included. */
  resume(runId: string): Promise<OpenedDraft | undefined>;
  /** Every draft the vault is holding, newest first. */
  list(): Promise<readonly DraftMeta[]>;
  /** Record that a run touched its draft, so the sweep sees it as live. */
  touch(runId: string): Promise<void>;
  /** Forget one draft: its metadata and its session. */
  discard(runId: string): Promise<void>;
  /**
   * Drop what is too old or too many, and report what went.
   *
   * Run at boot rather than on a timer: a draft is only ever abandoned by a tab
   * that closed, and the next boot is the first moment anything is in a
   * position to notice.
   */
  sweep(): Promise<readonly string[]>;
}

export function createDrafts(options: DraftsOptions): Drafts {
  const { store, adapter, now } = options;

  const openKernel = async (runId: string): Promise<BuilderKernel> =>
    openDocument(adapter, draftDocId(runId), {
      extensions: [...(options.extensions ?? [])],
      ...(options.ports === undefined ? {} : { ports: options.ports }),
    });

  const readMeta = async (runId: string): Promise<DraftMeta | undefined> =>
    store.get<DraftMeta>(draftMetaKey(runId));

  const writeMeta = async (meta: DraftMeta): Promise<void> => {
    await store.set(draftMetaKey(meta.runId), meta);
  };

  const drafts: Drafts = {
    async create(runId, live) {
      /*
        The fingerprint is taken from the document handed in, BEFORE anything
        is stored — not read back from the draft afterwards. Reading it back
        would fingerprint the copy, which is trivially equal to itself and
        proves nothing about the live page a commit will later land on.
      */
      const baseFingerprint = fingerprintDocument(live);
      await adapter.takeOver(draftDocId(runId), live, 0);
      const at = now();
      const meta: DraftMeta = { runId, baseFingerprint, createdAt: at, updatedAt: at };
      await writeMeta(meta);
      return { kernel: await openKernel(runId), meta };
    },

    async resume(runId) {
      const meta = await readMeta(runId);
      if (meta === undefined) return undefined;
      return { kernel: await openKernel(runId), meta };
    },

    async list() {
      const keys = await store.keys(DRAFT_META_PREFIX);
      const metas = await Promise.all(keys.map((key) => store.get<DraftMeta>(key)));
      return metas
        .filter((meta): meta is DraftMeta => meta !== undefined)
        .sort((left, right) => right.updatedAt - left.updatedAt);
    },

    async touch(runId) {
      const meta = await readMeta(runId);
      /*
        Silently nothing when the draft is gone. `touch` is a checkpoint on a
        run that is already in flight, and a run whose draft was swept out from
        under it has a real problem — but that problem is not this call's to
        raise, and throwing here would turn a bookkeeping write into a way to
        kill a build.
      */
      if (meta === undefined) return;
      await writeMeta({ ...meta, updatedAt: now() });
    },

    async discard(runId) {
      await store.remove(draftMetaKey(runId));
      /*
        `sessionKey`, not a string built here. The persistence file owns that
        shape and says so; a second spelling of it in this file would go stale
        the first time it moved, and the failure would be a draft's session
        left behind forever with nothing pointing at it.
      */
      await store.remove(sessionKey(draftDocId(runId)));
    },

    async sweep() {
      const all = await drafts.list();
      const cutoff = now() - DRAFT_TTL_MS;
      /*
        Age first, then count. A draft that is both too old and beyond the limit
        must be reported once, not twice, and running the two rules in one pass
        over an already-sorted list is what keeps that true.
      */
      const doomed = all.filter((meta, index) => meta.updatedAt < cutoff || index >= DRAFT_LIMIT);
      for (const meta of doomed) {
        await drafts.discard(meta.runId);
      }
      return doomed.map((meta) => meta.runId);
    },
  };

  return drafts;
}
