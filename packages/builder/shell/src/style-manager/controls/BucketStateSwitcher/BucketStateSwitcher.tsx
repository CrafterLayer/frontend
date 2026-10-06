import { STYLE_STATES, type StyleBucket, type StyleState } from '@craftkit/builder-schema';

import { ChoiceGroup } from '../ChoiceGroup';
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
 * Both are plain radio groups; the panel writes every control's class at the
 * pair chosen here.
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
    { value: 'base', label: labels.desktop },
    { value: 'tablet', label: labels.tablet },
    { value: 'mobile', label: labels.mobile },
    ...widths.map((width) => ({ value: `max-${String(width)}`, label: labels.custom(width) })),
  ];

  return (
    <div className="bldr-bucket-state-switcher">
      <ChoiceGroup
        label={labels.bucketGroup}
        options={bucketOptions}
        value={current}
        dir={dir}
        onChange={(value) => {
          onBucketChange(decodeBucket(value));
        }}
      />
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
      <ChoiceGroup
        label={labels.stateGroup}
        options={states.map((value) => ({ value, label: labels.states[value] }))}
        value={state}
        dir={dir}
        onChange={(value) => {
          onStateChange(value as StyleState);
        }}
      />
    </div>
  );
}
