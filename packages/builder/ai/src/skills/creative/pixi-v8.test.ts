import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createCraftkitAiSkillRegistry } from '../index';
import { PIXI_V8_SKILLS, pixiSkillExamples } from './pixi-v8';

const PIXI_IDS = PIXI_V8_SKILLS.map(({ id }) => id);
const CORE = 'craftkit.pixi-v8-core';
const GRAPHICS = 'craftkit.pixi-v8-graphics';

function activeIds(request: string): readonly string[] {
  return createCraftkitAiSkillRegistry()
    .prepare({ request, auto: true })
    .active.map(({ id }) => id);
}

function pixiIds(request: string): readonly string[] {
  return activeIds(request).filter((id) => PIXI_IDS.includes(id));
}

describe('PixiJS v8 skills — activation', () => {
  it.each([
    ['Build a PixiJS scene for the hero', [CORE, GRAPHICS]],
    ['a generative mural of flowing lines for the about section', [CORE, GRAPHICS]],
    ['اعمل جدارية متحركة للهيرو', [CORE, GRAPHICS]],
    [
      'اعمل جدارية تفاعلية بالجزيئات تتحرك مع الماوس بألوان الموقع',
      [CORE, GRAPHICS, 'craftkit.pixi-v8-effects', 'craftkit.pixi-v8-interaction-perf'],
    ],
    ['add a shader background with free code', [CORE, 'craftkit.pixi-v8-effects']],
    // "mural" alone brings the graphics skill too.
    [
      'an image mural from my photos with sprites',
      [CORE, GRAPHICS, 'craftkit.pixi-v8-text-assets'],
    ],
    ['animate my logo as a sprite', [CORE, 'craftkit.pixi-v8-text-assets']],
    ['a glow that follows the mouse behind the hero', [CORE, 'craftkit.pixi-v8-interaction-perf']],
  ])('loads the Pixi skills for "%s"', (request, expected) => {
    expect([...pixiIds(request)].sort()).toEqual([...expected].sort());
  });

  it.each([
    'Change the hero title',
    'Make the background darker',
    'Add a testimonials section',
    'Add a hover effect on the cards',
    'Use a mesh gradient and a grain texture behind the hero',
    'Animate the heading on scroll',
    'كبّر حجم العنوان',
    'لما امرر الماوس على الزر يتغير لونه',
    'غير لون الخلفية',
    'صمم لي صفحة هبوط احترافية كاملة',
  ])('stays out of the unrelated request "%s"', (request) => {
    expect(pixiIds(request)).toEqual([]);
  });

  it('keeps every Pixi skill but the core dependent on the core', () => {
    for (const skill of PIXI_V8_SKILLS) {
      if (skill.id === CORE) continue;
      expect(skill.dependencies).toEqual([CORE]);
    }
  });

  it('keeps the widest Pixi request (all five) a bounded share of the skill budget', () => {
    const prepared = createCraftkitAiSkillRegistry().prepare({
      request: 'an interactive mural in PixiJS with particles and sprites',
      auto: true,
    });
    expect(prepared.active.map(({ id }) => id)).toEqual(expect.arrayContaining(PIXI_IDS));
    expect(prepared.omitted).toEqual([]);
    expect(prepared.totalTokens).toBeLessThan(7_000);
  });
});

/* ── The worked examples ─────────────────────────────────────────────────── */

const AsyncFunction = (
  Object.getPrototypeOf(async function () {
    /* the constructor is all this needs */
  }) as { constructor: new (name: string, body: string) => (ck: unknown) => Promise<unknown> }
).constructor;

const EXAMPLES = PIXI_V8_SKILLS.flatMap((skill) =>
  pixiSkillExamples(skill).map((code, index) => ({ id: `${skill.id}#${String(index)}`, code })),
);

/** v7 spellings an example must never teach. */
const V7_CALLS =
  /\b(?:beginFill|endFill|drawRect|drawCircle|drawRoundedRect|drawPolygon|lineStyle|beginHole|cacheAsBitmap|BaseTexture|SimpleRope|SimplePlane|NineSlicePlane)\b|new PIXI\.Application|app\.view|interactive\s*=\s*true|\.add\(\s*\(?\s*delta\b/u;

describe('PixiJS v8 skills — the examples', () => {
  it('gives every skill two worked examples', () => {
    for (const skill of PIXI_V8_SKILLS) expect(pixiSkillExamples(skill)).toHaveLength(2);
  });

  it.each(EXAMPLES)('$id compiles as the body of an async (ck) function', ({ code }) => {
    expect(() => new AsyncFunction('ck', code)).not.toThrow();
  });

  it.each(EXAMPLES)('$id teaches no v7 call', ({ code }) => {
    expect(code).not.toMatch(V7_CALLS);
  });

  it.each(EXAMPLES)('$id uses the CraftKit stage, single quotes only', ({ code }) => {
    expect(code).toContain('ck.stage(');
    expect(code).not.toContain('"');
  });
});

/* ── Against the real pixi.js v8 ─────────────────────────────────────────── */

/*
  pixi.js is not a dependency of this package; media-engines bundles it into
  ck-pixi.js, so the test borrows that copy. Without a browser there is no
  renderer: the examples build their scene objects for real (Graphics,
  gradients, Text, filters, particles, events) against a stub application,
  and their ticker callbacks run twice. Shaders are not compiled here.
*/
const mediaEngines = fileURLToPath(
  new URL('../../../../extensions/media-engines/package.json', import.meta.url),
);

function pixiPath(): string | undefined {
  try {
    return createRequire(mediaEngines).resolve('pixi.js');
  } catch {
    return undefined;
  }
}

interface PixiDisplayObject {
  readonly children: readonly PixiDisplayObject[];
  emit(event: string, payload?: unknown): boolean;
  listenerCount(event: string): number;
}

interface PixiNamespace {
  readonly Container: new () => PixiDisplayObject;
  readonly Rectangle: new (x: number, y: number, width: number, height: number) => unknown;
  readonly RenderTexture: { create(options: { width: number; height: number }): unknown };
  readonly DOMAdapter: { set(adapter: unknown): void };
}

/** A 2D context that answers every call: enough for gradients and text measurement. */
function stubContext(): unknown {
  const values: Record<PropertyKey, unknown> = {};
  return new Proxy(values, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') {
        return (text: string) => ({
          width: text.length * 10,
          actualBoundingBoxAscent: 8,
          actualBoundingBoxDescent: 2,
          fontBoundingBoxAscent: 8,
          fontBoundingBoxDescent: 2,
        });
      }
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return () => ({ addColorStop: () => undefined });
      }
      if (key === 'getImageData') {
        return (_x: number, _y: number, width: number, height: number) => ({
          data: new Uint8ClampedArray(Math.max(4, width * height * 4)),
        });
      }
      if (key === 'getShaderPrecisionFormat') return () => ({ precision: 23 });
      if (key === 'canvas') return undefined;
      return () => undefined;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

/** Stands in for CanvasRenderingContext2D and WebGLRenderingContext: nothing is ever one of these. */
class StubRenderingContext {
  readonly stub = true;
}

function stubAdapter() {
  const context = stubContext();
  return {
    createCanvas: (width = 1, height = 1) => ({
      width,
      height,
      style: {},
      getContext: () => context,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
    createImage: () => ({}),
    // Constructors pixi only compares against with instanceof.
    getCanvasRenderingContext2D: () => StubRenderingContext,
    getWebGLRenderingContext: () => StubRenderingContext,
    getNavigator: () => ({ userAgent: 'node', gpu: null }),
    getBaseUrl: () => 'http://localhost/',
    getFontFaceSet: () => null,
    fetch: () => Promise.reject(new Error('no network in tests')),
    parseXML: () => {
      throw new Error('no XML in tests');
    },
  };
}

type Tick = (ticker: { deltaTime: number; deltaMS: number }) => void;
type Listener = (event: { clientX: number; clientY: number }) => void;

function harness(PIXI: PixiNamespace, reducedMotion: boolean) {
  const ticks: Tick[] = [];
  const disposers: (() => void)[] = [];
  const listeners: Listener[] = [];
  const stage = new PIXI.Container();
  const app = {
    stage,
    screen: new PIXI.Rectangle(0, 0, 800, 400),
    ticker: {
      maxFPS: 0,
      add: (fn: Tick) => ticks.push(fn),
      start: () => undefined,
      stop: () => undefined,
    },
    renderer: {
      on: () => undefined,
      off: () => undefined,
      generateTexture: () => PIXI.RenderTexture.create({ width: 8, height: 8 }),
    },
  };
  const ck = {
    root: {
      querySelector: () => null,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }),
      addEventListener: (_type: string, fn: Listener) => listeners.push(fn),
      removeEventListener: () => undefined,
    },
    editor: false,
    reducedMotion,
    onDispose: (fn: () => void) => disposers.push(fn),
    pixi: () => Promise.resolve(PIXI),
    stage: () =>
      Promise.resolve({ PIXI, app, canvas: { setAttribute: () => undefined, style: {} } }),
  };
  return { ck, stage, ticks, disposers, listeners };
}

const resolvedPixi = pixiPath();

describe.skipIf(resolvedPixi === undefined)('PixiJS v8 skills — run against pixi.js', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  let pixi: PixiNamespace | undefined;

  // The first import of the whole library takes seconds; once, before the examples.
  beforeAll(async () => {
    pixi = (await import(resolvedPixi ?? 'pixi.js')) as PixiNamespace;
    pixi.DOMAdapter.set(stubAdapter());
  }, 60_000);

  function loadPixi(): PixiNamespace {
    if (pixi === undefined) throw new Error('pixi.js did not load');
    return pixi;
  }

  it('hears a v7 call: the deprecation check below is live', async () => {
    const PIXI = loadPixi();
    const heard: string[] = [];
    const record = (...args: unknown[]) => {
      heard.push(args.map(String).join(' '));
    };
    vi.spyOn(console, 'warn').mockImplementation(record);
    vi.spyOn(console, 'groupCollapsed').mockImplementation(record);
    vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
    const run = harness(PIXI, false);
    await new AsyncFunction(
      'ck',
      'const {PIXI,app}=await ck.stage();app.stage.addChild(new PIXI.Graphics().beginFill(0xff0000).drawRect(0,0,9,9).endFill())',
    )(run.ck);
    expect(heard.filter((warning) => /deprecat/iu.test(warning)).length).toBeGreaterThan(0);
  });

  it.each(EXAMPLES.flatMap((example) => [false, true].map((reduced) => ({ ...example, reduced }))))(
    '$id builds its scene with no deprecation warning (reduced motion: $reduced)',
    async ({ code, reduced }) => {
      const PIXI = loadPixi();
      const warnings: string[] = [];
      const record = (...args: unknown[]) => {
        warnings.push(args.map(String).join(' '));
      };
      vi.spyOn(console, 'warn').mockImplementation(record);
      vi.spyOn(console, 'groupCollapsed').mockImplementation(record);
      vi.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
      vi.stubGlobal('document', { fonts: { load: () => Promise.resolve([]) }, hidden: false });
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          readonly observed: unknown[] = [];
          observe(target: unknown): void {
            this.observed.push(target);
          }
          disconnect(): void {
            this.observed.length = 0;
          }
        },
      );

      const run = harness(PIXI, reduced);
      await new AsyncFunction('ck', code)(run.ck);

      // An example that adds to the stage did so — unless it waits for a page image there is none of.
      if (code.includes('addChild(') && !code.includes('querySelector(')) {
        expect(run.stage.children.length).toBeGreaterThan(0);
      }
      for (const listener of run.listeners) listener({ clientX: 120, clientY: 80 });
      for (const child of run.stage.children) {
        if (child.listenerCount('pointertap') > 0) child.emit('pointertap', {});
      }
      if (reduced) expect(run.ticks).toEqual([]);
      for (let frame = 0; frame < 2; frame += 1) {
        for (const tick of run.ticks) tick({ deltaTime: 1, deltaMS: 16.7 });
      }
      for (const dispose of [...run.disposers].reverse()) dispose();

      expect(warnings.filter((warning) => /deprecat/iu.test(warning))).toEqual([]);
    },
  );
});
