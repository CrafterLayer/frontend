import { describe, expect, it } from 'vitest';

import { createLayoutLibrary } from '../layout-entry';

const L = createLayoutLibrary();

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  anchor?: { x: number; y: number };
}

const box = (width: number, height: number, extra: Partial<Box> = {}): Box => ({
  x: 0,
  y: 0,
  width,
  height,
  ...extra,
});
const xs = (list: Box[]) => list.map((c) => c.x);
const ys = (list: Box[]) => list.map((c) => c.y);

describe('layout.flex', () => {
  it('lays a row with gap and padding and reports the content size', () => {
    const children = [box(10, 20), box(30, 10), box(20, 40)];
    const size = L.flex({ children }, { gap: 5, padding: 4 });
    expect(xs(children)).toEqual([4, 19, 54]);
    expect(ys(children)).toEqual([4, 4, 4]);
    expect(size).toEqual({ width: 4 + 10 + 5 + 30 + 5 + 20 + 4, height: 48 });
  });

  it('lays a column and accepts a plain list', () => {
    const children = [box(10, 20), box(30, 10)];
    const size = L.flex(children, { direction: 'column', gap: 2 });
    expect(ys(children)).toEqual([0, 22]);
    expect(xs(children)).toEqual([0, 0]);
    expect(size).toEqual({ width: 30, height: 32 });
  });

  it('skips hidden children', () => {
    const children = [box(10, 10), box(10, 10, { visible: false }), box(10, 10)];
    L.flex({ children }, { gap: 1 });
    expect(xs(children)).toEqual([0, 0, 11]);
  });

  it.each([
    ['start', [0, 20]],
    ['center', [30, 50]],
    ['end', [60, 80]],
    ['between', [0, 80]],
    ['around', [15, 65]],
    ['evenly', [20, 60]],
  ] as const)('justify %s', (justify, expected) => {
    const children = [box(20, 10), box(20, 10)];
    L.flex({ children }, { width: 100, justify });
    expect(xs(children)).toEqual(expected);
  });

  it('aligns on the cross axis, stretch included', () => {
    const children = [box(10, 10), box(10, 10), box(10, 10), box(10, 10)];
    L.item(children[1], { alignSelf: 'center' });
    L.item(children[2], { alignSelf: 'end' });
    L.item(children[3], { alignSelf: 'stretch' });
    L.flex({ children }, { height: 50 });
    expect(ys(children)).toEqual([0, 20, 40, 0]);
    expect(children[3]?.height).toBe(50);
  });

  it('wraps into lines and stacks them with the gap', () => {
    const children = [box(40, 10), box(40, 20), box(40, 10)];
    const size = L.flex({ children }, { width: 90, gap: 5, wrap: true });
    expect(xs(children)).toEqual([0, 45, 0]);
    expect(ys(children)).toEqual([0, 0, 25]);
    expect(size).toEqual({ width: 85, height: 35 });
  });

  it('grows into free space and shrinks only what may shrink', () => {
    const children = [box(20, 10), box(20, 10), box(20, 10)];
    L.item(children[0], { grow: 1 });
    L.item(children[1], { grow: 3 });
    L.flex({ children }, { width: 100 });
    expect(children.map((c) => c.width)).toEqual([30, 50, 20]);
    expect(xs(children)).toEqual([0, 30, 80]);
    // Laying out again in a smaller box starts from the natural size, not the grown one.
    L.flex({ children }, { width: 60 });
    expect(children.map((c) => c.width)).toEqual([20, 20, 20]);

    const tight = [box(40, 10), box(40, 10)];
    L.item(tight[0], { shrink: 1 });
    L.flex({ children: tight }, { width: 60 });
    expect(tight.map((c) => c.width)).toEqual([20, 40]);
  });

  it('honours basis and margins', () => {
    const children = [box(10, 10), box(10, 10)];
    L.item(children[0], { basis: 30, margin: [0, 5] });
    L.flex({ children });
    expect(children[0]?.width).toBe(30);
    expect(xs(children)).toEqual([5, 40]);
  });

  it('mirrors rows right to left, inside the box and inside the content', () => {
    const children = [box(10, 10), box(20, 10)];
    L.flex({ children }, { width: 100, gap: 5, rtl: true });
    expect(xs(children)).toEqual([90, 65]);
    const loose = [box(10, 10), box(20, 10)];
    const size = L.flex({ children: loose }, { gap: 5, rtl: true, padding: 2 });
    expect(xs(loose)).toEqual([2 + 25, 2]);
    expect(size.width).toBe(39);
    // Margins swap sides with the direction.
    const margined = [box(10, 10)];
    L.item(margined[0], { margin: { left: 3 } });
    L.flex({ children: margined }, { width: 50, rtl: true });
    expect(margined[0]?.x).toBe(40);
  });

  it('aligns a right-to-left column to the right', () => {
    const children = [box(10, 10), box(30, 10)];
    L.flex({ children }, { direction: 'column', width: 50, rtl: true });
    expect(xs(children)).toEqual([40, 20]);
  });

  it('offsets anchored objects by their anchor', () => {
    const children = [box(20, 10, { anchor: { x: 0.5, y: 0.5 } })];
    L.flex({ children }, { padding: 4 });
    expect([children[0]?.x, children[0]?.y]).toEqual([14, 9]);
  });

  it('reads item options back and clears them', () => {
    const child = box(1, 1);
    L.item(child, { grow: 2 });
    expect(L.item(child)).toEqual({ grow: 2 });
    L.item(child, null);
    expect(L.item(child)).toEqual({});
  });
});

describe('layout.grid', () => {
  it('centres children in equal cells, row by row, mirrored in RTL', () => {
    const children = [box(10, 10), box(20, 20), box(10, 10)];
    const size = L.grid(children, { columns: 2, gap: 4 });
    expect(xs(children)).toEqual([5, 24, 5]);
    expect(ys(children)).toEqual([5, 0, 29]);
    expect(size).toEqual({ width: 44, height: 44, columns: 2, rows: 2 });
    L.grid(children, { columns: 2, gap: 4, cell: 30, rtl: true });
    expect(xs(children)).toEqual([44, 5, 44]);
  });
});

describe('layout.fit', () => {
  it('contains and covers a scalable object and centres it', () => {
    const sprite = { x: 0, y: 0, width: 200, height: 100, scale: { x: 2, y: 2 } };
    const contain = L.fit(sprite, { x: 0, y: 0, width: 100, height: 100 });
    expect(contain.scale).toBe(1);
    expect(sprite.scale).toEqual({ x: 1, y: 1 });
    expect([sprite.x, sprite.y]).toEqual([0, 25]);
    const plain = { x: 0, y: 0, width: 50, height: 100 };
    const cover = L.fit(plain, { x: 10, y: 10, width: 100, height: 100 }, 'cover');
    expect([plain.width, plain.height]).toEqual([100, 200]);
    expect(cover).toMatchObject({ x: 10, y: -40 });
  });
});

describe('layout.page', () => {
  it('puts the picture beside the text in landscape, on the reading-start side', () => {
    const spread = L.page(1000, 600, { padding: 0, gap: 0, ratio: 0.5 });
    expect(spread.orientation).toBe('landscape');
    expect(spread.placement).toBe('left');
    expect(spread.picture).toEqual({ x: 0, y: 0, width: 500, height: 600 });
    expect(spread.text).toEqual({ x: 500, y: 0, width: 500, height: 600 });
    const arabic = L.page(1000, 600, { padding: 0, gap: 0, ratio: 0.5, rtl: true });
    expect(arabic.placement).toBe('right');
    expect(arabic.picture.x).toBe(500);
    expect(arabic.text.x).toBe(0);
  });

  it('stacks the picture over the text in portrait, even when a side was asked for', () => {
    const spread = L.page(600, 1000, { picture: 'left', padding: 20, gap: 20, ratio: 0.5 });
    expect(spread.orientation).toBe('portrait');
    expect(spread.placement).toBe('top');
    expect(spread.picture).toEqual({ x: 20, y: 20, width: 560, height: 470 });
    expect(spread.text).toEqual({ x: 20, y: 510, width: 560, height: 470 });
  });

  it('lays a full-bleed picture with a text band', () => {
    const spread = L.page(800, 600, { picture: 'full', padding: 0, ratio: 0.25 });
    expect(spread.picture).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(spread.text).toEqual({ x: 0, y: 450, width: 800, height: 150 });
  });
});
