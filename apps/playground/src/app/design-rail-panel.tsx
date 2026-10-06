import { useCallback, useMemo } from 'react';

import {
  ClassManager,
  DesignLibraryTransfer,
  DesignSystemPanel,
  StylePanel,
  SymbolsPanel,
  paletteSwatches,
  siteCommitFor,
  themeColorSwatches,
  useSiteSnapshot,
  type BuilderSiteKernel,
  type ElementTarget,
  type StyleSource,
  type Theme,
  type TokenName,
} from '@craftkit/builder';

import type { EditorLabels } from './editor-labels';

export interface DesignRailPanelProps {
  readonly siteKernel: BuilderSiteKernel;
  /** Every selected element, primary first (the shared selection store). */
  readonly targets: readonly ElementTarget[];
  /** The page theme, for truthful colour swatches in the style editor. */
  readonly theme: Theme;
  /** The PAGE's direction: box sides and corners mirror to it. */
  readonly pageDir: 'ltr' | 'rtl';
  readonly labels: EditorLabels;
  readonly announce: (message: string) => void;
  /** Load Google font previews (off in tests and offline hosts). */
  readonly loadFontPreviews?: boolean | undefined;
}

/**
 * The rail's Design destination (style-manager DESIGN §G): the design-system
 * editor (colours, palette ramps, type, radius, shadows, spacing), the named
 * style manager (Webflow-like classes, edited with the full StylePanel),
 * symbols with per-instance overrides, and the design-library transfer.
 * Every edit is one labelled site transaction, so one Undo.
 */
export function DesignRailPanel({
  siteKernel,
  targets,
  theme,
  pageDir,
  labels,
  announce,
  loadFontPreviews = false,
}: DesignRailPanelProps) {
  const site = useSiteSnapshot(siteKernel);
  const onCommit = useMemo(() => siteCommitFor(siteKernel), [siteKernel]);
  const onChangeToken = useCallback(
    (token: TokenName, value: string) => {
      try {
        siteKernel.dispatchGroup([{ command: 'setDesignToken', args: { token, value } }], {
          author: 'user',
          label: `Design token · ${token}`,
        });
      } catch (cause) {
        announce(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [siteKernel, announce],
  );
  const tokens = useMemo(() => themeColorSwatches(theme), [theme]);
  const palette = useMemo(() => paletteSwatches(site.library?.palette), [site.library?.palette]);
  const renderStyleEditor = useCallback(
    (source: StyleSource) => (
      <StylePanel
        source={source}
        bucket="base"
        state="default"
        dir={pageDir}
        tokens={tokens}
        palette={palette}
        announce={announce}
        labels={labels.stylePanel}
      />
    ),
    [pageDir, tokens, palette, announce, labels.stylePanel],
  );
  const primary = targets[0];
  return (
    <div className="pg-panel-scroll pg-design-rail" dir={labels.dir}>
      <DesignSystemPanel
        system={site.designSystem}
        onChangeToken={onChangeToken}
        library={site.library}
        onCommit={onCommit}
        labels={labels.designSystem}
        fontLabels={labels.fontPicker}
        rampLabels={labels.paletteRamp}
        loadFontPreviews={loadFontPreviews}
        dir={labels.dir}
      />
      <ClassManager
        site={siteKernel}
        target={primary}
        targets={targets}
        renderStyleEditor={renderStyleEditor}
        labels={labels.classManager}
        words={labels.elementWords}
        dir={labels.dir}
      />
      <SymbolsPanel
        site={siteKernel}
        nodeId={primary?.nodeId}
        labels={labels.symbols}
        words={labels.elementWords}
        dir={labels.dir}
      />
      <DesignLibraryTransfer site={siteKernel} labels={labels.designTransfer} dir={labels.dir} />
    </div>
  );
}
