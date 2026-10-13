import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  openSite,
  type BuilderKernel,
  type BuilderSite,
  type BuilderSiteKernel,
} from '@craftkit/builder';

import {
  playgroundDocument,
  playgroundExtensions,
  playgroundPorts,
  type PlaygroundFixture,
} from '../preview/create-playground-kernel';
import { createReferenceCodePageSite } from '../preview/code-page-fixture';
import {
  hydratePlaygroundTemplates,
  preloadPlaygroundTemplatesWhenIdle,
} from '../preview/playground-templates';
import {
  autosave,
  reasonOf,
  VAULT_DURABLE,
  type AutosaveTarget,
  type VaultSaveState,
} from './autosave';

export { VAULT_DURABLE, type VaultSaveState };
import { sessionKey } from './persistence';
import { createRunJournal, type RunJournal } from './run-journal';
import { createSourceRunJournal, type SourceRunJournal } from './source-run-journal';
import { seedSiteFrom, siteFromFixture } from './site-boot';
import { siteSafePorts } from './site-ids';
import {
  createVaultSitePersistence,
  createSiteSourceDownload,
  siteSessionKey,
  type SiteSourceDownload,
  type VaultSitePersistenceAdapter,
} from './site-persistence';
import { createSnapshotShelf, type SnapshotShelf } from './snapshots';
import { createIndexedDbVaultStore, type VaultStore } from './store';

/** How long after the open the vault's own template preload waits (the canvas usually asks first). */
const TEMPLATES_FALLBACK_MS = 4000;

export type VaultKernelState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      /**
       * This opening of this document — a new one after every "start over" and
       * every fixture change. What a host `key`s anything it keeps mounted
       * across boots on: the kernel underneath changes identity, and a panel
       * holding a conversation about the old one has no way to notice.
       */
      readonly bootId: string;
      /**
       * The CURRENT page, as an ordinary kernel.
       *
       * Every surface in the app takes a `BuilderKernel` and does not need to
       * learn that a site exists. This is a lens over the site below, so the two
       * share one store, one transaction log and one history — switching pages
       * hands out a different lens, never a different session.
       */
      readonly kernel: BuilderKernel;
      /** The whole site, for the surfaces that need one — the page list. */
      readonly siteKernel: BuilderSiteKernel;
      readonly restored: boolean;
      readonly shelf: SnapshotShelf;
      readonly save: VaultSaveState;
      readonly vault: VaultSession;
      readonly startOver: () => void;
    }
  | {
      readonly status: 'failed';
      readonly reason: string;
      /** Open the stored page again. Deletes nothing — the recoverable door. */
      readonly retry: () => void;
      readonly startOver: () => void;
    };

export interface VaultSession {
  readonly store: VaultStore;
  readonly sitePersistence: VaultSitePersistenceAdapter;
  readonly runJournal: RunJournal;
  readonly sourceRunJournal: SourceRunJournal;
  readonly downloadSource: () => SiteSourceDownload;
  readonly retryPersistence: () => Promise<VaultSaveState>;
}

export interface UseVaultKernelOptions {
  /**
   * The storage port. The app leaves this out and gets IndexedDB (degrading to
   * memory); tests and stories hand in a memory store so a boot is a fact
   * rather than a browser feature.
   */
  readonly store?: VaultStore;
}

/**
 * One stored document per fixture. Sharing an id across the picker would let a
 * landing page a person edited yesterday open under "Empty" today — a harness
 * control silently deciding what document you are looking at.
 */
export function vaultDocId(fixture: PlaygroundFixture): string {
  return `playground/${fixture}`;
}

interface OpenedSession {
  readonly siteKernel: BuilderSiteKernel;
  readonly adapter: VaultSitePersistenceAdapter;
  /** False when nothing was stored at all and the fixture became the home page. */
  readonly restored: boolean;
}

interface BootSession {
  readonly adapter: VaultSitePersistenceAdapter;
  readonly opening: Promise<OpenedSession>;
}

type Boot =
  | { readonly key: string; readonly ok: true; readonly session: OpenedSession }
  | { readonly key: string; readonly ok: false; readonly reason: string };

/** The site session, as the root-generic save loop sees it. */
function siteTarget(
  siteKernel: BuilderSiteKernel,
  adapter: VaultSitePersistenceAdapter,
  siteId: string,
): AutosaveTarget<BuilderSite> {
  return {
    getRoot: () => siteKernel.getSite(),
    /*
      Read from the CURRENT page's lens, which is the one seat that publishes
      `seq`. Every lens reports the same number — there is one store — so which
      page happens to be current cannot change the position a re-base uses.
    */
    getSeq: () => siteKernel.page(siteKernel.currentPage()).context.store.getState().seq,
    flush: () => siteKernel.flush(),
    subscribe: (listener) => siteKernel.subscribe(listener),
    snapshot: async (site, seq) => {
      return adapter.snapshotAcknowledged(siteId, site, seq);
    },
    takeOver: (site, seq) => adapter.takeOverSite(siteId, site, seq),
    acknowledgement: () => adapter.acknowledgement(siteId),
  };
}

function startSession(store: VaultStore, fixture: PlaygroundFixture, docId: string): BootSession {
  /*
    `seed` is the vault's first-boot answer, and it doubles as the only honest
    way to know whether anything was stored: the adapter calls it exactly when
    `load` found nothing. Asking the store directly would mean restating its key
    shape a second time.

    For a SITE the answer has one more step, and it is the one that matters most
    to a person upgrading: before falling back to the fixture, look for a
    document session they already have and LIFT it into the home page (FR-007).
    Finding a starter fixture where your page used to be is the worst possible
    first impression of a new version.
  */
  let seeded = false;
  const adapter = createVaultSitePersistence({
    store,
    seed: async () => {
      seeded = true;
      const result = await seedSiteFrom(store, docId, () =>
        fixture === 'code-page'
          ? createReferenceCodePageSite()
          : siteFromFixture(playgroundDocument(fixture)),
      );
      // A lift is a RESTORE: their work was found, just under the old shape.
      if (result.origin === 'lifted') {
        seeded = false;
      }
      return result.site;
    },
  });

  let siteKernel: BuilderSiteKernel | undefined;
  const opening = openSite(adapter, docId, {
    extensions: playgroundExtensions(fixture),
    // Clear of every page id and node id in the site, not just this page's (site-ids.ts).
    ports: siteSafePorts(
      playgroundPorts(() =>
        siteKernel === undefined
          ? undefined
          : siteKernel.page(siteKernel.currentPage()).getDocument(),
      ),
      () => siteKernel?.getSite(),
    ),
  }).then((opened) => {
    siteKernel = opened;
    /*
      AFTER the open: `openSite` validates internally, and templates are tier-2
      compositions rather than block types, so validation never saw them. The
      site's registry is shared by every page lens, so hydrating it once
      hydrates every page.

      The templates themselves load on demand (playground-templates.ts): when
      they are already here this registers them at once; otherwise they land in
      this registry the moment they arrive. Opening the site never waits for
      them. The canvas asks for them once it is live; this is the fallback
      for a session that never shows one (a code page), well clear of the boot.
    */
    hydratePlaygroundTemplates(opened);
    preloadPlaygroundTemplatesWhenIdle(TEMPLATES_FALLBACK_MS);
    return { siteKernel: opened, adapter, restored: !seeded };
  });

  return { adapter, opening };
}

/**
 * The playground's boot.
 *
 * `openDocument` is asynchronous — it reads storage, migrates, replays the tail
 * and validates twice before a kernel exists — so for the first time the app has
 * a state with no kernel in it. That state is not a detail to paper over: a save
 * written by an older vocabulary, or half-written by a browser that was closed,
 * must land somewhere a person can act on rather than taking the editor down.
 */
export function useVaultKernel(
  fixture: PlaygroundFixture,
  options: UseVaultKernelOptions = {},
): VaultKernelState {
  const [store] = useState<VaultStore>(() => options.store ?? createIndexedDbVaultStore());
  const [generation, setGeneration] = useState(0);
  const [boot, setBoot] = useState<Boot | undefined>(undefined);
  /*
    Not derived from the boot: a save happens long after the document opened,
    and it can fail at any point in a session that opened perfectly.
  */
  const [save, setSave] = useState<VaultSaveState>(VAULT_DURABLE);
  /*
    One entry per boot, so StrictMode's mount → unmount → mount cannot open the
    same document twice. Two opens over one stored document is not a wasted
    read: it is two kernels bound to the same adapter, and whichever one loses
    the race keeps autosaving over the one on screen.
  */
  const sessions = useRef(new Map<string, BootSession>());

  const docId = vaultDocId(fixture);
  const key = `${docId}#${String(generation)}`;
  /*
    The shelf belongs to the DOCUMENT, not to the boot: restore points survive a
    "start over", which is the whole reason they are worth keeping. Memoised
    because a fresh handle every render would restart every effect watching it.
  */
  // Ten automatic points: the agent keeps one before every request (2026-10-12).
  const shelf = useMemo(
    () => createSnapshotShelf({ store, docId, maxAutoCount: 10 }),
    [store, docId],
  );
  const runJournal = useMemo(() => createRunJournal({ store, now: Date.now }), [store]);
  const sourceRunJournal = useMemo(() => createSourceRunJournal({ store }), [store]);

  useEffect(() => {
    const cache = sessions.current;
    for (const stale of [...cache.keys()]) {
      if (stale !== key) {
        cache.delete(stale);
      }
    }
    const session = cache.get(key) ?? startSession(store, fixture, docId);
    cache.set(key, session);

    let live = true;
    let stopAutosave: (() => void) | undefined;
    session.opening.then(
      (opened) => {
        if (!live) {
          return;
        }
        stopAutosave = autosave(siteTarget(opened.siteKernel, session.adapter, docId), setSave);
        // A fresh boot starts even with storage, whatever the last one ended on.
        const acknowledgement = session.adapter.acknowledgement(docId);
        setSave({ ...acknowledgement, shared: false });
        setBoot({ key, ok: true, session: opened });
      },
      (error: unknown) => {
        if (!live) {
          return;
        }
        setBoot({ key, ok: false, reason: reasonOf(error) });
      },
    );

    return () => {
      live = false;
      stopAutosave?.();
    };
  }, [store, fixture, docId, key]);

  /**
   * Open the stored page AGAIN, and delete nothing.
   *
   * Not every failed boot is a broken document. A read that blipped, a database
   * momentarily held by another tab: the save is intact and the only thing that
   * went wrong was the attempt. Offering "start over" as the only answer to
   * those turns a recoverable moment into a permanent deletion, performed by
   * the person, on work that was never damaged.
   */
  const retry = useCallback(() => {
    setGeneration((current) => current + 1);
  }, []);

  const startOver = useCallback(() => {
    void (async () => {
      try {
        /*
          The EXACT key, never a prefix sweep. `store.keys('vault/session/…')`
          also matches every document whose id merely BEGINS with this one, so
          starting over on `playground/landing` would take `landing-v2` with it.
          The adapter owns the key shape and exports it for exactly this.
        */
        await store.remove(siteSessionKey(docId));
        /*
          And the DOCUMENT session, if one is still there. It is what a site's
          first boot lifts its home page from, so leaving it behind would make
          "start over" re-lift the very work the person just asked to discard —
          a button that visibly does nothing.
        */
        await store.remove(sessionKey(docId));
      } catch {
        // Storage that will not let go of a document is still a session that
        // has to start over; the fresh boot below is the part that matters.
      }
      setGeneration((current) => current + 1);
    })();
  }, [store, docId]);

  // Derived, never assigned: a boot from a previous fixture (or a previous
  // "start over") IS the loading state for this one, and setting it inside the
  // effect would cascade a render the app can see.
  const current = boot?.key === key ? boot : undefined;
  const siteKernel = current?.ok === true ? current.session.siteKernel : undefined;

  /*
    The current page, read from the site store rather than kept in React state.
    It has to be a SUBSCRIPTION: `setCurrentPage` is a site write, not a React
    one, so a page switch made anywhere — the page list, a command, an undo that
    took a page away — has to re-render the app with the lens for the page the
    site is actually on. Hooks run unconditionally; a boot that has no kernel yet
    subscribes to nothing and reports the empty page id.
  */
  const currentPage = useSyncExternalStore(
    useCallback(
      (listener: () => void) => siteKernel?.subscribe(listener) ?? (() => undefined),
      [siteKernel],
    ),
    () => siteKernel?.currentPage() ?? '',
    () => siteKernel?.currentPage() ?? '',
  );

  if (current === undefined) {
    return { status: 'loading' };
  }
  return current.ok && siteKernel !== undefined
    ? {
        status: 'ready',
        bootId: current.key,
        kernel: siteKernel.page(currentPage),
        siteKernel,
        restored: current.session.restored,
        shelf,
        save,
        vault: {
          store,
          sitePersistence: current.session.adapter,
          runJournal,
          sourceRunJournal,
          downloadSource: () => createSiteSourceDownload(docId, siteKernel.getSite()),
          retryPersistence: async () => {
            store.retryPersistence?.();
            try {
              const acknowledgement = await current.session.adapter.takeOverSite(
                docId,
                siteKernel.getSite(),
                siteKernel.page(siteKernel.currentPage()).context.store.getState().seq,
              );
              const next = { ...acknowledgement, shared: save.shared } satisfies VaultSaveState;
              setSave(next);
              return next;
            } catch {
              const acknowledgement = current.session.adapter.acknowledgement(docId);
              const next = { ...acknowledgement, shared: save.shared } satisfies VaultSaveState;
              setSave(next);
              return next;
            }
          },
        },
        startOver,
      }
    : {
        status: 'failed',
        reason: current.ok ? 'The site could not be opened.' : current.reason,
        retry,
        startOver,
      };
}
