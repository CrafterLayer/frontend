import { chromium, type Frame, type Page } from 'playwright';
import { expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';

/*
  procedural maps and animated GIFs (2026-10-13): s.lib.procgen and s.lib.gif in the generated,
  sandboxed Studio preview runtime (real Pixi v8 + WebGL, the lazily loaded ck-lib-procgen.js and
  ck-lib-gif.js assets, the unreviewed CSP with connect-src 'none'). A dungeon is drawn and every
  room is reachable; a maze becomes a tilemap world whose start and exit sit where the map says; a
  GIF from a data: URL animates (pixels read back from the renderer change colour) and holds its
  first frame under reduced motion. 390 and 1280 px, LTR and RTL, no console errors.
*/

const QA_STYLE =
  'html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui}';

/* An 8 × 8 GIF89a, two frames (red, then blue) of 100 ms each, looping; uncompressed LZW. */
function gifDataUrl(): string {
  const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));
  const bytes = [...ascii('GIF89a'), 8, 0, 8, 0, 0x91, 0, 0];
  bytes.push(255, 0, 0, 0, 0, 255, 0, 255, 0, 255, 255, 255);
  bytes.push(0x21, 0xff, 0x0b, ...ascii('NETSCAPE2.0'), 3, 1, 0, 0, 0);
  for (const index of [0, 1]) {
    bytes.push(0x21, 0xf9, 4, 0, 10, 0, 0, 0, 0x2c, 0, 0, 0, 0, 8, 0, 8, 0, 0, 2);
    const codes: number[] = [];
    for (let pixel = 0; pixel < 64; pixel += 1) codes.push(4, index);
    codes.push(5);
    const data: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const code of codes) {
      buffer |= code << bits;
      bits += 3;
      while (bits >= 8) {
        data.push(buffer & 0xff);
        buffer >>= 8;
        bits -= 8;
      }
    }
    if (bits > 0) data.push(buffer & 0xff);
    bytes.push(data.length, ...data, 0);
  }
  bytes.push(0x3b);
  return `data:image/gif;base64,${Buffer.from(bytes).toString('base64')}`;
}

/*
  window.__lit(): drawn pixels (alpha > 8) read back through the renderer.
  window.__reach(): every dungeon room's centre reachable from the start.
*/
const PROCGEN_SCENE = `const s=await ck.scene({libs:['procgen','tilemap']});
const P=s.lib.procgen,map=P.dungeon(s,{width:40,height:24}),tile=Math.max(4,Math.floor(Math.min(s.width/40,s.height/24)));
window.__map=map;window.__tile=tile;window.__drawn=map.draw(s,{tile});
window.__lit=()=>{s.app.render();const {pixels}=s.app.renderer.extract.pixels({target:s.stage,frame:new s.PIXI.Rectangle(0,0,s.width,s.height)});let n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>8)n++;return n};
window.__reach=()=>map.rooms.length>1&&map.rooms.every(r=>map.distance(map.start,{x:r.cx,y:r.cy})>=0)&&map.distance(map.start,map.exit)>0;
const maze=P.maze(s,{width:21,height:15});window.__maze=maze;
const world=s.lib.tilemap.world(s.app,{tileSize:8,rows:maze.rows(),legend:{'#':{style:'stone',solid:true},p:{kind:'player',marker:true},e:{kind:'exit',marker:true}}});
window.__world=world;s.stage.addChild(world.view);
window.__walk=()=>{const path=maze.path(maze.start,maze.exit);return path.length>1&&path.every(c=>!world.solidAt(c.x*8+4,c.y*8+4))};`;

const GIF_SCENE = `const s=await ck.scene({libs:['gif']});
const g=await s.lib.gif.load(s,${JSON.stringify(gifDataUrl())},{pixelated:true});
g.width=100;g.height=100;g.x=20;g.y=20;s.stage.addChild(g);window.__gif=g;window.__frames=[];g.onFrameChange=f=>window.__frames.push(f);
window.__colour=()=>{s.app.render();const {pixels}=s.app.renderer.extract.pixels({target:s.stage,frame:new s.PIXI.Rectangle(70,70,1,1)});return [pixels[0],pixels[1],pixels[2]].join()};`;

const RED = '255,0,0';
const BLUE = '0,0,255';

async function mount(
  page: Page,
  code: string,
  options: { dir?: 'ltr' | 'rtl'; reducedMotion?: boolean } = {},
): Promise<{ frame: Frame; html: string }> {
  const setup = `ck.scene=(o=>async x=>{const s=await o(x);window.__creativeScene=s;window.__creativeStage=s.stage;window.__sharedTickers=s.PIXI.Ticker.shared.count;return s})(ck.scene.bind(ck));`;
  const html = await buildStudioPreviewHtml({
    code: `${setup}\n${code}\nwindow.__creativeReady=true;`,
    trust: 'unreviewed',
    reducedMotion: options.reducedMotion ?? false,
    dir: options.dir ?? 'ltr',
    themeCss: QA_STYLE,
  });
  await page.setContent(
    '<!doctype html><html><body style="margin:0"><iframe title="Procgen and GIF QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
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
  return { frame, html };
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

async function removeRegion(frame: Frame): Promise<void> {
  await frame.locator('#ck-preview').evaluate((root) => {
    root.remove();
  });
  await frame.waitForFunction('window.__creativeStage.destroyed === true');
}

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'procgen: a drawn dungeon with every room reachable and a maze walked as a tilemap world',
  async () => {
    await eachLayout(async (page, { dir }) => {
      const { frame, html } = await mount(page, PROCGEN_SCENE, { dir });
      // Only the libraries the code names ship, each as its own lazy asset.
      expect(html).toContain('data-ck-engine="lib-procgen"');
      expect(html).not.toContain('data-ck-engine="lib-gif"');
      expect(await frame.evaluate<boolean>('window.__reach()')).toBe(true);
      const area = await frame.evaluate<number>('40 * 24 * window.__tile * window.__tile');
      // The floor rect and the walls cover the whole map (times the device pixel ratio squared).
      expect(await frame.evaluate<number>('window.__lit()')).toBeGreaterThanOrEqual(area * 0.9);
      expect(
        await frame.evaluate<boolean>('window.__drawn.parent === window.__creativeScene.world'),
      ).toBe(true);
      // The tile world carries the map's start and exit where the map put them.
      const marks = await frame.evaluate<{
        player: unknown;
        exit: unknown;
        start: unknown;
        end: unknown;
      }>(
        "({player:window.__world.find('player').map(c=>[c.col,c.row]),exit:window.__world.find('exit').map(c=>[c.col,c.row]),start:[window.__maze.start.x,window.__maze.start.y],end:[window.__maze.exit.x,window.__maze.exit.y]})",
      );
      expect(marks.player).toEqual([marks.start]);
      expect(marks.exit).toEqual([marks.end]);
      expect(await frame.evaluate<boolean>('window.__walk()')).toBe(true);
      // The start sits on the inline-start side: left in LTR, right in RTL.
      const side = await frame.evaluate<number>('window.__maze.start.x / window.__maze.width');
      if (dir === 'rtl') expect(side).toBeGreaterThan(0.5);
      else expect(side).toBeLessThan(0.5);
      await removeRegion(frame);
      expect(await frame.evaluate<boolean>('window.__drawn.destroyed')).toBe(true);
    });
  },
  240_000,
);

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'gif: a data: URL GIF animates on the scene ticker and ends with the scene',
  async () => {
    await eachLayout(async (page, { dir }) => {
      const { frame, html } = await mount(page, GIF_SCENE, { dir });
      expect(html).toContain('data-ck-engine="lib-gif"');
      expect(html).not.toContain('data-ck-engine="lib-procgen"');
      expect(
        await frame.evaluate<{ total: number; duration: number; playing: boolean }>(
          '({total:window.__gif.totalFrames,duration:window.__gif.duration,playing:window.__gif.playing})',
        ),
      ).toEqual({ total: 2, duration: 200, playing: true });
      await frame.waitForFunction(
        'window.__frames.includes(1) && window.__frames.includes(0)',
        undefined,
        {
          timeout: 5_000,
        },
      );
      // Pixels follow the frames: red on frame 0, blue on frame 1.
      await frame.evaluate('window.__gif.gotoAndStop(0)');
      expect(await frame.evaluate<string>('window.__colour()')).toBe(RED);
      await frame.evaluate('window.__gif.gotoAndStop(1)');
      expect(await frame.evaluate<string>('window.__colour()')).toBe(BLUE);
      await frame.evaluate('window.__gif.play()');
      // Never on Ticker.shared: the scene's own ticker drives it.
      expect(
        await frame.evaluate<boolean>(
          'window.__creativeScene.PIXI.Ticker.shared.count === window.__sharedTickers',
        ),
      ).toBe(true);
      await removeRegion(frame);
      expect(await frame.evaluate<boolean>('window.__gif.destroyed')).toBe(true);
    });
  },
  240_000,
);

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'reduced motion: the GIF holds its first frame and the map is still drawn',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.route(/^https?:/u, (route) => route.abort());
      const { frame } = await mount(page, GIF_SCENE, { reducedMotion: true });
      expect(await frame.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
        false,
      );
      await page.waitForTimeout(450);
      expect(
        await frame.evaluate<{ frame: number; playing: boolean; changes: number }>(
          '({frame:window.__gif.currentFrame,playing:window.__gif.playing,changes:window.__frames.length})',
        ),
      ).toEqual({ frame: 0, playing: false, changes: 0 });
      expect(await frame.evaluate<string>('window.__colour()')).toBe(RED);
      await frame.evaluate('window.__gif.play()');
      expect(await frame.evaluate<boolean>('window.__gif.playing')).toBe(false);

      const maps = await mount(page, PROCGEN_SCENE, { reducedMotion: true });
      expect(await maps.frame.evaluate<boolean>('window.__reach()')).toBe(true);
      expect(await maps.frame.evaluate<number>('window.__lit()')).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  90_000,
);
