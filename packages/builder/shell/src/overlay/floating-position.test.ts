import { describe, expect, it } from 'vitest';

import { positionFloating, type FloatingInput } from './floating-position';

const BASE: FloatingInput = {
  anchor: { x: 100, y: 200, width: 80, height: 20 },
  size: { width: 200, height: 32 },
  frame: { x: 0, y: 100, width: 800, height: 600 },
  viewport: { width: 1200, height: 900 },
  dir: 'ltr',
};

const at = (patch: Partial<FloatingInput>): ReturnType<typeof positionFloating> =>
  positionFloating({ ...BASE, ...patch });

describe('positionFloating — flip (009 contract §2 p1)', () => {
  it('prefers ABOVE the anchor with the gap applied', () => {
    const placed = at({});
    expect(placed.placement).toBe('above');
    expect(placed.y).toBe(200 - 32 - 8);
  });

  it('FLIPS below when there is no room above — the GrapesJS failure', () => {
    const placed = at({
      anchor: { x: 100, y: 4, width: 80, height: 20 },
      frame: { x: 0, y: 0, width: 800, height: 600 },
    });
    expect(placed.placement).toBe('below');
    expect(placed.y).toBe(4 + 20 + 8);
  });

  it('decides in HOST space too: a frame pushed above the window has no room there', () => {
    const anchor = { x: 100, y: 50, width: 80, height: 20 };
    expect(at({ anchor, frame: { x: 0, y: -30, width: 800, height: 600 } }).placement).toBe('below');
    expect(at({ anchor, frame: { x: 0, y: 0, width: 800, height: 600 } }).placement).toBe('above');
  });

  it('never covers the anchor: with no room above inside the clip box it flips below (fix pass)', () => {
    // Host room above (the frame sits 300px down the window), none inside the clip box.
    const placed = at({ anchor: { x: 100, y: 10, width: 80, height: 20 }, frame: { x: 0, y: 300, width: 800, height: 600 } });
    expect(placed.placement).toBe('below');
    expect(placed.y).toBeGreaterThanOrEqual(10 + 20);
  });

  it('with neither side fitting, takes the side with MORE room', () => {
    const squeezedTop = at({
      anchor: { x: 10, y: 4, width: 40, height: 10 },
      size: { width: 100, height: 200 },
      frame: { x: 0, y: 0, width: 200, height: 400 },
      viewport: { width: 300, height: 260 },
    });
    expect(squeezedTop.placement).toBe('below');

    const squeezedBottom = at({
      anchor: { x: 10, y: 230, width: 40, height: 10 },
      size: { width: 100, height: 200 },
      frame: { x: 0, y: 0, width: 200, height: 400 },
      viewport: { width: 300, height: 260 },
    });
    expect(squeezedBottom.placement).toBe('above');
  });
});

describe('positionFloating — shift (p2)', () => {
  it('centres on the anchor by default (the selection-bubble placement)', () => {
    expect(at({}).x).toBe(100 + 40 - 100);
  });

  it('`start` alignment attaches to the reading start — and MIRRORS under RTL', () => {
    const wide = { x: 100, y: 200, width: 400, height: 20 };
    expect(at({ anchor: wide, align: 'start', dir: 'ltr' }).x).toBe(100);
    expect(at({ anchor: wide, align: 'start', dir: 'rtl' }).x).toBe(100 + 400 - 200);
  });

  it('SLIDES with padding instead of snapping flush to the frame edge', () => {
    expect(at({ anchor: { x: 0, y: 200, width: 20, height: 20 } }).x).toBe(4);
    expect(at({ anchor: { x: 780, y: 200, width: 20, height: 20 } }).x).toBe(800 - 200 - 4);
    expect(at({ anchor: { x: 0, y: 200, width: 20, height: 20 }, padding: 16 }).x).toBe(16);
  });

  it('centring is direction-agnostic (a centred bubble reads the same both ways)', () => {
    const wide = { x: 100, y: 200, width: 400, height: 20 };
    expect(at({ anchor: wide, dir: 'ltr' }).x).toBe(at({ anchor: wide, dir: 'rtl' }).x);
  });
});

describe('positionFloating — inline: a selection spanning LINES (p4)', () => {
  const multiline = {
    box: { x: 20, y: 100, width: 400, height: 60 }, // the union — text never fills it
    rects: [
      { x: 300, y: 100, width: 120, height: 20 }, // tail of the first line
      { x: 20, y: 120, width: 400, height: 20 }, // a full middle line
      { x: 20, y: 140, width: 90, height: 20 }, // head of the last line
    ],
  };

  it('placing ABOVE hugs the FIRST line, not the union box', () => {
    const placed = at({ anchor: multiline, frame: { x: 0, y: 400, width: 800, height: 600 } });
    expect(placed.placement).toBe('above');
    expect(placed.y).toBe(100 - 32 - 8); // the first line's top
    expect(placed.x).toBe(300 + 60 - 100); // centred on the FIRST line
  });

  it('placing BELOW hugs the LAST line', () => {
    const below = at({
      anchor: multiline,
      size: { width: 200, height: 120 },
      frame: { x: 0, y: 0, width: 800, height: 600 },
    });
    expect(below.placement).toBe('below');
    expect(below.y).toBe(140 + 20 + 8); // the LAST line's bottom
    expect(below.x).toBe(4); // centred on the last line, slid inside the padding
  });

  it('ignores zero-area rects and falls back to the union box', () => {
    const placed = at({
      anchor: { box: { x: 100, y: 200, width: 80, height: 20 }, rects: [] },
    });
    expect(placed.x).toBe(at({}).x);
    expect(placed.y).toBe(at({}).y);
  });
});

describe('positionFloating — hide (p5)', () => {
  it('reports hidden when the anchor is scrolled out of the frame', () => {
    expect(at({ anchor: { x: 100, y: -80, width: 80, height: 20 } }).hidden).toBe(true);
    expect(at({ anchor: { x: 100, y: 700, width: 80, height: 20 } }).hidden).toBe(true);
    expect(at({ anchor: { x: -200, y: 200, width: 80, height: 20 } }).hidden).toBe(true);
    expect(at({ anchor: { x: 900, y: 200, width: 80, height: 20 } }).hidden).toBe(true);
  });

  it('respects an explicit visible area (a scrolled frame viewport)', () => {
    const anchor = { x: 100, y: 500, width: 80, height: 20 };
    expect(at({ anchor }).hidden).toBe(false);
    expect(at({ anchor, visible: { width: 800, height: 300 } }).hidden).toBe(true);
  });

  it('an anchor straddling the edge is still visible', () => {
    expect(at({ anchor: { x: 100, y: -10, width: 80, height: 20 } }).hidden).toBe(false);
  });
});

describe('positionFloating — arrow (p6)', () => {
  it('is zero when the toolbar draws no arrow', () => {
    expect(at({}).arrowOffset).toBe(0);
  });

  it('keeps pointing at the anchor centre after a shift', () => {
    const placed = at({ anchor: { x: 0, y: 200, width: 20, height: 20 }, arrowSize: 10 });
    expect(placed.x).toBe(4); // slid inside the padding…
    expect(placed.arrowOffset).toBe(10); // …and the arrow stays at the corner limit
  });

  it('never points past the toolbar edges', () => {
    const far = at({ anchor: { x: 700, y: 200, width: 20, height: 20 }, arrowSize: 12 });
    expect(far.arrowOffset).toBeGreaterThanOrEqual(12);
    expect(far.arrowOffset).toBeLessThanOrEqual(200 - 12);
  });

  it('aims at the anchor centre when the toolbar is not shifted', () => {
    const placed = at({ arrowSize: 8 });
    expect(placed.arrowOffset).toBe(100); // dead centre of a 200-wide toolbar
  });
});

describe('positionFloating — robustness (p3)', () => {
  it('keeps placement in authored pixels when the frame is visually scaled', () => {
    const placed = at({
      anchor: { x: 780, y: 200, width: 20, height: 20 },
      frame: { x: 100, y: 100, width: 400, height: 300 },
      visible: { width: 800, height: 600 },
      scale: 0.5,
    });
    expect(placed.x).toBe(800 - 200 - 4);
    expect(placed.y).toBe(200 - 32 - 8);
  });

  it('degenerate sizes never produce NaN or negative placements', () => {
    for (const size of [
      { width: 0, height: 0 },
      { width: 2000, height: 20 },
      { width: 200, height: 2000 },
    ]) {
      const placed = at({ size });
      expect(Number.isFinite(placed.x), JSON.stringify(size)).toBe(true);
      expect(Number.isFinite(placed.y), JSON.stringify(size)).toBe(true);
      expect(placed.x).toBeGreaterThanOrEqual(0);
      expect(placed.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('is pure — the same input always yields the same placement', () => {
    expect(at({})).toEqual(at({}));
  });
});

describe('prefer: below (the block action bar side)', () => {
  const base = {
    size: { width: 120, height: 32 },
    frame: { x: 0, y: 200, width: 800, height: 600 },
    viewport: { width: 1200, height: 1000 },
    dir: 'ltr' as const,
  };

  it('places below when there is room below', () => {
    const placed = positionFloating({
      ...base,
      anchor: { x: 100, y: 100, width: 200, height: 40 },
      prefer: 'below',
    });
    expect(placed.placement).toBe('below');
    expect(placed.y).toBe(148); // 100 + 40 + 8
  });

  it('FLIPS above when the frame bottom leaves no room below', () => {
    // Anchor bottom at host y = 200 + 560 + 40 = 800; viewport 1000 leaves 160
    // of room… so push further: viewport 820 leaves -20.
    const placed = positionFloating({
      ...base,
      viewport: { width: 1200, height: 820 },
      anchor: { x: 100, y: 560, width: 200, height: 40 },
      prefer: 'below',
    });
    expect(placed.placement).toBe('above');
    expect(placed.y).toBe(520); // 560 - 32 - 8
  });

  it('never places a toolbar past the bottom of the box that clips it', () => {
    /*
      The window is not the clip box. `viewport` here is 1000 tall, but the
      layer this toolbar lives in is the frame — 600 tall from host y 200, so it
      ends at 800. Measured in the real product before this was fixed: the block
      action bar for the last block on a scrolled page landed at y 955-989 while
      its clipping parent ended at 963. Four of each button's 26 pixels stayed
      visible; the status bar caught every click aimed at the centre and nothing
      happened, with no feedback.
    */
    const placed = positionFloating({
      ...base,
      anchor: { x: 100, y: 540, width: 200, height: 40 },
      prefer: 'below',
    });

    // Non-vacuous: the window genuinely has room, which is exactly the trap.
    const roomInWindow = base.viewport.height - (base.frame.y + 540 + 40 + 32 + 8);
    expect(roomInWindow).toBeGreaterThan(0);

    // Whatever it chooses, it must stay inside the 600-tall clip box.
    expect(placed.y).toBeGreaterThanOrEqual(0);
    expect(placed.y + base.size.height).toBeLessThanOrEqual(base.frame.height);
  });

  it('with no room on either side, takes the side with more room', () => {
    const placed = positionFloating({
      ...base,
      frame: { x: 0, y: -10, width: 800, height: 600 },
      viewport: { width: 1200, height: 60 },
      anchor: { x: 100, y: 20, width: 200, height: 20 },
      prefer: 'below',
    });
    // roomAbove = -10 + 20 - 40 = -30; roomBelow = 60 - (-10 + 40 + 40) = -10.
    expect(placed.placement).toBe('below');
  });
});

// ── block-parts (2026-10-06) ──
describe('positionFloating — keepClear, the two-row part quick bar (fix pass)', () => {
  const TWO_ROWS = { width: 260, height: 62 };
  const frame = { x: 0, y: 0, width: 1200, height: 900 };
  const viewport = { width: 1200, height: 900 };
  const intersects = (y: number, part: { y: number; height: number }) =>
    y < part.y + part.height && y + TWO_ROWS.height > part.y;

  it('sits wholly above a short part: bar.bottom <= part.top - gap', () => {
    const part = { x: 100, y: 499, width: 300, height: 15 }; // the FAQ question
    const placed = positionFloating({ ...BASE, anchor: part, size: TWO_ROWS, frame, viewport, keepClear: true });
    expect(placed.placement).toBe('above');
    expect(placed.y + TWO_ROWS.height).toBeLessThanOrEqual(part.y - 8);
  });

  it('flips below a part near the top of the clip box instead of clamping over it', () => {
    const part = { x: 100, y: 30, width: 300, height: 20 };
    const placed = positionFloating({
      ...BASE,
      anchor: part,
      size: TWO_ROWS,
      frame: { x: 0, y: 400, width: 1200, height: 900 },
      viewport,
      visible: { width: 1200, height: 80 },
      keepClear: true,
    });
    expect(placed.placement).toBe('below');
    expect(intersects(placed.y, part)).toBe(false);
    expect(placed.y).toBeGreaterThanOrEqual(part.y + part.height + 8);
  });

  it('without keepClear the old clamp still applies (text bubble, block bar)', () => {
    const part = { x: 100, y: 30, width: 300, height: 20 };
    const placed = positionFloating({
      ...BASE,
      anchor: part,
      size: TWO_ROWS,
      frame: { x: 0, y: 400, width: 1200, height: 900 },
      viewport,
      visible: { width: 1200, height: 80 },
    });
    expect(intersects(placed.y, part)).toBe(true);
  });
});
// ── /block-parts ──
