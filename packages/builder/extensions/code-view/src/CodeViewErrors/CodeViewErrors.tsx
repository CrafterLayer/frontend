import type { RefObject } from 'react';

import type { TransformParseError } from '../worker/protocol';
import './CodeViewErrors.css';

export interface CodeViewErrorsProps {
  /** Stable id used by the owning textarea while diagnostics exist. */
  id?: string | undefined;
  /** The diagnostics from ONE settled parse. */
  errors: readonly TransformParseError[];
  /** Exact textarea draft whose one-based lines the diagnostics name. */
  source: string;
  /** The panel's real textarea — choosing a diagnostic returns focus there. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** One summary for the whole parse, never one live region per diagnostic. */
  announcement: string;
  /** Changes repeated announcement text without exposing a spoken counter. */
  announcementNonce: number;
}

interface SourceRange {
  readonly start: number;
  readonly end: number;
}

/** Select a one-based source line, excluding its line ending. */
function rangeForLine(source: string, line: number): SourceRange {
  if (line <= 1) {
    const ending = source.indexOf('\n');
    return { start: 0, end: ending === -1 ? source.length : ending };
  }

  let start = 0;
  for (let current = 1; current < line; current += 1) {
    const ending = source.indexOf('\n', start);
    if (ending === -1) {
      return { start: source.length, end: source.length };
    }
    start = ending + 1;
  }
  const ending = source.indexOf('\n', start);
  return { start, end: ending === -1 ? source.length : ending };
}

/**
 * The panel's diagnostic navigator (011 contract p6). Diagnostics stay a
 * native list; activation returns to the ONE textarea and selects the exact
 * source line. The polite output belongs to the settled PARSE, not to each
 * mapped error, so assistive technology hears one useful summary instead of a
 * burst of repeated alerts.
 */
export function CodeViewErrors({
  id,
  errors,
  source,
  textareaRef,
  announcement,
  announcementNonce,
}: CodeViewErrorsProps) {
  const liveText = `${announcement}${announcementNonce % 2 === 1 ? '​' : ''}`;
  return (
    <div className="bldr-code-errors">
      <output
        className="bldr-code-errors__announcement"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Code view messages"
      >
        {liveText}
      </output>
      {errors.length === 0 ? null : (
        <ul id={id} className="bldr-code-errors__list" aria-label="Code errors" role="list">
          {errors.map((error, index) => (
            <li
              key={`${String(error.line)}:${error.message}:${String(index)}`}
              className="bldr-code-errors__item"
            >
              <button
                type="button"
                className="bldr-code-errors__button"
                aria-label={`Line ${String(error.line)}: ${error.message}`}
                onClick={() => {
                  const textarea = textareaRef.current;
                  if (textarea === null) {
                    return;
                  }
                  const range = rangeForLine(source, error.line);
                  textarea.focus({ preventScroll: true });
                  textarea.setSelectionRange(range.start, range.end);
                }}
              >
                <span className="bldr-code-errors__line" aria-hidden="true">
                  {error.line}
                </span>
                <span>{error.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
