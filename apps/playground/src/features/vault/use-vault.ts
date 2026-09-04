import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isBuilderError, openDocument, type BuilderKernel } from '@craftkit/builder';

import {
  hydratePlaygroundTemplates,
  playgroundDocument,
  playgroundExtensions,
  playgroundPorts,
  type PlaygroundFixture,
} from '../preview/create-playground-kernel';
import { createVaultPersistence, sessionKey, type VaultPersistenceAdapter } from './persistence';
import { createSnapshotShelf, type SnapshotShelf } from './snapshots';
import { createIndexedDbVaultStore, type VaultStore } from './store';

/**
 * Whether the page on the screen is the page in storage — the one fact a person
 * cannot check for themselves and cannot afford to be wrong about.
 *
 * There is no such thing as a save that quietly does not happen. A full disk, a
 * private window, a second tab that took the document: each of them leaves work
 * only in memory, and a session that keeps saying nothing while that is true is
 * a session that loses everything on the next reload with a green screen up to
 * the last second.
 */
export interface VaultSaveState {
  /** `saved` when storage holds what is on screen; `error` when it does not. */
  readonly status: 'saving' | 'saved' | 'error';
  /** Only on `error`: what storage said, in the words it said it. */
  readonly reason: string | undefined;
  /**
   * Sticky once true. Another session — a second tab on the same document — has
   * written this page since this one opened it, so the two are now taking it
   * from each other and the last save wins. Nothing is spliced: what is stored
   * is always one whole page from one of them.
   */
  readonly shared: boolean;
}

const SAVED: VaultSaveState = { status: 'saved', reason: undefined, shared: false };

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
      readonly kernel: BuilderKernel;
      readonly restored: boolean;
      readonly shelf: SnapshotShelf;
      readonly save: VaultSaveState;
      readonly startOver: () => void;
    }
  | {
      readonly status: 'failed';
      readonly reason: string;
      /** Open the stored page again. Deletes nothing — the recoverable door. */
      readonly retry: () => void;
      readonly startOver: () => void;
    };

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
  readonly kernel: BuilderKernel;
  /** False when the adapter had to fall back to the fixture: nothing was stored. */
  readonly restored: boolean;
}

interface BootSession {
  readonly adapter: VaultPersistenceAdapter;
  readonly opening: Promise<OpenedSession>;
}

type Boot =
  | { readonly key: string; readonly ok: true; readonly session: OpenedSession }
  | { readonly key: string; readonly ok: false; readonly reason: string };

/** The kernel's one conflict outcome, told apart from every other failure. */
function isSeqConflict(error: unknown): boolean {
  return isBuilderError(error) && error.code === 'persist/seq-conflict';
}

/**
 * Storage is BEST EFFORT and the session is not — but best effort is not the
 * same as SILENT, and that is what this function got wrong.
 *
 * Two facts from the kernel force the compaction. `flush()` sends the pending
 * transaction tail, and undo/redo record no transaction at all (Law S), so an
 * undone edit still sits in the stored tail and a replay resurrects it.
 * `snapshot(docId, doc, seq)` replaces the stored document AT the flushed
 * position and truncates the tail, so what is stored is what is on screen
 * rather than a history that has to be replayed correctly.
 *
 * Three things force the rest of it:
 *
 * — A failure has to REACH somebody. A bare `catch {}` around the whole loop
 *   turned a full disk into a green screen over an empty store, and it also
 *   skipped the compaction that is the vault's whole defence. Every outcome is
 *   published now, and the compaction lives with the flush that earned it.
 *
 * — A seq conflict is not a failure to report and forget. A kernel whose
 *   position is stale conflicts on EVERY later append: without a re-base it
 *   never saves again for the rest of its life. `takeOver` re-bases the stored
 *   session onto this kernel, once per pass, and the pass then retries.
 *
 * — And the person is told the page is being edited in two places, because
 *   after a take-over the last save wins and that is not something to discover.
 */
function autosave(
  kernel: BuilderKernel,
  adapter: VaultPersistenceAdapter,
  docId: string,
  report: (state: VaultSaveState) => void,
): () => void {
  let saved = kernel.getDocument();
  let running = false;
  let queued = false;
  const queuedAgain = (): boolean => queued;
  /*
    Read through a CALL, not a variable. The flag is written by the stopper this
    returns and read by the save loop. Both flags here are written in one
    closure and read in another, and a boolean read directly narrows to its
    initialiser — which makes the checker call the very guards that keep a save
    from running after unmount, or from missing an edit that landed mid-flight,
    dead code.
  */
  let stopRequested = false;
  const stopped = (): boolean => stopRequested;
  /** Sticky for the life of the session: see `VaultSaveState.shared`. */
  let shared = false;

  const publish = (status: VaultSaveState['status'], reason?: string): void => {
    // Nothing is announced about a session that is over: the boot that replaces
    // it owns the state from here.
    if (stopped()) {
      return;
    }
    report({ status, reason, shared });
  };

  const saveOnce = async (): Promise<void> => {
    /*
      Claimed BEFORE the awaits. `flush()` writes `{...state, seq}` back to the
      store, which notifies every subscriber — including this one — with the
      same document object; advancing the mark first is what stops a save from
      triggering the next save forever.
    */
    saved = kernel.getDocument();
    const seq = await kernel.flush();
    /*
      The LIVE document, read again after the flush rather than the one captured
      before it. `seq` is where the adapter now is; storing what is on screen at
      that position is what makes storage agree with the screen, and compaction
      is a no-op at any other position anyway.
    */
    const current = kernel.getDocument();
    saved = current;
    await adapter.snapshot?.(docId, current, seq);
  };

  const run = async (): Promise<void> => {
    running = true;
    // ONE take-over per pass. A store another session is writing continuously
    // must not turn this loop into a tug of war that never lets go of the CPU.
    let rebased = false;
    do {
      queued = false;
      publish('saving');
      try {
        await saveOnce();
        publish('saved');
      } catch (error) {
        if (isSeqConflict(error) && !rebased) {
          rebased = true;
          shared = true;
          try {
            await adapter.takeOver(
              docId,
              kernel.getDocument(),
              kernel.context.store.getState().seq,
            );
            // The stored position matches this kernel again, so the pending
            // transactions the conflict refused go out on the next pass.
            queued = true;
          } catch (refused) {
            publish('error', reasonOf(refused));
          }
        } else {
          publish('error', reasonOf(error));
        }
      }
    } while (queuedAgain() && !stopped());
    running = false;
  };

  const unsubscribe = kernel.context.store.subscribe(() => {
    if (stopped() || kernel.getDocument() === saved) {
      return;
    }
    if (running) {
      queued = true;
      return;
    }
    void run();
  });

  return () => {
    stopRequested = true;
    unsubscribe();
  };
}

function startSession(store: VaultStore, fixture: PlaygroundFixture, docId: string): BootSession {
  /*
    `seed` is the vault's first-boot answer, and it doubles as the only honest
    way to know whether anything was stored: the adapter calls it exactly when
    `load` found nothing. Asking the store directly would mean restating its key
    shape a second time.
  */
  let seeded = false;
  const adapter = createVaultPersistence({
    store,
    seed: () => {
      seeded = true;
      return playgroundDocument(fixture);
    },
  });

  let kernel: BuilderKernel | undefined;
  const opening = openDocument(adapter, docId, {
    extensions: playgroundExtensions(fixture),
    ports: playgroundPorts(() => kernel?.getDocument()),
  }).then((opened) => {
    kernel = opened;
    // AFTER the open: `openDocument` validates internally, and templates are
    // tier-2 compositions rather than block types, so validation never saw them.
    hydratePlaygroundTemplates(opened);
    return { kernel: opened, restored: !seeded };
  });

  return { adapter, opening };
}

function reasonOf(error: unknown): string {
  if (isBuilderError(error)) {
    return `${error.code} — ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The stored page could not be opened.';
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
  const [save, setSave] = useState<VaultSaveState>(SAVED);
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
  const shelf = useMemo(() => createSnapshotShelf({ store, docId }), [store, docId]);

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
        stopAutosave = autosave(opened.kernel, session.adapter, docId, setSave);
        // A fresh boot starts even with storage, whatever the last one ended on.
        setSave(SAVED);
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
  if (current === undefined) {
    return { status: 'loading' };
  }
  return current.ok
    ? {
        status: 'ready',
        bootId: current.key,
        kernel: current.session.kernel,
        restored: current.session.restored,
        shelf,
        save,
        startOver,
      }
    : { status: 'failed', reason: current.reason, retry, startOver };
}
