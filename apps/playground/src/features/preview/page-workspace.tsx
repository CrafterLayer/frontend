import {
  ChromeButton,
  projectSitemap,
  type BuilderSiteKernel,
  type JsonValue,
  type SiteGroupStep,
  type SitePage,
  type SitemapPageProjection,
} from '@craftkit/builder';
import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';

import {
  PageActionsMenu,
  type PageDeleteRequest,
  type PageMenuAction,
} from './components/PageActionsMenu';
import { SiteMap } from './components/SiteMap';
import './page-workspace.css';

export type PageWorkspaceView = 'list' | 'map';

export interface PageWorkspaceProps {
  readonly siteKernel: BuilderSiteKernel;
  readonly thumbnailByPageId?: Readonly<Record<string, string>> | undefined;
  readonly view?: PageWorkspaceView | undefined;
  readonly initialView?: PageWorkspaceView | undefined;
  readonly onViewChange?: ((view: PageWorkspaceView) => void) | undefined;
}

interface PageSettingsDraft {
  readonly pageId: string;
  readonly title: string;
  readonly address: string;
  readonly purpose: string;
  readonly audience: string;
  readonly direction: 'ltr' | 'rtl';
  readonly supportsSeo: boolean;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly seoImage: string;
  readonly noIndex: boolean;
}

/** One state and command surface for the page list, visual map, routes, SEO, share, and direction. */
export function PageWorkspace({
  siteKernel,
  thumbnailByPageId,
  view: controlledView,
  initialView = 'list',
  onViewChange,
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
  const projection = projectSitemap(site, { thumbnailByPageId });

  const changeView = useCallback(
    (nextView: PageWorkspaceView): void => {
      if (controlledView === undefined) setLocalView(nextView);
      onViewChange?.(nextView);
    },
    [controlledView, onViewChange],
  );

  const run = useCallback((change: () => void, success: string): boolean => {
    try {
      change();
      setStatus(success);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'That page change was refused.');
      return false;
    }
  }, []);

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
            }, `Duplicated ${page.title}.`)
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
          }, `Moved ${page.title} up.`);
          return;
        case 'move-down':
          run(() => {
            siteKernel.dispatch('reorderPage', { pageId, toIndex: pageIndex + 1 });
          }, `Moved ${page.title} down.`);
          return;
        case 'make-home':
          run(() => {
            siteKernel.dispatch('setHomePage', { pageId });
          }, `${page.title} is now home.`);
          return;
        case 'clear':
          run(() => {
            siteKernel.dispatch('clearPage', { pageId });
          }, `Cleared ${page.title}.`);
          return;
      }
    },
    [openSettings, run, site.pages, siteKernel],
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
        }, `Deleted ${page.title}.`)
      ) {
        if (settings?.pageId === request.pageId) setSettings(null);
      }
    },
    [run, settings?.pageId, site.pages, siteKernel],
  );

  const addPage = useCallback(() => {
    const address = nextPageAddress(site.pages.map((page) => page.address));
    const before = new Set(site.pages.map((page) => page.id));
    if (
      !run(() => {
        siteKernel.dispatch('addPage', { address, title: titleForAddress(address) });
      }, 'Added a page.')
    )
      return;
    const created = siteKernel.getSite().pages.find((page) => !before.has(page.id));
    if (created !== undefined) siteKernel.setCurrentPage(created.id);
  }, [run, site.pages, siteKernel]);

  const reorder = useCallback(
    (pageId: string, toIndex: number) => {
      const page = site.pages.find((candidate) => candidate.id === pageId);
      if (page === undefined) return;
      run(() => {
        siteKernel.dispatch('reorderPage', { pageId, toIndex });
      }, `Moved ${page.title}.`);
    },
    [run, site.pages, siteKernel],
  );

  const actionsByPageId = Object.fromEntries(
    projection.pages.map((page): [string, ReactNode] => [
      page.id,
      <PageActionsMenu
        key={page.id}
        page={page}
        pageCount={projection.pages.length}
        inboundLinkCount={countInboundLinks(site, page.id)}
        replacementHomePageId={page.isHome ? firstReplacement(site.pages, page.id) : undefined}
        replacementHomeTitle={page.isHome ? firstReplacementTitle(site.pages, page.id) : undefined}
        canMoveUp={page.index > 0}
        canMoveDown={page.index < projection.pages.length - 1}
        onAction={action}
        onDelete={remove}
      />,
    ]),
  );

  const saveSettings = (): void => {
    if (settings === null) return;
    const pageIndex = site.pages.findIndex((page) => page.id === settings.pageId);
    const page = site.pages[pageIndex];
    if (page === undefined) {
      setStatus('That page no longer exists. Reopen its settings.');
      setSettings(null);
      return;
    }
    const steps = pageSettingsSteps(site.dir, page, pageIndex, settings);
    if (steps.length === 0) {
      setStatus('Page settings are already up to date.');
      setSettings(null);
      return;
    }
    if (
      run(() => {
        siteKernel.dispatchGroup(steps, { author: 'user', label: 'updatePageSettings' });
      }, `Saved ${settings.title}. One undo restores every field.`)
    ) {
      setSettings(null);
    }
  };

  return (
    <section className="pg-page-workspace" aria-label="Page workspace">
      <header className="pg-page-workspace__header">
        <div>
          <h2>Pages</h2>
          <p>
            {site.pages.length} page{site.pages.length === 1 ? '' : 's'} · one shared history
          </p>
        </div>
        <ChromeButton variant="primary" size="sm" onClick={addPage}>
          Add page
        </ChromeButton>
      </header>
      <div className="pg-page-workspace__switch" role="group" aria-label="Page view">
        <ChromeButton
          variant="toggle"
          size="sm"
          aria-pressed={view === 'list'}
          onClick={() => {
            changeView('list');
          }}
        >
          List
        </ChromeButton>
        <ChromeButton
          variant="toggle"
          size="sm"
          aria-pressed={view === 'map'}
          onClick={() => {
            changeView('map');
          }}
        >
          Sitemap
        </ChromeButton>
      </div>
      <output className="pg-page-workspace__status" aria-live="polite">
        {status}
      </output>

      {view === 'list' ? (
        <ol className="pg-page-workspace__list" aria-label="Site pages">
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
                  {page.isHome ? ' · Home' : ''}
                </small>
                <small>{sharedSummary(page)}</small>
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
        />
      )}

      {settings === null ? null : (
        <form
          className="pg-page-workspace__settings"
          aria-label={`Settings for ${settings.title}`}
          onSubmit={(event) => {
            event.preventDefault();
            saveSettings();
          }}
        >
          <header>
            <div>
              <h3>Page settings</h3>
              <p>Route, search metadata, sharing, and content direction.</p>
            </div>
            <ChromeButton
              size="sm"
              onClick={() => {
                setSettings(null);
              }}
            >
              Close
            </ChromeButton>
          </header>
          <label>
            Page title
            <input
              value={settings.title}
              onChange={(event) => {
                setSettings({ ...settings, title: event.currentTarget.value });
              }}
            />
          </label>
          <label>
            Route
            <input
              value={settings.address}
              disabled={settings.address === '/'}
              onChange={(event) => {
                setSettings({ ...settings, address: event.currentTarget.value });
              }}
            />
          </label>
          <label>
            Purpose
            <textarea
              rows={2}
              value={settings.purpose}
              onChange={(event) => {
                setSettings({ ...settings, purpose: event.currentTarget.value });
              }}
            />
          </label>
          <label>
            Audience
            <input
              value={settings.audience}
              onChange={(event) => {
                setSettings({ ...settings, audience: event.currentTarget.value });
              }}
            />
          </label>
          <fieldset disabled={!settings.supportsSeo}>
            <legend>SEO and sharing</legend>
            <label>
              SEO title
              <input
                value={settings.seoTitle}
                onChange={(event) => {
                  setSettings({ ...settings, seoTitle: event.currentTarget.value });
                }}
              />
            </label>
            <label>
              SEO description
              <textarea
                rows={2}
                value={settings.seoDescription}
                onChange={(event) => {
                  setSettings({ ...settings, seoDescription: event.currentTarget.value });
                }}
              />
            </label>
            <label>
              SEO and share image
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
              Hide from search engines
            </label>
            <label>
              Social title
              <input disabled value={settings.seoTitle} />
            </label>
            <p>
              Social title follows the stored SEO title. Separate Open Graph fields are not
              available in the current project schema.
            </p>
          </fieldset>
          {!settings.supportsSeo ? (
            <p className="pg-page-workspace__note">
              Stored SEO fields are available for authored code pages. This page keeps its purpose
              and audience without claiming separate SEO storage.
            </p>
          ) : null}
          <label>
            Site content direction
            <select
              value={settings.direction}
              onChange={(event) => {
                setSettings({ ...settings, direction: event.currentTarget.value as 'ltr' | 'rtl' });
              }}
            >
              <option value="ltr">Left to right</option>
              <option value="rtl">Right to left</option>
            </select>
          </label>
          <button className="pg-page-workspace__save" type="submit">
            Save page settings
          </button>
        </form>
      )}
    </section>
  );
}

function settingsFor(page: SitePage, direction: 'ltr' | 'rtl'): PageSettingsDraft {
  const root = page.document.nodes[page.document.rootId];
  const supportsSeo = root?.type === 'codePage';
  const seo = supportsSeo ? objectValue(root.props['seo']) : undefined;
  return {
    pageId: page.id,
    title: page.title,
    address: page.address,
    purpose: page.purpose,
    audience: page.audience,
    direction,
    supportsSeo,
    seoTitle: stringValue(seo?.['title']),
    seoDescription: stringValue(seo?.['description']),
    seoImage: stringValue(seo?.['image']),
    noIndex: seo?.['noIndex'] === true,
  };
}

function pageSettingsSteps(
  currentDirection: 'ltr' | 'rtl',
  page: SitePage,
  pageIndex: number,
  settings: PageSettingsDraft,
): SiteGroupStep[] {
  const steps: SiteGroupStep[] = [];
  if (page.title !== settings.title || page.address !== settings.address) {
    steps.push({
      command: 'renamePage',
      args: {
        pageId: page.id,
        ...(page.title === settings.title ? {} : { title: settings.title }),
        ...(page.address === settings.address ? {} : { address: settings.address }),
      },
    });
  }
  const patches: {
    op: 'add' | 'replace' | 'remove';
    path: (string | number)[];
    value?: JsonValue;
  }[] = [];
  if (page.purpose !== settings.purpose)
    patches.push({ op: 'replace', path: ['pages', pageIndex, 'purpose'], value: settings.purpose });
  if (page.audience !== settings.audience)
    patches.push({
      op: 'replace',
      path: ['pages', pageIndex, 'audience'],
      value: settings.audience,
    });
  const root = page.document.nodes[page.document.rootId];
  if (settings.supportsSeo && root?.type === 'codePage') {
    const oldSeo = objectValue(root.props['seo']);
    const seo = compactSeo(settings);
    if (JSON.stringify(oldSeo ?? {}) !== JSON.stringify(seo)) {
      const path = ['pages', pageIndex, 'document', 'nodes', page.document.rootId, 'props', 'seo'];
      patches.push(
        Object.keys(seo).length === 0
          ? oldSeo === undefined
            ? { op: 'add', path, value: {} }
            : { op: 'remove', path }
          : { op: oldSeo === undefined ? 'add' : 'replace', path, value: seo },
      );
    }
  }
  if (patches.length > 0) steps.push({ command: 'applySitePatches', args: { patches } });
  if (currentDirection !== settings.direction) {
    steps.push({ command: 'setSiteDirection', args: { dir: settings.direction } });
  }
  return steps;
}

function compactSeo(settings: PageSettingsDraft): Record<string, JsonValue> {
  return {
    ...(settings.seoTitle.trim() === '' ? {} : { title: settings.seoTitle.trim() }),
    ...(settings.seoDescription.trim() === ''
      ? {}
      : { description: settings.seoDescription.trim() }),
    ...(settings.seoImage.trim() === '' ? {} : { image: settings.seoImage.trim() }),
    ...(settings.noIndex ? { noIndex: true } : {}),
  };
}

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined;
}
function stringValue(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value : '';
}
function firstReplacement(pages: readonly SitePage[], pageId: string): string | undefined {
  return pages.find((page) => page.id !== pageId)?.id;
}
function firstReplacementTitle(pages: readonly SitePage[], pageId: string): string | undefined {
  return pages.find((page) => page.id !== pageId)?.title;
}
function nextPageAddress(addresses: readonly string[]): string {
  let index = addresses.length + 1;
  while (addresses.includes(`/page-${String(index)}`)) index += 1;
  return `/page-${String(index)}`;
}
function titleForAddress(address: string): string {
  return `Page ${address.split('-').at(-1) ?? ''}`.trim();
}
function sharedSummary(page: SitemapPageProjection): string {
  return page.sharedReferences.length === 0
    ? 'Private page'
    : `${String(page.sharedReferences.length)} shared`;
}

function countInboundLinks(site: ReturnType<BuilderSiteKernel['getSite']>, pageId: string): number {
  let count = 0;
  const visit = (value: JsonValue): void => {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value['kind'] === 'page' &&
      value['pageId'] === pageId
    ) {
      count += 1;
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(visit);
  };
  for (const document of [
    ...site.pages.filter((page) => page.id !== pageId).map((page) => page.document),
    ...Object.values(site.sharedRegions).map((region) => region.document),
  ]) {
    for (const node of Object.values(document.nodes)) {
      visit(node.props);
      Object.values(node.responsive ?? {}).forEach(visit);
    }
  }
  return count;
}
