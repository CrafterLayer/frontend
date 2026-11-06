/*
  Colouring pages for the `paint` Studio library (2026-11-05).

  `paint.page(s, { art, width, height })` is a colouring book a 4-to-8-year-old can use with a
  finger: tap a shape with the bucket and it fills up to the lines; drag with the brush to colour
  freely; the eraser takes paint back off. Four layers, bottom to top: white paper, the paint
  canvas, the live stroke (the stroke in progress, committed on pointerup) and the ink (the line
  art, always on top, never painted).

  The bucket is q-floodfill (MIT, scan-line flood fill on ImageData) run over the paint layer
  with its pixel reader patched: line-art pixels read as a wall colour nothing matches, so a
  region is bounded by the lines even where earlier paint ran under them, and colours compare
  premultiplied, so a stroke's faint anti-aliased fringe is filled over instead of leaving a
  halo. A tap that lands on a line fills the nearest open pixel's region. Brush strokes are
  perfect-freehand outlines (MIT, the same package as `s.lib.brush`), pressure-aware with a pen
  and simulated for a finger or mouse.

  History keeps the changed rectangle before and after each step (a clear keeps only before),
  at most `history` steps (20) within a 64 MB budget, oldest dropped first. In the editor the
  page renders but ignores input.

  Plain code: the Pixi namespace arrives with the call (the scene `s`, `s.PIXI`, or ck.stage()'s
  `{ PIXI, app }`), like `s.lib.peeps.texture`.
*/

import { getStroke } from 'perfect-freehand';
import FloodFill from 'q-floodfill';

import { palette as namedPalette } from './palettes';
import {
  browserPaintEnv,
  context2d,
  drawArt,
  hexColor,
  inkify,
  type PaintCanvas,
  type PaintContext,
  type PaintImageData,
  type PaintRasterEnv,
} from './raster';

export const PAINT_TOOLS = Object.freeze(['fill', 'brush', 'eraser'] as const);
export type PaintTool = (typeof PAINT_TOOLS)[number];
export type PaintEvent = 'change' | 'state' | 'dispose';

export interface PaintPageOptions {
  /** Line art: an SVG string (`s.lib.stickers.lineArt(name)`), a data: image URL or a texture. */
  art: unknown;
  width: number;
  height: number;
  /** A palette name (`paint.palettes`) or a list of '#rrggbb' colours. */
  palette?: string | readonly (string | number)[];
  /** Colour difference (0..255) a fill still treats as the same region; 48 by default. */
  tolerance?: number;
  x?: number;
  y?: number;
  tool?: PaintTool;
  color?: string | number;
  /** Brush width in CSS px (2..200); 18 by default, a child's finger. */
  size?: number;
  /** Paper colour; white by default. */
  paper?: string | number;
  /** Pixels per CSS pixel (1..2); the scene's resolution by default. */
  resolution?: number;
  /** Undo steps kept (1..50); 20 by default. */
  history?: number;
}

export interface PaintChange {
  readonly kind: 'fill' | 'brush' | 'eraser' | 'undo' | 'redo' | 'clear';
}

export interface PaintPage {
  /** Add this to the stage (`s.world.addChild(page.view)`). */
  readonly view: unknown;
  readonly width: number;
  readonly height: number;
  readonly resolution: number;
  readonly palette: readonly string[];
  tool: PaintTool;
  /** '#rrggbb'; set with '#rgb', '#rrggbb' or 0xrrggbb. */
  get color(): string;
  set color(value: string | number);
  size: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  setTool(tool: unknown): boolean;
  setColor(color: unknown): boolean;
  /** Bucket-fill the region under a point (page coordinates) with the current colour. */
  fillAt(x: number, y: number): boolean;
  /** Draw a whole stroke (page coordinates, [x, y, pressure?] or { x, y }) with brush or eraser. */
  stroke(points: readonly unknown[], tool?: 'brush' | 'eraser'): boolean;
  undo(): boolean;
  redo(): boolean;
  clear(): boolean;
  /** Paper, paint and ink flattened into one PNG data URL. */
  toDataURL(): string;
  on(event: PaintEvent, fn: (detail?: PaintChange) => void): () => void;
  dispose(): void;
}

interface DisplayLike {
  x: number;
  y: number;
  width: number;
  height: number;
  tint?: unknown;
  eventMode?: string;
  cursor?: string;
  hitArea?: unknown;
  addChild(...children: unknown[]): unknown;
  on?(event: string, fn: (event: PointerLike) => void): unknown;
  off?(event: string, fn: (event: PointerLike) => void): unknown;
  removeFromParent?(): void;
  destroy?(options?: unknown): void;
}

interface TextureLike {
  source?: { update?(): void };
  destroy?(destroySource?: boolean): void;
}

interface PixiLike {
  Container: new () => DisplayLike;
  Sprite: new (texture?: unknown) => DisplayLike;
  Texture: { from(source: unknown, skipCache?: boolean): TextureLike; WHITE?: unknown };
  Rectangle?: new (x: number, y: number, w: number, h: number) => unknown;
}

interface PointerLike {
  pointerId?: number;
  pointerType?: string;
  pressure?: number;
  getLocalPosition?(container: unknown): { x: number; y: number };
}

interface Host {
  PIXI: PixiLike;
  resolution: number | undefined;
  render: (() => void) | undefined;
  editor: boolean;
  onDispose: ((fn: () => void) => void) | undefined;
}

interface Step {
  x: number;
  y: number;
  w: number;
  h: number;
  before: PaintImageData;
  /** null: the step cleared its rectangle. */
  after: PaintImageData | null;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* 2048² pixels per layer at most: about 16 MB each, three layers plus history. */
const MAX_PIXELS = 2048 * 2048;
const MAX_HISTORY_BYTES = 64 * 1024 * 1024;
const WALL = Object.freeze({ r: -1024, g: -1024, b: -1024, a: -1024 });

function isPixi(value: unknown): value is PixiLike {
  const v = value as Partial<PixiLike> | null;
  return (
    typeof v?.Container === 'function' &&
    typeof v.Sprite === 'function' &&
    typeof v.Texture?.from === 'function'
  );
}

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function hostOf(value: unknown): Host {
  if (isPixi(value)) {
    return {
      PIXI: value,
      resolution: undefined,
      render: undefined,
      editor: false,
      onDispose: undefined,
    };
  }
  const host = value as {
    PIXI?: unknown;
    dpr?: unknown;
    editor?: unknown;
    reducedMotion?: unknown;
    dispose?: unknown;
    app?: { render?: () => void; renderer?: { resolution?: unknown } };
  } | null;
  if (host === null || typeof host !== 'object' || !isPixi(host.PIXI)) {
    throw new TypeError('paint.page needs the scene (s), s.PIXI or { PIXI, app }');
  }
  const app = host.app;
  const still = host.reducedMotion === true || host.editor === true;
  const dispose = host.dispose;
  return {
    PIXI: host.PIXI,
    resolution: positive(host.dpr) ?? positive(app?.renderer?.resolution),
    // A still scene renders only when asked: render after every change.
    render:
      still && typeof app?.render === 'function'
        ? () => {
            try {
              app.render?.();
            } catch {
              // The scene was disposed: nothing to draw.
            }
          }
        : undefined,
    editor: host.editor === true,
    onDispose:
      typeof dispose === 'function'
        ? (fn) => {
            (dispose as (f: () => void) => void).call(host, fn);
          }
        : undefined,
  };
}

function paletteOf(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    const list = value.map(hexColor).filter((c): c is string => c !== undefined);
    if (list.length > 0) return Object.freeze(list.slice(0, 64));
  }
  return namedPalette(value);
}

function pointsOf(points: readonly unknown[], res: number): number[][] {
  const out: number[][] = [];
  for (const p of points.slice(0, 10_000)) {
    if (Array.isArray(p)) {
      const [x, y, pressure] = p as unknown[];
      if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x + y)) {
        out.push(typeof pressure === 'number' ? [x * res, y * res, pressure] : [x * res, y * res]);
      }
    } else if (p !== null && typeof p === 'object') {
      const { x, y, pressure } = p as { x?: unknown; y?: unknown; pressure?: unknown };
      if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x + y)) {
        out.push(typeof pressure === 'number' ? [x * res, y * res, pressure] : [x * res, y * res]);
      }
    }
  }
  return out;
}

function trace(context: PaintContext, outline: number[][]): void {
  const [first, ...rest] = outline;
  if (first === undefined) return;
  context.beginPath();
  context.moveTo(first[0] ?? 0, first[1] ?? 0);
  for (const point of rest) context.lineTo(point[0] ?? 0, point[1] ?? 0);
  context.closePath();
  context.fill();
}

/** Creates a colouring page; resolves once the line art has been drawn. */
export async function createPaintPage(
  target: unknown,
  // Authored scene code is plain JavaScript: options may be missing or malformed.
  input: PaintPageOptions | null | undefined,
  env?: PaintRasterEnv,
): Promise<PaintPage> {
  const host = hostOf(target);
  const raster = env ?? browserPaintEnv();
  const options: Partial<PaintPageOptions> = input ?? {};
  const P = host.PIXI;
  const width = num(options.width, 800, 16, 4096);
  const height = num(options.height, 600, 16, 4096);
  let res = Math.min(
    2,
    Math.max(
      1,
      positive(options.resolution) ?? host.resolution ?? positive(raster.devicePixelRatio) ?? 1,
    ),
  );
  res = Math.min(res, Math.sqrt(MAX_PIXELS / (width * height)));
  const pw = Math.max(1, Math.round(width * res));
  const ph = Math.max(1, Math.round(height * res));
  const tolerance = num(options.tolerance, 48, 0, 254);
  const maxSteps = Math.round(num(options.history, 20, 1, 50));
  const paper = hexColor(options.paper) ?? '#ffffff';
  const colours = paletteOf(options.palette);

  const inkCanvas = await drawArt(raster, options.art, pw, ph);
  const mask = inkify(context2d(inkCanvas), pw, ph);
  const paintCanvas = raster.createCanvas(pw, ph);
  const paint = context2d(paintCanvas);
  const strokeCanvas = raster.createCanvas(pw, ph);
  const live = context2d(strokeCanvas);

  const texture = (canvas: PaintCanvas) =>
    P.Texture.from({ resource: canvas, resolution: res }, true);
  const paintTexture = texture(paintCanvas);
  const strokeTexture = texture(strokeCanvas);
  const inkTexture = texture(inkCanvas);
  const view = new P.Container();
  view.x = num(options.x, 0, -1e6, 1e6);
  view.y = num(options.y, 0, -1e6, 1e6);
  const sprite = (tex: unknown) => {
    const s = new P.Sprite(tex);
    s.width = width;
    s.height = height;
    return s;
  };
  if (P.Texture.WHITE !== undefined) {
    const sheet = sprite(P.Texture.WHITE);
    sheet.tint = paper;
    view.addChild(sheet);
  }
  view.addChild(sprite(paintTexture), sprite(strokeTexture), sprite(inkTexture));

  let tool: PaintTool = PAINT_TOOLS.find((t) => t === options.tool) ?? 'fill';
  let color = hexColor(options.color) ?? colours[0] ?? '#e53935';
  let size = num(options.size, 18, 2, 200);
  let disposed = false;
  const undoStack: Step[] = [];
  const redoStack: Step[] = [];
  const listeners = new Map<PaintEvent, Set<(detail?: PaintChange) => void>>();

  function emit(event: PaintEvent, detail?: PaintChange): void {
    for (const fn of [...(listeners.get(event) ?? [])]) fn(detail);
  }

  function refresh(...textures: TextureLike[]): void {
    for (const t of textures) t.source?.update?.();
    host.render?.();
  }

  const bytes = (s: Step) => s.before.data.length + (s.after?.data.length ?? 0);
  function record(step: Step): void {
    redoStack.length = 0;
    undoStack.push(step);
    let total = undoStack.reduce((sum, s) => sum + bytes(s), 0);
    while (undoStack.length > maxSteps || (total > MAX_HISTORY_BYTES && undoStack.length > 0)) {
      const dropped = undoStack.shift();
      if (dropped !== undefined) total -= bytes(dropped);
    }
  }

  function clamp(rect: Rect): Rect | undefined {
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const w = Math.min(pw, Math.ceil(rect.x + rect.w)) - x;
    const h = Math.min(ph, Math.ceil(rect.y + rect.h)) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : undefined;
  }

  function nearestOpen(px: number, py: number): [number, number] | undefined {
    const open = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < pw && y < ph && mask[y * pw + x] === 0;
    if (open(px, py)) return [px, py];
    const reach = Math.ceil(6 * res);
    for (let r = 1; r <= reach; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && open(px + dx, py + dy)) {
            return [px + dx, py + dy];
          }
        }
      }
    }
    return undefined;
  }

  function fillAt(x: number, y: number): boolean {
    if (disposed || typeof x !== 'number' || typeof y !== 'number') return false;
    const seed = nearestOpen(Math.floor(x * res), Math.floor(y * res));
    if (seed === undefined) return false;
    const image = paint.getImageData(0, 0, pw, ph);
    const original = image.data.slice();
    const flood = new FloodFill(image as unknown as ImageData);
    const read = flood.getColorAtPixel;
    flood.getColorAtPixel = (data, px, py) =>
      mask[py * pw + px] === 1 ? WALL : read(data, px, py);
    // Premultiplied: a stroke's faint fringe matches the paper it fades into.
    const distance = (a: Rgba, b: Rgba) => {
      if (a.a < 0 || b.a < 0) return Infinity;
      const ka = a.a / 255;
      const kb = b.a / 255;
      return Math.max(
        Math.abs(a.r * ka - b.r * kb),
        Math.abs(a.g * ka - b.g * kb),
        Math.abs(a.b * ka - b.b * kb),
        Math.abs(a.a - b.a),
      );
    };
    flood.isSameColor = (a, b, t = 0) => distance(a, b) <= t;
    // Recolouring lavender with lilac must still work: the tolerance stays under their distance.
    const gap = distance(
      read(image as unknown as ImageData, seed[0], seed[1]),
      flood.colorToRGBA(color),
    );
    if (gap < 0.5) return false;
    flood.fill(color, seed[0], seed[1], Math.min(tolerance, gap - 0.5));

    const now = new Uint32Array(image.data.buffer, image.data.byteOffset, pw * ph);
    const was = new Uint32Array(original.buffer, original.byteOffset, pw * ph);
    let minX = pw;
    let minY = ph;
    let maxX = -1;
    let maxY = -1;
    for (let py = 0; py < ph; py += 1) {
      const row = py * pw;
      for (let px = 0; px < pw; px += 1) {
        if (now[row + px] !== was[row + px]) {
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
    }
    if (maxX < 0) return false;
    const rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    const before = paint.getImageData(rect.x, rect.y, rect.w, rect.h);
    paint.putImageData(image, 0, 0, rect.x, rect.y, rect.w, rect.h);
    record({ ...rect, before, after: paint.getImageData(rect.x, rect.y, rect.w, rect.h) });
    refresh(paintTexture);
    emit('change', { kind: 'fill' });
    return true;
  }

  function outlineOf(points: number[][], pen: boolean, last: boolean): number[][] {
    return getStroke(points, {
      size: size * res,
      thinning: pen ? 0.6 : 0.25,
      smoothing: 0.5,
      streamline: 0.45,
      simulatePressure: !pen,
      last,
    });
  }

  function boundsOf(outline: number[][]): Rect | undefined {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x = 0, y = 0] of outline) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    return clamp({ x: minX - 2, y: minY - 2, w: maxX - minX + 4, h: maxY - minY + 4 });
  }

  function commit(points: number[][], pen: boolean, kind: 'brush' | 'eraser'): boolean {
    const outline = outlineOf(points, pen, true);
    const rect = outline.length >= 3 ? boundsOf(outline) : undefined;
    if (rect === undefined) return false;
    const before = paint.getImageData(rect.x, rect.y, rect.w, rect.h);
    paint.globalCompositeOperation = kind === 'eraser' ? 'destination-out' : 'source-over';
    paint.fillStyle = kind === 'eraser' ? '#000000' : color;
    trace(paint, outline);
    paint.globalCompositeOperation = 'source-over';
    record({ ...rect, before, after: paint.getImageData(rect.x, rect.y, rect.w, rect.h) });
    refresh(paintTexture);
    emit('change', { kind });
    return true;
  }

  // The stroke in progress: one pointer at a time, so a second finger never scribbles.
  let current: { id: number; points: number[][]; pen: boolean; kind: 'brush' | 'eraser' } | null =
    null;

  function drawLive(): void {
    if (current === null) return;
    live.clearRect(0, 0, pw, ph);
    // The eraser previews as paper over the paint; the ink stays on top either way.
    live.fillStyle = current.kind === 'eraser' ? paper : color;
    trace(live, outlineOf(current.points, current.pen, false));
    refresh(strokeTexture);
  }

  function pointOf(event: PointerLike): number[] {
    const local = event.getLocalPosition?.(view) ?? { x: 0, y: 0 };
    const pressure = num(event.pressure, 0.5, 0, 1);
    return [local.x * res, local.y * res, pressure];
  }

  const onDown = (event: PointerLike) => {
    if (disposed || host.editor || current !== null) return;
    if (tool === 'fill') {
      const [x = 0, y = 0] = pointOf(event);
      fillAt(x / res, y / res);
      return;
    }
    current = {
      id: event.pointerId ?? 0,
      points: [pointOf(event)],
      pen: event.pointerType === 'pen',
      kind: tool,
    };
    drawLive();
  };
  const onMove = (event: PointerLike) => {
    if (current?.id !== (event.pointerId ?? 0)) return;
    current.points.push(pointOf(event));
    drawLive();
  };
  const onUp = (event: PointerLike) => {
    if (current?.id !== (event.pointerId ?? 0)) return;
    const done = current;
    current = null;
    live.clearRect(0, 0, pw, ph);
    refresh(strokeTexture);
    commit(done.points, done.pen, done.kind);
  };
  const handlers: [string, (event: PointerLike) => void][] = [
    ['pointerdown', onDown],
    ['globalpointermove', onMove],
    ['pointerup', onUp],
    ['pointerupoutside', onUp],
    ['pointercancel', onUp],
  ];
  if (host.editor) {
    view.eventMode = 'none';
  } else {
    view.eventMode = 'static';
    view.cursor = 'pointer';
    if (typeof P.Rectangle === 'function') view.hitArea = new P.Rectangle(0, 0, width, height);
    for (const [name, fn] of handlers) view.on?.(name, fn);
  }

  function setTool(next: unknown): boolean {
    if (!(PAINT_TOOLS as readonly unknown[]).includes(next)) return false;
    tool = next as PaintTool;
    emit('state');
    return true;
  }

  function setColor(next: unknown): boolean {
    const hex = hexColor(next);
    if (hex === undefined) return false;
    color = hex;
    emit('state');
    return true;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    current = null;
    for (const [name, fn] of handlers) view.off?.(name, fn);
    emit('dispose');
    listeners.clear();
    undoStack.length = 0;
    redoStack.length = 0;
    view.removeFromParent?.();
    view.destroy?.({ children: true });
    for (const t of [paintTexture, strokeTexture, inkTexture]) t.destroy?.(true);
    // Release the pixels now rather than when the page object is collected.
    for (const canvas of [paintCanvas, strokeCanvas, inkCanvas]) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  host.onDispose?.(dispose);
  // A still scene: draw once the awaiting code has placed the view.
  if (host.render !== undefined) setTimeout(host.render, 0);

  return {
    view,
    width,
    height,
    resolution: res,
    palette: colours,
    get tool() {
      return tool;
    },
    set tool(next) {
      setTool(next);
    },
    get color(): string {
      return color;
    },
    set color(next: string | number) {
      setColor(next);
    },
    get size() {
      return size;
    },
    set size(next) {
      size = num(next, size, 2, 200);
      emit('state');
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    setTool,
    setColor,
    fillAt,
    stroke(points, kind) {
      if (disposed || !Array.isArray(points)) return false;
      const list = pointsOf(points, res);
      if (list.length === 0) return false;
      const pen = list.some((p) => p.length > 2);
      return commit(list, pen, kind === 'eraser' ? 'eraser' : 'brush');
    },
    undo() {
      const step = undoStack.pop();
      if (disposed || step === undefined) return false;
      paint.putImageData(step.before, step.x, step.y);
      redoStack.push(step);
      refresh(paintTexture);
      emit('change', { kind: 'undo' });
      return true;
    },
    redo() {
      const step = redoStack.pop();
      if (disposed || step === undefined) return false;
      if (step.after === null) paint.clearRect(step.x, step.y, step.w, step.h);
      else paint.putImageData(step.after, step.x, step.y);
      undoStack.push(step);
      refresh(paintTexture);
      emit('change', { kind: 'redo' });
      return true;
    },
    clear() {
      if (disposed) return false;
      const before = paint.getImageData(0, 0, pw, ph);
      if (!before.data.some((v) => v !== 0)) return false;
      paint.clearRect(0, 0, pw, ph);
      record({ x: 0, y: 0, w: pw, h: ph, before, after: null });
      refresh(paintTexture);
      emit('change', { kind: 'clear' });
      return true;
    },
    toDataURL() {
      const flat = raster.createCanvas(pw, ph);
      const context = context2d(flat);
      context.fillStyle = paper;
      context.fillRect(0, 0, pw, ph);
      context.drawImage(paintCanvas, 0, 0, pw, ph);
      context.drawImage(inkCanvas, 0, 0, pw, ph);
      const url = flat.toDataURL('image/png');
      flat.width = 0;
      flat.height = 0;
      return url;
    },
    on(event, fn) {
      if (typeof fn !== 'function' || disposed) return () => undefined;
      let set = listeners.get(event);
      if (set === undefined) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(fn);
      return () => {
        listeners.get(event)?.delete(fn);
      };
    },
    dispose,
  };
}
