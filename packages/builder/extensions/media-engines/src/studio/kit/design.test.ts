import { afterEach, describe, expect, it, vi } from 'vitest';

import { createScene } from './create-scene';
import { createDesign, fitDesign, type DesignZoomHost } from './design';
import type { SceneApp, SceneHost, SceneTicker } from './types';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** A Pixi Container's transform, structurally (the kit receives the page's namespace). */
class FakeContainer {
  x = 0;
  y = 0;
  readonly children: unknown[] = [];
  readonly scale = {
    x: 1,
    y: 1,
    set: (value: number) => {
      this.scale.x = value;
      this.scale.y = value;
    },
  };
  readonly position = {
    set: (x: number, y: number) => {
      this.x = x;
      this.y = y;
    },
  };
  addChild(child: unknown): void {
    this.children.push(child);
  }
}
const PIXI = { Container: FakeContainer };

function fakeApp(width: number, height: number) {
  const callbacks = new Set<(ticker: SceneTicker) => void>();
  const ticker: SceneTicker = {
    deltaMS: 1000 / 60,
    started: false,
    maxFPS: 60,
    add(fn) {
      callbacks.add(fn);
    },
    remove(fn) {
      callbacks.delete(fn);
    },
    start() {
      Object.assign(this, { started: true });
    },
    stop() {
      Object.assign(this, { started: false });
    },
  };
  const screen = { width, height };
  const background = { color: 0 as unknown, alpha: 0 };
  const app: SceneApp & { screen: { width: number; height: number } } = {
    ticker,
    stage: new FakeContainer(),
    screen,
    renderer: { resolution: 1, background },
    render: vi.fn(),
  };
  return {
    app,
    background,
    resize(nextWidth: number, nextHeight: number) {
      screen.width = nextWidth;
      screen.height = nextHeight;
      for (const fn of callbacks) fn(ticker);
    },
  };
}

const HOST = {
  canvas: document.createElement('canvas'),
  root: document.createElement('section'),
  interactive: true,
  calm: false,
  render: () => undefined,
  letterbox: null,
};

describe('fitDesign — a 1280 × 720 design in every region shape', () => {
  it.each([
    // [region, fit] → scale, x, y
    [1280, 720, 'contain', 1, 0, 0],
    [1920, 1080, 'contain', 1.5, 0, 0],
    // 4:3 tablet: the width limits, bands above and below.
    [1024, 768, 'contain', 0.8, 0, 96],
    // 390 × 320 phone section (the free-code card's stage): the width limits.
    [390, 320, 'contain', 390 / 1280, 0, (320 - 720 * (390 / 1280)) / 2],
    // 21:9 ultrawide: the height limits, bands left and right.
    [2560, 1080, 'contain', 1.5, (2560 - 1920) / 2, 0],
    // cover fills, cropping the other axis.
    [1024, 768, 'cover', 768 / 720, (1024 - 1280 * (768 / 720)) / 2, 0],
    [2560, 1080, 'cover', 2, 0, (1080 - 1440) / 2],
    [390, 844, 'cover', 844 / 720, (390 - 1280 * (844 / 720)) / 2, 0],
    // width / height: that side fills whatever the other does.
    [390, 844, 'width', 390 / 1280, 0, (844 - 720 * (390 / 1280)) / 2],
    [2560, 1080, 'width', 2, 0, (1080 - 1440) / 2],
    [390, 844, 'height', 844 / 720, (390 - 1280 * (844 / 720)) / 2, 0],
    [1024, 768, 'height', 768 / 720, (1024 - 1280 * (768 / 720)) / 2, 0],
  ] as const)('%s × %s %s', (width, height, fit, scale, x, y) => {
    const placed = fitDesign(width, height, 1280, 720, fit);
    expect(placed.scale).toBeCloseTo(scale, 9);
    expect(placed.x).toBeCloseTo(x, 6);
    expect(placed.y).toBeCloseTo(y, 6);
  });

  it('fits a portrait-first 720 × 1280 design on a phone and on a desktop', () => {
    expect(fitDesign(390, 844, 720, 1280)).toEqual({
      scale: 390 / 720,
      x: 0,
      y: (844 - 1280 * (390 / 720)) / 2,
    });
    const desktop = fitDesign(1280, 720, 720, 1280);
    expect(desktop.scale).toBeCloseTo(720 / 1280, 9);
    expect(desktop.x).toBeCloseTo((1280 - 720 * (720 / 1280)) / 2, 9);
    expect(desktop.y).toBe(0);
  });

  it('aligns a letterboxed or cropped design to the top or the bottom', () => {
    expect(fitDesign(390, 844, 1280, 720, 'contain', 'top').y).toBe(0);
    expect(fitDesign(390, 844, 1280, 720, 'contain', 'bottom').y).toBeCloseTo(
      844 - 720 * (390 / 1280),
      9,
    );
    expect(fitDesign(2560, 1080, 1280, 720, 'width', 'bottom').y).toBe(1080 - 1440);
    // Horizontal placement is always centred.
    expect(fitDesign(2560, 1080, 1280, 720, 'contain', 'top').x).toBe(320);
  });

  it('reads an unknown fit as contain', () => {
    expect(fitDesign(1024, 768, 1280, 720, 'stretch' as never)).toEqual(
      fitDesign(1024, 768, 1280, 720, 'contain'),
    );
  });
});

describe('createDesign — the world, its view and the pointer mapping', () => {
  it('adds one world to the stage, fitted, and maps region px into design units', () => {
    const { app } = fakeApp(390, 320);
    const runtime = createDesign(PIXI, app, { width: 1280, height: 720 }, undefined, HOST);
    expect((app.stage as FakeContainer).children).toEqual([runtime.world]);
    const scale = 390 / 1280;
    const top = (320 - 720 * scale) / 2;
    expect(runtime.design.scale).toBeCloseTo(scale, 9);
    expect(runtime.world.y).toBeCloseTo(top, 9);
    // The region's centre is the design's centre; its top-left is above the design (letterbox).
    expect(runtime.map(195, 160)).toEqual([640, 360]);
    const [x, y] = runtime.map(0, 0);
    expect(x).toBe(0);
    expect(y).toBeCloseTo(-top / scale, 9);
    expect(runtime.design.view.y).toBeCloseTo(-top / scale, 9);
    expect(runtime.design.view.height).toBeCloseTo(320 / scale, 9);
    expect(runtime.design.view.width).toBeCloseTo(1280, 9);
  });

  it('refits on layout after the region resizes, keeping the mapping exact', () => {
    const fake = fakeApp(1280, 720);
    const runtime = createDesign(PIXI, fake.app, { width: 1280, height: 720 }, undefined, HOST);
    expect(runtime.design.scale).toBe(1);
    const view = runtime.design.view;
    expect([view.x + 0, view.y + 0, view.width, view.height]).toEqual([0, 0, 1280, 720]);
    fake.app.screen.width = 2560;
    fake.app.screen.height = 1080;
    runtime.layout();
    expect(runtime.design.scale).toBe(1.5);
    expect(runtime.world.x).toBe(320);
    expect(runtime.map(320 + 1.5 * 100, 1.5 * 200)).toEqual([100, 200]);
    // A region with no size (hidden) keeps the last fit rather than collapsing to 0.
    fake.app.screen.width = 0;
    runtime.layout();
    expect(runtime.design.scale).toBe(1.5);
  });

  it('refuses a design without a size and a zoom without the viewport library', () => {
    const { app } = fakeApp(800, 450);
    expect(() => createDesign(PIXI, app, { width: 0, height: 720 }, undefined, HOST)).toThrow(
      /design needs width and height/u,
    );
    expect(() =>
      createDesign(PIXI, app, { width: 1280, height: 720, zoom: true }, undefined, HOST),
    ).toThrow(/libs:\['viewport'\]/u);
  });

  it('hands zoom to the camera: fitted on every layout and disposed with the scene', () => {
    const { app } = fakeApp(390, 320);
    const world = new FakeContainer();
    const fit = vi.fn();
    const dispose = vi.fn();
    let given: DesignZoomHost | undefined;
    const runtime = createDesign(
      PIXI,
      app,
      { width: 1280, height: 720, zoom: true, align: 'top', maxZoom: 6 },
      {
        zoomWorld: (host: DesignZoomHost) => {
          given = host;
          return { world, fit, dispose };
        },
      },
      HOST,
    );
    expect(runtime.world).toBe(world);
    expect(given).toMatchObject({ width: 1280, height: 720, align: 'top', maxZoom: 6, app });
    expect(fit).toHaveBeenCalledWith(390 / 1280, 0, 0, 390, 320);
    expect(runtime.design.zoom).toBe(true);
    runtime.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});

function sceneFixture(width: number, height: number, options: Record<string, unknown>) {
  const fake = fakeApp(width, height);
  const root = document.createElement('section');
  const canvas = document.createElement('canvas');
  root.append(canvas);
  document.body.append(root);
  const cleanup: (() => void)[] = [];
  const host: SceneHost = {
    root,
    reducedMotion: false,
    editor: false,
    onDispose: (fn) => cleanup.push(fn),
    reportError: vi.fn(),
  };
  const scene = createScene(host, PIXI, fake.app, canvas, {}, options);
  return {
    ...fake,
    scene,
    dispose() {
      for (const fn of cleanup) fn();
    },
  };
}

describe('ck.scene({ design }) — the scene in design units', () => {
  it('gives s.world, s.design, design-unit pointers and a theme-coloured letterbox', () => {
    const run = sceneFixture(390, 320, { design: { width: 1280, height: 720 } });
    const { scene } = run;
    expect(scene.world).toBe((run.app.stage as FakeContainer).children[0]);
    expect(scene.design?.width).toBe(1280);
    expect(scene.design?.scale).toBeCloseTo(390 / 1280, 9);
    expect(run.background.alpha).toBe(1);
    expect(run.background.color).toBe(scene.palette.surface);
    // jsdom lays nothing out: the region's box is at 0,0, so clientX/Y are region px.
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 195, clientY: 160 }));
    expect(scene.pointer.x).toBeCloseTo(640, 9);
    expect(scene.pointer.y).toBeCloseTo(360, 9);
    // A readable minimum: 16 CSS px is 52.5 design units at this scale.
    expect(scene.ui(16)).toBeCloseTo(16 / (390 / 1280), 9);
    expect(scene.compact).toBe(true);
    expect(scene.portrait).toBe(false);
    run.dispose();
  });

  it('refits before the scene’s own resize callbacks and updates the breakpoints', () => {
    const run = sceneFixture(390, 320, { design: { width: 1280, height: 720, fit: 'cover' } });
    const seen: number[] = [];
    run.scene.onResize(() => seen.push(run.scene.design?.scale ?? 0));
    run.resize(1280, 960);
    expect(seen).toEqual([960 / 720]);
    expect(run.scene.compact).toBe(false);
    run.resize(390, 844);
    expect(seen.at(-1)).toBeCloseTo(844 / 720, 9);
    expect(run.scene.portrait).toBe(true);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 195, clientY: 422 }));
    expect(run.scene.pointer.x).toBeCloseTo(640, 6);
    expect(run.scene.pointer.y).toBeCloseTo(360, 6);
    // nx/ny stay fractions of the region.
    run.dispose();
  });

  it('keeps the stage, CSS px pointers and a transparent canvas without design', () => {
    const run = sceneFixture(800, 450, { background: null });
    expect(run.scene.world).toBe(run.app.stage);
    expect(run.scene.design).toBeNull();
    expect((run.app.stage as FakeContainer).children).toEqual([]);
    expect(run.background.alpha).toBe(0);
    expect(run.scene.ui(16)).toBe(16);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 120, clientY: 80 }));
    expect([run.scene.pointer.x, run.scene.pointer.y]).toEqual([120, 80]);
    run.dispose();
  });

  it('leaves a chosen background alone and disposes the camera with the scene', () => {
    const fake = fakeApp(390, 320);
    const root = document.createElement('section');
    const canvas = document.createElement('canvas');
    root.append(canvas);
    const cleanup: (() => void)[] = [];
    const dispose = vi.fn();
    const scene = createScene(
      { root, reducedMotion: true, editor: true, onDispose: (fn) => cleanup.push(fn) },
      PIXI,
      fake.app,
      canvas,
      {
        viewport: {
          zoomWorld: (host: DesignZoomHost) => {
            expect(host).toMatchObject({ interactive: false, calm: true, canvas, root });
            return { world: new FakeContainer(), fit: vi.fn(), dispose };
          },
        },
      },
      { background: '#101525', design: { width: 1280, height: 720, zoom: true } },
    );
    expect(scene.design?.zoom).toBe(true);
    expect(fake.background.alpha).toBe(0);
    for (const fn of cleanup) fn();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
