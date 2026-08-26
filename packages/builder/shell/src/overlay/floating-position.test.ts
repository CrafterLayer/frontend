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

  it('decides in HOST space, not frame space', () => {
    const anchor = { x: 100, y: 10, width: 80, height: 20 };
    expect(at({ anchor, frame: { x: 0, y: 0, width: 800, height: 600 } }).placement).toBe('below');
    expect(at({ anchor, frame: { x: 0, y: 300, width: 800, height: 600 } }).placement).toBe(
      'above',
    );
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
