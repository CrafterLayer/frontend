import { chromium, type Frame, type Page } from 'playwright';
import { expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';

/*
  particles and physics (2026-10-13): s.lib.emitter's presets and s.lib.physics.world(s) in the
  generated, sandboxed Studio preview runtime (real Pixi v8 + WebGL, the lazily loaded
  ck-lib-emitter/physics assets, CSP without network). Only the host seam is instrumented to
  expose the scene; pixels are read back from the renderer, not guessed from object counts.
*/

const PRESETS = [
  'fire',
  'smoke',
  'sparkles',
  'snow',
  'rain',
  'confetti',
  'magic',
  'bubbles',
  'leaves',
  'petals',
  'fireworks',
  'dust',
  'embers',
] as const;

const QA_STYLE =
  'html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui} .qa-controls{position:absolute;z-index:3;inset-inline:12px;top:12px;background:#172033e8;color:#f1f5f9;padding:12px;border-radius:12px} button{background:#f1f5f9;color:#172033;border:1px solid #94a3b8;border-radius:6px;padding:8px;margin:3px}';

/*
  window.__lit(): pixels the stage draws (alpha > 8), read back through the renderer — the scene
  has no background, so only drawn content counts. window.__try(name): spawns a preset (anchored
  for the point ones), waits for a fireworks show's first burst, measures it and destroys it.
*/
const EMITTER_SCENE = `const s=await ck.scene({libs:['emitter']});
window.__lit=()=>{s.app.render();const {pixels}=s.app.renderer.extract.pixels({target:s.stage,frame:new s.PIXI.Rectangle(0,0,s.width,s.height)});let n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>8)n++;return n};
const settle=ms=>new Promise(r=>setTimeout(r,ms));
window.__try=async name=>{const point=name==='fire'||name==='smoke';const h=s.lib.emitter.spawn(s,name,point?{x:s.width/2,y:s.height*.8}:{});if(name==='fireworks')for(let i=0;i<40&&h.count===0;i++)await settle(50);const out={count:h.count,lit:window.__lit(),parent:h.container.parent===s.world};h.destroy();out.after=window.__lit();return out};
window.__pop=async name=>{const h=s.lib.emitter.burst(s,name,{x:s.width/2,y:s.height/2});const out={count:h.count,active:h.active};await settle(120);out.lit=window.__lit();h.destroy();return out};
window.__slant=()=>{const h=s.lib.emitter.spawn(s,'rain');const ps=h.container.particleChildren;const vx=ps.reduce((sum,p)=>sum+p.config.velocity.x,0)/ps.length;h.destroy();return vx};`;

async function mount(
  page: Page,
  code: string,
  options: { dir?: 'ltr' | 'rtl'; reducedMotion?: boolean; controls?: string } = {},
): Promise<Frame> {
  const setup = `ck.root.innerHTML=${JSON.stringify(options.controls ?? '')};
const originalScene=ck.scene.bind(ck);ck.scene=async o=>{const s=await originalScene(o);window.__creativeScene=s;window.__creativeStage=s.stage;window.__sharedTickers=s.PIXI.Ticker.shared.count;return s};`;
  const html = await buildStudioPreviewHtml({
    code: `${setup}\n${code}\nwindow.__creativeReady=true;`,
    trust: 'unreviewed',
    reducedMotion: options.reducedMotion ?? false,
    dir: options.dir ?? 'ltr',
    themeCss: QA_STYLE,
  });
  await page.setContent(
    '<!doctype html><html><body style="margin:0"><iframe title="Particles and physics QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
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

async function eachLayout(
  run: (page: Page, layout: { dir: 'ltr' | 'rtl'; width: number }) => Promise<void>,
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const dir of ['ltr', 'rtl'] as const)
      for (const width of [390, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 720 } });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        await page.route(/^https?:/u, (route) => route.abort());
        try {
          await run(page, { dir, width });
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      }
  } finally {
    await browser.close();
  }
}

interface Tried {
  count: number;
  lit: number;
  parent: boolean;
  after: number;
}

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'every emitter preset draws particles and every burst fires, at 390 and 1280 px, LTR and RTL',
  async () => {
    await eachLayout(async (page, { dir }) => {
      const frame = await mount(page, EMITTER_SCENE, { dir });
      expect(await frame.evaluate<number>('window.__lit()')).toBe(0);
      for (const name of PRESETS) {
        const tried = await frame.evaluate<Tried>(`window.__try(${JSON.stringify(name)})`);
        expect.soft(tried.count, `${name} particles`).toBeGreaterThan(0);
        expect.soft(tried.lit, `${name} lit pixels`).toBeGreaterThan(40);
        expect.soft(tried.parent, `${name} on s.world`).toBe(true);
        // Destroyed: nothing of it is drawn any more.
        expect.soft(tried.after, `${name} after destroy`).toBe(0);
        const popped = await frame.evaluate<{ count: number; active: boolean; lit: number }>(
          `window.__pop(${JSON.stringify(name)})`,
        );
        expect.soft(popped.count, `${name} burst`).toBeGreaterThan(0);
        expect.soft(popped.active, `${name} burst active`).toBe(true);
        expect.soft(popped.lit, `${name} burst lit pixels`).toBeGreaterThan(0);
      }
      // Rain leans toward the inline end: right in LTR, left in RTL.
      const vx = await frame.evaluate<number>('window.__slant()');
      if (dir === 'rtl') expect(vx).toBeLessThan(-20);
      else expect(vx).toBeGreaterThan(20);
      // A burst ends itself once its particles are gone; disposal leaves nothing on the ticker.
      await frame.evaluate(
        "window.__last=window.__creativeScene.lib.emitter.burst(window.__creativeScene,'sparkles',{x:100,y:100});0",
      );
      await frame.waitForFunction('window.__last.active === false', undefined, { timeout: 5_000 });
      await frame.evaluate(
        "window.__creativeScene.lib.emitter.spawn(window.__creativeScene,'snow');window.__creativeScene.lib.emitter.spawn(window.__creativeScene,'fire');0",
      );
      await frame.locator('#ck-preview').evaluate((root) => {
        root.remove();
      });
      await frame.waitForFunction('window.__creativeStage.destroyed === true');
      expect(
        await frame.evaluate<boolean>(
          'window.__creativeScene.PIXI.Ticker.shared.count === window.__sharedTickers',
        ),
      ).toBe(true);
    });
  },
  240_000,
);

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'reduced motion: a preset is one frozen still frame, a burst emits nothing',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      await page.route(/^https?:/u, (route) => route.abort());
      const frame = await mount(
        page,
        `${EMITTER_SCENE}\nwindow.__snow=s.lib.emitter.spawn(s,'snow');window.__ys=()=>window.__snow.container.particleChildren.map(p=>Math.round(p.y)).join();`,
        { reducedMotion: true },
      );
      expect(await frame.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
        false,
      );
      expect(await frame.evaluate<number>('window.__snow.count')).toBeGreaterThan(20);
      expect(await frame.evaluate<number>('window.__lit()')).toBeGreaterThan(40);
      const still = await frame.evaluate<string>('window.__ys()');
      await page.waitForTimeout(400);
      expect(await frame.evaluate<string>('window.__ys()')).toBe(still);
      const popped = await frame.evaluate<{ count: number; active: boolean }>(
        "window.__pop('confetti')",
      );
      expect(popped).toMatchObject({ count: 0, active: false });
    } finally {
      await browser.close();
    }
  },
  60_000,
);

/*
  The physics world: three crates in an 800 × 450 design. They settle on the floor (y = 450 - 30),
  a drag lifts one, the region leaving ends the engine, the loop and every listener.
*/
const PHYSICS_SCENE = `const s=await ck.scene({libs:['physics'],design:{width:800,height:450,align:'bottom'}});
const P=s.PIXI,{Bodies}=s.lib.physics,w=s.lib.physics.world(s);window.__w=w;
window.__crates=[0,1,2].map(i=>w.add(Bodies.rectangle(200+i*200,60,60,60,{friction:.6}),new P.Graphics().rect(-30,-30,60,60).fill(s.palette.accent)));
window.__ys=()=>window.__crates.map(b=>b.position.y);
window.__screen=i=>{const b=window.__crates[i],p=s.world.toGlobal({x:b.position.x,y:b.position.y}),r=s.canvas.getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y}};`;

const RESTING = 'window.__ys().every((y) => Math.abs(y - 420) < 3)';

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'physics world: bodies settle on its floor, the pointer drags one, dispose stops everything',
  async () => {
    await eachLayout(async (page) => {
      const frame = await mount(page, PHYSICS_SCENE, {
        controls: "<div class='qa-controls'><button type='button'>A control</button></div>",
      });
      expect(await frame.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(true);
      await frame.waitForFunction(RESTING, undefined, { timeout: 10_000 });
      // Each display object follows its body.
      expect(
        await frame.evaluate<boolean>(
          'window.__crates.every((b, i) => window.__creativeScene.world.children[i].y === b.position.y)',
        ),
      ).toBe(true);
      // Drag the middle crate up and to the side; the iframe fills the page at 0,0.
      const at = await frame.evaluate<{ x: number; y: number }>('window.__screen(1)');
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.move(at.x + 40, at.y - 120, { steps: 12 });
      await frame.waitForFunction('window.__crates[1].position.y < 380', undefined, {
        timeout: 5_000,
      });
      await page.mouse.up();
      await frame.waitForFunction(RESTING, undefined, { timeout: 10_000 });
      await frame.locator('#ck-preview').evaluate((root) => {
        root.remove();
      });
      await frame.waitForFunction('window.__creativeStage.destroyed === true');
      expect(
        await frame.evaluate<number>(
          'window.__w.engine.world.bodies.length + window.__w.engine.world.constraints.length',
        ),
      ).toBe(0);
      expect(
        await frame.evaluate<boolean>(
          'window.__creativeScene.PIXI.Ticker.shared.count === window.__sharedTickers && !window.__creativeScene.app.ticker?.started',
        ),
      ).toBe(true);
      const settled = await frame.evaluate<string>('window.__ys().join()');
      await page.waitForTimeout(300);
      expect(await frame.evaluate<string>('window.__ys().join()')).toBe(settled);
    });
  },
  240_000,
);

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'physics world under reduced motion: no loop, already at rest on the first frame',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      await page.route(/^https?:/u, (route) => route.abort());
      const frame = await mount(page, PHYSICS_SCENE, { reducedMotion: true });
      expect(await frame.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
        false,
      );
      expect(await frame.evaluate<boolean>(RESTING)).toBe(true);
      expect(await frame.evaluate<unknown>('window.__w.drag')).toBeNull();
    } finally {
      await browser.close();
    }
  },
  60_000,
);
