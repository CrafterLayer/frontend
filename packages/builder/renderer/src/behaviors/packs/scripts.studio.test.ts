import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import {
  ensureCkEngines,
  type CkEngineContext,
  type CkEngines,
  type CkEnginesHost,
} from '../../engines/ck-engines-shim';
import { CK_RUNTIME_NAMES, STUDIO_LIB_KEYS, STUDIO_PIXI_BOUND_KEYS } from '../../studio/contract';
import { mountScripts, type CkSceneContext } from './scripts';

/*
  Pixi Studio runtime (pixi-studio:runtime-wiring, 2026-10-10; DESIGN §B.2, §C.3): ck.params,
  ck.use, ck.scene, ck.sound, ck.lang / ck.rtl — against a fake `ckEngines` registry. jsdom runs
  the real AsyncFunction path, so these are the actual evaluation semantics.
*/

const flush = () => new Promise((done) => setTimeout(done, 0));
const settle = async () => {
  for (let i = 0; i < 6; i += 1) await flush();
};

const view = () =>
  document.defaultView as unknown as Window & CkEnginesHost & { ckJsGuard?: unknown };
const engines = (): CkEngines | undefined => view().ckEngines;
const queued = () => engines()?.queue.map((entry) => entry.kind) ?? [];

function region(code: string, id = 'r1', params?: unknown): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-ck-custom-code', '');
  el.setAttribute('data-ck-js-id', id);
  el.setAttribute('data-ck-js', code);
  if (params !== undefined) el.setAttribute('data-ck-params', JSON.stringify(params));
  document.body.appendChild(el);
  return el;
}

let errors: MockInstance<typeof console.error>;
let mounted: (() => void)[] = [];

function mount(root: ParentNode, options?: Parameters<typeof mountScripts>[1]): () => void {
  const dispose = mountScripts(root, options);
  mounted.push(dispose);
  return dispose;
}

/** Expose a value from inside a region script to the test. */
interface Probe {
  values: unknown[];
}
const probe = (): Probe => (view() as unknown as { probe: Probe }).probe;

beforeEach(() => {
  delete view().ckEngines;
  delete view().ckJsGuard;
  (view() as unknown as { probe: Probe }).probe = { values: [] };
  localStorage.clear();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mounted = [];
});

afterEach(() => {
  for (const dispose of mounted) dispose();
  errors.mockRestore();
  vi.unstubAllGlobals();
});

/* A fake pixi.js namespace whose Application records its init options. */
const inits: Record<string, unknown>[] = [];
class Application {
  canvas = document.createElement('canvas');
  init(options: Record<string, unknown>): Promise<void> {
    inits.push(options);
    return Promise.resolve();
  }
  destroy(): void {
    this.canvas.remove();
  }
}
const FAKE_PIXI = { Application, marker: 'pixi' };

function registerPixi(): void {
  ensureCkEngines(view()).ready('pixi', {
    mount(_el: HTMLElement, ctx: CkEngineContext) {
      ctx.provide?.(FAKE_PIXI);
      return () => undefined;
    },
  });
}

/** A `lib-<key>` engine providing a factory; counts how often `create` runs. */
function libraryEngine(key: string, created: unknown[], extra: Record<string, unknown> = {}) {
  return {
    mount(_el: HTMLElement, ctx: CkEngineContext) {
      ctx.provide?.({
        pixi: (STUDIO_PIXI_BOUND_KEYS as readonly string[]).includes(key),
        create(PIXI?: unknown) {
          created.push(PIXI);
          return { key, PIXI, ...extra };
        },
      });
      return () => undefined;
    },
  };
}

describe('ck.params', () => {
  it('merges data-ck-params over the defaults, coerced to their types, unknown keys dropped', async () => {
    region(
      `probe.values.push(ck.params({ count: 40, speed: 1.5, glow: true, tint: '#ff0000', palette: 'theme', label: 'hi' }));`,
      'r1',
      {
        count: '120',
        speed: 'fast',
        glow: 'false',
        tint: 7,
        palette: ['#000000', '#ffffff'],
        extra: 1,
      },
    );
    mount(document);
    await flush();
    expect(probe().values[0]).toEqual({
      count: 120,
      speed: 1.5,
      glow: false,
      tint: '7',
      palette: ['#000000', '#ffffff'],
      label: 'hi',
    });
  });

  it('returns the defaults when the region carries no (or broken) params', async () => {
    const el = region(`probe.values.push(ck.params({ n: 3 }));`);
    el.setAttribute('data-ck-params', '{broken');
    mount(document);
    await flush();
    expect(probe().values[0]).toEqual({ n: 3 });
  });

  it('a data-ck-params change disposes and re-runs the region with the new values', async () => {
    const el = region(
      `const p = ck.params({ n: 1 }); probe.values.push(p.n); ck.onDispose(function () { probe.values.push('disposed'); });`,
      'r1',
      { n: 2 },
    );
    mount(document);
    await flush();
    el.setAttribute('data-ck-params', JSON.stringify({ n: 5 }));
    await flush();
    expect(probe().values).toEqual([2, 'disposed', 5]);
  });

  it('rewriting the same params does not re-run', async () => {
    const el = region(`probe.values.push(ck.params({ n: 1 }).n);`, 'r1', { n: 2 });
    mount(document);
    await flush();
    el.setAttribute('data-ck-params', JSON.stringify({ n: 2 }));
    await flush();
    expect(probe().values).toEqual([2]);
  });
});

describe('ck.use', () => {
  it('queues pixi FIRST for a Pixi-bound key, then the library; binds create(PIXI) once', async () => {
    const created: unknown[] = [];
    region(
      `const lib = await ck.use('filters'); probe.values.push(lib.filters.key, lib.filters.PIXI.marker);`,
    );
    mount(document);
    expect(queued()).toEqual(['pixi', 'lib-filters']);
    engines()?.ready('lib-filters', libraryEngine('filters', created));
    registerPixi();
    await settle();
    expect(probe().values).toEqual(['filters', 'pixi']);
    expect(created).toEqual([FAKE_PIXI]);
  });

  it('caches one namespace per document across regions and calls', async () => {
    const created: unknown[] = [];
    registerPixi();
    ensureCkEngines(view()).ready('lib-kit', libraryEngine('kit', created));
    region(
      `const a = await ck.use('kit'); const b = await ck.use(['kit']); probe.values.push(a.kit === b.kit, a.kit);`,
      'a',
    );
    region(`const c = await ck.use('kit'); probe.values.push(c.kit);`, 'b');
    mount(document);
    await settle();
    expect(created).toHaveLength(1);
    expect(probe().values).toContain(true);
    const namespaces = probe().values.filter((value) => value !== true);
    expect(namespaces).toHaveLength(2);
    expect(namespaces[0]).toBe(namespaces[1]);
  });

  it('loads no pixi for a library that is not Pixi-bound', async () => {
    const created: unknown[] = [];
    region(`const lib = await ck.use('physics'); probe.values.push(lib.physics.key);`);
    mount(document);
    expect(queued()).toEqual(['lib-physics']);
    engines()?.ready('lib-physics', libraryEngine('physics', created));
    await settle();
    expect(probe().values).toEqual(['physics']);
    expect(created).toEqual([undefined]);
  });

  it('knows exactly STUDIO_LIB_KEYS and binds exactly STUDIO_PIXI_BOUND_KEYS to pixi', () => {
    // A fresh registry per key: what each one queues says whether it waits for pixi.
    for (const key of STUDIO_LIB_KEYS) {
      delete view().ckEngines;
      document.body.innerHTML = '';
      region(`await ck.use('${key}');`, `k-${key}`);
      mount(document);
      const bound = (STUDIO_PIXI_BOUND_KEYS as readonly string[]).includes(key);
      expect(queued()).toEqual(bound ? ['pixi', `lib-${key}`] : [`lib-${key}`]);
    }
  });

  it('rejects an unknown key with the list of the known ones', async () => {
    region(`await ck.use('kit', 'three');`, 'node-7');
    mount(document);
    await settle();
    expect(errors).toHaveBeenCalledWith(
      '[ck-js]',
      'node-7',
      expect.objectContaining({
        message: `Unknown library "three". Known libraries: ${STUDIO_LIB_KEYS.join(', ')}.`,
      }),
    );
  });

  it('on a published page requests ck-lib-<key>.js from its locator link, once per document', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'ck-engine');
    link.setAttribute('href', '/assets/ck-lib-rough.js');
    link.setAttribute('data-ck-engine', 'lib-rough');
    document.head.appendChild(link);
    region(`await ck.use('rough');`, 'a');
    region(`await ck.use('rough');`, 'b');
    mount(document);
    const scripts = document.querySelectorAll('script[data-ck-engine="lib-rough"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.getAttribute('src')).toContain('/assets/ck-lib-rough.js');
    expect(queued()).toEqual(['lib-rough']);
  });

  it('rejects with advice after 20 s when the library never arrives, and forgets the request', async () => {
    vi.useFakeTimers();
    try {
      const el = region(`await ck.use('brush');`, 'node-9');
      mount(document, { interactive: false });
      await vi.advanceTimersByTimeAsync(20_001);
      expect(errors).toHaveBeenCalledWith(
        '[ck-js]',
        'node-9',
        expect.objectContaining({ message: expect.stringContaining('ck-lib-brush.js') as string }),
      );
      expect(el.getAttribute('data-ck-js-error')).toContain("ck.use('brush')");
      expect(queued()).toEqual([]);
      expect(engines()?.provided?.['lib-brush']).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ck.scene', () => {
  beforeEach(() => {
    inits.length = 0;
  });

  function kitEngine(seen: CkSceneContext[]) {
    return {
      mount(_el: HTMLElement, ctx: CkEngineContext) {
        ctx.provide?.({
          pixi: true,
          create() {
            return {
              createScene(context: CkSceneContext) {
                seen.push(context);
                return { scene: true, width: 100 };
              },
            };
          },
        });
        return () => undefined;
      },
    };
  }

  it('opens the stage, loads kit + the named libraries, and hands everything to kit.createScene', async () => {
    const seen: CkSceneContext[] = [];
    const created: unknown[] = [];
    const el = region(
      `ck.params({ n: 4 }); const s = await ck.scene({ libs: ['filters'], blend: true, pointer: true }); probe.values.push(s);`,
      'r1',
      { n: 9 },
    );
    mount(document);
    expect(queued()).toEqual(['pixi', 'lib-kit', 'lib-filters']);
    registerPixi();
    engines()?.ready('lib-kit', kitEngine(seen));
    engines()?.ready('lib-filters', libraryEngine('filters', created));
    await settle();
    expect(probe().values[0]).toEqual({ scene: true, width: 100 });
    const context = seen[0];
    expect(context?.PIXI).toBe(FAKE_PIXI);
    expect(context?.root).toBe(el);
    expect(context?.canvas).toBe(el.querySelector('canvas'));
    expect(Object.keys(context?.lib ?? {})).toEqual(['filters']);
    expect(context?.params).toEqual({ n: 9 });
    expect(context?.editor).toBe(false);
    expect(typeof context?.sound.play).toBe('function');
    expect(inits[0]).toMatchObject({ useBackBuffer: true, resizeTo: el });
    expect(el.querySelector('canvas')?.style.pointerEvents).toBe('auto');
  });

  it('never captures pointer input on the editor canvas', async () => {
    const seen: CkSceneContext[] = [];
    const el = region(`await ck.scene({ pointer: true });`);
    registerPixi();
    ensureCkEngines(view()).ready('lib-kit', kitEngine(seen));
    mount(document, { interactive: false });
    await settle();
    expect(seen[0]?.editor).toBe(true);
    expect(el.querySelector('canvas')?.style.pointerEvents).toBe('none');
    expect(inits[0]).not.toHaveProperty('useBackBuffer');
  });

  it('reports a kit without createScene', async () => {
    registerPixi();
    ensureCkEngines(view()).ready('lib-kit', {
      mount(_el, ctx) {
        ctx.provide?.({ pixi: true, create: () => ({}) });
        return () => undefined;
      },
    });
    region(`await ck.scene();`, 'node-3');
    mount(document);
    await settle();
    expect(errors).toHaveBeenCalledWith(
      '[ck-js]',
      'node-3',
      expect.objectContaining({ message: expect.stringContaining('createScene') as string }),
    );
  });
});

describe('ck.sound', () => {
  it('is a silent stub on the editor canvas: play is false, analyser is zeros, nothing loads', async () => {
    region(
      `probe.values.push(ck.sound.play('pop'), ck.sound.analyser(), ck.sound.muted, typeof ck.sound.ambient('wind'));`,
    );
    mount(document, { interactive: false });
    await flush();
    expect(probe().values).toEqual([
      false,
      { level: 0, bass: 0, mid: 0, treble: 0, beat: false, active: false },
      true,
      'function',
    ]);
    expect(queued()).toEqual([]);
    expect(document.querySelector('script[data-ck-engine="sound"]')).toBeNull();
  });

  it('elsewhere loads ck-sound.js on first use and forwards to the engine once it is there', async () => {
    const played: unknown[] = [];
    const ambient: unknown[] = [];
    const stopped: unknown[] = [];
    region(
      `ck.sound.setMuted(false); probe.values.push(ck.sound.play('pop')); ck.sound.ambient('wind');`,
    );
    mount(document);
    await flush();
    expect(probe().values).toEqual([false]);
    expect(queued()).toEqual(['sound']);
    const api = {
      muted: true,
      unlocked: false,
      play: (ref: unknown) => {
        played.push(ref);
        return true;
      },
      ambient: (ref: unknown) => {
        ambient.push(ref);
        return () => stopped.push(ref);
      },
      analyser: () => ({ level: 1, bass: 1, mid: 1, treble: 1, beat: true, active: true }),
      setMuted: (muted: boolean) => {
        api.muted = muted;
      },
      onChange: () => undefined,
    };
    engines()?.ready('sound', {
      mount(_el, ctx) {
        ctx.provide?.(api);
        return () => undefined;
      },
    });
    await settle();
    expect(api.muted).toBe(false);
    expect(ambient).toEqual(['wind']);
    for (const dispose of mounted) dispose();
    mounted = [];
    expect(stopped).toEqual(['wind']);
    expect(played).toEqual([]);
  });
});

describe('the runtime ck object', () => {
  it('carries every ck.* name of the API reference, plus lang and rtl from the page', async () => {
    document.documentElement.setAttribute('lang', 'ar');
    document.documentElement.setAttribute('dir', 'rtl');
    region(`probe.values.push(ck);`);
    mount(document);
    await flush();
    const ck = probe().values[0] as Record<string, unknown>;
    for (const name of CK_RUNTIME_NAMES) {
      const member = name.slice('ck.'.length);
      expect(member in ck, name).toBe(true);
      expect(ck[member], name).not.toBeUndefined();
    }
    expect(ck['lang']).toBe('ar');
    expect(ck['rtl']).toBe(true);
  });

  it('still works serialised alone into a fresh document (no module-scope reference)', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    fresh.documentElement.setAttribute('lang', 'en');
    fresh.body.innerHTML =
      '<div id="r" data-ck-js-id="r" data-ck-params="{&quot;n&quot;:3}" data-ck-js="ck.root.setAttribute(&quot;data-ran&quot;, String(ck.params({ n: 1 }).n) + ck.lang + ck.sound.play(&quot;pop&quot;))"></div>';
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', `(${mountScripts.toString()})(document, { interactive: false });`)(
      fresh,
    );
    await flush();
    expect(fresh.getElementById('r')?.getAttribute('data-ran')).toBe('3enfalse');
    frame.remove();
  });
});
