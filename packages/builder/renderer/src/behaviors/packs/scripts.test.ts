import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import {
  ckEnginesShimOf,
  ensureCkEngines,
  type CkEngineContext,
  type CkEngines,
  type CkEnginesHost,
} from '../../engines/ck-engines-shim';
import { behaviorRuntimeScript } from '../script';
import { mountScripts } from './scripts';

/*
  The scripts pack (free-code mode, 2026-10-09). jsdom runs the real AsyncFunction path
  (`window.eval`), so these are the actual evaluation semantics, not a stub of them.
*/

const GUARD = 'ck-js-guard';
const flush = () => new Promise((done) => setTimeout(done, 0));

/** jsdom's own window: the one the pack keys `ckEngines` and the guard on. */
const view = () =>
  document.defaultView as unknown as Window & CkEnginesHost & { ckJsGuard?: unknown };
const engines = (): CkEngines | undefined => view().ckEngines;

function region(code: string, id = 'r1'): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-ck-custom-code', '');
  el.setAttribute('data-ck-js-id', id);
  el.setAttribute('data-ck-js', code);
  document.body.appendChild(el);
  return el;
}

let errors: MockInstance<typeof console.error>;
let mounted: (() => void)[] = [];

/** Mount and remember the disposer, so a failing test cannot leak a running script into the next. */
function mount(root: ParentNode, options?: Parameters<typeof mountScripts>[1]): () => void {
  const dispose = mountScripts(root, options);
  mounted.push(dispose);
  return dispose;
}

beforeEach(() => {
  delete view().ckEngines;
  delete view().ckJsGuard;
  localStorage.clear();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mounted = [];
});

afterEach(() => {
  for (const dispose of mounted) dispose();
  errors.mockRestore();
  vi.unstubAllGlobals();
});

describe('mountScripts — evaluation', () => {
  it('does nothing, and touches nothing, in a root without a script', () => {
    document.body.innerHTML = '<p>no script here</p>';
    mount(document)();
    expect(engines()).toBeUndefined();
    expect(view().ckJsGuard).toBeUndefined();
    expect(localStorage.getItem(GUARD)).toBeNull();
  });

  it('runs the code as the body of an async function with one parameter, ck', async () => {
    const el = region(
      [
        "ck.root.setAttribute('data-saw', typeof ck.root + ':' + ck.editor + ':' + ck.reducedMotion);",
        'await Promise.resolve();',
        "ck.root.setAttribute('data-after-await', 'yes');",
      ].join('\n'),
    );
    mount(document);
    // The synchronous part ran inside mount().
    expect(el.getAttribute('data-saw')).toBe('object:false:false');
    await flush();
    expect(el.getAttribute('data-after-await')).toBe('yes');
    expect(errors).not.toHaveBeenCalled();
  });

  it("evaluates in strict mode and in the root's window, not a sloppy global", async () => {
    const el = region(
      "try { undeclaredVariable = 1; } catch (e) { ck.root.setAttribute('data-strict', e.name); }" +
        "\nck.root.setAttribute('data-doc', String(document === ck.root.ownerDocument));",
    );
    mount(document);
    await flush();
    expect(el.getAttribute('data-strict')).toBe('ReferenceError');
    expect(el.getAttribute('data-doc')).toBe('true');
  });

  it('reports ck.reducedMotion from the media query', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
    }));
    (view() as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
    });
    const el = region("ck.root.setAttribute('data-rm', String(ck.reducedMotion));");
    mount(document);
    expect(el.getAttribute('data-rm')).toBe('true');
  });

  it('skips blank code and elements inside a clone', () => {
    const blank = region('   \n ');
    const clone = document.createElement('div');
    clone.setAttribute('data-ck-clone', '');
    document.body.appendChild(clone);
    const inner = document.createElement('div');
    inner.setAttribute('data-ck-js', "ck.root.setAttribute('data-ran', '1')");
    clone.appendChild(inner);
    mount(document);
    expect(blank.hasAttribute('data-ck-js-mounted')).toBe(false);
    expect(inner.hasAttribute('data-ran')).toBe(false);
  });

  it('is idempotent: a second mount on the same region does not run it twice', () => {
    const el = region(
      "ck.root.setAttribute('data-count', String(Number(ck.root.getAttribute('data-count') ?? 0) + 1));",
    );
    mount(document);
    mount(document);
    expect(el.getAttribute('data-count')).toBe('1');
  });

  it('runs a region passed as the root itself', () => {
    const el = region("ck.root.setAttribute('data-self', '1')");
    mount(el);
    expect(el.getAttribute('data-self')).toBe('1');
  });

  it('gives a static ck.root position: relative, and restores it on dispose', () => {
    const el = region('await new Promise(() => {});');
    el.style.position = '';
    const dispose = mount(document);
    expect(el.style.position).toBe('relative');
    dispose();
    expect(el.style.position).toBe('');
  });

  it('leaves a positioned ck.root alone', () => {
    const el = region('await new Promise(() => {});');
    el.style.position = 'absolute';
    const dispose = mount(document);
    expect(el.style.position).toBe('absolute');
    dispose();
    expect(el.style.position).toBe('absolute');
  });
});

describe('mountScripts — errors', () => {
  it('logs a synchronous throw and, on the published site, sets no attribute', async () => {
    const el = region("throw new Error('boom');", 'node-7');
    mount(document);
    await flush();
    expect(errors).toHaveBeenCalledWith(
      '[ck-js]',
      'node-7',
      expect.objectContaining({ message: 'boom' }),
    );
    expect(el.hasAttribute('data-ck-js-error')).toBe(false);
  });

  it('logs a syntax error the same way', async () => {
    const el = region('let = = ;', 'node-8');
    mount(document, { interactive: false });
    await flush();
    expect(errors).toHaveBeenCalledWith('[ck-js]', 'node-8', expect.anything());
    expect(el.getAttribute('data-ck-js-error')).toMatch(/\S/u);
  });

  it('logs a rejection after an await, and on the canvas marks the region with the message', async () => {
    const el = region("await Promise.resolve(); throw new TypeError('late failure');", 'node-9');
    mount(document, { interactive: false });
    expect(el.hasAttribute('data-ck-js-error')).toBe(false);
    await flush();
    expect(errors).toHaveBeenCalledWith(
      '[ck-js]',
      'node-9',
      expect.objectContaining({ message: 'late failure' }),
    );
    expect(el.getAttribute('data-ck-js-error')).toBe('late failure');
  });

  it('clears the error attribute on a successful re-run', async () => {
    const el = region("throw new Error('first');", 'node-10');
    mount(document, { interactive: false });
    await flush();
    expect(el.getAttribute('data-ck-js-error')).toBe('first');

    el.setAttribute('data-ck-js', "ck.root.setAttribute('data-fixed', '1')");
    await flush(); // MutationObserver
    expect(el.hasAttribute('data-ck-js-error')).toBe(false);
    expect(el.getAttribute('data-fixed')).toBe('1');
  });

  it('reports nothing from a run that was disposed before it failed', async () => {
    region('await new Promise((resolve) => setTimeout(resolve, 5)); throw new Error("too late");');
    const dispose = mount(document, { interactive: false });
    dispose();
    await new Promise((done) => setTimeout(done, 20));
    expect(errors).not.toHaveBeenCalled();
  });

  it('survives a throwing ck.onDispose callback and still runs the others', () => {
    const order: string[] = [];
    (view() as unknown as { order: string[] }).order = order;
    region(
      [
        "ck.onDispose(() => window.order.push('first'));",
        "ck.onDispose(() => { throw new Error('cleanup'); });",
        "ck.onDispose(() => window.order.push('last'));",
        'await new Promise(() => {});',
      ].join('\n'),
    );
    mount(document)();
    // Reverse order: last registered, first run.
    expect(order).toEqual(['last', 'first']);
    expect(errors).toHaveBeenCalledWith(
      '[ck-js]',
      'r1',
      expect.objectContaining({ message: 'cleanup' }),
    );
    delete (view() as unknown as { order?: string[] }).order;
  });
});

describe('mountScripts — dispose, re-run, removal', () => {
  beforeEach(() => {
    (view() as unknown as { log: string[] }).log = [];
  });
  afterEach(() => {
    delete (view() as unknown as { log?: string[] }).log;
  });
  const log = () => (view() as unknown as { log: string[] }).log;

  it('disposes on the returned disposer, once', () => {
    region("window.log.push('run'); ck.onDispose(() => window.log.push('dispose'));");
    const dispose = mount(document);
    expect(log()).toEqual(['run']);
    dispose();
    dispose();
    expect(log()).toEqual(['run', 'dispose']);
  });

  it('disposes and re-runs when data-ck-js changes', async () => {
    const el = region(
      "window.log.push('one'); ck.onDispose(() => window.log.push('dispose one'));",
    );
    mount(document);
    el.setAttribute(
      'data-ck-js',
      "window.log.push('two'); ck.onDispose(() => window.log.push('dispose two'));",
    );
    await flush();
    expect(log()).toEqual(['one', 'dispose one', 'two']);
  });

  it('does not re-run when the attribute is rewritten with the same code', async () => {
    const el = region("window.log.push('one');");
    mount(document);
    el.setAttribute('data-ck-js', "window.log.push('one');");
    await flush();
    expect(log()).toEqual(['one']);
  });

  it('disposes a region that leaves the DOM', async () => {
    const el = region("window.log.push('run'); ck.onDispose(() => window.log.push('dispose'));");
    mount(document);
    el.remove();
    await flush();
    expect(log()).toEqual(['run', 'dispose']);
  });

  it('disposes when the script is emptied, and runs a region added later', async () => {
    const el = region("window.log.push('a'); ck.onDispose(() => window.log.push('dispose a'));");
    mount(document);
    el.setAttribute('data-ck-js', '');
    await flush();
    expect(log()).toEqual(['a', 'dispose a']);

    region("window.log.push('b');", 'r2');
    await flush();
    expect(log()).toEqual(['a', 'dispose a', 'b']);
  });

  it('with watch: false no observer re-runs it (the editor drives re-runs from React)', async () => {
    const el = region("window.log.push('one');");
    mount(document, { watch: false });
    el.setAttribute('data-ck-js', "window.log.push('two');");
    await flush();
    expect(log()).toEqual(['one']);
  });

  it('calls a ck.onDispose registered after disposal at once', async () => {
    region(
      "await new Promise((resolve) => setTimeout(resolve, 5)); ck.onDispose(() => window.log.push('late'));",
    );
    mount(document)();
    await new Promise((done) => setTimeout(done, 30));
    expect(log()).toEqual(['late']);
  });
});

describe('mountScripts — pixi through the engine registry', () => {
  const FAKE_PIXI = { Application: Map, marker: 'full' };

  function pixiEngine() {
    return {
      mount(_el: HTMLElement, ctx: CkEngineContext) {
        ctx.provide?.(FAKE_PIXI);
        return () => undefined;
      },
    };
  }

  it('hands over the namespace of an engine that is already registered', async () => {
    ensureCkEngines(view()).ready('pixi', pixiEngine());
    const el = region(
      "const PIXI = await ck.pixi(); ck.root.setAttribute('data-pixi', PIXI.marker);",
    );
    mount(document);
    await flush();
    expect(el.getAttribute('data-pixi')).toBe('full');
  });

  it('queues the request until the bundle registers, then resolves it; no global is written', async () => {
    const el = region(
      "const PIXI = await ck.pixi(); ck.root.setAttribute('data-pixi', PIXI.marker);",
    );
    mount(document);
    expect(engines()?.queue.map((entry) => entry.kind)).toEqual(['pixi']);
    engines()?.ready('pixi', pixiEngine());
    await flush();
    expect(el.getAttribute('data-pixi')).toBe('full');
    expect((view() as unknown as { PIXI?: unknown }).PIXI).toBeUndefined();
  });

  it('removes its queue entry when the region is disposed', () => {
    region('await ck.pixi();');
    mount(document)();
    expect(engines()?.queue).toEqual([]);
  });

  it('on a published page injects the bundle from the locator link, once', () => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'ck-engine');
    link.setAttribute('href', '/assets/ck-pixi.js');
    link.setAttribute('data-ck-engine', 'pixi');
    document.head.appendChild(link);
    region('await ck.pixi();', 'a');
    region('await ck.pixi();', 'b');
    mount(document);
    const scripts = document.querySelectorAll('script[data-ck-engine="pixi"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.getAttribute('src')).toContain('/assets/ck-pixi.js');
  });

  it('injects nothing where there is no locator link (the editor canvas injects the bundle itself)', () => {
    region('await ck.pixi();');
    mount(document, { interactive: false });
    expect(document.querySelector('script[data-ck-engine="pixi"]')).toBeNull();
  });

  it('rejects with advice, not a hang, when the bundle never arrives', async () => {
    vi.useFakeTimers();
    try {
      const el = region('await ck.pixi();', 'node-11');
      mount(document, { interactive: false });
      await vi.advanceTimersByTimeAsync(20_001);
      expect(errors).toHaveBeenCalledWith(
        '[ck-js]',
        'node-11',
        expect.objectContaining({ message: expect.stringContaining('did not load') as string }),
      );
      expect(el.getAttribute('data-ck-js-error')).toContain('ck.pixi() or ck.stage()');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('mountScripts — ck.stage', () => {
  interface FakeApp {
    inits: Record<string, unknown>[];
    destroys: unknown[][];
    apps: Application[];
  }
  const record: FakeApp = { inits: [], destroys: [], apps: [] };
  let release: (() => void) | undefined;
  let hold = false;

  interface Point {
    x: number;
    y: number;
  }
  /** Pixi's renderer as a stage reads it: resize, its 'resize' event, the pointer mapping. */
  class Application {
    canvas = document.createElement('canvas');
    screen = { width: 0, height: 0 };
    resizes: [number, number][] = [];
    renders = 0;
    readonly onResize: ((width: number, height: number) => void)[] = [];
    readonly renderer = {
      resize: (width: number, height: number) => {
        this.screen = { width, height };
        this.resizes.push([width, height]);
        for (const fn of this.onResize) fn(width, height);
      },
      on: (event: string, fn: (width: number, height: number) => void) => {
        if (event === 'resize') this.onResize.push(fn);
      },
      listenerCount: (event: string) => (event === 'resize' ? this.onResize.length : 0),
      events: {} as { mapPositionToPoint?: (point: Point, x: number, y: number) => void },
    };
    render(): void {
      this.renders += 1;
    }
    init(options: Record<string, unknown>): Promise<void> {
      record.inits.push(options);
      record.apps.push(this);
      this.screen = {
        width: Number(options['width'] ?? 0),
        height: Number(options['height'] ?? 0),
      };
      if (!hold) return Promise.resolve();
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    destroy(...args: unknown[]): void {
      record.destroys.push(args);
      this.canvas.remove();
    }
  }

  beforeEach(() => {
    record.inits = [];
    record.destroys = [];
    record.apps = [];
    hold = false;
    release = undefined;
    ensureCkEngines(view()).ready('pixi', {
      mount(_el, ctx) {
        ctx.provide?.({ Application });
        return () => undefined;
      },
    });
  });

  it('creates a transparent, pointer-transparent stage filling the region, and destroys it on dispose', async () => {
    const el = region(
      "const { PIXI, app, canvas } = await ck.stage(); ck.root.setAttribute('data-stage', String(canvas === app.canvas && !!PIXI.Application));",
    );
    const dispose = mount(document);
    await flush();
    expect(el.getAttribute('data-stage')).toBe('true');

    const surface = el.querySelector('canvas');
    expect(surface).not.toBeNull();
    expect(surface?.style.position).toBe('absolute');
    expect(surface?.style.zIndex).toBe('0');
    expect(surface?.style.pointerEvents).toBe('none');
    expect(record.inits[0]).toMatchObject({
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
    });
    expect(record.inits[0]).not.toHaveProperty('background');

    dispose();
    expect(record.destroys).toEqual([[{ removeView: true }, { children: true }]]);
    expect(el.querySelector('canvas')).toBeNull();
  });

  it('takes a background, pointer input and a resolution from its options', async () => {
    const el = region("await ck.stage({ background: '#101820', pointer: true, resolution: 3 });");
    mount(document);
    await flush();
    expect(record.inits[0]).toMatchObject({
      background: '#101820',
      backgroundAlpha: 1,
      resolution: 3,
    });
    expect(el.querySelector('canvas')?.style.pointerEvents).toBe('auto');
  });

  it('destroys a stage whose region stopped while it was initialising, and reports nothing', async () => {
    hold = true;
    const el = region('await ck.stage();');
    const dispose = mount(document, { interactive: false });
    await flush();
    dispose();
    release?.();
    await flush();
    expect(record.destroys).toEqual([[true, { children: true }]]);
    expect(el.querySelector('canvas')).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  /*
    preview-fix (2026-10-12): Pixi's `resizeTo` hears only window resizes. A story whose region
    grew after its stage opened (its copy filled in, Preview's shorter viewport) kept a canvas of
    the first size: the scene ended part-way down and the HTML cards ran on past it.
  */
  describe('follows its region', () => {
    const size = { width: 1280, height: 604 };
    const observers: { fire: () => void; targets: Element[]; disconnected: boolean }[] = [];
    class FakeResizeObserver {
      readonly entry: { fire: () => void; targets: Element[]; disconnected: boolean };
      constructor(callback: () => void) {
        this.entry = { fire: callback, targets: [], disconnected: false };
        observers.push(this.entry);
      }
      observe(target: Element): void {
        this.entry.targets.push(target);
      }
      disconnect(): void {
        this.entry.disconnected = true;
      }
    }
    const host = () => view() as unknown as { ResizeObserver?: unknown };

    function sizedRegion(code: string): HTMLElement {
      const el = region(code);
      Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => size.width });
      Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => size.height });
      return el;
    }
    /** The region grows by 120px (its copy arrived) and the observer reports it. */
    function grow(): void {
      size.height += 120;
      for (const observer of observers) observer.fire();
    }

    beforeEach(() => {
      size.width = 1280;
      size.height = 604;
      observers.length = 0;
      host().ResizeObserver = FakeResizeObserver;
    });
    afterEach(() => {
      delete host().ResizeObserver;
    });

    it('opens at the region size, without resizeTo, with a canvas that fills the region', async () => {
      const el = sizedRegion('await ck.stage();');
      mount(document);
      await flush();
      expect(record.inits[0]).toMatchObject({ width: 1280, height: 604 });
      expect(record.inits[0]).not.toHaveProperty('resizeTo');
      const style = el.querySelector('canvas')?.style;
      expect([style?.width, style?.height, style?.objectFit]).toEqual(['100%', '100%', 'cover']);
      expect(observers[0]?.targets).toEqual([el]);
    });

    it("resizes the renderer for a script that listens, and its 'resize' layout runs", async () => {
      const el = sizedRegion(
        "const { app } = await ck.stage(); app.renderer.on('resize', (w, h) => ck.root.setAttribute('data-laid-out', w + 'x' + h));",
      );
      const dispose = mount(document);
      await flush();
      grow();
      const app = record.apps[0];
      expect(app?.resizes).toEqual([[1280, 724]]);
      expect(el.getAttribute('data-laid-out')).toBe('1280x724');
      expect(app?.renders).toBe(1);
      expect(el.querySelector('canvas')?.style.height).toBe('100%');
      dispose();
      expect(observers[0]?.disconnected).toBe(true);
    });

    it('keeps the first frame of a script that never listens, covering the region', async () => {
      const el = sizedRegion('await ck.stage();');
      mount(document);
      await flush();
      grow();
      const app = record.apps[0];
      expect(app?.resizes).toEqual([]);
      expect(app?.screen).toEqual({ width: 1280, height: 604 });
      const surface = el.querySelector('canvas');
      expect([surface?.style.width, surface?.style.height]).toEqual(['100%', '100%']);
      expect(surface?.style.objectFit).toBe('cover');
      // A pointer maps through the same cover: the region's centre is the scene's centre.
      if (surface === null) throw new Error('no canvas');
      surface.getBoundingClientRect = () => new DOMRect(0, 0, 1280, 724);
      const point = { x: 0, y: 0 };
      app?.renderer.events.mapPositionToPoint?.(point, 640, 362);
      expect(point.x).toBeCloseTo(640);
      expect(point.y).toBeCloseTo(302);
    });
  });
});

describe('mountScripts — the editor crash guard', () => {
  it('sets localStorage while the synchronous part runs and clears it on the next task', async () => {
    const seen: (string | null)[] = [];
    (view() as unknown as { seen: typeof seen }).seen = seen;
    region('window.seen.push(localStorage.getItem("ck-js-guard"));', 'a');
    region('window.seen.push(localStorage.getItem("ck-js-guard"));', 'b');
    mount(document, { interactive: false });
    expect(seen).toEqual(['1', '1']);
    expect(localStorage.getItem(GUARD)).toBe('1');
    await flush();
    expect(localStorage.getItem(GUARD)).toBeNull();
    delete (view() as unknown as { seen?: unknown }).seen;
  });

  it('does not leave the flag behind when the frame goes away in the task that armed it', () => {
    region('void 0;', 'a');
    mount(document, { interactive: false });
    expect(localStorage.getItem(GUARD)).toBe('1');
    view().dispatchEvent(new Event('pagehide'));
    expect(localStorage.getItem(GUARD)).toBeNull();
  });

  it('does not run a script, and says why, when the previous session left the flag set', () => {
    localStorage.setItem(GUARD, '1');
    const a = region("ck.root.setAttribute('data-ran', '1')", 'a');
    const b = region("ck.root.setAttribute('data-ran', '1')", 'b');
    mount(document, { interactive: false });
    expect(a.hasAttribute('data-ran')).toBe(false);
    expect(b.hasAttribute('data-ran')).toBe(false);
    expect(a.getAttribute('data-ck-js-error')).toBe(
      'Scripts paused after the editor froze last time',
    );
    expect(b.getAttribute('data-ck-js-error')).toBe(
      'Scripts paused after the editor froze last time',
    );
    // The flag is cleared at once, so the NEXT boot is not paused too.
    expect(localStorage.getItem(GUARD)).toBeNull();
  });

  it('keeps an unchanged script paused on a later mount, and lets an edited one run', () => {
    localStorage.setItem(GUARD, '1');
    const el = region("ck.root.setAttribute('data-ran', 'old')", 'a');
    mount(document, { interactive: false })();
    expect(el.hasAttribute('data-ran')).toBe(false);

    // Same code, new mount (a tree edit remounts the region): still paused.
    mount(document, { interactive: false })();
    expect(el.hasAttribute('data-ran')).toBe(false);
    expect(el.getAttribute('data-ck-js-error')).toContain('paused');

    // The author fixed it: that code was never frozen on, so it runs (guarded again).
    el.setAttribute('data-ck-js', "ck.root.setAttribute('data-ran', 'fixed')");
    mount(document, { interactive: false });
    expect(el.getAttribute('data-ran')).toBe('fixed');
    expect(el.hasAttribute('data-ck-js-error')).toBe(false);
  });

  it('runs normally on the next boot after a clean one', async () => {
    region("ck.root.setAttribute('data-ran', '1')", 'a');
    mount(document, { interactive: false })();
    await flush();
    expect(localStorage.getItem(GUARD)).toBeNull();

    delete view().ckJsGuard; // a fresh frame
    const el = document.querySelector<HTMLElement>('[data-ck-js-id="a"]');
    el?.removeAttribute('data-ran');
    mount(document, { interactive: false });
    expect(el?.getAttribute('data-ran')).toBe('1');
  });

  it('is not used on Preview or the published site', () => {
    localStorage.setItem(GUARD, '1');
    const el = region("ck.root.setAttribute('data-ran', '1')", 'a');
    mount(document);
    expect(el.getAttribute('data-ran')).toBe('1');
    expect(localStorage.getItem(GUARD)).toBe('1'); // untouched
    expect(view().ckJsGuard).toBeUndefined();
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const el = region("ck.root.setAttribute('data-ran', '1')", 'a');
    mount(document, { interactive: false });
    expect(el.getAttribute('data-ran')).toBe('1');
    vi.restoreAllMocks();
  });
});

describe('mountScripts — serialisation and parity', () => {
  it('keeps the ensureCkEngines body equal to the shim', () => {
    const reference = ckEnginesShimOf(ensureCkEngines.toString());
    expect(reference).not.toBeNull();
    expect(ckEnginesShimOf(mountScripts.toString())).toBe(reference);
  });

  it('ships in ck-behaviors.js only for markup that carries a script', () => {
    expect(behaviorRuntimeScript(['<div data-ck-js="x"></div>'])).toContain(
      mountScripts.toString(),
    );
    expect(behaviorRuntimeScript(['<div data-ck-js-id="x"></div>'])).not.toContain(
      mountScripts.toString(),
    );
    expect(behaviorRuntimeScript(['<p>plain</p>'])).not.toContain(mountScripts.toString());
  });

  it('works when serialised alone into a fresh document (no module-scope reference)', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const fresh = frame.contentDocument!;
    fresh.body.innerHTML =
      '<div id="r" data-ck-js-id="r" data-ck-js="ck.root.setAttribute(&quot;data-ran&quot;, String(ck.root.ownerDocument === document))"></div>';
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised pack IS the test
    new Function('document', `(${mountScripts.toString()})(document);`)(fresh);
    await flush();
    expect(fresh.getElementById('r')?.getAttribute('data-ran')).toBe('true');
    frame.remove();
  });
});
