import { chromium, type Browser, type Page } from 'playwright';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CRAFTKIT_AI_SKILL_DEFINITIONS,
  freeCodeCardExamples,
  isProbedScene,
  probeScene,
  runSceneProbeFrame,
  sceneProbeIssues,
  type SceneProbeFrameArgs,
  type SceneProbeReport,
  type SceneProbeSection,
} from '@craftkit/builder';
import {
  CREATIVE_ANIMATION_CONTROLS,
  CREATIVE_ANIMATION_EXAMPLE,
  CREATIVE_DIALOGUE_EXAMPLE,
  CREATIVE_EFFECTS_CONTROLS,
  CREATIVE_EFFECTS_EXAMPLE,
  CREATIVE_INK_EXAMPLE,
  CREATIVE_TILEMAP_CONTROLS,
  CREATIVE_TILEMAP_EXAMPLE,
  PIXI_GAME_CONTROLS,
  PIXI_GAME_EXAMPLE,
  PIXI_MURAL_EXAMPLE,
  PIXI_STORY_CONTROLS,
  PIXI_STORY_EXAMPLE,
} from '@craftkit/builder/wire';

/*
  creative-power Phase 2 E (2026-10-12): "run it, check it, fix it". The scene probe — the real
  `probeScene` orchestration, each pass run by the very `runSceneProbeFrame` the playground uses,
  in Chromium (real Pixi v8 + WebGL, the generated runtime, no network) — and the agent's
  translation of what it found (`sceneProbeIssues`). Every scene the agent is TAUGHT probes clean;
  each scene broken the way a rule describes is flagged with that rule's code.
*/

const QA = process.env['CRAFTKIT_BROWSER_QA'] !== '1';

const THEME = `html{--t-surface:#101525;--t-text:#f1f5f9;--t-accent:#67e8f9;--t-text-muted:#94a3b8;font-family:system-ui}
button{background:#f1f5f9;color:#172033;border:1px solid #94a3b8;border-radius:6px;padding:8px;margin:3px}`;
/**
 * The free-code card's LAYOUT line — a 16:9 stage with a 320px floor, text over the canvas at
 * position:relative;z-index:1 — plus `width:100%`. Without it, Chromium transfers the min-height
 * through the aspect ratio into a min-width (320 × 16/9 ≈ 569px) and the section runs 179px past
 * a 390px phone: the probe's first real find, pinned in the broken corpus below.
 */
const CARD_STAGE = '.ck-scene{position:relative;aspect-ratio:16/9;min-height:320px}';
const TAUGHT_CSS = `.ck-scene{position:relative;width:100%;aspect-ratio:16/9;min-height:320px}.ck-text{position:relative;z-index:1;padding:12px}`;
/** SwiftShader WebGL (no GPU here) starts a stage several times slower than a real browser. */
const BUDGET_MS = 15_000;

const SCENE_SKILLS = CRAFTKIT_AI_SKILL_DEFINITIONS.filter(({ id }) =>
  id.startsWith('craftkit.pixi-'),
);

/** The attributes each skill's "Example tree:" line names, as empty elements the code may find. */
const EXAMPLE_TREE = SCENE_SKILLS.flatMap(({ instructions }) =>
  instructions
    .split('\n')
    .filter((line) => line.startsWith('Example tree:'))
    .flatMap((line) => [...line.matchAll(/data-[\w-]+/gu)].map(([name]) => `<i ${name}></i>`)),
).join('');

const CONTROLS: readonly (readonly [string, string])[] = [
  [PIXI_GAME_EXAMPLE, PIXI_GAME_CONTROLS],
  [PIXI_STORY_EXAMPLE, PIXI_STORY_CONTROLS],
  [CREATIVE_ANIMATION_EXAMPLE, CREATIVE_ANIMATION_CONTROLS],
  [CREATIVE_EFFECTS_EXAMPLE, CREATIVE_EFFECTS_CONTROLS],
  [CREATIVE_TILEMAP_EXAMPLE, CREATIVE_TILEMAP_CONTROLS],
];

function flat(code: string): string {
  return code.replace(/\s+/gu, ' ').trim();
}

function examplesOf(instructions: string): string[] {
  return instructions
    .split('\n')
    .filter((line) => line.startsWith('e.g. '))
    .map((line) => line.slice(line.indexOf(': ') + ': '.length));
}

/** Every worked scene the agent reads, once each, with the controls its example tree names. */
function taughtScenes(): readonly { name: string; js: string; controls: string }[] {
  const named: [string, string][] = [
    ['PIXI_GAME_EXAMPLE', PIXI_GAME_EXAMPLE],
    ['PIXI_STORY_EXAMPLE', PIXI_STORY_EXAMPLE],
    ['PIXI_MURAL_EXAMPLE', PIXI_MURAL_EXAMPLE],
    ['CREATIVE_ANIMATION_EXAMPLE', CREATIVE_ANIMATION_EXAMPLE],
    ['CREATIVE_EFFECTS_EXAMPLE', CREATIVE_EFFECTS_EXAMPLE],
    ['CREATIVE_DIALOGUE_EXAMPLE', CREATIVE_DIALOGUE_EXAMPLE],
    ['CREATIVE_INK_EXAMPLE', CREATIVE_INK_EXAMPLE],
    ['CREATIVE_TILEMAP_EXAMPLE', CREATIVE_TILEMAP_EXAMPLE],
    ...SCENE_SKILLS.flatMap((skill) =>
      examplesOf(skill.instructions).map((code, index): [string, string] => [
        `${skill.id} e.g. ${String(index + 1)}`,
        code,
      ]),
    ),
    ...freeCodeCardExamples().map((code, index): [string, string] => [
      `free-code card e.g. ${String(index + 1)}`,
      code,
    ]),
  ];
  const seen = new Set<string>();
  return named.flatMap(([name, js]) => {
    const key = flat(js);
    if (seen.has(key) || !isProbedScene({ tree: null, js })) return [];
    seen.add(key);
    const controls = CONTROLS.find(([code]) => flat(code) === key)?.[1] ?? '';
    return [{ name, js, controls }];
  });
}

function attribute(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

/** A 64×64 photo (a data: URL — the scene runs with no network) for scenes that read the region's img. */
function photo(): string {
  const png = new PNG({ width: 64, height: 64 });
  for (let at = 0; at < png.data.length; at += 4) {
    png.data[at] = (at / 4) % 64 < 32 ? 240 : 30;
    png.data[at + 1] = 160;
    png.data[at + 2] = 60;
    png.data[at + 3] = 255;
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;
}

const PHOTO = `<img alt="" width="64" height="64" src="${photo()}">`;

/** The region as the published page renders it: the code on its root, the taught layout. */
function taughtRegion(js: string, controls: string): string {
  return `<div data-ck-custom-code="" data-ck-js-id="probe" data-ck-js="${attribute(js)}"><section class="ck-scene"><div class="ck-text">${controls}${EXAMPLE_TREE}${PHOTO}</div></section></div>`;
}

/**
 * Real faults the probe found in the taught corpus (2026-10-12), kept visible until the example is
 * fixed — any OTHER finding fails the test. The "shader aurora" fragment shader declares
 * uInputSize/uOutputFrame without a precision, so Chromium refuses to link it ("Precisions of
 * uniform 'uInputSize' differ between VERTEX and FRAGMENT shaders") and the canvas stays empty;
 * starting it with 'precision highp float;' fixes it (probed clean).
 */
const KNOWN_FINDINGS: readonly RegExp[] = [
  /^craftkit\.pixi-v8-effects e\.g\. 1: scene-runtime: The scene threw "PixiJS Error: Could not initialize shader\."/u,
];

/* ── the broken corpus: written sections (trees), each wrong in one way a rule names ── */

interface TreeNode {
  readonly kind: 'element';
  readonly tag: string;
  readonly className?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly text?: string;
  readonly children: readonly TreeNode[];
}

function element(
  tag: string,
  className: string,
  children: readonly TreeNode[] = [],
  text?: string,
): TreeNode {
  return {
    kind: 'element',
    tag,
    ...(className === '' ? {} : { className }),
    ...(tag === 'button' ? { attributes: { type: 'button' } } : {}),
    ...(text === undefined ? {} : { text }),
    children,
  };
}

function section(children: readonly TreeNode[], css: string, js: string): SceneProbeSection {
  return {
    tree: { kind: 'root', children: [element('section', 'ck-scene', children)] },
    css,
    js,
  };
}

const BACKDROP = `const s=await ck.scene({seed:4});
const P=s.PIXI,bg=new P.Graphics(),sun=new P.Graphics();
s.stage.addChild(bg,sun);s.canvas.setAttribute('aria-hidden','true');
const layout=()=>{bg.clear().rect(0,0,s.width,s.height).fill(0x1e293b);sun.clear().circle(s.width*.7,s.height*.4,60).fill(0xfbbf24)};
layout();s.onResize(layout);`;

const COPY = [element('h2', '', [], 'Night falls'), element('button', '', [], 'Next')];

const BROKEN: readonly {
  readonly name: string;
  readonly section: SceneProbeSection;
  readonly code: string;
  readonly says: RegExp;
}[] = [
  {
    name: 'throws',
    section: section(
      [element('div', 'ck-text', [element('h2', '', [], 'Lights')])],
      TAUGHT_CSS,
      `${BACKDROP}\nhero.position.set(s.width/2,s.height/2);`,
    ),
    code: 'scene-runtime',
    says: /threw "hero is not defined" at js line 6 — define hero before use/u,
  },
  {
    name: 'blank',
    section: section(
      [],
      TAUGHT_CSS,
      `const s=await ck.scene({seed:1});\nconst P=s.PIXI,dot=new P.Graphics();\ns.stage.addChild(dot);`,
    ),
    code: 'scene-blank',
    says: /blank after .* draw something on the first frame/u,
  },
  {
    name: 'zero-height region',
    section: section([], '.ck-scene{position:relative}', BACKDROP),
    code: 'scene-height',
    says: /is 0px tall/u,
  },
  {
    name: 'controls under the canvas',
    section: section(
      [element('div', 'copy', COPY)],
      '.ck-scene{position:relative;width:100%;aspect-ratio:16/9;min-height:320px}.copy{padding:12px}',
      BACKDROP,
    ),
    code: 'scene-control',
    says: /"Next" button is under the canvas — give the text layer position:relative; z-index:1/u,
  },
  {
    name: 'a dead Start button',
    section: section(
      [element('div', 'ck-text', [element('button', '', [], 'Start')])],
      TAUGHT_CSS,
      BACKDROP,
    ),
    code: 'scene-control',
    says: /Clicking "Start" changed nothing/u,
  },
  {
    name: 'a canvas that stops short of the region',
    section: section([], TAUGHT_CSS, `${BACKDROP}\ns.canvas.style.height='35%';`),
    code: 'scene-layout',
    says: /leaves the region's lower \d+% empty/u,
  },
  {
    name: 'a stage sized by aspect-ratio and min-height alone (wider than a phone)',
    section: section([], CARD_STAGE, BACKDROP),
    code: 'scene-layout',
    says: /runs 179px past the screen's edge on a 390 px phone/u,
  },
];

/* ── the browser ── */

let browser: Browser | undefined;
let page: Page | undefined;
const pageErrors: string[] = [];

async function host(): Promise<Page> {
  if (page !== undefined) return page;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // The scene runs with no network: refuse it at the test boundary too.
  await page.route(/^https?:/u, (route) => route.abort());
  await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
  return page;
}

async function probe(
  input: { readonly html: string } | { readonly section: SceneProbeSection },
  budgetMs = BUDGET_MS,
): Promise<SceneProbeReport> {
  const on = await host();
  return probeScene({
    ...input,
    lang: 'en',
    // An html region brings no css of its own: the taught layout rides with the theme.
    themeCss: 'html' in input ? `${THEME}\n${TAUGHT_CSS}` : THEME,
    budgetMs,
    // The real browser runner, run inside the Playwright page (its signal stays undefined).
    runPass: (args: SceneProbeFrameArgs) => on.evaluate(runSceneProbeFrame, args),
  });
}

function summary(report: SceneProbeReport): string {
  return JSON.stringify(report, null, 1).slice(0, 6_000);
}

beforeAll(() => {
  pageErrors.length = 0;
});

afterAll(async () => {
  await browser?.close();
});

describe.skipIf(QA)('the scene probe in Chromium (creative-power Phase 2 E)', () => {
  it('runs every taught scene clean: no error, a drawn canvas, controls on top, no overflow', async () => {
    const scenes = taughtScenes();
    expect(scenes.length).toBeGreaterThan(8);
    const findings: string[] = [];
    for (const scene of scenes) {
      const report = await probe({ html: taughtRegion(scene.js, scene.controls) });
      const done = report.passes.filter(({ status }) => status === 'done');
      if (done.length === 0) findings.push(`${scene.name}: no pass finished — ${summary(report)}`);
      for (const issue of sceneProbeIssues(report, { js: scene.js })) {
        findings.push(`${scene.name}: ${issue.code}: ${issue.message}`);
      }
    }
    expect(findings.filter((line) => !KNOWN_FINDINGS.some((known) => known.test(line)))).toEqual(
      [],
    );
    expect(pageErrors).toEqual([]);
  }, 600_000);

  it.each(BROKEN.map((entry) => [entry.name, entry] as const))(
    'flags a scene with %s',
    async (_name, entry) => {
      const report = await probe({ section: entry.section });
      const issues = sceneProbeIssues(report, entry.section);
      const hit = issues.find(
        ({ code, message }) => code === entry.code && entry.says.test(message),
      );
      expect(
        hit,
        `${entry.name} → ${JSON.stringify(issues, null, 1)}\n${summary(report)}`,
      ).toBeDefined();
    },
    30_000,
  );

  it('clicks Start once on the desktop pass only, and finds the stage filling the region', async () => {
    const report = await probe({ html: taughtRegion(PIXI_GAME_EXAMPLE, PIXI_GAME_CONTROLS) });
    expect(report.status).toBe('done');
    expect(report.passes.map(({ pass }) => pass.name)).toEqual([
      'desktop',
      'mobile',
      'reduced-motion',
    ]);
    const [desktop, mobile] = report.passes;
    expect(desktop?.report?.click).toEqual({ label: 'Start', changed: true });
    expect(mobile?.report?.click).toBeNull();
    expect(desktop?.report?.canvas?.rect).toEqual(desktop?.report?.region);
    expect(mobile?.report?.canvas?.rect.width).toBe(390);
  }, 30_000);

  it('keeps to the default 6 s budget, skipping a pass it has no room for', async () => {
    const report = await probe({ html: taughtRegion(PIXI_MURAL_EXAMPLE, '') }, 6_000);
    expect(report.elapsedMs).toBeLessThan(6_000 + 800);
    expect([...report.passes.map(({ pass }) => pass.name), ...report.skipped].sort()).toEqual([
      'desktop',
      'mobile',
      'reduced-motion',
    ]);
    expect(report.passes[0]?.status).toBe('done');
  }, 30_000);
});
