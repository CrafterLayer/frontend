import { chromium, type Frame, type Page } from 'playwright';
import { expect, it } from 'vitest';

import { buildStudioPreviewHtml } from '@craftkit/builder';
import {
  CREATIVE_ANIMATION_CONTROLS,
  CREATIVE_ANIMATION_EXAMPLE,
  CREATIVE_DIALOGUE_EXAMPLE,
  CREATIVE_EFFECTS_CONTROLS,
  CREATIVE_EFFECTS_EXAMPLE,
  CREATIVE_ENGINE_SKILLS,
  CREATIVE_INK_EXAMPLE,
  CREATIVE_TILEMAP_CONTROLS,
  CREATIVE_TILEMAP_EXAMPLE,
  PIXI_CREATIVE_SKILLS,
} from '@craftkit/builder/wire';

/*
  creative agent (2026-10-12): the creative engine playbooks' EXACT examples, run in the
  generated, sandboxed Studio preview runtime (real Pixi v8 + WebGL, the lazily loaded
  ck-lib-anim/fx/dialogue/ink/tilemap assets, CSP without network). Only the host seam is
  instrumented to expose the scene; the taught bodies are unchanged.
*/

/** T231 (2026-10-12): the dialogue example reads its lines from the tree (s.lib.dialogue.fromDom). */
const DIALOGUE_TREE = taughtTree('craftkit.pixi-dialogue');

const QA_STYLE = `html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui} .qa-controls{position:absolute;z-index:3;inset-inline:12px;top:12px;background:#172033e8;color:#f1f5f9;padding:12px;border-radius:12px} button{background:#f1f5f9;color:#172033;border:1px solid #94a3b8;border-radius:6px;padding:8px;margin:3px;touch-action:none}`;

interface MountOptions {
  reducedMotion?: boolean;
  dir?: 'ltr' | 'rtl';
  lang?: string;
  /** The region's jsParams (data-ck-params), read by ck.params. */
  params?: Record<string, unknown>;
  /** Instrumentation that runs before the scene (e.g. counting AudioContexts). */
  prelude?: string;
  /** Page CSS after the QA style (e.g. room to scroll for a scroll mural). */
  css?: string;
}

async function mount(
  page: Page,
  code: string,
  controls: string,
  options: MountOptions = {},
): Promise<Frame> {
  const setup = `${options.prelude ?? ''}ck.root.innerHTML=${JSON.stringify(controls === '' ? '' : `<div class='qa-controls'>${controls}</div>`)};
const originalScene=ck.scene.bind(ck);ck.scene=async options=>{const s=await originalScene(options);window.__creativeScene=s;window.__creativeStage=s.stage;return s};`;
  const html = await buildStudioPreviewHtml({
    code: `${setup}\n${code}\nwindow.__creativeReady=true;`,
    trust: 'unreviewed',
    reducedMotion: options.reducedMotion ?? false,
    dir: options.dir ?? 'ltr',
    lang: options.lang,
    params: options.params,
    themeCss: `${QA_STYLE}${options.css ?? ''}`,
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
            const talk = await mount(page, CREATIVE_DIALOGUE_EXAMPLE, DIALOGUE_TREE, { dir });
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
            // Keyboard input switches on (the canvas becomes focusable) at the first running step;
            // focusing before that frame lands on nothing, so wait for it (a race on slow frames).
            await level.waitForFunction('window.__creativeScene.canvas.tabIndex === 0');
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
      const talk = await mount(page, CREATIVE_DIALOGUE_EXAMPLE, DIALOGUE_TREE, {
        reducedMotion: true,
      });
      // No typewriter under reduced motion: the whole line is visible at once.
      expect(await talk.locator('.ckd-text').textContent()).toBe('The lantern went out.');
    } finally {
      await browser.close();
    }
  },
  60_000,
);

/*
  game libraries (2026-10-12): the audio, game-AI and HUD playbooks' examples exactly as the Agent
  reads them (the inlined `e.g.` line of each skill), with test-owned controls that follow each
  skill's "Example tree". Separate tests, so one library's failure never hides another's.
*/

/** A skill's "Example tree:" line verbatim: the tree its example reads. */
function taughtTree(id: string): string {
  const skill = [...CREATIVE_ENGINE_SKILLS, ...PIXI_CREATIVE_SKILLS].find(
    (candidate) => candidate.id === id,
  );
  const line = skill?.instructions.split('\n').find((text) => text.startsWith('Example tree: '));
  if (line === undefined) throw new Error(`${id} teaches no example tree`);
  return line.slice('Example tree: '.length);
}

function taught(id: string): string {
  const skill = [...CREATIVE_ENGINE_SKILLS, ...PIXI_CREATIVE_SKILLS].find(
    (candidate) => candidate.id === id,
  );
  const line = skill?.instructions.split('\n').find((text) => text.startsWith('e.g. '));
  if (line === undefined) throw new Error(`${id} teaches no example`);
  return line.slice(line.indexOf(': ') + ': '.length);
}

const AUDIO_CONTROLS = `<div role='group' aria-label='Sound effects'><button type='button' data-sfx='jump'>Jump</button><button type='button' data-sfx='coin'>Coin</button><button type='button' data-sfx='powerup'>Power up</button><button type='button' data-sfx='explode'>Boom</button></div><p data-sfx-status role='status' aria-live='polite'></p>`;

const CHASE_CONTROLS = `<p>Reach the green exit before the guard catches you. Arrows or WASD to move.</p><div role='group' aria-label='Game controls'><button type='button' data-chase-start>Start</button><button type='button' data-chase-key='ArrowLeft'>Left</button><button type='button' data-chase-key='ArrowRight'>Right</button><button type='button' data-chase-key='ArrowUp'>Up</button><button type='button' data-chase-key='ArrowDown'>Down</button></div><output data-chase-status role='status' aria-live='polite'></output>`;

const HUD_CONTROLS = `<div role='group' aria-label='Actions'><button type='button' data-hud-act='hit'>Take a hit</button><button type='button' data-hud-act='heal'>Heal</button></div><p data-hud-status role='status' aria-live='polite'></p>`;

/* Counts AudioContexts and successful decodes; installed before the scene, the body untouched. */
const COUNT_AUDIO = `window.__audioContexts=0;window.__decoded=0;
for(const k of ['AudioContext','webkitAudioContext']){const N=window[k];if(typeof N==='function')window[k]=class extends N{constructor(...a){super(...a);window.__audioContexts+=1}}}
const ckDecode=BaseAudioContext.prototype.decodeAudioData;BaseAudioContext.prototype.decodeAudioData=function(...a){const p=ckDecode.apply(this,a);Promise.resolve(p).then(()=>{window.__decoded+=1},()=>undefined);return p};
`;

/** A 0.6 s, 220 Hz, 8-bit mono WAV as a data: URL — an admitted music URL with no network. */
function wavDataUrl(): string {
  const rate = 8000;
  const samples = 4800;
  const bytes = Buffer.alloc(44 + samples);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + samples, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate, 28);
  bytes.writeUInt16LE(1, 32);
  bytes.writeUInt16LE(8, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples, 40);
  for (let i = 0; i < samples; i += 1)
    bytes[44 + i] = 128 + Math.round(60 * Math.sin((2 * Math.PI * 220 * i) / rate));
  return `data:audio/wav;base64,${bytes.toString('base64')}`;
}

const MAZE = [
  '############',
  '#p...#....e#',
  '#....#.....#',
  '#....#..g..#',
  '#..........#',
  '############',
];

async function eachLayout(
  run: (page: Page, layout: { dir: 'ltr' | 'rtl'; lang: string; width: number }) => Promise<void>,
): Promise<void> {
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
          await run(page, { dir, lang: dir === 'rtl' ? 'ar' : 'en', width });
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      }
  } finally {
    await browser.close();
  }
}

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'audio: no AudioContext before input, queued music starts on the first gesture, accessible mute toggle',
  async () => {
    const music = wavDataUrl();
    await eachLayout(async (page, { dir, lang }) => {
      const frame = await mount(page, taught('craftkit.pixi-audio'), AUDIO_CONTROLS, {
        dir,
        lang,
        params: { music },
        prelude: COUNT_AUDIO,
      });
      const toggle = frame.getByRole('button', {
        name: lang === 'ar' ? 'كتم الصوت' : 'Mute sound',
      });
      expect(await toggle.getAttribute('aria-pressed')).toBe('false');
      await page.waitForTimeout(300);
      expect(await frame.evaluate<number>('window.__audioContexts')).toBe(0);
      await frame.getByRole('button', { name: 'Coin' }).click();
      await frame.waitForFunction('window.__audioContexts >= 1');
      // The music asked for before any input was held, then decoded once the gesture opened audio.
      await frame.waitForFunction('window.__decoded >= 1');
      expect(await frame.getByRole('status').textContent()).toBe('coin');
      await toggle.click();
      expect(await toggle.getAttribute('aria-pressed')).toBe('true');
      await toggle.press('Enter');
      expect(await toggle.getAttribute('aria-pressed')).toBe('false');
      await frame.locator('#ck-preview').evaluate((root) => {
        root.remove();
      });
      await frame.waitForFunction('window.__creativeStage.destroyed === true');
    });
  },
  180_000,
);

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'gameai: the guard chases the hero around the wall on the tile grid and never enters it',
  async () => {
    await eachLayout(async (page, { dir }) => {
      const frame = await mount(page, taught('craftkit.pixi-game-ai'), CHASE_CONTROLS, { dir });
      expect(await frame.getByRole('status').textContent()).toBe('ready');
      expect(
        await frame.evaluate<boolean>(
          'window.__creativeScene.app.renderer.renderPipes.tilemap !== undefined',
        ),
      ).toBe(true);
      // Sample the guard's display position every frame (layer children: world, hero, guard).
      await frame.evaluate(() => {
        const host = window as unknown as {
          __creativeStage: { children: { children: { x: number; y: number }[] }[] };
          __guard: [number, number][];
        };
        const guard = host.__creativeStage.children[0]?.children.at(-1);
        host.__guard = [];
        const sample = (): void => {
          if (guard !== undefined) host.__guard.push([guard.x, guard.y]);
          if (host.__guard.length < 3000) requestAnimationFrame(sample);
        };
        sample();
      });
      await frame.getByRole('button', { name: 'Start', exact: true }).click();
      await expect
        .poll(() => frame.getByRole('status').textContent(), { timeout: 30_000 })
        .toBe('caught');
      const trail = await frame.evaluate<[number, number][]>('window.__guard');
      const cells = trail.map(([x, y]) => [Math.floor(x / 32), Math.floor(y / 32)] as const);
      expect(cells.filter(([col, row]) => MAZE[row]?.[col] === '#')).toEqual([]);
      // The only way from the guard's room to the hero's is the bottom row's gap.
      expect(cells.some(([, row]) => row === 4)).toBe(true);
      expect(Math.min(...cells.map(([col]) => col))).toBeLessThanOrEqual(2);
    });
  },
  240_000,
);

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'hud: a hit updates the canvas health bar and its meter; the Pause twin works from the keyboard',
  async () => {
    await eachLayout(async (page, { dir, lang, width }) => {
      const frame = await mount(page, taught('craftkit.pixi-hud'), HUD_CONTROLS, { dir, lang });
      const hudView = 'window.__creativeScene.stage.children.at(-1)';
      const progress = `${hudView}.children[0].children[1].children[0].progress`;
      expect(await frame.evaluate<number>(progress)).toBe(100);
      await frame.getByRole('button', { name: 'Take a hit' }).click();
      expect(await frame.evaluate<number>(progress)).toBe(80);
      const meter = frame.locator('[data-ck-hud] meter').first();
      expect(await meter.evaluate((element) => (element as HTMLMeterElement).value)).toBe(80);
      const barX = await frame.evaluate<number>(`${hudView}.children[0].x`);
      if (dir === 'rtl') expect(barX).toBeGreaterThan(width / 2);
      else expect(barX).toBeLessThan(width / 2);
      const pause = frame.getByRole('button', { name: lang === 'ar' ? 'إيقاف مؤقت' : 'Pause' });
      await pause.focus();
      expect(await pause.isVisible()).toBe(true);
      await page.keyboard.press('Enter');
      expect(await frame.getByRole('status').textContent()).toBe(
        lang === 'ar' ? 'متوقف' : 'Paused',
      );
      await frame.getByRole('button', { name: 'Take a hit' }).click();
      expect(await frame.evaluate<number>(progress)).toBe(80);
      expect(
        await frame.evaluate<boolean>('document.documentElement.scrollWidth > innerWidth'),
      ).toBe(false);
      // Disposal: the region leaving takes the canvas widgets and their DOM twins with it.
      await frame.locator('#ck-preview').evaluate((root) => {
        root.remove();
      });
      await frame.waitForFunction('window.__creativeStage.destroyed === true');
      expect(await frame.locator('[data-ck-hud]').count()).toBe(0);
    });
  },
  180_000,
);

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'game libraries stay calm and complete under reduced motion',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
      await page.route(/^https?:/u, (route) => route.abort());
      const chase = await mount(page, taught('craftkit.pixi-game-ai'), CHASE_CONTROLS, {
        reducedMotion: true,
      });
      expect(await chase.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
        false,
      );
      await chase.getByRole('button', { name: 'Start', exact: true }).click();
      const heroX = 'window.__creativeStage.children[0].children[1].x';
      const before = await chase.evaluate<number>(heroX);
      await chase.getByRole('button', { name: 'Right' }).click();
      expect(await chase.evaluate<number>(heroX)).toBeGreaterThan(before + 20);
      const hud = await mount(page, taught('craftkit.pixi-hud'), HUD_CONTROLS, {
        reducedMotion: true,
      });
      await hud.getByRole('button', { name: 'Take a hit' }).click();
      expect(
        await hud.evaluate<number>(
          'window.__creativeScene.stage.children.at(-1).children[0].children[1].children[0].progress',
        ),
      ).toBe(80);
      expect(await hud.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(false);
    } finally {
      await browser.close();
    }
  },
  60_000,
);

/*
  creative power (2026-10-12): the physics and scroll-mural playbooks' examples and the story
  playbook's read-aloud toggle, exactly as the Agent reads them, with test-owned controls that
  follow each skill's "Example tree".
*/

const PHYSICS_CONTROLS = `<div role='group' aria-label='Physics controls'><button type='button' data-physics='drop'>Drop a crate</button><button type='button' data-physics='launch'>Launch the ball</button><button type='button' data-physics='reset'>Reset</button></div><output data-physics-status role='status' aria-live='polite'></output>`;

/** The physics world's display objects (the view's children: the floor, then one per body). */
const BODIES = 'window.__creativeStage.children[0].children.slice(1)';

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'physics: crates fall and rest on the floor, the ball launches along s.dir, reset restores the stack',
  async () => {
    await eachLayout(async (page, { dir }) => {
      const frame = await mount(page, taught('craftkit.pixi-physics'), PHYSICS_CONTROLS, { dir });
      const status = frame.getByRole('status');
      expect(await status.textContent()).toBe('3 crates, 0 balls');
      expect(await frame.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(true);
      await frame.getByRole('button', { name: 'Drop a crate' }).click();
      expect(await status.textContent()).toBe('4 crates, 0 balls');
      // Dropped from above the box (y < 0), it falls onto the stack and stays inside the walls.
      await frame.waitForFunction(`${BODIES}.at(-1).y > 150`);
      await expect
        .poll(() => frame.evaluate<number>(`Math.max(...${BODIES}.map((g) => g.y))`))
        .toBeLessThanOrEqual(450 - 27);
      const xs = await frame.evaluate<number[]>(`${BODIES}.map((g) => g.x)`);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...xs)).toBeLessThanOrEqual(800);
      await frame.getByRole('button', { name: 'Launch the ball' }).click();
      expect(await status.textContent()).toBe('4 crates, 1 balls');
      // Launched from the start edge (world x 64, or 736 in RTL) toward the stack.
      await frame.waitForFunction(
        dir === 'rtl' ? `${BODIES}.at(-1).x < 736 - 80` : `${BODIES}.at(-1).x > 64 + 80`,
      );
      await frame.getByRole('button', { name: 'Reset' }).click();
      expect(await status.textContent()).toBe('3 crates, 0 balls');
      expect(await frame.evaluate<number>(`${BODIES}.length`)).toBe(3);
      await frame.locator('#ck-preview').evaluate((root) => {
        root.remove();
      });
      await frame.waitForFunction('window.__creativeStage.destroyed === true');
    });
  },
  180_000,
);

/* Room above and below a 150vh region, so the page scrolls it through the viewport. */
const SCROLL_ROOM =
  'html,body{height:auto;overflow:visible}body{padding-block:100vh}#ck-preview{height:150vh}';
/** The viewport camera (stage: the far sky, then the viewport) and its centre. */
const CAMERA_X = 'window.__creativeStage.children[1].center.x';

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'scroll mural: page scroll moves the camera and the far layer along s.dir, never the wheel',
  async () => {
    await eachLayout(async (page, { dir, width }) => {
      const frame = await mount(page, taught('craftkit.pixi-scroll-murals'), '', {
        dir,
        css: SCROLL_ROOM,
      });
      // The world holds the hills, nine houses and the fireflies, pre-warmed before any frame.
      const world = 'window.__creativeStage.children[1].children';
      expect(await frame.evaluate<number>(`${world}.length`)).toBe(11);
      expect(
        await frame.evaluate<number>(`${world}.at(-1).particleChildren.length`),
      ).toBeGreaterThan(5);
      const start = await frame.evaluate<number>(CAMERA_X);
      await frame.evaluate('scrollTo(0, innerHeight * 1.25)');
      await frame.waitForFunction('Math.abs(window.__creativeScene.scroll.progress - 0.5) < 0.05');
      await expect.poll(() => frame.evaluate<number>(CAMERA_X)).toBeCloseTo(1200, -1);
      const middle = await frame.evaluate<number>(CAMERA_X);
      expect(dir === 'rtl' ? start - middle : middle - start).toBeGreaterThan(200);
      const farX = await frame.evaluate<number>('window.__creativeStage.children[0].x');
      expect(farX).toBeLessThan(0);
      expect(farX).toBeGreaterThanOrEqual(-width * 0.1 - 1);
      // The wheel over the canvas still scrolls the page.
      const before = await frame.evaluate<number>('scrollY');
      await page.mouse.move(width / 2, 360);
      await page.mouse.wheel(0, 240);
      await expect.poll(() => frame.evaluate<number>('scrollY')).toBeGreaterThan(before + 100);
      expect(
        await frame.evaluate<boolean>('document.documentElement.scrollWidth > innerWidth'),
      ).toBe(false);
      await frame.locator('#ck-preview').evaluate((root) => {
        root.remove();
      });
      await frame.waitForFunction('window.__creativeStage.destroyed === true');
    });
  },
  180_000,
);

const STORY_CONTROLS = `<article><h2 data-story-title></h2><p data-story-copy></p><div role='group' aria-label='Story navigation'><button type='button' data-story-action='back'>Previous</button><button type='button' data-story-action='next'>Next</button><button type='button' data-story-action='reset'>Restart story</button><button type='button' data-story-voice aria-pressed='false'>Read aloud</button></div><output data-story-status role='status' aria-live='polite'></output></article>`;

/* Records what the page asks speechSynthesis to say; installed before the scene, body untouched. */
const RECORD_SPEECH = `window.__spoken=[];Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:u=>window.__spoken.push(u.lang+'|'+u.text),cancel:()=>window.__spoken.push('cancel')}});
`;

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'story read-aloud: silent until pressed, reads each page in the page language, stops on toggle and dispose',
  async () => {
    await eachLayout(async (page, { dir, lang }) => {
      const frame = await mount(page, taught('craftkit.pixi-stories'), STORY_CONTROLS, {
        dir,
        lang,
        prelude: RECORD_SPEECH,
      });
      const spoken = () => frame.evaluate<string[]>('window.__spoken');
      const voice = frame.getByRole('button', { name: 'Read aloud' });
      expect(await voice.isVisible()).toBe(true);
      expect(await voice.getAttribute('aria-pressed')).toBe('false');
      expect(await spoken()).toEqual([]);
      await voice.click();
      expect(await voice.getAttribute('aria-pressed')).toBe('true');
      expect(await spoken()).toEqual(['cancel', `${lang}|Dawn. A traveller discovers a light.`]);
      await frame.getByRole('button', { name: 'Next', exact: true }).click();
      expect((await spoken()).slice(2)).toEqual([
        'cancel',
        `${lang}|Crossing. The traveller carries it across the valley.`,
      ]);
      await voice.press('Enter');
      expect(await voice.getAttribute('aria-pressed')).toBe('false');
      expect((await spoken()).at(-1)).toBe('cancel');
      const quiet = (await spoken()).length;
      await frame.getByRole('button', { name: 'Next', exact: true }).click();
      expect(await spoken()).toHaveLength(quiet);
      await frame.locator('#ck-preview').evaluate((root) => {
        root.remove();
      });
      await frame.waitForFunction('window.__creativeStage.destroyed === true');
      expect((await spoken()).at(-1)).toBe('cancel');
      // Where the browser has no speech synthesis, the toggle is hidden rather than broken.
      const mute = await mount(page, taught('craftkit.pixi-stories'), STORY_CONTROLS, {
        dir,
        lang,
        prelude: `Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined});`,
      });
      expect(await mute.getByRole('button', { name: 'Read aloud' }).isHidden()).toBe(true);
    });
  },
  180_000,
);

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'physics and scroll murals settle into calm still frames under reduced motion',
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
      await page.route(/^https?:/u, (route) => route.abort());
      const toy = await mount(page, taught('craftkit.pixi-physics'), PHYSICS_CONTROLS, {
        reducedMotion: true,
      });
      expect(await toy.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(false);
      await toy.getByRole('button', { name: 'Drop a crate' }).click();
      // No loop runs: the press settles the world synchronously, the new crate already at rest.
      const resting = await toy.evaluate<number>(`${BODIES}.at(-1).y`);
      expect(resting).toBeGreaterThan(150);
      expect(resting).toBeLessThanOrEqual(450 - 27);
      const mural = await mount(page, taught('craftkit.pixi-scroll-murals'), '', {
        reducedMotion: true,
        css: SCROLL_ROOM,
      });
      expect(await mural.evaluate<boolean>('window.__creativeScene.app.ticker.started')).toBe(
        false,
      );
      expect(await mural.evaluate<number>(CAMERA_X)).toBeCloseTo(1200, 0);
      await mural.evaluate('scrollTo(0, innerHeight * 1.8)');
      await page.waitForTimeout(300);
      expect(await mural.evaluate<number>(CAMERA_X)).toBeCloseTo(1200, 0);
    } finally {
      await browser.close();
    }
  },
  60_000,
);
