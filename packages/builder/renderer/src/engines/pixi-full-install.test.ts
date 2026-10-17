import { describe, expect, it } from 'vitest';

import { mountRegionScripts } from '../behaviors/mount';
import type { CkEngineContext, CkEnginesHost } from './ck-engines-shim';
import { PIXI_FULL_SOURCE } from './pixi-full-source';

/*
  The generated bundle, EVALUATED (jsdom, no GPU): it must register the `pixi` engine on the page's
  `window.ckEngines` at load, and its mount must hand over the FULL namespace — not the scene
  subset — without writing a `PIXI` global. Drawing needs WebGL and is outside this suite.
*/

const ctx = (provide: (namespace: unknown) => void): CkEngineContext => ({
  still: false,
  rtl: false,
  lang: 'en',
  onPlay: () => undefined,
  onStop: () => undefined,
  provide,
});

describe('ck-pixi.js evaluated in a fresh frame', () => {
  it('registers the pixi engine at load and delivers the whole pixi.js namespace', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const win = frame.contentWindow as unknown as Window &
      CkEnginesHost & { eval(code: string): unknown; PIXI?: unknown };

    win.eval(PIXI_FULL_SOURCE);

    const engine = win.ckEngines?.engines.pixi;
    expect(typeof engine?.mount).toBe('function');
    let received: Record<string, unknown> | undefined;
    const dispose = engine?.mount(
      document.createElement('div'),
      ctx((namespace) => {
        received = namespace as Record<string, unknown>;
      }),
    );
    expect(typeof dispose).toBe('function');
    // The things the scene subset never carried, and a script will ask for.
    for (const name of [
      'Application',
      'Container',
      'Graphics',
      'Sprite',
      'Text',
      'Texture',
      'Ticker',
    ]) {
      expect(typeof received?.[name]).toBe('function');
    }
    expect(typeof received?.['Assets']).toBe('object');
    expect(win.PIXI).toBeUndefined();
    frame.remove();
  });

  it('delivers to a script that queued before the bundle loaded', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const win = frame.contentWindow as unknown as Window &
      CkEnginesHost & { eval(code: string): unknown };
    const el = frame.contentDocument?.createElement('div') as HTMLElement;
    frame.contentDocument?.body.appendChild(el);
    let received: unknown;
    win.ckEngines = {
      engines: {},
      queue: [{ kind: 'pixi', el, ctx: ctx((namespace) => (received = namespace)) }],
      ready(kind, engine) {
        this.engines[kind] = engine;
        for (const entry of this.queue) entry.dispose = engine.mount(entry.el, entry.ctx);
      },
    };

    win.eval(PIXI_FULL_SOURCE);

    expect(typeof (received as { Application?: unknown } | undefined)?.Application).toBe(
      'function',
    );
    frame.remove();
  });

  it('end to end on the canvas path: a region script awaits ck.pixi() and gets the real library', async () => {
    // A frame, like the editor canvas: the pack, the injection and the bundle all meet in ITS realm.
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const inner = frame.contentDocument!;
    const region = inner.createElement('div');
    region.setAttribute('data-ck-custom-code', '');
    region.setAttribute('data-ck-js-id', 'e2e');
    region.setAttribute(
      'data-ck-js',
      "const PIXI = await ck.pixi(); ck.root.setAttribute('data-app', typeof PIXI.Application);",
    );
    inner.body.appendChild(region);

    const dispose = mountRegionScripts(region, { interactive: false, watch: false });
    for (let waited = 0; waited < 100 && !region.hasAttribute('data-app'); waited += 1) {
      await new Promise((done) => setTimeout(done, 50));
    }

    expect(region.getAttribute('data-app')).toBe('function');
    expect(region.hasAttribute('data-ck-js-error')).toBe(false);
    expect(inner.head.querySelectorAll('script[data-ck-engine="pixi"]')).toHaveLength(1);
    dispose();
    frame.remove();
    localStorage.removeItem('ck-js-guard');
  }, 30_000);
});
