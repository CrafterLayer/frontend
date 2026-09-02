import {
  builderError,
  canonicalizeJsonValue,
  findJsonViolation,
  type Author,
  type BuilderDocument,
  type ClockPort,
  type CommandRuntime,
  type EventBus,
  type KernelState,
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
  dispatchGroup: (
    steps: readonly GroupStep[],
    authorOrOptions?: Author | GroupedDispatchOptions,
  ) => Transaction;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  log: TransactionLog;
  history: History;
}

/** One member of a grouped dispatch: the same (command, args) shape the door takes. */
export interface GroupStep {
  command: string;
  args: unknown;
}

/** Maximum stored history label length for one grouped dispatch. */
export const GROUPED_DISPATCH_LABEL_MAX_LENGTH = 160;

/** Optional grouped-door metadata; the legacy direct `Author` argument stays valid. */
export interface GroupedDispatchOptions {
  author?: Author;
  label?: string;
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
    assertAuthor(author);
    const registered = deps.registry.command(command);
    if (registered === undefined) {
      throw builderError('cmd/unknown', `No command named "${command}" is registered.`);
    }

    // The -0 boundary (011 research R2): canonicalise BEFORE the handler runs,
    // so a value JSON cannot print never reaches the draft — patches and the
    // next document stay consistent by construction. Identity-preserving, so a
    // clean payload costs nothing.
    const canonicalArgs = canonicalizeJsonValue(args);
    const mutator = registered.apply(canonicalArgs); // Law V: parses or throws cmd/invalid-args
    const state = deps.store.getState();
    const [nextDoc, patches, inverse] = produceWithPatches(state.doc, (draft) => {
      mutator(draft, deps.runtime);
    });

    return commit(command, author, state, nextDoc, patches, inverse);
  }

  /**
   * The GROUPED door (the contract `@craftkit/builder-ai` waited for): every
   * step's args parse first (Law V, fail fast), then all mutators run over ONE
   * immer produce — one patch set, one inverse, ONE transaction, one undo.
   * A throw anywhere leaves document, log, and history untouched, exactly like
   * a single rejected dispatch: grouping buys atomicity, not new risk.
   */
  function dispatchGroup(
    steps: readonly GroupStep[],
    authorOrOptions?: Author | GroupedDispatchOptions,
  ): Transaction {
    if (steps.length === 0) {
      throw builderError('cmd/invalid-args', 'A dispatch group needs at least one step.');
    }
    const defaultLabel = (
      steps.length === 1 ? (steps[0]?.command ?? 'group') : `group(${String(steps.length)})`
    ).slice(0, GROUPED_DISPATCH_LABEL_MAX_LENGTH);
    const { author, label } = normalizeGroupedDispatchOptions(authorOrOptions, defaultLabel);
    const mutators = steps.map((step) => {
      const registered = deps.registry.command(step.command);
      if (registered === undefined) {
        throw builderError('cmd/unknown', `No command named "${step.command}" is registered.`);
      }
      return registered.apply(canonicalizeJsonValue(step.args));
    });
    const state = deps.store.getState();
    const [nextDoc, patches, inverse] = produceWithPatches(state.doc, (draft) => {
      for (const mutator of mutators) {
        mutator(draft, deps.runtime);
      }
    });

    return commit(label, author, state, nextDoc, patches, inverse);
  }

  function commit(
    command: string,
    author: Author,
    state: ReturnType<KernelStoreHandle['getState']>,
    nextDoc: BuilderDocument,
    patches: Patch[],
    inverse: Patch[],
  ): Transaction {
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
      { ...state, doc: nextDoc, ...pruneSelection(state, nextDoc) },
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
      { ...state, doc: nextDoc, ...pruneSelection(state, nextDoc) },
      changedNodeIds(patchesOf(tx)),
    );
    deps.events.emit(event, { tx });
    emitDocMetaIfChanged(deps, tx);
    return true;
  }

  return {
    dispatch,
    dispatchGroup,
    undo: () => applyHistory(history.undo(), (tx) => tx.inverse, 'history.undone'),
    redo: () => applyHistory(history.redo(), (tx) => tx.patches, 'history.redone'),
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    log,
    history,
  };
}

function normalizeGroupedDispatchOptions(
  authorOrOptions: unknown,
  defaultLabel: string,
): { author: Author; label: string } {
  if (authorOrOptions === undefined) {
    return { author: 'user', label: defaultLabel };
  }
  if (typeof authorOrOptions === 'string') {
    assertAuthor(authorOrOptions);
    return { author: authorOrOptions, label: defaultLabel };
  }
  if (
    typeof authorOrOptions !== 'object' ||
    authorOrOptions === null ||
    Array.isArray(authorOrOptions)
  ) {
    throw builderError('cmd/invalid-args', 'Grouped dispatch options must be an object.');
  }

  const options = authorOrOptions as { author?: unknown; label?: unknown };
  const author = options.author === undefined ? 'user' : options.author;
  assertAuthor(author);
  if (options.label === undefined) {
    return { author, label: defaultLabel };
  }
  if (typeof options.label !== 'string') {
    throw builderError('cmd/invalid-args', 'A grouped dispatch label must be a string.');
  }

  const label = options.label.trim();
  if (label.length === 0) {
    throw builderError('cmd/invalid-args', 'A grouped dispatch label must not be empty.');
  }
  if (label.length > GROUPED_DISPATCH_LABEL_MAX_LENGTH) {
    throw builderError(
      'cmd/invalid-args',
      `A grouped dispatch label must be at most ${String(GROUPED_DISPATCH_LABEL_MAX_LENGTH)} characters.`,
    );
  }
  return { author, label };
}

function assertAuthor(value: unknown): asserts value is Author {
  if (value !== 'user' && value !== 'ai' && value !== 'codeview') {
    throw builderError(
      'cmd/invalid-args',
      'A command author must be one of "user", "ai", or "codeview".',
    );
  }
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
 *
 * Element focus rides on the same rule: it names an element inside a LIVE
 * selected node, so it survives exactly as long as that node stays selected
 * — and is returned by reference, for the same subscribers.
 */
function pruneSelection(
  state: Pick<KernelState, 'selection' | 'elementFocus'>,
  doc: BuilderDocument,
): Pick<KernelState, 'selection' | 'elementFocus'> {
  const { selection, elementFocus } = state;
  const live =
    selection.length === 0 ? selection : selection.filter((id) => doc.nodes[id] !== undefined);
  const nextSelection = live.length === selection.length ? selection : live;
  const nextFocus =
    elementFocus !== null && nextSelection[0] === elementFocus.id ? elementFocus : null;
  return { selection: nextSelection, elementFocus: nextFocus };
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
