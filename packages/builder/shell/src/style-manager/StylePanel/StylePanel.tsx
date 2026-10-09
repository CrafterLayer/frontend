import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  STYLE_PROPERTIES,
  STYLE_SECTORS,
  type StyleBucket,
  type StyleIntent,
  type StylePropertyId,
  type StyleSectorId,
  type StyleState,
} from '@craftkit/builder-schema';

import { BucketStateSwitcher } from '../controls/BucketStateSwitcher';
import { resolveColor, type ColorSwatch } from '../controls/StyleColorControl';
import { appliesToTag, isTokenCapable } from '../property-models';
import { intentsAt, StyleProperty, withDisplayCleanup, type StyleEdit } from '../StyleProperty';
import { StyleSector } from '../StyleSector';
import type { StyleSource } from '../style-source';
import { emptyView, viewStyles, type PropertyView } from '../style-view';
import { useStyleSourceClasses } from '../use-style-source';
import { STYLE_PANEL_SECTORS } from './sectors';
import { STYLE_PANEL_LABELS_EN, type StylePanelLabels } from './StylePanel.labels';
import { StylePanelFilter } from '../StylePanelFilter';

import './StylePanel.css';

/** The most-used sectors start open; the rest are one click (or one search) away. */
const OPEN_BY_DEFAULT: readonly StyleSectorId[] = ['layout', 'spacing', 'size', 'typography', 'backgrounds'];

/** Tags whose job is words: their panel opens on Typography, with Layout after the look. */
const TEXT_TAGS: ReadonlySet<string> = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'li', 'blockquote', 'label', 'strong',
  'em', 'small', 'figcaption', 'dt', 'dd', 'cite', 'q', 'time', 'abbr', 'code',
]);

/** Where a sector sits for a text element (walk 2026-10-08: Typography came fifth on a heading). */
const TEXT_SECTOR_RANK: Readonly<Partial<Record<StyleSectorId, number>>> = {
  typography: 0,
  layout: 20,
  position: 21,
};

function sectorOrderFor(tag: string | undefined): (a: StyleSectorId, b: StyleSectorId) => number {
  if (tag === undefined || !TEXT_TAGS.has(tag.toLowerCase())) return () => 0;
  const rank = (id: StyleSectorId) => TEXT_SECTOR_RANK[id] ?? 10;
  return (a, b) => rank(a) - rank(b);
}

/** Case- and diacritic-insensitive text for the property filter (Arabic tashkil too). */
function searchable(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/gu, '')
    .toLocaleLowerCase();
}

/** Properties drawn inside another's control (padding draws margin; border width draws style). */
const COMPANION_OF: Readonly<Partial<Record<StylePropertyId, StylePropertyId>>> = {
  padding: 'margin',
  borderWidth: 'borderStyle',
};
const DRAWN_BY_COMPANION: ReadonlySet<StylePropertyId> = new Set(['margin', 'borderStyle']);

export interface StylePanelProps {
  readonly source: StyleSource;
  readonly bucket: StyleBucket;
  readonly state: StyleState;
  /** Present ⇒ the panel draws the bucket/state switcher at its top. */
  readonly onBucketChange?: ((bucket: StyleBucket) => void) | undefined;
  readonly onStateChange?: ((state: StyleState) => void) | undefined;
  /** Custom breakpoints in use on the page, offered again by the switcher. */
  readonly customWidths?: readonly number[] | undefined;
  /** The free canvas width, when the device is free-width ("Edit at ≤ N px"). */
  readonly freeWidth?: number | undefined;
  /** The PAGE direction: box sides, corners and origins mirror to it. */
  readonly dir: 'ltr' | 'rtl';
  /** Theme colour tokens with resolved swatches. */
  readonly tokens: readonly ColorSwatch[];
  /** Site-library palette colours (free mode). */
  readonly palette?: readonly ColorSwatch[] | undefined;
  /** Named-style utilities by id, so values from `ck-s-*` show their origin. */
  readonly namedStyles?: Readonly<Record<string, string>> | undefined;
  /** The element's tag, to drop rows that cannot apply (object fit on a heading). */
  readonly tag?: string | undefined;
  readonly sectors?: readonly StyleSectorId[] | undefined;
  /** The Inspector's polite live region. */
  readonly announce: (text: string) => void;
  /** Canvas-only preview while a control is dragged; `null` ends it. Never a document write. */
  readonly onPreview?: ((intents: readonly StyleIntent[] | null) => void) | undefined;
  readonly labels?: StylePanelLabels | undefined;
  /** Rendered after the sectors: the Advanced group of the element panel. */
  readonly children?: ReactNode;
  /**
   * A host asking for one sector (the quick bar's "More"): expanded and
   * scrolled into view each time `nonce` changes.
   */
  readonly revealSector?: { readonly sector: StyleSectorId; readonly nonce: number } | undefined;
  /** The sector a person last opened (or a host revealed), for canvas overlays. */
  readonly onActiveSectorChange?: ((sector: StyleSectorId | null) => void) | undefined;
}

const isBaseOnly = (property: StylePropertyId) => STYLE_PROPERTIES[property].baseOnly === true;

/**
 * The style manager's side panel (style-manager DESIGN.md §A.4–A.5, A.7–A.9).
 *
 * Renders the catalogue's sectors for any StyleSource — one tree element,
 * several at once (Mixed), or a registered block in tokens mode — at the
 * chosen bucket and state. Every control reports edits; the panel turns them
 * into engine intents at {bucket, state} and asks the source to write them as
 * ONE labelled transaction ("Padding · Heading 'Our story'"), then announces
 * the outcome. A refusal from the engine or the door is shown and announced,
 * and the document is untouched.
 */
export function StylePanel({
  source,
  bucket,
  state,
  onBucketChange,
  onStateChange,
  customWidths,
  freeWidth,
  dir,
  tokens,
  palette = [],
  namedStyles,
  tag,
  sectors = STYLE_PANEL_SECTORS,
  announce,
  onPreview,
  labels = STYLE_PANEL_LABELS_EN,
  children,
  revealSector,
  onActiveSectorChange,
}: StylePanelProps) {
  const classes = useStyleSourceClasses(source);
  const views = useMemo(
    () => viewStyles(classes, { bucket, state }, namedStyles),
    [classes, bucket, state, namedStyles],
  );
  const [open, setOpen] = useState<ReadonlySet<StyleSectorId>>(() =>
    revealSector === undefined ? new Set(OPEN_BY_DEFAULT) : new Set([...OPEN_BY_DEFAULT, revealSector.sector]),
  );
  const [refusal, setRefusal] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const [seenReveal, setSeenReveal] = useState<number | undefined>(undefined);
  if (revealSector !== undefined && seenReveal !== revealSector.nonce) {
    setSeenReveal(revealSector.nonce);
    if (!open.has(revealSector.sector)) setOpen(new Set([...open, revealSector.sector]));
  }
  const revealNonce = revealSector?.nonce;
  const revealId = revealSector?.sector;
  const activeSectorChange = useRef(onActiveSectorChange);
  useLayoutEffect(() => {
    activeSectorChange.current = onActiveSectorChange;
  });
  useEffect(() => {
    if (revealId === undefined || revealNonce === undefined) return;
    activeSectorChange.current?.(revealId);
    const sector = rootRef.current?.querySelector<HTMLElement>(`[data-sector="${revealId}"]`);
    try {
      sector?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      // A host without layout (jsdom) has no scrolling; the sector is still open.
    }
    sector?.querySelector<HTMLElement>('.bldr-style-sector__toggle')?.focus({ preventScroll: true });
  }, [revealNonce, revealId]);

  const viewOf = (id: StylePropertyId): PropertyView => views.get(id) ?? emptyView(STYLE_PROPERTIES[id]);
  const surface = tokens.find((swatch) => swatch.id === 'surface')?.css;
  const ink = tokens.find((swatch) => swatch.id === 'text')?.css;
  const background = resolveColor(viewOf('backgroundColor').value, tokens, palette) ?? surface;
  const foreground = resolveColor(viewOf('textColor').value, tokens, palette) ?? ink;
  const contrastFor = (id: StylePropertyId): string | undefined =>
    id === 'textColor' ? background : id === 'backgroundColor' ? foreground : undefined;

  const write = (edits: readonly StyleEdit[], property: string) => {
    const result = source.apply(intentsAt(withDisplayCleanup(edits), bucket, state, isBaseOnly), property);
    if (result.ok) {
      setRefusal(null);
      announce(labels.updated(property));
      return;
    }
    setRefusal(result.message);
    announce(labels.refused(property, result.message));
  };

  const preview =
    onPreview === undefined
      ? undefined
      : (edits: readonly StyleEdit[] | null) => {
          onPreview(edits === null ? null : intentsAt(withDisplayCleanup(edits), bucket, state, isBaseOnly));
        };

  const available = STYLE_SECTORS.filter((sector) => sectors.includes(sector.id))
    .map((sector) => ({
      sector,
      properties: sector.properties.filter(
        (def) =>
          def.storage === 'class' &&
          !DRAWN_BY_COMPANION.has(def.id) &&
          appliesToTag(def, tag) &&
          (source.mode === 'free' || isTokenCapable(def)),
      ),
    }))
    .filter((entry) => entry.properties.length > 0)
    // A stable sort: for text, Typography first and Layout after the look; others keep the catalogue order.
    .sort((left, right) => sectorOrderFor(tag)(left.sector.id, right.sector.id));

  // The filter matches a property's name in either language, its id, or its
  // sector's name (which keeps the whole sector). A row drawn with a companion
  // (padding with margin) also matches on the companion's name.
  const needle = searchable(query.trim());
  const matches = (labelsOf: { readonly en: string; readonly ar: string }, id: string) =>
    searchable(`${labelsOf.en} ${labelsOf.ar} ${id}`).includes(needle);
  const shown =
    needle === ''
      ? available
      : available
          .map(({ sector, properties }) => ({
            sector,
            properties: matches(sector.labels, sector.id)
              ? properties
              : properties.filter((def) => {
                  const companionId = COMPANION_OF[def.id];
                  return (
                    matches(def.labels, def.id) ||
                    (companionId !== undefined && matches(STYLE_PROPERTIES[companionId].labels, companionId))
                  );
                }),
          }))
          .filter((entry) => entry.properties.length > 0);

  const setHereIn = (properties: readonly { readonly id: StylePropertyId }[]) =>
    properties.reduce((total, def) => {
      const companionId = COMPANION_OF[def.id];
      const own = viewOf(def.id).origin === 'here' ? 1 : 0;
      const companion = companionId !== undefined && viewOf(companionId).origin === 'here' ? 1 : 0;
      return total + own + companion;
    }, 0);

  return (
    <div
      ref={rootRef}
      className="bldr-style-panel"
      role="group"
      aria-label={labels.panel}
      data-mode={source.mode}
      dir={labels.locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="bldr-style-panel__header">
        {onBucketChange === undefined || onStateChange === undefined ? null : (
          <BucketStateSwitcher
            bucket={bucket}
            state={state}
            onBucketChange={onBucketChange}
            onStateChange={onStateChange}
            customWidths={customWidths}
            freeWidth={freeWidth}
            dir={labels.locale === 'ar' ? 'rtl' : 'ltr'}
            labels={labels.switcher}
          />
        )}
        <StylePanelFilter query={query} onQueryChange={setQuery} labels={labels} />
      </div>
      {refusal === null ? null : (
        <p className="bldr-style-panel__refusal" role="alert">
          {refusal}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="bldr-style-panel__empty" role="status">
          {labels.noMatches(query.trim())}
        </p>
      ) : null}
      {shown.map(({ sector, properties }) => {
        const count = setHereIn(properties);
        return (
          <StyleSector
            key={sector.id}
            title={sector.labels[labels.locale]}
            sectorId={sector.id}
            expanded={needle !== '' || open.has(sector.id)}
            count={count}
            countLabel={labels.setHere(count)}
            onToggle={() => {
              if (needle !== '') {
                // A filtered sector is open because it matched: closing it ends the search there.
                setQuery('');
                const next = new Set(open);
                next.delete(sector.id);
                setOpen(next);
                onActiveSectorChange?.(null);
                return;
              }
              const next = new Set(open);
              if (next.has(sector.id)) next.delete(sector.id);
              else next.add(sector.id);
              setOpen(next);
              onActiveSectorChange?.(next.has(sector.id) ? sector.id : null);
            }}
          >
            {properties.map((def) => {
              const companionId = COMPANION_OF[def.id];
              return (
                <StyleProperty
                  key={def.id}
                  view={viewOf(def.id)}
                  companion={companionId === undefined ? undefined : viewOf(companionId)}
                  mode={source.mode}
                  dir={dir}
                  tokens={tokens}
                  palette={source.mode === 'free' ? palette : []}
                  contrastWith={contrastFor(def.id)}
                  labels={labels}
                  onEdit={write}
                  onPreview={preview}
                />
              );
            })}
          </StyleSector>
        );
      })}
      {children}
    </div>
  );
}
