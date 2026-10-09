/*
  The FULL pixi.js bundle's engine (free-code mode, 2026-10-09).

  A region script (`CustomCodeBlock` prop `js`) draws its own Pixi scene through
  `ck.pixi()` / `ck.stage()`. Those need the whole library, not the five-scene subset
  `ck-scene.js` carries, so they get a second, separately budgeted bundle:
  `assets/ck-pixi.js` on a published site, a script injected into the frame on the editor
  canvas. It is emitted only when some region's code names Pixi.

  The bundle meets the page on the same `window.ckEngines` handshake as every other engine, but
  there is no marker element: the `scripts` pack queues `{kind: 'pixi', el: <the region>, ctx}`
  with `ctx.provide` set, and `ready('pixi', engine)` mounts each queued entry, whose `mount`
  hands the pixi.js namespace to that callback. No `window.PIXI` global is ever written: the only
  way to the library is `ck.pixi()`.
*/

import { ensureCkEngines, type CkEngine, type CkEnginesHost } from './ck-engines';

/** An engine whose `mount` delivers `namespace` to whoever queued the entry. */
export function createPixiEngine(namespace: unknown): CkEngine {
  return {
    mount(_el, ctx) {
      ctx.provide?.(namespace);
      return () => undefined;
    },
  };
}

/**
 * Register the pixi.js namespace on `win.ckEngines` (creating the handshake if the scripts pack
 * has not run yet) and deliver it to every region script already waiting.
 */
export function installPixiEngine(win: CkEnginesHost, namespace: unknown): CkEngine {
  const engine = createPixiEngine(namespace);
  ensureCkEngines(win).ready('pixi', engine);
  return engine;
}
