import { enumValuesOf } from '../resolve-field';
import type { FieldControlProps } from './field-control-props';

/** Default control for enum schemas: members derive from the schema itself. */
export function SelectField({
  schema,
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
}: FieldControlProps) {
  const members = enumValuesOf(schema);
  const current = typeof value === 'string' ? value : '';
  return (
    <select
      id={controlId}
      className="bldr-field__input"
      value={current}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {current === '' ? <option value="">—</option> : null}
      {members.map((member) => (
        <option key={member} value={member}>
          {member}
        </option>
      ))}
    </select>
  );
}
