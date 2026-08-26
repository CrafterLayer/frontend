import {
  builderError,
  findJsonViolation,
  type Author,
  type BuilderDocument,
  type ClockPort,
  type CommandRuntime,
  type EventBus,
  type NodeId,
  type Patch,
  type RegistryRead,
  type Transaction,
} from '@craftkit/builder-schema';

import { createHistory, type History } from '../history/history';
import { applyPatchSet } from '../patches/apply';
import { TransactionLog } from '../patches/log';
import { produceWithPatches } from '../patches/immer';
import type { KernelStoreHandle } from '../state/store';

export interface Dispatcher {
  dispatch: (command: string, args: unknown, author?: Author) => Transaction;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  log: TransactionLog;
  history: History;
}

interface DispatcherDeps {
  store: KernelStoreHandle;
  registry: RegistryRead;
  runtime: CommandRuntime;
  clock: ClockPort;
  events: EventBus;
}

/**
 * The single door (Laws S/V/J/D):
 * parse args inside the registered command → produce forward+inverse patches →
 * reject any non-JSON patch value BEFORE committing → build the transaction from
 * the injected ports → write with node-scoped notification → log, history, event.
 * Rejections at any stage leave document, history, and log untouched.
 */
export function createDispatcher(deps: DispatcherDeps): Dispatcher {
  const log = new TransactionLog();
  const history = createHistory();

  function dispatch(command: string, args: unknown, author: Author = 'user'): Transaction {
    const registered = deps.registry.command(command);
    if (registered === undefined) {
      throw builderError('cmd/unknown', `No command named "${command}" is registered.`);
    }

    const mutator = registered.apply(args); // Law V: parses or throws cmd/invalid-args
    const state = deps.store.getState();
    const [nextDoc, patches, inverse] = produceWithPatches(state.doc, (draft) => {
      mutator(draft, deps.runtime);
    });

    assertJsonPatches(patches);

    const tx: Transaction = {
      id: deps.runtime.ids.newId(),
      command,
      author,
      patches: patches,
      inverse: inverse,
      ts: deps.clock.now(),
    };

    if (patches.length === 0) {
      // A no-effect command (e.g. setProp to the identical value) is not an
      // observable change: nothing is written, logged, or undoable (FR-001's
      // 1:1 pairing counts observable changes).
      return tx;
    }

    // Record BEFORE notifying (007 convergence-class fix): store.write is the
    // observable moment, and React's useSyncExternalStore checks snapshots
    // SYNCHRONOUSLY inside the notification — a subscriber deriving from the
    // log (e.g. transactions().length) must already see this transaction, or
    // the change-check bails out and the view lags one event behind forever.
    log.append(tx);
    history.record(tx);
    deps.store.write(
      { ...state, doc: nextDoc, selection: pruneSelection(state.selection, nextDoc) },
      changedNodeIds(tx.patches),
    );
    deps.events.emit('tx.applied', { tx });
    emitDocMetaIfChanged(deps, tx);
    return tx;
  }

  function applyHistory(
    tx: Transaction | undefined,
    patchesOf: (tx: Transaction) => Patch[],
    event: 'history.undone' | 'history.redone',
  ): boolean {
    if (tx === undefined) {
      return false;
    }
    const state = deps.store.getState();
    // Immer's own applyPatches replays recorded change sets with exact array
    // semantics; undo/redo never creates a new transaction (Law S).
    const nextDoc = applyPatchSet(state.doc, patchesOf(tx));
    deps.store.write(
      { ...state, doc: nextDoc, selection: pruneSelection(state.selection, nextDoc) },
      changedNodeIds(patchesOf(tx)),
    );
    deps.events.emit(event, { tx });
    emitDocMetaIfChanged(deps, tx);
    return true;
  }

  return {
    dispatch,
    undo: () => applyHistory(history.undo(), (tx) => tx.inverse, 'history.undone'),
    redo: () => applyHistory(history.redo(), (tx) => tx.patches, 'history.redone'),
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    log,
    history,
  };
}

function assertJsonPatches(
  patches: readonly { op: string; path: (string | number)[]; value?: unknown }[],
): void {
  for (const patch of patches) {
    if (patch.op === 'remove') {
      continue; // deletions carry no value
    }
    // add/replace DO carry a value — writing `undefined` is itself a violation
    // (immer encodes `x = undefined` as a replace patch), not a skippable case.
    const violation =
      patch.value === undefined
        ? { kind: 'undefined' as const, path: [] as (string | number)[] }
        : findJsonViolation(patch.value);
    if (violation === undefined) {
      continue;
    }
    throw builderError(
      violation.kind === 'non-finite-number' ? 'doc/non-finite-number' : 'doc/non-json-value',
      `Command produced a non-JSON value (${violation.kind}); the document stays pure (Law J).`,
      [...patch.path, ...violation.path],
    );
  }
}

/**
 * Selection is kernel bookkeeping over LIVE nodes: a write that removes the
 * selected node must never leave a dangling id behind — every surface reading
 * `state.selection` would otherwise have to defend itself (the canvas chrome,
 * the announcer, contributed tools…), which is the wrong shape for a single
 * source of truth. Pruning happens INSIDE the same `store.write`, so it emits
 * no extra notification and the Law-S 1:1 change↔transaction pairing is
 * untouched. The original array is returned BY REFERENCE when nothing was
 * dropped, so selection subscribers never churn on unrelated commands.
 */
function pruneSelection(selection: NodeId[], doc: BuilderDocument): NodeId[] {
  if (selection.length === 0) {
    return selection;
  }
  const live = selection.filter((id) => doc.nodes[id] !== undefined);
  return live.length === selection.length ? selection : live;
}

/** Node-scoped notification targets: every patch under nodes/<id> names its node. */
export function changedNodeIds(patches: readonly Patch[]): Set<NodeId> {
  const ids = new Set<NodeId>();
  for (const patch of patches) {
    if (patch.path[0] === 'nodes' && patch.path.length >= 2) {
      ids.add(String(patch.path[1]));
    }
  }
  return ids;
}

function emitDocMetaIfChanged(deps: DispatcherDeps, tx: Transaction): void {
  const touchesMeta = tx.patches.some(
    (patch) => patch.path[0] === 'dir' || patch.path[0] === 'surface',
  );
  if (!touchesMeta) {
    return;
  }
  const doc = deps.store.getState().doc;
  deps.events.emit('docMeta.changed', { dir: doc.dir, surface: doc.surface });
}
