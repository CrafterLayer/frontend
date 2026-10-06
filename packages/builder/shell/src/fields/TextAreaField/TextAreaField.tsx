import { useLayoutEffect, useRef, useState } from 'react';

import type { FieldControlProps } from '../controls/field-control-props';
import './TextAreaField.css';

export type TextAreaFieldProps = FieldControlProps;

/**
 * The control for LONG text: a paragraph, a bio, an answer, a quote.
 *
 * Chosen from a schema fact, never a prop name — a string with no maximum, or
 * one longer than a line (> 120), or a property its block declares
 * `kind: 'multiline'`. A one-line `<input>` was the old answer for all of
 * them, and a 200-character body scrolled sideways inside a box one word wide.
 *
 * It grows with its content (CSS `field-sizing: content`, with a measured
 * fallback for engines without it), follows its own text direction
 * (`dir="auto"`), finishes on Enter with Shift+Enter for a line break (the
 * multiline rule of DESIGN §2.7), and keeps the TextField draft discipline: a door-rejected
 * state stays visible, and any external write (undo, redo) drops the draft.
 */
export function TextAreaField({
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
  placeholder,
}: TextAreaFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const [prevValue, setPrevValue] = useState<unknown>(value);
  if (!Object.is(value, prevValue)) {
    setPrevValue(value);
    if (draft !== null && !Object.is(value, draft)) {
      setDraft(null);
    }
  }

  const documentText = typeof value === 'string' ? value : '';
  const shown = draft ?? documentText;

  // Measured auto-grow for engines without `field-sizing`. Reading
  // scrollHeight after resetting the size is the standard measure; it runs
  // only when the text changes.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    if (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content')) return;
    element.style.blockSize = 'auto';
    if (element.scrollHeight > 0) {
      element.style.blockSize = `${String(element.scrollHeight)}px`;
    }
  }, [shown]);

  return (
    <textarea
      ref={ref}
      id={controlId}
      className="bldr-field__input bldr-textarea-field"
      rows={2}
      dir="auto"
      value={shown}
      placeholder={placeholder}
      disabled={disabled}
      aria-describedby={describedBy}
      onBlur={() => {
        setDraft(null);
      }}
      onKeyDown={(event) => {
        // The multiline rule of block-parts DESIGN §2.7: Enter FINISHES the
        // edit (the row commits a deferred draft on it), Shift+Enter is a line
        // break. Enter still reaches the row; only the newline is withheld.
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
        }
      }}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        onChange(text);
      }}
    />
  );
}
