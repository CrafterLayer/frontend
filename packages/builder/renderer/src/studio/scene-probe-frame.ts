/**
 * Inside the preview document: the scene probe (creative-power Phase 2 E, 2026-10-12).
 *
 * After mounting, waits for the canvas and settleMs, measures geometry/pixels/errors and
 * optionally clicks Start/Next/Play. Posts ONE `ck-preview:probe` {report} by `deadline`.
 *
 * Serialised with `Function.prototype.toString` like the bridge: self-contained (named function
 * expressions, no module-scope reference, no spread). Never throws into the page. With `thumbnail`
 * and `capture` (scene-probe-capture.ts) it also posts a picture of the page as it was measured.
 */
import type { StudioProbeThumbnailSettings, studioProbeCapture } from './scene-probe-capture';

export interface StudioProbeSettings {
  /** Wall-clock time (`Date.now()`) by which the report is posted, whatever was measured. */
  readonly deadline: number;
  /** Wait at most this long for the region's canvas, when one is expected. */
  readonly canvasWaitMs: number;
  /** How long the scene runs, once its canvas is there, before it is measured. */
  readonly settleMs: number;
  /** The code opens a Pixi stage: a canvas should appear. */
  readonly expectCanvas: boolean;
  /** Click the first visible Start/Next/Play control once and watch what changes. */
  readonly click: boolean;
  /** Take a picture of the page as it is measured (visual self-review, 2026-10-13). */
  readonly thumbnail?: StudioProbeThumbnailSettings | undefined;
}

/** What the bridge saw before and during the probe (it records every error it reports). */
export interface StudioProbeSeen {
  readonly errors: { readonly message: string; readonly line: number | null }[];
}

/**
 * First thing in the probe document (before any engine): every WebGL context the scene opens keeps
 * its last frame (`preserveDrawingBuffer`) — read back after the frame was shown, a canvas is
 * otherwise transparent — and skips multisampling, which the measurements do not need and a
 * software renderer pays dearly for. Serialised like the probe.
 */
export function studioProbeContexts(win: Window): void {
  const Canvas = (win as Window & { HTMLCanvasElement?: typeof HTMLCanvasElement })
    .HTMLCanvasElement;
  if (typeof Canvas !== 'function') return;
  const proto = Canvas.prototype as unknown as {
    getContext: (this: HTMLCanvasElement, type: string, attributes?: unknown) => unknown;
  };
  const original = proto.getContext;
  proto.getContext = function getContext(type: string, attributes?: unknown): unknown {
    if (type !== 'webgl' && type !== 'webgl2' && type !== 'experimental-webgl') {
      return original.call(this, type, attributes);
    }
    const given = attributes !== null && typeof attributes === 'object' ? attributes : {};
    return original.call(
      this,
      type,
      Object.assign({}, given, { preserveDrawingBuffer: true, antialias: false }),
    );
  };
}

export function studioSceneProbe(
  win: Window,
  seen: StudioProbeSeen,
  post: (message: Record<string, unknown>) => void,
  settings: StudioProbeSettings,
  capture?: typeof studioProbeCapture | null,
): void {
  const doc = win.document;
  const started = Date.now();
  const CONTROLS = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button]';
  const STARTS =
    /^\s*(?:start|play|next|begin|launch|go\b|ابدأ|ابدا|إبدأ|التالي|تشغيل|شغّل|شغل|العب)/iu;
  let hidden = doc.visibilityState === 'hidden';
  let posted = false;
  let frames = 0;
  let counting = false;
  let countedFrom = 0;

  doc.addEventListener('visibilitychange', function onVisibility(): void {
    if (doc.visibilityState === 'hidden') hidden = true;
  });
  /*
    A scene that saturates the main thread (software WebGL) starves timers while frames still
    come: every timer is also run from the frame loop once it is due, whichever comes first.
  */
  const due: { at: number; run: () => void }[] = [];
  function count(): void {
    if (counting) frames += 1;
    const now = Date.now();
    for (let at = 0; at < due.length;) {
      const entry = due[at];
      if (entry !== undefined && entry.at <= now) {
        due.splice(at, 1);
        entry.run();
      } else {
        at += 1;
      }
    }
    if (!posted) win.requestAnimationFrame(count);
  }
  win.requestAnimationFrame(count);

  function left(): number {
    return settings.deadline - Date.now();
  }
  function later(ms: number, then: () => void): void {
    let ran = false;
    function once(): void {
      if (ran) return;
      ran = true;
      then();
    }
    due.push({ at: Date.now() + Math.max(0, ms), run: once });
    win.setTimeout(once, Math.max(0, Math.round(ms)));
  }
  /** After the next frame renders — or after `ms` when frames are throttled. */
  function afterFrame(ms: number, then: () => void): void {
    let ran = false;
    function once(): void {
      if (ran) return;
      ran = true;
      then();
    }
    win.requestAnimationFrame(once);
    later(ms, once);
  }
  function regionOf(): HTMLElement | null {
    return doc.querySelector<HTMLElement>('[data-ck-js]') ?? doc.getElementById('ck-preview');
  }
  function stageOf(region: HTMLElement | null): HTMLCanvasElement | null {
    if (region === null) return null;
    let best: HTMLCanvasElement | null = null;
    let area = -1;
    for (const canvas of Array.from(region.querySelectorAll('canvas'))) {
      const box = canvas.getBoundingClientRect();
      if (box.width * box.height > area) {
        area = box.width * box.height;
        best = canvas;
      }
    }
    return best;
  }
  function rectOf(element: Element): { x: number; y: number; width: number; height: number } {
    const box = element.getBoundingClientRect();
    return {
      x: Math.round(box.left + win.scrollX),
      y: Math.round(box.top + win.scrollY),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }
  function visible(element: HTMLElement): boolean {
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return false;
    const style = win.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  }
  function labelOf(element: HTMLElement): string {
    const own = element.textContent.trim() !== '' ? element.textContent : null;
    const text =
      element.getAttribute('aria-label') ??
      own ??
      element.getAttribute('value') ??
      element.getAttribute('title') ??
      '';
    const label = text.replace(/\s+/gu, ' ').trim().slice(0, 48);
    return label === '' ? element.tagName.toLowerCase() : label;
  }

  /* ── pixels: a stretched copy of the canvas, read back right after a frame renders ── */
  function pixelsOf(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ): Uint8ClampedArray | null {
    if (canvas.width === 0 || canvas.height === 0 || width < 1 || height < 1) return null;
    try {
      const copy = doc.createElement('canvas');
      copy.width = width;
      copy.height = height;
      const context = copy.getContext('2d', { willReadFrequently: true });
      if (context === null) return null;
      context.drawImage(canvas, 0, 0, width, height);
      return context.getImageData(0, 0, width, height).data;
    } catch {
      return null;
    }
  }
  /** Pixels unlike the dominant colour, sampled every other pixel. Blank: under 24 of them. */
  function inkOf(canvas: HTMLCanvasElement): { blank: boolean; ink: number } | null {
    const box = canvas.getBoundingClientRect();
    const scale = Math.min(1, 960 / Math.max(1, box.width), 960 / Math.max(1, box.height));
    const width = Math.max(1, Math.round(box.width * scale));
    const height = Math.max(1, Math.round(box.height * scale));
    const data = pixelsOf(canvas, width, height);
    if (data === null) return null;
    const counts = new Map<number, number>();
    let mode = 0;
    let best = -1;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const at = (y * width + x) * 4;
        const key =
          ((data[at] ?? 0) << 24) |
          ((data[at + 1] ?? 0) << 16) |
          ((data[at + 2] ?? 0) << 8) |
          (data[at + 3] ?? 0);
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        if (next > best) {
          best = next;
          mode = key;
        }
        if (counts.size > 20000) return { blank: false, ink: 1 };
      }
    }
    const ref = [(mode >>> 24) & 255, (mode >>> 16) & 255, (mode >>> 8) & 255, mode & 255];
    let sampled = 0;
    let inked = 0;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const at = (y * width + x) * 4;
        sampled += 1;
        for (let channel = 0; channel < 4; channel += 1) {
          if (Math.abs((data[at + channel] ?? 0) - (ref[channel] ?? 0)) > 8) {
            inked += 1;
            break;
          }
        }
      }
    }
    return {
      blank: inked < 24,
      ink: sampled === 0 ? 0 : Math.round((inked / sampled) * 10000) / 10000,
    };
  }
  /** A cheap fingerprint of the canvas: does the next frame look any different? */
  function signatureOf(canvas: HTMLCanvasElement | null): string {
    if (canvas === null) return '';
    const data = pixelsOf(canvas, 64, 36);
    if (data === null) return '';
    let hash = 0x811c9dc5;
    for (const byte of data) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
    return String(hash);
  }

  /* ── controls: outside the region, or under the canvas (hit-tested as if it took input) ── */
  function hitOf(control: HTMLElement): 'canvas' | 'other' | null {
    if (typeof doc.elementFromPoint !== 'function') return null;
    let box = control.getBoundingClientRect();
    let y = box.top + box.height / 2;
    if (y < 0 || y >= win.innerHeight) {
      win.scrollTo(win.scrollX, win.scrollY + y - win.innerHeight / 2);
      box = control.getBoundingClientRect();
      y = box.top + box.height / 2;
    }
    const x = box.left + box.width / 2;
    if (x < 0 || x >= win.innerWidth || y < 0 || y >= win.innerHeight) return null;
    const hit = doc.elementFromPoint(x, y);
    if (hit === null || hit === control || control.contains(hit)) return null;
    if (hit.nodeName === 'CANVAS') return 'canvas';
    // The control itself is not hit-testable (an ancestor answered): not ours to judge.
    return hit.contains(control) ? null : 'other';
  }
  function controlsOf(
    region: HTMLElement,
    regionBox: { x: number; y: number; width: number; height: number },
  ) {
    const found: {
      label: string;
      tag: string;
      rect: { x: number; y: number; width: number; height: number };
      outside: boolean;
      covered: 'canvas' | 'other' | null;
    }[] = [];
    const elements: HTMLElement[] = [];
    const canvases = region.querySelectorAll('canvas');
    const pointer: string[] = [];
    const scrollX = win.scrollX;
    const scrollY = win.scrollY;
    for (const canvas of canvases) {
      pointer.push(canvas.style.pointerEvents);
      canvas.style.pointerEvents = 'auto';
    }
    try {
      const all = region.querySelectorAll<HTMLElement>(CONTROLS);
      for (const control of all) {
        if (found.length >= 24) break;
        if (!visible(control)) continue;
        const rect = rectOf(control);
        const outside =
          rect.x < regionBox.x - 2 ||
          rect.y < regionBox.y - 2 ||
          rect.x + rect.width > regionBox.x + regionBox.width + 2 ||
          rect.y + rect.height > regionBox.y + regionBox.height + 2 ||
          rect.x < -2 ||
          rect.x + rect.width > win.innerWidth + 2;
        const own = control.style.pointerEvents;
        control.style.pointerEvents = 'auto';
        let covered: 'canvas' | 'other' | null = null;
        try {
          covered = hitOf(control);
        } finally {
          control.style.pointerEvents = own;
        }
        found.push({
          label: labelOf(control),
          tag: control.tagName.toLowerCase(),
          rect,
          outside,
          covered,
        });
        elements.push(control);
      }
    } finally {
      canvases.forEach(function restore(canvas, at): void {
        canvas.style.pointerEvents = pointer[at] ?? '';
      });
      if (win.scrollX !== scrollX || win.scrollY !== scrollY) win.scrollTo(scrollX, scrollY);
    }
    return { found, elements };
  }

  /* ── the report ── */
  function measure() {
    const region = regionOf();
    const canvas = stageOf(region);
    const regionBox = region === null ? null : rectOf(region);
    const canvasBox = canvas === null ? null : rectOf(canvas);
    const controls =
      region === null || regionBox === null
        ? { found: [], elements: [] }
        : controlsOf(region, regionBox);
    const pixels = canvas === null ? null : inkOf(canvas);
    const seconds = (Date.now() - countedFrom) / 1000;
    const root = doc.documentElement;
    return {
      region,
      canvas,
      elements: controls.elements,
      report: {
        viewport: { width: win.innerWidth, height: win.innerHeight },
        region: regionBox,
        canvas:
          canvas === null || canvasBox === null
            ? null
            : {
                rect: canvasBox,
                width: canvas.width,
                height: canvas.height,
                scrollPinned: canvas.getAttribute('data-ck-scroll-pinned') === 'true',
              },
        covers:
          regionBox === null || canvasBox === null
            ? null
            : canvasBox.x <= regionBox.x + 2 &&
              canvasBox.y <= regionBox.y + 2 &&
              canvasBox.x + canvasBox.width >= regionBox.x + regionBox.width - 2 &&
              canvasBox.y + canvasBox.height >= regionBox.y + regionBox.height - 2,
        controls: controls.found,
        overflowX: Math.max(0, Math.round(root.scrollWidth - root.clientWidth)),
        blank: pixels === null ? null : pixels.blank,
        ink: pixels === null ? null : pixels.ink,
        fps: counting && seconds > 0.2 ? Math.round(frames / seconds) : null,
        errors: seen.errors.slice(0, 8),
        click: null as { label: string; changed: boolean | null } | null,
        hidden,
        settledMs: Date.now() - started,
        waitedMs: (counting ? countedFrom : Date.now()) - started,
        ranMs: counting ? Date.now() - countedFrom : 0,
      },
    };
  }
  /* ── the picture, taken as the scene is measured; the report waits for it until its deadline ── */
  let shooting = false;
  let shot: unknown = null;
  function picture(): void {
    if (settings.thumbnail === undefined || typeof capture !== 'function' || shooting) return;
    shooting = true;
    try {
      capture(win, settings.thumbnail, function taken(thumbnail): void {
        shot = thumbnail;
        shooting = false;
      });
    } catch {
      shooting = false; // No picture: the report goes without one.
    }
  }
  function finish(report: Record<string, unknown>): void {
    if (posted) return;
    if (shooting && left() > 80) {
      later(30, function wait(): void {
        finish(report);
      });
      return;
    }
    posted = true;
    report['errors'] = seen.errors.slice(0, 8);
    report['hidden'] = hidden;
    if (settings.thumbnail !== undefined) report['thumbnail'] = shooting ? null : shot;
    post({ type: 'ck-preview:probe', report });
  }

  /* ── one click on the first visible Start/Next/Play control ── */
  function clickOnce(measured: ReturnType<typeof measure>): void {
    const { report, region, canvas } = measured;
    let target: HTMLElement | null = null;
    for (const element of measured.elements) {
      if ((element as Partial<HTMLButtonElement>).disabled) continue;
      if (STARTS.test(labelOf(element))) {
        target = element;
        break;
      }
    }
    if (!settings.click || target === null || region === null || left() < 1000) {
      finish(report);
      return;
    }
    const clicked = target;
    let changes = 0;
    const Observer = (win as Window & { MutationObserver?: typeof MutationObserver })
      .MutationObserver;
    const observer =
      typeof Observer === 'function'
        ? new Observer(function changed(records: MutationRecord[]): void {
            for (const record of records) if (record.target.nodeName !== 'CANVAS') changes += 1;
          })
        : null;
    if (observer !== null) {
      observer.observe(region, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    }
    const before = signatureOf(canvas);
    later(300, function baseline(): void {
      afterFrame(150, function click(): void {
        const still = signatureOf(canvas);
        const quiet = changes;
        const errors = seen.errors.length;
        changes = 0;
        clicked.click();
        later(Math.min(500, left() - 250), function watch(): void {
          afterFrame(150, function judge(): void {
            if (observer !== null) observer.disconnect();
            const after = signatureOf(canvas);
            const dom = observer === null || quiet > 0 ? null : changes > 0;
            const drawn = before === '' || before !== still ? null : after !== still;
            const changed =
              seen.errors.length > errors || dom === true || drawn === true
                ? true
                : dom === false && (drawn === false || canvas === null)
                  ? false
                  : null;
            report.click = { label: labelOf(clicked), changed };
            finish(report);
          });
        });
      });
    });
  }

  /* ── the timeline: wait for the canvas, settle, measure (then maybe click) ── */
  later(left() - 40, function late(): void {
    if (!posted) finish(measure().report);
  });
  /* The canvas first, then the settle; the click only gets what is left (≥ 1 s). */
  function settle(): void {
    counting = true;
    countedFrom = Date.now();
    later(Math.min(settings.settleMs, left() - 250), function measured(): void {
      afterFrame(200, function shoot(): void {
        if (posted) return;
        try {
          const measured = measure();
          picture();
          clickOnce(measured);
        } catch (error) {
          post({ type: 'ck-preview:probe', report: null, failure: String(error) });
          posted = true;
        }
      });
    });
  }
  function awaitCanvas(): void {
    if (posted) return;
    const ready =
      !settings.expectCanvas ||
      stageOf(regionOf()) !== null ||
      seen.errors.length > 0 ||
      Date.now() - started >= settings.canvasWaitMs ||
      left() <= settings.settleMs / 2 + 250;
    if (ready) settle();
    else later(50, awaitCanvas);
  }
  awaitCanvas();
}
