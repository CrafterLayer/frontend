import { createStore } from 'zustand/vanilla';

import {
  canonicalizeJsonValue,
  validateDocument,
  type Author,
  type BlockSchemaLookup,
  type BuilderDocument,
  type BuilderSite,
  type ClockPort,
  type CommandRuntime,
  type ElementFocus,
  type IdPort,
  type KernelApi,
  type KernelState,
  type NodeId,
  type PageId,
  type PartFocus,
  type Patch,
  type StateFacade,
  type Transaction,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { coreCommands } from '../commands/core-commands';
import type { GroupedDispatchOptions, GroupStep } from '../commands/dispatch';
import { createEventBus } from '../events/bus';
import { createHistory } from '../history/history';
import { applyPatches, produceWithPatches } from '../patches/immer';
import { TransactionLog } from '../patches/log';
import { systemClock } from '../ports/system-clock';
import { systemIds } from '../ports/system-ids';
import { createRegistry } from '../registry/registry';
import type { BuilderKernel } from '../kernel/create-builder';

/**
 * SPIKE S1 — a falsifiable answer to one question, and nothing more.
 *
 * QUESTION: can a page LENS satisfy the whole `BuilderKernel` surface over a
 * SINGLE site kernel, so that a group touching several pages is one immer
 * produce, one transaction and one undo, while node subscriptions stay
 * page-scoped?
 *
 * WHY IT MATTERS: the alternative is N page kernels with a coordinator. N
 * histories make an undo of an older group wrong the moment any page is
 * hand-edited after it, and N append logs turn a conflict on page 3 — after
 * pages 1 and 2 already appended — into a torn write that
 * `persist/seq-conflict` cannot express. Paying for a lens is only justified if
 * the lens actually works, which is what this file exists to find out.
 *
 * DELIBERATELY THIN: no persistence, no extension lifecycle, no site commands,
 * no migrations, no selection pruning. Those belong to the real delivery and
 * would only hide the answer. Green here and this becomes the seed of
 * `site-dispatcher.ts` and `page-view.ts`; red and the PLAN changes, not the
 * implementation.
 */

/** What one write has to wake: named node keys, or everyone after a structural change. */
interface NotifyTargets {
  readonly keys: ReadonlySet<string>;
  readonly structural: boolean;
}

/** The site kernel's single state: one store, one seq, one history. */
export interface KernelSiteState {
  site: BuilderSite;
  /** The page a lens-less caller means, and the one extensions would see. */
  pageId: PageId;
  selection: NodeId[];
  elementFocus: ElementFocus | null;
  partFocus?: PartFocus | null; // block-parts (2026-10-06)
  seq: number;
}

/** A grouped step that also says which page it edits. */
export interface SiteGroupStep extends GroupStep {
  pageId?: PageId;
}

export interface CreateSiteKernelSpikeOptions {
  site: BuilderSite;
  extensions?: readonly TrustedExtensionManifest[];
  ports?: { clock?: ClockPort; ids?: IdPort };
}

export interface SiteKernelSpike {
  getSite(): Readonly<BuilderSite>;
  pages(): readonly PageId[];
  currentPage(): PageId;
  setCurrentPage(pageId: PageId): void;
  /** The lens. Typed as the REAL kernel, so the compiler counts the members. */
  page(pageId: PageId): BuilderKernel;
  dispatchGroup(steps: readonly SiteGroupStep[], options?: GroupedDispatchOptions): Transaction;
  undo(): boolean;
  redo(): boolean;
  transactions(): readonly Transaction[];
}

/** An ephemeral write changes no document node, so it wakes no node listener. */
const NOTHING_CHANGED: NotifyTargets = { keys: new Set<string>(), structural: false };

function pageIndex(site: BuilderSite, pageId: PageId): number {
  const index = site.pages.findIndex((page) => page.id === pageId);
  if (index < 0) {
    throw new Error(`No page "${pageId}" in this site.`);
  }
  return index;
}

/**
 * Which page-scoped nodes a patch set touched.
 *
 * Site-rooted patches read `['pages', <index>, 'document', 'nodes', <id>, …]`,
 * so the page a change belongs to is recoverable from the path itself. That is
 * the property that lets one store serve page-scoped subscriptions: a listener
 * on page A's hero is never woken by an edit to page B's hero of the same id.
 */
/**
 * Exported for its own test. The end-to-end case that would exercise the
 * structural branch needs a command that reorders `pages`, and this spike
 * deliberately has no site commands — so the branch is proved here, against a
 * patch shape probed from the real immer, and D2 owns the end-to-end version
 * once `addPage`/`reorderPage` exist.
 */
export function changedPageNodes(
  site: BuilderSite,
  patches: readonly Patch[],
): { keys: Set<string>; structural: boolean } {
  const keys = new Set<string>();
  let structural = false;
  for (const patch of patches) {
    if (patch.path[0] !== 'pages') continue;
    /*
      A patch that stops AT `['pages', i]` (or shorter) is a whole-element
      write: immer coalesces an insert, a removal or a reorder into replacements
      of every element from the change onward, and the fine-grained node path
      DISAPPEARS. Probed against this repo's immer: `pages.unshift(newPage)`
      plus an edit to another page emits only `replace ['pages',0]`,
      `replace ['pages',1]`, `add ['pages',2]` — no node path at all.

      The first version of this function required `length >= 5` and therefore
      returned an EMPTY set for exactly those groups: every node subscriber in
      the site stayed silent while the document under it moved. Structural
      changes cannot be attributed per node, so they are declared as such and
      the caller wakes everyone. Waking too many is a re-render; waking nobody
      is a view that lies.
    */
    if (patch.path.length <= 2) {
      structural = true;
      continue;
    }
    if (patch.path[2] !== 'document' || patch.path[3] !== 'nodes') continue;
    const page = site.pages[Number(patch.path[1])];
    if (page === undefined) continue;
    keys.add(`${page.id}::${String(patch.path[4])}`);
  }
  return { keys, structural };
}

export function createSiteKernelSpike(options: CreateSiteKernelSpikeOptions): SiteKernelSpike {
  const clock = options.ports?.clock ?? systemClock;
  const ids = options.ports?.ids ?? systemIds;
  const seeded = canonicalizeJsonValue(options.site);
  const firstPage = seeded.pages[0];
  if (firstPage === undefined) {
    throw new Error('A site needs at least one page.');
  }

  const store = createStore<KernelSiteState>()(() => ({
    site: seeded,
    pageId: firstPage.id,
    selection: [],
    elementFocus: null,
    seq: 0,
  }));
  const nodeListeners = new Map<string, Set<(node: unknown) => void>>();
  const events = createEventBus();
  const registry = createRegistry();
  /*
    `has` and `version` must answer from something real, or the stubs would be
    the same lie the cast was. This is the smallest honest bookkeeping: the set
    of names registered through this kernel, and a counter that moves when one
    is added.
  */
  const registered = new Set<string>();
  let registryVersion = 0;
  const registerManifest = (manifest: TrustedExtensionManifest): void => {
    registry.register(manifest.name, manifest.contributes ?? {});
    registered.add(manifest.name);
    registryVersion += 1;
  };
  registry.register('@craftkit/kernel', { commands: coreCommands });
  for (const manifest of options.extensions ?? []) {
    registerManifest(manifest);
  }
  const lookup: BlockSchemaLookup = (type) => registry.read.block(type)?.schema;
  const runtime: CommandRuntime = {
    ids,
    blocks: lookup,
    compositions: (id) => registry.read.composition(id),
  };
  const log = new TransactionLog();
  const history = createHistory();

  function write(next: KernelSiteState, changed: NotifyTargets): void {
    store.setState(next, true);
    /*
      Every listener, when the change was structural: see `changedPageNodes`.
      Otherwise only the named keys.
    */
    const keys = changed.structural ? [...nodeListeners.keys()] : [...changed.keys];
    for (const key of keys) {
      const set = nodeListeners.get(key);
      if (set === undefined) continue;
      const [pageId, nodeId] = key.split('::');
      /*
        A tolerant lookup, deliberately. The first version called `pageIndex`,
        which THROWS on an unknown page — after `store.setState`, after
        `log.append` and after `history.record`. A group that renamed a page id
        while editing it therefore tore a transaction the door had already
        committed, and the caller saw a refusal for work that had happened.
        A vanished page notifies `undefined`, which is what a subscriber to a
        node that no longer exists should hear.
      */
      const page = next.site.pages.find((candidate) => candidate.id === pageId);
      const node = nodeId === undefined ? undefined : page?.document.nodes[nodeId];
      for (const listener of set) {
        try {
          listener(node);
        } catch {
          // Observers are views and telemetry; they cannot roll back a
          // transaction the door has already committed.
        }
      }
    }
  }

  /**
   * ONE produce over the site root, whatever mix of pages the steps touch.
   * This is the entire claim: atomicity is structural, not coordinated.
   */
  function dispatchGroup(
    steps: readonly SiteGroupStep[],
    groupOptions: GroupedDispatchOptions = {},
  ): Transaction {
    if (steps.length === 0) {
      throw new Error('A dispatch group needs at least one step.');
    }
    const state = store.getState();
    // Every step's args parse BEFORE anything is produced (Law V, fail fast).
    const prepared = steps.map((step) => {
      const registered = registry.read.command(step.command);
      if (registered === undefined) {
        throw new Error(`No command named "${step.command}" is registered.`);
      }
      return {
        mutate: registered.apply(canonicalizeJsonValue(step.args)),
        index: pageIndex(state.site, step.pageId ?? state.pageId),
      };
    });

    const [nextSite, patches, inverse] = produceWithPatches(state.site, (draft) => {
      for (const { mutate, index } of prepared) {
        const page = draft.pages[index];
        if (page === undefined) {
          throw new Error('A page named by this group vanished inside it.');
        }
        mutate(page.document, runtime);
      }
    });

    const fallbackLabel =
      steps.length === 1 ? (steps[0]?.command ?? 'group') : `group(${String(steps.length)})`;
    const tx: Transaction = {
      id: ids.newId(),
      command: groupOptions.label ?? fallbackLabel,
      author: groupOptions.author ?? 'user',
      patches,
      inverse,
      ts: clock.now(),
    };
    if (patches.length === 0) {
      return tx;
    }

    // Log and history BEFORE the notification, exactly as the page dispatcher
    // does: a subscriber deriving from the log must already see this one.
    log.append(tx);
    history.record(tx);
    write({ ...state, site: nextSite }, changedPageNodes(state.site, patches));
    events.emit('tx.applied', { tx });
    return tx;
  }

  /*
    SPIKE FINDING (S1): `applyPatchSet` in ../patches/apply is typed to
    `BuilderDocument`, so a site cannot use it. It is only a typed wrapper over
    immer's generic `applyPatches`, which means the real delivery needs one
    small addition — a site-typed sibling, or making the wrapper generic — and
    not a new mechanism. Recorded rather than worked around silently.
  */
  function applyHistory(tx: Transaction | undefined, pick: (tx: Transaction) => Patch[]): boolean {
    if (tx === undefined) return false;
    const state = store.getState();
    const nextSite = applyPatches(state.site, pick(tx) as never);
    write({ ...state, site: nextSite }, changedPageNodes(state.site, pick(tx)));
    return true;
  }

  function subscribeNode(
    pageId: PageId,
    id: NodeId,
    listener: (node: unknown) => void,
  ): () => void {
    const key = `${pageId}::${id}`;
    let set = nodeListeners.get(key);
    if (set === undefined) {
      set = new Set();
      nodeListeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) nodeListeners.delete(key);
    };
  }

  const lenses = new Map<PageId, BuilderKernel>();

  function lensFor(pageId: PageId): BuilderKernel {
    const documentOf = (): BuilderDocument => {
      const state = store.getState();
      const page = state.site.pages[pageIndex(state.site, pageId)];
      if (page === undefined) throw new Error(`No page "${pageId}".`);
      return page.document;
    };

    /*
      The state a page's subscribers see. Selection and focus belong to the
      site's ONE current page, so a lens for another page reports an empty
      selection rather than borrowing it — a lens is a view of a page, not a
      second seat of UI state.
    */
    const stateOf = (): KernelState => {
      const state = store.getState();
      const mine = state.pageId === pageId;
      return {
        doc: documentOf(),
        selection: mine ? state.selection : [],
        elementFocus: mine ? state.elementFocus : null,
        partFocus: mine ? (state.partFocus ?? null) : null, // block-parts (2026-10-06)
        seq: state.seq,
      };
    };

    const facade: StateFacade = {
      getState: stateOf,
      subscribe: (listener) =>
        store.subscribe(() => {
          listener(stateOf());
        }),
      subscribeNode: (id, listener) =>
        subscribeNode(pageId, id, (node) => {
          listener(node as never);
        }),
      select: (selector, listener) => {
        let previous = selector(stateOf());
        return store.subscribe(() => {
          const next = selector(stateOf());
          if (!Object.is(next, previous)) {
            previous = next;
            listener(next);
          }
        });
      },
    };

    const dispatch = (command: string, args: unknown, author?: Author): Transaction =>
      dispatchGroup([{ command, args, pageId }], author === undefined ? {} : { author });

    const context: KernelApi = {
      store: facade,
      dispatch,
      registry: registry.read,
      events,
      get surface() {
        return documentOf().surface;
      },
      get dir() {
        return documentOf().dir;
      },
    };

    const setPageState = (patch: Partial<KernelSiteState>): void => {
      const state = store.getState();
      write({ ...state, ...patch }, NOTHING_CHANGED);
    };

    return {
      context,
      dispatch,
      dispatchGroup: (steps, authorOrOptions) => {
        const groupOptions: GroupedDispatchOptions =
          typeof authorOrOptions === 'string'
            ? { author: authorOrOptions }
            : (authorOrOptions ?? {});
        return dispatchGroup(
          steps.map((step) => ({ ...step, pageId })),
          groupOptions,
        );
      },
      /*
        A REAL `ExtensionManagerHandle`, not a cast.
        The first version of this used `as unknown as`, which silently dropped
        `has` and `version` — two members shipped code already calls
        (renderer/src/subscribe.ts, react's use-registry-version, shell's
        Palette) — and so defeated the exact thing this spike claims to prove:
        that the compiler counts the members. Every stub below is honest about
        being a stub, and the two that a caller can act on answer truthfully for
        a lens that registers nothing of its own.
      */
      extensions: {
        register: registerManifest,
        registerAll: (manifests) => {
          for (const manifest of manifests) registerManifest(manifest);
        },
        hydrateDeclarative: () => {
          throw new Error('The spike lens does not hydrate declarative extensions.');
        },
        dispose: () => false,
        has: (name) => registered.has(name),
        version: () => registryVersion,
      },
      registerExtension: registerManifest,
      undo: () => applyHistory(history.undo(), (tx) => tx.inverse),
      redo: () => applyHistory(history.redo(), (tx) => tx.patches),
      canUndo: () => history.canUndo(),
      canRedo: () => history.canRedo(),
      getDocument: documentOf,
      validate: () => validateDocument(documentOf(), lookup),
      setSelection: (idsToSelect) => {
        setPageState({ pageId, selection: [...idsToSelect], elementFocus: null, partFocus: null });
      },
      clearSelection: () => {
        setPageState({ pageId, selection: [], elementFocus: null, partFocus: null });
      },
      focusElement: (id, path) => {
        setPageState({
          pageId,
          selection: [id],
          elementFocus: { id, path: [...path] },
          partFocus: null,
        });
      },
      clearElementFocus: () => {
        setPageState({ elementFocus: null });
      },
      // ── block-parts (2026-10-06) ──
      focusPart: (id, ref) => {
        setPageState({
          pageId,
          selection: [id],
          elementFocus: null,
          partFocus: { id, part: ref.part, index: [...ref.index] },
        });
      },
      clearPartFocus: () => {
        setPageState({ partFocus: null });
      },
      // ── /block-parts ──
      transactions: () => log.all(),
      flush: () => Promise.resolve(store.getState().seq),
    };
  }

  return {
    getSite: () => store.getState().site,
    pages: () => store.getState().site.pages.map((page) => page.id),
    currentPage: () => store.getState().pageId,
    setCurrentPage: (pageId) => {
      pageIndex(store.getState().site, pageId);
      const state = store.getState();
      write(
        { ...state, pageId, selection: [], elementFocus: null, partFocus: null },
        NOTHING_CHANGED,
      );
    },
    page: (pageId) => {
      pageIndex(store.getState().site, pageId);
      let lens = lenses.get(pageId);
      if (lens === undefined) {
        lens = lensFor(pageId);
        lenses.set(pageId, lens);
      }
      return lens;
    },
    dispatchGroup,
    undo: () => applyHistory(history.undo(), (tx) => tx.inverse),
    redo: () => applyHistory(history.redo(), (tx) => tx.patches),
    transactions: () => log.all(),
  };
}
