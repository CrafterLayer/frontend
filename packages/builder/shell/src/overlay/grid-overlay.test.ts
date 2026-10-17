import { describe, expect, it } from 'vitest';

import { createGridOverlay, gridTrackBoxes, parseTrackList } from './grid-overlay';

const METRICS = {
  columns: [100, 200],
  rows: [50],
  columnGap: 10,
  rowGap: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

describe('grid overlay (DESIGN §E)', () => {
  it('parses resolved track lists and ignores unresolved ones', () => {
    expect(parseTrackList('120px 240.5px')).toEqual([120, 240.5]);
    expect(parseTrackList('none')).toEqual([]);
  });

  it('lays columns out in the page direction', () => {
    const rect = { x: 0, y: 0, width: 310, height: 50 };
    const ltr = gridTrackBoxes(rect, METRICS, 'ltr');
    const rtl = gridTrackBoxes(rect, METRICS, 'rtl');
    expect(ltr[0]).toMatchObject({ x: 0, width: 100 });
    expect(ltr[1]).toMatchObject({ x: 110, width: 200 });
    // RTL: the first column is the rightmost.
    expect(rtl[0]).toMatchObject({ x: 210, width: 100 });
    expect(rtl[1]).toMatchObject({ x: 0, width: 200 });
  });

  it('draws and hides track chrome in the layer', () => {
    const layer = document.createElement('div');
    const overlay = createGridOverlay(layer);
    overlay.show({ x: 0, y: 0, width: 310, height: 50 }, METRICS, 'ltr');
    expect(layer.querySelectorAll('.bldr-grid-track--column')).toHaveLength(2);
    expect(layer.querySelectorAll('.bldr-grid-track--row')).toHaveLength(1);
    overlay.hide();
    expect(
      Array.from(layer.querySelectorAll<HTMLElement>('.bldr-grid-track')).every(
        (track) => track.style.visibility === 'hidden',
      ),
    ).toBe(true);
    overlay.dispose();
    expect(layer.children).toHaveLength(0);
  });
});
