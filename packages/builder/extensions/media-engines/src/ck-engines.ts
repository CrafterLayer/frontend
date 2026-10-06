/*
  The `window.ckEngines` handshake (media-motion DESIGN §2.3), the scene side.

  The renderer's `engines` pack queues every `data-ck-scene` element on
  `window.ckEngines.queue` and asks for `assets/ck-scene.js`; this bundle ends by
  calling `ready('scene', engine)`, which mounts every queued scene. Either side
  may arrive first, so both carry the same tiny `ensureCkEngines` body. This copy
  is duplicated here on purpose: the engine bundle must not import the renderer,
  and the renderer must not import Pixi. A parity test on the renderer side
  compares the two bodies' behaviour.

  The shapes below are the contract verbatim. Do not widen them here; change
  DESIGN §2.3 first, then both copies.
*/

export type CkEngineKind = 'scene' | 'timeline' | 'lottie';

export interface CkEngineContext {
  /** Editor canvas: draw the first frame, run no ticker. */
  still: boolean;
  rtl: boolean;
  lang: string;
  /** The pack forwards `data-ck-play` being set (canvas Preview). */
  onPlay(cb: () => void): void;
  /** The pack forwards `data-ck-play` being removed. */
  onStop(cb: () => void): void;
}

export interface CkEngine {
  mount(el: HTMLElement, ctx: CkEngineContext): () => void;
}

export interface CkEngineQueueEntry {
  kind: CkEngineKind;
  el: HTMLElement;
  ctx: CkEngineContext;
  dispose?: () => void;
}

export interface CkEngines {
  engines: Partial<Record<CkEngineKind, CkEngine>>;
  queue: CkEngineQueueEntry[];
  ready(kind: CkEngineKind, engine: CkEngine): void;
}

export interface CkEnginesHost {
  ckEngines?: CkEngines;
}

/**
 * Create `win.ckEngines` if absent and return it. `ready` registers the engine
 * and mounts every queued entry of that kind that is not mounted yet; entries
 * stay in the queue (with their `dispose`) so the pack can tear them down.
 */
export function ensureCkEngines(win: CkEnginesHost): CkEngines {
  const existing = win.ckEngines;
  // A foreign `ckEngines` without `ready` (an old page script) is replaced, not trusted.
  if (existing !== undefined && typeof (existing as Partial<CkEngines>).ready === 'function') {
    return existing;
  }
  const api: CkEngines = {
    engines: {},
    queue: [],
    ready(kind, engine) {
      api.engines[kind] = engine;
      for (const entry of api.queue) {
        if (entry.kind !== kind || entry.dispose !== undefined) {
          continue;
        }
        try {
          entry.dispose = engine.mount(entry.el, entry.ctx);
        } catch {
          // One broken element never stops the others; its fallback markup stays.
          entry.dispose = () => {
            /* nothing was mounted */
          };
        }
      }
    },
  };
  win.ckEngines = api;
  return api;
}
