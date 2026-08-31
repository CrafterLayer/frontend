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
import { createDispatcher, type GroupStep } from '../commands/dispatch';

export type { GroupStep };
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
  dispatchGroup(steps: readonly GroupStep[], author?: Author): Transaction;
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
  /** Ephemeral UI selection — kernel state, not document data, never a transaction. */
  setSelection(ids: NodeId[]): void;
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

  function flush(): Promise<number> {
    if (persistence === undefined) {
      return Promise.resolve(store.getState().seq);
    }
    const { adapter, docId } = persistence;
    flushChain = flushChain.then(async () => {
      const all = dispatcher.log.all();
      const pending = all.slice(persistedCount);
      const state = store.getState();
      if (pending.length === 0) {
        return state.seq;
      }
      const { seq } = await adapter.append(docId, [...pending], state.seq);
      persistedCount = all.length;
      store.write({ ...store.getState(), seq }, []);
      return seq;
    });
    return flushChain;
  }

  function dispatch(command: string, args: unknown, author?: Author): Transaction {
    return afterDoor(dispatcher.dispatch(command, args, author));
  }

  function dispatchGroup(steps: readonly GroupStep[], author?: Author): Transaction {
    return afterDoor(dispatcher.dispatchGroup(steps, author));
  }

  function afterDoor(tx: Transaction): Transaction {
    if (
      persistence !== undefined &&
      tx.patches.length > 0 &&
      dispatcher.log.length - persistedCount >= coalesceEvery
    ) {
      // Typing never awaits the network: coalesced flushes ride the chain and
      // surface failures on the next explicit flush().
      flushChain = flush().catch(() => store.getState().seq);
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
      store.write({ ...state, selection: [...idsToSelect] }, []);
    },
    transactions: () => dispatcher.log.all(),
    flush,
  };
}
