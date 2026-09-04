import { isBuilderError } from '@craftkit/builder';

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

export const VAULT_SAVED: VaultSaveState = { status: 'saved', reason: undefined, shared: false };

/**
 * What the save loop needs from a session, and nothing more.
 *
 * Generic over the ROOT — a `BuilderDocument` for a page session, a
 * `BuilderSite` for a site session — because everything below is about
 * positions, conflicts and telling somebody, and none of it is about what is
 * being stored. Extracted rather than copied when the site boot arrived: this
 * loop is a hundred lines of answers to specific failures (a poisoned promise
 * chain, a stale position that silently ends saving for good, a bare `catch`
 * that turned a full disk into a green screen), and a second copy is a second
 * place for each of them to come back.
 */
export interface AutosaveTarget<Root> {
  getRoot(): Root;
  /** The session's stored position, for the re-base after a conflict. */
  getSeq(): number;
  flush(): Promise<number>;
  subscribe(listener: () => void): () => void;
  /** The KERNEL's compaction hook, not the user-facing snapshot shelf. */
  snapshot(root: Root, seq: number): Promise<void>;
  /** Re-base the stored session onto this one, unconditionally. */
  takeOver(root: Root, seq: number): Promise<void>;
}

/** The kernel's one conflict outcome, told apart from every other failure. */
function isSeqConflict(error: unknown): boolean {
  return isBuilderError(error) && error.code === 'persist/seq-conflict';
}

export function reasonOf(error: unknown): string {
  if (isBuilderError(error)) {
    return `${error.code} — ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'The stored page could not be opened.';
}

/**
 * Storage is BEST EFFORT and the session is not — but best effort is not the
 * same as SILENT, and that is what this function got wrong.
 *
 * Two facts from the kernel force the compaction. `flush()` sends the pending
 * transaction tail, and undo/redo record no transaction at all (Law S), so an
 * undone edit still sits in the stored tail and a replay resurrects it.
 * `snapshot(root, seq)` replaces the stored root AT the flushed position and
 * truncates the tail, so what is stored is what is on screen rather than a
 * history that has to be replayed correctly.
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
export function autosave<Root>(
  target: AutosaveTarget<Root>,
  report: (state: VaultSaveState) => void,
): () => void {
  let saved = target.getRoot();
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
    saved = target.getRoot();
    const seq = await target.flush();
    /*
      The LIVE document, read again after the flush rather than the one captured
      before it. `seq` is where the adapter now is; storing what is on screen at
      that position is what makes storage agree with the screen, and compaction
      is a no-op at any other position anyway.
    */
    const current = target.getRoot();
    saved = current;
    await target.snapshot(current, seq);
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
            await target.takeOver(target.getRoot(), target.getSeq());
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

  const unsubscribe = target.subscribe(() => {
    if (stopped() || target.getRoot() === saved) {
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
