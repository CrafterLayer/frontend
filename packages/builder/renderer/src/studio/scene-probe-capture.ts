/**
 * Inside the preview document: a small picture of what a visitor sees (visual self-review,
 * 2026-10-13). The scene probe (scene-probe-frame.ts) calls it once the region has settled, so a
 * build can SHOW the model the rendered scene beside its contract and ask what visibly fails.
 *
 * The whole page is drawn, not only the stage: the document's body is cloned (scripts left out,
 * each canvas swapped for an image of its current frame), wrapped in an SVG `foreignObject` with
 * the document's own styles, and that SVG is drawn onto a canvas at the thumbnail's size — so
 * the text over the art, the controls, the layout and the overlaps are in the picture too.
 * Remote images and web fonts do not load inside an SVG picture: photos come out empty and text
 * in a fallback face, which a review is told nothing about and never needs to judge.
 *
 * Answers `done` exactly once: the picture as a JPEG (or PNG) data URL with how much of it is
 * drawn (`ink`), or null when it cannot be taken — a browser that taints the canvas (Safari, an
 * SVG picture), a picture over `maxChars` even at a lower quality, or one not ready in 1.5 s.
 *
 * Serialised with `Function.prototype.toString` like the probe: self-contained (named function
 * expressions, no module-scope reference, no spread). Never throws into the page.
 */

export interface StudioProbeThumbnailSettings {
  /** The picture's largest size in px; the viewport is scaled down to fit it, its shape kept. */
  readonly width: number;
  readonly height: number;
  /** `image/jpeg` (smallest) or `image/png`. */
  readonly type: string;
  /** JPEG quality, 0–1. */
  readonly quality: number;
  /** The longest data URL kept: a bigger picture is taken once more at lower quality, then dropped. */
  readonly maxChars: number;
}

export interface StudioProbeThumbnail {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  /** The share of sampled pixels unlike the picture's dominant colour, 0–1 (near 0: blank). */
  readonly ink: number;
}

export function studioProbeCapture(
  win: Window,
  settings: StudioProbeThumbnailSettings,
  done: (thumbnail: StudioProbeThumbnail | null) => void,
): void {
  const doc = win.document;
  let answered = false;
  function answer(thumbnail: StudioProbeThumbnail | null): void {
    if (answered) return;
    answered = true;
    try {
      done(thumbnail);
    } catch {
      // The probe's own callback: nothing to do about it here.
    }
  }
  win.setTimeout(function late(): void {
    answer(null);
  }, 1_500);

  const viewWidth = Math.max(1, Math.round(win.innerWidth > 0 ? win.innerWidth : settings.width));
  const viewHeight = Math.max(
    1,
    Math.round(win.innerHeight > 0 ? win.innerHeight : settings.height),
  );
  const scale = Math.min(1, settings.width / viewWidth, settings.height / viewHeight);
  const width = Math.max(1, Math.round(viewWidth * scale));
  const height = Math.max(1, Math.round(viewHeight * scale));

  /** One canvas's current frame, at the picture's scale, as a PNG (a stage may be transparent). */
  function frameOf(canvas: HTMLCanvasElement, box: DOMRect): string {
    if (canvas.width === 0 || canvas.height === 0 || box.width < 1 || box.height < 1) return '';
    try {
      const copy = doc.createElement('canvas');
      copy.width = Math.max(1, Math.round(box.width * scale));
      copy.height = Math.max(1, Math.round(box.height * scale));
      const context = copy.getContext('2d');
      if (context === null) return '';
      context.drawImage(canvas, 0, 0, copy.width, copy.height);
      return copy.toDataURL('image/png');
    } catch {
      // A canvas tainted by a remote image: its place stays empty.
      return '';
    }
  }

  const LAYOUT = [
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'z-index',
    'display',
    'margin',
    'transform',
    'opacity',
    'mix-blend-mode',
    'filter',
  ];

  /** The body as the picture shows it: no scripts, every canvas an image of what it shows now. */
  function cloneBody(): HTMLElement {
    const body = doc.body.cloneNode(true) as HTMLElement;
    for (const script of Array.from(body.querySelectorAll('script'))) script.remove();
    const live = Array.from(doc.body.querySelectorAll('canvas'));
    const copies = Array.from(body.querySelectorAll('canvas'));
    copies.forEach(function swap(copy, at): void {
      const canvas = live[at];
      if (canvas === undefined) return;
      const box = canvas.getBoundingClientRect();
      const image = doc.createElement('img');
      for (const name of ['id', 'class', 'style']) {
        const value = copy.getAttribute(name);
        if (value !== null) image.setAttribute(name, value);
      }
      // A rule written for `canvas` does not match the image: carry the canvas's own layout.
      const computed = win.getComputedStyle(canvas);
      for (const property of LAYOUT) {
        image.style.setProperty(property, computed.getPropertyValue(property));
      }
      image.style.width = `${String(box.width)}px`;
      image.style.height = `${String(box.height)}px`;
      const source = frameOf(canvas, box);
      if (source !== '') image.setAttribute('src', source);
      image.setAttribute('alt', '');
      copy.replaceWith(image);
    });
    const style = doc.createElement('style');
    style.textContent = Array.from(doc.querySelectorAll('style'))
      .map(function text(element): string {
        return element.textContent;
      })
      .join('\n');
    body.insertBefore(style, body.firstChild);
    return body;
  }

  /** Pixels unlike the dominant colour (4-bit buckets), sampled every fourth pixel. */
  function inkOf(context: CanvasRenderingContext2D): number {
    const data = context.getImageData(0, 0, width, height).data;
    const counts = new Map<number, number>();
    let mode = 0;
    let best = -1;
    let sampled = 0;
    for (let at = 0; at < data.length; at += 16) {
      const key =
        (((data[at] ?? 0) >> 4) << 8) |
        (((data[at + 1] ?? 0) >> 4) << 4) |
        ((data[at + 2] ?? 0) >> 4);
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      sampled += 1;
      if (next > best) {
        best = next;
        mode = key;
      }
    }
    if (sampled === 0) return 0;
    return Math.round(((sampled - (counts.get(mode) ?? 0)) / sampled) * 10_000) / 10_000;
  }

  function draw(picture: HTMLImageElement): void {
    try {
      const out = doc.createElement('canvas');
      out.width = width;
      out.height = height;
      const context = out.getContext('2d');
      if (context === null) {
        answer(null);
        return;
      }
      const ground = win.getComputedStyle(doc.body).backgroundColor;
      const root = win.getComputedStyle(doc.documentElement).backgroundColor;
      const clear = /^(?:transparent|rgba\(\s*0,\s*0,\s*0,\s*0\s*\))$/u;
      context.fillStyle = !clear.test(ground) ? ground : !clear.test(root) ? root : '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(picture, 0, 0, width, height);
      let dataUrl = out.toDataURL(settings.type, settings.quality);
      if (dataUrl.length > settings.maxChars) {
        dataUrl = out.toDataURL('image/jpeg', Math.min(settings.quality, 0.72) * 0.6);
      }
      if (dataUrl.length > settings.maxChars || !dataUrl.startsWith('data:image/')) {
        answer(null);
        return;
      }
      answer({ dataUrl, width, height, ink: inkOf(context) });
    } catch {
      // A tainted canvas (an SVG picture in a browser that will not read it back).
      answer(null);
    }
  }

  try {
    const body = cloneBody();
    const markup = new (win as Window & typeof globalThis).XMLSerializer().serializeToString(body);
    const root = doc.documentElement;
    const lang = (root.getAttribute('lang') ?? 'en').replace(/[^\w-]/gu, '');
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${String(viewWidth)}" height="${String(viewHeight)}">`,
      `<foreignObject x="0" y="0" width="100%" height="100%">`,
      `<div xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" dir="${root.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr'}" style="width:${String(viewWidth)}px;height:${String(viewHeight)}px;overflow:hidden">`,
      markup,
      '</div></foreignObject></svg>',
    ].join('');
    const picture = new (win as Window & typeof globalThis).Image();
    picture.onload = function loaded(): void {
      draw(picture);
    };
    picture.onerror = function failed(): void {
      answer(null);
    };
    picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    answer(null);
  }
}
