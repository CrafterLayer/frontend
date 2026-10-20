import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';

import { kitMarkup } from './kit-section';
import { initializedScene } from './scene-init.browser.fixture';

const QA = process.env['CRAFTKIT_BROWSER_QA'] === '1';
const CASES = (['arcade', 'picture-book'] as const).flatMap((preset) =>
  (['ltr', 'rtl'] as const).map((dir) => ({ preset, dir })),
);

/** Exercise the build adapter's actual output, including its contract copy and retained controls. */
describe.skipIf(!QA)('build-completed scene kits in the sandboxed preview', () => {
  let browser: Browser | undefined;
  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      ...(process.env['CRAFTKIT_BROWSER_CHANNEL'] === 'chrome' ? { channel: 'chrome' } : {}),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
  }, 30_000);
  afterAll(async () => {
    await browser?.close();
  });

  it.each(CASES)(
    '$preset $dir keeps its heading, visible canvas and working controls',
    async ({ preset, dir }) => {
      if (browser === undefined) throw new Error('Browser setup did not complete.');
      const context = await browser.newContext({
        viewport: { width: dir === 'rtl' ? 390 : 1280, height: 900 },
      });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route(/^https?:/u, (route) => route.abort());
        const fixture = initializedScene(dir, preset);
        const code = `${fixture.kit.code}\nwindow.__completedKitReady=true;`;
        const html = await buildStudioPreviewHtml({
          code,
          markup: `<div data-ck="scene-page">${kitMarkup(fixture.kit, dir, code)}<div id="details"></div></div>`,
          themeCss: fixture.css,
          dir,
          lang: dir === 'rtl' ? 'ar' : 'en',
          reducedMotion: true,
          trust: 'unreviewed',
        });
        await page.setContent(
          '<!doctype html><html><body style="margin:0"><script>window.__previewErrors=[];addEventListener("message",function(e){if(e.data?.type==="ck-preview:error")window.__previewErrors.push(e.data.message);});</script><iframe title="Completed kit" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
        );
        await page.locator('iframe').evaluate((element, srcdoc) => {
          (element as HTMLIFrameElement).srcdoc = srcdoc;
        }, html);
        const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
        if (frame === undefined) throw new Error('Completed kit frame is missing.');
        await frame.waitForFunction('window.__completedKitReady===true');
        await frame.locator('canvas').waitFor({ state: 'visible' });
        expect(await frame.getByRole('heading', { name: fixture.title, level: 1 }).count()).toBe(1);
        for (const text of fixture.copy)
          expect(await frame.getByText(text, { exact: true }).isVisible()).toBe(true);
        expect(await frame.getByRole('link', { name: fixture.action }).getAttribute('href')).toBe(
          fixture.href,
        );
        const bounds = await frame.locator('canvas').boundingBox();
        expect(bounds?.width).toBeGreaterThan(250);
        expect(bounds?.height).toBeGreaterThan(150);
        if (preset === 'arcade') {
          const status = frame.locator('[data-game-status]');
          expect(await status.textContent()).toBe(
            dir === 'rtl' ? 'اضغط «ابدأ» لتلعب.' : 'Press Start to play.',
          );
          await frame.locator('[data-game-action="start"]').click();
          await expect
            .poll(() => status.textContent())
            .toBe(dir === 'rtl' ? 'بدأت اللعبة!' : 'Game on!');
          expect(await frame.locator('[data-game-action="pause"]').isDisabled()).toBe(false);
          await frame.locator('[data-game-action="pause"]').click();
          expect(await status.textContent()).not.toBe(dir === 'rtl' ? 'بدأت اللعبة!' : 'Game on!');
        } else {
          const status = frame.locator('[data-story-status]');
          const first = dir === 'rtl' ? 'الصفحة 1 من 5' : 'Page 1 of 5';
          expect(await status.textContent()).toBe(first);
          await frame.locator('[data-story-action="next"]').click();
          await expect
            .poll(() => status.textContent())
            .toBe(dir === 'rtl' ? 'الصفحة 2 من 5' : 'Page 2 of 5');
          await frame.locator('[data-story-action="reset"]').click();
          await expect.poll(() => status.textContent()).toBe(first);
        }
        expect(errors).toEqual([]);
        expect(await page.evaluate('window.__previewErrors')).toEqual([]);
      } finally {
        await context.close();
      }
    },
    90_000,
  );
});
