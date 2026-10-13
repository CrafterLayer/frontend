import { fileURLToPath } from 'node:url';

import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';

/*
  mural libraries and hex art (2026-10-13): s.lib.noise, s.lib.geom and s.lib.hex, and the six
  set-D presets built on them — then s.lib.color, s.lib.lsys, geom 1.2 and the four set-E presets
  — in the generated, sandboxed Studio preview runtime (real Pixi v8 + WebGL, each lazily loaded
  ck-lib-*.js asset, the unreviewed CSP with connect-src 'none').

  - Libraries: contour bands painted from a noise grid, a square with a hole cut by a boolean (the
    hole reads back as background), a mosaic trimmed to an arch; the Kenney atlas decoding from its
    data: URL with no network (a grass tile reads back green), a board that mirrors in RTL.
  - Presets: each one draws, animates (its pixels change over a second), mirrors (RTL runs clean
    with s.dir = -1), holds one still frame under reduced motion (ticker stopped, pixels unchanged)
    and leaves nothing after the region goes: stage destroyed, Ticker.shared untouched.
  390 and 1280 px, LTR and RTL, no console errors.
*/

const QA = process.env['CRAFTKIT_BROWSER_QA'] === '1';
const QA_STYLE =
  'html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui}';

interface PresetUnderTest {
  readonly id: string;
  readonly code: string;
  readonly libs: readonly string[];
}
const CATALOGUE = fileURLToPath(
  new URL('../../../../packages/builder/ai/src/scene-presets/catalog.ts', import.meta.url),
);
const { SCENE_PRESETS, PLAYBOOK_PRESET_IDS } = (await import(/* @vite-ignore */ CATALOGUE)) as {
  SCENE_PRESETS: readonly PresetUnderTest[];
  PLAYBOOK_PRESET_IDS: ReadonlySet<string>;
};
const MURALS = SCENE_PRESETS.filter((preset) => PLAYBOOK_PRESET_IDS.has(preset.id));

/*
  Captures the scene the code opens, and a pixel signature of its stage read back through the
  renderer: window.__sig() hashes every 4th pixel; window.__ink() counts drawn pixels.
*/
const SETUP = `ck.scene=(o=>async x=>{const s=await o(x);window.__creativeScene=s;window.__creativeStage=s.stage;window.__sharedTickers=s.PIXI.Ticker.shared.count;return s})(ck.scene.bind(ck));
window.__read=()=>{const s=window.__creativeScene;s.app.render();return s.app.renderer.extract.pixels({target:s.stage,frame:new s.PIXI.Rectangle(0,0,s.width,s.height)}).pixels};
window.__sig=()=>{const p=window.__read();let h=0;for(let i=0;i<p.length;i+=16)h=(Math.imul(h,31)+p[i]+p[i+1]*3+p[i+2]*7)|0;return h};
window.__ink=()=>{const p=window.__read();const seen=new Set();for(let i=0;i<p.length;i+=16)seen.add((p[i]>>4)<<8|(p[i+1]>>4)<<4|p[i+2]>>4);return seen.size};
window.__at=(x,y)=>{const s=window.__creativeScene,g=s.world.toGlobal({x,y});s.app.render();const {pixels}=s.app.renderer.extract.pixels({target:s.stage,frame:new s.PIXI.Rectangle(Math.round(g.x),Math.round(g.y),1,1)});return [pixels[0],pixels[1],pixels[2]]};`;

const GEOM_SCENE = `const s=await ck.scene({libs:['noise','geom'],design:{width:1280,height:720,fit:'contain'}});
const G=s.lib.geom,C=s.palette,n=s.lib.noise.create(s,{scale:300,warp:40});
const g=new s.PIXI.Graphics();s.world.addChild(g);
const bands=G.bands(n.grid({width:1280,height:720,cell:20}),6);
bands.forEach((b,i)=>G.draw(g,b.shapes,C.mix(C.surface,C.accent,i/5)));
const cut=new s.PIXI.Graphics();s.world.addChild(cut);
G.draw(cut,G.difference([100,100,500,100,500,500,100,500],[200,200,400,200,400,400,200,400]),0xff0000);
const tiles=G.mosaic(s,{x:700,y:60,width:400,height:600,cells:80,gap:4,clip:G.arch(700,60,400,600,'pointed')});
const glass=new s.PIXI.Graphics();s.world.addChild(glass);tiles.forEach(t=>glass.poly(t.tile).fill(0x00ff00));
window.__counts={bands:bands.length,tiles:tiles.length};window.__tile=tiles[Math.floor(tiles.length/2)];`;

const HEX_SCENE = `const s=await ck.scene({libs:['hex'],design:{width:1280,height:720,fit:'contain'}});
const hex=await s.lib.hex.load(s);
window.__board=hex.board({cols:9,rows:6,terrain:c=>c.q===4&&c.r===2?'grass':c.q===0?'water':'sand'});`;

/* 1.1.0 (2026-10-13): FastNoiseLite's types and a Bézier stroke, vendored, from the built assets. */
const FAST_SCENE = `const s=await ck.scene({libs:['noise','geom'],design:{width:1280,height:720,fit:'contain'}});
const G=s.lib.geom,C=s.palette;
const kinds=['perlin','value','value-cubic','opensimplex2','opensimplex2s'];
const fields=kinds.map(type=>s.lib.noise.create(s,{type,scale:180,fractal:'fbm'}));
const g=new s.PIXI.Graphics();s.world.addChild(g);
G.bands(fields[0].grid({width:1280,height:720,cell:20}),5).forEach((b,i)=>G.draw(g,b.shapes,C.mix(C.surface,C.accent,i/4)));
const c=G.curve([80,600,400,80,900,700,1200,120]);
const stroke=new s.PIXI.Graphics();s.world.addChild(stroke);stroke.poly(c.outline([6,60]),true).fill(0xff00ff);
window.__fast={types:s.lib.noise.types,spread:fields.map(f=>{let lo=1,hi=-1;for(let i=0;i<64;i++){const v=f.at(i*20,i*11,0);lo=Math.min(lo,v);hi=Math.max(hi,v)}return hi-lo}),mid:c.at(0.5),loop:[fields[0].loop(100,100,0),fields[0].loop(100,100,1)]};`;

/*
  mural libraries 2 (2026-10-13): s.lib.color, s.lib.lsys and geom 1.2 from the built assets — an
  OKLCH ramp colour read back from a G.arc ring (its hole open), a fitted L-system tree stroked
  magenta, a natural spline stroked green and simplified.
*/
const LIBS2_SCENE = `const s=await ck.scene({libs:['color','lsys','geom'],design:{width:1280,height:720,fit:'contain'}});
const Co=s.lib.color,L=s.lib.lsys,G=s.lib.geom,C=s.palette;
const ramp=Co.ramp(C.surface,C.accent,5,{space:'oklch'});
const g=new s.PIXI.Graphics();s.world.addChild(g);g.poly(G.arc({cx:300,cy:360,inner:120,outer:220})).fill(ramp[3]);
const tree=L.fit(L.grow(s,{preset:'tree',seed:4,dir:s.dir}),{x:700,y:100,width:500,height:540},{align:'bottom'});
const t=new s.PIXI.Graphics();s.world.addChild(t);L.draw(t,tree,{color:0xff00ff,width:6});
const wave=G.spline([0,650,320,600,640,690,960,600,1280,650],{curve:'natural'});
const w=new s.PIXI.Graphics();s.world.addChild(w);w.poly(wave,false).stroke({width:8,color:0x00ff00});
const q=Math.floor(wave.length/8)*2;
window.__libs2={ring:ramp[3],readable:Co.readable(C.surface,[C.surface,C.text])===C.text,trunk:[(tree.segments[0]+tree.segments[2])/2,(tree.segments[1]+tree.segments[3])/2],lean:tree.tips[0]-tree.segments[0],kept:G.simplify(wave,2).length,points:wave.length,on:[wave[q],wave[q+1]]};`;

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
    '<!doctype html><html><body style="margin:0"><iframe title="Mural QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
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
  width: number,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ viewport: { width, height: 720 } });
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

describe.skipIf(!QA)('mural libraries and hex art in the Studio preview runtime', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser.close();
  });

  it('geom + noise: bands from a noise grid, a cut hole and an arch-trimmed mosaic', async () => {
    for (const width of [390, 1280]) {
      await withPage(browser, width, async (page) => {
        const { frame, html } = await mount(page, GEOM_SCENE);
        expect(html).toContain('data-ck-engine="lib-noise"');
        expect(html).toContain('data-ck-engine="lib-geom"');
        expect(html).not.toContain('data-ck-engine="lib-hex"');
        const counts = await frame.evaluate<{ bands: number; tiles: number }>('window.__counts');
        expect(counts.bands).toBe(6);
        expect(counts.tiles).toBeGreaterThan(50);
        // The ring is red; its hole shows the bands beneath, not red.
        expect(await frame.evaluate<number[]>('window.__at(150, 150)')).toEqual([255, 0, 0]);
        expect(await frame.evaluate<number[]>('window.__at(300, 300)')).not.toEqual([255, 0, 0]);
        // Tiles inside the arch, nothing at its outer corners.
        expect(
          await frame.evaluate<number[]>('window.__at(window.__tile.cx, window.__tile.cy)'),
        ).toEqual([0, 255, 0]);
        expect(await frame.evaluate<number[]>('window.__at(706, 66)')).not.toEqual([0, 255, 0]);
        expect(await frame.evaluate<number>('window.__ink()')).toBeGreaterThan(6);
        await removeRegion(frame);
      });
    }
  }, 120_000);

  it('noise 1.1 + geom 1.1: FastNoiseLite types draw and loop, a tapered Bézier stroke fills', async () => {
    await withPage(browser, 1280, async (page) => {
      const { frame } = await mount(page, FAST_SCENE);
      const fast = await frame.evaluate<{
        types: string[];
        spread: number[];
        mid: { x: number; y: number };
        loop: [number, number];
      }>('window.__fast');
      expect(fast.types).toEqual(
        expect.arrayContaining(['perlin', 'value', 'value-cubic', 'opensimplex2', 'opensimplex2s']),
      );
      for (const spread of fast.spread) expect(spread).toBeGreaterThan(0.2);
      expect(fast.loop[1]).toBeCloseTo(fast.loop[0], 6);
      // The stroke's middle is filled magenta; the Perlin bands paint the rest.
      expect(
        await frame.evaluate<number[]>(`window.__at(${String(fast.mid.x)}, ${String(fast.mid.y)})`),
      ).toEqual([255, 0, 255]);
      expect(await frame.evaluate<number>('window.__ink()')).toBeGreaterThan(5);
      await removeRegion(frame);
    });
  }, 120_000);

  it('hex: the Kenney atlas decodes offline from its data: URL and the board mirrors in RTL', async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      for (const width of [390, 1280]) {
        await withPage(browser, width, async (page) => {
          const { frame, html } = await mount(page, HEX_SCENE, { dir });
          expect(html).toContain('data-ck-engine="lib-hex"');
          const cells = await frame.evaluate<{ count: number; first: number; second: number }>(
            '({count:window.__board.cells.length,first:window.__board.at(0,2).x,second:window.__board.at(1,2).x})',
          );
          expect(cells.count).toBe(54);
          if (dir === 'rtl') expect(cells.first).toBeGreaterThan(cells.second);
          else expect(cells.first).toBeLessThan(cells.second);
          // Kenney's grass is green: the atlas really decoded (a sand tile is pale, water is ours).
          const grass = await frame.evaluate<number[]>(
            'window.__at(window.__board.at(4,2).x, window.__board.at(4,2).y)',
          );
          expect(grass[1] ?? 0).toBeGreaterThan((grass[0] ?? 0) + 40);
          expect(grass[1] ?? 0).toBeGreaterThan((grass[2] ?? 0) + 20);
          await removeRegion(frame);
          expect(await frame.evaluate<boolean>('window.__board.view.destroyed')).toBe(true);
        });
      }
    }
  }, 180_000);

  it('color + lsys + geom 1.2: an OKLCH ring, a fitted tree that mirrors, a spline', async () => {
    const leans: number[] = [];
    for (const dir of ['ltr', 'rtl'] as const) {
      await withPage(browser, 1280, async (page) => {
        const { frame, html } = await mount(page, LIBS2_SCENE, { dir });
        for (const key of ['color', 'lsys', 'geom']) {
          expect(html).toContain(`data-ck-engine="lib-${key}"`);
        }
        const libs = await frame.evaluate<{
          ring: number;
          readable: boolean;
          trunk: [number, number];
          lean: number;
          kept: number;
          points: number;
          on: [number, number];
        }>('window.__libs2');
        const rgb = [(libs.ring >> 16) & 255, (libs.ring >> 8) & 255, libs.ring & 255];
        expect(await frame.evaluate<number[]>('window.__at(470, 360)')).toEqual(rgb);
        expect(await frame.evaluate<number[]>('window.__at(300, 360)')).not.toEqual(rgb);
        expect(libs.readable).toBe(true);
        expect(
          await frame.evaluate<number[]>(
            `window.__at(${String(libs.trunk[0])}, ${String(libs.trunk[1])})`,
          ),
        ).toEqual([255, 0, 255]);
        expect(
          await frame.evaluate<number[]>(
            `window.__at(${String(libs.on[0])}, ${String(libs.on[1])})`,
          ),
        ).toEqual([0, 255, 0]);
        expect(libs.kept).toBeLessThan(libs.points);
        leans.push(libs.lean);
        await removeRegion(frame);
      });
    }
    // The same seeded tree, mirrored in RTL: its first branch end leans the other way.
    expect(leans[0]).not.toBe(0);
    expect(leans[1]).toBeCloseTo(-(leans[0] ?? 0), 3);
  }, 120_000);

  it('covers the set-D and set-E presets', () => {
    expect(MURALS.map((preset) => preset.id)).toEqual([
      'terraced-topography',
      'paper-cut-landscape',
      'ribbon-flow',
      'hex-island',
      'mosaic-arch-window',
      'ebru-marbling',
      'botanical-garden',
      'gradient-waves',
      'arc-rings',
      'arabesque-scroll',
    ]);
  });

  it.each(MURALS.map((preset): [string, PresetUnderTest] => [preset.id, preset]))(
    '%s draws, animates, mirrors, holds a still frame and disposes',
    async (_id, preset) => {
      // LTR desktop: it draws, and a second later it has moved.
      await withPage(browser, 1280, async (page) => {
        const { frame, html } = await mount(page, preset.code);
        for (const key of preset.libs.filter((lib) => lib !== 'kit')) {
          expect(html).toContain(`data-ck-engine="lib-${key}"`);
        }
        await page.waitForTimeout(400);
        expect(await frame.evaluate<number>('window.__ink()')).toBeGreaterThan(4);
        const before = await frame.evaluate<number>('window.__sig()');
        await page.waitForTimeout(1200);
        expect(await frame.evaluate<number>('window.__sig()')).not.toBe(before);
        expect(await frame.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
          true,
        );
        await removeRegion(frame);
        expect(
          await frame.evaluate<boolean>(
            'window.__creativeScene.PIXI.Ticker.shared.count === window.__sharedTickers',
          ),
        ).toBe(true);
      });
      // RTL phone: mirrored scene, runs clean.
      await withPage(browser, 390, async (page) => {
        const { frame } = await mount(page, preset.code, { dir: 'rtl' });
        expect(await frame.evaluate<number>('window.__creativeScene.dir')).toBe(-1);
        await page.waitForTimeout(300);
        expect(await frame.evaluate<number>('window.__ink()')).toBeGreaterThan(4);
        await removeRegion(frame);
      });
      // Reduced motion: one finished frame, the ticker stopped, nothing moves.
      await withPage(browser, 390, async (page) => {
        const { frame } = await mount(page, preset.code, { reducedMotion: true });
        await page.waitForTimeout(800);
        expect(await frame.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
          false,
        );
        expect(await frame.evaluate<number>('window.__ink()')).toBeGreaterThan(4);
        const still = await frame.evaluate<number>('window.__sig()');
        await page.waitForTimeout(700);
        expect(await frame.evaluate<number>('window.__sig()')).toBe(still);
        await removeRegion(frame);
      });
    },
    120_000,
  );
});
