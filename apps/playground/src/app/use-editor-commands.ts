import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type {
  BuilderKernel,
  BuilderSiteKernel,
  DeviceState,
  RailItem,
  TopBarDevice,
} from '@craftkit/builder';

import type { CommandItem } from '../features/command/command-model';

import { editorLabels, type EditorLabels, type EditorLocale } from './editor-labels';
import type { EditorPanes } from './use-editor-panes';

/** The language rows name each language in itself, as every language switch should. */
const LANGUAGE_NAMES: Readonly<Record<EditorLocale, string>> = { en: 'English', ar: 'العربية' };
const DEVICES: readonly TopBarDevice[] = ['desktop', 'tablet', 'mobile'];
const NO_PAGES = { pages: [], current: undefined } as const;

export interface EditorCommandsOptions {
  readonly labels: EditorLabels;
  readonly editorLocale: EditorLocale;
  readonly setEditorLocale: (locale: EditorLocale) => void;
  readonly railDestinations: readonly RailItem[];
  readonly railUtilities: readonly RailItem[];
  readonly panes: Pick<
    EditorPanes,
    | 'railSection'
    | 'setRailSection'
    | 'setPanelOpen'
    | 'setAsideOpen'
    | 'setActiveSide'
    | 'visiblePanes'
    | 'workspaceView'
    | 'setWorkspaceView'
  >;
  readonly device: DeviceState;
  readonly changeDevice: (next: TopBarDevice) => void;
  readonly kernel: BuilderKernel | undefined;
  readonly siteKernel: BuilderSiteKernel | undefined;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canPublish: boolean;
  readonly publish: () => void;
  readonly canPreview: boolean;
  readonly preview: () => void;
  readonly openShortcuts: () => void;
  /** `Ctrl` or `⌘`, for the hints of the history rows. */
  readonly modifier: string;
}

/** The site's pages and the open one, subscribed (Law S: never read bare). */
function useSitePages(siteKernel: BuilderSiteKernel | undefined) {
  const subscribe = useCallback(
    (listener: () => void) => siteKernel?.subscribe(listener) ?? (() => undefined),
    [siteKernel],
  );
  const site = useSyncExternalStore(
    subscribe,
    useCallback(() => siteKernel?.getSite(), [siteKernel]),
  );
  const current = useSyncExternalStore(
    subscribe,
    useCallback(() => siteKernel?.currentPage(), [siteKernel]),
  );
  return site === undefined ? NO_PAGES : { pages: site.pages, current };
}

/**
 * Every place and action the editor offers, as the command palette's rows (Studio Indigo,
 * 2026-10-12), rebuilt from live state each render: what is current is marked, what cannot
 * run now is disabled, and each row also answers to its name in the other language, so
 * «نشر» finds Publish site in an English editor and "layers" finds «الطبقات» in an
 * Arabic one.
 */
export function useEditorCommands(options: EditorCommandsOptions): readonly CommandItem[] {
  const { labels, editorLocale, siteKernel } = options;
  const other = useMemo(() => editorLabels(editorLocale === 'en' ? 'ar' : 'en'), [editorLocale]);
  const { pages, current } = useSitePages(siteKernel);
  const {
    setEditorLocale,
    railDestinations,
    railUtilities,
    panes,
    device,
    changeDevice,
    kernel,
    canUndo,
    canRedo,
    canPublish,
    publish,
    canPreview,
    preview,
    openShortcuts,
    modifier,
  } = options;
  const { chrome, topBar } = labels;
  const deviceNow: TopBarDevice = device.bucket === 'base' ? 'desktop' : device.bucket;
  const openSection = (id: string) => {
    panes.setRailSection(id);
    panes.setPanelOpen(true);
    panes.setActiveSide('panel');
  };
  const otherRail: Readonly<Record<string, string | undefined>> = other.chrome.rail;
  const railRow = (item: RailItem): CommandItem => ({
    id: `go:${item.id}`,
    group: 'navigate',
    label: item.label,
    keywords: [otherRail[item.id] ?? item.id, item.id],
    current: panes.railSection === item.id,
    run: () => {
      openSection(item.id);
    },
  });
  return [
    {
      id: 'publish',
      group: 'actions',
      label: chrome.publishSite,
      keywords: [other.chrome.publishSite, 'deploy', 'export'],
      disabled: !canPublish,
      run: publish,
    },
    {
      id: 'preview',
      group: 'actions',
      label: topBar.preview,
      keywords: [other.topBar.preview],
      disabled: !canPreview,
      run: preview,
    },
    {
      id: 'undo',
      group: 'actions',
      label: topBar.undo,
      keywords: [other.topBar.undo],
      hint: `${modifier} Z`,
      disabled: !canUndo,
      run: () => {
        kernel?.undo();
      },
    },
    {
      id: 'redo',
      group: 'actions',
      label: topBar.redo,
      keywords: [other.topBar.redo],
      hint: `${modifier} ⇧ Z`,
      disabled: !canRedo,
      run: () => {
        kernel?.redo();
      },
    },
    ...railDestinations.map(railRow),
    ...railUtilities.map(railRow),
    ...DEVICES.map((name): CommandItem => ({
      id: `device:${name}`,
      group: 'view',
      label: topBar.device[name],
      keywords: [other.topBar.device[name], topBar.devices, other.topBar.devices],
      current: deviceNow === name,
      run: () => {
        changeDevice(name);
      },
    })),
    {
      id: 'view:canvas',
      group: 'view',
      label: chrome.canvas,
      keywords: [other.chrome.canvas, chrome.workspaceView],
      current: panes.workspaceView === 'canvas',
      run: () => {
        panes.setWorkspaceView('canvas');
      },
    },
    {
      id: 'view:sitemap',
      group: 'view',
      label: chrome.sitemap,
      keywords: [other.chrome.sitemap, chrome.workspaceView],
      current: panes.workspaceView === 'sitemap',
      run: () => {
        panes.setWorkspaceView('sitemap');
      },
    },
    {
      id: 'toggle:panel',
      group: 'view',
      label: chrome.togglePanel,
      keywords: [other.chrome.togglePanel, chrome.panel],
      run: () => {
        panes.setPanelOpen(!panes.visiblePanes.panel);
        panes.setActiveSide('panel');
      },
    },
    {
      id: 'toggle:inspector',
      group: 'view',
      label: chrome.toggleInspector,
      keywords: [other.chrome.toggleInspector, chrome.inspector],
      run: () => {
        panes.setAsideOpen(!panes.visiblePanes.aside);
        panes.setActiveSide('aside');
      },
    },
    ...pages.map((page): CommandItem => ({
      id: `page:${page.id}`,
      group: 'pages',
      label: page.title,
      keywords: [page.address],
      hint: page.address,
      current: current === page.id,
      run: () => {
        siteKernel?.setCurrentPage(page.id);
        panes.setWorkspaceView('canvas');
      },
    })),
    ...(['en', 'ar'] as const).map((locale): CommandItem => ({
      id: `language:${locale}`,
      group: 'language',
      label: LANGUAGE_NAMES[locale],
      keywords: [chrome.editorLanguage, other.chrome.editorLanguage],
      current: editorLocale === locale,
      run: () => {
        setEditorLocale(locale);
      },
    })),
    {
      id: 'help:shortcuts',
      group: 'help',
      label: labels.shortcuts.title,
      keywords: [other.shortcuts.title, 'keyboard', 'keys'],
      hint: '?',
      run: openShortcuts,
    },
  ];
}
