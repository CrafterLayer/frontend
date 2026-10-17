import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { BuilderSiteKernel } from '@craftkit/builder-core';
import type { PageId } from '@craftkit/builder-schema';

import { logicalArrowKey, resolveChromeDir } from '../../i18n/editor-locale';
import { SITE_PAGES_LABELS_EN, type SitePagesLabels } from './SitePages.labels';

import './SitePages.css';

export interface SitePagesProps {
  /** BY PROP — the shell never reads React context. */
  siteKernel: BuilderSiteKernel;
  /** Address given to a newly added page; the host owns the naming scheme. */
  nextAddress?: (existing: readonly string[]) => string;
  /** Every string the list shows (arabic-editor); English by default. */
  labels?: SitePagesLabels | undefined;
}

/** Where focus goes after a page is deleted, named rather than left to chance. */
function focusDestinationAfterDelete(ids: readonly PageId[], removedAt: number): PageId | null {
  /*
    The NEXT page, or the previous one when the last was removed. Named on
    purpose: a test that asserts `not.toHaveFocus()` on the deleted row passes
    when focus fell to `<body>`, which is the failure it was supposed to catch.
    The destination is part of the contract, so it is computed here where both
    the component and its test can name it.
  */
  return ids[removedAt] ?? ids[removedAt - 1] ?? null;
}

function defaultNextAddress(existing: readonly string[]): string {
  // Counted the way a person counts: the home page is page 1, so the first
  // page added to it is "/page-2", never "/page-1".
  let n = existing.length + 1;
  let candidate = `/page-${String(n)}`;
  while (existing.includes(candidate)) {
    n += 1;
    candidate = `/page-${String(n)}`;
  }
  return candidate;
}

/** "Page 2" for "/page-2"; for an address the host chose, the address itself, bare. */
function titleFor(address: string): string {
  const numbered = /^\/page-(\d+)$/.exec(address);
  if (numbered !== null) return `Page ${numbered[1] ?? ''}`.trim();
  return address.replace(/^\//, '') || 'Page';
}

/**
 * The site's pages as a listbox (013, US1).
 *
 * Reads the SITE, not a page: the current page, the order, and the titles are
 * site state, and there is no lens through which a page can see its siblings.
 * Every mutation goes through the site's own commands — `addPage`,
 * `removePage`, `renamePage`, `reorderPage` — so each is one transaction and
 * one undo, and each refusal is the door's, not this component's.
 */
export function SitePages({
  siteKernel,
  nextAddress = defaultNextAddress,
  labels = SITE_PAGES_LABELS_EN,
}: SitePagesProps) {
  const subscribe = useCallback(
    (listener: () => void) => siteKernel.subscribe(listener),
    [siteKernel],
  );
  const site = useSyncExternalStore(
    subscribe,
    () => siteKernel.getSite(),
    () => siteKernel.getSite(),
  );
  const currentPage = useSyncExternalStore(
    subscribe,
    () => siteKernel.currentPage(),
    () => siteKernel.currentPage(),
  );

  const pages = site.pages;
  const regionIds = Object.keys(site.sharedRegions).sort();
  const [activeId, setActiveId] = useState<PageId>(currentPage);
  const [renaming, setRenaming] = useState<PageId | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);

  /*
    Adjust-during-render (React's documented derived-state form): when the active
    row is gone, correct it in the SAME pass rather than in an effect.

    Keyed on the PAGES reference, not on a bare "is it missing" test. The first
    version re-read `currentPage` unconditionally whenever the active row was
    absent — and when the site has no pages at all, neither is present, so it set
    state on every render and React stopped with "Too many re-renders".
  */
  const [seenPages, setSeenPages] = useState(pages);
  if (seenPages !== pages) {
    setSeenPages(pages);
    if (!pages.some((page) => page.id === activeId)) {
      setActiveId(
        pages.some((page) => page.id === currentPage) ? currentPage : (pages[0]?.id ?? ''),
      );
    }
  }

  /**
   * Run a site command, showing a refusal instead of throwing through React.
   *
   * The door's refusals are part of normal use — deleting the home page, moving
   * a page past the end — and an exception escaping an event handler unmounts
   * the tree in development and tells the person nothing. The component does not
   * re-implement any refusal; it just reports the one the door gave.
   */
  const guarded = useCallback((run: () => void): boolean => {
    try {
      run();
      setRefusal(null);
      return true;
    } catch (error) {
      setRefusal(error instanceof Error ? error.message : labels.refused);
      return false;
    }
  }, [labels]);

  const activePage = pages.find((page) => page.id === activeId);
  const listRef = useRef<HTMLUListElement | null>(null);
  const rowRefs = useRef(new Map<PageId, HTMLLIElement>());
  const focusInsideRef = useRef(false);
  const pendingFocusRef = useRef<PageId | null>(null);

  /*
    Roving tabindex needs REAL focus to follow the active row, and a delete
    unmounts the focused <li> — the browser drops focus to <body> during the
    commit. A LAYOUT effect runs right after that commit and before paint, so it
    both observes the loss and repairs it before anyone sees a page with no
    keyboard position.
  */
  useLayoutEffect(() => {
    /*
      Never while a rename field is open. The field mounts with `autoFocus`, and
      an effect that also claims focus took it straight back — which fired the
      field's own `onBlur`, committed the rename, and unmounted the field before
      anyone could type. The row gets the keyboard back when the rename CLOSES,
      which is the next run of this effect.
    */
    if (renaming !== null) return;
    const list = listRef.current;
    const target = rowRefs.current.get(activeId);
    if (list === null || target === undefined) return;
    const active = list.ownerDocument.activeElement;
    const lostToBody =
      focusInsideRef.current && (active === null || active === list.ownerDocument.body);
    const claimed = pendingFocusRef.current === activeId;
    if ((claimed || list.contains(active) || lostToBody) && active !== target) {
      target.focus();
      pendingFocusRef.current = null;
    }
    /*
      `renaming` is a dependency because leaving the rename field is a focus
      move with no other trace: Escape closes the input and neither `activeId`
      nor `pages` changed, so without it the effect never re-ran and the
      keyboard was left on an element that had just unmounted.
    */
  }, [activeId, pages, renaming]);

  const open = useCallback(
    (id: PageId) => {
      setActiveId(id);
      siteKernel.setCurrentPage(id);
    },
    [siteKernel],
  );

  const move = useCallback(
    (id: PageId, delta: number) => {
      const from = pages.findIndex((page) => page.id === id);
      const to = from + delta;
      if (to < 0 || to >= pages.length) return;
      if (!guarded(() => siteKernel.dispatch('reorderPage', { pageId: id, toIndex: to }))) return;
      pendingFocusRef.current = id;
      setActiveId(id);
    },
    [guarded, pages, siteKernel],
  );

  const remove = useCallback(
    (id: PageId) => {
      const at = pages.findIndex((page) => page.id === id);
      const survivors = pages.filter((page) => page.id !== id).map((page) => page.id);
      const destination = focusDestinationAfterDelete(survivors, at);
      if (!guarded(() => siteKernel.dispatch('removePage', { pageId: id }))) return;
      if (destination !== null) {
        pendingFocusRef.current = destination;
        setActiveId(destination);
      }
    },
    [guarded, pages, siteKernel],
  );

  const commitRename = useCallback(
    (id: PageId) => {
      const title = draftTitle.trim();
      setRenaming(null);
      if (title.length === 0) return;
      const page = pages.find((candidate) => candidate.id === id);
      if (page === undefined || page.title === title) return;
      guarded(() => siteKernel.dispatch('renamePage', { pageId: id, title }));
    },
    [draftTitle, guarded, pages, siteKernel],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, id: PageId) => {
      const at = pages.findIndex((page) => page.id === id);
      // RTL mirrors the horizontal keys; vertical ones never mirror. The list is
      // chrome: the editor's direction wins, the site's when the host sets none.
      const key = logicalArrowKey(
        event.key,
        resolveChromeDir(event.currentTarget, site.dir === 'rtl' ? 'rtl' : 'ltr'),
      );

      if (event.altKey && (key === 'ArrowUp' || key === 'ArrowLeft')) {
        move(id, -1);
        event.preventDefault();
        return;
      }
      if (event.altKey && (key === 'ArrowDown' || key === 'ArrowRight')) {
        move(id, 1);
        event.preventDefault();
        return;
      }

      switch (key) {
        case 'ArrowDown':
        case 'ArrowRight': {
          const next = pages[at + 1];
          if (next !== undefined) setActiveId(next.id);
          break;
        }
        case 'ArrowUp':
        case 'ArrowLeft': {
          const previous = pages[at - 1];
          if (previous !== undefined) setActiveId(previous.id);
          break;
        }
        case 'Home': {
          const first = pages[0];
          if (first !== undefined) setActiveId(first.id);
          break;
        }
        case 'End': {
          const last = pages[pages.length - 1];
          if (last !== undefined) setActiveId(last.id);
          break;
        }
        case 'Enter':
        case ' ': {
          open(id);
          break;
        }
        case 'F2': {
          const page = pages.find((candidate) => candidate.id === id);
          setDraftTitle(page?.title ?? '');
          setRenaming(id);
          break;
        }
        case 'Delete': {
          remove(id);
          break;
        }
        default:
          return; // everything else stays native
      }
      event.preventDefault();
    },
    [pages, site.dir, move, open, remove],
  );

  const addPage = useCallback(() => {
    const address = nextAddress(pages.map((page) => page.address));
    const known = new Set(pages.map((page) => page.id));
    const added = guarded(() => {
      siteKernel.dispatch('addPage', { address, title: titleFor(address) });
    });
    if (!added) return;
    /*
      OPEN the page just made, and hand it the keyboard. A row appearing at the
      bottom of a list while the canvas keeps showing the old page reads as
      "nothing happened" — which is exactly how the first live use of this
      button was reported. The id is the door's to give, so it is read back
      from the site rather than guessed from the address.
    */
    const created = siteKernel.getSite().pages.find((page) => !known.has(page.id));
    if (created === undefined) return;
    pendingFocusRef.current = created.id;
    open(created.id);
  }, [guarded, nextAddress, open, pages, siteKernel]);

  return (
    <nav
      className="bldr-site-pages"
      aria-label={labels.nav}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next !== null && !event.currentTarget.contains(next)) {
          focusInsideRef.current = false;
        }
      }}
    >
      <div className="bldr-site-pages__header">
        <h2 className="bldr-site-pages__title">{labels.title}</h2>
        <button type="button" className="bldr-site-pages__add" onClick={addPage}>
          {labels.add}
        </button>
      </div>
      {refusal === null ? null : (
        <p role="status" className="bldr-site-pages__refusal">
          {refusal}
        </p>
      )}
      {pages.length === 0 ? (
        <p className="bldr-site-pages__empty">{labels.empty}</p>
      ) : (
        <ul ref={listRef} role="listbox" aria-label={labels.list} className="bldr-site-pages__list">
          {pages.map((page, index) => {
            const selected = page.id === currentPage;
            return (
              <li
                key={page.id}
                ref={(element) => {
                  if (element === null) {
                    rowRefs.current.delete(page.id);
                  } else {
                    rowRefs.current.set(page.id, element);
                  }
                }}
                role="option"
                aria-selected={selected}
                aria-posinset={index + 1}
                aria-setsize={pages.length}
                tabIndex={activeId === page.id ? 0 : -1}
                className={`bldr-site-pages__row${selected ? ' bldr-site-pages__row--current' : ''}`}
                onClick={() => {
                  open(page.id);
                }}
                onDoubleClick={() => {
                  setDraftTitle(page.title);
                  setRenaming(page.id);
                }}
                onKeyDown={(event) => {
                  onKeyDown(event, page.id);
                }}
                onFocus={() => {
                  focusInsideRef.current = true;
                  setActiveId(page.id);
                }}
              >
                {renaming === page.id ? (
                  <input
                    className="bldr-site-pages__rename"
                    aria-label={labels.rename(page.title)}
                    autoFocus
                    value={draftTitle}
                    onChange={(event) => {
                      setDraftTitle(event.target.value);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                    onBlur={() => {
                      commitRename(page.id);
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') {
                        /*
                          Claimed only for the KEYBOARD endings. A blur that
                          committed the rename means the person clicked
                          somewhere else, and pulling focus back to the row
                          would undo the move they just made.
                        */
                        pendingFocusRef.current = page.id;
                        commitRename(page.id);
                      } else if (event.key === 'Escape') {
                        setRenaming(null);
                        pendingFocusRef.current = page.id;
                      }
                    }}
                  />
                ) : (
                  <span className="bldr-site-pages__label">
                    <span className="bldr-site-pages__name">{page.title}</span>
                    <span className="bldr-site-pages__address">{page.address}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/*
        SHARED REGIONS, for the active page only (FR-004).

        Below the list rather than inside a row, and the reason is semantic: the
        list is a `listbox` whose children are `option`s, and an option
        containing checkboxes is a control containing controls — a shape no
        screen reader has a sensible reading for. The active page is already the
        subject of this panel, so the regions it carries belong beside it.

        Each toggle is ONE `setPageRegions`: opting out is a page's decision
        about itself, and it must not become a write to the region or to any
        other page.
      */}
      {regionIds.length === 0 || activePage === undefined ? null : (
        <fieldset className="bldr-site-pages__regions">
          <legend className="bldr-site-pages__regions-legend">
            {labels.sharedRegions(activePage.title)}
          </legend>
          {regionIds.map((regionId) => {
            const region = site.sharedRegions[regionId];
            const on = activePage.regions.includes(regionId);
            return (
              <label className="bldr-site-pages__region" key={regionId}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    guarded(() => {
                      siteKernel.dispatch('setPageRegions', {
                        pageId: activePage.id,
                        regions: on
                          ? activePage.regions.filter((entry) => entry !== regionId)
                          : [...activePage.regions, regionId],
                      });
                    });
                  }}
                />
                <span>
                  {regionId}
                  {region === undefined ? '' : ` (${region.kind})`}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </nav>
  );
}
