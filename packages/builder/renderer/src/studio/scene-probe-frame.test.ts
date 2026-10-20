import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SceneProbeFrameReport } from './scene-probe-report';
import {
  studioProbeContexts,
  studioSceneProbe,
  type StudioProbeSeen,
  type StudioProbeSettings,
} from './scene-probe-frame';

/*
  creative-power Phase 2 E (2026-10-12): the probe as it runs inside the preview document. jsdom
  lays nothing out and draws nothing, so the geometry, the hit test and the canvas pixels are
  stubbed; the timeline, the verdicts and the report's shape are the real code's. The browser
  test (apps/evals pixi-creative/probe.browser.test.ts) runs it on real Pixi in Chromium.
*/

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function place(element: Element, box: Box): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: box.x,
      top: box.y,
      right: box.x + box.width,
      bottom: box.y + box.height,
      width: box.width,
      height: box.height,
      x: box.x,
      y: box.y,
    }),
  });
}

/** A 2D context whose pixels the test chooses: uniform (blank) or with a drawn spot. */
function paint(win: Window, ink: () => boolean): void {
  const Canvas = (win as Window & typeof globalThis).HTMLCanvasElement;
  vi.spyOn(Canvas.prototype, 'getContext').mockImplementation(function context(
    this: HTMLCanvasElement,
  ) {
    const width = (): number => this.width;
    const height = (): number => this.height;
    return {
      drawImage: () => undefined,
      getImageData: () => {
        const data = new Uint8ClampedArray(width() * height() * 4).fill(20);
        if (ink()) for (let at = 0; at < 4 * 400; at += 1) data[at] = 250;
        return { data };
      },
    } as unknown as RenderingContext;
  });
}

interface Probe {
  readonly doc: Document;
  readonly win: Window & typeof globalThis;
  readonly region: HTMLElement;
  readonly seen: StudioProbeSeen;
  readonly posted: Record<string, unknown>[];
}

function frame(markup: string): Probe {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const win = iframe.contentWindow as Window & typeof globalThis;
  const doc = win.document;
  doc.body.innerHTML = `<div id="ck-preview"><div data-ck-js="x" data-ck-js-id="probe">${markup}</div></div>`;
  const region = doc.querySelector<HTMLElement>('[data-ck-js]')!;
  place(region, { x: 0, y: 0, width: 800, height: 450 });
  return { doc, win, region, seen: { errors: [] }, posted: [] };
}

function settings(over: Partial<StudioProbeSettings> = {}): StudioProbeSettings {
  return {
    deadline: Date.now() + 3_000,
    canvasWaitMs: 200,
    settleMs: 40,
    expectCanvas: true,
    click: false,
    ...over,
  };
}

async function reported(probe: Probe): Promise<SceneProbeFrameReport> {
  await vi.waitFor(
    () => {
      expect(probe.posted.some(({ type }) => type === 'ck-preview:probe')).toBe(true);
    },
    { timeout: 4_000, interval: 20 },
  );
  const message = probe.posted.find(({ type }) => type === 'ck-preview:probe');
  return message?.['report'] as SceneProbeFrameReport;
}

function run(
  probe: Probe,
  over: Partial<StudioProbeSettings> = {},
  capture?: Parameters<typeof studioSceneProbe>[4],
): void {
  studioSceneProbe(
    probe.win,
    probe.seen,
    (message) => {
      probe.posted.push(message);
    },
    settings(over),
    capture,
  );
}

const PICTURE = {
  width: 640,
  height: 360,
  type: 'image/jpeg',
  quality: 0.72,
  maxChars: 140_000,
} as const;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('studioSceneProbe (in the preview document)', () => {
  it('reports the runtime scroll span independently of canvas coverage', async () => {
    const probe = frame('<canvas width="800" height="450" data-ck-scroll-pinned="true"></canvas>');
    place(probe.region, { x: 0, y: 0, width: 800, height: 1800 });
    place(probe.doc.querySelector('canvas')!, { x: 0, y: 0, width: 800, height: 450 });
    paint(probe.win, () => true);
    run(probe);
    const report = await reported(probe);
    expect(report.canvas?.scrollPinned).toBe(true);
    expect(report.covers).toBe(false);
  });

  it('measures the region, its canvas and controls, and reports every error the bridge saw', async () => {
    const probe = frame(
      '<button id="next">Next</button><a id="more" href="#more">Read more</a><button id="gone" style="display:none">Gone</button><canvas width="800" height="450"></canvas>',
    );
    const { doc, region } = probe;
    const canvas = doc.querySelector('canvas')!;
    const next = doc.getElementById('next')!;
    const more = doc.getElementById('more')!;
    place(canvas, { x: 0, y: 0, width: 800, height: 450 });
    place(next, { x: 10, y: 10, width: 60, height: 30 });
    place(more, { x: 790, y: 10, width: 80, height: 30 });
    place(doc.getElementById('gone')!, { x: 0, y: 0, width: 0, height: 0 });
    canvas.style.pointerEvents = 'none';
    const hits: string[] = [];
    Object.defineProperty(doc, 'elementFromPoint', {
      configurable: true,
      value: (x: number) => {
        hits.push(canvas.style.pointerEvents);
        return x < 100 ? canvas : more;
      },
    });
    paint(probe.win, () => false);
    probe.seen.errors.push({ message: 'x is not defined', line: 3 });

    run(probe);
    const report = await reported(probe);

    expect(report.region).toEqual({ x: 0, y: 0, width: 800, height: 450 });
    expect(report.canvas).toEqual({
      rect: { x: 0, y: 0, width: 800, height: 450 },
      width: 800,
      height: 450,
      scrollPinned: false,
    });
    expect(report.covers).toBe(true);
    expect(report.controls).toEqual([
      {
        label: 'Next',
        tag: 'button',
        rect: { x: 10, y: 10, width: 60, height: 30 },
        outside: false,
        covered: 'canvas',
      },
      {
        label: 'Read more',
        tag: 'a',
        rect: { x: 790, y: 10, width: 80, height: 30 },
        outside: true,
        covered: null,
      },
    ]);
    // The canvas is hit-tested as if it took input, then given its own pointer-events back.
    expect(hits).toEqual(['auto', 'auto']);
    expect(canvas.style.pointerEvents).toBe('none');
    expect(report.blank).toBe(true);
    expect(report.ink).toBe(0);
    expect(report.errors).toEqual([{ message: 'x is not defined', line: 3 }]);
    expect(report.click).toBeNull();
    expect(report.hidden).toBe(false);
    expect(report.overflowX).toBe(0);
    expect(region.contains(canvas)).toBe(true);
  });

  it('reads a drawn canvas as not blank', async () => {
    const probe = frame('<canvas width="320" height="180"></canvas>');
    place(probe.doc.querySelector('canvas')!, {
      x: 0,
      y: 0,
      width: 320,
      height: 180,
    });
    paint(probe.win, () => true);
    run(probe);
    const report = await reported(probe);
    expect(report.blank).toBe(false);
    expect(report.ink).toBeGreaterThan(0);
  });

  it('posts by its deadline when no canvas ever comes, saying how long it waited', async () => {
    const probe = frame('<p>Words only</p>');
    run(probe, { canvasWaitMs: 150 });
    const report = await reported(probe);
    expect(report.canvas).toBeNull();
    expect(report.covers).toBeNull();
    expect(report.blank).toBeNull();
    expect(report.waitedMs).toBeGreaterThanOrEqual(150);
  });

  it('clicks the first visible Start once: alive when it changes the region, dead when nothing changes', async () => {
    for (const wired of [true, false]) {
      const probe = frame(
        '<button id="help">Help</button><button id="start">Start</button><output id="status">ready</output><canvas width="64" height="36"></canvas>',
      );
      const { doc } = probe;
      place(doc.querySelector('canvas')!, {
        x: 0,
        y: 0,
        width: 800,
        height: 450,
      });
      for (const id of ['help', 'start']) {
        place(doc.getElementById(id)!, { x: 10, y: 10, width: 60, height: 30 });
      }
      const clicks: string[] = [];
      doc.getElementById('help')?.addEventListener('click', () => clicks.push('help'));
      doc.getElementById('start')?.addEventListener('click', () => {
        clicks.push('start');
        if (wired) doc.getElementById('status')!.textContent = 'running';
      });
      paint(probe.win, () => true);

      run(probe, { click: true });
      const report = await reported(probe);

      expect(clicks).toEqual(['start']);
      expect(report.click).toEqual({ label: 'Start', changed: wired });
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    }
  }, 10_000);
});

describe('studioSceneProbe — the picture (visual self-review, 2026-10-13)', () => {
  it('takes one picture as the scene is measured and posts it on the report', async () => {
    const probe = frame('<canvas width="320" height="180"></canvas>');
    place(probe.doc.querySelector('canvas')!, { x: 0, y: 0, width: 320, height: 180 });
    paint(probe.win, () => true);
    const thumbnail = { dataUrl: 'data:image/jpeg;base64,QQ==', width: 640, height: 360, ink: 0.4 };
    const capture = vi.fn((_win: Window, _settings: unknown, done: (value: never) => void) => {
      setTimeout(() => {
        done(thumbnail as never);
      }, 20);
    });

    run(probe, { thumbnail: PICTURE }, capture);
    const report = await reported(probe);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[1]).toEqual(PICTURE);
    expect(report.thumbnail).toEqual(thumbnail);
  });

  it('posts by its deadline without a picture that never comes, and asks for none unasked', async () => {
    const probe = frame('<canvas width="320" height="180"></canvas>');
    place(probe.doc.querySelector('canvas')!, { x: 0, y: 0, width: 320, height: 180 });
    paint(probe.win, () => true);
    run(probe, { thumbnail: PICTURE, deadline: Date.now() + 700 }, () => undefined);
    expect((await reported(probe)).thumbnail).toBeNull();

    const plain = frame('<canvas width="320" height="180"></canvas>');
    place(plain.doc.querySelector('canvas')!, { x: 0, y: 0, width: 320, height: 180 });
    const capture = vi.fn();
    run(plain, {}, capture);
    const report = await reported(plain);
    expect(capture).not.toHaveBeenCalled();
    expect(report).not.toHaveProperty('thumbnail');
  });
});

describe('studioProbeContexts', () => {
  it('opens every WebGL context with a kept drawing buffer and no multisampling', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const win = iframe.contentWindow as Window & typeof globalThis;
    const asked: unknown[][] = [];
    win.HTMLCanvasElement.prototype.getContext = function getContext(...args: unknown[]) {
      asked.push(args);
      return null;
    } as typeof win.HTMLCanvasElement.prototype.getContext;
    studioProbeContexts(win);
    const canvas = win.document.createElement('canvas');
    canvas.getContext('webgl2', { alpha: true, antialias: true });
    canvas.getContext('2d');
    expect(asked).toEqual([
      ['webgl2', { alpha: true, antialias: false, preserveDrawingBuffer: true }],
      ['2d', undefined],
    ]);
  });
});
