import {
  builderError,
  canonicalizeJsonValue,
  validateSite,
  type Author,
  type BlockSchemaLookup,
  type BuilderSite,
  type ClockPort,
  type CommandRuntime,
  type IdPort,
  type KernelApi,
  type PageId,
  type SitePersistenceAdapter,
  type Transaction,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { coreCommands } from '../commands/core-commands';
import type { GroupedDispatchOptions } from '../commands/dispatch';
import { createEventBus } from '../events/bus';
import { createExtensionManager, type ExtensionManagerHandle } from '../extensions/manager';
import type { BuilderKernel } from '../kernel/create-builder';
import { systemClock } from '../ports/system-clock';
import { systemIds } from '../ports/system-ids';
import { createRegistry } from '../registry/registry';
import { createPageView } from './page-view';
import { createSiteDispatcher, pageIndex, type SiteGroupStep } from './site-dispatcher';
import { createSiteStore, SITE_NOTHING_CHANGED } from './site-store';

const KERNEL_OWNER = '@craftkit/kernel';

/** Auto-flush the pending transaction batch to persistence every N transactions. */
export const SITE_PERSIST_COALESCE_EVERY = 25;

export interface CreateSiteBuilderOptions {
  site: BuilderSite;
  extensions?: readonly TrustedExtensionManifest[];
  ports?: { clock?: ClockPort; ids?: IdPort };
  persistence?: {
    adapter: SitePersistenceAdapter;
    siteId: string;
    coalesceEvery?: number;
  };
  /** The stored position a loaded site resumes from; 0 for a fresh one. */
  initialSeq?: number;
}

/**
 * The site kernel: one store, one transaction log, one history, N page lenses.
 *
 * `page(id)` returns a full `BuilderKernel`, so every surface that already
 * speaks to a kernel keeps working unchanged over a site. `dispatchGroup` is
 * the door that makes the arrangement worth its cost: a group mixing site
 * commands and page commands, across several pages, is ONE production, ONE
 * transaction and ONE undo.
 */
export interface BuilderSiteKernel {
  getSite(): Readonly<BuilderSite>;
  /**
   * Subscribe to every change of site state, for `useSyncExternalStore`.
   *
   * The STORE itself stays unexported (Law S) — this hands out a notification,
   * not a write path. A surface that needs the site as a whole (a page list, a
   * design panel) has no lens to read it through, and polling would make the
   * view lag exactly the way the log-ordering rule exists to prevent.
   */
  subscribe(listener: () => void): () => void;
  pages(): readonly PageId[];
  currentPage(): PageId;
  setCurrentPage(pageId: PageId): void;
  /** A page lens. Stable per id for the lifetime of the page. */
  page(pageId: PageId): BuilderKernel;
  dispatch(command: string, args: unknown, author?: Author, pageId?: PageId): Transaction;
  dispatchGroup(
    steps: readonly SiteGroupStep[],
    authorOrOptions?: Author | GroupedDispatchOptions,
  ): Transaction;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  transactions(): readonly Transaction[];
  /** Whole-site validation; page validity stays owned by `validateDocument`. */
  validate(): ReturnType<typeof validateSite>;
  extensions: ExtensionManagerHandle;
  flush(): Promise<number>;
}

export function createSiteBuilder(options: CreateSiteBuilderOptions): BuilderSiteKernel {
  const clock = options.ports?.clock ?? systemClock;
  const ids = options.ports?.ids ?? systemIds;

  /*
    Law M, whole-site edition: the site a kernel is built on is validated ONCE,
    at construction, and refused if it is not one. Everything after this point
    is entitled to assume a valid site — the dispatcher, every lens, every
    surface — and a kernel that quietly accepted a broken site would push that
    assumption's failure to whichever caller happened to read the bad field.

    Canonicalised first (011 research R2): a stored site may carry `-0`, which
    JSON cannot print, and a value that survives here would make patches and
    the next state disagree.
  */
  const seeded = canonicalizeJsonValue(options.site);
  const validated = validateSite(seeded);
  if (!validated.ok) {
    const first = validated.issues[0];
    throw builderError(
      'site/structural-violation',
      `This site cannot be opened: ${first?.message ?? 'unknown violation'}`,
    );
  }
  const firstPage = validated.site.pages[0];
  if (firstPage === undefined) {
    /*
      Unreachable through `validateSite`, which requires exactly one home page.
      Kept because `pages[0]` is otherwise an unchecked index, and an
      unreachable throw is cheaper than the `undefined` it would return.
    */
    throw builderError('site/structural-violation', 'A site needs at least one page.');
  }

  const store = createSiteStore({
    site: validated.site,
    pageId: firstPage.id,
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

  const dispatcher = createSiteDispatcher({
    store,
    registry: registry.read,
    runtime,
    clock,
    events,
  });

  /*
    The extension manager's `context` is the CURRENT page's kernel api, because
    that is what an extension means by "the document": a contributed tool acts
    on what the person is looking at. It is a getter, not a captured value, so
    switching pages moves every extension with it rather than stranding them on
    the page that happened to be current at registration.
  */
  const context: KernelApi = {
    get store() {
      return lensFor(store.getState().pageId).context.store;
    },
    dispatch: (command, args, author) => dispatcher.dispatch(command, args, author),
    registry: registry.read,
    events,
    get surface() {
      return currentDocument().surface;
    },
    get dir() {
      return currentDocument().dir;
    },
  };

  const manager = createExtensionManager(registry, events, () => context);
  manager.registerAll([...(options.extensions ?? [])]);

  const lenses = new Map<PageId, BuilderKernel>();

  function currentDocument() {
    const state = store.getState();
    const page = state.site.pages[pageIndex(state.site, state.pageId)];
    if (page === undefined) {
      throw builderError('site/structural-violation', 'The current page no longer exists.');
    }
    return page.document;
  }

  // ── Persistence: ONE log for the whole site ────────────────────────────────
  const persistence = options.persistence;
  const coalesceEvery = persistence?.coalesceEvery ?? SITE_PERSIST_COALESCE_EVERY;
  let persistedCount = 0;
  let flushChain: Promise<number> = Promise.resolve(store.getState().seq);

  /**
   * Send everything the log holds past `persistedCount`, one flush at a time.
   *
   * Both hazards the page kernel documents apply here unchanged, and both end
   * the same way — work on the screen that is not in storage, with nothing
   * anywhere saying so.
   *
   * A REJECTED LINK MUST NOT POISON THE CHAIN. `then(work)` alone skips its
   * callback when the predecessor rejected and re-raises the old error, so one
   * refused write silences every later save for the life of the kernel. The
   * chain kept below is always settled-either-way; the caller still sees its
   * own outcome because that is the promise `flush()` returns.
   *
   * AND THE MARK IS CLAIMED BEFORE THE AWAIT. `log.all()` is the live array;
   * reading its length after the append counts transactions dispatched WHILE
   * that append was in flight as persisted, and they are never sent.
   */
  function flush(): Promise<number> {
    if (persistence === undefined) {
      return Promise.resolve(store.getState().seq);
    }
    const { adapter, siteId } = persistence;
    const work = async (): Promise<number> => {
      const all = dispatcher.log.all();
      const pending = all.slice(persistedCount);
      const state = store.getState();
      if (pending.length === 0) {
        return state.seq;
      }
      const sent = persistedCount + pending.length;
      const { seq } = await adapter.append(siteId, [...pending], state.seq);
      persistedCount = sent;
      store.write({ ...store.getState(), seq }, SITE_NOTHING_CHANGED);
      return seq;
    };
    const result = flushChain.then(work, work);
    flushChain = result.catch(() => store.getState().seq);
    return result;
  }

  /**
   * Count-coalesced auto-flush, after the door has committed.
   *
   * Deliberately fire-and-forget with a swallowed rejection: a failed
   * background save must not turn a successful dispatch into a thrown error
   * inside the caller's event handler, and `flush()` is the call that reports
   * the outcome to anyone who wants it.
   */
  function afterDoor(tx: Transaction): Transaction {
    if (persistence === undefined || tx.patches.length === 0) {
      return tx;
    }
    if (dispatcher.log.all().length - persistedCount >= coalesceEvery) {
      void flush().catch(() => undefined);
    }
    return tx;
  }

  function lensFor(pageId: PageId): BuilderKernel {
    let lens = lenses.get(pageId);
    if (lens === undefined) {
      lens = createPageView(pageId, {
        store,
        dispatcher,
        registry: registry.read,
        events,
        extensions: manager,
        lookup,
        flush,
        afterDoor,
      });
      lenses.set(pageId, lens);
    }
    return lens;
  }

  /*
    A cached page-id list, keyed by the site reference. `useSyncExternalStore`
    compares snapshots by identity, so returning a fresh array every call would
    make React consider the store changed on every render and loop forever.
  */
  let pagesFor: BuilderSite | undefined;
  let pageIds: readonly PageId[] = [];

  return {
    getSite: () => store.getState().site,
    subscribe: (listener) =>
      store.subscribe(() => {
        listener();
      }),
    pages: () => {
      const current = store.getState().site;
      if (pagesFor !== current) {
        pagesFor = current;
        pageIds = current.pages.map((page) => page.id);
      }
      return pageIds;
    },
    currentPage: () => store.getState().pageId,
    setCurrentPage: (pageId) => {
      // Throws for an unknown page BEFORE the write, so a bad id changes nothing.
      pageIndex(store.getState().site, pageId);
      const state = store.getState();
      if (state.pageId === pageId) return;
      store.write({ ...state, pageId, selection: [], elementFocus: null }, SITE_NOTHING_CHANGED);
    },
    page: (pageId) => {
      pageIndex(store.getState().site, pageId);
      return lensFor(pageId);
    },
    dispatch: (command, args, author, pageId) =>
      afterDoor(dispatcher.dispatch(command, args, author, pageId)),
    dispatchGroup: (steps, authorOrOptions) =>
      afterDoor(dispatcher.dispatchGroup(steps, authorOrOptions)),
    undo: () => dispatcher.undo(),
    redo: () => dispatcher.redo(),
    canUndo: () => dispatcher.canUndo(),
    canRedo: () => dispatcher.canRedo(),
    transactions: () => dispatcher.log.all(),
    validate: () => validateSite(store.getState().site),
    extensions: manager,
    flush,
  };
}
