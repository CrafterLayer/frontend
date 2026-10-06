import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { PaletteEntry } from '@craftkit/builder-renderer';
import type {
  CustomCodePath,
  NamedStyle,
  NodeId,
  SiteLibrary,
  StyleBucket,
  StyleSectorId,
  StyleState,
} from '@craftkit/builder-schema';

import {
  ELEMENT_NAME_WORDS_AR,
  ELEMENT_NAME_WORDS_EN,
  elementTargetKey,
  treeNodeDisplayName,
} from '../../custom-code/element-target';
import type { EditingBucket } from '../../devices/buckets';
import type { ColorSwatch } from '../../style-manager/controls/StyleColorControl';
import {
  ELEMENT_CODE_EDITOR_LABELS_AR,
  ELEMENT_CODE_EDITOR_LABELS_EN,
  ElementCodeEditor,
} from '../../style-manager/ElementCodeEditor';
import {
  INTERACTIONS_PANEL_LABELS_AR,
  INTERACTIONS_PANEL_LABELS_EN,
  InteractionsPanel,
} from '../../style-manager/InteractionsPanel';
import { styleTransactionLabel } from '../../style-manager/style-source';
import { STYLE_PANEL_LABELS_AR, STYLE_PANEL_LABELS_EN, StylePanel } from '../../style-manager/StylePanel';
import { treeElementSource } from '../../style-manager/tree-element-source';
import { patchTreeTargets, type TreeTarget, type TreeWriteOptions } from '../../style-manager/tree-writes';
import { findCanvasElement, useForcedStatePreview } from '../../style-manager/use-forced-state-preview';
import { INSPECTOR_ELEMENT_LABELS_AR, INSPECTOR_ELEMENT_LABELS_EN } from './element-panel.labels';
import {
  ELEMENT_TABS,
  isElementTab,
  rememberedElementTab,
  rememberElementTab,
  type ElementTabId,
} from './element-tab-memory';
import { treeIdsOf } from './element-tree-ids';
import { InspectorElementAdvanced } from './InspectorElementAdvanced';
import { InspectorElementContent } from './InspectorElementContent';
import { InspectorEmptyState } from './InspectorEmptyState';
import type { InspectorFocusRequest, InspectorStyleContext } from './inspector-request';
import type { DocumentDirection } from './types';
import { useTreeElement } from './use-tree-element';

export interface InspectorElementPanelProps {
  readonly kernel: BuilderKernel;
  /** The region (or symbol instance) whose tree holds the element. */
  readonly nodeId: NodeId;
  readonly path: CustomCodePath;
  readonly palette: readonly PaletteEntry[];
  readonly catalogVersion: number;
  readonly announce: (text: string) => void;
  readonly dir: DocumentDirection;
  /** The device bucket the DeviceBar is on (§A.7); the panel follows it. */
  readonly device: EditingBucket;
  /** Reports a bucket chosen in the panel, so the host can move the canvas width. */
  readonly onBucketChange?: ((bucket: StyleBucket) => void) | undefined;
  readonly freeWidth?: number | undefined;
  readonly locale: 'en' | 'ar';
  readonly writeOptions: TreeWriteOptions;
  readonly library?: SiteLibrary | undefined;
  /** Other selected elements (multi-select): Design writes to all of them at once. */
  readonly extraTargets?: readonly TreeTarget[] | undefined;
  /** The canvas frame's document, for the forced-state preview (canvas only). */
  readonly frameDocument?: Document | null | undefined;
  /** Replays the element's animation on the canvas (stamps `data-ck-play`). */
  readonly onPreviewElement?: ((target: TreeTarget) => void) | undefined;
  readonly onOpenRegionCss?: ((nodeId: NodeId) => void) | undefined;
  readonly onOpenPageCss?: (() => void) | undefined;
  /** The quick bar's "More" / "Animate": a tab (and sector) to show now. */
  readonly request?: InspectorFocusRequest | undefined;
  /** Reports the open Design sector and the forced state, for canvas overlays. */
  readonly onStyleContextChange?: ((context: InspectorStyleContext) => void) | undefined;
  /** The request was honoured; the host drops it so another element does not inherit it. */
  readonly onRequestHandled?: ((nonce: number) => void) | undefined;
}

function roleToken(role: string): string {
  return role.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * The panel for ONE authored element inside a composed region — "every
 * element is a widget" (style-manager DESIGN.md D8, §A.5): tabs Content ·
 * Design · Interactions · Code (Radix Tabs, the tab remembered for the
 * session). Design is the full style manager on the element (free mode; all
 * selected elements at once when several are), ending with Advanced. Every
 * row writes through the tree door as one labelled transaction, and every
 * value renders from document truth, so undo and agent edits show through.
 */
export function InspectorElementPanel({
  kernel,
  nodeId,
  path,
  palette,
  catalogVersion,
  announce,
  dir,
  device,
  onBucketChange,
  freeWidth,
  locale,
  writeOptions,
  library,
  extraTargets = [],
  frameDocument,
  onPreviewElement,
  onOpenRegionCss,
  onOpenPageCss,
  request,
  onStyleContextChange,
  onRequestHandled,
}: InspectorElementPanelProps) {
  const labels = locale === 'ar' ? INSPECTOR_ELEMENT_LABELS_AR : INSPECTOR_ELEMENT_LABELS_EN;
  const styleLabels = locale === 'ar' ? STYLE_PANEL_LABELS_AR : STYLE_PANEL_LABELS_EN;
  const words = locale === 'ar' ? ELEMENT_NAME_WORDS_AR : ELEMENT_NAME_WORDS_EN;
  const pathKey = path.join('.');
  const target = useMemo<TreeTarget>(
    () => ({ kind: 'tree', nodeId, path: pathKey === '' ? [] : pathKey.split('.').map(Number) }),
    [nodeId, pathKey],
  );
  const element = useTreeElement(kernel, target, writeOptions);

  const [tab, setTab] = useState<ElementTabId>(rememberedElementTab);
  const [bucket, setBucket] = useState<StyleBucket>(device);
  const [state, setState] = useState<StyleState>('default');
  const [seenRequest, setSeenRequest] = useState<number | undefined>(undefined);
  if (request !== undefined && seenRequest !== request.nonce) {
    // The host asked for a place (quick bar "More" / "Animate"): go there.
    setSeenRequest(request.nonce);
    setTab(request.tab);
    rememberElementTab(request.tab);
  }
  useEffect(() => {
    if (seenRequest !== undefined) onRequestHandled?.(seenRequest);
  }, [seenRequest, onRequestHandled]);
  const [sector, setSector] = useState<StyleSectorId | null>(request?.sector ?? null);
  const shownSector = tab === 'design' ? sector : null;
  useEffect(() => {
    onStyleContextChange?.({ sector: shownSector, state });
  }, [onStyleContextChange, shownSector, state]);
  const [seenDevice, setSeenDevice] = useState(device);
  if (seenDevice !== device) {
    // The DeviceBar moved: the panel edits that bucket now (§A.7).
    setSeenDevice(device);
    setBucket(device);
  }

  const targets = useMemo(() => {
    const own = elementTargetKey(target);
    const others = extraTargets.filter((candidate) => elementTargetKey(candidate) !== own);
    return [target, ...others];
  }, [target, extraTargets]);
  const source = useMemo(
    () => treeElementSource(kernel, targets, { ...writeOptions, words, manyLabel: labels.elements }),
    [kernel, targets, writeOptions, words, labels],
  );
  const tokens = useMemo<ColorSwatch[]>(
    () => palette.map((entry) => ({ id: roleToken(entry.role), name: entry.name, css: entry.value })),
    [palette],
  );
  const libraryPalette = useMemo<ColorSwatch[]>(
    () =>
      (library?.palette ?? []).map((color) => ({ id: color.id, name: color.name, css: color.value })),
    [library],
  );
  const namedStyleList = useMemo<NamedStyle[]>(() => Object.values(library?.styles ?? {}), [library]);
  const namedStyles = useMemo(
    () => Object.fromEntries(namedStyleList.map((style) => [style.id, style.className])),
    [namedStyleList],
  );

  const resolveCanvas = useCallback(
    (frame: Document) => findCanvasElement(frame, nodeId, pathKey === '' ? [] : pathKey.split('.').map(Number)),
    [nodeId, pathKey],
  );
  useForcedStatePreview(tab === 'design' ? frameDocument : null, resolveCanvas, state);

  if (element === undefined) {
    return <InspectorEmptyState kind="element-gone" />;
  }
  const name = treeNodeDisplayName(element, words);
  const pageDir: 'ltr' | 'rtl' = dir === 'rtl' ? 'rtl' : 'ltr';
  const uiDir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="bldr-inspector__element" data-element-kind={element.kind}>
      <Tabs.Root
        className="bldr-inspector__element-tabs"
        value={tab}
        dir={uiDir}
        onValueChange={(value) => {
          if (!isElementTab(value)) return;
          setTab(value);
          rememberElementTab(value);
        }}
      >
        <Tabs.List className="bldr-inspector__element-tablist" aria-label={labels.tablist}>
          {ELEMENT_TABS.map((id) => (
            <Tabs.Trigger key={id} value={id} className="bldr-inspector__element-tab">
              {labels.tabs[id]}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="content" className="bldr-inspector__element-panel">
          <InspectorElementContent
            kernel={kernel}
            target={target}
            element={element}
            elementName={name}
            palette={palette}
            catalogVersion={catalogVersion}
            announce={announce}
            dir={dir}
            locale={locale}
            writeOptions={writeOptions}
            emptyText={labels.noContent}
            componentHeading={labels.componentProps}
          />
        </Tabs.Content>

        <Tabs.Content value="design" className="bldr-inspector__element-panel">
          <StylePanel
            source={source}
            bucket={bucket}
            state={state}
            onBucketChange={(next) => {
              setBucket(next);
              onBucketChange?.(next);
            }}
            onStateChange={setState}
            freeWidth={freeWidth}
            dir={pageDir}
            tokens={tokens}
            palette={libraryPalette}
            namedStyles={namedStyles}
            tag={element.kind === 'element' ? element.tag : undefined}
            announce={announce}
            labels={styleLabels}
            revealSector={
              request?.tab === 'design' && request.sector !== undefined
                ? { sector: request.sector, nonce: request.nonce }
                : undefined
            }
            onActiveSectorChange={setSector}
          >
            <InspectorElementAdvanced
              kernel={kernel}
              target={target}
              element={element}
              elementName={name}
              palette={palette}
              catalogVersion={catalogVersion}
              announce={announce}
              dir={dir}
              locale={locale}
              writeOptions={writeOptions}
              namedStyles={namedStyleList}
              labels={labels}
            />
          </StylePanel>
        </Tabs.Content>

        <Tabs.Content value="interactions" className="bldr-inspector__element-panel">
          {element.kind === 'element' ? (
            <InteractionsPanel
              attributes={element.attributes ?? {}}
              isContainer={(element.children ?? []).length > 0}
              targetIds={treeIdsOf(kernel, nodeId, writeOptions)}
              dir={uiDir}
              labels={locale === 'ar' ? INTERACTIONS_PANEL_LABELS_AR : INTERACTIONS_PANEL_LABELS_EN}
              announce={announce}
              onPreview={
                onPreviewElement === undefined
                  ? undefined
                  : () => {
                      onPreviewElement(target);
                    }
              }
              onCommit={(attributes, what) =>
                patchTreeTargets(
                  kernel,
                  [{ target, patch: { attributes } }],
                  styleTransactionLabel(what, name),
                  writeOptions,
                )
              }
            />
          ) : (
            <p className="bldr-inspector__element-note">{labels.iconNoInteractions}</p>
          )}
        </Tabs.Content>

        <Tabs.Content value="code" className="bldr-inspector__element-panel">
          {element.kind === 'element' ? (
            <ElementCodeEditor
              element={element}
              announce={announce}
              labels={locale === 'ar' ? ELEMENT_CODE_EDITOR_LABELS_AR : ELEMENT_CODE_EDITOR_LABELS_EN}
              onOpenRegionCss={
                onOpenRegionCss === undefined
                  ? undefined
                  : () => {
                      onOpenRegionCss(nodeId);
                    }
              }
              onOpenPageCss={onOpenPageCss}
              onCommit={(patch) =>
                patchTreeTargets(
                  kernel,
                  [{ target, patch }],
                  styleTransactionLabel(labels.tabs.code, name),
                  writeOptions,
                )
              }
            />
          ) : (
            <p className="bldr-inspector__element-note">{labels.codeOnlyElements}</p>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
