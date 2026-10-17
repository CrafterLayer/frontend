import { useState } from 'react';

export interface TokenDraftFieldProps {
  readonly id: string;
  /** The committed value: the field's truth. */
  readonly value: string;
  /** Called once per edit, on blur or Enter, and only when the value changed. */
  readonly onCommit: (value: string) => void;
  readonly disabled?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly describedBy?: string | undefined;
  readonly className?: string | undefined;
  /** Values like `0 1px 2px …` and `#0f766e` read left to right in any UI. */
  readonly dir?: 'ltr' | 'rtl' | 'auto' | undefined;
}

/**
 * A text field that holds a DRAFT while a person types and commits once.
 *
 * ## Draft discipline: an external write always wins
 *
 * A controlled input that dispatched per keystroke would fill history with an
 * entry per character, so the field keeps a draft. But the draft is not the
 * truth: if the committed value changes underneath — a generation lands, an
 * undo runs — the draft is discarded and the field shows what the site holds.
 * Losing a few keystrokes is the smaller harm than committing over a change
 * the person never saw.
 *
 * Adjusted DURING render (React's documented pattern for resetting state on a
 * prop change), so a stale draft never paints for a frame.
 */
export function TokenDraftField({
  id,
  value,
  onCommit,
  disabled = false,
  invalid = false,
  describedBy,
  className,
  dir = 'ltr',
}: TokenDraftFieldProps) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }

  const commit = (): void => {
    const next = draft.trim();
    if (next === '' || next === value) return;
    onCommit(next);
  };

  return (
    <input
      id={id}
      className={className}
      dir={dir}
      value={draft}
      disabled={disabled}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape') {
          setDraft(value);
        }
      }}
    />
  );
}
