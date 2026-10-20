import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LandedSection } from './page-plan/types';
import {
  SCENE_PROBE_TIMEOUT_MS,
  isProbedScene,
  sceneProbeFindings,
  sceneProbeIssues,
  type SceneProbeFrame,
  type SceneProbePassReport,
  type SceneProbeReport,
} from './scene-probe';

/*
  What running a scene found, worded as the fixes (creative-power Phase 2 E, 2026-10-12). The
  reports here are shaped like `@craftkit/builder-renderer`'s `probeScene` resolves to; the
  browser test (apps/evals pixi-creative/probe.browser.test.ts) produces real ones.
*/

const REGION = { x: 0, y: 0, width: 1280, height: 720 };

function frame(over: Partial<SceneProbeFrame> = {}): SceneProbeFrame {
  return {
    region: REGION,
    canvas: { rect: REGION },
    controls: [],
    overflowX: 0,
    blank: false,
    fps: 60,
    errors: [],
    click: null,
    hidden: false,
    settledMs: 900,
    waitedMs: 200,
    ranMs: 700,
    ...over,
  };
}

type PassName = 'desktop' | 'mobile' | 'reduced-motion';

function pass(report: SceneProbeFrame | null, name: PassName = 'desktop'): SceneProbePassReport {
  return {
    status: report === null ? 'timeout' : 'done',
    report,
    pass: {
      name,
      width: name === 'mobile' ? 390 : 1280,
      reducedMotion: name === 'reduced-motion',
    },
  };
}

function probed(
  passes: readonly SceneProbePassReport[],
  over: Partial<SceneProbeReport> = {},
): SceneProbeReport {
  return {
    status: 'done',
    expectCanvas: true,
    stylesComplete: true,
    passes,
    skipped: [],
    elapsedMs: 3_000,
    ...over,
  };
}

const SCENE = 'const s=await ck.scene({});\nconst g=new s.PIXI.Graphics();\ns.stage.addChild(g);';

function codes(report: SceneProbeReport, js = SCENE): string[] {
  return sceneProbeIssues(report, { js }).map(({ code }) => code);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('isProbedScene', () => {
  it('runs only code that opens a Pixi stage', () => {
    expect(isProbedScene({ tree: null, js: 'const s=await ck.scene({seed:1});' })).toBe(true);
    expect(isProbedScene({ tree: null, js: 'const {app}=await ck.stage();' })).toBe(true);
    expect(isProbedScene({ tree: null, js: "ck.root.classList.add('on')" })).toBe(false);
    expect(isProbedScene({ tree: null, js: 'const P=await ck.pixi();' })).toBe(false);
    expect(isProbedScene({ tree: null })).toBe(false);
  });
});

describe('sceneProbeIssues', () => {
  it('finds nothing in a clean run, a report that measured nothing, or no report at all', () => {
    expect(sceneProbeIssues(probed([pass(frame()), pass(frame(), 'mobile')]))).toEqual([]);
    expect(sceneProbeIssues(probed([], { status: 'unavailable' }))).toEqual([]);
    expect(sceneProbeIssues(probed([pass(null)]))).toEqual([]);
    expect(sceneProbeIssues(null)).toEqual([]);
    expect(sceneProbeIssues(undefined)).toEqual([]);
    expect(sceneProbeIssues({} as SceneProbeReport)).toEqual([]);
  });

  it('words a thrown error as the fix, with its line — once, however many passes saw it', () => {
    const thrown = frame({ errors: [{ message: 'x is not defined', line: 12 }] });
    const issues = sceneProbeIssues(probed([pass(thrown), pass(thrown, 'mobile')]));
    expect(issues).toEqual([
      {
        code: 'scene-runtime',
        message:
          'The scene threw "x is not defined" at js line 12 — define x before use (or fix its spelling).',
        path: 'js line 12',
      },
    ]);
  });

  it('points each kind of error at its fix', () => {
    const messages = (message: string, line: number | null = null) =>
      sceneProbeIssues(probed([pass(frame({ errors: [{ message, line }] }), 'mobile')]))[0];
    const nullish = messages("Cannot read properties of null (reading 'textContent')", 4);
    expect(nullish?.message).toContain('at js line 4 on a 390 px phone');
    expect(nullish?.message).toContain('the value before .textContent is null there');
    expect(messages('fx.burst is not a function')?.message).toContain(
      'call only what ck, s and the listed libraries provide',
    );
    expect(messages("Cannot access 'hero' before initialization")?.message).toContain(
      'declare hero above the line that uses it',
    );
    const shader = messages('PixiJS Error: Could not initialize shader.');
    expect(shader?.message).toContain("start the fragment shader with 'precision highp float;'");
    expect(shader?.path).toBeUndefined();
    expect(messages('boom')?.message).toContain('fix the code at that line');
  });

  it('flags a blank canvas only when the scene ran long enough and its code draws on the stage', () => {
    const blank = frame({ blank: true, settledMs: 1_000 });
    expect(sceneProbeIssues(probed([pass(blank)]), { js: SCENE })).toEqual([
      {
        code: 'scene-blank',
        message:
          'The canvas is blank after 1.0 s — draw something on the first frame (a background and the main shapes), not only after a click or a timer.',
      },
    ]);
    expect(codes(probed([pass(frame({ blank: true, ranMs: 100 }))]))).toEqual([]);
    // An Ink dialogue box over an empty stage draws in the DOM, not on the canvas.
    const ink =
      "const s=await ck.scene({libs:['ink']});const box=s.lib.dialogue.view(t,{root:ck.root});";
    expect(codes(probed([pass(blank)]), ink)).toEqual([]);
    expect(codes(probed([pass(frame({ blank: true, hidden: true }))]))).toEqual([]);
    const still = sceneProbeIssues(probed([pass(blank, 'reduced-motion')]), { js: SCENE });
    expect(still[0]?.message).toContain('stays blank under reduced motion');
    expect(still[0]?.message).toContain('s.app.render()');
  });

  it('flags a stage that never appeared only after a full wait, and never beside an error', () => {
    const none = frame({ canvas: null, waitedMs: 2_000 });
    expect(sceneProbeIssues(probed([pass(none)]))[0]).toMatchObject({
      code: 'scene-blank',
      message: expect.stringContaining('no canvas appeared within 2.0 s') as string,
    });
    expect(codes(probed([pass(frame({ canvas: null, waitedMs: 600 }))]))).toEqual([]);
    expect(codes(probed([pass(none)], { expectCanvas: false }))).toEqual([]);
    expect(
      codes(
        probed([
          pass(frame({ canvas: null, waitedMs: 2_000, errors: [{ message: 'e', line: 1 }] })),
        ]),
      ),
    ).toEqual(['scene-runtime']);
  });

  it('flags a region with no height, and a canvas that stops short of the region', () => {
    const flat = frame({
      region: { ...REGION, height: 0 },
      canvas: { rect: { ...REGION, height: 0 } },
    });
    const [height] = sceneProbeIssues(probed([pass(flat)]));
    expect(height?.code).toBe('scene-height');
    expect(height?.message).toContain('The region is 0px tall');
    expect(height?.message).toContain('width:100%;aspect-ratio:16/9;min-height:320px');

    const short = frame({ canvas: { rect: { ...REGION, height: 432 } } });
    expect(sceneProbeIssues(probed([pass(short)]))).toEqual([
      {
        code: 'scene-layout',
        message:
          "The canvas leaves the region's lower 40% empty — size the stage from the region (s.width/s.height; no fixed stage size) and re-lay out on resize (s.onResize).",
      },
    ]);
    const narrow = frame({ canvas: { rect: { ...REGION, width: 640 } } });
    expect(sceneProbeIssues(probed([pass(narrow)]))[0]?.message).toContain('right 50% empty');
    expect(codes(probed([pass(frame({ canvas: { rect: { ...REGION, height: 700 } } }))]))).toEqual(
      [],
    );
  });

  it('accepts an intentional narrative runway but still reports real width gaps and crashes', () => {
    const pinned = frame({
      region: { ...REGION, height: 2880 },
      canvas: { rect: REGION, scrollPinned: true },
    });
    expect(sceneProbeIssues(probed([pass(pinned)]))).toEqual([]);
    const narrow = { ...pinned, canvas: { rect: { ...REGION, width: 640 }, scrollPinned: true } };
    expect(sceneProbeIssues(probed([pass(narrow)]))[0]?.message).toContain('right 50% empty');
    const broken = { ...pinned, errors: [{ message: 'hero is not defined', line: 5 }] };
    expect(codes(probed([pass(broken)]))).toContain('scene-runtime');
    const ordinary = { ...pinned, canvas: { rect: REGION } };
    expect(sceneProbeIssues(probed([pass(ordinary)]))[0]?.message).toContain('lower 75% empty');
  });

  it('flags controls under the canvas, under something else, or outside the region', () => {
    const controls = frame({
      controls: [
        { label: 'Next', tag: 'button', outside: false, covered: 'canvas' },
        { label: 'Read more', tag: 'a', outside: false, covered: 'other' },
        { label: 'Your name', tag: 'input', outside: true, covered: null },
        { label: 'Fine', tag: 'button', outside: false, covered: null },
      ],
    });
    expect(sceneProbeIssues(probed([pass(controls, 'mobile')]))).toEqual([
      {
        code: 'scene-layout',
        message:
          'The "Your name" field sits outside the region on a 390 px phone — keep the controls inside the section: no negative offsets, no fixed widths wider than the screen.',
      },
      {
        code: 'scene-control',
        message:
          'The "Next" button is under the canvas on a 390 px phone — give the text layer position:relative; z-index:1 so it sits above the stage.',
      },
      {
        code: 'scene-control',
        message:
          'The "Read more" link is covered by another element on a 390 px phone — move it, or lift it with position:relative; z-index:1.',
      },
    ]);
  });

  it('flags a page that scrolls sideways, and a Start that changes nothing', () => {
    const wide = frame({ overflowX: 179 });
    expect(sceneProbeIssues(probed([pass(wide, 'mobile')]))[0]?.message).toBe(
      "The page runs 179px past the screen's edge on a 390 px phone — size the section with % or max-width:100% (no fixed widths), so it never scrolls sideways.",
    );
    expect(codes(probed([pass(frame({ overflowX: 3 }), 'mobile')]))).toEqual([]);
    const dead = frame({ click: { label: 'Start', changed: false } });
    expect(sceneProbeIssues(probed([pass(dead)]))[0]).toMatchObject({
      code: 'scene-control',
      message: expect.stringContaining('Clicking "Start" changed nothing') as string,
    });
    expect(codes(probed([pass(frame({ click: { label: 'Start', changed: null } }))]))).toEqual([]);
    expect(codes(probed([pass(frame({ click: { label: 'Start', changed: true } }))]))).toEqual([]);
  });

  it('says nothing about layout when the region’s classes had no CSS', () => {
    const wrong = frame({
      region: { ...REGION, height: 0 },
      overflowX: 200,
      controls: [{ label: 'Next', tag: 'button', outside: true, covered: 'canvas' }],
    });
    expect(codes(probed([pass(wrong)], { stylesComplete: false }))).toEqual([]);
  });

  it('puts errors first and sends at most six', () => {
    const many = frame({
      overflowX: 50,
      blank: true,
      controls: ['A', 'B', 'C', 'D', 'E', 'F'].map((label) => ({
        label,
        tag: 'button',
        outside: false,
        covered: 'canvas' as const,
      })),
      errors: [{ message: 'late boom', line: 9 }],
    });
    const issues = sceneProbeIssues(probed([pass(many)]));
    expect(issues).toHaveLength(6);
    expect(issues[0]?.code).toBe('scene-runtime');
    expect(Object.isFrozen(issues)).toBe(true);
  });
});

describe('sceneProbeFindings', () => {
  const section: LandedSection = { tree: null, js: SCENE };
  const context = { lang: 'ar', dir: 'rtl' as const };

  it('runs the probe with the page’s language and words its report', async () => {
    const probe = vi.fn(() =>
      Promise.resolve(
        probed([pass(frame({ errors: [{ message: 'x is not defined', line: 2 }] }))]),
      ),
    );
    const issues = await sceneProbeFindings(probe, section, context);
    expect(probe).toHaveBeenCalledWith(section, context);
    expect(issues.map(({ path }) => path)).toEqual(['js line 2']);
  });

  it('finds nothing when the probe throws, rejects, or never answers', async () => {
    expect(
      await sceneProbeFindings(
        () => {
          throw new Error('no DOM');
        },
        section,
        context,
      ),
    ).toEqual([]);
    expect(
      await sceneProbeFindings(() => Promise.reject(new Error('x')), section, context),
    ).toEqual([]);
    vi.useFakeTimers();
    const pending = sceneProbeFindings(() => new Promise(() => undefined), section, context);
    await vi.advanceTimersByTimeAsync(SCENE_PROBE_TIMEOUT_MS + 1);
    expect(await pending).toEqual([]);
  });
});
