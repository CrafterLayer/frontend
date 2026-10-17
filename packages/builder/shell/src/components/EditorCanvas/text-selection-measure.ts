import type {
  InlineSelectionAnchor,
  InlineSelectionAnchorReport,
  InlineSelectionAnchorSource,
} from '@craftkit/builder-schema';

/** A finite, non-empty rect as plain numbers, or null when the box is degenerate. */
export function inlineRectOf(rect: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>) {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** A current editor reports a deferred source; a pre-closeout one, a frozen anchor. */
export function isInlineSelectionAnchorSource(
  report: InlineSelectionAnchorReport,
): report is InlineSelectionAnchorSource {
  return 'measure' in report;
}

/**
 * Compatibility measurement for a pre-closeout editor that reports a frozen
 * anchor. Current editors provide their own deferred source instead. Either
 * way, the rect APIs are reached only when the anchor channel flushes.
 */
export function measureTextSelection(
  frameDocument: Document,
  editedElement: HTMLElement,
): InlineSelectionAnchor | null {
  const selection = frameDocument.getSelection();
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (
    range.collapsed ||
    (range.commonAncestorContainer !== editedElement &&
      !editedElement.contains(range.commonAncestorContainer))
  ) {
    return null;
  }
  const measuredRange = range as unknown as {
    getClientRects?: (() => ArrayLike<DOMRect>) | undefined;
    getBoundingClientRect?: (() => DOMRect) | undefined;
  };
  const rects = Array.from(measuredRange.getClientRects?.call(range) ?? [])
    .map(inlineRectOf)
    .filter((rect): rect is NonNullable<typeof rect> => rect !== null);
  const bounding = measuredRange.getBoundingClientRect?.call(range);
  const box = bounding === undefined ? null : inlineRectOf(bounding);
  const [firstRect, ...remainingRects] = rects;
  let union: InlineSelectionAnchor['box'];
  if (box !== null) {
    union = box;
  } else {
    if (firstRect === undefined) {
      return null;
    }
    union = remainingRects.reduce((current, rect) => {
      const right = Math.max(current.x + current.width, rect.x + rect.width);
      const bottom = Math.max(current.y + current.height, rect.y + rect.height);
      const x = Math.min(current.x, rect.x);
      const y = Math.min(current.y, rect.y);
      return { x, y, width: right - x, height: bottom - y };
    }, firstRect);
  }
  return rects.length === 0 ? { box: union } : { box: union, rects };
}
