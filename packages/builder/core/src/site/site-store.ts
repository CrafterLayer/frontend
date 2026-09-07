import { createStore } from 'zustand/vanilla';

import type { BuilderSite, ElementFocus, Node, NodeId, PageId } from '@craftkit/builder-schema';

/**
 * The site kernel's single state (013, ق١).
 *
 * ONE store for the whole site, not one per page. The reason is atomicity: a
 * group that adds a page and edits another has to be one immer production, one
 * transaction and one undo, and that is only true when both changes are drafts
 * of the same root. N page stores would need a coordinator, and a coordinator
 * cannot make N histories agree about what "one step back" means.
 *
 * `pageId` is the site's ONE current page — the page a lens-less caller means,
 * and the page whose selection and element focus are live. Selection is not
 * per-page state: a person selects in one page at a time, and a second seat of
 * selection is a second answer to "what is selected".
 */
export interface KernelSiteState {
  site: BuilderSite;
  pageId: PageId;
  selection: NodeId[];
  elementFocus: ElementFocus | null;
  seq: number;
}

/** What one write has to wake: named `<pageId>::<nodeId>` keys, or everyone. */
export interface SiteNotifyTargets {
  readonly keys: ReadonlySet<string>;
  /**
   * A structural change — a page inserted, removed or reordered — cannot be
   * attributed per node, because immer coalesces it into replacements of whole
   * page elements and the node path disappears. Waking everyone is a
   * re-render; waking nobody is a view that lies (S1's recorded finding).
   */
  readonly structural: boolean;
}

/** An ephemeral write (selection, current page) changes no node. */
export const SITE_NOTHING_CHANGED: SiteNotifyTargets = {
  keys: new Set<string>(),
  structural: false,
};

export interface SiteStoreHandle {
  getState(): Readonly<KernelSiteState>;
  subscribe(listener: (state: KernelSiteState) => void): () => void;
  subscribeNode(pageId: PageId, id: NodeId, listener: (node: Node | undefined) => void): () => void;
  write(next: KernelSiteState, changed: SiteNotifyTargets): void;
}

function notifyObserver(callback: () => void): void {
  try {
    callback();
  } catch {
    // Observers are views and telemetry. They run after the store accepted the
    // new state and cannot roll back a transaction the door already committed.
  }
}

export function nodeKey(pageId: PageId, id: NodeId): string {
  return `${pageId}::${id}`;
}

export function createSiteStore(initial: KernelSiteState): SiteStoreHandle {
  const store = createStore<KernelSiteState>()(() => initial);
  const nodeListeners = new Map<string, Set<(node: Node | undefined) => void>>();

  return {
    getState: () => store.getState(),
    subscribe: (listener) =>
      store.subscribe((state) => {
        notifyObserver(() => {
          listener(state);
        });
      }),
    subscribeNode(pageId, id, listener) {
      const key = nodeKey(pageId, id);
      let set = nodeListeners.get(key);
      if (set === undefined) {
        set = new Set();
        nodeListeners.set(key, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) {
          nodeListeners.delete(key);
        }
      };
    },
    write(next, changed) {
      store.setState(next, true);
      const keys = changed.structural ? [...nodeListeners.keys()] : [...changed.keys];
      for (const key of keys) {
        const set = nodeListeners.get(key);
        if (set === undefined) continue;
        const separator = key.indexOf('::');
        const pageId = key.slice(0, separator);
        const nodeId = key.slice(separator + 2);
        /*
          A tolerant lookup. S1's first version called an index helper that
          THROWS on an unknown page — after the state was written, after the
          transaction was logged and recorded — so a group that renamed a page
          id while editing it tore a transaction the door had already
          committed, and the caller saw a refusal for work that had happened.
          A vanished page notifies `undefined`, which is exactly what a
          subscriber to a node that no longer exists should hear.
        */
        const page = next.site.pages.find((candidate) => candidate.id === pageId);
        const node = page?.document.nodes[nodeId];
        for (const listener of [...set]) {
          notifyObserver(() => {
            listener(node);
          });
        }
      }
    },
  };
}

/**
 * Which page-scoped nodes a patch set touched.
 *
 * Site-rooted patches read `['pages', <index>, 'document', 'nodes', <id>, …]`,
 * so the page a change belongs to is recoverable from the path itself. That is
 * the property that lets ONE store serve page-scoped subscriptions: a listener
 * on page A's hero is never woken by an edit to page B's hero of the same id.
 *
 * Promoted verbatim from the S1 spike, including the `length <= 2` branch that
 * the spike's first version got wrong: a patch stopping at `['pages', i]` is a
 * whole-element write, and requiring the full node path returned an EMPTY set
 * for exactly the structural groups where every subscriber needed waking.
 */
export function changedPageNodes(
  site: BuilderSite,
  patches: readonly { path: (string | number)[] }[],
): SiteNotifyTargets {
  const keys = new Set<string>();
  let structural = false;
  for (const patch of patches) {
    if (patch.path[0] !== 'pages') {
      /*
        A change to `sharedRegions`, `designSystem`, `assets` or `dir` repaints
        every page — a header is on all of them, a token is in all of them — so
        it wakes everyone rather than nobody.
      */
      structural = true;
      continue;
    }
    if (patch.path.length <= 2) {
      structural = true;
      continue;
    }
    if (patch.path[2] !== 'document' || patch.path[3] !== 'nodes') continue;
    const page = site.pages[Number(patch.path[1])];
    if (page === undefined) continue;
    keys.add(nodeKey(page.id, String(patch.path[4])));
  }
  return { keys, structural };
}
