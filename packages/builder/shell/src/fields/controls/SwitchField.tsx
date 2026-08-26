import type { FieldControlProps } from './field-control-props';

/** Default control for boolean schemas: a native checkbox exposed as a switch. */
export function SwitchField({
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
}: FieldControlProps) {
  return (
    <input
      id={controlId}
      className="bldr-field__switch"
      type="checkbox"
      role="switch"
      checked={value === true}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(event) => {
        onChange(event.target.checked);
      }}
    />
  );
}
