/**
 * Floating-toolbar placement (009 contract §2).
 *
 * The bar this must clear is not "good enough" — it is what a positioning
 * library gives a professional editor. Feature-for-feature against
 * @floating-ui/dom's middleware stack:
 *
 *   flip    → prefer above, FLIP below (GrapesJS clamps instead and covers the
 *             very content the toolbar belongs to — the failure this exists to
 *             avoid), and when neither side fits, take the side with more room.
 *   shift   → SLIDE along the inline axis with padding, rather than snapping to
 *             an edge, so the toolbar stays visually attached to its anchor.
 *   arrow   → the pointer keeps aiming at the anchor centre after a shift,
 *             clamped to the toolbar's own inner range.
 *   hide    → when the anchor is scrolled out of the frame's visible area the
 *             toolbar reports hidden instead of floating over nothing.
 *   inline  → a text selection spanning LINES is many rects, not one union box;
 *             placing above uses the FIRST line, below uses the LAST, which is
 *             what makes a multi-line selection feel right.
 *
 * What we deliberately do NOT inherit from a library: an ancestor-walking
 * auto-update loop. Our invalidation is observer-driven through the rect index
 * (resize, frame scroll, viewport resize, direction, structural mutation) —
 * strictly better than polling, and the reason Puck's 10 fps rect poll is
 * unnecessary here. And cross-frame correctness is ours by construction rather
 * than by a library's frameElement walk, which is exactly where that library's
 * own iframe support needed four rounds of patches (research R0/R2).
 *
 * PURE: no DOM, no globals, no time — every case is table-testable (SC-004).
 */

export interface FloatingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloatingAnchor {
  /** The union box — always present, and the only thing a block anchor needs. */
  box: FloatingBox;
  /**
   * Per-line rects for a text selection. When a selection spans lines its union
   * box is a rectangle the text does not actually occupy; the toolbar should
   * hug the line it opens against.
   */
  rects?: FloatingBox[];
}

export interface FloatingPlacement {
  /** Layer-local position for the toolbar's top-left corner. */
  x: number;
  y: number;
  placement: 'above' | 'below';
  /** The anchor is not visible in the frame — the caller should not show. */
  hidden: boolean;
  /**
   * Arrow centre offset from the toolbar's inline origin, already clamped so
   * the pointer never leaves the toolbar's own edge radius.
   */
  arrowOffset: number;
}

export interface FloatingInput {
  /**
   * Anchor in LAYER-LOCAL space. Layer-local IS preview-local (005 §1), so
   * anchors need no conversion — only the flip DECISION consults host space.
   */
  anchor: FloatingBox | FloatingAnchor;
  /** Measured toolbar size. */
  size: { width: number; height: number };
  /** The frame's box in HOST space: the one reason host space is consulted. */
  frame: FloatingBox;
  /** Host viewport, for the flip decision. */
  viewport: { width: number; height: number };
  /**
   * The frame's VISIBLE area in layer-local space (its scroll viewport). An
   * anchor outside it has been scrolled away — the toolbar reports hidden.
   * Defaults to the frame's own size.
   */
  visible?: { width: number; height: number };
  dir: 'ltr' | 'rtl';
  /**
   * Preferred side. `above` suits a selection bubble (never cover what is
   * being formatted); `below` suits the block action bar — the selection
   * outline's name chip owns the block's top edge, and stacking the bar there
   * collides with it. Either side still FLIPS when host space runs out.
   * Default: `above`.
   */
  prefer?: 'above' | 'below';
  /**
   * Inline alignment: `center` suits a selection bubble (what every editor
   * does), `start` suits a bar attached to a block — and "start" is the
   * READING start, so it mirrors under RTL. Default: `center`.
   */
  align?: 'center' | 'start';
  /** Distance between the anchor edge and the toolbar (default 8). */
  gap?: number;
  /** Collision padding kept between the toolbar and the frame edges (default 4). */
  padding?: number;
  /** Arrow width, if the toolbar draws one (default 0 — no arrow). */
  arrowSize?: number;
}

const clamp = (value: number, low: number, high: number): number =>
  high < low ? low : Math.min(Math.max(value, low), high);

const asAnchor = (anchor: FloatingBox | FloatingAnchor): FloatingAnchor =>
  'box' in anchor ? anchor : { box: anchor };

/** Rects that carry real geometry, in document order. */
function usableRects(anchor: FloatingAnchor): FloatingBox[] {
  const rects = (anchor.rects ?? []).filter((rect) => rect.width > 0 || rect.height > 0);
  return rects.length > 0 ? rects : [anchor.box];
}

export function positionFloating(input: FloatingInput): FloatingPlacement {
  const gap = input.gap ?? 8;
  const padding = input.padding ?? 4;
  const arrowSize = input.arrowSize ?? 0;
  const { size, frame, viewport, dir } = input;
  const anchor = asAnchor(input.anchor);
  const union = anchor.box;
  const rects = usableRects(anchor);
  const visible = input.visible ?? { width: frame.width, height: frame.height };

  // hide — the anchor has been scrolled out of the frame's visible area. Report
  // it rather than floating a toolbar over content the user cannot see.
  const hidden =
    union.y + union.height < 0 ||
    union.y > visible.height ||
    union.x + union.width < 0 ||
    union.x > visible.width;

  // flip — decided in HOST space: the anchor's host-space top is the frame's own
  // offset plus the anchor's layer-local top.
  const first = rects[0] ?? union;
  const last = rects[rects.length - 1] ?? union;
  const needed = size.height + gap;
  const roomAbove = frame.y + first.y - needed;
  /*
    Room below is measured against the CLIP BOX, not the window. `viewport` is
    `window.innerHeight`, which counts the status bar and everything else
    outside the canvas as free space — so for the last block on a scrolled page
    this said there was room, the bar was placed below, and the layer clipped it.
    Measured: the bar landed at y 955-989 while its clipping parent ended at 963,
    leaving a 4px sliver of each 26px button visible and the status bar catching
    every click aimed at the centre. `visible` IS the clip box, which is why it
    was already passed in; it was only ever consulted for the off-screen test.
  */
  const clipBottom = Math.min(viewport.height, frame.y + visible.height);
  const roomBelow = clipBottom - (frame.y + last.y + last.height + needed);
  const placeAbove =
    (input.prefer ?? 'above') === 'above'
      ? roomAbove >= 0
        ? true
        : roomBelow >= 0
          ? false
          : roomAbove >= roomBelow
      : roomBelow >= 0
        ? false
        : roomAbove >= 0
          ? true
          : roomAbove >= roomBelow;

  // inline — hug the line the toolbar actually opens against, not the union.
  const line = placeAbove ? first : last;
  const y = placeAbove ? line.y - size.height - gap : line.y + line.height + gap;

  // shift — slide along the inline axis inside the frame, keeping `padding`.
  const preferred =
    (input.align ?? 'center') === 'center'
      ? line.x + line.width / 2 - size.width / 2
      : dir === 'rtl'
        ? line.x + line.width - size.width
        : line.x;
  const low = padding;
  const high = frame.width - size.width - padding;
  const x = clamp(preferred, low, high);

  // arrow — keep pointing at the line's centre after the shift, but never past
  // the toolbar's own corner radius.
  const arrowTarget = line.x + line.width / 2 - x;
  const arrowLimit = Math.max(arrowSize, 0);
  const arrowOffset =
    arrowSize <= 0
      ? 0
      : clamp(arrowTarget, arrowLimit, Math.max(size.width - arrowLimit, arrowLimit));

  /*
    And clamp against the clip box at BOTH ends. Only the top was clamped, so
    nothing stopped a placement running past the bottom edge into a region the
    layer does not paint.
  */
  const maxY = Math.max(visible.height - size.height, 0);

  return {
    x,
    y: Math.min(Math.max(y, 0), maxY),
    placement: placeAbove ? 'above' : 'below',
    hidden,
    arrowOffset,
  };
}
