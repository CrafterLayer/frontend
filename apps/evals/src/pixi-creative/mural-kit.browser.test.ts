import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';

import { MURAL_FIXTURES, type MuralFixture } from './mural-kit-fixtures';

/*
  mural kit (2026-10-14): every bespoke fixture — composed only with s.lib.mural — in the
  generated, sandboxed Studio preview runtime (real Pixi v8 + WebGL, the built ck-lib-mural.js and
  ck-lib-anim.js assets, the unreviewed CSP with connect-src 'none'). Each one draws without a
  spec warning, animates, mirrors on an RTL phone, holds one still frame under reduced motion
  (the strongest beat), and leaves nothing after the region goes. With MURAL_KIT_SHOTS=<dir> it
  also saves desktop and phone screenshots at three timeline points, for art review.
*/

const QA = process.env['CRAFTKIT_BROWSER_QA'] === '1';
const SHOTS = process.env['MURAL_KIT_SHOTS'];
// MURAL_KIT_ONLY=id,id renders a few fixtures while iterating on the art.
const ONLY = process.env['MURAL_KIT_ONLY']?.split(',');
const FIXTURES = MURAL_FIXTURES.filter((fixture) => ONLY?.includes(fixture.id) ?? true);
const QA_STYLE =
  'html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui}';

const SETUP = `ck.scene=(o=>async x=>{const s=await o(x);window.__creativeScene=s;window.__creativeStage=s.stage;window.__sharedTickers=s.PIXI.Ticker.shared.count;
if(s.lib.mural){const M=s.lib.mural;s.lib.mural={...M,compose:(a,b)=>{const m=M.compose(a,b);window.__mural=m;return m}}}return s})(ck.scene.bind(ck));
window.__read=()=>{const s=window.__creativeScene;s.app.render();return s.app.renderer.extract.pixels({target:s.stage,frame:new s.PIXI.Rectangle(0,0,s.width,s.height)}).pixels};
window.__sig=()=>{const p=window.__read();let h=0;for(let i=0;i<p.length;i+=16)h=(Math.imul(h,31)+p[i]+p[i+1]*3+p[i+2]*7)|0;return h};
window.__ink=()=>{const p=window.__read();const seen=new Set();for(let i=0;i<p.length;i+=16)seen.add((p[i]>>4)<<8|(p[i+1]>>4)<<4|p[i+2]>>4);return seen.size};`;

async function mount(
  page: Page,
  code: string,
  options: { dir?: 'ltr' | 'rtl'; reducedMotion?: boolean } = {},
): Promise<{ frame: Frame; html: string }> {
  const html = await buildStudioPreviewHtml({
    code: `${SETUP}\n${code}\nwindow.__creativeReady=true;`,
    trust: 'unreviewed',
    reducedMotion: options.reducedMotion ?? false,
    dir: options.dir ?? 'ltr',
    lang: options.dir === 'rtl' ? 'ar' : 'en',
    themeCss: QA_STYLE,
  });
  await page.setContent(
    '<!doctype html><html><body style="margin:0"><iframe title="Mural kit QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
  );
  await page.locator('iframe').evaluate((element, srcdoc) => {
    (element as HTMLIFrameElement).srcdoc = srcdoc;
  }, html);
  const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
  if (frame === undefined) throw new Error('Preview frame missing');
  await frame.waitForFunction(
    'window.__creativeReady === true || document.getElementById("ck-preview")?.hasAttribute("data-ck-js-error")',
    undefined,
    { timeout: 20_000 },
  );
  expect(
    await frame.evaluate<string | null>(
      "document.getElementById('ck-preview').getAttribute('data-ck-js-error')",
    ),
  ).toBeNull();
  await frame.locator('canvas').waitFor();
  return { frame, html };
}

async function removeRegion(frame: Frame): Promise<void> {
  await frame.locator('#ck-preview').evaluate((root) => {
    root.remove();
  });
  await frame.waitForFunction('window.__creativeStage.destroyed === true');
}

async function withPage(
  browser: Browser,
  size: { width: number; height: number },
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route(/^https?:/u, (route) => route.abort());
  try {
    await run(page);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
}

const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 780 };

async function shoot(
  page: Page,
  frame: Frame,
  fixture: MuralFixture,
  label: string,
): Promise<void> {
  if (SHOTS === undefined) return;
  mkdirSync(SHOTS, { recursive: true });
  const still = await frame.evaluate<number>('window.__mural.still');
  for (const [name, progress] of [
    ['start', 0.12],
    ['still', still],
    ['late', 0.88],
  ] as const) {
    await frame.evaluate(`window.__mural.seek(${String(progress)})`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(SHOTS, `${fixture.id}-${label}-${name}.png`) });
  }
}

describe.skipIf(!QA)('mural kit fixtures in the Studio preview runtime', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser.close();
  });

  it('keeps every fixture a short composition', () => {
    expect(MURAL_FIXTURES.length).toBeGreaterThanOrEqual(8);
    for (const fixture of MURAL_FIXTURES) {
      expect(fixture.code.length, fixture.id).toBeLessThanOrEqual(3_000);
      expect(fixture.code, fixture.id).toContain('s.lib.mural.compose(s,');
    }
  });

  it('loads s.lib.anim with s.lib.mural when a scene lists only mural', async () => {
    await withPage(browser, DESKTOP, async (page) => {
      const { frame, html } = await mount(
        page,
        "const s=await ck.scene({libs:['mural'],design:{width:1280,height:720,fit:'cover'}});s.lib.mural.compose(s,{layers:{near:['hills',{item:'person',id:'p',x:300}]},beats:[{dur:2},{walk:{p:900},dur:3},{dur:2}]});",
      );
      expect(html).toContain('data-ck-engine="lib-anim"');
      expect(await frame.evaluate<string[]>('window.__mural.warnings')).toEqual([]);
      await page.waitForTimeout(600);
      expect(await frame.evaluate<number>('window.__mural.timeline.time()')).toBeGreaterThan(0.2);
      await removeRegion(frame);
    });
  }, 60_000);

  it.each(FIXTURES.map((fixture): [string, MuralFixture] => [fixture.id, fixture]))(
    '%s draws, animates, mirrors on an RTL phone, holds its still beat and disposes',
    async (_id, fixture) => {
      // LTR desktop: it loads mural with anim, draws with no spec warning, and moves.
      await withPage(browser, DESKTOP, async (page) => {
        const { frame, html } = await mount(page, fixture.code);
        expect(html).toContain('data-ck-engine="lib-mural"');
        expect(html).toContain('data-ck-engine="lib-anim"');
        expect(await frame.evaluate<string[]>('window.__mural.warnings')).toEqual([]);
        await page.waitForTimeout(500);
        expect(await frame.evaluate<number>('window.__ink()')).toBeGreaterThan(12);
        const before = await frame.evaluate<number>('window.__sig()');
        await page.waitForTimeout(1200);
        expect(await frame.evaluate<number>('window.__sig()')).not.toBe(before);
        await shoot(page, frame, fixture, 'desktop');
        await removeRegion(frame);
        expect(await frame.evaluate<boolean>('window.__mural.disposed')).toBe(true);
        expect(
          await frame.evaluate<boolean>(
            'window.__creativeScene.PIXI.Ticker.shared.count === window.__sharedTickers',
          ),
        ).toBe(true);
      });
      // RTL phone: the mirrored mural runs clean.
      await withPage(browser, PHONE, async (page) => {
        const { frame } = await mount(page, fixture.code, { dir: 'rtl' });
        expect(await frame.evaluate<number>('window.__creativeScene.dir')).toBe(-1);
        expect(await frame.evaluate<number>('window.__mural.root.scale.x')).toBeLessThan(0);
        await page.waitForTimeout(400);
        expect(await frame.evaluate<number>('window.__ink()')).toBeGreaterThan(12);
        await shoot(page, frame, fixture, 'phone-rtl');
        await removeRegion(frame);
      });
      // Reduced motion: the strongest beat, still; the same seed paints the same pixels.
      const stills: number[] = [];
      for (let run = 0; run < 2; run += 1) {
        await withPage(browser, PHONE, async (page) => {
          const { frame } = await mount(page, fixture.code, { reducedMotion: true });
          await page.waitForTimeout(600);
          expect(await frame.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
            false,
          );
          const still = await frame.evaluate<number>('window.__sig()');
          await page.waitForTimeout(500);
          expect(await frame.evaluate<number>('window.__sig()')).toBe(still);
          stills.push(still);
          await removeRegion(frame);
        });
      }
      expect(stills[1]).toBe(stills[0]);
    },
    180_000,
  );
});
