import { mountScripts } from '../behaviors/packs/scripts';
import { codeEngines, type PageEngine } from '../behaviors/script';
import { ensureCkEngines } from '../engines/ck-engines-shim';
import { ENGINE_LOADERS, type EngineLoader } from '../engines/inject';
import { STUDIO_LIB_KEYS, STUDIO_PIXI_BOUND_KEYS, type StudioLibKey } from './contract';
import { studioProbeCapture } from './scene-probe-capture';
import {
  studioProbeContexts,
  studioSceneProbe,
  type StudioProbeSeen,
  type StudioProbeSettings,
} from './scene-probe-frame';

/**
 * The Script Studio preview document (DESIGN §D.3) — pixi-studio:runtime-wiring (2026-10-10).
 *
 * `buildStudioPreviewHtml` returns a complete `srcdoc` for an `<iframe sandbox="allow-scripts">`
 * (opaque origin: no vault, IndexedDB, localStorage or editor access). It runs the region's code
 * exactly as a published page would: the `ckEngines` shim, the full pixi.js bundle and the
 * add-on libraries the code names, the sound engine when it plays sound, and the `scripts` pack
 * in published mode (watching `data-ck-params`, so a params message re-runs the script).
 *
 * The host talks to it over `postMessage` (the frame answers its parent only, and reads only
 * messages whose `event.source` is its parent):
 * - in: `ck-preview:params` {values}, `ck-preview:run`, `ck-preview:pause` {paused?},
 *   `ck-preview:capture`;
 * - out: `ck-preview:ready`, `ck-preview:thumbnail` {dataUrl} (320×180 WebP),
 *   `ck-preview:error` {message, line}, `ck-preview:fps` {fps, paused} every second, and — when
 *   built with `probe` (creative-power Phase 2 E) — one `ck-preview:probe` {report} once the
 *   region has settled (scene-probe-frame.ts), with a picture of the page when `probe.thumbnail`
 *   asks for one (scene-probe-capture.ts).
 */

export type StudioPreviewTrust = 'trusted' | 'unreviewed';

export interface StudioPreviewOptions {
  readonly code: string;
  /** The script's `jsParams` values (rendered as `data-ck-params`). */
  readonly params?: Readonly<Record<string, unknown>> | undefined;
  /** Libraries to ship even when the code does not name them literally. */
  readonly libs?: readonly StudioLibKey[] | undefined;
  /** Ship the sound engine even when the code does not name `ck.sound`. */
  readonly sound?: boolean | undefined;
  readonly lang?: string | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
  /** The theme's CSS variables (`--t-*`, `--bldr-*`), so `s.palette` reads the site's colours. */
  readonly themeCss?: string | undefined;
  /** Simulate `prefers-reduced-motion: reduce` inside the frame. */
  readonly reducedMotion?: boolean | undefined;
  /** 'unreviewed' (an imported entry not yet trusted): no network at all, no remote images. */
  readonly trust?: StudioPreviewTrust | undefined;
  /** The layout viewport width in CSS px (mobile 390 / tablet 820 / desktop 1280). */
  readonly width?: number | undefined;
  /** Project sound-bank entries the code plays as `lib:<id>`, inlined as on a published page. */
  readonly soundBank?: Readonly<Record<string, unknown>> | undefined;
  /** Uploaded sounds the code plays as `asset:<id>`: id → `data:audio/*` url. */
  readonly soundAssets?: Readonly<Record<string, string>> | undefined;
  /** Test seam: replaces the asset loaders (`ENGINE_LOADERS`). */
  readonly loaders?: Partial<Readonly<Record<PageEngine, EngineLoader>>> | undefined;
  /**
   * A rendered region (a section: markup whose root carries `data-ck-js`) to run in place of the
   * code-only region; `code` then only picks the engines. The section keeps its own height and
   * the page may scroll, so its layout can be measured.
   */
  readonly markup?: string | undefined;
  /** Post one `ck-preview:probe` report once the region has settled (scene-probe-frame.ts). */
  readonly probe?: StudioProbeSettings | undefined;
}

export const STUDIO_PREVIEW_MESSAGES = {
  params: 'ck-preview:params',
  run: 'ck-preview:run',
  pause: 'ck-preview:pause',
  capture: 'ck-preview:capture',
  ready: 'ck-preview:ready',
  thumbnail: 'ck-preview:thumbnail',
  error: 'ck-preview:error',
  fps: 'ck-preview:fps',
  probe: 'ck-preview:probe',
} as const;

/** The region element's id inside the preview document. */
export const STUDIO_PREVIEW_REGION_ID = 'ck-preview';

/**
 * The preview's Content-Security-Policy (DESIGN §D.3). `script-src` also carries
 * `'unsafe-eval'`: the `scripts` pack compiles the region's code with the AsyncFunction
 * constructor (that IS free-code mode; the opaque-origin sandbox is the boundary), and pixi.js
 * builds its uniform-sync functions the same way. `worker-src blob:` lets Pixi decode images off
 * the main thread. An 'unreviewed' entry gets no network and no remote images.
 */
export function studioPreviewCsp(trust: StudioPreviewTrust = 'trusted'): string {
  const unreviewed = trust === 'unreviewed';
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval'",
    "style-src 'unsafe-inline'",
    unreviewed ? 'img-src data: blob:' : 'img-src data: blob: https:',
    'media-src data: blob:',
    unreviewed ? 'font-src data:' : 'font-src data: https:',
    unreviewed ? "connect-src 'none'" : 'connect-src https: data: blob:',
    'worker-src blob:',
  ].join('; ');
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

/** Script text safe inside an inline `<script>`: a `</script` would end the element early. */
function inlineScript(text: string): string {
  return text.replace(/<\/(script)/giu, '<\\/$1');
}

function inlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

/** The engines the preview inlines, in load order: pixi, the libraries, then sound. */
export function studioPreviewEngines(
  options: Pick<StudioPreviewOptions, 'code' | 'libs' | 'sound'>,
): PageEngine[] {
  const used = codeEngines(options.code);
  for (const key of options.libs ?? []) {
    if (!(STUDIO_LIB_KEYS as readonly string[]).includes(key)) continue;
    used.add(`lib-${key}`);
    if (STUDIO_PIXI_BOUND_KEYS.includes(key)) used.add('pixi');
  }
  if (options.sound === true) used.add('sound');
  const order: PageEngine[] = [
    'pixi',
    ...STUDIO_LIB_KEYS.map((key): PageEngine => `lib-${key}`),
    'sound',
  ];
  return order.filter((kind) => used.has(kind));
}

/**
 * Inside the frame: the host bridge (serialised with `Function.prototype.toString`, so it is
 * self-contained — named function expressions, no module-scope reference). `mount` is the
 * serialised `mountScripts`; `probe`, when given, the serialised scene probe, called once the
 * region is mounted with every error the bridge has reported (and will report).
 */
export function studioPreviewBridge(
  win: Window,
  mount: (
    root: ParentNode,
    options?: { readonly interactive?: boolean; readonly watch?: boolean },
  ) => () => void,
  reducedMotion: boolean,
  probe?:
    | ((
        win: Window,
        seen: StudioProbeSeen,
        post: (message: Record<string, unknown>) => void,
      ) => void)
    | null,
): void {
  const doc = win.document;
  const host = win.parent;
  const REGION_ID = 'ck-preview';
  // "async function anonymous(ck\n) {\n" + '"use strict";\n' precede the author's first line.
  const LINE_OFFSET = 3;

  const seen: StudioProbeSeen = { errors: [] };
  function post(message: Record<string, unknown>): void {
    try {
      if (host !== win) host.postMessage(message, '*');
    } catch {
      // The host went away: nobody is listening.
    }
  }

  /* ── reduced motion, simulated ── */
  if (reducedMotion) {
    const native = typeof win.matchMedia === 'function' ? win.matchMedia.bind(win) : null;
    win.matchMedia = function matchMedia(query: string): MediaQueryList {
      if (!query.includes('prefers-reduced-motion') && native !== null) return native(query);
      const matches =
        query.includes('prefers-reduced-motion') &&
        query.includes('reduce') &&
        !query.includes('no-preference');
      return {
        matches,
        media: query,
        onchange: null,
        addListener: function addListener(): void {
          /* a simulated query never changes */
        },
        removeListener: function removeListener(): void {
          /* a simulated query never changes */
        },
        addEventListener: function addEventListener(): void {
          /* a simulated query never changes */
        },
        removeEventListener: function removeEventListener(): void {
          /* a simulated query never changes */
        },
        dispatchEvent: function dispatchEvent(): boolean {
          return false;
        },
      } as MediaQueryList;
    };
  }

  /* ── pause: animation frames are held while paused ── */
  let paused = false;
  let nextHeld = -1;
  const held: { id: number; callback: FrameRequestCallback }[] = [];
  const nativeFrame = win.requestAnimationFrame.bind(win);
  const nativeCancel = win.cancelAnimationFrame.bind(win);
  win.requestAnimationFrame = function requestAnimationFrame(
    callback: FrameRequestCallback,
  ): number {
    if (!paused) return nativeFrame(callback);
    nextHeld -= 1;
    held.push({ id: nextHeld, callback });
    return nextHeld;
  };
  win.cancelAnimationFrame = function cancelAnimationFrame(id: number): void {
    if (id >= 0) {
      nativeCancel(id);
      return;
    }
    for (let at = held.length - 1; at >= 0; at -= 1) if (held[at]?.id === id) held.splice(at, 1);
  };
  function release(): void {
    const waiting = held.splice(0, held.length);
    for (const item of waiting) nativeFrame(item.callback);
  }

  /* ── errors: the scripts pack logs `[ck-js] <id> <error>` ── */
  function lineOf(error: unknown): number | null {
    const stack =
      error !== null &&
      typeof error === 'object' &&
      typeof (error as { stack?: unknown }).stack === 'string'
        ? (error as { stack: string }).stack
        : '';
    const match = /ck-js-[A-Za-z0-9_.-]*\.js:(\d+)/u.exec(stack);
    if (match === null) return null;
    const line = Number(match[1]) - LINE_OFFSET;
    return line >= 1 ? line : null;
  }
  function report(error: unknown): void {
    const message =
      error !== null &&
      typeof error === 'object' &&
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error);
    const line = lineOf(error);
    if (seen.errors.length < 8) seen.errors.push({ message, line });
    post({ type: 'ck-preview:error', message, line });
  }
  const consoleRef = (win as Window & { console: Console }).console;
  const nativeError = consoleRef.error.bind(consoleRef);
  consoleRef.error = function error(): void {
    // `arguments`, not rest/spread: this body is serialised (see the header).
    // eslint-disable-next-line prefer-rest-params -- see above
    const args = Array.prototype.slice.call(arguments) as unknown[];
    if (args[0] === '[ck-js]') report(args[2]);
    // Pixi's own errors (a shader that will not link…) are the probe's to read, not the Studio's.
    else if (
      typeof args[0] === 'string' &&
      args[0].startsWith('PixiJS Error') &&
      seen.errors.length < 8
    )
      seen.errors.push({ message: args[0].slice(0, 200), line: null });
    nativeError.apply(consoleRef, args);
  };
  win.addEventListener('error', function onError(event: ErrorEvent): void {
    report(event.error ?? event.message);
  });
  win.addEventListener(
    'unhandledrejection',
    function onRejection(event: PromiseRejectionEvent): void {
      report(event.reason);
    },
  );

  /* ── the region ── */
  let dispose = mount(doc);
  function rerun(): void {
    dispose();
    dispose = mount(doc);
  }

  /* ── fps, every second (a frozen page sends none: the host's watchdog notices) ── */
  let frames = 0;
  let last = win.performance.now();
  function count(): void {
    frames += 1;
    nativeFrame(count);
  }
  nativeFrame(count);
  win.setInterval(function tick(): void {
    const now = win.performance.now();
    const fps = now > last ? Math.round((frames * 1000) / (now - last)) : 0;
    frames = 0;
    last = now;
    post({ type: 'ck-preview:fps', fps, paused });
  }, 1000);

  /* ── a 320×180 WebP thumbnail of the stage, cover-fitted, taken right after Pixi renders ── */
  function capture(): void {
    if (paused) release();
    nativeFrame(function shoot(): void {
      const region = doc.getElementById(REGION_ID);
      const source = region === null ? null : region.querySelector('canvas');
      const out = doc.createElement('canvas');
      out.width = 320;
      out.height = 180;
      const context = out.getContext('2d');
      if (context === null) {
        report(new Error('This browser cannot draw a thumbnail.'));
        return;
      }
      if (source !== null && source.width > 0 && source.height > 0) {
        const scale = Math.max(320 / source.width, 180 / source.height);
        const width = source.width * scale;
        const height = source.height * scale;
        try {
          context.drawImage(source, (320 - width) / 2, (180 - height) / 2, width, height);
        } catch (error) {
          report(error);
          return;
        }
      }
      let dataUrl = '';
      try {
        dataUrl = out.toDataURL('image/webp', 0.85);
      } catch (error) {
        report(error);
        return;
      }
      post({ type: 'ck-preview:thumbnail', dataUrl });
    });
  }

  /* ── the host's messages (its own, only) ── */
  win.addEventListener('message', function onMessage(event: MessageEvent): void {
    if (event.source !== host) return;
    const data = event.data as { type?: unknown; values?: unknown; paused?: unknown } | null;
    if (data === null || typeof data !== 'object' || typeof data.type !== 'string') return;
    if (data.type === 'ck-preview:params') {
      const region = doc.getElementById(REGION_ID);
      if (region === null) return;
      const values = data.values;
      if (
        values !== null &&
        typeof values === 'object' &&
        !Array.isArray(values) &&
        Object.keys(values).length > 0
      ) {
        // The scripts pack watches this attribute: a change re-runs the region.
        region.setAttribute('data-ck-params', JSON.stringify(values));
      } else {
        region.removeAttribute('data-ck-params');
      }
    } else if (data.type === 'ck-preview:run') {
      paused = false;
      release();
      rerun();
    } else if (data.type === 'ck-preview:pause') {
      paused = data.paused !== false;
      if (!paused) release();
    } else if (data.type === 'ck-preview:capture') {
      capture();
    }
  });

  post({ type: 'ck-preview:ready' });
  if (typeof probe === 'function') probe(win, seen, post);
}

/** The complete `srcdoc` for the sandboxed Studio preview (DESIGN §D.3). */
export async function buildStudioPreviewHtml(options: StudioPreviewOptions): Promise<string> {
  const engines = studioPreviewEngines(options);
  const sources = await Promise.all(
    engines.map((kind) => (options.loaders?.[kind] ?? ENGINE_LOADERS[kind])()),
  );
  const lang =
    options.lang !== undefined && /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u.test(options.lang)
      ? options.lang
      : 'en';
  const dir = options.dir === 'rtl' ? 'rtl' : 'ltr';
  const width =
    typeof options.width === 'number' && Number.isFinite(options.width) && options.width > 0
      ? Math.round(options.width)
      : undefined;
  const params =
    options.params !== undefined && Object.keys(options.params).length > 0
      ? JSON.stringify(options.params)
      : undefined;
  const themeCss = (options.themeCss ?? '').replace(/<\/(style)/giu, '<\\/$1');
  const markup = options.markup;
  const style = [
    markup === undefined
      ? 'html,body{margin:0;padding:0;height:100%;overflow:hidden;background:var(--t-surface,transparent);color:var(--t-text,inherit)}'
      : 'html,body{margin:0;padding:0;background:var(--t-surface,transparent);color:var(--t-text,inherit)}',
    markup === undefined
      ? `#${STUDIO_PREVIEW_REGION_ID}{position:relative;width:100%;height:100%;overflow:hidden}`
      : `#${STUDIO_PREVIEW_REGION_ID}{position:relative;width:100%}`,
    themeCss,
  ].join('\n');

  const engineScripts = engines.map(
    (kind, at) => `<script data-ck-engine="${kind}">${inlineScript(sources[at] ?? '')}</script>`,
  );
  const soundData: string[] = [];
  if (engines.includes('sound')) {
    for (const [id, url] of Object.entries(options.soundAssets ?? {})) {
      if (!/^data:audio\//iu.test(url)) continue;
      soundData.push(
        `<link rel="ck-sound-asset" data-ck-sound-asset="${escapeAttribute(id)}" href="${escapeAttribute(url)}">`,
      );
    }
    if (options.soundBank !== undefined && Object.keys(options.soundBank).length > 0) {
      soundData.push(
        `<script type="application/json" data-ck-sound-bank>${inlineJson(options.soundBank)}</script>`,
      );
    }
  }

  const region =
    markup === undefined
      ? [
          `<div id="${STUDIO_PREVIEW_REGION_ID}" data-ck-custom-code=""`,
          ` data-ck-js-id="preview" data-ck-js="${escapeAttribute(options.code)}"`,
          params === undefined ? '' : ` data-ck-params="${escapeAttribute(params)}"`,
          '></div>',
        ].join('')
      : `<div id="${STUDIO_PREVIEW_REGION_ID}">${markup}</div>`;

  const probe =
    options.probe === undefined
      ? 'null'
      : `function probe(w, seen, post) { (${studioSceneProbe.toString()})(w, seen, post, ${inlineJson(options.probe)}, ${options.probe.thumbnail === undefined ? 'null' : studioProbeCapture.toString()}); }`;
  const bridge = `(${studioPreviewBridge.toString()})(window, ${mountScripts.toString()}, ${String(options.reducedMotion === true)}, ${probe});`;

  return [
    '<!doctype html>',
    `<html lang="${escapeAttribute(lang)}" dir="${dir}">`,
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(studioPreviewCsp(options.trust))}">`,
    `<meta name="viewport" content="${width === undefined ? 'width=device-width' : `width=${String(width)}`}, initial-scale=1">`,
    `<style>${style}</style>`,
    ...soundData,
    options.probe === undefined
      ? ''
      : `<script>(${studioProbeContexts.toString()})(window);</script>`,
    `<script>(${ensureCkEngines.toString()})(window);</script>`,
    ...engineScripts,
    '</head>',
    '<body>',
    region,
    `<script>${inlineScript(bridge)}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}
