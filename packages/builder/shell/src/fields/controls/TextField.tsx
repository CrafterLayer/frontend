import { useState } from 'react';

import type { FieldControlProps } from './field-control-props';

/**
 * Default control for string schemas: commits every change (one tx per commit,
 * the spec's own rapid-edit rule). A local draft covers the states the door
 * rejects (e.g. emptying a `.min(1)` prop): the input keeps showing what was
 * typed while the rejection reason is described — no snap-back mid-edit.
 * Document truth stays authoritative: any incoming value change that is NOT
 * this draft's own committed text (undo, redo, external write) drops the draft
 * in the same render pass, so the restored value always shows through.
 */
export function TextField({
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
  placeholder,
}: FieldControlProps) {
  const [draft, setDraft] = useState<string | null>(null);

  // Adjust-during-render (the documented derived-state form): an external
  // value transition invalidates the draft before anything paints.
  const [prevValue, setPrevValue] = useState<unknown>(value);
  if (!Object.is(value, prevValue)) {
    setPrevValue(value);
    if (draft !== null && !Object.is(value, draft)) {
      setDraft(null);
    }
  }

  const documentText = typeof value === 'string' ? value : '';
  return (
    <input
      id={controlId}
      className="bldr-field__input"
      type="text"
      // Mixed ar/en content: the box follows its own text's direction, so an
      // English line on an Arabic page keeps its full stop at the end.
      dir="auto"
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
        onChange(text);
      }}
    />
  );
}
