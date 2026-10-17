import { useId } from 'react';

import {
  CUSTOM_CODE_TIMELINE_RECIPE_INFO,
  CUSTOM_CODE_TIMELINE_RECIPES,
  isCustomCodeTimelineRecipe,
} from '@craftkit/builder-schema';

import { ChoiceGroup } from '../ChoiceGroup';
import { clearTimelinePatch, recipePatch, type TimelinePatch } from './timeline-patch';
import {
  TIMELINE_RECIPE_PICKER_LABELS_EN,
  type TimelineRecipePickerLabels,
} from './TimelineRecipePicker.labels';

import './TimelineRecipePicker.css';

export interface TimelineRecipePickerProps {
  /** The element's attributes (document truth). */
  readonly attributes: Readonly<Record<string, string | undefined>>;
  /** Writes the patch as ONE labelled transaction. */
  readonly onCommit: (patch: TimelinePatch, label: string) => void;
  /** The editor UI direction (arrow keys follow it). */
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: TimelineRecipePickerLabels | undefined;
}

/**
 * The named scroll-timeline picker (media-motion DESIGN §C.4). It chooses a
 * recipe NAME from the closed list — with the schema's bilingual label and
 * a one-line description — and whether it follows the scrollbar. A fixed
 * runner plays the name (anime.js, MIT, since 2026-10-08 — GSAP's licence
 * forbids it in a visual animation builder); names only, no timeline,
 * keyframe or easing-curve editing here.
 *
 * Choosing a recipe removes any CSS preset (`data-ck-motion`) in the same
 * patch: the two never drive one element.
 */
export function TimelineRecipePicker({
  attributes,
  onCommit,
  dir = 'ltr',
  disabled = false,
  labels = TIMELINE_RECIPE_PICKER_LABELS_EN,
}: TimelineRecipePickerProps) {
  const ids = { select: useId(), description: useId() };
  const raw = attributes['data-ck-timeline'];
  const recipe = raw !== undefined && isCustomCodeTimelineRecipe(raw) ? raw : undefined;
  const scrubValue = attributes['data-ck-scrub'];
  const scrub = scrubValue === 'true' ? true : scrubValue === 'false' ? false : undefined;
  const description =
    recipe === undefined ? labels.noneDescription : CUSTOM_CODE_TIMELINE_RECIPE_INFO[recipe].description[labels.locale];

  return (
    <div className="bldr-timeline-picker" dir={dir}>
      <label className="bldr-timeline-picker__label" htmlFor={ids.select}>
        {labels.recipe}
      </label>
      <select
        id={ids.select}
        className="bldr-timeline-picker__select"
        value={recipe ?? ''}
        disabled={disabled}
        aria-describedby={ids.description}
        onChange={(event) => {
          const next = event.target.value;
          if (next === '') {
            if (raw !== undefined) onCommit(clearTimelinePatch(attributes), labels.changed);
            return;
          }
          if (!isCustomCodeTimelineRecipe(next)) return;
          const patch = recipePatch(next, scrub);
          if (patch !== undefined) onCommit(patch, labels.changed);
        }}
      >
        <option value="">{labels.none}</option>
        {CUSTOM_CODE_TIMELINE_RECIPES.map((name) => (
          <option key={name} value={name}>
            {CUSTOM_CODE_TIMELINE_RECIPE_INFO[name].label[labels.locale]}
          </option>
        ))}
      </select>
      <p id={ids.description} className="bldr-timeline-picker__description">
        {description}
      </p>
      <span className="bldr-timeline-picker__label" aria-hidden="true">
        {labels.scrub}
      </span>
      <ChoiceGroup
        label={labels.scrub}
        dir={dir}
        disabled={disabled || recipe === undefined}
        value={scrubValue === 'true' || scrubValue === 'false' ? scrubValue : 'default'}
        options={(['default', 'true', 'false'] as const).map((value) => ({ value, label: labels.scrubs[value] }))}
        onChange={(value) => {
          if (recipe === undefined) return;
          onCommit({ 'data-ck-scrub': value === 'default' ? null : value }, labels.changed);
        }}
      />
    </div>
  );
}
