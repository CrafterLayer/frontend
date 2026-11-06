/*
  Flex layout for the `layout` Studio library (2026-11-05).

  A small first-party flexbox for Pixi containers: rows and columns with gap, padding, wrap,
  grow/shrink/basis, every justify mode, cross alignment (stretch included) and right-to-left
  rows for Arabic. @pixi/layout was evaluated and not admitted (vendor/VENDOR.md: yoga-layout's
  tarball has no LICENSE, its WebAssembly needs 'unsafe-eval' under the preview CSP, and it mixes
  `layout` into every Container prototype page-wide), so this is pure maths over anything with
  x, y, width and height: it never imports Pixi and patches nothing.

  Objects are placed by their top-left corner; a Sprite or Text with an anchor is offset by it.
  Growing, shrinking or stretching sets width/height (a Pixi sprite scales). The natural size is
  remembered per object, so laying out again after a resize starts from the object's own size
  unless something else changed it in between.
*/

export type FlexDirection = 'row' | 'column';
export type FlexAlign = 'start' | 'center' | 'end' | 'stretch';
export type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export const FLEX_ALIGNS: readonly FlexAlign[] = Object.freeze([
  'start',
  'center',
  'end',
  'stretch',
]);
export const FLEX_JUSTIFY: readonly FlexJustify[] = Object.freeze([
  'start',
  'center',
  'end',
  'between',
  'around',
  'evenly',
]);

/** A number for all sides, [vertical, horizontal], [top, right, bottom, left] or an object. */
export type Spacing =
  number | readonly number[] | { top?: number; right?: number; bottom?: number; left?: number };

export interface FlexOptions {
  direction?: FlexDirection;
  /** Space between items, and between wrapped lines. */
  gap?: number;
  padding?: Spacing;
  /** Cross-axis alignment of the items in each line. */
  align?: FlexAlign;
  /** Main-axis distribution of the free space. */
  justify?: FlexJustify;
  wrap?: boolean;
  /** The box to lay out in; without it the content decides the size. */
  width?: number;
  height?: number;
  /** Rows run right to left; columns align their start to the right. */
  rtl?: boolean;
}

export interface FlexItemOptions {
  /** Share of the free space this item takes (0 by default). */
  grow?: number;
  /** Share of an overflow this item gives up (0 by default: art does not squash unless asked). */
  shrink?: number;
  /** Main size before growing or shrinking; the object's own size by default. */
  basis?: number;
  alignSelf?: FlexAlign;
  margin?: Spacing;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Anything a layout can place: a Pixi display object or a plain record. */
export interface Placeable {
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  anchor?: { x: number; y: number };
}

interface Sides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO: Sides = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

const items = new WeakMap<object, FlexItemOptions>();
/* What the layout last set an object to, and the object's own size before that. */
const natural = new WeakMap<object, { set: [number, number]; own: [number, number] }>();

export function num(value: unknown, fallback: number, min = -1e7, max = 1e7): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

export function spacing(value: unknown): Sides {
  if (typeof value === 'number') {
    const v = num(value, 0, 0);
    return { top: v, right: v, bottom: v, left: v };
  }
  if (Array.isArray(value)) {
    const list = value.map((v) => num(v, 0, 0));
    const [a = 0, b = a, c = a, d = b] = list;
    return list.length === 2
      ? { top: a, right: b, bottom: a, left: b }
      : { top: a, right: b, bottom: c, left: d };
  }
  if (value !== null && typeof value === 'object') {
    const v = value as Partial<Sides>;
    return {
      top: num(v.top, 0, 0),
      right: num(v.right, 0, 0),
      bottom: num(v.bottom, 0, 0),
      left: num(v.left, 0, 0),
    };
  }
  return ZERO;
}

function pick<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return (list as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

function isPlaceable(value: unknown): value is Placeable {
  const v = value as Partial<Placeable> | null;
  return v !== null && typeof v === 'object' && typeof v.width === 'number' && 'x' in v;
}

/** The children of a container, or the list itself. */
export function childrenOf(target: unknown): Placeable[] {
  const list = Array.isArray(target)
    ? (target as unknown[])
    : ((target as { children?: unknown } | null)?.children as unknown[] | undefined);
  return Array.isArray(list) ? list.filter(isPlaceable).filter((c) => c.visible !== false) : [];
}

/** Per-child flex options; `layout.item(child)` reads them back. */
export function setItem(child: unknown, options?: FlexItemOptions | null): FlexItemOptions {
  if (child === null || typeof child !== 'object') {
    throw new TypeError('layout.item needs a display object');
  }
  if (options === undefined) return items.get(child) ?? {};
  if (options === null) {
    items.delete(child);
    return {};
  }
  const merged = { ...items.get(child), ...options };
  items.set(child, merged);
  return merged;
}

/** The object's size before the layout last resized it (or now, if something else did since). */
function sizeOf(child: Placeable): [number, number] {
  const memo = natural.get(child);
  const w = num(child.width, 0, 0);
  const h = num(child.height, 0, 0);
  if (memo?.set[0] === w && memo.set[1] === h) return memo.own;
  return [w, h];
}

function resize(child: Placeable, own: [number, number], w: number, h: number): void {
  if (w === own[0] && h === own[1]) {
    if (child.width !== w || child.height !== h) {
      child.width = w;
      child.height = h;
    }
    natural.delete(child);
    return;
  }
  child.width = w;
  child.height = h;
  // Read back: a Pixi object may round; compare against what it reports.
  natural.set(child, { set: [num(child.width, w), num(child.height, h)], own });
}

/** Moves an object so its box's top-left corner is at (left, top), honouring an anchor. */
export function place(child: Placeable, left: number, top: number, w: number, h: number): void {
  const anchor = child.anchor;
  child.x = left + (anchor !== undefined ? num(anchor.x, 0) * w : 0);
  child.y = top + (anchor !== undefined ? num(anchor.y, 0) * h : 0);
}

interface Entry {
  child: Placeable;
  own: [number, number];
  main: number;
  cross: number;
  margin: { mainStart: number; mainEnd: number; crossStart: number; crossEnd: number };
  grow: number;
  shrink: number;
  align: FlexAlign;
}

/** Lays out `container.children` (or a list) and returns the content's size, padding included. */
export function flex(
  target: unknown,
  input?: FlexOptions | null,
): { width: number; height: number } {
  const options = input ?? {};
  const row = options.direction !== 'column';
  const gap = num(options.gap, 0, 0);
  const pad = spacing(options.padding);
  const align = pick(FLEX_ALIGNS, options.align, 'start');
  const justify = pick(FLEX_JUSTIFY, options.justify, 'start');
  const rtl = options.rtl === true;
  const boxW = typeof options.width === 'number' ? num(options.width, 0, 0) : undefined;
  const boxH = typeof options.height === 'number' ? num(options.height, 0, 0) : undefined;
  const padMain = row ? pad.left + pad.right : pad.top + pad.bottom;
  const padCross = row ? pad.top + pad.bottom : pad.left + pad.right;
  const boxMain = row ? boxW : boxH;
  const boxCross = row ? boxH : boxW;
  const innerMain = boxMain === undefined ? undefined : Math.max(0, boxMain - padMain);
  const innerCross = boxCross === undefined ? undefined : Math.max(0, boxCross - padCross);

  const entries: Entry[] = childrenOf(target).map((child) => {
    const item = items.get(child) ?? {};
    const own = sizeOf(child);
    const m = spacing(item.margin);
    return {
      child,
      own,
      main: num(item.basis, row ? own[0] : own[1], 0),
      cross: row ? own[1] : own[0],
      margin: row
        ? {
            mainStart: rtl ? m.right : m.left,
            mainEnd: rtl ? m.left : m.right,
            crossStart: m.top,
            crossEnd: m.bottom,
          }
        : {
            mainStart: m.top,
            mainEnd: m.bottom,
            crossStart: rtl ? m.right : m.left,
            crossEnd: rtl ? m.left : m.right,
          },
      grow: num(item.grow, 0, 0),
      shrink: num(item.shrink, 0, 0),
      align: pick(FLEX_ALIGNS, item.alignSelf, align),
    };
  });

  const outer = (e: Entry) => e.main + e.margin.mainStart + e.margin.mainEnd;
  const lines: Entry[][] = [];
  let line: Entry[] = [];
  let used = 0;
  for (const entry of entries) {
    const size = outer(entry);
    if (
      options.wrap === true &&
      innerMain !== undefined &&
      line.length > 0 &&
      used + gap + size > innerMain
    ) {
      lines.push(line);
      line = [];
      used = 0;
    }
    used += (line.length > 0 ? gap : 0) + size;
    line.push(entry);
  }
  if (line.length > 0) lines.push(line);

  const lengthOf = (l: Entry[]) => l.reduce((sum, e) => sum + outer(e), 0) + gap * (l.length - 1);
  const single = lines.length === 1 && options.wrap !== true;
  // A single unwrapped line fills the box's cross size; wrapped lines are as tall as their items.
  const crosses = lines.map((l) =>
    single && innerCross !== undefined
      ? innerCross
      : Math.max(0, ...l.map((e) => e.cross + e.margin.crossStart + e.margin.crossEnd)),
  );
  const crossTotal = crosses.reduce((sum, c) => sum + c, 0) + gap * Math.max(0, lines.length - 1);
  // Right-to-left mirrors inside the box, or inside the content when there is no box.
  const mainExtent = innerMain ?? Math.max(0, ...lines.map(lengthOf));
  const crossExtent = innerCross ?? crossTotal;
  let crossAt = 0;
  lines.forEach((items, lineIndex) => {
    const total = lengthOf(items);
    let free = innerMain === undefined ? 0 : innerMain - total;
    const growth = items.reduce((sum, e) => sum + e.grow, 0);
    if (free > 0 && growth > 0) {
      for (const e of items) e.main += (free * e.grow) / growth;
      free = 0;
    } else if (free < 0) {
      const weight = items.reduce((sum, e) => sum + e.shrink * e.main, 0);
      if (weight > 0) {
        const overflow = -free;
        for (const e of items)
          e.main = Math.max(0, e.main - (overflow * e.shrink * e.main) / weight);
        free = Math.min(0, free + overflow);
      }
    }
    const n = items.length;
    let lead = 0;
    let between = gap;
    if (justify === 'center') lead = free / 2;
    else if (justify === 'end') lead = free;
    else if (free > 0 && justify === 'between' && n > 1) between = gap + free / (n - 1);
    else if (free > 0 && justify === 'around') {
      lead = free / n / 2;
      between = gap + free / n;
    } else if (free > 0 && justify === 'evenly') {
      lead = free / (n + 1);
      between = gap + free / (n + 1);
    }

    const lineCross = crosses[lineIndex] ?? 0;
    let at = lead;
    for (const e of items) {
      const room = lineCross - e.margin.crossStart - e.margin.crossEnd;
      let cross = e.cross;
      if (e.align === 'stretch') cross = Math.max(0, room);
      let offset = e.margin.crossStart;
      if (e.align === 'center') offset += (room - cross) / 2;
      else if (e.align === 'end') offset += room - cross;
      const mainPos = at + e.margin.mainStart;
      const crossPos = crossAt + offset;
      const w = row ? e.main : cross;
      const h = row ? cross : e.main;
      resize(e.child, e.own, w, h);
      let left: number;
      let top: number;
      if (row) {
        left = pad.left + (rtl ? mainExtent - mainPos - e.main : mainPos);
        top = pad.top + crossPos;
      } else {
        left = pad.left + (rtl ? crossExtent - crossPos - cross : crossPos);
        top = pad.top + mainPos;
      }
      place(e.child, left, top, w, h);
      at = mainPos + e.main + e.margin.mainEnd + between;
    }
    crossAt += lineCross + gap;
  });

  // Sizes after growing and shrinking.
  const mainSize = Math.max(0, ...lines.map(lengthOf));
  const width = (row ? mainSize : crossTotal) + (row ? padMain : padCross);
  const height = (row ? crossTotal : mainSize) + (row ? padCross : padMain);
  return { width, height };
}

export interface GridOptions {
  columns?: number;
  gap?: number;
  /** Cell size: a number for squares or { width, height }; the largest child by default. */
  cell?: number | { width?: number; height?: number };
  x?: number;
  y?: number;
  /** Columns run right to left. */
  rtl?: boolean;
}

/** Places children in equal cells, each centred in its cell, row by row. */
export function grid(
  target: unknown,
  input?: GridOptions | null,
): { width: number; height: number; columns: number; rows: number } {
  const options = input ?? {};
  const list = childrenOf(target);
  const columns = Math.max(1, Math.round(num(options.columns, 3, 1, 1000)));
  const gap = num(options.gap, 0, 0);
  const cell = options.cell;
  const cellW =
    typeof cell === 'number'
      ? num(cell, 0, 0)
      : num(cell?.width, Math.max(0, ...list.map((c) => num(c.width, 0, 0))), 0);
  const cellH =
    typeof cell === 'number'
      ? num(cell, 0, 0)
      : num(cell?.height, Math.max(0, ...list.map((c) => num(c.height, 0, 0))), 0);
  const x0 = num(options.x, 0);
  const y0 = num(options.y, 0);
  const used = Math.min(columns, list.length);
  const rows = Math.ceil(list.length / columns);
  const width = used > 0 ? used * cellW + (used - 1) * gap : 0;
  list.forEach((child, index) => {
    const col = index % columns;
    const r = Math.floor(index / columns);
    const slot = options.rtl === true ? used - 1 - col : col;
    const w = num(child.width, 0, 0);
    const h = num(child.height, 0, 0);
    place(
      child,
      x0 + slot * (cellW + gap) + (cellW - w) / 2,
      y0 + r * (cellH + gap) + (cellH - h) / 2,
      w,
      h,
    );
  });
  return { width, height: rows > 0 ? rows * cellH + (rows - 1) * gap : 0, columns, rows };
}

export type FitMode = 'contain' | 'cover';

interface Scalable extends Placeable {
  scale?: { x: number; y: number };
}

/** Scales an object to fit a box ('contain') or fill it ('cover', crop it with a mask) and centres it. */
export function fit(
  object: unknown,
  box: Partial<Box> | null | undefined,
  mode?: FitMode,
): Box & { scale: number } {
  if (!isPlaceable(object)) throw new TypeError('layout.fit needs an object with width and height');
  const o = object as Scalable;
  const b = {
    x: num(box?.x, 0),
    y: num(box?.y, 0),
    width: num(box?.width, 0, 0),
    height: num(box?.height, 0, 0),
  };
  const sx = o.scale !== undefined ? Math.abs(num(o.scale.x, 1)) || 1 : 1;
  const sy = o.scale !== undefined ? Math.abs(num(o.scale.y, 1)) || 1 : 1;
  const ownW = num(o.width, 0, 0) / sx;
  const ownH = num(o.height, 0, 0) / sy;
  if (ownW === 0 || ownH === 0) return { ...b, width: 0, height: 0, scale: 1 };
  const kx = b.width / ownW;
  const ky = b.height / ownH;
  const k = mode === 'cover' ? Math.max(kx, ky) : Math.min(kx, ky);
  const w = ownW * k;
  const h = ownH * k;
  if (o.scale !== undefined) {
    o.scale.x = Math.sign(o.scale.x || 1) * k;
    o.scale.y = Math.sign(o.scale.y || 1) * k;
  } else {
    o.width = w;
    o.height = h;
  }
  const left = b.x + (b.width - w) / 2;
  const top = b.y + (b.height - h) / 2;
  place(o, left, top, w, h);
  return { x: left, y: top, width: w, height: h, scale: k };
}
