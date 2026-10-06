import { useId } from 'react';

import {
  SPACING_SCALE,
  STYLE_PROPERTIES,
  type StyleBoxSide,
  type StyleCorner,
  type StylePropertyId,
  type StyleSide,
  type StyleValue,
} from '@craftkit/builder-schema';

import { BOX_SIDES } from '../../style-manager/box-sides';
import { BoxModelControl } from '../../style-manager/controls/BoxModelControl';
import { ChoiceGroup } from '../../style-manager/controls/ChoiceGroup';
import { CORNERS, CornerRadiusControl } from '../../style-manager/controls/CornerRadiusControl';
import {
  MOTION_PRESET_GRID_LABELS_AR,
  MOTION_PRESET_GRID_LABELS_EN,
  MotionPresetGrid,
} from '../../style-manager/controls/MotionPresetGrid';
import {
  namedModel,
  numberModel,
  ScaleNumberControl,
  spacingModel,
} from '../../style-manager/controls/ScaleNumberControl';
import { StyleColorControl, type ColorSwatch } from '../../style-manager/controls/StyleColorControl';
import type { ElementBarModel, QuickWriteResult } from './element-bar-model';
import type { ElementQuickBarLabels } from './ElementQuickBar.labels';

export interface QuickPropertyControlProps {
  readonly property: StylePropertyId;
  readonly model: ElementBarModel;
  readonly labels: ElementQuickBarLabels;
  /** The editor UI direction (arrow keys in radio groups follow it). */
  readonly dir: 'ltr' | 'rtl';
  readonly colorTokens: readonly ColorSwatch[];
  readonly palette?: readonly ColorSwatch[] | undefined;
  /** Every write's outcome, so the bar can announce a refusal. */
  readonly onResult: (result: QuickWriteResult) => void;
}

/** Choice groups beyond this many options read better as a select. */
const MAX_RADIO_OPTIONS = 6;

function keywordOf(value: StyleValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.kind === 'keyword') return value.keyword;
  if (value.kind === 'token') return value.token;
  if (value.kind === 'raw') return value.css;
  return value.id;
}

/**
 * One catalogue row (§A.4) as a compact control, chosen from the row's own
 * declaration: colour → the P6 colour control; sided → the box model or the
 * corner control; options → a choice group (or a select when long); a scale →
 * the scale number control or a token select. Attribute rows (direction, hover
 * preset) write attributes, never classes (§A.2).
 */
export function QuickPropertyControl({
  property,
  model,
  labels,
  dir,
  colorTokens,
  palette,
  onResult,
}: QuickPropertyControlProps) {
  const selectId = useId();
  const def = STYLE_PROPERTIES[property];
  const label = def.labels[labels.locale];
  const current = model.read(property);

  const commit = (value: StyleValue | null, side?: StyleSide) => {
    onResult(model.apply([side === undefined ? { property, value } : { property, value, side }], label));
  };

  if (def.storage === 'attribute') {
    const attribute = def.attribute ?? '';
    if (property === 'motion') {
      return (
        <MotionPresetGrid
          kind="motion"
          value={model.attribute(attribute)}
          dir={dir}
          labels={labels.locale === 'ar' ? MOTION_PRESET_GRID_LABELS_AR : MOTION_PRESET_GRID_LABELS_EN}
          onSelect={(preset) => {
            onResult(model.setAttributes({ [attribute]: preset }, label));
          }}
        />
      );
    }
    if (property === 'hoverMotion') {
      return (
        <MotionPresetGrid
          kind="hover"
          value={model.attribute(attribute)}
          dir={dir}
          labels={labels.locale === 'ar' ? MOTION_PRESET_GRID_LABELS_AR : MOTION_PRESET_GRID_LABELS_EN}
          onSelect={(preset) => {
            onResult(model.setAttributes({ [attribute]: preset }, label));
          }}
        />
      );
    }
    const options = (def.options ?? []).filter((option) => option.legacy !== true);
    return (
      <ChoiceGroup
        label={label}
        dir={dir}
        options={options.map((option) => ({
          value: option.value,
          label: option.labels?.[labels.locale] ?? option.value,
        }))}
        value={model.attribute(attribute) ?? (property === 'direction' ? 'auto' : undefined)}
        onChange={(value) => {
          // `auto` is the absence of the attribute: it inherits the page's direction.
          onResult(
            model.setAttributes({ [attribute]: property === 'direction' && value === 'auto' ? null : value }, label),
          );
        }}
      />
    );
  }

  if (def.control === 'color') {
    return (
      <StyleColorControl
        label={label}
        value={current.value}
        mixed={current.mixed}
        mode="free"
        tokens={colorTokens}
        palette={palette}
        dir={dir}
        onCommit={(value) => {
          commit(value);
        }}
      />
    );
  }

  if (def.sides === 'box') {
    const scale = def.scale ?? SPACING_SCALE;
    const scaleModel = def.tokens === 'spacing' ? spacingModel(scale) : numberModel(scale, 'px');
    const sides = Object.fromEntries(
      BOX_SIDES.map((side: StyleBoxSide) => {
        const reading = model.readSide(property, side);
        return [side, { value: reading.value, origin: reading.origin, mixed: reading.mixed }];
      }),
    ) as Record<StyleBoxSide, { value: StyleValue | undefined; origin: typeof current.origin; mixed: boolean }>;
    return (
      <BoxModelControl
        rings={[
          {
            id: property,
            label,
            sides,
            model: scaleModel,
            units: def.units,
            ...(def.negative === true ? { min: -999 } : {}),
          },
        ]}
        dir={model.pageDir}
        mode="free"
        onCommit={(_ring, side, value) => {
          commit(value, side);
        }}
      />
    );
  }

  if (def.sides === 'corners') {
    const corners = Object.fromEntries(
      CORNERS.map((corner: StyleCorner) => {
        const reading = model.readSide(property, corner);
        return [corner, { value: reading.value, origin: reading.origin, mixed: reading.mixed }];
      }),
    ) as Record<StyleCorner, { value: StyleValue | undefined; origin: typeof current.origin; mixed: boolean }>;
    return (
      <CornerRadiusControl
        corners={corners}
        model={namedModel(def.scale ?? [])}
        units={def.units}
        dir={model.pageDir}
        mode="free"
        onCommit={(side, value) => {
          commit(value, side);
        }}
      />
    );
  }

  const options = (def.options ?? []).filter((option) => option.legacy !== true);
  if (options.length > 0 && options.length <= MAX_RADIO_OPTIONS) {
    return (
      <ChoiceGroup
        label={label}
        dir={dir}
        mixed={current.mixed}
        mixedLabel={labels.mixed}
        options={options.map((option) => ({
          value: option.value,
          label: option.labels?.[labels.locale] ?? option.value,
        }))}
        value={keywordOf(current.value)}
        onChange={(value) => {
          commit({ kind: 'keyword', keyword: value });
        }}
      />
    );
  }

  if (def.tokens === 'spacing') {
    return (
      <ScaleNumberControl
        label={label}
        value={current.value}
        mixed={current.mixed}
        model={spacingModel(def.scale ?? SPACING_SCALE)}
        units={def.units}
        mode="free"
        onCommit={(value) => {
          commit(value);
        }}
      />
    );
  }

  // A long option list, or a named scale (size, line height, aspect, shadow):
  // a native select keeps the popover compact and is fully keyboard-operable.
  const entries: readonly { value: string; label: string; kind: 'keyword' | 'token' }[] =
    options.length > 0
      ? options.map((option) => ({
          value: option.value,
          label: option.labels?.[labels.locale] ?? option.value,
          kind: 'keyword' as const,
        }))
      : (def.scale ?? []).map((token) => ({ value: token, label: token, kind: 'token' as const }));
  const shown = current.mixed ? '' : (keywordOf(current.value) ?? '');
  const known = entries.some((entry) => entry.value === shown);
  return (
    <div className="bldr-quick-bar__field">
      <label className="bldr-quick-bar__field-label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className="bldr-quick-bar__select"
        value={shown}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (next === '') {
            commit(null);
            return;
          }
          const entry = entries.find((candidate) => candidate.value === next);
          commit(
            entry?.kind === 'keyword'
              ? { kind: 'keyword', keyword: next }
              : { kind: 'token', token: next },
          );
        }}
      >
        <option value="">{current.mixed ? labels.mixed : labels.reset}</option>
        {!known && shown !== '' ? <option value={shown}>{shown}</option> : null}
        {entries.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>
    </div>
  );
}
