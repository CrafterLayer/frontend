import {
  canonicalizeJsonValue,
  LATEST_SCHEMA_VERSION,
  validateDocument,
  type Author,
  type BlockSchemaLookup,
  type BuilderDocument,
  type BuilderError,
  type ClockPort,
  type CommandRuntime,
  type ContentDirection,
  type IdPort,
  type KernelApi,
  type NodeId,
  type PersistenceAdapter,
  type Surface,
  type Transaction,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { coreCommands, type CoreCommandName, type CoreCommands } from '../commands/core-commands';
import {
  createDispatcher,
  type GroupedDispatchOptions,
  type GroupStep,
} from '../commands/dispatch';

export { GROUPED_DISPATCH_LABEL_MAX_LENGTH } from '../commands/dispatch';
export type { GroupedDispatchOptions, GroupStep };
import { createEventBus } from '../events/bus';
import { createExtensionManager, type ExtensionManagerHandle } from '../extensions/manager';
import { systemClock } from '../ports/system-clock';
import { systemIds } from '../ports/system-ids';
import { createRegistry } from '../registry/registry';
import { createKernelStore } from '../state/store';

const KERNEL_OWNER = '@craftkit/kernel';

/** Auto-flush the pending transaction batch to persistence every N transactions. */
export const PERSIST_COALESCE_EVERY = 25;

export interface CreateBuilderOptions {
  document?: BuilderDocument;
  surface?: Surface;
  dir?: ContentDirection;
  ports?: { clock?: ClockPort; ids?: IdPort };
  extensions?: TrustedExtensionManifest[];
  /** Bind the session to a persistence adapter (in-memory only in B0). */
  persistence?: { adapter: PersistenceAdapter; docId: string; coalesceEvery?: number };
  /** Starting persistence position (used by openDocument). */
  initialSeq?: number;
}

export interface BuilderKernel {
  /** The contract handed to extensions — read-only state, one dispatch door. */
  context: KernelApi;
  /** Property-typed overloads: safe to pass around unbound (it is a closure). */
  dispatch: {
    <K extends CoreCommandName>(command: K, args: CoreCommands[K], author?: Author): Transaction;
    (command: string, args: unknown, author?: Author): Transaction;
  };
  /**
   * The grouped door: every step in ONE transaction — one history entry, one
   * undo, and atomic (a failing step leaves nothing behind). The contract that
   * lets a multi-command AI plan honour "one change, one undo".
   */
  dispatchGroup(
    steps: readonly GroupStep[],
    authorOrOptions?: Author | GroupedDispatchOptions,
  ): Transaction;
  /** Extension lifecycle: register / registerAll / hydrateDeclarative / dispose. */
  extensions: ExtensionManagerHandle;
  /** Convenience alias for `extensions.register`. */
  registerExtension(manifest: TrustedExtensionManifest): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  getDocument(): Readonly<BuilderDocument>;
  /** Structural + registry-aware validation of the live document. */
  validate(): BuilderError[];
  /**
   * Ephemeral UI selection — kernel state, not document data, never a
   * transaction. Selecting whole nodes also drops any element focus: a focus
   * names an element INSIDE `selection[0]`, so it cannot outlive that choice.
   */
  setSelection(ids: NodeId[]): void;
  /**
   * Empty the selection through the SAME ephemeral door: never a transaction,
   * and one store write per call exactly like `setSelection([])` — so every
   * subscriber that re-announces on a selection write ("Selection cleared")
   * hears both doors identically.
   */
  clearSelection(): void;
  /**
   * Select `id` AND focus one element inside its stored composition (a
   * custom-code tree), addressed by child indices from the tree root. ONE
   * write: the selection and the focus are one decision — a person clicked
   * that image — and must never be observable as two events.
   */
  focusElement(id: NodeId, path: readonly number[]): void;
  /**
   * Step back from an element to its host node: the selection is kept, only
   * the focus is dropped. One write per call, even when already clear — the
   * same law as `clearSelection`, for the same subscribers.
   */
  clearElementFocus(): void;
  /** The session's transaction log (replay source). */
  transactions(): readonly Transaction[];
  /** Persist all unflushed transactions; resolves to the new store position. */
  flush(): Promise<number>;
}

export function emptyDocument(
  surface: Surface = 'site',
  dir: ContentDirection = 'ltr',
): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface,
    dir,
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: {} } },
  };
}

/**
 * Assemble the kernel: sealed store (Law S), validated single door (Law V),
 * injected ports (Law D), live meta reads (Law L), extension lifecycle, and
 * count-coalesced persistence. The zustand instance never leaves this closure.
 */
export function createBuilder(options: CreateBuilderOptions = {}): BuilderKernel {
  const clock = options.ports?.clock ?? systemClock;
  const ids = options.ports?.ids ?? systemIds;
  // The -0 load boundary (011 research R2): a stored document may carry -0
  // from before the rule existed; it normalises to 0 on OPEN — never rejected,
  // so no existing document breaks. Clean documents come back by reference.
  const document = canonicalizeJsonValue(
    options.document ?? emptyDocument(options.surface ?? 'site', options.dir ?? 'ltr'),
  );

  const store = createKernelStore({
    doc: document,
    selection: [],
    elementFocus: null,
    seq: options.initialSeq ?? 0,
  });
  const events = createEventBus();
  const registry = createRegistry();
  registry.register(KERNEL_OWNER, { commands: coreCommands });

  const lookup: BlockSchemaLookup = (type) => registry.read.block(type)?.schema;
  const runtime: CommandRuntime = {
    ids,
    blocks: lookup,
    compositions: (id) => registry.read.composition(id),
  };
  const dispatcher = createDispatcher({
    store,
    registry: registry.read,
    runtime,
    clock,
    events,
  });

  // ── Persistence binding (US4): count-coalesced, order-preserving, retry-safe ──
  const persistence = options.persistence;
  const coalesceEvery = persistence?.coalesceEvery ?? PERSIST_COALESCE_EVERY;
  let persistedCount = 0;
  let flushChain: Promise<number> = Promise.resolve(store.getState().seq);

  const context: KernelApi = {
    store: store.facade,
    dispatch,
    registry: registry.read,
    events,
    get surface() {
      return store.getState().doc.surface;
    },
    get dir() {
      return store.getState().doc.dir;
    },
  };

  const manager = createExtensionManager(registry, events, () => context);
  manager.registerAll(options.extensions ?? []);

  /**
   * Send everything the log holds past `persistedCount`, one flush at a time.
   *
   * Two hazards live in this one function, and both end the same way: work on
   * the screen that is not in storage, with nothing anywhere saying so.
   *
   * A REJECTED LINK MUST NOT POISON THE CHAIN. `then(work)` alone skips its
   * callback when the predecessor rejected and re-raises the old error, so a
   * single refused write — a full disk, a private window, a conflict from a
   * second tab — silences every later save for the life of the kernel and the
   * adapter is never asked again. The chain kept below is therefore always a
   * settled-either-way promise, and the caller still sees its own outcome
   * because that is the promise `flush()` returns.
   *
   * AND THE MARK IS CLAIMED BEFORE THE AWAIT. `log.all()` is the live array;
   * reading its length after the append counts transactions dispatched WHILE
   * that append was in flight as persisted, and they are never sent.
   */
  function flush(): Promise<number> {
    if (persistence === undefined) {
      return Promise.resolve(store.getState().seq);
    }
    const { adapter, docId } = persistence;
    const work = async (): Promise<number> => {
      const all = dispatcher.log.all();
      const pending = all.slice(persistedCount);
      const state = store.getState();
      if (pending.length === 0) {
        return state.seq;
      }
      const sent = persistedCount + pending.length;
      const { seq } = await adapter.append(docId, [...pending], state.seq);
      persistedCount = sent;
      store.write({ ...store.getState(), seq }, []);
      return seq;
    };
    // `then(work, work)` runs the next flush whatever the last one did.
    const result = flushChain.then(work, work);
    // What the NEXT flush waits on never rejects — so it cannot carry a stale
    // failure forward, and a refused write is not also an unhandled rejection.
    flushChain = result.catch(() => store.getState().seq);
    return result;
  }

  function dispatch(command: string, args: unknown, author?: Author): Transaction {
    return afterDoor(dispatcher.dispatch(command, args, author));
  }

  function dispatchGroup(
    steps: readonly GroupStep[],
    authorOrOptions?: Author | GroupedDispatchOptions,
  ): Transaction {
    return afterDoor(dispatcher.dispatchGroup(steps, authorOrOptions));
  }

  function afterDoor(tx: Transaction): Transaction {
    if (
      persistence !== undefined &&
      tx.patches.length > 0 &&
      dispatcher.log.length - persistedCount >= coalesceEvery
    ) {
      // Typing never awaits the network: coalesced flushes ride the chain and
      // surface failures on the next explicit flush(). `flush()` already left
      // the chain settled either way, so this only has to not float.
      void flush().catch(() => store.getState().seq);
    }
    return tx;
  }

  return {
    context,
    dispatch,
    dispatchGroup,
    extensions: manager,
    registerExtension: (manifest) => {
      manager.register(manifest);
    },
    undo: dispatcher.undo,
    redo: dispatcher.redo,
    canUndo: dispatcher.canUndo,
    canRedo: dispatcher.canRedo,
    getDocument: () => store.getState().doc,
    validate: () => validateDocument(store.getState().doc, lookup),
    setSelection(idsToSelect) {
      const state = store.getState();
      store.write({ ...state, selection: [...idsToSelect], elementFocus: null }, []);
    },
    clearSelection() {
      // A fresh array on every call, exactly as setSelection writes one: the
      // write itself is the signal selection subscribers key off, and an
      // "already empty" short-circuit here would make the two doors diverge.
      const state = store.getState();
      store.write({ ...state, selection: [], elementFocus: null }, []);
    },
    focusElement(id, path) {
      const state = store.getState();
      store.write({ ...state, selection: [id], elementFocus: { id, path: [...path] } }, []);
    },
    clearElementFocus() {
      const state = store.getState();
      store.write({ ...state, elementFocus: null }, []);
    },
    transactions: () => dispatcher.log.all(),
    flush,
  };
}
