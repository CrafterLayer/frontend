import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  studioProbeCapture,
  type StudioProbeThumbnail,
  type StudioProbeThumbnailSettings,
} from './scene-probe-capture';

/*
  Visual self-review (2026-10-13): the picture the scene probe takes inside the preview document.
  jsdom draws nothing and loads no SVG picture, so the 2D context, `toDataURL` and `Image` are
  stand-ins; what is under test is the picture's MAKING — the page cloned without its scripts,
  each canvas swapped for an image of its frame, the document's styles carried in, the size it is
  scaled to, and every way it answers null. The browser test runs it in Chromium.
*/

const SETTINGS: StudioProbeThumbnailSettings = {
  width: 640,
  height: 360,
  type: 'image/jpeg',
  quality: 0.72,
  maxChars: 140_000,
};

interface Stage {
  readonly win: Window & typeof globalThis;
  readonly doc: Document;
  /** Every SVG the capture asked an Image to load, decoded. */
  readonly svgs: string[];
}

/** A preview document at 1280×720 holding a section with text, a button, a canvas and a script. */
function stage(options: { readonly load?: 'ok' | 'error' | 'never'; readonly url?: string } = {}) {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const win = iframe.contentWindow as Window & typeof globalThis;
  const doc = win.document;
  doc.documentElement.setAttribute('lang', 'ar');
  doc.documentElement.setAttribute('dir', 'rtl');
  const style = doc.createElement('style');
  style.textContent = ':root{--t-surface:#101820}.hero{color:var(--t-surface)}';
  doc.head.appendChild(style);
  doc.body.innerHTML =
    '<div id="ck-preview"><section class="hero"><h1>Night garden</h1><button>Start</button>' +
    '<canvas width="1280" height="720" style="position:absolute;inset:0"></canvas></section></div>' +
    '<script>window.secret = 1;</script>';
  const canvas = doc.querySelector('canvas')!;
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }),
  });
  Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(win, 'innerHeight', { configurable: true, value: 720 });

  const Canvas = win.HTMLCanvasElement;
  vi.spyOn(Canvas.prototype, 'getContext').mockImplementation(function context(
    this: HTMLCanvasElement,
  ) {
    const width = this.width;
    const height = this.height;
    return {
      fillStyle: '',
      fillRect: () => undefined,
      drawImage: () => undefined,
      // A drawn picture: a dark ground with a bright band across a fifth of it.
      getImageData: () => {
        const data = new Uint8ClampedArray(width * height * 4).fill(16);
        for (let at = 0; at < data.length / 5; at += 1) data[at] = 240;
        return { data };
      },
    } as unknown as RenderingContext;
  });
  vi.spyOn(Canvas.prototype, 'toDataURL').mockImplementation(function encode(type?: string) {
    if (type === 'image/png') return 'data:image/png;base64,UE5H';
    return options.url ?? 'data:image/jpeg;base64,SlBFRw==';
  });

  const svgs: string[] = [];
  const load = options.load ?? 'ok';
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      svgs.push(decodeURIComponent(value.replace(/^data:image\/svg\+xml;charset=utf-8,/u, '')));
      setTimeout(() => {
        if (load === 'ok') this.onload?.();
        if (load === 'error') this.onerror?.();
      }, 5);
    }
  }
  Object.defineProperty(win, 'Image', { configurable: true, value: FakeImage });
  return { win, doc, svgs } satisfies Stage;
}

function take(win: Window): Promise<StudioProbeThumbnail | null> {
  return new Promise((resolve) => {
    studioProbeCapture(win, SETTINGS, resolve);
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('studioProbeCapture (in the preview document)', () => {
  it('draws the whole page — its text, styles and stage — scaled into 640×360', async () => {
    const { win, doc, svgs } = stage();

    const thumbnail = await take(win);

    expect(thumbnail).toEqual({
      dataUrl: 'data:image/jpeg;base64,SlBFRw==',
      width: 640,
      height: 360,
      ink: expect.any(Number) as unknown,
    });
    expect(thumbnail?.ink).toBeGreaterThan(0.1);
    const [svg = ''] = svgs;
    // The page at its own viewport, in its language and direction.
    expect(svg).toContain('width="1280" height="720"');
    expect(svg).toContain('<foreignObject');
    expect(svg).toMatch(/lang="ar" dir="rtl"/u);
    // Its words, its styles, and its stage as a picture of the frame — never its scripts.
    expect(svg).toContain('Night garden');
    expect(svg).toContain('--t-surface:#101820');
    expect(svg).toMatch(/<img[^>]+src="data:image\/png;base64,UE5H"/u);
    // A `canvas` rule does not match the image: it carries the canvas's own layout inline.
    expect(svg).toMatch(/<img[^>]+style="[^"]*position: absolute[^"]*width: 1280px/u);
    expect(svg).not.toContain('<canvas');
    expect(svg).not.toContain('window.secret');
    // The live page is untouched: its canvas and script are still there.
    expect(doc.querySelector('canvas')).not.toBeNull();
    expect(doc.querySelector('script')).not.toBeNull();
  });

  it('answers null when the picture will not load, or is too big even at a lower quality', async () => {
    expect(await take(stage({ load: 'error' }).win)).toBeNull();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    const huge = `data:image/jpeg;base64,${'A'.repeat(200_000)}`;
    expect(await take(stage({ url: huge }).win)).toBeNull();
  });

  it('answers null — once — when the picture never arrives (1.5 s)', async () => {
    const { win } = stage({ load: 'never' });
    const done = vi.fn();
    studioProbeCapture(win, SETTINGS, done);
    await vi.waitFor(
      () => {
        expect(done).toHaveBeenCalledTimes(1);
      },
      { timeout: 3_000, interval: 50 },
    );
    expect(done).toHaveBeenCalledWith(null);
  });
});
