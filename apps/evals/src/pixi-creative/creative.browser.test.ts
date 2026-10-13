import { chromium, type Frame, type Page } from 'playwright';
import { expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';
import {
  PIXI_GAME_CONTROLS,
  PIXI_GAME_EXAMPLE,
  PIXI_STORY_CONTROLS,
  PIXI_STORY_EXAMPLE,
  PIXI_MURAL_EXAMPLE,
} from '@craftkit/builder/wire';

const QA_STYLE = `html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui} .qa-controls{position:absolute;z-index:1;inset-inline:12px;top:12px;background:#172033e8;color:#f1f5f9;padding:12px;border-radius:12px} p,h2{margin-block:0 8px}button{background:#f1f5f9;color:#172033;border:1px solid #94a3b8;border-radius:6px;padding:8px;margin:3px;touch-action:none}button:focus-visible,canvas:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}output{display:block;margin-top:8px}`;

async function mount(
  page: Page,
  code: string,
  controls: string,
  reducedMotion: boolean,
  dir: 'ltr' | 'rtl',
): Promise<Frame> {
  // Only the host seam is instrumented; the taught example body is unchanged.
  const setup = `ck.root.innerHTML=${JSON.stringify(`<div class='qa-controls'>${controls}</div>`)};
const originalScene=ck.scene.bind(ck);ck.scene=async options=>{const s=await originalScene(options);window.__creativeScene=s;window.__creativeStage=s.stage;return s};`;
  const html = await buildStudioPreviewHtml({
    code: `${setup}\n${code}\nwindow.__creativeReady=true;`,
    trust: 'unreviewed',
    reducedMotion,
    dir,
    themeCss: QA_STYLE,
  });
  await page.setContent(
    '<!doctype html><html><body style="margin:0"><iframe title="Creative runtime QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
  );
  await page.locator('iframe').evaluate((element, srcdoc) => {
    (element as HTMLIFrameElement).srcdoc = srcdoc;
  }, html);
  const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
  if (frame === undefined) throw new Error('Preview frame missing');
  await frame.waitForFunction('window.__creativeReady === true');
  await frame.locator('canvas').waitFor();
  expect(
    await frame.evaluate<string | null>(
      "document.getElementById('ck-preview').getAttribute('data-ck-js-error')",
    ),
  ).toBeNull();
  return frame;
}

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'runs the exact taught game, story and mural in the generated sandboxed Pixi runtime',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      for (const dir of ['ltr', 'rtl'] as const)
        for (const width of [390, 1280]) {
          const context = await browser.newContext({ viewport: { width, height: 700 } });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          // The unreviewed scene CSP already denies networking; refuse it at the test boundary too.
          await page.route(/^https?:/u, (route) => route.abort());
          try {
            const game = await mount(page, PIXI_GAME_EXAMPLE, PIXI_GAME_CONTROLS, false, dir);
            expect(await game.getByRole('status').textContent()).toContain('ready');
            await game.getByRole('button', { name: 'Start', exact: true }).click();
            expect(await game.getByRole('status').textContent()).toContain('running');
            // The taught game draws in design mode: the hero is the world's fourth child.
            const readX = () => game.evaluate<number>('window.__creativeScene.world.children[3].x');
            const before = await readX();
            await game.locator('canvas').focus();
            await page.keyboard.down('ArrowRight');
            await game.waitForFunction(
              `window.__creativeScene.world.children[3].x > ${String(before + 8)}`,
            );
            await page.keyboard.up('ArrowRight');
            await game.getByRole('button', { name: 'Pause / resume', exact: true }).click();
            const paused = await readX();
            await page.waitForTimeout(100);
            expect(await readX()).toBeCloseTo(paused, 3);
            await game.getByRole('button', { name: 'Restart', exact: true }).click();
            expect(await game.getByRole('status').textContent()).toContain('0/3');
            await game.getByRole('button', { name: 'Pause / resume', exact: true }).click();
            await page.setViewportSize({ width: width === 390 ? 420 : 1100, height: 700 });
            await game.waitForFunction(
              `Math.abs(window.__creativeScene.width - ${String(width === 390 ? 420 : 1100)}) < 2`,
            );
            expect(
              await game.evaluate<boolean>('document.documentElement.scrollWidth > innerWidth'),
            ).toBe(false);
            // Mutating/removing a region uses the real runtime reconciler, not an ad-hoc disposer.
            await game.locator('#ck-preview').evaluate((root) => {
              root.remove();
            });
            await game.waitForFunction('window.__creativeStage.destroyed === true');
            expect(
              await game.evaluate<boolean>("window.__creativeScene.input.down('ArrowRight')"),
            ).toBe(false);

            await page.setViewportSize({ width, height: 700 });
            const story = await mount(page, PIXI_STORY_EXAMPLE, PIXI_STORY_CONTROLS, true, dir);
            expect(await story.getByRole('heading').textContent()).toBe('Dawn');
            expect(await story.getByRole('button', { name: 'Previous' }).isDisabled()).toBe(true);
            // Wait beyond still-frame retries: later chapter navigation must render independently.
            await page.waitForTimeout(800);
            const first = await story.locator('canvas').screenshot();
            await story.getByRole('button', { name: 'Next', exact: true }).click();
            expect(await story.getByRole('heading').textContent()).toBe('Crossing');
            expect(await story.locator('canvas').screenshot()).not.toEqual(first);
            await story.getByRole('button', { name: 'Next', exact: true }).click();
            expect(await story.getByRole('heading').textContent()).toBe('Home');
            expect(
              await story.getByRole('button', { name: 'Next', exact: true }).isDisabled(),
            ).toBe(true);
            await story.getByRole('button', { name: 'Restart story' }).click();
            expect(await story.getByRole('heading').textContent()).toBe('Dawn');
            expect(await story.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
              false,
            );

            const mural = await mount(page, PIXI_MURAL_EXAMPLE, '', true, dir);
            const details = await mural.evaluate<number>(
              'window.__creativeScene.stage.children[2].children.length',
            );
            expect(details).toBeGreaterThan(20);
            expect(details).toBeLessThanOrEqual(80);
            expect(await mural.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
              false,
            );
            const frame = await mural.locator('canvas').screenshot();
            expect(frame.byteLength).toBeGreaterThan(2_000);
            expect(errors).toEqual([]);
          } finally {
            await context.close();
          }
        }
    } finally {
      await browser.close();
    }
  },
  90_000,
);
