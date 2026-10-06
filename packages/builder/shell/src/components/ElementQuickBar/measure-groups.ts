/*
  ── Folding groups that do not fit (style-manager DESIGN.md §A.6) ────────────

  Onlook's idea — a toolbar that measures itself and moves the groups that no
  longer fit into an overflow menu — written fresh here (no code copied, so no
  vendor entry): a pure function over measured widths, so it is table-testable
  and the component only has to measure.

  Groups fold from the END: the first groups of a kind are its most used
  (size before line height, background before shadow), so they stay on the bar.
*/

export interface FoldInput {
  /** Each group button's measured inline size, in bar order. */
  readonly widths: readonly number[];
  /** The inline size the bar may take. */
  readonly available: number;
  /** Space the bar always needs besides the groups (More, Edit with AI, padding, separators). */
  readonly reserved: number;
  /** The overflow button's own inline size, needed only when something folds. */
  readonly overflow: number;
  /** Gap between buttons. */
  readonly gap?: number | undefined;
}

/**
 * How many groups stay on the bar. Every group when they all fit; otherwise
 * as many as fit beside the overflow button (never fewer than zero). Unknown
 * geometry (a non-positive `available`, or no widths measured) keeps every
 * group: an unmeasured bar must never hide controls it could have shown.
 */
export function visibleGroupCount(input: FoldInput): number {
  const { widths, available, reserved, overflow } = input;
  const gap = input.gap ?? 0;
  if (!(available > 0) || widths.length === 0 || widths.some((width) => !(width > 0))) {
    return widths.length;
  }
  const total = widths.reduce((sum, width) => sum + width + gap, 0);
  if (reserved + total <= available) return widths.length;
  let used = reserved + overflow + gap;
  let count = 0;
  for (const width of widths) {
    if (used + width + gap > available) break;
    used += width + gap;
    count += 1;
  }
  return count;
}
