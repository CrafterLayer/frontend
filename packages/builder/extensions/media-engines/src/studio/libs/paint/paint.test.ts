// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPaintLibrary } from '../paint-entry';
import { createPaintPage, type PaintPage, type PaintPageOptions } from './page';
import { hexColor, sizedSvg, type PaintRasterEnv } from './raster';

const paint = createPaintLibrary();

/* A software 2D canvas: enough of the API for the page (pixels, paths, compositing). */
class FakeImageData {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly data = new Uint8ClampedArray(width * height * 4),
  ) {}
}

function rgb(style: unknown): [number, number, number] {
  const hex = hexColor(style) ?? '#000000';
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

class FakeContext {
  fillStyle: unknown = '#000000';
  globalCompositeOperation = 'source-over';
  private path: number[][] = [];
  constructor(private readonly canvas: FakeCanvas) {}

  private set(x: number, y: number, r: number, g: number, b: number, a: number) {
    const { width, height, pixels } = this.canvas;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  }

  private paintPixel(x: number, y: number) {
    if (this.globalCompositeOperation === 'destination-out') this.set(x, y, 0, 0, 0, 0);
    else this.set(x, y, ...rgb(this.fillStyle), 255);
  }

  clearRect(x: number, y: number, w: number, h: number) {
    for (let py = y; py < y + h; py += 1)
      for (let px = x; px < x + w; px += 1) this.set(px, py, 0, 0, 0, 0);
  }

  fillRect(x: number, y: number, w: number, h: number) {
    for (let py = y; py < y + h; py += 1)
      for (let px = x; px < x + w; px += 1) this.paintPixel(px, py);
  }

  getImageData(x: number, y: number, w: number, h: number) {
    const out = new FakeImageData(w, h);
    const { width, pixels } = this.canvas;
    for (let row = 0; row < h; row += 1) {
      const from = ((y + row) * width + x) * 4;
      out.data.set(pixels.subarray(from, from + w * 4), row * w * 4);
    }
    return out;
  }

  putImageData(
    image: FakeImageData,
    dx: number,
    dy: number,
    sx = 0,
    sy = 0,
    sw = image.width,
    sh = image.height,
  ) {
    const { width, pixels } = this.canvas;
    for (let row = sy; row < sy + sh; row += 1) {
      const from = (row * image.width + sx) * 4;
      pixels.set(image.data.subarray(from, from + sw * 4), ((dy + row) * width + dx + sx) * 4);
    }
  }

  drawImage(source: unknown, x: number, y: number, w: number, h: number) {
    if (source instanceof FakeImage) {
      source.draw(this, x, y, w, h);
      return;
    }
    const src = source as FakeCanvas;
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        const i =
          (Math.floor((py * src.height) / h) * src.width + Math.floor((px * src.width) / w)) * 4;
        const a = (src.pixels[i + 3] ?? 0) / 255;
        if (a === 0) continue;
        const j = ((y + py) * this.canvas.width + x + px) * 4;
        const d = this.canvas.pixels;
        for (let c = 0; c < 3; c += 1)
          d[j + c] = (src.pixels[i + c] ?? 0) * a + (d[j + c] ?? 0) * (1 - a);
        d[j + 3] = Math.max(d[j + 3] ?? 0, Math.round(a * 255));
      }
    }
  }

  /** Test hook: write one pixel as art. */
  ink(x: number, y: number, r: number, g: number, b: number, a: number) {
    this.set(x, y, r, g, b, a);
  }

  beginPath() {
    this.path = [];
  }
  moveTo(x: number, y: number) {
    this.path.push([x, y]);
  }
  lineTo(x: number, y: number) {
    this.path.push([x, y]);
  }
  closePath() {
    // Paths close implicitly when filled.
  }
  fill() {
    // Even-odd scan-line fill at pixel centres.
    const pts = this.path;
    for (let py = 0; py < this.canvas.height; py += 1) {
      const cy = py + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i += 1) {
        const [x1 = 0, y1 = 0] = pts[i] ?? [];
        const [x2 = 0, y2 = 0] = pts[(i + 1) % pts.length] ?? [];
        if (y1 <= cy !== y2 <= cy) xs.push(x1 + ((cy - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let px = Math.ceil((xs[k] ?? 0) - 0.5); px + 0.5 <= (xs[k + 1] ?? 0); px += 1)
          this.paintPixel(px, py);
      }
    }
  }
}

class FakeCanvas {
  pixels: Uint8ClampedArray;
  readonly context: FakeContext;
  constructor(
    public width: number,
    public height: number,
  ) {
    this.pixels = new Uint8ClampedArray(width * height * 4);
    this.context = new FakeContext(this);
  }
  getContext() {
    return this.context;
  }
  toDataURL(type = 'image/png') {
    return `data:${type};fake`;
  }
  at(x: number, y: number): number[] {
    const i = (y * this.width + x) * 4;
    return [...this.pixels.subarray(i, i + 4)];
  }
}

/*
  The art: a 40 × 40 picture of a square outline (black, 2 px, from 10 to 30) with a white
  inside and a transparent outside, drawn scaled into whatever rectangle it is given.
*/
class FakeImage {
  src = '';
  decoding = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 40;
  naturalHeight = 40;
  draw(context: FakeContext, x: number, y: number, w: number, h: number) {
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        const u = ((px + 0.5) / w) * 40;
        const v = ((py + 0.5) / h) * 40;
        const inside = u >= 10 && u < 30 && v >= 10 && v < 30;
        if (!inside) continue;
        const line = u < 12 || u >= 28 || v < 12 || v >= 28;
        if (line) context.ink(x + px, y + py, 0, 0, 0, 255);
        else context.ink(x + px, y + py, 255, 255, 255, 255);
      }
    }
  }
}

function fakeEnv() {
  const canvases: FakeCanvas[] = [];
  const images: FakeImage[] = [];
  const env: PaintRasterEnv = {
    createCanvas(width, height) {
      const canvas = new FakeCanvas(width, height);
      canvases.push(canvas);
      return canvas;
    },
    createImage() {
      const image = new FakeImage();
      images.push(image);
      // Decoding finishes on the next turn, like a browser's.
      let src = '';
      Object.defineProperty(image, 'src', {
        get: () => src,
        set(value: string) {
          src = value;
          setTimeout(() => (value.startsWith('data:') ? image.onload?.() : image.onerror?.()), 0);
        },
      });
      return image;
    },
    devicePixelRatio: 1,
  };
  return { env, canvases, images };
}

type Handler = (event: unknown) => void;

class FakeContainer {
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  tint: unknown;
  eventMode = 'passive';
  cursor = '';
  hitArea: unknown;
  children: unknown[] = [];
  handlers = new Map<string, Set<Handler>>();
  destroyed = false;
  addChild(...children: unknown[]) {
    this.children.push(...children);
  }
  on(name: string, fn: Handler) {
    const set = this.handlers.get(name) ?? new Set();
    set.add(fn);
    this.handlers.set(name, set);
  }
  off(name: string, fn: Handler) {
    this.handlers.get(name)?.delete(fn);
  }
  emit(name: string, event: unknown) {
    for (const fn of this.handlers.get(name) ?? []) fn(event);
  }
  removeFromParent() {
    // No parent in these tests.
  }
  destroy() {
    this.destroyed = true;
  }
}

class FakeSprite extends FakeContainer {
  constructor(readonly texture: unknown) {
    super();
  }
}

function fakePixi() {
  const textures: {
    source: { resource: unknown; update: ReturnType<typeof vi.fn> };
    destroy: ReturnType<typeof vi.fn>;
  }[] = [];
  return {
    textures,
    PIXI: {
      Container: FakeContainer,
      Sprite: FakeSprite,
      Rectangle: class {
        constructor(
          readonly x: number,
          readonly y: number,
          readonly width: number,
          readonly height: number,
        ) {}
      },
      Texture: {
        WHITE: { white: true },
        from(source: { resource: unknown }) {
          const texture = {
            source: { resource: source.resource, update: vi.fn() },
            destroy: vi.fn(),
          };
          textures.push(texture);
          return texture;
        },
      },
    },
  };
}

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="11" y="11" width="18" height="18" fill="#fff" stroke="#000" stroke-width="2"/></svg>';
const RED = [0xe5, 0x39, 0x35, 255];
const EMPTY = [0, 0, 0, 0];

async function setup(
  extra: Partial<PaintPageOptions> & { editor?: boolean; reducedMotion?: boolean } = {},
) {
  const { env, canvases, images } = fakeEnv();
  const { PIXI, textures } = fakePixi();
  const disposers: (() => void)[] = [];
  const render = vi.fn();
  const scene = {
    PIXI,
    dpr: 1,
    editor: extra.editor === true,
    reducedMotion: extra.reducedMotion === true,
    app: { render },
    dispose: (fn: () => void) => disposers.push(fn),
  };
  const page = await createPaintPage(scene, { art: SVG, width: 40, height: 40, ...extra }, env);
  // Canvases in creation order: ink, paint, live stroke.
  const [ink, layer, live] = canvases as [FakeCanvas, FakeCanvas, FakeCanvas];
  return {
    page,
    ink,
    layer,
    live,
    canvases,
    images,
    textures,
    disposers,
    render,
    view: page.view as FakeContainer,
  };
}

const pointer = (x: number, y: number, id = 1) => ({
  pointerId: id,
  pointerType: 'touch',
  pressure: 0.5,
  getLocalPosition: () => ({ x, y }),
});

const line = (y: number, from: number, to: number) =>
  Array.from({ length: Math.abs(to - from) / 2 + 1 }, (_, i) => [
    from + Math.sign(to - from) * i * 2,
    y,
  ]);

let open: PaintPage | undefined;
afterEach(() => {
  open?.dispose();
  open = undefined;
});

describe('paint palettes', () => {
  it('offers named kid-friendly palettes of at least ten colours', () => {
    expect(paint.palettes).toEqual(expect.arrayContaining(['bright', 'pastel', 'earth', 'skin']));
    for (const name of paint.palettes) {
      const list = paint.palette(name);
      expect(list.length).toBeGreaterThanOrEqual(10);
      for (const hex of list) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(paint.palette('nope')).toBe(paint.palette('bright'));
    expect(paint.colorName('#E53935')).toBe('red');
  });
});

describe('paint raster helpers', () => {
  it('normalises colours', () => {
    expect(hexColor('#ABC')).toBe('#aabbcc');
    expect(hexColor(0xff8800)).toBe('#ff8800');
    expect(hexColor('red')).toBeUndefined();
  });

  it('sizes an SVG to its contained rectangle', () => {
    const { svg, fit } = sizedSvg('<svg viewBox="0 0 200 100" width="5"><g/></svg>', 100, 100);
    expect(fit).toEqual({ x: 0, y: 25, w: 100, h: 50 });
    expect(svg).toBe('<svg width="100" height="50" viewBox="0 0 200 100"><g/></svg>');
  });
});

describe('paint.page', () => {
  it('turns the line art into ink: lines opaque, white paper transparent', async () => {
    const { page, ink, view, textures } = await setup();
    open = page;
    expect(ink.at(10, 20)).toEqual([0, 0, 0, 255]);
    expect(ink.at(20, 20)[3]).toBe(0);
    expect(ink.at(2, 2)[3]).toBe(0);
    // Paper, paint, live stroke, ink.
    expect(view.children).toHaveLength(4);
    expect(textures).toHaveLength(3);
    expect(view.eventMode).toBe('static');
  });

  it('fills a shape up to its lines and never paints a line pixel', async () => {
    const { page, layer } = await setup();
    open = page;
    expect(page.fillAt(20, 20)).toBe(true);
    expect(layer.at(20, 20)).toEqual(RED);
    expect(layer.at(12, 12)).toEqual(RED);
    expect(layer.at(27, 27)).toEqual(RED);
    for (const [x, y] of [
      [10, 20],
      [11, 20],
      [28, 20],
      [29, 20],
      [20, 10],
      [20, 29],
    ] as const) {
      expect(layer.at(x, y)).toEqual(EMPTY);
    }
    expect(layer.at(5, 5)).toEqual(EMPTY);
    expect(layer.at(35, 35)).toEqual(EMPTY);
    // The outside is a region of its own.
    page.color = '#1e88e5';
    page.fillAt(2, 2);
    expect(layer.at(35, 35)).toEqual([0x1e, 0x88, 0xe5, 255]);
    expect(layer.at(20, 20)).toEqual(RED);
    expect(layer.at(10, 20)).toEqual(EMPTY);
  });

  it('bounds a fill by the lines even where earlier paint runs under them', async () => {
    const { page, layer } = await setup({ size: 6 });
    open = page;
    page.color = '#1e88e5';
    expect(page.stroke(line(20, 0, 38))).toBe(true);
    const blue = [0x1e, 0x88, 0xe5, 255];
    expect(layer.at(10, 20)).toEqual(blue);
    expect(layer.at(34, 20)).toEqual(blue);
    // Fill the stroke's inside part green: the part outside the square stays blue.
    page.color = '#43a047';
    expect(page.fillAt(20, 20)).toBe(true);
    expect(layer.at(20, 20)).toEqual([0x43, 0xa0, 0x47, 255]);
    expect(layer.at(10, 20)).toEqual(blue);
    expect(layer.at(29, 20)).toEqual(blue);
    expect(layer.at(34, 20)).toEqual(blue);
    expect(layer.at(5, 20)).toEqual(blue);
    // The unpainted rest of the inside was not reached through the stroke.
    expect(layer.at(20, 14)).toEqual(EMPTY);
  });

  it('fills the nearest open region when a tap lands on a line', async () => {
    const { page, layer } = await setup();
    open = page;
    expect(page.fillAt(11, 20)).toBe(true);
    expect(layer.at(11, 20)).toEqual(EMPTY);
    // Either side of the line is fine for a child's tap; one region got the colour.
    const inside = layer.at(20, 20)[3] === 255;
    const outside = layer.at(5, 5)[3] === 255;
    expect(inside !== outside).toBe(true);
  });

  it('recolours a filled region even with a close colour, and ignores the same colour', async () => {
    const { page, layer } = await setup();
    open = page;
    page.color = '#d1c4e9';
    page.fillAt(20, 20);
    page.color = '#f3e5f5';
    expect(page.fillAt(20, 20)).toBe(true);
    expect(layer.at(20, 20)).toEqual([0xf3, 0xe5, 0xf5, 255]);
    expect(page.fillAt(20, 20)).toBe(false);
  });

  it('draws brush strokes and erases them', async () => {
    const { page, layer } = await setup({ size: 6 });
    open = page;
    page.color = 0x5e35b1;
    expect(page.stroke(line(5, 2, 36))).toBe(true);
    expect(layer.at(20, 5)).toEqual([0x5e, 0x35, 0xb1, 255]);
    expect(layer.at(20, 15)).toEqual(EMPTY);
    expect(page.stroke(line(5, 10, 30), 'eraser')).toBe(true);
    expect(layer.at(20, 5)).toEqual(EMPTY);
    expect(layer.at(3, 5)[3]).toBe(255);
  });

  it('undoes, redoes and clears', async () => {
    const { page, layer } = await setup();
    open = page;
    const changes: string[] = [];
    page.on('change', (detail) => changes.push(detail?.kind ?? ''));
    expect(page.canUndo).toBe(false);
    page.fillAt(20, 20);
    page.color = '#fdd835';
    page.fillAt(2, 2);
    expect(page.undo()).toBe(true);
    expect(layer.at(2, 2)).toEqual(EMPTY);
    expect(layer.at(20, 20)).toEqual(RED);
    expect(page.undo()).toBe(true);
    expect(layer.at(20, 20)).toEqual(EMPTY);
    expect(page.undo()).toBe(false);
    expect(page.redo()).toBe(true);
    expect(layer.at(20, 20)).toEqual(RED);
    expect(page.canRedo).toBe(true);
    expect(page.clear()).toBe(true);
    expect(layer.at(20, 20)).toEqual(EMPTY);
    // A new change drops the redo branch.
    expect(page.canRedo).toBe(false);
    expect(page.clear()).toBe(false);
    expect(page.undo()).toBe(true);
    expect(layer.at(20, 20)).toEqual(RED);
    expect(page.redo()).toBe(true);
    expect(layer.at(20, 20)).toEqual(EMPTY);
    expect(changes).toEqual(['fill', 'fill', 'undo', 'undo', 'redo', 'clear', 'undo', 'redo']);
  });

  it('keeps a bounded history', async () => {
    const { page } = await setup({ history: 3 });
    open = page;
    const colours = ['#e53935', '#fb8c00', '#fdd835', '#7cb342', '#00897b'];
    for (const colour of colours) {
      page.color = colour;
      page.fillAt(20, 20);
    }
    let undone = 0;
    while (page.undo()) undone += 1;
    expect(undone).toBe(3);
  });

  it('paints from pointer events: a tap fills, a drag strokes, a second finger is ignored', async () => {
    const { page, layer, live, view, textures } = await setup({ size: 6 });
    open = page;
    view.emit('pointerdown', pointer(20, 20));
    expect(layer.at(20, 20)).toEqual(RED);

    page.setTool('brush');
    page.setColor('#212121');
    view.emit('pointerdown', pointer(2, 4));
    view.emit('pointerdown', pointer(2, 36, 2));
    for (const [x] of line(4, 2, 36)) view.emit('globalpointermove', pointer(x ?? 0, 4));
    view.emit('globalpointermove', pointer(20, 36, 2));
    // Live: drawn on the stroke layer, not yet on the paint.
    expect(live.at(20, 4)[3]).toBe(255);
    expect(layer.at(20, 4)).toEqual(EMPTY);
    expect(textures[1]?.source.update).toHaveBeenCalled();
    view.emit('pointerup', pointer(36, 4, 2));
    expect(layer.at(20, 4)).toEqual(EMPTY);
    view.emit('pointerup', pointer(36, 4));
    expect(layer.at(20, 4)).toEqual([0x21, 0x21, 0x21, 255]);
    expect(live.at(20, 4)).toEqual(EMPTY);
    expect(layer.at(20, 36)).toEqual(EMPTY);
  });

  it('renders but ignores input in the editor, and renders still scenes on change', async () => {
    const { page, view, render } = await setup({ editor: true });
    open = page;
    expect(view.eventMode).toBe('none');
    expect(view.handlers.size).toBe(0);
    page.fillAt(20, 20);
    expect(render).toHaveBeenCalled();
  });

  it('flattens paper, paint and ink into a PNG', async () => {
    const { page, canvases } = await setup();
    open = page;
    page.fillAt(20, 20);
    expect(page.toDataURL()).toBe('data:image/png;fake');
    const flat = canvases[canvases.length - 1];
    expect(flat?.width).toBe(0);
  });

  it('registers with the scene and releases everything on dispose', async () => {
    const { page, view, textures, disposers } = await setup();
    const gone = vi.fn();
    page.on('dispose', gone);
    expect(disposers).toHaveLength(1);
    disposers[0]?.();
    expect(gone).toHaveBeenCalledOnce();
    expect(view.destroyed).toBe(true);
    expect(view.handlers.get('pointerdown')?.size).toBe(0);
    for (const texture of textures) expect(texture.destroy).toHaveBeenCalledWith(true);
    expect(page.fillAt(20, 20)).toBe(false);
  });

  it('refuses a missing Pixi namespace and art it would have to fetch', async () => {
    const { env } = fakeEnv();
    const { PIXI } = fakePixi();
    await expect(createPaintPage({}, { art: SVG, width: 40, height: 40 }, env)).rejects.toThrow(
      /scene/,
    );
    await expect(
      createPaintPage(PIXI, { art: 'https://example.com/a.svg', width: 40, height: 40 }, env),
    ).rejects.toThrow(/data: image URL/);
  });

  it('accepts a texture as art', async () => {
    const { env, canvases } = fakeEnv();
    const { PIXI } = fakePixi();
    const image = new FakeImage();
    const page = await createPaintPage(
      PIXI,
      {
        art: { source: { resource: image, pixelWidth: 40, pixelHeight: 40 } },
        width: 40,
        height: 40,
      },
      env,
    );
    open = page;
    expect(canvases[0]?.at(10, 20)).toEqual([0, 0, 0, 255]);
  });
});

describe('paint.swatches', () => {
  it('wires colour, tool and action buttons inside the root with aria state', async () => {
    const { page, layer } = await setup();
    open = page;
    const root = document.createElement('div');
    root.innerHTML = `
      <button data-paint-color="#7cb342">Green</button>
      <button data-paint-color=""></button>
      <button data-paint-color="3"></button>
      <div data-paint-tool="brush">Brush</div>
      <button data-paint-tool="fill">Fill</button>
      <button data-paint-tool="eraser">Eraser</button>
      <button data-paint-action="undo">Undo</button>
      <button data-paint-action="redo">Redo</button>`;
    const outside = document.createElement('button');
    outside.setAttribute('data-paint-color', '#000000');
    document.body.append(root, outside);
    const swatches = paint.swatches(root, page);
    const [green, first, fourth] = [
      ...root.querySelectorAll<HTMLButtonElement>('[data-paint-color]'),
    ];
    const [brush, fill, eraser] = [...root.querySelectorAll<HTMLElement>('[data-paint-tool]')];
    const [undo, redo] = [...root.querySelectorAll<HTMLButtonElement>('[data-paint-action]')];

    expect(first?.getAttribute('aria-label')).toBe('red');
    expect(first?.style.backgroundColor).not.toBe('');
    expect(fourth?.getAttribute('aria-label')).toBe('green');
    expect(first?.getAttribute('aria-pressed')).toBe('true');
    expect(fill?.getAttribute('aria-pressed')).toBe('true');
    expect(undo?.getAttribute('aria-disabled')).toBe('true');
    expect(brush?.getAttribute('role')).toBe('button');

    green?.click();
    expect(page.color).toBe('#7cb342');
    expect(green?.getAttribute('aria-pressed')).toBe('true');
    expect(first?.getAttribute('aria-pressed')).toBe('false');
    outside.click();
    expect(page.color).toBe('#7cb342');

    page.fillAt(20, 20);
    expect(undo?.getAttribute('aria-disabled')).toBe('false');
    undo?.click();
    expect(layer.at(20, 20)).toEqual(EMPTY);
    expect(redo?.getAttribute('aria-disabled')).toBe('false');

    brush?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(page.tool).toBe('brush');
    eraser?.click();
    expect(page.tool).toBe('eraser');
    fourth?.click();
    expect(page.tool).toBe('brush');

    swatches.dispose();
    fill?.click();
    expect(page.tool).toBe('brush');
    root.remove();
    outside.remove();
  });
});
