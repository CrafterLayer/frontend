import { fileURLToPath } from 'node:url';

import { chromium, type Browser, type BrowserContext, type Frame, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildStudioPreviewHtml,
  probeScene,
  runSceneProbeFrame,
  sceneProbeIssues,
  type SceneProbeFrameArgs,
} from '@craftkit/builder';

import { kitLang, kitMarkup, type KitUnderTest } from './kit-section';

/*
  The game and story kits PLAYED (2026-10-13): each kit's section — its tree in the page's
  language, its css, its code — in the generated, sandboxed Studio preview (real Pixi v8 + WebGL,
  the libraries it names, no network), driven like a visitor would: Start, keys, the on-screen
  buttons, Pause and Resume, an ending, Play again; for the stories Next / Previous / Start again,
  the dialogue's choices to an ending, and the page scroll through the chapters. Then the scene
  probe (the real CustomCode renderer, three passes) finds nothing to fix in any of them.

  Rounds are made short through the kits' own params (a 3-second clock, one life), so an ending
  arrives without playing well. presets.browser.test.ts runs every kit too (LTR, RTL, reduced
  motion on a phone).
*/

const CATALOGUE = fileURLToPath(
  new URL('../../../../packages/builder/ai/src/scene-presets/catalog.ts', import.meta.url),
);
const { SCENE_PRESETS } = (await import(/* @vite-ignore */ CATALOGUE)) as {
  SCENE_PRESETS: readonly KitUnderTest[];
};
const KITS = SCENE_PRESETS.filter((preset) => preset.region !== undefined);

const QA = process.env['CRAFTKIT_BROWSER_QA'] === '1';
const THEME = `html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui}body{background:#101525}`;
/** Console noise that is not the kit's: refused network, GPU perf notes, the emitter atlas warning. */
const EXPECTED =
  /Failed to load resource|Content Security Policy|net::ERR_|GPU stall|\[BindGroup\] a 'texture(?:Source|Sampler)' was destroyed/u;

interface Mounted {
  readonly page: Page;
  readonly frame: Frame;
  readonly problems: string[];
  readonly context: BrowserContext;
}

interface MountOptions {
  readonly dir?: 'ltr' | 'rtl';
  readonly width?: number;
  readonly height?: number;
  readonly reducedMotion?: boolean;
  readonly params?: Readonly<Record<string, unknown>>;
}

function kitOf(id: string): KitUnderTest {
  const found = KITS.find((kit) => kit.id === id);
  if (found?.region === undefined) throw new Error(`no kit ${id}`);
  return found;
}

async function mount(browser: Browser, id: string, options: MountOptions = {}): Promise<Mounted> {
  const dir = options.dir ?? 'ltr';
  const kit = kitOf(id);
  const context = await browser.newContext({
    viewport: { width: options.width ?? 1280, height: options.height ?? 900 },
  });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    const type = message.type();
    if ((type === 'error' || type === 'warning') && !EXPECTED.test(message.text())) {
      problems.push(`${type}: ${message.text().slice(0, 300)}`);
    }
  });
  await page.route(/^https?:/u, (route) => route.abort());
  const code = `${kit.code}\nwindow.__kitReady = true;`;
  const html = await buildStudioPreviewHtml({
    code,
    markup: kitMarkup(kit, dir, code, options.params),
    trust: 'unreviewed',
    reducedMotion: options.reducedMotion === true,
    dir,
    lang: kitLang(dir),
    themeCss: `${THEME}\n${kit.region?.css ?? ''}`,
  });
  await page.setContent(
    '<!doctype html><html><body style="margin:0"><iframe title="Kit QA" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
  );
  await page.locator('iframe').evaluate((element, srcdoc) => {
    (element as HTMLIFrameElement).srcdoc = srcdoc;
  }, html);
  const frame = page.frames().find((candidate) => candidate.parentFrame() !== null);
  if (frame === undefined) throw new Error('Preview frame missing');
  await frame.waitForFunction('window.__kitReady === true', undefined, { timeout: 30_000 });
  await frame.locator('canvas').waitFor();
  return { page, frame, problems, context };
}

const text = async (frame: Frame, selector: string): Promise<string> =>
  ((await frame.locator(selector).first().textContent()) ?? '').replace(/\s+/gu, ' ').trim();
const status = (frame: Frame): Promise<string> => text(frame, '[data-game-status]');
const stat = (frame: Frame, key: string): Promise<string> =>
  text(frame, `[data-scene-part="${key}"]`);
const action = (frame: Frame, name: string) => frame.locator(`[data-game-action="${name}"]`);
const shot = (frame: Frame): Promise<Buffer> => frame.locator('canvas').screenshot();

async function hold(m: Mounted, key: string, ms: number): Promise<void> {
  await m.frame.locator('canvas').focus();
  await m.page.keyboard.down(key);
  await m.page.waitForTimeout(ms);
  await m.page.keyboard.up(key);
}

/** Ready → Start → running; then Pause freezes the frame and Resume plays on. */
async function startPauseResume(m: Mounted): Promise<void> {
  const { frame } = m;
  expect(await status(frame)).toBe('Press Start to play.');
  expect(await action(frame, 'pause').isDisabled()).toBe(true);
  expect(await frame.locator('[data-scene-part="card"]').isVisible()).toBe(true);
  await action(frame, 'start').click();
  await expect.poll(() => status(frame)).toBe('Game on!');
  expect(await frame.locator('[data-scene-part="card"]').isHidden()).toBe(true);
  expect(await action(frame, 'pause').isDisabled()).toBe(false);
}

async function pauseResume(m: Mounted): Promise<void> {
  const { frame, page } = m;
  await action(frame, 'pause').click();
  await expect.poll(() => status(frame)).toBe('Paused.');
  expect(await action(frame, 'pause').getAttribute('aria-pressed')).toBe('true');
  expect(await text(frame, '[data-game-action="start"]')).toBe('Resume');
  const still = await shot(frame);
  await page.waitForTimeout(350);
  expect((await shot(frame)).equals(still)).toBe(true);
  await action(frame, 'start').click();
  await expect.poll(() => status(frame)).toBe('Game on!');
}

/** The round ends in `line`; Play again starts a fresh one. */
async function endsAndRestarts(m: Mounted, line: string, timeout: number): Promise<void> {
  const { frame } = m;
  await expect.poll(() => status(frame), { timeout }).toContain(line);
  expect(await text(frame, '[data-scene-part="message"]')).toContain(line);
  expect(await text(frame, '[data-game-action="start"]')).toBe('Play again');
  await action(frame, 'start').click();
  await expect.poll(() => status(frame)).toBe('Game on!');
}

let browser: Browser | undefined;

beforeAll(async () => {
  if (QA) browser = await chromium.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

function chromiumOf(): Browser {
  if (browser === undefined) throw new Error('Chromium did not start');
  return browser;
}

async function play(
  id: string,
  options: MountOptions,
  script: (m: Mounted) => Promise<void>,
): Promise<void> {
  const m = await mount(chromiumOf(), id, options);
  try {
    await script(m);
    expect(m.problems).toEqual([]);
  } finally {
    await m.context.close();
  }
}

describe.skipIf(!QA)('game kits, played in Chromium', () => {
  it('arcade: steers, counts down, pauses, ends when the clock runs out, plays again', async () => {
    await play('arcade', { params: { time: 8 } }, async (m) => {
      await startPauseResume(m);
      await pauseResume(m);
      const before = await shot(m.frame);
      await hold(m, 'ArrowRight', 500);
      expect((await shot(m.frame)).equals(before)).toBe(false);
      await endsAndRestarts(m, 'Game over.', 20_000);
      expect(Number(await stat(m.frame, 'time'))).toBeGreaterThanOrEqual(6);
      expect(await stat(m.frame, 'lives')).toBe('3');
    });
  }, 120_000);

  it('platformer: runs, jumps, falls into the first pit and starts over', async () => {
    await play('platformer', { params: { lives: 1 } }, async (m) => {
      await startPauseResume(m);
      await pauseResume(m);
      const before = await shot(m.frame);
      await hold(m, 'Space', 200);
      expect((await shot(m.frame)).equals(before)).toBe(false);
      await m.frame.locator('canvas').focus();
      await m.page.keyboard.down('ArrowRight');
      await expect.poll(() => status(m.frame), { timeout: 8_000 }).toContain('Game over.');
      await m.page.keyboard.up('ArrowRight');
      expect(await text(m.frame, '[data-game-action="start"]')).toBe('Play again');
      await action(m.frame, 'start').click();
      await expect.poll(() => status(m.frame)).toBe('Game on!');
      expect(await stat(m.frame, 'lives')).toBe('1');
    });
  }, 120_000);

  it('runner: runs on its own, trips on an obstacle, keeps the best distance', async () => {
    await play('runner', {}, async (m) => {
      await startPauseResume(m);
      await pauseResume(m);
      await endsAndRestarts(m, 'You tripped!', 15_000);
      expect(Number(await stat(m.frame, 'best'))).toBeGreaterThan(0);
      expect(Number((await stat(m.frame, 'distance')).split('/')[0])).toBeLessThan(40);
    });
  }, 120_000);

  it('breakout: moves the paddle, loses the ball, plays again', async () => {
    await play('breakout', { params: { lives: 1 } }, async (m) => {
      await startPauseResume(m);
      await pauseResume(m);
      const before = await shot(m.frame);
      await hold(m, 'ArrowLeft', 400);
      expect((await shot(m.frame)).equals(before)).toBe(false);
      await hold(m, 'Space', 100);
      await hold(m, 'ArrowRight', 1_400);
      await endsAndRestarts(m, 'Game over.', 30_000);
      expect(await stat(m.frame, 'score')).toBe('0');
    });
  }, 120_000);

  it('memory: turns two cards from the keyboard, counts the move, restarts', async () => {
    await play('memory', {}, async (m) => {
      await startPauseResume(m);
      await hold(m, 'Space', 80);
      await hold(m, 'ArrowRight', 80);
      await hold(m, 'Space', 80);
      await expect.poll(() => stat(m.frame, 'moves')).toBe('1');
      expect(await status(m.frame)).toMatch(/^(?:A match! 1\/8|Not a match\.)$/u);
      await pauseResume(m);
      await action(m.frame, 'restart').click();
      await expect.poll(() => stat(m.frame, 'moves')).toBe('0');
      expect(await stat(m.frame, 'pairs')).toBe('0/8');
    });
  }, 120_000);

  it('quiz: asks every question from its params, judges each answer, scores the round', async () => {
    await play('quiz', {}, async (m) => {
      await startPauseResume(m);
      const { frame } = m;
      for (let at = 1; at <= 5; at += 1) {
        await expect.poll(() => stat(frame, 'progress')).toBe(`Question ${String(at)} of 5`);
        expect(await frame.locator('.ck-kit-answer').count()).toBe(4);
        await frame.locator('.ck-kit-answer').first().click();
        expect(await stat(frame, 'feedback')).toMatch(
          /^(?:Correct!|Not quite\. The answer is \S)/u,
        );
        expect(await frame.locator('.ck-kit-answer:disabled').count()).toBe(4);
        await action(frame, 'next').click();
      }
      await expect
        .poll(() => status(frame))
        .toMatch(/^(?:Well done!|Keep practising!) Score \d\/5/u);
      await action(frame, 'start').click();
      await expect.poll(() => stat(frame, 'progress')).toBe('Question 1 of 5');
      expect(await stat(frame, 'score')).toBe('0/5');
    });
  }, 120_000);

  it('snake: turns, hits the wall, plays again from a short snake', async () => {
    await play('snake', {}, async (m) => {
      await startPauseResume(m);
      await pauseResume(m);
      const before = await shot(m.frame);
      await hold(m, 'ArrowDown', 80);
      await m.page.waitForTimeout(300);
      expect((await shot(m.frame)).equals(before)).toBe(false);
      await endsAndRestarts(m, 'Game over.', 15_000);
      expect(await stat(m.frame, 'score')).toBe('0/20');
    });
  }, 120_000);

  it('catch: moves the basket, loses the last life, plays again', async () => {
    await play('catch', { params: { lives: 1 } }, async (m) => {
      await startPauseResume(m);
      await pauseResume(m);
      const before = await shot(m.frame);
      await hold(m, 'ArrowLeft', 400);
      expect((await shot(m.frame)).equals(before)).toBe(false);
      await endsAndRestarts(m, 'Game over.', 30_000);
      expect(await stat(m.frame, 'lives')).toBe('1');
    });
  }, 120_000);

  it('plays in Arabic, right to left, from its own words', async () => {
    await play('arcade', { dir: 'rtl' }, async ({ frame }) => {
      expect(await status(frame)).toBe('اضغط «ابدأ» لتلعب.');
      expect(await text(frame, '[data-scene-part="title"]')).toBe('جامع النجوم');
      await action(frame, 'start').click();
      await expect.poll(() => status(frame)).toBe('بدأت اللعبة!');
    });
  }, 120_000);

  it('plays step by step under reduced motion: each button press is one move', async () => {
    for (const id of ['snake', 'arcade']) {
      await play(id, { reducedMotion: true, width: 390, height: 760 }, async (m) => {
        await action(m.frame, 'start').click();
        await expect.poll(() => status(m.frame)).toBe('Game on!');
        const before = await shot(m.frame);
        await m.frame.locator('[data-game-key="ArrowDown"]').click();
        await m.page.waitForTimeout(200);
        expect((await shot(m.frame)).equals(before)).toBe(false);
      });
    }
  }, 120_000);
});

describe.skipIf(!QA)('story kits, read in Chromium', () => {
  const storyStatus = (frame: Frame): Promise<string> => text(frame, '[data-story-status]');
  const visibleHeading = (frame: Frame): Promise<string> =>
    text(frame, '[data-scene-part="page"]:not([hidden]) h2');

  it('picture book: turns pages with the buttons and the keys, restarts, reads aloud on request', async () => {
    await play('picture-book', {}, async ({ frame, page }) => {
      expect(await storyStatus(frame)).toBe('Page 1 of 5');
      expect(await visibleHeading(frame)).toBe('The sun goes down');
      expect(await frame.locator('[data-story-action="back"]').isDisabled()).toBe(true);
      const first = await shot(frame);
      await frame.locator('[data-story-action="next"]').click();
      await expect.poll(() => storyStatus(frame)).toBe('Page 2 of 5');
      expect(await visibleHeading(frame)).toBe('Into the woods');
      await page.waitForTimeout(1_200);
      expect((await shot(frame)).equals(first)).toBe(false);
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => storyStatus(frame)).toBe('Page 3 of 5');
      await frame.locator('[data-story-action="back"]').click();
      await expect.poll(() => storyStatus(frame)).toBe('Page 2 of 5');
      for (let at = 3; at <= 5; at += 1) await frame.locator('[data-story-action="next"]').click();
      await expect.poll(() => storyStatus(frame)).toBe('Page 5 of 5');
      expect(await frame.locator('[data-story-action="next"]').isDisabled()).toBe(true);
      await frame.locator('[data-story-action="reset"]').click();
      await expect.poll(() => storyStatus(frame)).toBe('Page 1 of 5');
      const voice = frame.locator('[data-story-voice]');
      if (await voice.isVisible()) {
        await voice.click();
        expect(await voice.getAttribute('aria-pressed')).toBe('true');
      }
    });
  }, 120_000);

  it('picture book in Arabic under reduced motion: the same pages, at once', async () => {
    await play(
      'picture-book',
      { dir: 'rtl', reducedMotion: true, width: 390, height: 800 },
      async ({ frame, page }) => {
        expect(await storyStatus(frame)).toBe('الصفحة 1 من 5');
        await page.waitForTimeout(900);
        const first = await shot(frame);
        await frame.locator('[data-story-action="next"]').click();
        await expect.poll(() => storyStatus(frame)).toBe('الصفحة 2 من 5');
        expect(await visibleHeading(frame)).toBe('في الغابة');
        await page.waitForTimeout(300);
        expect((await shot(frame)).equals(first)).toBe(false);
      },
    );
  }, 120_000);

  it('visual novel: begins, talks, offers the choice, reaches an ending, plays again', async () => {
    for (const [choice, ending] of [
      ['Fix the old lantern', 'Ending: the lanterns glow again'],
      ['Ask the stars', 'Ending: the firefly path'],
    ] as const) {
      await play('visual-novel', {}, async ({ frame }) => {
        expect(await frame.locator('.ckd').count()).toBe(0);
        await frame.locator('[data-story-action="start"]').click();
        const box = frame.locator('.ckd');
        await expect.poll(() => box.textContent()).toContain('The night market is closing');
        await box.getByRole('button', { name: 'Continue' }).click();
        await expect.poll(() => box.textContent()).toContain('nobody will find the way home');
        await box.getByRole('button', { name: 'Continue' }).click();
        await box.getByRole('button', { name: choice }).click();
        for (
          let at = 0;
          at < 3 && !(await box.getByRole('button', { name: 'Play again' }).isVisible());
          at += 1
        ) {
          await box.getByRole('button', { name: 'Continue' }).click();
        }
        await expect.poll(() => storyStatus(frame)).toBe(ending);
        await box.getByRole('button', { name: 'Play again' }).click();
        await expect.poll(() => box.textContent()).toContain('The night market is closing');
      });
    }
  }, 120_000);

  it('scroll story: the page scroll turns the chapters, with and without motion', async () => {
    for (const reducedMotion of [false, true]) {
      await play('scroll-story', { reducedMotion, height: 760 }, async ({ frame }) => {
        expect(await storyStatus(frame)).toBe('Chapter 1 of 4');
        for (const at of [3, 2, 4]) {
          await frame.evaluate((index) => {
            document.querySelectorAll('[data-scene-part="chapter"]')[index - 1]?.scrollIntoView({
              block: 'center',
            });
          }, at);
          await expect.poll(() => storyStatus(frame)).toBe(`Chapter ${String(at)} of 4`);
        }
      });
    }
  }, 120_000);
});

describe.skipIf(!QA)('every kit, through the scene probe', () => {
  it('finds nothing to fix: drawn, controls over the canvas, Start answers, nothing past a phone', async () => {
    const context = await chromiumOf().newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route(/^https?:/u, (route) => route.abort());
    await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
    const findings: string[] = [];
    try {
      for (const kit of KITS) {
        const region = kit.region;
        if (region === undefined) continue;
        const section = {
          tree: region.tree.en,
          css: region.css,
          js: kit.code,
          jsParams: region.params?.en,
        };
        const report = await probeScene({
          section,
          lang: 'en',
          themeCss: THEME,
          budgetMs: 15_000,
          trust: 'unreviewed',
          runPass: (args: SceneProbeFrameArgs) => page.evaluate(runSceneProbeFrame, args),
        });
        if (!report.passes.some(({ status: done }) => done === 'done')) {
          findings.push(`${kit.id}: no pass finished`);
        }
        for (const issue of sceneProbeIssues(report, section)) {
          findings.push(`${kit.id}: ${issue.code}: ${issue.message}`);
        }
      }
    } finally {
      await context.close();
    }
    expect(findings).toEqual([]);
    expect(errors).toEqual([]);
  }, 600_000);
});
