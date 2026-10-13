import type { ReactNode } from 'react';

/**
 * Two rules every block with in-place editing follows (block-parts DESIGN §2,
 * the coverage gate's swap render). Shared by the 2026-10-13 blocks; the
 * older blocks keep their local copies.
 */

/**
 * A text part shown in several places (an "Apply" beside every job, a
 * currency beside every amount). While it is edited in place its value is the
 * editor ELEMENT, which must render exactly once: the host instance shows it,
 * the others show nothing until the text is committed.
 */
export function sharedText(value: ReactNode, host: boolean): ReactNode {
  return host || typeof value === 'string' ? value : null;
}

/**
 * The committed text of a bound value, for an attribute or a derived string:
 * mid-edit the value is an element, and an element in an attribute would read
 * "[object Object]".
 */
export function committedText(value: ReactNode): string {
  return typeof value === 'string' ? value : '';
}

/** A stored optional line counts only when it holds text, or an editor element mid-edit. */
export function shows(value: ReactNode): boolean {
  return value !== undefined && value !== null && value !== '';
}
