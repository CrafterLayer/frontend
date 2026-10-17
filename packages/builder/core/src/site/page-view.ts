import {
  builderError,
  validateDocument,
  type Author,
  type BlockSchemaLookup,
  type BuilderDocument,
  type BuilderError,
  type EventBus,
  type KernelApi,
  type KernelState,
  type PageId,
  type RegistryRead,
  type StateFacade,
  type Transaction,
} from '@craftkit/builder-schema';

import type { GroupedDispatchOptions, GroupStep } from '../commands/dispatch';
import type { ExtensionManagerHandle } from '../extensions/manager';
import { createKernelHistoryView, type BuilderKernel } from '../kernel/create-builder';
import { pageIndex, type SiteDispatcher } from './site-dispatcher';
import { SITE_NOTHING_CHANGED, type KernelSiteState, type SiteStoreHandle } from './site-store';

interface PageViewDeps {
  store: SiteStoreHandle;
  dispatcher: SiteDispatcher;
  registry: RegistryRead;
  events: EventBus;
  extensions: ExtensionManagerHandle;
  lookup: BlockSchemaLookup;
  flush: () => Promise<number>;
  /**
   * The site kernel's post-door hook, so a dispatch made THROUGH a lens
   * coalesces toward persistence exactly like one made on the site. An earlier
   * version wired this only on the site's own methods, which meant every edit a
   * surface made — and surfaces only ever hold a lens — never counted toward a
   * flush.
   */
  afterDoor: (tx: Transaction) => Transaction;
}

/**
 * A page LENS: the whole `BuilderKernel` surface over one page of a site kernel.
 *
 * This is what S1 was built to falsify, and it held. Every surface that already
 * speaks to a kernel — the canvas, the layer tree, the inspector, the code
 * view, the assistant — takes a `BuilderKernel` and does not need to learn that
 * a site exists. What it gets here is a view, not a second kernel: one store,
 * one transaction log, one history underneath.
 *
 * The lens is typed as the real `BuilderKernel` deliberately, so the compiler
 * counts the members. An earlier version of the spike cast through `unknown`
 * and silently dropped `extensions.has` and `extensions.version` — two members
 * shipped code already calls — which defeated the exact thing the lens claims.
 */
export function createPageView(pageId: PageId, deps: PageViewDeps): BuilderKernel {
  const documentOf = (): BuilderDocument => {
    const state = deps.store.getState();
    const page = state.site.pages[pageIndex(state.site, pageId)];
    if (page === undefined) {
      throw builderError('site/structural-violation', `No page "${pageId}" in this site.`);
    }
    return page.document;
  };

  /*
    The state a page's subscribers see. Selection and element focus belong to
    the site's ONE current page, so a lens for any other page reports an empty
    selection rather than borrowing it — a lens is a view of a page, not a
    second seat of UI state.
  */
  const stateOf = (): KernelState => {
    const state = deps.store.getState();
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
      deps.store.subscribe(() => {
        listener(stateOf());
      }),
    subscribeNode: (id, listener) => deps.store.subscribeNode(pageId, id, listener),
    select: (selector, listener) => {
      let previous = selector(stateOf());
      return deps.store.subscribe(() => {
        const next = selector(stateOf());
        if (!Object.is(next, previous)) {
          previous = next;
          listener(next);
        }
      });
    },
  };

  const dispatch = (command: string, args: unknown, author?: Author): Transaction =>
    deps.afterDoor(deps.dispatcher.dispatch(command, args, author, pageId));

  const context: KernelApi = {
    store: facade,
    dispatch,
    registry: deps.registry,
    events: deps.events,
    get surface() {
      return documentOf().surface;
    },
    get dir() {
      return documentOf().dir;
    },
  };

  const setPageState = (patch: Partial<KernelSiteState>): void => {
    const state = deps.store.getState();
    deps.store.write({ ...state, ...patch }, SITE_NOTHING_CHANGED);
  };

  return {
    context,
    dispatch,
    dispatchGroup: (
      steps: readonly GroupStep[],
      authorOrOptions?: Author | GroupedDispatchOptions,
    ) =>
      /*
        Every step of a group dispatched THROUGH a page lens edits that page.
        A caller who wants a group spanning pages, or one mixing site commands
        with page commands, dispatches on the site kernel — which is the only
        place where saying "this step belongs to that page" is meaningful.
      */
      deps.afterDoor(
        deps.dispatcher.dispatchGroup(
          steps.map((step) => ({ ...step, pageId })),
          authorOrOptions,
        ),
      ),
    extensions: deps.extensions,
    registerExtension: (manifest) => {
      deps.extensions.register(manifest);
    },
    undo: () => deps.dispatcher.undo(),
    redo: () => deps.dispatcher.redo(),
    canUndo: () => deps.dispatcher.canUndo(),
    canRedo: () => deps.dispatcher.canRedo(),
    getDocument: documentOf,
    validate: (): BuilderError[] => validateDocument(documentOf(), deps.lookup),
    setSelection: (ids) => {
      /*
        Selecting inside a page MAKES it the current page. The alternative —
        selection on a page the site does not consider current — is a second
        seat of UI state, and every surface reading `state.selection` would
        have to ask which page it belonged to.
      */
      setPageState({ pageId, selection: [...ids], elementFocus: null, partFocus: null });
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
    transactions: () => deps.dispatcher.log.all(),
    // P11-integration: the site's one undo stack, read-only, for the History list (style-manager §E).
    history: () => createKernelHistoryView(deps.dispatcher),
    flush: deps.flush,
  };
}
