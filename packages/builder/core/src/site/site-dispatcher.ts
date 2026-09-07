import {
  builderError,
  canonicalizeJsonValue,
  type Author,
  type BuilderDocument,
  type BuilderSite,
  type ClockPort,
  type CommandRuntime,
  type EventBus,
  type PageId,
  type Patch,
  type RegistryRead,
  type Transaction,
} from '@craftkit/builder-schema';

import {
  assertAuthor,
  assertJsonPatches,
  normalizeGroupedDispatchOptions,
  type GroupedDispatchOptions,
  type GroupStep,
} from '../commands/dispatch';
import { GROUPED_DISPATCH_LABEL_MAX_LENGTH } from '../commands/dispatch';
import { isSiteCommandName, siteCommands } from '../commands/site-commands';
import { createHistory, type History } from '../history/history';
import { applySitePatchSet } from '../patches/apply';
import { produceWithPatches } from '../patches/immer';
import { TransactionLog } from '../patches/log';
import { changedPageNodes, type KernelSiteState, type SiteStoreHandle } from './site-store';

/** One member of a grouped site dispatch: a page step may name its page. */
export interface SiteGroupStep extends GroupStep {
  /**
   * Which page a PAGE command edits. Ignored for site commands, whose draft is
   * the site itself. Omitted means the site's current page.
   */
  pageId?: PageId;
}

export interface SiteDispatcher {
  dispatch: (command: string, args: unknown, author?: Author, pageId?: PageId) => Transaction;
  dispatchGroup: (
    steps: readonly SiteGroupStep[],
    authorOrOptions?: Author | GroupedDispatchOptions,
  ) => Transaction;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  log: TransactionLog;
  history: History;
}

interface SiteDispatcherDeps {
  store: SiteStoreHandle;
  registry: RegistryRead;
  runtime: CommandRuntime;
  clock: ClockPort;
  events: EventBus;
}

/**
 * The site's single door.
 *
 * The whole claim of ق١ lives in `dispatchGroup` below: whatever mix of site
 * commands and page commands a group holds, they all run inside ONE
 * `produceWithPatches` over the site root. Atomicity is therefore structural —
 * there is no coordinator to get wrong, no half-applied group to reconcile, and
 * one inverse patch set that reverses the whole thing in one undo.
 *
 * `addPage` writes to the draft directly; `setProp` writes to
 * `draft.pages[i].document`. The router is `isSiteCommandName`, resolved BEFORE
 * the production starts so an unknown command refuses without touching the
 * draft (Law V, fail fast).
 */
export function createSiteDispatcher(deps: SiteDispatcherDeps): SiteDispatcher {
  const log = new TransactionLog();
  const history = createHistory();

  /**
   * A step, resolved to a producer plus the draft it writes to.
   *
   * A discriminated union rather than a flag and one erased producer: the two
   * producers take genuinely different drafts, and typing them the same would
   * let a page command be handed the site — the exact mistake `defineSiteCommand`
   * exists to make impossible at the authoring end.
   */
  type Prepared =
    | { kind: 'site'; mutate: (draft: BuilderSite, rt: CommandRuntime) => void }
    | {
        kind: 'page';
        /** Index into `site.pages`, resolved against the PRE-group site. */
        index: number;
        mutate: (draft: BuilderDocument, rt: CommandRuntime) => void;
      };

  function prepare(state: KernelSiteState, step: SiteGroupStep): Prepared {
    const args = canonicalizeJsonValue(step.args);
    if (isSiteCommandName(step.command)) {
      // Law V runs inside `apply`: args parse here, before any production.
      return { kind: 'site', mutate: siteCommands[step.command].apply(args) };
    }
    const registered = deps.registry.command(step.command);
    if (registered === undefined) {
      throw builderError('cmd/unknown', `No command named "${step.command}" is registered.`);
    }
    return {
      kind: 'page',
      index: pageIndex(state.site, step.pageId ?? state.pageId),
      mutate: registered.apply(args),
    };
  }

  function dispatch(
    command: string,
    args: unknown,
    author: Author = 'user',
    pageId?: PageId,
  ): Transaction {
    assertAuthor(author);
    return dispatchGroup([pageId === undefined ? { command, args } : { command, args, pageId }], {
      author,
    });
  }

  function dispatchGroup(
    steps: readonly SiteGroupStep[],
    authorOrOptions?: Author | GroupedDispatchOptions,
  ): Transaction {
    if (steps.length === 0) {
      throw builderError('cmd/invalid-args', 'A dispatch group needs at least one step.');
    }
    const defaultLabel = (
      steps.length === 1 ? (steps[0]?.command ?? 'group') : `group(${String(steps.length)})`
    ).slice(0, GROUPED_DISPATCH_LABEL_MAX_LENGTH);
    const { author, label } = normalizeGroupedDispatchOptions(authorOrOptions, defaultLabel);

    const state = deps.store.getState();
    const prepared = steps.map((step) => prepare(state, step));

    const [nextSite, patches, inverse] = produceWithPatches(state.site, (draft) => {
      for (const step of prepared) {
        if (step.kind === 'site') {
          step.mutate(draft, deps.runtime);
          continue;
        }
        /*
          Re-read the page INSIDE the production, by index resolved before it.
          A group whose earlier step removed or reordered pages would otherwise
          write through a stale reference — and the index was resolved against
          the pre-group site, so a group that both restructures and edits must
          say so by ordering its steps, not by hoping.
        */
        const page = draft.pages[step.index];
        if (page === undefined) {
          throw builderError(
            'site/structural-violation',
            'A page named by this group no longer exists at the point the group edits it.',
          );
        }
        step.mutate(page.document, deps.runtime);
      }
    });

    return commit(label, author, state, nextSite, patches, inverse);
  }

  function commit(
    command: string,
    author: Author,
    state: KernelSiteState,
    nextSite: BuilderSite,
    patches: Patch[],
    inverse: Patch[],
  ): Transaction {
    assertJsonPatches(patches);
    assertDirectionStaysWhole(patches);

    const tx: Transaction = {
      id: deps.runtime.ids.newId(),
      command,
      author,
      patches,
      inverse,
      ts: deps.clock.now(),
    };

    if (patches.length === 0) {
      // A no-effect group is not an observable change: nothing written, logged,
      // or undoable (Law S's 1:1 change↔transaction pairing counts observable
      // changes).
      return tx;
    }

    // Log and history BEFORE the notification, exactly as the page dispatcher
    // does (007 convergence class): React's useSyncExternalStore reads snapshots
    // SYNCHRONOUSLY inside the notification, so a subscriber deriving from the
    // log must already see this transaction or the view lags forever.
    log.append(tx);
    history.record(tx);
    deps.store.write(
      { ...state, site: nextSite, ...pruneViewState(state, state.site, nextSite) },
      changedPageNodes(state.site, patches),
    );
    deps.events.emit('tx.applied', { tx });
    return tx;
  }

  function applyHistory(
    tx: Transaction | undefined,
    patchesOf: (tx: Transaction) => Patch[],
    event: 'history.undone' | 'history.redone',
  ): boolean {
    if (tx === undefined) return false;
    const state = deps.store.getState();
    const nextSite = applySitePatchSet(state.site, patchesOf(tx));
    deps.store.write(
      { ...state, site: nextSite, ...pruneViewState(state, state.site, nextSite) },
      changedPageNodes(state.site, patchesOf(tx)),
    );
    deps.events.emit(event, { tx });
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

/**
 * A page may not change direction on its own.
 *
 * `setDocMeta` is a perfectly good PAGE command, and through a lens it writes
 * `pages[i].document.dir`. Inside a site that leaves every other page — and the
 * site's own `dir` — pointing the other way, which `validateSite` reports as
 * `page-direction-mismatch` on RELOAD: the editor looks fine for the whole
 * session and refuses to open next time. That is the worst shape a defect can
 * take, so the door refuses it at the moment it happens and names the command
 * that does turn a whole site.
 *
 * Only a page-scoped write is refused. `setSiteDirection` writes `dir` at the
 * site root and every page in one production, so its patches carry the site's
 * own `dir` too — which is exactly what tells the two apart.
 */
function assertDirectionStaysWhole(patches: readonly Patch[]): void {
  const turnsAPage = patches.some(
    (patch) => patch.path[0] === 'pages' && patch.path[2] === 'document' && patch.path[3] === 'dir',
  );
  if (!turnsAPage) return;
  const turnsTheSite = patches.some((patch) => patch.path[0] === 'dir');
  if (turnsTheSite) return;
  throw builderError(
    'site/structural-violation',
    'A page cannot change direction on its own; use setSiteDirection to turn the whole site.',
    ['dir'],
  );
}

export function pageIndex(site: BuilderSite, pageId: PageId): number {
  const index = site.pages.findIndex((page) => page.id === pageId);
  if (index < 0) {
    throw builderError('site/structural-violation', `No page "${pageId}" in this site.`, [
      'pageId',
    ]);
  }
  return index;
}

/**
 * View state is bookkeeping over LIVE things, and the site door can invalidate
 * it three ways the page door cannot: by removing the selected node, by
 * removing the page it lives on, and by removing the CURRENT page itself.
 *
 * All three are repaired inside the same `store.write`, so no extra
 * notification is emitted and the Law-S 1:1 change↔transaction pairing is
 * untouched. Values are returned BY REFERENCE when nothing was dropped, so
 * subscribers never churn on an unrelated command.
 *
 * The third case is the one a page kernel cannot have and the one that was
 * missed first: leaving `pageId` naming a removed page makes `currentPage()`
 * return a dead id, makes every lens report an empty selection because none of
 * them is "current", and makes the site's own `context.dir` throw. The kernel
 * moves to whichever page took the removed one's INDEX — the neighbour, which
 * is what an editor does when you close a tab — and falls back to the last page
 * when the removed one was at the end.
 */
function pruneViewState(
  state: Pick<KernelSiteState, 'selection' | 'elementFocus' | 'pageId'>,
  previous: BuilderSite,
  site: BuilderSite,
): Pick<KernelSiteState, 'selection' | 'elementFocus' | 'pageId'> {
  const { selection, elementFocus } = state;
  let pageId = state.pageId;
  let page = site.pages.find((candidate) => candidate.id === pageId);

  if (page === undefined) {
    const wasAt = previous.pages.findIndex((candidate) => candidate.id === pageId);
    const neighbour =
      site.pages[Math.min(Math.max(wasAt, 0), site.pages.length - 1)] ?? site.pages[0];
    if (neighbour === undefined) {
      /*
        Unreachable while `removePage` refuses the home page and `validateSite`
        requires exactly one — but `applySitePatches` validates AFTER producing,
        so this function can see an empty page list on the way to a refusal.
        Returning the state unchanged is correct there: the transaction is about
        to be thrown away.
      */
      return { selection, elementFocus, pageId };
    }
    pageId = neighbour.id;
    page = neighbour;
    // A page change always clears selection, exactly as `setCurrentPage` does.
    return { selection: selection.length === 0 ? selection : [], elementFocus: null, pageId };
  }

  const live =
    selection.length === 0
      ? selection
      : selection.filter((id) => page.document.nodes[id] !== undefined);
  const nextSelection = live.length === selection.length ? selection : live;
  const nextFocus =
    elementFocus !== null && nextSelection[0] === elementFocus.id ? elementFocus : null;
  return { selection: nextSelection, elementFocus: nextFocus, pageId };
}
