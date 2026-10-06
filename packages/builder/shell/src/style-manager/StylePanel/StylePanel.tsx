import { useMemo, useState } from 'react';
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
import { intentsAt, StyleProperty, type StyleEdit } from '../StyleProperty';
import { StyleSector } from '../StyleSector';
import type { StyleSource } from '../style-source';
import { emptyView, viewStyles, type PropertyView } from '../style-view';
import { useStyleSourceClasses } from '../use-style-source';
import { STYLE_PANEL_SECTORS } from './sectors';
import { STYLE_PANEL_LABELS_EN, type StylePanelLabels } from './StylePanel.labels';

import './StylePanel.css';

const OPEN_BY_DEFAULT: readonly StyleSectorId[] = [
  'layout',
  'spacing',
  'size',
  'typography',
  'backgrounds',
  'borders',
  'effects',
];

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
}: StylePanelProps) {
  const classes = useStyleSourceClasses(source);
  const views = useMemo(
    () => viewStyles(classes, { bucket, state }, namedStyles),
    [classes, bucket, state, namedStyles],
  );
  const [open, setOpen] = useState<ReadonlySet<StyleSectorId>>(() => new Set(OPEN_BY_DEFAULT));
  const [refusal, setRefusal] = useState<string | null>(null);

  const viewOf = (id: StylePropertyId): PropertyView => views.get(id) ?? emptyView(STYLE_PROPERTIES[id]);
  const surface = tokens.find((swatch) => swatch.id === 'surface')?.css;
  const ink = tokens.find((swatch) => swatch.id === 'text')?.css;
  const background = resolveColor(viewOf('backgroundColor').value, tokens, palette) ?? surface;
  const foreground = resolveColor(viewOf('textColor').value, tokens, palette) ?? ink;
  const contrastFor = (id: StylePropertyId): string | undefined =>
    id === 'textColor' ? background : id === 'backgroundColor' ? foreground : undefined;

  const write = (edits: readonly StyleEdit[], property: string) => {
    const result = source.apply(intentsAt(edits, bucket, state, isBaseOnly), property);
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
          onPreview(edits === null ? null : intentsAt(edits, bucket, state, isBaseOnly));
        };

  const shown = STYLE_SECTORS.filter((sector) => sectors.includes(sector.id))
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
    .filter((entry) => entry.properties.length > 0);

  return (
    <div className="bldr-style-panel" role="group" aria-label={labels.panel} data-mode={source.mode}>
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
      {refusal === null ? null : (
        <p className="bldr-style-panel__refusal" role="alert">
          {refusal}
        </p>
      )}
      {shown.map(({ sector, properties }) => (
        <StyleSector
          key={sector.id}
          title={sector.labels[labels.locale]}
          expanded={open.has(sector.id)}
          onToggle={() => {
            const next = new Set(open);
            if (next.has(sector.id)) next.delete(sector.id);
            else next.add(sector.id);
            setOpen(next);
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
      ))}
      {children}
    </div>
  );
}
