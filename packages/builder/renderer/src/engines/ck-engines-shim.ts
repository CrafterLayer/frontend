/**
 * The `window.ckEngines` handshake (media-motion DESIGN §2.3): the one structure the `engines`
 * behaviour pack (which finds `data-ck-timeline` / `data-ck-scene` / `data-ck-lottie` markers)
 * and each lazily loaded engine asset (`ck-timeline.js`, `ck-scene.js`, `ck-lottie.js`) meet on.
 *
 * Either side may run first:
 * - the pack runs first (usual): it queues `{kind, el, ctx}` and requests the asset; when the
 *   asset loads it calls `ready(kind, engine)`, which registers the engine and mounts the queued
 *   entries of that kind;
 * - the asset runs first: it creates the same structure, registers, and the pack then finds
 *   `engines[kind]` and mounts at once.
 *
 * ## Why the body is duplicated
 *
 * Every side is serialised with `Function.prototype.toString` into a page (published export or
 * the canvas frame), so none can import the other. Each side therefore declares an IDENTICAL
 * nested `function ensureCkEngines(win) { … }` — the timeline and lottie runners here, the
 * seam's `packs/engines.ts`, and the scene engine. `ckEnginesShimOf(source)` extracts that nested
 * declaration from a serialised function so a test can hold every copy equal to
 * `ensureCkEngines.toString()` (whitespace-insensitive). Keep the body free of string, regex and
 * comment braces, so the brace matcher stays exact.
 *
 * The body uses only ES2015 syntax with no spread, class, async or generator, so no bundler can
 * inject a module-scope helper into it.
 */

export type CkEngineKind = 'scene' | 'timeline' | 'lottie';

export interface CkEngineContext {
  /** Canvas: draw the final/first frame, no ticker, no scroll. */
  still: boolean;
  rtl: boolean;
  lang: string;
  /** The pack forwards `data-ck-play` being set (canvas Preview). */
  onPlay(cb: () => void): void;
  /** The pack forwards `data-ck-play` being removed. */
  onStop(cb: () => void): void;
  // gsap-pixi additions (2026-10-08)
  /**
   * The editor canvas: RUN (still is false there), but never restructure the DOM React owns
   * (no pin spacers, no split text) and never capture pointer input. Absent/false: a published
   * page or Preview.
   */
  canvas?: boolean;
  // end gsap-pixi additions
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
  /** Registers `engine` for `kind` and mounts (then drops) the queued entries of that kind. */
  ready(kind: CkEngineKind, engine: CkEngine): void;
}

export interface CkEnginesHost {
  ckEngines?: CkEngines;
}

/**
 * Returns `win.ckEngines`, creating it when absent. `ready` mounts each queued entry of its kind
 * whose element is still connected, stores the disposer on the entry (the pack's dispose calls
 * it), and removes it from the queue. An engine that throws on one element leaves that element's
 * fallback markup in place and does not stop the others.
 */
export function ensureCkEngines(win: CkEnginesHost): CkEngines {
  const existing = win.ckEngines as Partial<CkEngines> | undefined;
  if (existing?.engines && existing.queue && typeof existing.ready === 'function') {
    return existing as CkEngines;
  }
  const api: CkEngines = {
    engines: {},
    queue: [],
    ready: function ready(kind: CkEngineKind, engine: CkEngine): void {
      api.engines[kind] = engine;
      const waiting = api.queue.slice();
      api.queue.length = 0;
      for (const entry of waiting) {
        if (entry.kind !== kind) {
          api.queue.push(entry);
          continue;
        }
        if (entry.dispose || !entry.el.isConnected) continue;
        try {
          entry.dispose = engine.mount(entry.el, entry.ctx);
        } catch {
          entry.dispose = function noop(): void {
            /* the element keeps its fallback markup */
          };
        }
      }
    },
  };
  win.ckEngines = api;
  return api;
}

/**
 * The nested `function ensureCkEngines(…) { … }` declaration inside a serialised function (or
 * `ensureCkEngines.toString()` itself), with all whitespace removed — or `null` when absent.
 * Two copies are in parity when their results are equal.
 */
export function ckEnginesShimOf(source: string): string | null {
  const start = source.indexOf('function ensureCkEngines(');
  if (start < 0) return null;
  const open = source.indexOf('{', source.indexOf(')', start));
  if (open < 0) return null;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1).replace(/\s+/g, '');
    }
  }
  return null;
}
