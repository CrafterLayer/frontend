import type { FieldControlProps } from './field-control-props';

/**
 * Fallback for schemas nothing matches: the JSON value, visible and labeled,
 * never editable (FR-004 — a read-only display rather than nothing).
 */
export function ReadOnlyField({ value, controlId, describedBy }: FieldControlProps) {
  return (
    <input
      id={controlId}
      className="bldr-field__input bldr-field__input--readonly"
      type="text"
      readOnly
      value={value === undefined ? '' : JSON.stringify(value)}
      aria-describedby={describedBy}
    />
  );
}
