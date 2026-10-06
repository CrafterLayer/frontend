import type {
  CkEngine,
  CkEngineContext,
  CkEngineKind,
  CkEngines,
  CkEnginesHost,
} from './ck-engines-shim';

/* The minimal lottie-web (light) surface used. Types only: the serialised runner has no imports. */
export interface LottieAnimationLike {
  play(): void;
  pause(): void;
  goToAndStop(value: number, isFrame?: boolean): void;
  addEventListener(name: string, cb: () => void): void;
  destroy(): void;
}

export interface LottieLike {
  loadAnimation(params: {
    container: Element;
    renderer: 'svg';
    loop: boolean;
    autoplay: boolean;
    path: string;
    rendererSettings?: Record<string, unknown>;
  }): LottieAnimationLike;
}

export interface LottieWindow extends CkEnginesHost {
  lottie?: LottieLike;
}

/**
 * The lottie engine (media-motion DESIGN §E, Lottie row): registers
 * `win.ckEngines.engines.lottie` and mounts every queued `div[data-ck-lottie]`.
 *
 * Markup: `<div data-ck-lottie data-ck-src="https://….json"><img alt="…" src="poster"></div>`.
 * The runner adds an `aria-hidden` layer, loads the animation into it with the SVG renderer
 * (`loop: true, autoplay: false`), and sets `data-ck-ready` on the first `DOMLoaded`, so CSS can
 * hide the poster image only once something is drawn. If the JSON never loads, the poster stays.
 *
 * - Live (export): plays while in view and the tab is visible; pauses off-screen and on
 *   `visibilitychange`. Under reduced motion it never mounts (and the pack never loads it).
 * - Still (canvas): frame 0; `ctx.onPlay` plays (Preview), `ctx.onStop` returns to frame 0.
 * - Dispose destroys the animation, removes the layer and `data-ck-ready`.
 *
 * Serialised with `Function.prototype.toString` like the timeline runner: no runtime imports,
 * no module-scope reads; `ensureCkEngines` is a verbatim copy of `./ck-engines-shim.ts`.
 */
export function installLottieEngine(win: LottieWindow): void {
  function ensureCkEngines(win: CkEnginesHost): CkEngines {
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

  const lottieRef = win.lottie;
  if (!lottieRef) return;

  const player: LottieLike = lottieRef;

  function reducedMotion(view: Window): boolean {
    try {
      return (
        typeof view.matchMedia === 'function' &&
        view.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    } catch {
      return false;
    }
  }

  function mount(el: HTMLElement, ctx: CkEngineContext): () => void {
    const src = el.getAttribute('data-ck-src') ?? '';
    const doc = el.ownerDocument;
    const view = (doc.defaultView ?? win) as Window;
    if (src === '' || (!ctx.still && reducedMotion(view))) {
      return function noop(): void {
        /* nothing mounted: the poster image stays */
      };
    }

    const layer = doc.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-ck-lottie-layer', '');
    el.appendChild(layer);
    const animation = player.loadAnimation({
      container: layer,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      path: src,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    });

    let ready = false;
    let inView = false;
    let previewing = false;
    let disposed = false;

    function wanted(): boolean {
      if (ctx.still) return previewing;
      return inView && doc.visibilityState !== 'hidden';
    }

    function sync(): void {
      if (!ready || disposed) return;
      if (wanted()) animation.play();
      else animation.pause();
    }

    animation.addEventListener('DOMLoaded', function loaded(): void {
      if (disposed || ready) return;
      ready = true;
      animation.goToAndStop(0, true);
      el.setAttribute('data-ck-ready', '');
      sync();
    });

    let observer: IntersectionObserver | null = null;
    function onVisibility(): void {
      sync();
    }
    if (!ctx.still) {
      const Observer = (view as unknown as { IntersectionObserver?: typeof IntersectionObserver })
        .IntersectionObserver;
      if (typeof Observer === 'function') {
        observer = new Observer(function seen(entries): void {
          for (const entry of entries) inView = entry.isIntersecting;
          sync();
        });
        observer.observe(el);
      } else {
        inView = true;
      }
      doc.addEventListener('visibilitychange', onVisibility);
    }

    ctx.onPlay(function play(): void {
      previewing = true;
      sync();
    });
    ctx.onStop(function stop(): void {
      previewing = false;
      if (ready && !disposed) animation.goToAndStop(0, true);
    });

    return function dispose(): void {
      if (disposed) return;
      disposed = true;
      if (observer) observer.disconnect();
      doc.removeEventListener('visibilitychange', onVisibility);
      try {
        animation.destroy();
      } catch {
        /* already gone */
      }
      layer.remove();
      el.removeAttribute('data-ck-ready');
    };
  }

  const engine: CkEngine = { mount: mount };
  ensureCkEngines(win).ready('lottie', engine);
}
