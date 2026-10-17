import { afterEach, describe, expect, it, vi } from 'vitest';

import { AI_SCENE_REVIEW_MAX_IMAGE_CHARS, type AiSceneReview } from '../provider/scene-review-wire';
import type { AiPlanProvider } from '../types';
import type { PagePlan, SectionContract } from './page-plan/types';
import type { SceneProbeReport, SceneProbeThumbnail } from './scene-probe';
import {
  SCENE_REVIEW_BUDGET_MS,
  claimSceneReview,
  reviewsScenes,
  sceneReviewFindings,
  sceneReviewIssues,
  sceneReviewRequest,
  type SceneCheckHost,
} from './scene-review';

/*
  Visual self-review (2026-10-13), unit by unit: which builds look, the request a probe's pictures
  make, the findings a verdict makes, and every way a look finds nothing.
*/

const CONTRACT: SectionContract = {
  key: 'garden',
  role: 'hero',
  title: 'The night garden',
  anchorId: 'garden',
  purpose: 'A playable garden where Layla collects fireflies.',
  mustSay: ['Open every evening'],
  mustNotRepeat: [],
};

const PLAN = {
  locale: { lang: 'ar', dir: 'rtl' },
  tokens: {
    bg: '#101820',
    surface: '#18242f',
    ink: '#f5f1e8',
    muted: '#b8b2a7',
    accent: '#f2c14e',
    onAccent: '#101820',
  },
} as unknown as PagePlan;

const DESKTOP: SceneProbeThumbnail = {
  dataUrl: 'data:image/jpeg;base64,REVTSw==',
  width: 640,
  height: 360,
  ink: 0.4,
};

function report(desktop: unknown = DESKTOP, phone?: unknown): SceneProbeReport {
  const frame = (thumbnail: unknown) => ({
    region: null,
    canvas: null,
    controls: [],
    overflowX: 0,
    blank: false,
    fps: 60,
    errors: [],
    click: null,
    hidden: false,
    settledMs: 900,
    waitedMs: 100,
    ranMs: 700,
    thumbnail: thumbnail as SceneProbeThumbnail,
  });
  return {
    status: 'done',
    expectCanvas: true,
    stylesComplete: true,
    passes: [
      {
        status: 'done',
        report: frame(desktop),
        pass: { name: 'desktop', width: 1280, reducedMotion: false },
      },
      ...(phone === undefined
        ? []
        : [
            {
              status: 'done',
              report: frame(phone),
              pass: { name: 'mobile', width: 390, reducedMotion: false },
            },
          ]),
    ],
    skipped: [],
    elapsedMs: 900,
  };
}

function host(
  review?: AiPlanProvider['reviewScene'],
  over: Partial<SceneCheckHost> = {},
): SceneCheckHost {
  return {
    runId: `review-unit-${String(Math.random())}`,
    provider: {
      propose: () => Promise.reject(new Error('not here')),
      ...(review === undefined ? {} : { reviewScene: review }),
    },
    request: 'A night garden game where a girl named Layla collects fireflies',
    freeCode: true,
    sceneProbe: () => Promise.resolve(report()),
    ...over,
  };
}

const WRONG: AiSceneReview = {
  ok: false,
  findings: [
    { problem: 'The heading sits on bright fireflies.', fix: 'Add a dark scrim behind it.' },
    { where: 'phone', problem: 'Layla is missing', fix: 'Draw Layla in the foreground' },
    { problem: '   ', fix: 'Nothing to fix' },
  ],
};

afterEach(() => {
  vi.useRealTimers();
});

describe('reviewsScenes / claimSceneReview', () => {
  it('looks only with free code, a probe and a provider that can see — unless told not to', () => {
    const review = () => Promise.resolve(WRONG);
    expect(reviewsScenes(host(review))).toBe(true);
    expect(reviewsScenes(host())).toBe(false);
    expect(reviewsScenes(host(review, { visualReview: false }))).toBe(false);
    expect(reviewsScenes(host(review, { freeCode: false }))).toBe(false);
    expect(reviewsScenes(host(review, { sceneProbe: undefined }))).toBe(false);
    expect(reviewsScenes(undefined)).toBe(false);
  });

  it('claims one look per section per build', () => {
    const build = host(() => Promise.resolve(WRONG));
    expect(claimSceneReview(build, 'garden')).toBe(true);
    expect(claimSceneReview(build, 'garden')).toBe(false);
    expect(claimSceneReview(build, 'maze')).toBe(true);
    expect(claimSceneReview({ ...build, runId: 'another-build' }, 'garden')).toBe(true);
  });
});

describe('sceneReviewRequest', () => {
  it('sends the desktop picture, the phone’s, the contract, the palette and the cast', () => {
    const phone = { ...DESKTOP, dataUrl: 'data:image/png;base64,UEhPTkU=', width: 201 };
    const request = sceneReviewRequest(host(), PLAN, CONTRACT, report(DESKTOP, phone));
    expect(request).toMatchObject({
      image: { mediaType: 'image/jpeg', base64: 'REVTSw==', width: 640, height: 360 },
      phone: { mediaType: 'image/png', base64: 'UEhPTkU=', width: 201, height: 360 },
      contract: {
        title: 'The night garden',
        purpose: CONTRACT.purpose,
        mustSay: ['Open every evening'],
      },
      lang: 'ar',
    });
    expect(request?.brief?.palette).toEqual([
      'bg #101820',
      'surface #18242f',
      'ink #f5f1e8',
      'muted #b8b2a7',
      'accent #f2c14e',
      'on-accent #101820',
    ]);
    expect(request?.brief?.cast?.join(' ')).toContain('Layla');
  });

  it('has nothing to ask without a desktop picture that shows something', () => {
    expect(sceneReviewRequest(host(), PLAN, CONTRACT, null)).toBeUndefined();
    expect(sceneReviewRequest(host(), PLAN, CONTRACT, report(null))).toBeUndefined();
    expect(
      sceneReviewRequest(host(), PLAN, CONTRACT, report({ ...DESKTOP, ink: 0 })),
    ).toBeUndefined();
    const forged = { ...DESKTOP, dataUrl: 'https://example.test/shot.jpg' };
    expect(sceneReviewRequest(host(), PLAN, CONTRACT, report(forged))).toBeUndefined();
    // A phone picture that would pass the size cap is left out; the desktop one is enough.
    const big = {
      ...DESKTOP,
      dataUrl: `data:image/jpeg;base64,${'A'.repeat(AI_SCENE_REVIEW_MAX_IMAGE_CHARS - 4)}`,
    };
    expect(sceneReviewRequest(host(), PLAN, CONTRACT, report(big, DESKTOP))?.phone).toBeUndefined();
  });
});

describe('sceneReviewIssues', () => {
  it('words each finding as the fix the repair round reads; nothing when it looks right', () => {
    expect(sceneReviewIssues(WRONG)).toEqual([
      {
        code: 'scene-visual',
        message:
          'Seen in the rendered section: The heading sits on bright fireflies — Add a dark scrim behind it.',
      },
      {
        code: 'scene-visual',
        message:
          'Seen in the rendered section on a 390 px phone: Layla is missing — Draw Layla in the foreground.',
      },
    ]);
    expect(sceneReviewIssues({ ok: true, findings: WRONG.findings })).toEqual([]);
    const many = Array.from({ length: 8 }, (_, at) => ({ problem: `P${String(at)}`, fix: 'F' }));
    expect(sceneReviewIssues({ ok: false, findings: many })).toHaveLength(5);
  });
});

describe('sceneReviewFindings', () => {
  it('asks the provider with the probe’s pictures and returns what it saw', async () => {
    const review = vi.fn(() => Promise.resolve(WRONG));
    const issues = await sceneReviewFindings(host(review), PLAN, CONTRACT, report());
    expect(review).toHaveBeenCalledTimes(1);
    expect(issues.map(({ code }) => code)).toEqual(['scene-visual', 'scene-visual']);
  });

  it('finds nothing when the review fails, never answers, or the build was stopped', async () => {
    const failing = () => Promise.reject(new Error('cannot see'));
    expect(await sceneReviewFindings(host(failing), PLAN, CONTRACT, report())).toEqual([]);

    const stopped = new AbortController();
    stopped.abort();
    const review = vi.fn(() => Promise.resolve(WRONG));
    expect(
      await sceneReviewFindings(host(review, { signal: stopped.signal }), PLAN, CONTRACT, report()),
    ).toEqual([]);
    expect(review).not.toHaveBeenCalled();

    vi.useFakeTimers();
    const pending = sceneReviewFindings(
      host(() => new Promise<AiSceneReview>(() => undefined)),
      PLAN,
      CONTRACT,
      report(),
    );
    await vi.advanceTimersByTimeAsync(SCENE_REVIEW_BUDGET_MS + 10);
    await expect(pending).resolves.toEqual([]);
  });
});
