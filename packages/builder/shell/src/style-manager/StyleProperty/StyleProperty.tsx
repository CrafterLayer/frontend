import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import {
  isCustomCodeEffect,
  type CustomCodeEffect,
  type StyleBoxSide,
  type StyleCorner,
  type StyleMode,
  type StyleOption,
  type StyleValue,
} from '@craftkit/builder-schema';

import { BorderSidesControl } from '../controls/BorderSidesControl';
import { BoxModelControl, type BoxRing, type BoxSideState } from '../controls/BoxModelControl';
import { ChoiceGroup, type ChoiceOption } from '../controls/ChoiceGroup';
import { ColorField } from '../controls/ColorField';
import { CornerRadiusControl } from '../controls/CornerRadiusControl';
import { EffectPresetPicker } from '../controls/EffectPresetPicker';
import { GridTracksControl } from '../controls/GridTracksControl';
import { ScaleNumberControl } from '../controls/ScaleNumberControl';
import { OptionIcon, optionGlyph } from '../controls/OptionIcon';
import { SegmentedChoice } from '../controls/SegmentedChoice';
import { joinLayers, splitLayers, StackControl } from '../controls/StackControl';
import type { ColorSwatch } from '../controls/StyleColorControl';
import { TransformOriginControl } from '../controls/TransformOriginControl';
import { ValueSourceDot } from '../controls/ValueSourceDot';
import { keywordsFor, modelFor, unitsFor } from '../property-models';
import type { StylePanelLabels } from '../StylePanel/StylePanel.labels';
import type { PropertyView, SlotView } from '../style-view';
import type { StyleEdit } from './style-edit';

import './StyleProperty.css';

export interface StylePropertyProps {
  readonly view: PropertyView;
  /** Rendered together: margin with padding, border style with border width. */
  readonly companion?: PropertyView | undefined;
  readonly mode: StyleMode;
  /** The PAGE direction: sides, corners and origins mirror to it. */
  readonly dir: 'ltr' | 'rtl';
  readonly tokens: readonly ColorSwatch[];
  readonly palette: readonly ColorSwatch[];
  /** The colour this one is read against, for the contrast check. */
  readonly contrastWith?: string | undefined;
  /** One person-visible action: the panel writes these edits as one transaction. */
  readonly onEdit: (edits: readonly StyleEdit[], propertyLabel: string) => void;
  readonly onPreview?: ((edits: readonly StyleEdit[] | null) => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels: StylePanelLabels;
}

const BOX_SLOTS: readonly StyleBoxSide[] = ['block-start', 'block-end', 'inline-start', 'inline-end'];
const CORNER_SLOTS: readonly StyleCorner[] = ['start-start', 'start-end', 'end-start', 'end-end'];

function sideState(slot: SlotView | undefined): BoxSideState {
  return slot === undefined
    ? { value: undefined, origin: 'unset' }
    : { value: slot.value, origin: slot.origin, mixed: slot.mixed };
}

function boxSides(view: PropertyView): Record<StyleBoxSide, BoxSideState> {
  return Object.fromEntries(BOX_SLOTS.map((slot) => [slot, sideState(view.sides[slot])])) as Record<
    StyleBoxSide,
    BoxSideState
  >;
}

function cornerSides(view: PropertyView): Record<StyleCorner, BoxSideState> {
  return Object.fromEntries(CORNER_SLOTS.map((slot) => [slot, sideState(view.sides[slot])])) as Record<
    StyleCorner,
    BoxSideState
  >;
}

function keywordOf(value: StyleValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.kind === 'keyword' ? value.keyword : value.kind === 'token' ? value.token : undefined;
}

function optionLabel(option: StyleOption, locale: 'en' | 'ar'): string {
  return option.labels?.[locale] ?? option.value;
}

/** The row's options, each with its glyph when the panel has one. */
function choiceOptions(
  property: string,
  options: readonly StyleOption[],
  locale: 'en' | 'ar',
): readonly ChoiceOption[] {
  return options.map((option) => {
    const label = optionLabel(option, locale);
    return optionGlyph(property, option.value) === undefined
      ? { value: option.value, label }
      : { value: option.value, label, icon: <OptionIcon property={property} value={option.value} /> };
  });
}

/** Segments that fit beside the label column; a longer row of glyphs takes the full width. */
const MAX_INLINE_SEGMENTS = 6;
/** Text choices that fit beside the label column. */
const MAX_INLINE_TEXT_CHOICES = 3;

/**
 * How a row is laid out: `inline` puts the label and a compact control side
 * by side on one 28px line; `block` gives a large control (box model, stack,
 * a long text choice) the whole width under its label.
 */
export type StyleRowLayout = 'inline' | 'block';

function layoutOf(control: string, id: string, choices: readonly ChoiceOption[]): StyleRowLayout {
  switch (control) {
    case 'radio': {
      const glyphs = choices.filter((choice) => choice.icon !== undefined).length;
      if (glyphs > 0) return glyphs > MAX_INLINE_SEGMENTS ? 'block' : 'inline';
      return choices.length <= MAX_INLINE_TEXT_CHOICES ? 'inline' : 'block';
    }
    case 'select':
    case 'color':
      return 'inline';
    case 'number':
    case 'slider':
      return id === 'gridColumns' || id === 'gridRows' ? 'block' : 'inline';
    default:
      return 'block';
  }
}

/** A CSS image for a typed URL: `https://…` → `url(https://…)`; gradients pass through. */
function imageCss(text: string): string {
  const trimmed = text.trim();
  if (/^(?:url|linear-gradient|radial-gradient|conic-gradient)\(/u.test(trimmed)) return trimmed;
  return `url(${trimmed})`;
}

function urlOf(value: StyleValue | undefined): string {
  if (value?.kind !== 'raw') return '';
  const match = /^url\((.*)\)$/u.exec(value.css.trim());
  return match?.[1] ?? value.css;
}

/**
 * One row of the style panel: the property's name, its provenance dot (with
 * Reset), a custom-breakpoint badge when the family also lives at `sm:`/`xl:`,
 * and the control the catalogue names for it. The row only reports edits;
 * the panel adds bucket and state and writes them as one transaction.
 */
export function StyleProperty({
  view,
  companion,
  mode,
  dir,
  tokens,
  palette,
  contrastWith,
  onEdit,
  onPreview,
  disabled = false,
  labels,
}: StylePropertyProps) {
  const { def } = view;
  const name = def.labels[labels.locale];
  const labelId = useId();
  const [imageDraft, setImageDraft] = useState<string | null>(null);
  const edit = (value: StyleValue | null, side?: StyleEdit['side']) => {
    onEdit([side === undefined ? { property: def.id, value } : { property: def.id, value, side }], name);
  };
  const options = (def.options ?? []).filter((option) => option.legacy !== true);
  const choices = choiceOptions(def.id, options, labels.locale);
  const layout = layoutOf(def.control, def.id, choices);
  const model = modelFor(def);

  let control: ReactNode;
  switch (def.control) {
    case 'radio':
      control = choices.some((choice) => choice.icon !== undefined) ? (
        <SegmentedChoice
          label={name}
          dir={dir}
          disabled={disabled}
          mixed={view.mixed}
          mixedLabel={labels.mixed}
          moreLabel={labels.moreOptions(name)}
          value={keywordOf(view.value)}
          options={choices}
          onChange={(keyword) => {
            edit({ kind: 'keyword', keyword });
          }}
        />
      ) : (
        <ChoiceGroup
          label={name}
          dir={dir}
          disabled={disabled}
          mixed={view.mixed}
          mixedLabel={labels.mixed}
          value={keywordOf(view.value)}
          options={choices}
          onChange={(keyword) => {
            edit({ kind: 'keyword', keyword });
          }}
        />
      );
      break;
    case 'select': {
      if (def.id === 'transformOrigin') {
        control = (
          <TransformOriginControl
            value={keywordOf(view.value)}
            dir={dir}
            disabled={disabled}
            labels={labels.origin}
            onCommit={(keyword) => {
              edit({ kind: 'keyword', keyword });
            }}
          />
        );
        break;
      }
      const entries =
        options.length > 0
          ? options.map((option) => ({ id: `k:${option.value}`, label: optionLabel(option, labels.locale) }))
          : (def.scale ?? []).map((token) => ({ id: `t:${token}`, label: token }));
      const current =
        view.value?.kind === 'keyword'
          ? `k:${view.value.keyword}`
          : view.value?.kind === 'token'
            ? `t:${view.value.token}`
            : view.value?.kind === 'raw'
              ? `r:${view.value.css}`
              : '';
      control = (
        <span className="bldr-style-property__select-wrap">
          <select
            className="bldr-style-property__select"
            aria-labelledby={labelId}
            value={current}
            disabled={disabled}
            onChange={(event) => {
              const picked = event.target.value;
              if (picked === '') edit(null);
              else if (picked.startsWith('k:')) edit({ kind: 'keyword', keyword: picked.slice(2) });
              else if (picked.startsWith('t:')) edit({ kind: 'token', token: picked.slice(2) });
            }}
          >
            <option value="">{view.mixed ? labels.mixed : labels.unset}</option>
            {current.startsWith('r:') ? <option value={current}>{current.slice(2)}</option> : null}
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <svg className="bldr-style-property__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M4.5 6.5 8 10l3.5-3.5" />
          </svg>
        </span>
      );
      break;
    }
    case 'number':
    case 'slider':
      control =
        def.id === 'gridColumns' || def.id === 'gridRows' ? (
          <GridTracksControl
            label={name}
            value={view.value}
            mode={mode}
            disabled={disabled}
            labels={labels.grid}
            onCommit={(value) => {
              edit(value);
            }}
          />
        ) : (
          <ScaleNumberControl
            label={name}
            value={view.value}
            model={model}
            units={unitsFor(def)}
            keywords={keywordsFor(def, model)}
            mode={mode}
            min={def.negative === true ? undefined : 0}
            mixed={view.mixed}
            disabled={disabled}
            labels={labels.number}
            scrub
            onCommit={(value) => {
              edit(value);
            }}
            onPreview={
              onPreview === undefined
                ? undefined
                : (value) => {
                    onPreview(value === null ? null : [{ property: def.id, value }]);
                  }
            }
          />
        );
      break;
    case 'color':
      control = (
        <ColorField
          label={name}
          value={view.value}
          mode={mode}
          tokens={tokens}
          palette={def.palette === true ? palette : []}
          contrastWith={contrastWith}
          mixed={view.mixed}
          disabled={disabled}
          dir={dir}
          labels={labels.colorField}
          controlLabels={labels.color}
          onCommit={(value) => {
            edit(value);
          }}
          onPreview={
            onPreview === undefined
              ? undefined
              : (value) => {
                  onPreview(value === null ? null : [{ property: def.id, value }]);
                }
          }
        />
      );
      break;
    case 'composite': {
      if (def.id === 'padding' || def.id === 'inset') {
        const rings: BoxRing[] = [];
        if (companion !== undefined) {
          const outer = modelFor(companion.def);
          rings.push({
            id: companion.def.id,
            label: companion.def.labels[labels.locale],
            sides: boxSides(companion),
            model: outer,
            units: unitsFor(companion.def),
            keywords: keywordsFor(companion.def, outer),
            min: companion.def.negative === true ? -9999 : 0,
          });
        }
        rings.push({
          id: def.id,
          label: name,
          sides: boxSides(view),
          model,
          units: unitsFor(def),
          keywords: keywordsFor(def, model),
          min: def.negative === true ? -9999 : 0,
        });
        control = (
          <BoxModelControl
            rings={rings}
            dir={dir}
            mode={mode}
            disabled={disabled}
            labels={labels.box}
            fieldLabels={labels.number}
            onCommit={(ring, side, value) => {
              const property = ring === companion?.def.id ? companion.def : def;
              onEdit([{ property: property.id, value, side }], property.labels[labels.locale]);
            }}
            onPreview={
              onPreview === undefined
                ? undefined
                : (ring, side, value) => {
                    const property = ring === companion?.def.id ? companion.def.id : def.id;
                    onPreview(value === null ? null : [{ property, value, side }]);
                  }
            }
          />
        );
        break;
      }
      if (def.id === 'borderWidth') {
        control = (
          <BorderSidesControl
            widths={boxSides(view)}
            model={model}
            units={unitsFor(def)}
            borderStyle={keywordOf(companion?.value)}
            dir={dir}
            mode={mode}
            disabled={disabled}
            labels={labels.border}
            onCommitWidth={(side, value) => {
              edit(value, side);
            }}
            onCommitStyle={(keyword) => {
              if (companion === undefined) return;
              onEdit(
                [{ property: companion.def.id, value: { kind: 'keyword', keyword } }],
                companion.def.labels[labels.locale],
              );
            }}
          />
        );
        break;
      }
      if (def.id === 'borderRadius') {
        control = (
          <CornerRadiusControl
            corners={cornerSides(view)}
            model={model}
            units={unitsFor(def)}
            dir={dir}
            mode={mode}
            disabled={disabled}
            labels={labels.corners}
            fieldLabels={labels.number}
            onCommit={(side, value) => {
              edit(value, side);
            }}
          />
        );
        break;
      }
      // The gradient direction: its options are the logical directions, drawn as arrows.
      control = (
        <SegmentedChoice
          label={name}
          dir={dir}
          disabled={disabled}
          mixed={view.mixed}
          mixedLabel={labels.mixed}
          moreLabel={labels.moreOptions(name)}
          value={keywordOf(view.value)}
          options={choices}
          onChange={(keyword) => {
            edit({ kind: 'keyword', keyword });
          }}
        />
      );
      break;
    }
    case 'stack': {
      const layers = view.value?.kind === 'raw' ? splitLayers(view.value.css) : [];
      control = (
        <StackControl
          label={name}
          layers={layers}
          newLayer={def.id === 'textShadow' ? '0 1px 2px rgb(0 0 0 / 0.2)' : '0 4px 12px rgb(0 0 0 / 0.12)'}
          presets={(def.scale ?? []).map((token) => ({ id: token, label: token }))}
          preset={view.value?.kind === 'token' ? view.value.token : undefined}
          editable={mode === 'free'}
          disabled={disabled}
          labels={labels.stack}
          onCommit={(next) => {
            const css = joinLayers(next);
            edit(css === '' ? null : { kind: 'raw', css });
          }}
          onPreset={(preset) => {
            edit(preset === null ? null : { kind: 'token', token: preset });
          }}
        />
      );
      break;
    }
    case 'text':
      control = (
        <input
          className="bldr-style-property__text"
          type="url"
          aria-labelledby={labelId}
          placeholder={labels.imageUrl}
          value={imageDraft ?? urlOf(view.value)}
          disabled={disabled}
          onChange={(event) => {
            setImageDraft(event.target.value);
          }}
          onBlur={() => {
            if (imageDraft === null) return;
            const typed = imageDraft.trim();
            setImageDraft(null);
            if (typed === urlOf(view.value)) return;
            edit(typed === '' ? null : { kind: 'raw', css: imageCss(typed) });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      );
      break;
    case 'keyword': {
      const worn = (keywordOf(view.value) ?? '')
        .split(/\s+/u)
        .filter((word): word is CustomCodeEffect => isCustomCodeEffect(word));
      control = (
        <EffectPresetPicker
          value={worn}
          disabled={disabled}
          labels={labels.effects}
          onChange={(effects) => {
            edit(effects.length === 0 ? null : { kind: 'keyword', keyword: effects.join(' ') });
          }}
        />
      );
      break;
    }
  }

  return (
    <div
      className="bldr-style-property"
      data-property={def.id}
      data-layout={layout}
      data-origin={view.origin}
    >
      <div className="bldr-style-property__head">
        <span id={labelId} className="bldr-style-property__name" title={name}>
          {name}
        </span>
        <ValueSourceDot
          origin={view.origin}
          property={name}
          className={view.className}
          customBreakpoint={view.customBreakpoint}
          labels={labels.source}
          onReset={
            view.origin === 'here' && !disabled
              ? () => {
                  edit(null, def.sides === undefined ? undefined : 'all');
                }
              : undefined
          }
        />
      </div>
      <div className="bldr-style-property__control">{control}</div>
      {view.customBreakpoint ? (
        <span className="bldr-style-property__badge" title={labels.customBreakpointHint}>
          {labels.customBreakpoint}
        </span>
      ) : null}
    </div>
  );
}
