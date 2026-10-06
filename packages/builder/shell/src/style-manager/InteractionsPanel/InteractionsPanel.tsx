import { useId, useState } from 'react';

import {
  CUSTOM_CODE_MOTION_DELAYS,
  CUSTOM_CODE_MOTION_EASES,
  CUSTOM_CODE_MOTION_TRIGGERS,
  type CustomCodeMotionTrigger,
} from '@craftkit/builder-schema';

import { ChoiceGroup } from '../controls/ChoiceGroup';
import { MotionPresetGrid } from '../controls/MotionPresetGrid';
import { TimelineRecipePicker } from '../controls/TimelineRecipePicker'; // media-motion (2026-10-06)
import type { StyleApplyResult } from '../style-source';
import {
  INTERACTIONS_PANEL_LABELS_EN,
  type InteractionsPanelLabels,
} from './InteractionsPanel.labels';
import {
  clearMotionPatch,
  hasAnimation,
  presetPatch,
  triggerOf,
  triggerPatch,
  type AttributePatch,
  type MotionAttributes,
} from './motion-attributes';
import { TIMELINE_PANEL_ENABLED } from './timeline-flag'; // media-motion (2026-10-06)

import './InteractionsPanel.css';

export interface InteractionsPanelProps {
  /** The element's current attributes (document truth). */
  readonly attributes: MotionAttributes;
  /** A container (it has children) gets the stagger row. */
  readonly isContainer: boolean;
  /** Ids in the same tree a click may play (`data-ck-target`). */
  readonly targetIds: readonly string[];
  /** Writes the attribute patch as ONE labelled transaction. */
  readonly onCommit: (attributes: AttributePatch, label: string) => StyleApplyResult;
  /** Replays the animation on the canvas (sets `data-ck-play`); never a document write. */
  readonly onPreview?: (() => void) | undefined;
  readonly announce?: ((text: string) => void) | undefined;
  /** The editor UI direction. */
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly labels?: InteractionsPanelLabels | undefined;
  /**
   * media-motion (2026-10-06): show the "Cinematic motion" section even while
   * `TIMELINE_PANEL_ENABLED` is off — for stories and tests only (GSAP licence,
   * DESIGN §C.1.2; see timeline-flag.ts).
   */
  readonly timelinePanel?: boolean | undefined;
}

const SIZES = ['sm', 'md', 'lg'] as const;

/**
 * The Interactions tab (style-manager DESIGN.md §B.4): when an animation
 * plays (trigger), which one (named preset cards filtered by trigger), how
 * (speed, delay, easing, distance, once, stagger, click target), a separate
 * hover effect, a Preview that replays it on the canvas, and Remove, which
 * clears every motion attribute in one transaction. Every row is one write.
 */
export function InteractionsPanel({
  attributes,
  isContainer,
  targetIds,
  onCommit,
  onPreview,
  announce,
  dir = 'ltr',
  labels = INTERACTIONS_PANEL_LABELS_EN,
  timelinePanel = false,
}: InteractionsPanelProps) {
  const [pendingTrigger, setPendingTrigger] = useState<CustomCodeMotionTrigger>(triggerOf(attributes));
  const [refusal, setRefusal] = useState<string | null>(null);
  const ids = { delay: useId(), ease: useId(), target: useId() };
  const motion = attributes['data-ck-motion'];
  const hover = attributes['data-ck-hover'];
  const trigger = motion === undefined ? pendingTrigger : triggerOf(attributes);
  const tunable = hasAnimation(attributes);
  // media-motion (2026-10-06): the named scroll timeline is flag-gated (GSAP licence, DESIGN §C.1.2).
  const showTimeline = TIMELINE_PANEL_ENABLED || timelinePanel;

  const write = (patch: AttributePatch, what: string) => {
    if (Object.keys(patch).length === 0) return;
    const result = onCommit(patch, what);
    if (result.ok) {
      setRefusal(null);
      announce?.(labels.updated(what));
    } else {
      setRefusal(result.message);
      announce?.(result.message);
    }
  };
  const param = (name: string, value: string | null, what: string) => {
    write({ [name]: value }, what);
  };

  return (
    <div className="bldr-interactions" role="group" aria-label={labels.panel}>
      {refusal === null ? null : (
        <p className="bldr-interactions__refusal" role="alert">
          {refusal}
        </p>
      )}
      <div className="bldr-interactions__row">
        <span className="bldr-interactions__label">{labels.trigger}</span>
        <ChoiceGroup
          label={labels.trigger}
          dir={dir}
          value={trigger}
          options={CUSTOM_CODE_MOTION_TRIGGERS.map((value) => ({ value, label: labels.triggers[value] }))}
          onChange={(value) => {
            const next = value as CustomCodeMotionTrigger;
            setPendingTrigger(next);
            if (motion !== undefined) write(triggerPatch(attributes, next), labels.trigger);
          }}
        />
      </div>

      <div className="bldr-interactions__row">
        <span className="bldr-interactions__label">{labels.animation}</span>
        <MotionPresetGrid
          kind="motion"
          trigger={trigger}
          value={motion}
          dir={dir}
          labels={labels.grid}
          onSelect={(preset) => {
            const patch = presetPatch(attributes, 'data-ck-motion', preset, trigger);
            // media-motion (2026-10-06): a CSS preset and a scroll timeline never drive one element.
            if (preset !== null && attributes['data-ck-timeline'] !== undefined) {
              patch['data-ck-timeline'] = null;
              if (attributes['data-ck-scrub'] !== undefined) patch['data-ck-scrub'] = null;
            }
            write(patch, labels.animation);
          }}
        />
      </div>

      <fieldset className="bldr-interactions__params" disabled={!tunable}>
        <legend className="bldr-interactions__legend">
          {tunable ? labels.params : labels.paramsNeedAnimation}
        </legend>
        <ChoiceGroup
          label={labels.speed}
          dir={dir}
          disabled={!tunable}
          value={attributes['data-ck-speed'] ?? 'normal'}
          options={(['slow', 'normal', 'fast'] as const).map((value) => ({ value, label: labels.speeds[value] }))}
          onChange={(value) => {
            param('data-ck-speed', value === 'normal' ? null : value, labels.speed);
          }}
        />
        <label className="bldr-interactions__field" htmlFor={ids.delay}>
          <span>{labels.delay}</span>
          <select
            id={ids.delay}
            className="bldr-interactions__select"
            value={attributes['data-ck-delay'] ?? '0'}
            onChange={(event) => {
              param('data-ck-delay', event.target.value === '0' ? null : event.target.value, labels.delay);
            }}
          >
            {CUSTOM_CODE_MOTION_DELAYS.map((step) => (
              <option key={step} value={step}>
                {labels.delayStep(Number(step))}
              </option>
            ))}
          </select>
        </label>
        <label className="bldr-interactions__field" htmlFor={ids.ease}>
          <span>{labels.ease}</span>
          <select
            id={ids.ease}
            className="bldr-interactions__select"
            value={attributes['data-ck-ease'] ?? 'standard'}
            onChange={(event) => {
              param('data-ck-ease', event.target.value === 'standard' ? null : event.target.value, labels.ease);
            }}
          >
            {CUSTOM_CODE_MOTION_EASES.map((ease) => (
              <option key={ease} value={ease}>
                {labels.eases[ease]}
              </option>
            ))}
          </select>
        </label>
        <ChoiceGroup
          label={labels.distance}
          dir={dir}
          disabled={!tunable}
          value={attributes['data-ck-distance'] ?? 'md'}
          options={SIZES.map((value) => ({ value, label: labels.sizes[value] }))}
          onChange={(value) => {
            param('data-ck-distance', value === 'md' ? null : value, labels.distance);
          }}
        />
        <label className="bldr-interactions__check">
          <input
            type="checkbox"
            checked={attributes['data-ck-once'] !== 'false'}
            onChange={(event) => {
              param('data-ck-once', event.target.checked ? null : 'false', labels.once);
            }}
          />
          <span>{labels.once}</span>
        </label>
        {isContainer ? (
          <ChoiceGroup
            label={labels.stagger}
            dir={dir}
            disabled={!tunable}
            value={attributes['data-ck-stagger'] ?? 'md'}
            options={SIZES.map((value) => ({ value, label: labels.sizes[value] }))}
            onChange={(value) => {
              param('data-ck-stagger', value === 'md' ? null : value, labels.stagger);
            }}
          />
        ) : null}
        {trigger === 'click' ? (
          <label className="bldr-interactions__field" htmlFor={ids.target}>
            <span>{labels.target}</span>
            <select
              id={ids.target}
              className="bldr-interactions__select"
              value={attributes['data-ck-target'] ?? ''}
              onChange={(event) => {
                param('data-ck-target', event.target.value === '' ? null : event.target.value, labels.target);
              }}
            >
              <option value="">{labels.targetSelf}</option>
              {targetIds.map((id) => (
                <option key={id} value={id}>
                  #{id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </fieldset>

      <div className="bldr-interactions__row">
        <span className="bldr-interactions__label">{labels.hover}</span>
        <MotionPresetGrid
          kind="hover"
          value={hover}
          dir={dir}
          labels={labels.grid}
          onSelect={(preset) => {
            write(presetPatch(attributes, 'data-ck-hover', preset, trigger), labels.hover);
          }}
        />
      </div>

      {showTimeline ? (
        <section className="bldr-interactions__row" aria-label={labels.cinematic}>
          <h4 className="bldr-interactions__label bldr-interactions__heading">{labels.cinematic}</h4>
          <p className="bldr-interactions__hint">{labels.cinematicHint}</p>
          <TimelineRecipePicker
            attributes={attributes}
            dir={dir}
            labels={labels.timeline}
            onCommit={(patch, what) => {
              write({ ...patch }, what);
            }}
          />
        </section>
      ) : null}

      <div className="bldr-interactions__actions">
        <button
          type="button"
          className="bldr-interactions__button"
          disabled={!tunable || onPreview === undefined}
          onClick={onPreview}
        >
          {labels.preview}
        </button>
        <button
          type="button"
          className="bldr-interactions__button"
          disabled={!tunable}
          onClick={() => {
            const result = onCommit(clearMotionPatch(attributes), labels.remove);
            if (result.ok) {
              setRefusal(null);
              announce?.(labels.removed);
            } else {
              setRefusal(result.message);
            }
          }}
        >
          {labels.remove}
        </button>
      </div>
    </div>
  );
}
