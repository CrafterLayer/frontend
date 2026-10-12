import type { ComponentProps, ReactNode } from 'react';

import {
  AssetManager,
  HistoryList,
  LayersTree,
  LibraryPanel,
  Palette,
  SitePages,
  // library-playground additions (2026-10-08): the Library's photo template cards.
  marketingTemplateCatalog,
  // end library-playground additions
  type CanvasDragHandle,
  type LiveUtilities,
  type StyleBucket,
  type Theme,
} from '@craftkit/builder';

import { SiteBuilderPanel } from '../features/preview/components/SiteBuilderPanel';
import { HistoryPanel } from '../features/preview/components/HistoryPanel';
import { PageWorkspace } from '../features/preview/page-workspace';
import { LOAD_FONT_PREVIEWS } from './app-env';
import type { ReadySession } from './app-helpers';
import { DesignRailPanel } from './design-rail-panel';
import type { EditorLabels, EditorLocale } from './editor-labels';
import { RailSectionNotice } from './rail-section-notice';
import type { AgentHost } from './use-agent-host';
import type { EditorChrome } from './use-editor-chrome';

export interface RailSectionPanelProps {
  readonly railSection: string;
  readonly session: ReadySession;
  readonly labels: EditorLabels;
  readonly editorLocale: EditorLocale;
  readonly chrome: EditorChrome;
  readonly styleBucket: StyleBucket;
  /** The Settings destination: the scenario harness. */
  readonly harness: ReactNode;
  readonly host: Pick<AgentHost, 'assetLibrary' | 'siteHost' | 'siteSeam'>;
  readonly theme: Theme;
  readonly docDir: string;
  readonly announce: (message: string) => void;
  readonly dragHandle: CanvasDragHandle | undefined;
  readonly templates: ComponentProps<typeof LibraryPanel>['templates'];
  readonly libraryKitSections: ComponentProps<typeof LibraryPanel>['sections'];
  readonly libraryPreviewCss: string;
  readonly liveUtilities: LiveUtilities | undefined;
}

/**
 * The panel column's destination for every rail section but the Assistant (which
 * stays mounted beside it): one panel per section, mounted on demand.
 */
export function RailSectionPanel({
  railSection,
  session,
  labels,
  editorLocale,
  chrome,
  styleBucket,
  harness,
  host,
  theme,
  docDir,
  announce,
  dragHandle,
  templates,
  libraryKitSections,
  libraryPreviewCss,
  liveUtilities,
}: RailSectionPanelProps) {
  const { assetLibrary, siteHost, siteSeam } = host;
  return railSection === 'pages' ? (
    <PageWorkspace siteKernel={session.siteKernel} labels={labels.pageWorkspace} />
  ) : railSection === 'layers' ? (
    /*
      The pages ABOVE the layers, in the same panel. The layer tree
      shows one page's structure; the list above says which page
      that is and lets a person move between them — reading the two
      in the other order tells you the shape of something you have
      not been told the name of.
    */
    <div className="pg-structure">
      <SitePages siteKernel={session.siteKernel} labels={labels.sitePages} />
      <LayersTree
        kernel={session.kernel}
        selection={chrome.selection}
        clipboard={chrome.clipboard}
        bucket={styleBucket}
        labels={labels.layersTree}
        actionLabels={labels.elementActions}
        words={labels.elementWords}
        onSaveTemplate={chrome.saveTemplate}
        onMakeSymbol={chrome.makeSymbol}
      />
    </div>
  ) : railSection === 'settings' ? (
    harness
  ) : railSection === 'history' ? (
    /*
      Restore points: the one part of the vault a person addresses
      directly. The session's own saving is continuous and invisible;
      this is the shelf they put something on deliberately.
    */
    <div className="pg-panel-scroll">
      {/* The session's labelled steps (click to jump), beside the vault's restore points. */}
      <HistoryList kernel={session.kernel} labels={labels.historyList} />
      <HistoryPanel kernel={session.kernel} shelf={session.shelf} labels={labels.historyPanel} />
    </div>
  ) : railSection === 'assets' ? (
    <div className="pg-panel-scroll">
      <AssetManager
        site={session.siteKernel}
        library={assetLibrary}
        target={chrome.targets[0]}
        labels={labels.assetManager}
        cropperLabels={labels.imageCropper}
        iconLabels={labels.iconBrowser}
        dir={labels.dir}
      />
    </div>
  ) : railSection === 'design' ? (
    <DesignRailPanel
      siteKernel={session.siteKernel}
      targets={chrome.targets}
      theme={theme}
      pageDir={docDir === 'rtl' ? 'rtl' : 'ltr'}
      labels={labels}
      announce={announce}
      loadFontPreviews={LOAD_FONT_PREVIEWS}
    />
  ) : railSection === 'help' ? (
    <RailSectionNotice section={railSection} locale={editorLocale} />
  ) : railSection === 'site' ? (
    <div className="pg-panel-scroll">
      <SiteBuilderPanel
        site={siteHost}
        seam={siteSeam}
        locale={editorLocale}
        onStop={() => {
          siteSeam.stop();
        }}
      />
    </div>
  ) : railSection === 'assistant' ? null : railSection === 'blocks' ? (
    /*
      The library: elements, sections, the registered blocks (the
      palette, composed in its Blocks tab) and the site's saved
      templates. Click inserts at the selection; a drag lands
      through the canvas's tree drop.
    */
    <LibraryPanel
      kernel={session.kernel}
      dragHandle={dragHandle}
      templates={templates}
      onRemoveTemplate={chrome.removeTemplate}
      // The rail item is "Blocks": it opens on them; Elements, Sections and Saved are one tab away.
      defaultTab="blocks"
      labels={labels.libraryPanel}
      actionLabels={labels.elementActions}
      words={labels.elementWords}
      sections={libraryKitSections}
      // library-playground additions (2026-10-08): photo cards in the top-level Templates tab.
      templateCards={marketingTemplateCatalog}
      // end library-playground additions
      previewStylesheet={libraryPreviewCss}
      {...(liveUtilities === undefined
        ? {}
        : {
            compilePreviewCss: (names: readonly string[]) => liveUtilities.compileFor(names),
          })}
    />
  ) : (
    // Code: the palette stays beside the projection, because
    // reading the document as text is not a reason to lose the
    // ability to add to it.
    <Palette
      kernel={session.kernel}
      dragHandle={dragHandle}
      templateCards={marketingTemplateCatalog} /* library-playground additions (2026-10-08) */
    />
  );
}
