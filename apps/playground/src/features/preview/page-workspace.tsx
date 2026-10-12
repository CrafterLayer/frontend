import { ChromeButton, projectSitemap, type BuilderSiteKernel } from '@craftkit/builder';
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import {
  PageActionsMenu,
  type PageDeleteRequest,
  type PageMenuAction,
} from './components/PageActionsMenu';
import { SiteMap } from './components/SiteMap';
import {
  firstReplacement,
  firstReplacementTitle,
  inboundLinkCounts,
  nextPageAddress,
  pageNumber,
  pageSettingsSteps,
  settingsFor,
  sharedSummary,
  type PageSettingsDraft,
} from './page-workspace.model';
import { PAGE_WORKSPACE_LABELS_EN, type PageWorkspaceLabels } from './page-workspace.labels';
import './page-workspace.css';

export type PageWorkspaceView = 'list' | 'map';

export interface PageWorkspaceProps {
  readonly siteKernel: BuilderSiteKernel;
  readonly thumbnailByPageId?: Readonly<Record<string, string>> | undefined;
  readonly view?: PageWorkspaceView | undefined;
  readonly initialView?: PageWorkspaceView | undefined;
  readonly onViewChange?: ((view: PageWorkspaceView) => void) | undefined;
  /**
   * Every string the workspace (and its site map and page menus) shows; English
   * by default, the host passes the editor locale's set.
   */
  readonly labels?: PageWorkspaceLabels | undefined;
}

/** One state and command surface for the page list, visual map, routes, SEO, share, and direction. */
export function PageWorkspace({
  siteKernel,
  thumbnailByPageId,
  view: controlledView,
  initialView = 'list',
  onViewChange,
  labels = PAGE_WORKSPACE_LABELS_EN,
}: PageWorkspaceProps) {
  const subscribe = useCallback(
    (listener: () => void) => siteKernel.subscribe(listener),
    [siteKernel],
  );
  const readSite = useCallback(() => siteKernel.getSite(), [siteKernel]);
  const readCurrentPage = useCallback(() => siteKernel.currentPage(), [siteKernel]);
  const site = useSyncExternalStore(subscribe, readSite, readSite);
  const currentPageId = useSyncExternalStore(subscribe, readCurrentPage, readCurrentPage);
  const [localView, setLocalView] = useState<PageWorkspaceView>(initialView);
  const view = controlledView ?? localView;
  const [settings, setSettings] = useState<PageSettingsDraft | null>(null);
  const [status, setStatus] = useState('');
  /*
    Derived per SITE, not per render (2026-10-12). The workspace re-renders on
    every host render — a save-state change, a page switch — and both of these
    walk every node of every page; on a 20-page site they were most of the time
    "Add page" took to paint. A new page is a new site, so they still follow
    every change.
  */
  const projection = useMemo(
    () => projectSitemap(site, { thumbnailByPageId }),
    [site, thumbnailByPageId],
  );
  const inboundLinks = useMemo(() => inboundLinkCounts(site), [site]);

  const changeView = useCallback(
    (nextView: PageWorkspaceView): void => {
      if (controlledView === undefined) setLocalView(nextView);
      onViewChange?.(nextView);
    },
    [controlledView, onViewChange],
  );

  const run = useCallback(
    (change: () => void, success: string): boolean => {
      try {
        change();
        setStatus(success);
        return true;
      } catch (error) {
        setStatus(error instanceof Error ? error.message : labels.refused);
        return false;
      }
    },
    [labels],
  );

  const openSettings = useCallback(
    (pageId: string) => {
      const page = site.pages.find((candidate) => candidate.id === pageId);
      if (page === undefined) return;
      setSettings(settingsFor(page, site.dir));
    },
    [site.dir, site.pages],
  );

  const action = useCallback(
    (command: PageMenuAction, pageId: string): void => {
      const pageIndex = site.pages.findIndex((page) => page.id === pageId);
      const page = site.pages[pageIndex];
      if (page === undefined) return;
      switch (command) {
        case 'open':
          siteKernel.setCurrentPage(pageId);
          setSettings(null);
          return;
        case 'rename':
        case 'change-route':
        case 'settings':
          openSettings(pageId);
          return;
        case 'duplicate': {
          const before = new Set(site.pages.map((candidate) => candidate.id));
          if (
            !run(() => {
              siteKernel.dispatch('duplicatePage', { pageId });
            }, labels.duplicated(page.title))
          )
            return;
          const duplicate = siteKernel
            .getSite()
            .pages.find((candidate) => !before.has(candidate.id));
          if (duplicate !== undefined) siteKernel.setCurrentPage(duplicate.id);
          return;
        }
        case 'move-up':
          run(() => {
            siteKernel.dispatch('reorderPage', { pageId, toIndex: pageIndex - 1 });
          }, labels.movedUp(page.title));
          return;
        case 'move-down':
          run(() => {
            siteKernel.dispatch('reorderPage', { pageId, toIndex: pageIndex + 1 });
          }, labels.movedDown(page.title));
          return;
        case 'make-home':
          run(() => {
            siteKernel.dispatch('setHomePage', { pageId });
          }, labels.madeHome(page.title));
          return;
        case 'clear':
          run(() => {
            siteKernel.dispatch('clearPage', { pageId });
          }, labels.cleared(page.title));
          return;
      }
    },
    [labels, openSettings, run, site.pages, siteKernel],
  );

  const remove = useCallback(
    (request: PageDeleteRequest): void => {
      const page = site.pages.find((candidate) => candidate.id === request.pageId);
      if (page === undefined) return;
      const args = {
        pageId: request.pageId,
        ...(request.unlinkInboundLinks ? { linkResolution: { action: 'unlink' as const } } : {}),
        ...(request.replacementHomePageId === undefined
          ? {}
          : { replacementHomePageId: request.replacementHomePageId }),
      };
      if (
        run(() => {
          siteKernel.dispatch('removePage', args);
        }, labels.deleted(page.title))
      ) {
        if (settings?.pageId === request.pageId) setSettings(null);
      }
    },
    [labels, run, settings?.pageId, site.pages, siteKernel],
  );

  const addPage = useCallback(() => {
    const address = nextPageAddress(site.pages.map((page) => page.address));
    const before = new Set(site.pages.map((page) => page.id));
    if (
      !run(() => {
        siteKernel.dispatch('addPage', {
          address,
          title: labels.newPageTitle(pageNumber(address)),
        });
      }, labels.added)
    )
      return;
    const created = siteKernel.getSite().pages.find((page) => !before.has(page.id));
    if (created !== undefined) siteKernel.setCurrentPage(created.id);
  }, [labels, run, site.pages, siteKernel]);

  const reorder = useCallback(
    (pageId: string, toIndex: number) => {
      const page = site.pages.find((candidate) => candidate.id === pageId);
      if (page === undefined) return;
      run(() => {
        siteKernel.dispatch('reorderPage', { pageId, toIndex });
      }, labels.moved(page.title));
    },
    [labels, run, site.pages, siteKernel],
  );

  const actionsByPageId = Object.fromEntries(
    projection.pages.map((page): [string, ReactNode] => [
      page.id,
      <PageActionsMenu
        key={page.id}
        page={page}
        pageCount={projection.pages.length}
        inboundLinkCount={inboundLinks.get(page.id) ?? 0}
        replacementHomePageId={page.isHome ? firstReplacement(site.pages, page.id) : undefined}
        replacementHomeTitle={page.isHome ? firstReplacementTitle(site.pages, page.id) : undefined}
        canMoveUp={page.index > 0}
        canMoveDown={page.index < projection.pages.length - 1}
        onAction={action}
        onDelete={remove}
        labels={labels.pageActions}
      />,
    ]),
  );

  const saveSettings = (): void => {
    if (settings === null) return;
    const pageIndex = site.pages.findIndex((page) => page.id === settings.pageId);
    const page = site.pages[pageIndex];
    if (page === undefined) {
      setStatus(labels.pageGone);
      setSettings(null);
      return;
    }
    const steps = pageSettingsSteps(site.dir, page, pageIndex, settings);
    if (steps.length === 0) {
      setStatus(labels.upToDate);
      setSettings(null);
      return;
    }
    if (
      run(() => {
        siteKernel.dispatchGroup(steps, { author: 'user', label: 'updatePageSettings' });
      }, labels.saved(settings.title))
    ) {
      setSettings(null);
    }
  };

  return (
    <section className="pg-page-workspace" aria-label={labels.region}>
      <header className="pg-page-workspace__header">
        <div>
          <h2>{labels.title}</h2>
          <p>{labels.summary(site.pages.length)}</p>
        </div>
        <ChromeButton variant="primary" size="sm" onClick={addPage}>
          {labels.addPage}
        </ChromeButton>
      </header>
      <div className="pg-page-workspace__switch" role="group" aria-label={labels.viewGroup}>
        <ChromeButton
          variant="toggle"
          size="sm"
          aria-pressed={view === 'list'}
          onClick={() => {
            changeView('list');
          }}
        >
          {labels.listView}
        </ChromeButton>
        <ChromeButton
          variant="toggle"
          size="sm"
          aria-pressed={view === 'map'}
          onClick={() => {
            changeView('map');
          }}
        >
          {labels.mapView}
        </ChromeButton>
      </div>
      <output className="pg-page-workspace__status" aria-live="polite">
        {status}
      </output>

      {view === 'list' ? (
        <ol className="pg-page-workspace__list" aria-label={labels.pageList}>
          {projection.pages.map((page) => (
            <li key={page.id} data-current={currentPageId === page.id ? '' : undefined}>
              <button
                type="button"
                className="pg-page-workspace__open"
                aria-current={currentPageId === page.id ? 'page' : undefined}
                onClick={() => {
                  siteKernel.setCurrentPage(page.id);
                }}
              >
                <span>{page.title}</span>
                <small>
                  {page.address}
                  {page.isHome ? ` · ${labels.home}` : ''}
                </small>
                <small>{sharedSummary(page, labels)}</small>
              </button>
              {actionsByPageId[page.id]}
            </li>
          ))}
        </ol>
      ) : (
        <SiteMap
          pages={projection.pages}
          selectedPageId={currentPageId}
          onSelect={(pageId) => {
            siteKernel.setCurrentPage(pageId);
          }}
          onReorder={reorder}
          actionsByPageId={actionsByPageId}
          labels={labels.siteMap}
        />
      )}

      {settings === null ? null : (
        <form
          className="pg-page-workspace__settings"
          aria-label={labels.settingsFor(settings.title)}
          onSubmit={(event) => {
            event.preventDefault();
            saveSettings();
          }}
        >
          <header>
            <div>
              <h3>{labels.settingsTitle}</h3>
              <p>{labels.settingsIntro}</p>
            </div>
            <ChromeButton
              size="sm"
              onClick={() => {
                setSettings(null);
              }}
            >
              {labels.close}
            </ChromeButton>
          </header>
          <label>
            {labels.pageTitle}
            <input
              value={settings.title}
              onChange={(event) => {
                setSettings({ ...settings, title: event.currentTarget.value });
              }}
            />
          </label>
          <label>
            {labels.route}
            <input
              value={settings.address}
              disabled={settings.address === '/'}
              onChange={(event) => {
                setSettings({ ...settings, address: event.currentTarget.value });
              }}
            />
          </label>
          <label>
            {labels.purpose}
            <textarea
              rows={2}
              value={settings.purpose}
              onChange={(event) => {
                setSettings({ ...settings, purpose: event.currentTarget.value });
              }}
            />
          </label>
          <label>
            {labels.audience}
            <input
              value={settings.audience}
              onChange={(event) => {
                setSettings({ ...settings, audience: event.currentTarget.value });
              }}
            />
          </label>
          <fieldset disabled={!settings.supportsSeo}>
            <legend>{labels.seoLegend}</legend>
            <label>
              {labels.seoTitle}
              <input
                value={settings.seoTitle}
                onChange={(event) => {
                  setSettings({ ...settings, seoTitle: event.currentTarget.value });
                }}
              />
            </label>
            <label>
              {labels.seoDescription}
              <textarea
                rows={2}
                value={settings.seoDescription}
                onChange={(event) => {
                  setSettings({ ...settings, seoDescription: event.currentTarget.value });
                }}
              />
            </label>
            <label>
              {labels.seoImage}
              <input
                value={settings.seoImage}
                onChange={(event) => {
                  setSettings({ ...settings, seoImage: event.currentTarget.value });
                }}
              />
            </label>
            <label className="pg-page-workspace__check">
              <input
                type="checkbox"
                checked={settings.noIndex}
                onChange={(event) => {
                  setSettings({ ...settings, noIndex: event.currentTarget.checked });
                }}
              />
              {labels.noIndex}
            </label>
            <label>
              {labels.socialTitle}
              <input disabled value={settings.seoTitle} />
            </label>
            <p>{labels.socialNote}</p>
          </fieldset>
          {!settings.supportsSeo ? (
            <p className="pg-page-workspace__note">{labels.seoUnavailable}</p>
          ) : null}
          <label>
            {labels.direction}
            <select
              value={settings.direction}
              onChange={(event) => {
                setSettings({ ...settings, direction: event.currentTarget.value as 'ltr' | 'rtl' });
              }}
            >
              <option value="ltr">{labels.ltr}</option>
              <option value="rtl">{labels.rtl}</option>
            </select>
          </label>
          <button className="pg-page-workspace__save" type="submit">
            {labels.save}
          </button>
        </form>
      )}
    </section>
  );
}
