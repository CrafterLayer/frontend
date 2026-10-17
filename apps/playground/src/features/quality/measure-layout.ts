/**
 * The half of the quality gate that a document cannot answer.
 *
 * Overflow and overlap are questions about LAYOUT: whether a line of text runs
 * past the edge of its container at 360px, whether two absolutely positioned
 * cards land on top of each other at 1024. Nothing in the stored document says
 * so — the same tree is fine at one width and broken at another — so this half
 * measures a rendered page instead.
 *
 * Everything else lives in `@craftkit/builder`'s DOM-free quality module and is
 * shared with CI. The split is the design: a check goes there if a document can
 * answer it, and here if only a browser can.
 */

import type { QualityIssue } from '@craftkit/builder';

/** The widths a page is held to. A phone, a tablet, a laptop, a desktop. */
export const QUALITY_WIDTHS = [360, 768, 1024, 1440] as const;

export type QualityWidth = (typeof QUALITY_WIDTHS)[number];

export interface LayoutIssue extends QualityIssue {
  /** The width at which it was seen. The same page can be fine at another. */
  readonly width: QualityWidth;
}

/**
 * How far past its container an element may reach before it counts.
 *
 * Not zero. Sub-pixel rounding puts a `getBoundingClientRect` a fraction over
 * its parent's constantly, and a gate that fired on that would refuse every
 * page ever written. One CSS pixel is below what anyone can see and far above
 * what rounding produces.
 */
const OVERFLOW_TOLERANCE = 1;

/**
 * How much two boxes must share before they are "overlapping".
 *
 * Boxes touch all the time and legitimately: a shadow, a negative margin, a
 * deliberate overlap in a design. What is broken is text sitting ON other text,
 * so the threshold is a share of the SMALLER box's area rather than a count of
 * pixels — a 4px kiss between two big cards is nothing, and the same 4px
 * between two small labels is one covering the other.
 */
const OVERLAP_SHARE = 0.25;

/** Elements worth measuring: the ones that carry words a person must read. */
const MEASURED = 'p, h1, h2, h3, h4, h5, h6, li, a, button, img, figcaption, blockquote';

interface Box {
  readonly element: Element;
  readonly rect: DOMRect;
}

function area(rect: DOMRect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function intersection(left: DOMRect, right: DOMRect): number {
  const width = Math.min(left.right, right.right) - Math.max(left.left, right.left);
  const height = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
  return width <= 0 || height <= 0 ? 0 : width * height;
}

/**
 * Is this element inside something that SCROLLS sideways?
 *
 * A child wider than its container is broken only if nobody can reach the rest
 * of it. Inside a horizontally scrolling row — a carousel, a logo strip, a
 * table in a scroller — extending past the container is the pattern working,
 * not failing. The landing fixture has exactly one of these, and it made the
 * gate report three real, correctly-measured, entirely wrong failures.
 *
 * Walked up only as far as the ROOT: a scroller outside the region being
 * measured is not this page's doing, and letting one up there excuse everything
 * inside would silence the check completely.
 */
function insideAScroller(element: Element, root: Document | Element): boolean {
  const view = element.ownerDocument.defaultView;
  if (view === null) return false;
  let current: Element | null = element.parentElement;
  while (current !== null && current !== root) {
    const overflowX = view.getComputedStyle(current).overflowX;
    if (overflowX === 'auto' || overflowX === 'scroll') return true;
    current = current.parentElement;
  }
  return false;
}

/** The nearest ancestor that carries the block's own id, or nothing. */
function regionOf(element: Element): string | undefined {
  const host = element.closest('[data-ck]');
  return host?.getAttribute('data-ck') ?? undefined;
}

function describe(element: Element): string {
  const text = element.textContent.trim().slice(0, 40);
  return text === '' ? element.tagName.toLowerCase() : `"${text}"`;
}

/**
 * Measure one rendered page at one width.
 *
 * Takes a ROOT rather than mounting anything itself: the caller owns the frame,
 * its lifetime, and when layout has settled. A measurer that also managed a
 * frame would be untestable without one.
 *
 * The root matters, and getting it wrong is not a small mistake. Handed a whole
 * `Document` in a Storybook page, it measures Storybook's own toolbar and
 * sidebar alongside the page — and every one of them overflows a 360px
 * viewport, so the gate reports a wall of failures about furniture. Pass the
 * element the page was rendered into.
 */
export function measureLayout(
  root: Document | Element,
  width: QualityWidth,
): readonly LayoutIssue[] {
  const issues: LayoutIssue[] = [];

  /*
    The right EDGE, in the same coordinates the boxes are measured in.

    `getBoundingClientRect` is viewport-relative, and the rendered region is
    rarely at x=0 — in a Storybook canvas it sits behind a sidebar and some
    padding. Comparing a viewport-relative `right` against a bare `width`
    therefore counted the region's own left offset as overflow, and reported
    every element on a perfectly good page as running past the edge. Caught by
    the Chromium story; the jsdom tests could not see it, because they place
    every box at left 0 where the two coordinate systems coincide.
  */
  const origin = 'getBoundingClientRect' in root ? root.getBoundingClientRect().left : 0;
  const edge = origin + width;

  const boxes: Box[] = [...root.querySelectorAll(MEASURED)]
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter((box) => area(box.rect) > 0);

  /* ---- overflow: past the viewport, not merely past a parent ------------ */
  for (const box of boxes) {
    /*
      Measured against the VIEWPORT, not the element's own parent. A child
      wider than a parent that scrolls is a carousel, and refusing it would
      refuse a legitimate pattern; a child past the viewport is a page a person
      has to scroll sideways to read, which is the actual failure.
    */
    const past = box.rect.right - edge;
    if (past <= OVERFLOW_TOLERANCE) continue;
    if (insideAScroller(box.element, root)) continue;
    const region = regionOf(box.element);
    issues.push({
      check: 'overflow',
      severity: 'error',
      width,
      ...(region === undefined ? {} : { nodeId: region }),
      message: `${describe(box.element)} runs ${String(Math.round(past))}px past the edge at ${String(width)}px.`,
    });
  }

  /* ---- overlap: text sitting on text ------------------------------------ */
  for (let outer = 0; outer < boxes.length; outer += 1) {
    for (let inner = outer + 1; inner < boxes.length; inner += 1) {
      const left = boxes[outer];
      const right = boxes[inner];
      if (left === undefined || right === undefined) continue;
      /*
        A box inside another is nesting, not overlap — a link inside a paragraph
        shares all of its area with it by definition, and reporting that would
        drown the real ones.
      */
      if (left.element.contains(right.element) || right.element.contains(left.element)) continue;
      const shared = intersection(left.rect, right.rect);
      if (shared === 0) continue;
      const smaller = Math.min(area(left.rect), area(right.rect));
      if (smaller === 0 || shared / smaller < OVERLAP_SHARE) continue;
      const region = regionOf(left.element);
      issues.push({
        check: 'overlap',
        severity: 'error',
        width,
        ...(region === undefined ? {} : { nodeId: region }),
        message: `${describe(left.element)} and ${describe(right.element)} sit on top of each other at ${String(width)}px.`,
      });
    }
  }

  return issues;
}
