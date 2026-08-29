import { useCallback, useId, useMemo, useState, type KeyboardEvent } from 'react';

import type { z } from 'zod';

import type { BuilderKernel } from '@craftkit/builder-core';
import {
  lightTheme,
  paletteOf,
  type ColorRole,
  useKernelSelector,
  useRegistryEpoch,
  type Theme,
} from '@craftkit/builder-renderer';
import type { BlockPropertyGroup, BlockPropertyTab } from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import { propsShapeOf } from '../../fields/resolve-field';
import { InspectorRow } from './InspectorRow';
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
}

type KernelState = ReturnType<BuilderKernel['context']['store']['getState']>;

const TAB_DEFINITIONS = [
  { id: 'content', label: 'Content' },
  { id: 'design', label: 'Design' },
  { id: 'advanced', label: 'Advanced' },
] as const;

type InspectorProperty = readonly [propKey: string, schema: z.ZodType];

/**
 * The shell's temporary view of the optional schema-owned pair contract.
 *
 * `BlockPropertyGroup` will expose this shape after the schema-owning change.
 * Keeping the runtime reader narrow lets existing blocks remain compatible while
 * making the Inspector ready to consume an explicitly declared pair immediately.
 */
interface InspectorPairDeclaration {
  /** Stable local identity shared by exactly two properties in one section. */
  readonly id: string;
  /** One visible heading for the two values, for example "Margin". */
  readonly label: string;
  /** The declared caption for this individual cell, for example "Top". */
  readonly cellLabel: string;
}

type InspectorPropertyGroup = BlockPropertyGroup & {
  readonly pair?: InspectorPairDeclaration;
};

type InspectorSectionEntry =
  | { readonly kind: 'property'; readonly property: InspectorProperty }
  | {
      readonly kind: 'pair';
      readonly id: string;
      readonly label: string;
      readonly properties: readonly {
        readonly property: InspectorProperty;
        readonly pair: InspectorPairDeclaration;
      }[];
    };

interface InspectorSection {
  readonly name: string;
  readonly entries: readonly InspectorSectionEntry[];
}

interface InspectorTab {
  readonly id: BlockPropertyTab;
  readonly label: string;
  readonly sections: readonly InspectorSection[];
}

type ErasedPropertyGroups = Readonly<Record<string, InspectorPropertyGroup | undefined>>;

function usablePair(
  declaration: InspectorPropertyGroup | undefined,
): InspectorPairDeclaration | undefined {
  const pair = declaration?.pair;
  if (
    pair === undefined ||
    pair.id.trim() === '' ||
    pair.label.trim() === '' ||
    pair.cellLabel.trim() === ''
  ) {
    return undefined;
  }
  return pair;
}

function sectionEntries(
  properties: readonly InspectorProperty[],
  declarations: ErasedPropertyGroups | undefined,
): readonly InspectorSectionEntry[] {
  const candidates = new Map<
    string,
    {
      readonly id: string;
      readonly label: string;
      readonly firstPropertyKey: string;
      readonly properties: {
        readonly property: InspectorProperty;
        readonly pair: InspectorPairDeclaration;
      }[];
    }
  >();

  for (const property of properties) {
    const [propKey] = property;
    const pair = usablePair(declarations?.[propKey]);
    if (pair === undefined) {
      continue;
    }
    const current = candidates.get(pair.id);
    if (current === undefined) {
      candidates.set(pair.id, {
        id: pair.id,
        label: pair.label,
        firstPropertyKey: propKey,
        properties: [{ property, pair }],
      });
    } else {
      current.properties.push({ property, pair });
    }
  }

  const pairs = new Map<string, Extract<InspectorSectionEntry, { kind: 'pair' }>>();
  for (const candidate of candidates.values()) {
    const isValidPair =
      candidate.properties.length === 2 &&
      candidate.properties.every((entry) => entry.pair.label === candidate.label) &&
      new Set(candidate.properties.map((entry) => entry.pair.cellLabel)).size === 2;
    if (isValidPair) {
      pairs.set(candidate.id, {
        kind: 'pair',
        id: candidate.id,
        label: candidate.label,
        properties: candidate.properties,
      });
    }
  }

  const firstPropertyForPair = new Map<string, string>();
  for (const candidate of candidates.values()) {
    if (pairs.has(candidate.id)) {
      firstPropertyForPair.set(candidate.id, candidate.firstPropertyKey);
    }
  }

  return properties.flatMap((property): readonly InspectorSectionEntry[] => {
    const [propKey] = property;
    const pair = usablePair(declarations?.[propKey]);
    if (pair === undefined) {
      return [{ kind: 'property', property }];
    }
    const grouped = pairs.get(pair.id);
    if (grouped === undefined || firstPropertyForPair.get(pair.id) !== propKey) {
      return grouped === undefined ? [{ kind: 'property', property }] : [];
    }
    return [grouped];
  });
}

function partitionProperties(
  properties: readonly InspectorProperty[],
  declarations: ErasedPropertyGroups | undefined,
): readonly InspectorTab[] {
  const sectionsByTab = new Map<BlockPropertyTab, Map<string, InspectorProperty[]>>();

  for (const property of properties) {
    const [propKey] = property;
    const declaration = declarations?.[propKey];
    const tab = declaration?.tab ?? 'content';
    const tabLabel =
      TAB_DEFINITIONS.find((definition) => definition.id === tab)?.label ?? 'Content';
    const declaredSection = declaration?.section?.trim();
    const section =
      declaredSection === undefined || declaredSection === '' ? tabLabel : declaredSection;
    const tabSections = sectionsByTab.get(tab) ?? new Map<string, InspectorProperty[]>();
    const sectionProperties = tabSections.get(section) ?? [];
    sectionProperties.push(property);
    tabSections.set(section, sectionProperties);
    sectionsByTab.set(tab, tabSections);
  }

  return TAB_DEFINITIONS.flatMap((definition) => {
    const sections = sectionsByTab.get(definition.id);
    return sections === undefined
      ? []
      : [
          {
            ...definition,
            sections: [...sections].map(([name, groupedProperties]) => ({
              name,
              entries: sectionEntries(groupedProperties, declarations),
            })),
          },
        ];
  });
}

/**
 * The generated properties panel (007 contract §4): rows derive from the
 * selected block's OWN schema (i1 — zero panel code per block), every commit is
 * one kernel transaction (i2), values render from document truth (i3 —
 * undo/external edits show through, a pruned selection empties the panel), and
 * override buckets read/write `responsive[bucket]` with markers and one-
 * transaction clears (i4).
 */
/**
 * What the block is ACTUALLY set to, which is not always what the document says.
 *
 * A property the document omits still renders — the schema's default is what
 * the page draws. Reading the raw `props` alone showed those rows empty: after
 * the marketing blocks gained `size` and `width`, an existing CTA displayed
 * "—" for both while the page rendered `md` and `fit`. A person then cannot
 * tell what the block is, and choosing the value that is already in force reads
 * as a change when it is a no-op.
 *
 * Asking zod to parse `undefined` is the version-safe way to get a default: a
 * schema WITH one answers with it, and one without simply fails. No internals
 * are poked, so a zod upgrade cannot silently change the answer.
 *
 * The OVERRIDE buckets are deliberately excluded by the caller: an absent
 * override means "inherit", and showing the base default there would claim an
 * override exists.
 */
function effectiveValue(stored: unknown, schema: z.ZodType): unknown {
  if (stored !== undefined) {
    return stored;
  }
  const parsed = schema.safeParse(undefined);
  return parsed.success ? parsed.data : undefined;
}

export function Inspector({
  kernel,
  bucket = 'base',
  theme = lightTheme,
  onRetheme,
}: InspectorProps) {
  // ONE selector for the whole panel: the selected node's reference. Selection
  // pruning and undo both surface here as a plain snapshot change.
  const node = useKernelSelector(
    kernel,
    useCallback((state: KernelState) => {
      const id = state.selection[0];
      return id === undefined ? undefined : state.doc.nodes[id];
    }, []),
  );

  // Field types are live under runtime registration/disposal — the renderer's
  // kernel-intrinsic catalog-version hook (one implementation, shared).
  const catalogVersion = useRegistryEpoch(kernel);

  // {text, nonce}: repeated outcomes must still mutate the live region's text
  // node or AT hears nothing the second time (the established shell pattern).
  const [message, setMessageState] = useState({ text: '', nonce: 0 });
  const [collapsedSections, setCollapsedSections] = useState<ReadonlySet<string>>(() => new Set());
  const [tabState, setTabState] = useState<{
    readonly scope: string;
    readonly tab: BlockPropertyTab;
  }>({ scope: '', tab: 'content' });
  const sectionIdPrefix = useId();
  const tabIdPrefix = useId();
  const announce = useCallback((text: string) => {
    setMessageState((current) => ({ text, nonce: current.nonce + 1 }));
  }, []);

  const blockSchema =
    node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema;

  const properties = useMemo(
    () => (blockSchema === undefined ? [] : Object.entries(propsShapeOf(blockSchema.props))),
    [blockSchema],
  );

  const propertyDeclarations = blockSchema?.propertyGroups as ErasedPropertyGroups | undefined;
  const palette = useMemo(() => paletteOf(theme), [theme]);

  const propertyTabs = useMemo(
    () => partitionProperties(properties, propertyDeclarations),
    [properties, propertyDeclarations],
  );

  const overrides = node === undefined || bucket === 'base' ? undefined : node.responsive?.[bucket];
  const blockName =
    node === undefined ? 'No block selected' : (blockSchema?.description ?? node.type);
  const tabScope = node === undefined ? '' : `${node.id}:${bucket}`;
  const requestedTab = tabState.scope === tabScope ? tabState.tab : 'content';
  const activeTab = propertyTabs.find((tab) => tab.id === requestedTab) ?? propertyTabs.at(0);
  const tabId = (tab: BlockPropertyTab) => `${tabIdPrefix}-${tab}-tab`;
  const panelId = (tab: BlockPropertyTab) => `${tabIdPrefix}-${tab}-panel`;

  const selectTab = (tab: BlockPropertyTab) => {
    setTabState({ scope: tabScope, tab });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: BlockPropertyTab) => {
    const currentIndex = propertyTabs.findIndex((candidate) => candidate.id === tab);
    let nextIndex: number | undefined;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % propertyTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + propertyTabs.length) % propertyTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = propertyTabs.length - 1;
    }

    const nextTab = nextIndex === undefined ? undefined : propertyTabs[nextIndex];
    if (nextTab === undefined) {
      return;
    }
    event.preventDefault();
    selectTab(nextTab.id);
    document.getElementById(tabId(nextTab.id))?.focus();
  };

  return (
    <section className="bldr-inspector" aria-label="Inspector">
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Inspector messages">
        {message.text}
        {message.nonce % 2 === 1 ? '​' : ''}
      </output>
      <header className="bldr-inspector__head">
        <div className="bldr-inspector__title-row">
          <h2 className="bldr-inspector__title">Inspector</h2>
          {bucket !== 'base' ? <span className="bldr-inspector__bucket">{bucket}</span> : null}
        </div>
        <p className="bldr-inspector__block-name" aria-label="Selected block">
          {blockName}
        </p>
      </header>
      {node === undefined ? (
        <div className="bldr-inspector__invitation">
          <svg
            className="bldr-inspector__invitation-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M3 2.5 12.5 7 8 8.5 6.5 13 3 2.5Z" />
          </svg>
          <p className="bldr-inspector__empty">Select a block to edit its properties.</p>
        </div>
      ) : (
        <>
          {bucket !== 'base' ? (
            <p className="bldr-inspector__bucket-note">Editing {bucket} overrides</p>
          ) : null}
          {blockSchema === undefined ? (
            // An unregistered type is NOT "nothing to edit" — say what happened.
            <p className="bldr-inspector__empty">
              Unknown block type — no schema is registered for it.
            </p>
          ) : properties.length === 0 ? (
            <p className="bldr-inspector__empty">This block has no editable properties.</p>
          ) : (
            <>
              <div className="bldr-inspector__tabs" role="tablist" aria-label="Inspector tabs">
                {propertyTabs.map((tab) => {
                  const selected = tab.id === activeTab?.id;
                  return (
                    <button
                      key={tab.id}
                      id={tabId(tab.id)}
                      type="button"
                      className="bldr-inspector__tab"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={panelId(tab.id)}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => {
                        selectTab(tab.id);
                      }}
                      onKeyDown={(event) => {
                        handleTabKeyDown(event, tab.id);
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              {propertyTabs.map((tab) => (
                <div
                  key={tab.id}
                  id={panelId(tab.id)}
                  className="bldr-inspector__tabpanel"
                  role="tabpanel"
                  aria-labelledby={tabId(tab.id)}
                  hidden={tab.id !== activeTab?.id}
                >
                  <div className="bldr-inspector__sections">
                    {tab.sections.map((section, sectionIndex) => {
                      const collapseKey = `${node.id}:${bucket}:${tab.id}:${section.name}`;
                      const expanded = !collapsedSections.has(collapseKey);
                      const toggleId = `${sectionIdPrefix}-${tab.id}-${String(sectionIndex)}-toggle`;
                      const regionId = `${sectionIdPrefix}-${tab.id}-${String(sectionIndex)}-region`;
                      return (
                        <section key={section.name} className="bldr-inspector__section">
                          <h3 className="bldr-inspector__section-heading">
                            <button
                              id={toggleId}
                              type="button"
                              className="bldr-inspector__section-toggle"
                              aria-expanded={expanded}
                              aria-controls={regionId}
                              onClick={() => {
                                setCollapsedSections((current) => {
                                  const next = new Set(current);
                                  if (next.has(collapseKey)) {
                                    next.delete(collapseKey);
                                  } else {
                                    next.add(collapseKey);
                                  }
                                  return next;
                                });
                              }}
                            >
                              <svg
                                className="bldr-inspector__chevron"
                                viewBox="0 0 16 16"
                                aria-hidden="true"
                                focusable="false"
                              >
                                <path d={expanded ? 'm4 10 4-4 4 4' : 'm4 6 4 4 4-4'} />
                              </svg>
                              <span>{section.name}</span>
                            </button>
                          </h3>
                          <div
                            id={regionId}
                            className="bldr-inspector__section-region"
                            role="region"
                            aria-labelledby={toggleId}
                            hidden={!expanded}
                          >
                            <div className="bldr-inspector__rows">
                              {section.entries.map((entry) => {
                                if (entry.kind === 'pair') {
                                  return (
                                    <fieldset
                                      key={entry.id}
                                      className="bldr-inspector__property-pair"
                                      data-property-pair={entry.id}
                                    >
                                      <legend className="bldr-inspector__property-pair-label">
                                        {entry.label}
                                      </legend>
                                      <div className="bldr-inspector__property-pair-values">
                                        {entry.properties.map(({ property, pair }) => {
                                          const [propKey, schema] = property;
                                          return (
                                            <InspectorRow
                                              key={`${node.id}:${bucket}:${propKey}`}
                                              kernel={kernel}
                                              nodeId={node.id}
                                              propKey={propKey}
                                              schema={schema}
                                              propertyKind={propertyDeclarations?.[propKey]?.kind}
                                              palette={palette}
                                              onRetheme={onRetheme}
                                              bucket={bucket}
                                              value={
                                                bucket === 'base'
                                                  ? effectiveValue(node.props[propKey], schema)
                                                  : overrides?.[propKey]
                                              }
                                              baseValue={effectiveValue(
                                                node.props[propKey],
                                                schema,
                                              )}
                                              hasOverride={
                                                overrides !== undefined &&
                                                Object.hasOwn(overrides, propKey)
                                              }
                                              catalogVersion={catalogVersion}
                                              announce={announce}
                                              pairItemLabel={pair.cellLabel}
                                              responsiveCapable
                                            />
                                          );
                                        })}
                                      </div>
                                    </fieldset>
                                  );
                                }

                                const [propKey, schema] = entry.property;
                                return (
                                  <InspectorRow
                                    key={`${node.id}:${bucket}:${propKey}`}
                                    kernel={kernel}
                                    nodeId={node.id}
                                    propKey={propKey}
                                    schema={schema}
                                    propertyKind={propertyDeclarations?.[propKey]?.kind}
                                    palette={palette}
                                    onRetheme={onRetheme}
                                    bucket={bucket}
                                    value={
                                      bucket === 'base'
                                        ? effectiveValue(node.props[propKey], schema)
                                        : overrides?.[propKey]
                                    }
                                    baseValue={effectiveValue(node.props[propKey], schema)}
                                    hasOverride={
                                      overrides !== undefined && Object.hasOwn(overrides, propKey)
                                    }
                                    catalogVersion={catalogVersion}
                                    announce={announce}
                                    responsiveCapable
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
