import { chromium, type Frame, type Page } from 'playwright';
import { expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';
import {
  CREATIVE_ANIMATION_CONTROLS,
  CREATIVE_ANIMATION_EXAMPLE,
  CREATIVE_DIALOGUE_EXAMPLE,
  CREATIVE_EFFECTS_CONTROLS,
  CREATIVE_EFFECTS_EXAMPLE,
  CREATIVE_INK_EXAMPLE,
  CREATIVE_TILEMAP_CONTROLS,
  CREATIVE_TILEMAP_EXAMPLE,
} from '@craftkit/builder/wire';

/*
  creative agent (2026-10-12): the creative engine playbooks' EXACT examples, run in the
  generated, sandboxed Studio preview runtime (real Pixi v8 + WebGL, the lazily loaded
  ck-lib-anim/fx/dialogue/ink/tilemap assets, CSP without network). Only the host seam is
  instrumented to expose the scene; the taught bodies are unchanged.
*/

const QA_STYLE = `html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui} .qa-controls{position:absolute;z-index:3;inset-inline:12px;top:12px;background:#172033e8;color:#f1f5f9;padding:12px;border-radius:12px} button{background:#f1f5f9;color:#172033;border:1px solid #94a3b8;border-radius:6px;padding:8px;margin:3px;touch-action:none}`;

async function mount(
  page: Page,
  code: string,
  controls: string,
  options: { reducedMotion?: boolean; dir?: 'ltr' | 'rtl' } = {},
): Promise<Frame> {
  const setup = `ck.root.innerHTML=${JSON.stringify(controls === '' ? '' : `<div class='qa-controls'>${controls}</div>`)};
const originalScene=ck.scene.bind(ck);ck.scene=async options=>{const s=await originalScene(options);window.__creativeScene=s;window.__creativeStage=s.stage;return s};`;
  const html = await buildStudioPreviewHtml({
    code: `${setup}\n${code}\nwindow.__creativeReady=true;`,
    trust: 'unreviewed',
    reducedMotion: options.reducedMotion ?? false,
    dir: options.dir ?? 'ltr',
    themeCss: QA_STYLE,
  });
  await page.setContent(
    '<!doctype html><html><body style="margin:0"><iframe title="Creative engines QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
  );
  await page.locator('iframe').evaluate((element, srcdoc) => {
    (element as HTMLIFrameElement).srcdoc = srcdoc;
  }, html);
  const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
  if (frame === undefined) throw new Error('Preview frame missing');
  await frame.waitForFunction(
    'window.__creativeReady === true || document.getElementById("ck-preview")?.hasAttribute("data-ck-js-error")',
  );
  expect(
    await frame.evaluate<string | null>(
      "document.getElementById('ck-preview').getAttribute('data-ck-js-error')",
    ),
  ).toBeNull();
  await frame.locator('canvas').waitFor();
  return frame;
}

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'runs the taught animation, effects, dialogue, Ink and tile-world examples in the generated runtime',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      for (const dir of ['ltr', 'rtl'] as const)
        for (const width of [390, 1280]) {
          const context = await browser.newContext({ viewport: { width, height: 720 } });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.route(/^https?:/u, (route) => route.abort());
          try {
            // anim: a procedural rig changes pose on the button; root position stays laid out.
            const anim = await mount(
              page,
              CREATIVE_ANIMATION_EXAMPLE,
              CREATIVE_ANIMATION_CONTROLS,
              { dir },
            );
            expect(await anim.getByRole('status').textContent()).toBe('idle');
            await anim.getByRole('button', { name: 'Next pose' }).click();
            expect(await anim.getByRole('status').textContent()).toBe('walk');
            await anim.waitForFunction(
              'Math.abs(window.__creativeScene.stage.children[0].children[0].rotation) > 0.05',
            );
            const heroX = await anim.evaluate<number>('window.__creativeScene.stage.children[0].x');
            expect(heroX).toBeCloseTo(width / 2, 0);

            // fx: weather fills the layer at once; a spell adds a burst, a ring and floating text.
            const fx = await mount(page, CREATIVE_EFFECTS_EXAMPLE, CREATIVE_EFFECTS_CONTROLS, {
              dir,
            });
            const particles =
              'window.__creativeScene.stage.children[1].children[0].children.length';
            await fx.waitForFunction(`${particles} > 0`);
            const before = await fx.evaluate<number>(particles);
            await fx.getByRole('button', { name: 'Cast a spell' }).click();
            expect(await fx.evaluate<number>(particles)).toBeGreaterThan(before);
            expect(
              await fx.evaluate<number>(
                'window.__creativeScene.stage.children[1].children[1].children.length',
              ),
            ).toBeGreaterThanOrEqual(2);

            // dialogue: an accessible box, numbered choices, variables and an ending. A press while
            // a line is still typing completes it first, so each press waits for the full line.
            const talk = await mount(page, CREATIVE_DIALOGUE_EXAMPLE, '', { dir });
            const box = talk.getByRole('region', { name: 'Dialogue' });
            const shown = async (frame: Frame, text: string) => {
              await expect.poll(() => frame.locator('.ckd-text').textContent()).toBe(text);
            };
            await expect.poll(() => box.locator('.ckd-name').textContent()).toBe('Layla');
            expect(await talk.getByRole('status').textContent()).toBe(
              'Layla: The lantern went out.',
            );
            await shown(talk, 'The lantern went out.');
            await box.getByRole('button', { name: 'Continue' }).click();
            await shown(talk, 'Then we follow the fireflies.');
            await box.getByRole('button', { name: 'Continue' }).click();
            await shown(talk, 'Cross the river tonight?');
            await box.getByRole('button', { name: /Cross now/u }).click();
            await expect
              .poll(() => talk.getByRole('status').textContent())
              .toBe('Omar: Brave choice. Courage 1.');
            await expect
              .poll(() => box.getByRole('button', { name: 'Play again' }).isVisible())
              .toBe(true);
            expect(
              await talk.evaluate<boolean>('document.documentElement.scrollWidth > innerWidth'),
            ).toBe(false);

            // ink: the compiled Ink story plays through the same box, with variables.
            const ink = await mount(page, CREATIVE_INK_EXAMPLE, '', { dir });
            const inkBox = ink.getByRole('region', { name: 'Dialogue' });
            await expect.poll(() => inkBox.locator('.ckd-name').textContent()).toBe('The Guide');
            await shown(ink, 'Welcome, traveller.');
            await inkBox.getByRole('button', { name: /Count the stars/u }).click();
            await expect
              .poll(() => ink.getByRole('status').textContent())
              .toBe('The Guide: Three stars answer you.');
            await shown(ink, 'Three stars answer you.');
            await inkBox.getByRole('button', { name: 'Continue' }).click();
            await expect
              .poll(() => ink.getByRole('status').textContent())
              .toBe('You carry 3 stars home.');

            // tilemap: the pipe joins the already-running renderer; the hero runs on the level.
            const level = await mount(page, CREATIVE_TILEMAP_EXAMPLE, CREATIVE_TILEMAP_CONTROLS, {
              dir,
            });
            expect(
              await level.evaluate<boolean>(
                'window.__creativeScene.app.renderer.renderPipes.tilemap !== undefined',
              ),
            ).toBe(true);
            expect(await level.getByRole('status').textContent()).toContain('ready · 0/3');
            await level.getByRole('button', { name: 'Start', exact: true }).click();
            expect(await level.getByRole('status').textContent()).toContain('running');
            const heroOf = 'window.__creativeScene.stage.children[0].children.at(-1).x';
            const start = await level.evaluate<number>(heroOf);
            await level.locator('canvas').focus();
            await page.keyboard.down('ArrowRight');
            await level.waitForFunction(`${heroOf} > ${String(start + 24)}`);
            await page.keyboard.up('ArrowRight');
            const shot = await level.locator('canvas').screenshot();
            expect(shot.byteLength).toBeGreaterThan(2_000);
            await level.locator('#ck-preview').evaluate((root) => {
              root.remove();
            });
            await level.waitForFunction('window.__creativeStage.destroyed === true');
            expect(errors).toEqual([]);
          } finally {
            await context.close();
          }
        }
    } finally {
      await browser.close();
    }
  },
  180_000,
);

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'keeps the engines calm and complete under reduced motion',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
      await page.route(/^https?:/u, (route) => route.abort());
      const fx = await mount(page, CREATIVE_EFFECTS_EXAMPLE, CREATIVE_EFFECTS_CONTROLS, {
        reducedMotion: true,
      });
      await fx.getByRole('button', { name: 'Cast a spell' }).click();
      expect(
        await fx.evaluate<number>(
          'window.__creativeScene.stage.children[1].children[0].children.length',
        ),
      ).toBe(0);
      expect(await fx.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(false);
      const talk = await mount(page, CREATIVE_DIALOGUE_EXAMPLE, '', { reducedMotion: true });
      // No typewriter under reduced motion: the whole line is visible at once.
      expect(await talk.locator('.ckd-text').textContent()).toBe('The lantern went out.');
    } finally {
      await browser.close();
    }
  },
  60_000,
);
