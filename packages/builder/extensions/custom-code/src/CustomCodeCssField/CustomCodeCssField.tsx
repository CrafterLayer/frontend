import { useId, useState } from 'react';

import type { FieldProps } from '@craftkit/builder-schema';

import { findCssRejection } from '../CustomCodeBlock/scope-css';

import './CustomCodeCssField.css';

/**
 * The Inspector control for region- and page-scoped CSS.
 *
 * The whole value of this control over a plain text input is that it applies
 * the SAME refusal list the renderer does, at the moment of typing. Without
 * it, a person writes `@import url(…)`, the field stores it happily, and the
 * stylesheet silently never renders — a value in the document that does
 * nothing, with no explanation anywhere. Refusing here turns that into a
 * sentence next to the box.
 *
 * It refuses rather than strips, deliberately: silently removing a line a
 * person wrote is a worse betrayal than declining to store it, because they
 * will not notice until the page is wrong.
 */
export default function CustomCodeCssField({ value, onChange, disabled }: FieldProps) {
  const errorId = useId();
  const hintId = useId();
  const stored = typeof value === 'string' ? value : '';
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  const commit = (next: string): void => {
    const rejection = findCssRejection(next);
    if (rejection !== undefined) {
      setError(
        `${rejection.reason} is not allowed here: it reaches outside this page or executes. Remove it to save.`,
      );
      return;
    }
    setError(undefined);
    setDraft(null);
    onChange(next);
  };

  return (
    <div className="bldr-cc-css">
      <textarea
        className="bldr-cc-css__source"
        spellCheck={false}
        rows={8}
        value={draft ?? stored}
        disabled={disabled ?? false}
        aria-label="Custom CSS"
        aria-describedby={error === undefined ? hintId : `${hintId} ${errorId}`}
        aria-invalid={error !== undefined}
        placeholder={'.ck-name { … }\n@keyframes float { … }'}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(undefined);
        }}
        // One undo entry per edit session, not per keystroke.
        onBlur={(event) => {
          if (event.target.value !== stored) commit(event.target.value);
        }}
      />
      <p className="bldr-cc-css__hint" id={hintId}>
        Scoped to this block. Hook elements with <code>ck-</code> class names, and reach colours
        through <code>var(--t-accent)</code> so the page still re-themes.
      </p>
      {error === undefined ? null : (
        <p className="bldr-cc-css__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
