import { fileURLToPath } from 'node:url';

import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';

/*
  creative-power Phase 1 (2026-10-12): every builtin scene preset, run in the generated, sandboxed
  Studio preview (`buildStudioPreviewHtml`: real Pixi v8 + WebGL, the add-on libraries the code
  names, CSP without network) exactly as a published region would run it. Each preset must report
  `ck-preview:ready`, finish its body, throw and log no error while it animates (a shader that
  fails to compile only logs), and draw something: the 16:9 `ck-preview:thumbnail` it returns on
  `ck-preview:capture` is not blank.

  The catalogue has no public door yet (Phase 2 adds the agent's `scene.preset` tool and exports
  it), so it is loaded by path; the presets' static checks live beside it in `presets.test.ts`.
*/

interface PresetUnderTest {
  readonly id: string;
  readonly code: string;
  readonly params: readonly { readonly key: string; readonly type: string }[];
}

const CATALOGUE = fileURLToPath(
  new URL('../../../../packages/builder/ai/src/scene-presets/catalog.ts', import.meta.url),
);
const { SCENE_PRESETS } = (await import(/* @vite-ignore */ CATALOGUE)) as {
  SCENE_PRESETS: readonly PresetUnderTest[];
};

const QA = process.env['CRAFTKIT_BROWSER_QA'] === '1';
/** Console errors the offline sandbox causes on purpose: a remote photo is refused or aborted. */
const EXPECTED_CONSOLE = /Failed to load resource|Content Security Policy|net::ERR_/u;
const QA_STYLE = `html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui}`;
const HOST = `<!doctype html><html><body style="margin:0"><script>window.__ck=[];addEventListener('message',function(e){var d=e.data;if(d&&typeof d.type==='string'&&d.type.indexOf('ck-preview:')===0)window.__ck.push(d);});</script><iframe title="Scene preset QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>`;
/**
 * A thumbnail draws something when this share of its pixels (≈ 115 of 320×180) leaves its most
 * common colour; a blank one has none. Low on purpose: confetti is a few hundred small papers.
 */
const MIN_INK = 0.002;

interface PreviewMessage {
  readonly type: string;
  readonly message?: string;
  readonly line?: number | null;
  readonly fps?: number;
  readonly dataUrl?: string;
}

interface Ink {
  /** Share of thumbnail pixels that differ from its most common colour. */
  readonly ink: number;
  /** Distinct colours (4 bits per channel). */
  readonly colours: number;
}

interface RunOptions {
  readonly width: number;
  readonly dir: 'ltr' | 'rtl';
  readonly reducedMotion: boolean;
  readonly params?: Record<string, unknown>;
  readonly trust?: 'trusted' | 'unreviewed';
  /** Ask for thumbnails until one draws something (motion runs). */
  readonly thumbnail: boolean;
}

interface RunResult {
  readonly errors: readonly string[];
  readonly ready: boolean;
  readonly fps: number;
  readonly thumbnail: Ink | null;
}

async function messages(page: Page): Promise<PreviewMessage[]> {
  return page.evaluate<PreviewMessage[]>('window.__ck');
}

function errorsIn(list: readonly PreviewMessage[]): string[] {
  return list
    .filter((message) => message.type === 'ck-preview:error')
    .map((message) => `${message.message ?? '?'} (line ${String(message.line ?? '?')})`);
}

function drawsSomething(ink: Ink | null): boolean {
  return ink !== null && ink.ink >= MIN_INK && ink.colours >= 3;
}

/** How much a thumbnail data URL draws, decoded in the host page. */
async function inkOf(page: Page, dataUrl: string): Promise<Ink> {
  return page.evaluate(async (url: string) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('no 2d context');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const counts = new Map<number, number>();
    for (let at = 0; at < data.length; at += 4) {
      const key =
        (((data[at] ?? 0) >> 4) << 12) |
        (((data[at + 1] ?? 0) >> 4) << 8) |
        (((data[at + 2] ?? 0) >> 4) << 4) |
        ((data[at + 3] ?? 0) >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const dominant = Math.max(...counts.values());
    return { ink: 1 - dominant / (data.length / 4), colours: counts.size };
  }, dataUrl);
}

/**
 * Asks the preview for thumbnails until one draws something: at once, because a burst (confetti)
 * is gone a second later, and again for ~3 s while a slow scene (software WebGL) builds up.
 */
async function capture(page: Page): Promise<Ink | null> {
  let best: Ink | null = null;
  for (let attempt = 0; attempt < 15 && !drawsSomething(best); attempt += 1) {
    if (attempt > 0) await page.waitForTimeout(200);
    const before = (await messages(page)).length;
    await page.evaluate(
      "document.querySelector('iframe').contentWindow.postMessage({type:'ck-preview:capture'},'*')",
    );
    await page.waitForFunction(
      `window.__ck.slice(${String(before)}).some(function(m){return m.type==='ck-preview:thumbnail'||m.type==='ck-preview:error'})`,
      undefined,
      { timeout: 10_000 },
    );
    const shot = (await messages(page))
      .slice(before)
      .find((message) => message.type === 'ck-preview:thumbnail');
    if (shot?.dataUrl?.startsWith('data:image/') === true) {
      const ink = await inkOf(page, shot.dataUrl);
      if (best === null || ink.ink > best.ink) best = ink;
    }
  }
  return best;
}

async function run(
  browser: Browser,
  preset: PresetUnderTest,
  options: RunOptions,
): Promise<RunResult> {
  const context = await browser.newContext({ viewport: { width: options.width, height: 720 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // A shader that fails to compile or link only logs: Pixi draws nothing and throws nothing.
  page.on('console', (message) => {
    if (message.type() === 'error' && !EXPECTED_CONSOLE.test(message.text())) {
      errors.push(`console: ${message.text().slice(0, 300)}`);
    }
  });
  await page.route(/^https?:/u, (route) => route.abort());
  try {
    // The only instrumentation: the body runs as written inside one async function (a preset may
    // `return` early), and a flag says it finished.
    const html = await buildStudioPreviewHtml({
      code: `await (async () => {\n${preset.code}\n})();\nwindow.__presetDone = true;`,
      trust: options.trust ?? 'unreviewed',
      reducedMotion: options.reducedMotion,
      dir: options.dir,
      lang: options.dir === 'rtl' ? 'ar' : 'en',
      params: options.params,
      themeCss: QA_STYLE,
    });
    await page.setContent(HOST);
    await page.locator('iframe').evaluate((element, srcdoc) => {
      (element as HTMLIFrameElement).srcdoc = srcdoc;
    }, html);
    const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
    if (frame === undefined) throw new Error('Preview frame missing');
    const deadline = Date.now() + 20_000;
    let done = false;
    while (Date.now() < deadline) {
      done = await frame.evaluate<boolean>('window.__presetDone === true').catch(() => false);
      if (done || errorsIn(await messages(page)).length > 0) break;
      await page.waitForTimeout(100);
    }
    if (!done && errorsIn(await messages(page)).length === 0)
      errors.push('the body never finished');
    const thumbnail = done && options.thumbnail ? await capture(page) : null;
    // Keep it running for a moment: a tick that throws, or a shader built late, shows up here.
    await page
      .waitForFunction(
        "window.__ck.some(function(m){return m.type==='ck-preview:fps'&&m.fps>0})",
        undefined,
        { timeout: 5_000 },
      )
      .catch(() => undefined);
    const list = await messages(page);
    return {
      errors: [...errors, ...errorsIn(list)],
      ready: list.some((message) => message.type === 'ck-preview:ready'),
      fps: Math.max(0, ...list.map((message) => message.fps ?? 0)),
      thumbnail,
    };
  } finally {
    await context.close();
  }
}

/** A 96×64 gradient PNG made in the browser: an offline picture for the photo presets. */
async function testPicture(browser: Browser): Promise<string> {
  const page = await browser.newPage();
  try {
    return await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('no 2d context');
      const gradient = context.createLinearGradient(0, 0, 96, 64);
      gradient.addColorStop(0, '#f59e0b');
      gradient.addColorStop(1, '#0ea5e9');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 96, 64);
      context.fillStyle = '#ffffff';
      context.fillRect(30, 20, 36, 24);
      return canvas.toDataURL('image/png');
    });
  } finally {
    await page.close();
  }
}

describe.skipIf(!QA)('builtin scene presets in the Studio preview runtime', () => {
  let browser: Browser;
  let picture = '';

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    picture = await testPicture(browser);
  }, 60_000);

  afterAll(async () => {
    await browser.close();
  });

  it('covers the whole catalogue', () => {
    expect(SCENE_PRESETS.length).toBeGreaterThanOrEqual(30);
  });

  it.each(SCENE_PRESETS.map((preset): [string, PresetUnderTest] => [preset.id, preset]))(
    '%s runs, throws nothing and draws (LTR and RTL desktop, reduced motion on mobile)',
    async (_id, preset) => {
      const ltr = await run(browser, preset, {
        width: 1280,
        dir: 'ltr',
        reducedMotion: false,
        thumbnail: true,
      });
      expect(ltr.errors).toEqual([]);
      expect(ltr.ready).toBe(true);
      expect(ltr.fps).toBeGreaterThan(0);
      expect(ltr.thumbnail).not.toBeNull();
      expect(drawsSomething(ltr.thumbnail), JSON.stringify(ltr.thumbnail)).toBe(true);

      const rtl = await run(browser, preset, {
        width: 1280,
        dir: 'rtl',
        reducedMotion: false,
        thumbnail: true,
      });
      expect(rtl.errors).toEqual([]);
      expect(drawsSomething(rtl.thumbnail), JSON.stringify(rtl.thumbnail)).toBe(true);

      // A phone, still frame: the narrow layouts and the reduced-motion branches run clean.
      const still = await run(browser, preset, {
        width: 390,
        dir: 'ltr',
        reducedMotion: true,
        thumbnail: false,
      });
      expect(still.errors).toEqual([]);
      expect(still.ready).toBe(true);

      // A photo preset also draws a real picture (its default photo is remote; this one is not).
      const image = preset.params.find((spec) => spec.type === 'image');
      if (image !== undefined) {
        const photo = await run(browser, preset, {
          width: 1280,
          dir: 'ltr',
          reducedMotion: false,
          trust: 'trusted',
          params: { [image.key]: picture },
          thumbnail: true,
        });
        expect(photo.errors).toEqual([]);
        expect(drawsSomething(photo.thumbnail), JSON.stringify(photo.thumbnail)).toBe(true);
      }
    },
    120_000,
  );
});
