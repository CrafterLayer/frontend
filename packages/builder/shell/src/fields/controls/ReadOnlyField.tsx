import { useFieldLabels } from '../field-services-context';
import { summarizeValue } from '../value-summary';
import type { FieldControlProps } from './field-control-props';

/**
 * Fallback for schemas nothing matches: a HUMAN SUMMARY of the value ("3
 * items", "4 fields", "Empty", the text itself), visible and labelled, never
 * editable (FR-004 — a read-only display rather than nothing).
 *
 * It used to show `JSON.stringify(value)`, which is how a stored rich-text
 * document reached a person as `{"type":"doc","content":[…` (owner screenshot,
 * 2026-10-06). Raw JSON is never shown anywhere in the Inspector now.
 */
export function ReadOnlyField({ value, controlId, describedBy }: FieldControlProps) {
  const labels = useFieldLabels();
  return (
    <input
      id={controlId}
      className="bldr-field__input bldr-field__input--readonly"
      type="text"
      readOnly
      dir="auto"
      value={summarizeValue(value, labels)}
      aria-describedby={describedBy}
    />
  );
}
