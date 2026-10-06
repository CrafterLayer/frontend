import { useCallback, useId, useMemo } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import {
  lightTheme,
  paletteOf,
  type ColorRole,
  useKernelSelector,
  useRegistryEpoch,
  type Theme,
} from '@craftkit/builder-renderer';

import {
  // ── block-parts (2026-10-06) ──
  blockPartsOf,
  type AssetLibraryPort,
  type KernelState,
  // ── /block-parts ──
  isCustomCodeTreeSchema,
  SYMBOL_INSTANCE_BLOCK_TYPE,
  type NodeId,
  type SiteLibrary,
  type StyleBucket,
} from '@craftkit/builder-schema';

import {
  ELEMENT_NAME_WORDS_AR,
  ELEMENT_NAME_WORDS_EN,
  type ElementTarget,
} from '../../custom-code/element-target';
import type { EditingBucket } from '../../devices/buckets';
import { utilityClassesKey } from '../../style-manager/block-source';
import { STYLE_PANEL_LABELS_AR, STYLE_PANEL_LABELS_EN } from '../../style-manager/StylePanel';
import { readTreeTarget, type TreeTarget, type TreeWriteOptions } from '../../style-manager/tree-writes';
import { propsShapeOf } from '../../fields/resolve-field';
import { blockDisplayName } from '../../naming/block-display-name';
import { customCodeElementName } from '../../naming/custom-code-element-name';
import { COLOR_ROLE_NAMES_AR } from '../DesignSystemPanel/DesignSystemPanel.labels';
import { inspectorLabelsFor } from './Inspector.labels';
import { InspectorBlockDesign } from './InspectorBlockDesign';
import { InspectorElementPanel } from './InspectorElementPanel';
import { InspectorEmptyState } from './InspectorEmptyState';
import { InspectorHeader } from './InspectorHeader';
import type { InspectorFocusRequest, InspectorStyleContext } from './inspector-request';
import { InspectorLiveRegion } from './InspectorLiveRegion';
import { InspectorSection } from './InspectorSection';
import { InspectorTabPanel } from './InspectorTabPanel';
import { InspectorTabs } from './InspectorTabs';
import { partitionProperties } from './partition-properties';
import {
  selectDir,
  selectElementFocus,
  selectSelectedId,
  selectSelectedLabel,
  selectSelectedType,
} from './selectors';
import type { ErasedPropertyGroups, InspectorRowScope } from './types';
import { useCollapsedSections } from './use-collapsed-sections';
import { useAnnouncer } from './use-inspector-announcer';
import { useInspectorTabs } from './use-inspector-tabs';
import { useStableCallback } from './use-stable-callback';
// ── block-parts (2026-10-06) ──
import { FieldServicesProvider, type FieldServices } from '../../fields/field-services';
import { InspectorPartPanel } from './InspectorPartPanel';
import { inspectorPartLabelsFor } from './part-panel.labels';
// ── /block-parts ──
import '../../styles/visually-hidden.css';
import './Inspector.css';

export interface InspectorProps {
  /** BY PROP — the shell never reads React context. */
  kernel: BuilderKernel;
  /** Active editing bucket; 'base' edits props, others edit responsive overrides. */
  bucket?: EditingBucket | undefined;
  /** The active PAGE theme used to resolve truthful role swatches. */
  theme?: Theme | undefined;
  /*
    Re-points one role's value in the live theme.

    Absent by default, and the colour control hides its picker when it is: a
    host that has nowhere to put a colour must not be given a control that
    appears to accept one. A document never receives the value — it holds the
    ROLE, and this moves what the role resolves to.
  */
  onRetheme?: ((role: ColorRole, value: string) => void) | undefined;
  // ── P6-style-panel additions (style-manager DESIGN.md §A.5–A.9) ──
  /** Reports a bucket chosen in the style panel (custom widths too); the host moves the canvas. */
  onBucketChange?: ((bucket: StyleBucket) => void) | undefined;
  /** The free canvas width when the device is free-width ("Edit at ≤ N px"). */
  freeWidth?: number | undefined;
  /** The editor's language: labels and the panel's own direction. */
  locale?: 'en' | 'ar' | undefined;
  /** The site design library: palette, named styles, symbols. */
  library?: SiteLibrary | undefined;
  /** Multi-selection (the shell's element-selection store); Design writes to all of them. */
  elementTargets?: readonly ElementTarget[] | undefined;
  /** The canvas frame's document, for the forced-state preview. */
  frameDocument?: Document | null | undefined;
  /** Replays an element's animation on the canvas (Interactions → Preview). */
  onPreviewElement?: ((target: TreeTarget) => void) | undefined;
  /** "Convert to editable" for a registered block (DESIGN §A.9); a returned string is the refusal. */
  onConvertBlock?: ((nodeId: NodeId) => unknown) | undefined;
  /** Code tab links to the region css and the page css. */
  onOpenRegionCss?: ((nodeId: NodeId) => void) | undefined;
  onOpenPageCss?: (() => void) | undefined;
  // ── end P6-style-panel additions ──
  // ── fix pass: the quick bar's More / Animate reach the panel (style-manager §A.6) ──
  /** A tab (and Design sector) to show now; see {@link InspectorFocusRequest}. */
  focusRequest?: InspectorFocusRequest | undefined;
  /** The request was honoured: the host should drop it. */
  onFocusRequestHandled?: ((nonce: number) => void) | undefined;
  /** The element panel's open sector and forced state, for the canvas overlays. */
  onStyleContextChange?: ((context: InspectorStyleContext) => void) | undefined;
  // ── block-parts (2026-10-06) ──
  /** The host's photo catalogue: image and asset fields pick from it (URL entry without it). */
  assetLibrary?: AssetLibraryPort | undefined;
  // ── /block-parts ──
}

// ── block-parts (2026-10-06) ──
const selectPartFocus = (state: Readonly<KernelState>) => state.partFocus ?? null;
// ── /block-parts ──

/**
 * The generated properties panel (007 contract §4): rows derive from the
 * selected block's OWN schema (i1 — zero panel code per block), every commit is
 * one kernel transaction (i2), values render from document truth (i3 —
 * undo/external edits show through, a pruned selection empties the panel), and
 * override buckets read/write `responsive[bucket]` with markers and one-
 * transaction clears (i4).
 *
 * Render model: the shell subscribes to FOUR primitives (selected id, its type,
 * its `label`, the document direction) plus the registry epoch and the
 * element focus, so a property edit never renders the panel — it reaches the
 * one row that subscribes to that property. Everything a row needs besides its
 * own value travels in one memoised `scope`; a new scope identity is exactly
 * the set of events that must touch every mounted row once.
 *
 * Inside a composed region (a block whose schema declares a custom-code tree),
 * a focused ELEMENT replaces the block's rows with its own: the thing the
 * person clicked on the canvas — the image, the headline, the button — edited
 * by path through the same one-transaction door. The header names the element,
 * says which region it is in, and offers the way back.
 */
export function Inspector({
  kernel,
  bucket = 'base',
  theme = lightTheme,
  onRetheme,
  onBucketChange,
  freeWidth,
  locale = 'en',
  library,
  elementTargets,
  frameDocument,
  onPreviewElement,
  onConvertBlock,
  onOpenRegionCss,
  onOpenPageCss,
  focusRequest,
  onFocusRequestHandled,
  onStyleContextChange,
  assetLibrary, // block-parts (2026-10-06)
}: InspectorProps) {
  const selectedId = useKernelSelector(kernel, selectSelectedId);
  const partFocus = useKernelSelector(kernel, selectPartFocus); // block-parts (2026-10-06)
  const selectedType = useKernelSelector(kernel, selectSelectedType);
  const selectedLabel = useKernelSelector(kernel, selectSelectedLabel);
  const dir = useKernelSelector(kernel, selectDir);
  const elementFocus = useKernelSelector(kernel, selectElementFocus);

  // Field types are live under runtime registration/disposal — the renderer's
  // kernel-intrinsic catalog-version hook (one implementation, shared).
  const catalogVersion = useRegistryEpoch(kernel);
  const announcer = useAnnouncer();
  const retheme = useStableCallback(onRetheme);
  // The editor's language (arabic-editor): every string below, and the words names are made of.
  const labels = inspectorLabelsFor(locale);
  const words = locale === 'ar' ? ELEMENT_NAME_WORDS_AR : ELEMENT_NAME_WORDS_EN;

  const blockSchema = useMemo(() => {
    void catalogVersion; // the memo's real dependency: a late registration
    return selectedType === null ? undefined : kernel.context.registry.block(selectedType)?.schema;
  }, [kernel, selectedType, catalogVersion]);

  const properties = useMemo(
    () => (blockSchema === undefined ? [] : Object.entries(propsShapeOf(blockSchema.props))),
    [blockSchema],
  );
  const declarations = blockSchema?.propertyGroups as ErasedPropertyGroups | undefined;
  const palette = useMemo(() => paletteOf(theme), [theme]);

  // The prop this block's composition lives in, by DECLARATION — the marker
  // `customCodeTree()` leaves — so the panel never guesses from a name.
  const treeKey = useMemo(
    () => properties.find(([, schema]) => isCustomCodeTreeSchema(schema))?.[0],
    [properties],
  );
  // A symbol instance renders its master's tree (with its own overrides): its
  // elements are widgets too, and writes go to the instance's overrides.
  const symbols = library?.symbols;
  const writeOptions = useMemo<TreeWriteOptions>(
    () => ({ symbolTree: (symbolId: string) => symbols?.[symbolId]?.tree }),
    [symbols],
  );
  const holdsTree = treeKey !== undefined || selectedType === SYMBOL_INSTANCE_BLOCK_TYPE;
  // A focus is honoured only when it names an element of THIS selection in a
  // block that can hold one; anything else (a stale focus, a block with no
  // tree) is the ordinary block panel.
  const focusPath =
    elementFocus !== null && elementFocus.id === selectedId && holdsTree ? elementFocus.path : null;
  const focusedElement =
    focusPath === null || selectedId === null
      ? undefined
      : readTreeTarget(kernel, { kind: 'tree', nodeId: selectedId, path: focusPath }, writeOptions);
  const extraTargets = useMemo(
    () =>
      (elementTargets ?? []).filter(
        (candidate): candidate is TreeTarget => candidate.kind === 'tree',
      ),
    [elementTargets],
  );
  const utilityKey = useMemo(() => utilityClassesKey(declarations), [declarations]);
  const tokens = useMemo(
    () =>
      palette.map((entry) => ({
        id: entry.role.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`),
        // The colour popover speaks the editor's language (fix pass 2026-10-06).
        name: locale === 'ar' ? COLOR_ROLE_NAMES_AR[entry.role] : entry.name,
        css: entry.value,
      })),
    [palette, locale],
  );
  const propertyTabs = useMemo(
    () => partitionProperties(properties, declarations),
    [properties, declarations],
  );

  const scope = useMemo<InspectorRowScope | undefined>(
    () =>
      selectedId === null
        ? undefined
        : {
            kernel,
            nodeId: selectedId,
            bucket,
            catalogVersion,
            palette,
            onRetheme: retheme,
            announce: announcer.announce,
            dir,
            declarations,
          },
    [kernel, selectedId, bucket, catalogVersion, palette, retheme, announcer, dir, declarations],
  );

  // The same string as the canvas chip and the layers tree. The label
  // selector is what keeps it fresh while a person types the block's name.
  void selectedLabel;
  const regionName =
    selectedId === null ? labels.chrome.noSelection : blockDisplayName(kernel, selectedId, words);
  // ── block-parts (2026-10-06) ──
  // A part focus is honoured only when it names a declared part of THIS
  // selection (and no element of a composed region is focused instead).
  const partLabels = inspectorPartLabelsFor(locale);
  const partDecl =
    partFocus !== null && partFocus.id === selectedId && focusPath === null
      ? blockPartsOf(blockSchema)[partFocus.part]
      : undefined;
  const focusedPart = partDecl === undefined ? null : partFocus;
  const partPosition = focusedPart?.index.at(-1);
  const partTitle =
    partDecl === undefined
      ? undefined
      : partLabels.title(
          partPosition === undefined
            ? partDecl.label[locale]
            : `${partDecl.label[locale]} ${String(partPosition + 1)}`,
          regionName,
        );
  const fieldServices = useMemo<FieldServices>(() => ({ assetLibrary, locale }), [assetLibrary, locale]);
  const backToBlock = useCallback(() => {
    // Out of the part, not out of the selection: the block stays selected.
    // Names are read at call time, so the callback keeps one identity per locale.
    const id = kernel.context.store.getState().selection[0];
    kernel.clearPartFocus();
    if (id === undefined) return;
    const name = blockDisplayName(kernel, id, locale === 'ar' ? ELEMENT_NAME_WORDS_AR : ELEMENT_NAME_WORDS_EN);
    announcer.announce(inspectorPartLabelsFor(locale).announce.backToBlock(name));
  }, [kernel, announcer, locale]);
  // ── /block-parts ──
  const blockName =
    partTitle ?? (focusedElement === undefined ? regionName : customCodeElementName(focusedElement, words));

  const clearSelection = useCallback(() => {
    // The SAME ephemeral door the canvas uses — never a transaction, so Undo
    // keeps meaning "put my edit back". Announced through the panel's own
    // region: that is the channel its keyboard user is already on.
    kernel.clearSelection();
    announcer.announce(labels.chrome.selectionCleared);
  }, [kernel, announcer, labels]);

  const backToRegion = useCallback(() => {
    // Out of the element, not out of the selection: the region stays selected.
    kernel.clearElementFocus();
    announcer.announce(labels.chrome.selected(regionName));
  }, [kernel, announcer, regionName, labels]);
  const within = useMemo(
    () =>
      focusPath !== null
        ? { regionName, onBack: backToRegion }
        : focusedPart !== null // block-parts (2026-10-06)
          ? { regionName, onBack: backToBlock }
          : undefined,
    [focusPath, regionName, backToRegion, focusedPart, backToBlock],
  );

  const idPrefix = useId();
  const tabs = useInspectorTabs({
    tabs: propertyTabs,
    scope: selectedId === null ? '' : `${selectedId}:${bucket}`,
    dir,
    idPrefix,
  });
  const sections = useCollapsedSections();
  const hasRows = propertyTabs.length > 0 && focusPath === null && focusedPart === null; // block-parts: + part
  // The block's style manager lives on its Design tab, or its last tab when it declares none.
  const blockDesignTab =
    propertyTabs.find((candidate) => candidate.id === 'design')?.id ?? propertyTabs.at(-1)?.id;

  return (
    <section className="bldr-inspector" aria-label={labels.chrome.region}>
      <InspectorLiveRegion announcer={announcer} label={labels.chrome.messages} />
      <InspectorHeader
        blockName={blockName}
        selected={selectedId !== null}
        bucket={bucket}
        onClearSelection={clearSelection}
        within={within}
        // block-parts (2026-10-06): out of a part goes back to the block, not "the section"
        labels={focusedPart === null ? labels.header : { ...labels.header, backToRegion: partLabels.backToBlock }}
      >
        {hasRows ? (
          <InspectorTabs
            tabs={propertyTabs}
            activeTabId={tabs.activeTab?.id}
            tabId={tabs.tabId}
            panelId={tabs.panelId}
            onSelect={tabs.selectTab}
            onKeyDown={tabs.onTabKeyDown}
            bindTab={tabs.bindTab}
            label={labels.chrome.tablist}
            tabLabels={labels.chrome.tabs}
          />
        ) : null}
      </InspectorHeader>
      {/* block-parts (2026-10-06): every row, however nested, reaches the host's services */}
      <FieldServicesProvider value={fieldServices}>
      <div className="bldr-inspector__body">
        {selectedId === null || scope === undefined ? (
          <InspectorEmptyState kind="invitation" copy={labels.chrome.empty} />
        ) : focusedPart !== null ? (
          // ── block-parts (2026-10-06): the clicked part of a registered block ──
          <InspectorPartPanel
            key={`${selectedId}:${focusedPart.part}@${focusedPart.index.join('.')}`}
            kernel={kernel}
            nodeId={selectedId}
            part={focusedPart}
            palette={palette}
            onRetheme={retheme}
            catalogVersion={catalogVersion}
            announce={announcer.announce}
            dir={dir}
            device={bucket}
            onBucketChange={onBucketChange}
            freeWidth={freeWidth}
            locale={locale}
            frameDocument={frameDocument}
            request={focusRequest}
            onRequestHandled={onFocusRequestHandled}
            onStyleContextChange={onStyleContextChange}
            labels={partLabels}
          />
        ) : focusPath !== null ? (
          <InspectorElementPanel
            key={`${selectedId}:${focusPath.join('.')}`}
            kernel={kernel}
            nodeId={selectedId}
            path={focusPath}
            palette={palette}
            catalogVersion={catalogVersion}
            announce={announcer.announce}
            dir={dir}
            device={bucket}
            onBucketChange={onBucketChange}
            freeWidth={freeWidth}
            locale={locale}
            writeOptions={writeOptions}
            library={library}
            extraTargets={extraTargets}
            frameDocument={frameDocument}
            onPreviewElement={onPreviewElement}
            onOpenRegionCss={onOpenRegionCss}
            onOpenPageCss={onOpenPageCss}
            request={focusRequest}
            onRequestHandled={onFocusRequestHandled}
            onStyleContextChange={onStyleContextChange}
          />
        ) : blockSchema === undefined ? (
          // An unregistered type is NOT "nothing to edit" — say what happened.
          <InspectorEmptyState kind="unknown-type" copy={labels.chrome.empty} />
        ) : properties.length === 0 ? (
          <InspectorEmptyState kind="no-properties" copy={labels.chrome.empty} />
        ) : (
          propertyTabs.map((tab) => (
            <InspectorTabPanel
              key={tab.id}
              id={tabs.panelId(tab.id)}
              labelledBy={tabs.tabId(tab.id)}
              active={tab.id === tabs.activeTab?.id}
              mounted={tabs.isMounted(tab.id)}
            >
              {tab.id === 'design' && tab.sections.length > 0 ? (
                /*
                  A registered block's schema options (variant, background,
                  padding…) are its PRESETS; the style panel below writes
                  classes that override them. Named as two layers so the same
                  property never reads as two competing controls.
                */
                <div className="bldr-inspector__presets-lead">
                  <h3 className="bldr-inspector__section-heading bldr-inspector__section-title">
                    {labels.element.blockPresets}
                  </h3>
                  <p className="bldr-inspector__element-note">{labels.element.blockPresetsHint}</p>
                </div>
              ) : null}
              {tab.sections.map((section) => {
                const collapseKey = `${selectedId}:${bucket}:${tab.id}:${section.name}`;
                return (
                  <InspectorSection
                    key={section.name}
                    section={section}
                    collapseKey={collapseKey}
                    expanded={!sections.isCollapsed(collapseKey)}
                    onToggle={sections.toggle}
                    scope={scope}
                  />
                );
              })}
              {tab.id === blockDesignTab ? (
                <InspectorBlockDesign
                  kernel={kernel}
                  nodeId={selectedId}
                  utilityKey={utilityKey}
                  device={bucket}
                  dir={dir === 'rtl' ? 'rtl' : 'ltr'}
                  tokens={tokens}
                  announce={announcer.announce}
                  onConvertBlock={onConvertBlock}
                  labels={labels.element}
                  words={words}
                  styleLabels={locale === 'ar' ? STYLE_PANEL_LABELS_AR : STYLE_PANEL_LABELS_EN}
                />
              ) : null}
            </InspectorTabPanel>
          ))
        )}
      </div>
      </FieldServicesProvider>
    </section>
  );
}
