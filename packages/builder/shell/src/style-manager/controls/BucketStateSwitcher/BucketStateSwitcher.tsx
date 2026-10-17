import { useId } from 'react';

import { STYLE_STATES, type StyleBucket, type StyleState } from '@craftkit/builder-schema';

import { ChoiceGroup } from '../ChoiceGroup';
import { OptionIcon } from '../OptionIcon';
import {
  BUCKET_STATE_SWITCHER_LABELS_EN,
  type BucketStateSwitcherLabels,
} from './BucketStateSwitcher.labels';
import { decodeBucket, encodeBucket, PRESET_DEVICE_WIDTHS } from './bucket-codec';

import './BucketStateSwitcher.css';

export interface BucketStateSwitcherProps {
  readonly bucket: StyleBucket;
  readonly state: StyleState;
  readonly onBucketChange: (bucket: StyleBucket) => void;
  readonly onStateChange: (state: StyleState) => void;
  /** Custom breakpoints already used on the page, so they can be picked again. */
  readonly customWidths?: readonly number[] | undefined;
  /**
   * The canvas width when the device is free-width. A width that is not one
   * of the presets offers "Edit at ≤ N px" (a `max-[Npx]:` bucket).
   */
  readonly freeWidth?: number | undefined;
  /** Which states to offer (all of them by default). */
  readonly states?: readonly StyleState[] | undefined;
  /** The editor UI direction (arrow keys follow it). */
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly labels?: BucketStateSwitcherLabels | undefined;
}

/**
 * Where an edit applies (style-manager DESIGN.md §A.5, §A.7): the screen-size
 * bucket (desktop-first: Desktop is unprefixed, Tablet `max-lg:`, Mobile
 * `max-md:`, custom `max-[Npx]:`) and the interaction state (Hover, Focus…).
 * One compact header line: the buckets are an icon radio group (custom
 * widths as text segments), the state a labelled menu. A bucket or state
 * other than the default tints the header, so an edit that will land on
 * Mobile · Hover never looks like a Desktop edit.
 */
export function BucketStateSwitcher({
  bucket,
  state,
  onBucketChange,
  onStateChange,
  customWidths = [],
  freeWidth,
  states = STYLE_STATES,
  dir = 'ltr',
  labels = BUCKET_STATE_SWITCHER_LABELS_EN,
}: BucketStateSwitcherProps) {
  const widths = [...new Set(customWidths)].sort((a, b) => b - a);
  const current = encodeBucket(bucket);
  const offerFree =
    freeWidth !== undefined &&
    Number.isInteger(freeWidth) &&
    freeWidth > 0 &&
    !PRESET_DEVICE_WIDTHS.includes(freeWidth) &&
    !widths.includes(freeWidth);
  if (typeof bucket !== 'string' && !widths.includes(bucket.maxWidth)) {
    widths.push(bucket.maxWidth);
  }

  const bucketOptions = [
    { value: 'base', label: labels.desktop, icon: <OptionIcon property="bucket" value="base" /> },
    { value: 'tablet', label: labels.tablet, icon: <OptionIcon property="bucket" value="tablet" /> },
    { value: 'mobile', label: labels.mobile, icon: <OptionIcon property="bucket" value="mobile" /> },
    ...widths.map((width) => ({ value: `max-${String(width)}`, label: labels.custom(width) })),
  ];
  const stateId = useId();

  return (
    <div
      className="bldr-bucket-state-switcher"
      data-state-active={state === 'default' ? undefined : ''}
      data-bucket-active={bucket === 'base' ? undefined : ''}
    >
      <div className="bldr-bucket-state-switcher__row">
        <ChoiceGroup
          label={labels.bucketGroup}
          options={bucketOptions}
          value={current}
          dir={dir}
          onChange={(value) => {
            onBucketChange(decodeBucket(value));
          }}
        />
        <span className="bldr-bucket-state-switcher__state">
          <label className="bldr-bucket-state-switcher__state-label" htmlFor={stateId}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M5 2.5v8.25l2-1.75 1.5 3.5 1.5-.7-1.5-3.3h2.75z" />
            </svg>
            <span className="bldr-bucket-state-switcher__visually-hidden">{labels.stateGroup}</span>
          </label>
          <select
            id={stateId}
            className="bldr-bucket-state-switcher__select"
            value={state}
            onChange={(event) => {
              onStateChange(event.target.value as StyleState);
            }}
          >
            {states.map((value) => (
              <option key={value} value={value}>
                {labels.states[value]}
              </option>
            ))}
          </select>
          <svg className="bldr-bucket-state-switcher__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M4.5 6.5 8 10l3.5-3.5" />
          </svg>
        </span>
      </div>
      {offerFree ? (
        <button
          type="button"
          className="bldr-bucket-state-switcher__edit-at"
          onClick={() => {
            onBucketChange({ maxWidth: freeWidth });
          }}
        >
          {labels.editAt(freeWidth)}
        </button>
      ) : null}
    </div>
  );
}
