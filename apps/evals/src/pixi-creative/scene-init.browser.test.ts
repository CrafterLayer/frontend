import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';

import { kitMarkup } from './kit-section';
import { initializedScene } from './scene-init.browser.fixture';

/* Real generated Studio/Pixi assets, an opaque iframe, and no network or provider calls. */
const QA = process.env['CRAFTKIT_BROWSER_QA'] === '1';
const HOST = `<!doctype html><html><body style="margin:0"><script>window.__ck=[];addEventListener('message',function(e){var d=e.data;if(d&&typeof d.type==='string'&&d.type.indexOf('ck-preview:')===0)window.__ck.push(d);});</script><iframe title="Initialized mural QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>`;
const CASES = [390, 1280].flatMap((width) =>
  (['ltr', 'rtl'] as const).flatMap((dir) =>
    [false, true].map((reducedMotion) => ({ width, dir, reducedMotion })),
  ),
);

interface PreviewMessage {
  readonly type: string;
  readonly message?: string;
}

async function messages(page: Page): Promise<PreviewMessage[]> {
  return page.evaluate<PreviewMessage[]>('window.__ck');
}

/** Compositor pixels retain reduced-motion WebGL stills. Exclude all copy-card pixels. */
async function canvasInk(frame: Frame, measured: Awaited<ReturnType<typeof layout>>) {
  const shot = PNG.sync.read(await frame.locator('[data-ck="kit"] canvas').screenshot());
  const counts = new Map<number, number>();
  let sampled = 0;
  for (let y = 0; y < shot.height; y += 2) {
    for (let x = 0; x < shot.width; x += 2) {
      const pageX = measured.canvas.left + (x * measured.canvas.width) / shot.width;
      const pageY = measured.canvas.top + (y * measured.canvas.height) / shot.height;
      if (
        pageX >= measured.copy.left - 2 &&
        pageX <= measured.copy.right + 2 &&
        pageY >= measured.copy.top - 2 &&
        pageY <= measured.copy.bottom + 2
      )
        continue;
      const index = (y * shot.width + x) * 4;
      const colour =
        (((shot.data[index] ?? 0) >> 4) << 8) |
        (((shot.data[index + 1] ?? 0) >> 4) << 4) |
        ((shot.data[index + 2] ?? 0) >> 4);
      counts.set(colour, (counts.get(colour) ?? 0) + 1);
      sampled += 1;
    }
  }
  if (sampled === 0) throw new Error('Copy covers the whole scene.');
  return { ink: 1 - Math.max(...counts.values()) / sampled, colours: counts.size };
}

async function layout(frame: Frame, surface: string) {
  return frame.evaluate((expectedSurface: string) => {
    const root = document.querySelector('[data-ck="kit"]');
    const section = document.querySelector('.ck-scene-init');
    const copy = document.querySelector('.ck-scene-copy');
    const canvas = root?.querySelector('canvas');
    const action = copy?.querySelector('a');
    if (
      root === null ||
      section === null ||
      copy === null ||
      canvas === undefined ||
      canvas === null ||
      action === undefined ||
      action === null
    ) {
      throw new Error('Initialized scene elements are missing.');
    }
    const bounds = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const actionRect = action.getBoundingClientRect();
    const hit = document.elementFromPoint(
      actionRect.left + actionRect.width / 2,
      actionRect.top + actionRect.height / 2,
    );
    // Browser color serialization may be RGB or OKLCH. Compare the actual sRGB pixels instead.
    const swatch = document.createElement('canvas');
    swatch.width = 1;
    swatch.height = 1;
    const context = swatch.getContext('2d');
    if (context === null) throw new Error('No color normalization context.');
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'transparent';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    return {
      root: bounds(root),
      section: bounds(section),
      copy: bounds(copy),
      canvas: bounds(canvas),
      descendants: [...copy.querySelectorAll('h1,p,a')].map(bounds),
      background: rgba(getComputedStyle(copy).backgroundColor),
      surface: rgba(expectedSurface),
      opacity: Number(getComputedStyle(copy).opacity),
      copyLayer: getComputedStyle(copy).zIndex,
      canvasLayer: getComputedStyle(canvas).zIndex,
      actionExposed: hit === action || (hit !== null && action.contains(hit)),
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      dir: document.documentElement.dir,
    };
  }, surface);
}

it('prepares validated, fully initialized offline fixtures in both page directions', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    const fixture = initializedScene(dir);
    expect(fixture.kit.code).toContain('await ck.scene');
    expect(fixture.kit.code).not.toContain('@preset:');
    expect(fixture.css).toContain('[data-ck="scene-page"] > *');
    expect(fixture.css).not.toContain('@import');
    expect(fixture.kit.region?.tree[dir === 'rtl' ? 'ar' : 'en'].children.length).toBe(1);
  }
});

describe.skipIf(!QA)('compact ready mural initialization in the real Studio runtime', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.each(CASES)(
    '$width px $dir reduced motion=$reducedMotion is drawn, readable and keyboard usable',
    async ({ width, dir, reducedMotion }) => {
      if (browser === undefined) throw new Error('QA browser is unavailable.');
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text().slice(0, 300));
      });
      await page.route(/^https?:/u, (route) => route.abort());
      try {
        const fixture = initializedScene(dir);
        // The scene object is read back (window.__scene) to check the mural's fit.
        const code = `const ckScene=ck.scene.bind(ck);ck.scene=async(o)=>{const s=await ckScene(o);window.__scene=s;return s;};\nawait (async () => {\n${fixture.kit.code}\n})();\nwindow.__sceneInitDone=true;ck.root.querySelector('a').addEventListener('click',()=>{window.parent.postMessage({type:'ck-preview:scene-init-action'},'*');});`;
        const markup = `<div data-ck="scene-page">${kitMarkup(fixture.kit, dir, code)}<div id="details"></div></div>`;
        const html = await buildStudioPreviewHtml({
          code,
          markup,
          themeCss: fixture.css,
          dir,
          lang: dir === 'rtl' ? 'ar' : 'en',
          reducedMotion,
          trust: 'unreviewed',
        });
        await page.setContent(HOST);
        await page.locator('iframe').evaluate((element, srcdoc) => {
          (element as HTMLIFrameElement).srcdoc = srcdoc;
        }, html);
        const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
        if (frame === undefined) throw new Error('Preview frame is missing.');
        await frame.waitForFunction('window.__sceneInitDone===true', undefined, {
          timeout: 20_000,
        });
        await expect
          .poll(() =>
            messages(page).then((list) => list.some(({ type }) => type === 'ck-preview:ready')),
          )
          .toBe(true);
        await expect
          .poll(() =>
            layout(frame, fixture.surface).then(({ canvas, root }) =>
              Math.abs(canvas.width - root.width),
            ),
          )
          .toBeLessThan(2);
        const heading = frame.getByRole('heading', { level: 1, name: fixture.title, exact: true });
        expect(await heading.count()).toBe(1);
        for (const text of fixture.copy)
          expect(await frame.getByText(text, { exact: true }).count()).toBe(1);
        const action = frame.getByRole('link', { name: fixture.action, exact: true });
        expect(await action.getAttribute('href')).toBe(fixture.href);
        const measured = await layout(frame, fixture.surface);
        expect(measured.dir).toBe(dir);
        expect(measured.background[3]).toBe(255);
        expect(measured.opacity).toBe(1);
        for (const channel of [0, 1, 2]) {
          expect(
            Math.abs((measured.background[channel] ?? 0) - (measured.surface[channel] ?? 0)),
          ).toBeLessThanOrEqual(1);
        }
        expect(Number(measured.copyLayer)).toBeGreaterThan(Number(measured.canvasLayer));
        expect(measured.actionExposed).toBe(true);
        expect(measured.horizontalOverflow).toBeLessThanOrEqual(1);
        expect(measured.root.width).toBeCloseTo(width, 0);
        expect(measured.root.height).toBeCloseTo(measured.section.height, 0);
        expect(measured.canvas.left).toBeCloseTo(measured.root.left, 0);
        expect(measured.canvas.top).toBeCloseTo(measured.root.top, 0);
        expect(measured.canvas.height).toBeCloseTo(measured.root.height, 0);
        expect(measured.root.height).toBeLessThanOrEqual(width === 390 ? 650 : 760);
        // Mural scale (2026-10-14): the mural composes at 1280 × 720 in a viewport camera that
        // covers the region — scale 1 in a 1280 px region, the same picture at 0.72 on a phone —
        // and refits when the region changes width, never re-laying itself out in CSS pixels.
        const fit = () =>
          frame.evaluate(() => {
            const scene = (window as unknown as { __scene?: { design: { scale: number } | null } })
              .__scene;
            const root = document.querySelector('[data-ck="kit"]')!.getBoundingClientRect();
            return {
              scale: scene?.design?.scale ?? 0,
              cover: Math.max(root.width / 1280, root.height / 720),
            };
          });
        const fitted = await fit();
        expect(fitted.scale).toBeCloseTo(fitted.cover, 2);
        expect(fitted.scale).toBeCloseTo(width === 390 ? 520 / 720 : 1, 2);
        expect(
          await frame.evaluate(
            () => getComputedStyle(document.querySelector('[data-ck="kit"] canvas')!).touchAction,
          ),
        ).toBe('pan-x pan-y');
        // A Preview device switch: the camera refits to the new region at once.
        await page.setViewportSize({ width: width === 390 ? 1280 : 390, height: 900 });
        await expect
          .poll(() => fit().then(({ scale }) => scale))
          .toBeCloseTo(width === 390 ? 1 : 520 / 720, 2);
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() => fit().then(({ scale, cover }) => Math.abs(scale - cover)))
          .toBeLessThan(0.01);
        for (const bounds of [measured.copy, ...measured.descendants]) {
          expect(bounds.left).toBeGreaterThanOrEqual(measured.section.left - 1);
          expect(bounds.right).toBeLessThanOrEqual(measured.section.right + 1);
          expect(bounds.top).toBeGreaterThanOrEqual(measured.section.top - 1);
          expect(bounds.bottom).toBeLessThanOrEqual(measured.section.bottom + 1);
        }
        const ink = await canvasInk(frame, measured);
        expect(ink.ink).toBeGreaterThan(0.002);
        expect(ink.colours).toBeGreaterThanOrEqual(3);
        await frame.evaluate(() => {
          document.body.tabIndex = -1;
          document.body.focus();
        });
        await frame.locator('body').press('Tab');
        expect(await action.evaluate((element) => document.activeElement === element)).toBe(true);
        await action.press('Enter');
        await expect
          .poll(() =>
            messages(page).then(
              (list) => list.filter(({ type }) => type === 'ck-preview:scene-init-action').length,
            ),
          )
          .toBe(1);
        expect(await frame.evaluate<string>('location.hash')).toBe(fixture.href);
        await page.waitForTimeout(150);
        errors.push(
          ...(await messages(page))
            .filter(({ type }) => type === 'ck-preview:error')
            .map(({ message }) => message ?? 'Preview error'),
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    45_000,
  );
});
