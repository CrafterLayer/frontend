import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { ColorRole, PaletteEntry } from '@craftkit/builder-renderer';
import {
  blockPartsOf,
  partStyleKey,
  partStylesKeyOf,
  planPartDir,
  PART_OWN_CLASSES_ATTRIBUTE,
  type NodeId,
  type PartRef,
  type StyleBucket,
  type StyleSectorId,
  type StyleState,
} from '@craftkit/builder-schema';

import { ELEMENT_NAME_WORDS_AR, ELEMENT_NAME_WORDS_EN } from '../../custom-code/element-target';
import type { EditingBucket } from '../../devices/buckets';
import { blockDisplayName } from '../../naming/block-display-name';
import { ChoiceGroup } from '../../style-manager/controls/ChoiceGroup';
import type { ColorSwatch } from '../../style-manager/controls/StyleColorControl';
import { partSource, type PartStyleScope } from '../../style-manager/part-source';
import { STYLE_PANEL_LABELS_AR, STYLE_PANEL_LABELS_EN, StylePanel } from '../../style-manager/StylePanel';
import { EMPTY_OVERRIDES } from './constants';
import { InspectorRowBody } from './InspectorRowBody';
import type { InspectorFocusRequest, InspectorStyleContext } from './inspector-request';
import { inspectorPartLabelsFor, type InspectorPartLabels } from './part-panel.labels';
import { commitPartRow, partContentRows, partRowValue, type PartContentRow } from './part-panel-rows';
import { effectiveValue } from './schema-facts';
import type { DocumentDirection, ErasedPropertyGroups } from './types';

export interface InspectorPartPanelProps {
  readonly kernel: BuilderKernel;
  /** The registered block that owns the part. */
  readonly nodeId: NodeId;
  /** The focused part: its declared name and, for repeated parts, its indices. */
  readonly part: PartRef;
  readonly palette: readonly PaletteEntry[];
  readonly onRetheme?: ((role: ColorRole, value: string) => void) | undefined;
  readonly catalogVersion: number;
  readonly announce: (text: string) => void;
  /** The document direction (the style panel mirrors box sides to it). */
  readonly dir: DocumentDirection;
  /** The device bucket the DeviceBar is on; top-level rows write its overrides. */
  readonly device: EditingBucket;
  readonly onBucketChange?: ((bucket: StyleBucket) => void) | undefined;
  readonly freeWidth?: number | undefined;
  readonly locale: 'en' | 'ar';
  /** The canvas frame's document, to read the part's tag (rows that cannot apply drop out). */
  readonly frameDocument?: Document | null | undefined;
  /** The quick bar's "Style" / "More": the Design tab at a sector. */
  readonly request?: InspectorFocusRequest | undefined;
  readonly onRequestHandled?: ((nonce: number) => void) | undefined;
  readonly onStyleContextChange?: ((context: InspectorStyleContext) => void) | undefined;
  /** Strings; the locale's set by default. */
  readonly labels?: InspectorPartLabels | undefined;
}

type PartTab = 'content' | 'design';
type PartDir = 'auto' | 'ltr' | 'rtl';

function roleToken(role: string): string {
  return role.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

function storedDir(styles: unknown, key: string): PartDir | undefined {
  if (typeof styles !== 'object' || styles === null) return undefined;
  const entry = (styles as Readonly<Record<string, unknown>>)[key];
  if (typeof entry !== 'object' || entry === null) return undefined;
  const dir = (entry as { readonly dir?: unknown }).dir;
  return dir === 'auto' || dir === 'ltr' || dir === 'rtl' ? dir : undefined;
}

/** The part's own element on the canvas, scoped to its block (a nested child's part is not ours). */
function partElementOf(frame: Document | null | undefined, nodeId: NodeId, ref: PartRef): Element | undefined {
  if (frame === null || frame === undefined) return undefined;
  const wrapper = frame.querySelector(`[data-bldr-node="${CSS.escape(nodeId)}"]`);
  if (wrapper === null) return undefined;
  const index = ref.index.join('.');
  for (const element of wrapper.querySelectorAll(`[data-ck-part="${CSS.escape(ref.part)}"]`)) {
    if (element.closest('[data-bldr-node]') !== wrapper) continue;
    if ((element.getAttribute('data-ck-part-index') ?? '') !== index) continue;
    return element;
  }
  return undefined;
}

function partTag(frame: Document | null | undefined, nodeId: NodeId, ref: PartRef): string | undefined {
  return partElementOf(frame, nodeId, ref)?.tagName.toLowerCase();
}

// ── block-parts (2026-10-06) ──
/** The classes the block renderer itself gives this part (canvas stamp), the Design tab's baseline. */
function partOwnClasses(frame: Document | null | undefined, nodeId: NodeId, ref: PartRef): string | undefined {
  return partElementOf(frame, nodeId, ref)?.getAttribute(PART_OWN_CLASSES_ATTRIBUTE) ?? undefined;
}
// ── /block-parts ──

/**
 * The Inspector panel for ONE part of a registered block (block-parts DESIGN
 * §2.13): what the person clicked on the canvas — the hero's heading, a
 * feature's title, the CTA link — edited on its own.
 *
 * - **Content** shows the part's bound rows through the Inspector's own
 *   `InspectorRowBody`, so each kind gets its editor (text or textarea, the
 *   link field, the image field, an item's whole group, a list's repeater).
 *   A top-level prop keeps the row's own door; a nested one (`items.2.title`)
 *   commits as ONE labelled `setProp` of the top-level key through the part
 *   planners.
 * - **Design** is the style manager over `partSource` in tokens mode, a scope
 *   switch (This item / All items) for repeated parts, and a Direction
 *   control (Auto / LTR / RTL) through `planPartDir`.
 *
 * Every write is one transaction, so every edit is one Undo; every value
 * renders from document truth, so undo and agent edits show through.
 */
export function InspectorPartPanel({
  kernel,
  nodeId,
  part,
  palette,
  onRetheme,
  catalogVersion,
  announce,
  dir,
  device,
  onBucketChange,
  freeWidth,
  locale,
  frameDocument,
  request,
  onRequestHandled,
  onStyleContextChange,
  labels: labelsProp,
}: InspectorPartPanelProps) {
  const labels = labelsProp ?? inspectorPartLabelsFor(locale);
  const styleLabels = locale === 'ar' ? STYLE_PANEL_LABELS_AR : STYLE_PANEL_LABELS_EN;
  const words = locale === 'ar' ? ELEMENT_NAME_WORDS_AR : ELEMENT_NAME_WORDS_EN;
  const uiDir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';
  const pageDir: 'ltr' | 'rtl' = dir === 'rtl' ? 'rtl' : 'ltr';
  const indexKey = part.index.join('.');
  // A stable ref for this focus: a new object per render would rebuild the source.
  const ref = useMemo<PartRef>(
    () => ({ part: part.part, index: indexKey === '' ? [] : indexKey.split('.').map(Number) }),
    [part.part, indexKey],
  );

  // The node itself is the one subscription: immer keeps its reference until a
  // transaction touches it, so a write elsewhere never renders this panel.
  const store = kernel.context.store;
  const subscribe = useCallback((listener: () => void) => store.subscribeNode(nodeId, listener), [store, nodeId]);
  const readNode = useCallback(() => store.getState().doc.nodes[nodeId], [store, nodeId]);
  const node = useSyncExternalStore(subscribe, readNode, readNode);

  // The block TYPE, not the node, decides the schema.
  const type = node?.type;
  const schema = useMemo(() => {
    void catalogVersion; // a late registration re-resolves the block
    return type === undefined ? undefined : kernel.context.registry.block(type)?.schema;
  }, [kernel, type, catalogVersion]);
  const decl = blockPartsOf(schema)[ref.part];
  const repeated = ref.index.length > 0;

  const [tab, setTab] = useState<PartTab>('content');
  const [scope, setScope] = useState<PartStyleScope>('all');
  const [bucket, setBucket] = useState<StyleBucket>(device);
  const [state, setState] = useState<StyleState>('default');
  const [seenDevice, setSeenDevice] = useState(device);
  if (seenDevice !== device) {
    // The DeviceBar moved: the panel edits that bucket now (style-manager §A.7).
    setSeenDevice(device);
    setBucket(device);
  }
  const [seenRequest, setSeenRequest] = useState<number | undefined>(undefined);
  if (request !== undefined && seenRequest !== request.nonce) {
    // The quick bar asked for a place: parts have no Interactions, so any
    // request lands on Design (at its sector when it names one).
    setSeenRequest(request.nonce);
    setTab('design');
  }
  useEffect(() => {
    if (seenRequest !== undefined) onRequestHandled?.(seenRequest);
  }, [seenRequest, onRequestHandled]);
  const [sector, setSector] = useState<StyleSectorId | null>(request?.sector ?? null);
  const shownSector = tab === 'design' ? sector : null;
  useEffect(() => {
    onStyleContextChange?.({ sector: shownSector, state });
  }, [onStyleContextChange, shownSector, state]);

  const blockName = blockDisplayName(kernel, nodeId, words);
  const partLabel = decl?.label[locale] ?? ref.part;
  const source = useMemo(
    () =>
      partSource(kernel, nodeId, ref, repeated ? scope : 'all', {
        locale,
        words,
        // ── block-parts (2026-10-06) ──
        baseline: () => partOwnClasses(frameDocument, nodeId, ref),
        // ── /block-parts ──
      }),
    [kernel, nodeId, ref, repeated, scope, locale, words, frameDocument],
  );
  const tokens = useMemo<ColorSwatch[]>(
    () => palette.map((entry) => ({ id: roleToken(entry.role), name: entry.name, css: entry.value })),
    [palette],
  );
  const rows = useMemo(
    () => (schema === undefined || decl === undefined ? [] : partContentRows(schema.props, decl, ref)),
    [schema, decl, ref],
  );

  if (node === undefined || schema === undefined || decl === undefined) {
    return (
      <p className="bldr-inspector__element-note" role="status">
        {labels.gone}
      </p>
    );
  }

  const stylesKey = partStylesKeyOf(schema.props) ?? 'partStyles';
  const styles = node.props[stylesKey];
  const currentDir: PartDir =
    (repeated ? storedDir(styles, partStyleKey(ref, 'this')) : undefined) ??
    storedDir(styles, partStyleKey(ref, 'all')) ??
    'auto';

  const setDir = (next: string) => {
    if (next !== 'auto' && next !== 'ltr' && next !== 'rtl') return;
    const current = kernel.getDocument().nodes[nodeId];
    if (current === undefined) return;
    // Auto is the absence of an override: the part follows its own text again.
    const plan = planPartDir(current, schema.props, ref, next === 'auto' ? null : next, blockName);
    if (!plan.ok) {
      announce(plan.message);
      return;
    }
    if (plan.steps.length === 0) return;
    try {
      kernel.dispatchGroup(plan.steps, { author: 'user', label: plan.label });
      announce(labels.announce.direction(labels.direction[next]));
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error));
    }
  };

  const captionOf = (row: PartContentRow): string => {
    const position = repeated ? ` · ${labels.item((ref.index.at(-1) ?? 0) + 1)}` : '';
    if (row.caption === 'linkAddress') return `${partLabel} · ${labels.linkAddress}`;
    if (row.caption === 'altText') return `${partLabel} · ${labels.altText}`;
    return `${partLabel}${position}`;
  };

  const renderRow = (row: PartContentRow) => {
    const top = row.path[0];
    if (row.path.length === 1 && typeof top === 'string') {
      // A top-level prop: on the base bucket the part planners write it (one
      // labelled "Edit text · Promo heading"); under a device bucket the
      // Inspector's own row door writes the override, exactly as the block panel does.
      const stored = node.props[top];
      const baseValue = effectiveValue(stored, row.schema);
      const overrides = device === 'base' ? EMPTY_OVERRIDES : (node.responsive?.[device] ?? EMPTY_OVERRIDES);
      const hasOverride = device !== 'base' && Object.hasOwn(overrides, top);
      return (
        <InspectorRowBody
          key={`${nodeId}:${device}:${row.key}`}
          kernel={kernel}
          nodeId={nodeId}
          propKey={top}
          schema={row.schema}
          propertyKind={row.propertyKind ?? (schema.propertyGroups as ErasedPropertyGroups | undefined)?.[top]?.kind}
          palette={palette}
          onRetheme={onRetheme}
          bucket={device}
          value={device === 'base' ? baseValue : overrides[top]}
          baseValue={baseValue}
          hasOverride={hasOverride}
          catalogVersion={catalogVersion}
          announce={announce}
          dir={dir}
          {...(device === 'base'
            ? { commitValue: (next: unknown) => commitPartRow(kernel, nodeId, ref, row, next, blockName, partLabel) }
            : {})}
          deferTextCommit
          pairItemLabel={captionOf(row)}
          responsiveCapable
        />
      );
    }
    // A nested prop: one labelled setProp of the top-level key, base bucket.
    const value = partRowValue(node.props, row.path);
    return (
      <InspectorRowBody
        key={`${nodeId}:${row.key}`}
        kernel={kernel}
        nodeId={nodeId}
        propKey={row.key}
        schema={row.schema}
        propertyKind={row.propertyKind}
        palette={palette}
        onRetheme={onRetheme}
        bucket="base"
        value={value}
        baseValue={value}
        hasOverride={false}
        catalogVersion={catalogVersion}
        announce={announce}
        dir={dir}
        path={['props', ...row.path]}
        commitValue={(next) => commitPartRow(kernel, nodeId, ref, row, next, blockName, partLabel)}
        nested
        deferTextCommit
        pairItemLabel={captionOf(row)}
        responsiveCapable={false}
      />
    );
  };

  return (
    <div className="bldr-inspector__element bldr-inspector__part" data-part-kind={decl.kind} data-part={ref.part}>
      <Tabs.Root
        className="bldr-inspector__element-tabs"
        value={tab}
        dir={uiDir}
        onValueChange={(value) => {
          if (value === 'content' || value === 'design') setTab(value);
        }}
      >
        <Tabs.List className="bldr-inspector__element-tablist" aria-label={labels.tablist}>
          <Tabs.Trigger value="content" className="bldr-inspector__element-tab">
            {labels.tabs.content}
          </Tabs.Trigger>
          <Tabs.Trigger value="design" className="bldr-inspector__element-tab">
            {labels.tabs.design}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="content" className="bldr-inspector__element-panel">
          {rows.length === 0 ? (
            <p className="bldr-inspector__element-note">{labels.noContent}</p>
          ) : (
            <div className="bldr-inspector__rows">{rows.map(renderRow)}</div>
          )}
        </Tabs.Content>

        <Tabs.Content value="design" className="bldr-inspector__element-panel">
          <div className="bldr-inspector__part-controls">
            {repeated ? (
              <div className="bldr-inspector__part-control">
                <span className="bldr-inspector__label">{labels.scope.label}</span>
                <ChoiceGroup
                  label={labels.scope.label}
                  options={[
                    { value: 'all', label: labels.scope.all },
                    { value: 'this', label: labels.scope.this },
                  ]}
                  value={scope}
                  onChange={(next) => {
                    if (next === 'all' || next === 'this') setScope(next);
                  }}
                  dir={uiDir}
                />
              </div>
            ) : null}
            {decl.kind === 'text' || decl.kind === 'rich' || decl.kind === 'link' || decl.kind === 'item' ? (
              <div className="bldr-inspector__part-control">
                <span className="bldr-inspector__label">{labels.direction.label}</span>
                <ChoiceGroup
                  label={labels.direction.label}
                  options={[
                    { value: 'auto', label: labels.direction.auto, icon: <span aria-hidden="true">{labels.direction.auto}</span> },
                    { value: 'ltr', label: labels.direction.ltr, icon: <span aria-hidden="true">LTR</span> },
                    { value: 'rtl', label: labels.direction.rtl, icon: <span aria-hidden="true">RTL</span> },
                  ]}
                  value={currentDir}
                  onChange={setDir}
                  dir={uiDir}
                />
                <p className="bldr-inspector__element-note">{labels.direction.hint}</p>
              </div>
            ) : null}
          </div>
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
            tag={partTag(frameDocument, nodeId, ref)}
            sectors={decl.styleSections}
            announce={announce}
            labels={styleLabels}
            revealSector={
              request?.tab === 'design' && request.sector !== undefined
                ? { sector: request.sector, nonce: request.nonce }
                : undefined
            }
            onActiveSectorChange={setSector}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
