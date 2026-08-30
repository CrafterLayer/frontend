import {
  MOTION_DELAYS,
  MOTION_DURATIONS,
  MOTION_EASINGS,
  MOTION_STAGGERS,
  REVEAL_EFFECTS,
  SCROLL_EFFECTS,
  type MotionSpec,
} from '@craftkit/builder-schema';

import type { FieldControlProps } from '../controls/field-control-props';

import './MotionField.css';

/**
 * The control for a block's motion.
 *
 * Motion is one prop holding a small object, which the default resolution would
 * fall through to the read-only fallback — technically correct and useless. It
 * is declared as its own kind for the same reason `color-role` is: the schema
 * says "an object with six optional enums", and only the vocabulary knows that
 * those six are one decision a person makes together.
 *
 * Every control here is a SELECT over a closed vocabulary. There is deliberately
 * no free-text or numeric input anywhere: a duration in this product is a named
 * step, and a field that accepted `300` would be the one door through which a
 * literal could re-enter a document.
 */
interface MotionRowProps {
  id: string;
  label: string;
  hint: string;
  value: string | undefined;
  options: readonly string[];
  disabled: boolean | undefined;
  onSelect: (next: string | undefined) => void;
}

function MotionRow({ id, label, hint, value, options, disabled, onSelect }: MotionRowProps) {
  const hintId = `${id}-hint`;
  return (
    <div className="bldr-motion-field__row">
      <label className="bldr-motion-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="bldr-field__input"
        value={value ?? ''}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => {
          onSelect(event.target.value === '' ? undefined : event.target.value);
        }}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <p className="bldr-motion-field__hint" id={hintId}>
        {hint}
      </p>
    </div>
  );
}

export function MotionField({
  value,
  onChange,
  disabled,
  controlId,
  labelledBy,
}: FieldControlProps) {
  const spec: MotionSpec = typeof value === 'object' && value !== null ? value : {};
  const base = controlId ?? 'motion';

  /*
    A key set to undefined is REMOVED rather than stored as undefined. The
    document is JSON, `{ reveal: undefined }` is not representable in it, and a
    round trip would silently drop the key anyway — so the two states are made
    identical here rather than left to disagree.

    Built by FILTERING rather than by deleting: `delete draft[key]` on a
    computed key is refused by lint, and rebuilding says the same thing without
    mutating an object mid-construction.
  */
  const update = (key: keyof MotionSpec, next: string | boolean | undefined): void => {
    const kept = Object.entries(spec).filter(([entryKey]) => entryKey !== key);
    const draft = Object.fromEntries(next === undefined ? kept : [...kept, [key, next]]);
    onChange(draft);
  };

  return (
    <fieldset className="bldr-motion-field" disabled={disabled} aria-labelledby={labelledBy}>
      <MotionRow
        id={`${base}-reveal`}
        label="On entry"
        hint="Runs once as the section scrolls into view."
        value={spec.reveal}
        options={REVEAL_EFFECTS}
        disabled={disabled}
        onSelect={(next) => {
          update('reveal', next);
        }}
      />
      <MotionRow
        id={`${base}-scroll`}
        label="While scrolling"
        hint="Driven continuously by scroll position. 'pin' needs the motion extension."
        value={spec.scroll}
        options={SCROLL_EFFECTS}
        disabled={disabled}
        onSelect={(next) => {
          update('scroll', next);
        }}
      />
      <MotionRow
        id={`${base}-duration`}
        label="Duration"
        hint="A step on the theme's scale, never a number of milliseconds."
        value={spec.duration}
        options={MOTION_DURATIONS}
        disabled={disabled}
        onSelect={(next) => {
          update('duration', next);
        }}
      />
      <MotionRow
        id={`${base}-delay`}
        label="Delay"
        hint="How long the section waits before it starts."
        value={spec.delay}
        options={MOTION_DELAYS}
        disabled={disabled}
        onSelect={(next) => {
          update('delay', next);
        }}
      />
      <MotionRow
        id={`${base}-easing`}
        label="Easing"
        hint="'spring' is approximated in CSS unless the motion extension is loaded."
        value={spec.easing}
        options={MOTION_EASINGS}
        disabled={disabled}
        onSelect={(next) => {
          update('easing', next);
        }}
      />
      <MotionRow
        id={`${base}-stagger`}
        label="Stagger children"
        hint="Cascades this section's children. Needs the motion extension."
        value={spec.stagger}
        options={MOTION_STAGGERS}
        disabled={disabled}
        onSelect={(next) => {
          update('stagger', next);
        }}
      />
      <div className="bldr-motion-field__row">
        <label className="bldr-motion-field__label" htmlFor={`${base}-repeat`}>
          Replay on re-entry
        </label>
        <input
          id={`${base}-repeat`}
          className="bldr-field__switch"
          type="checkbox"
          checked={spec.repeat === true}
          disabled={disabled}
          aria-describedby={`${base}-repeat-hint`}
          onChange={(event) => {
            update('repeat', event.target.checked ? true : undefined);
          }}
        />
        <p className="bldr-motion-field__hint" id={`${base}-repeat-hint`}>
          Off by default. A page whose sections re-animate on the way back up reads as restless.
        </p>
      </div>
    </fieldset>
  );
}
