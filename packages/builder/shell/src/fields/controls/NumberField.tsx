import { useState } from 'react';

import type { FieldControlProps } from './field-control-props';

/**
 * Default control for number schemas. A local draft makes "5." and an emptied
 * box typeable states; only finite parses commit. The draft is seeded on the
 * FIRST CHANGE (never on focus) and is dropped, in the same render pass,
 * whenever the incoming value is not this draft's own parse — so undo, redo,
 * and external writes always show through, even mid-focus (FR-003).
 */
export function NumberField({
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
  placeholder,
}: FieldControlProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const [prevValue, setPrevValue] = useState<unknown>(value);
  if (!Object.is(value, prevValue)) {
    setPrevValue(value);
    if (draft !== null && !Object.is(value, Number(draft))) {
      setDraft(null);
    }
  }

  const documentText = typeof value === 'number' ? String(value) : '';
  return (
    <input
      id={controlId}
      className="bldr-field__input"
      type="number"
      dir="ltr"
      value={draft ?? documentText}
      placeholder={placeholder}
      disabled={disabled}
      aria-describedby={describedBy}
      onBlur={() => {
        setDraft(null);
      }}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = Number(text);
        if (text !== '' && Number.isFinite(parsed)) {
          onChange(parsed);
        }
      }}
    />
  );
}
