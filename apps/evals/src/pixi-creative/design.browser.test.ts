import { chromium, type Frame, type Page } from 'playwright';
import { expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';

/*
  responsive scenes (2026-10-13): ck.scene({ design }) in the generated, sandboxed Studio preview
  runtime (real Pixi v8 + WebGL, ck-lib-kit.js and ck-lib-viewport.js). A design world refits as
  the region changes size; design.zoom makes it a pixi-viewport camera that zooms only on ctrl/⌘
  + wheel — a plain wheel still scrolls the page — pans by mouse drag, stays clamped to the
  design, and renders its moves itself under reduced motion. The host seam alone is instrumented.
*/

const QA = process.env['CRAFTKIT_BROWSER_QA'] !== '1';
const THEME = `html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui}
html,body{height:auto;overflow:visible}body{padding-block:0 150vh}#ck-preview{height:400px}`;

/** A 2560 × 1440 checkerboard map behind a camera. */
const MAP = `const s=await ck.scene({libs:['viewport'],design:{width:2560,height:1440,zoom:true}});
const P=s.PIXI,map=new P.Graphics();s.canvas.setAttribute('aria-hidden','true');
for(let i=0;i<16;i++)for(let j=0;j<9;j++)map.rect(i*160,j*160,160,160).fill((i+j)%2?0x334155:0x1e293b);
s.world.addChild(map);`;

/** A plain design world: a 1280 × 720 frame and a sun at its centre. */
const STAGE = `const s=await ck.scene({design:{width:1280,height:720}});
const P=s.PIXI;s.world.addChild(new P.Graphics().rect(0,0,1280,720).fill(0x1e293b).circle(640,360,90).fill(0xfbbf24));`;

async function mount(page: Page, code: string, reducedMotion = false): Promise<Frame> {
  const setup = `const originalScene=ck.scene.bind(ck);ck.scene=async options=>{const s=await originalScene(options);window.__scene=s;return s};`;
  const html = await buildStudioPreviewHtml({
    code: `${setup}\n${code}\nwindow.__ready=true;`,
    trust: 'unreviewed',
    reducedMotion,
    dir: 'ltr',
    themeCss: THEME,
  });
  await page.setContent(
    '<!doctype html><html><body style="margin:0"><iframe title="Design QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
  );
  await page.locator('iframe').evaluate((element, srcdoc) => {
    (element as HTMLIFrameElement).srcdoc = srcdoc;
  }, html);
  const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
  if (frame === undefined) throw new Error('Preview frame missing');
  await frame.waitForFunction(
    'window.__ready === true || document.getElementById("ck-preview")?.hasAttribute("data-ck-js-error")',
  );
  expect(
    await frame.evaluate<string | null>(
      "document.getElementById('ck-preview').getAttribute('data-ck-js-error')",
    ),
  ).toBeNull();
  await frame.locator('canvas').waitFor();
  return frame;
}

const scale = (frame: Frame) => frame.evaluate<number>('window.__scene.design.scale');

it.skipIf(QA)(
  'a design world refits to its region on every resize, its pointer in design units',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.route(/^https?:/u, (route) => route.abort());
      const frame = await mount(page, STAGE);
      expect(await scale(frame)).toBeCloseTo(400 / 720, 6);
      await page.setViewportSize({ width: 390, height: 720 });
      await frame.waitForFunction('Math.abs(window.__scene.width - 390) < 1');
      expect(await scale(frame)).toBeCloseTo(390 / 1280, 6);
      expect(await frame.evaluate<boolean>('window.__scene.compact')).toBe(true);
      // The region's centre reads as the design's centre.
      await page.mouse.move(195, 200);
      expect(
        await frame.evaluate<number[]>('[window.__scene.pointer.x,window.__scene.pointer.y]'),
      ).toEqual([expect.closeTo(640, 0), expect.closeTo(360, 0)]);
      expect(
        await frame.evaluate<boolean>('document.documentElement.scrollWidth > innerWidth'),
      ).toBe(false);
    } finally {
      await browser.close();
    }
  },
  60_000,
);

it.skipIf(QA)(
  'design.zoom: ctrl + wheel zooms, a plain wheel scrolls the page, drag pans within the design',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
      await page.route(/^https?:/u, (route) => route.abort());
      const frame = await mount(page, MAP);
      const fit = 400 / 1440;
      expect(await scale(frame)).toBeCloseTo(fit, 6);
      expect(await frame.evaluate<string>('window.__scene.canvas.style.touchAction')).toBe(
        'pan-x pan-y',
      );

      // A plain wheel over the canvas belongs to the page.
      await page.mouse.move(400, 200);
      await page.mouse.wheel(0, 200);
      await expect.poll(() => frame.evaluate<number>('scrollY')).toBeGreaterThan(100);
      expect(await scale(frame)).toBeCloseTo(fit, 6);
      await frame.evaluate('scrollTo(0, 0)');
      await expect.poll(() => frame.evaluate<number>('scrollY')).toBe(0);

      // ctrl + wheel (a trackpad pinch) zooms the world around the pointer, not the page.
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -400);
      await page.keyboard.up('Control');
      await expect.poll(() => scale(frame)).toBeGreaterThan(fit * 1.5);
      expect(await frame.evaluate<number>('scrollY')).toBe(0);

      // Mouse drag pans; the camera never leaves the design.
      const before = await frame.evaluate<number>('window.__scene.world.x');
      await page.mouse.move(400, 200);
      await page.mouse.down();
      await page.mouse.move(300, 180, { steps: 5 });
      await page.mouse.up();
      await expect
        .poll(() => frame.evaluate<number>('window.__scene.world.x'))
        .toBeLessThan(before - 50);
      await page.mouse.move(100, 100);
      await page.mouse.down();
      await page.mouse.move(790, 390, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(() => frame.evaluate<number>('window.__scene.design.view.x'))
        .toBeCloseTo(0, 3);
      expect(await frame.evaluate<number>('window.__scene.design.view.y')).toBeCloseTo(0, 3);

      // s.pointer follows the camera into design units.
      await page.mouse.move(0, 0);
      const corner = await frame.evaluate<number[]>(
        '[window.__scene.pointer.x,window.__scene.pointer.y]',
      );
      expect(corner[0]).toBeCloseTo(0, 0);
      expect(corner[1]).toBeCloseTo(0, 0);
    } finally {
      await browser.close();
    }
  },
  60_000,
);

it.skipIf(QA)(
  'design.zoom under reduced motion: no ticker, yet a zoom renders at once',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
      await page.route(/^https?:/u, (route) => route.abort());
      const frame = await mount(page, MAP, true);
      expect(await frame.evaluate<boolean>('window.__scene.app.ticker.started')).toBe(false);
      await page.waitForTimeout(800);
      const still = await frame.locator('canvas').screenshot();
      await page.mouse.move(400, 200);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -400);
      await page.keyboard.up('Control');
      await expect.poll(() => scale(frame)).toBeGreaterThan(400 / 1440);
      expect(await frame.locator('canvas').screenshot()).not.toEqual(still);
    } finally {
      await browser.close();
    }
  },
  60_000,
);
