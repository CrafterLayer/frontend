import { describe, expect, it, vi } from 'vitest';

import { createCachingAiPlanProvider } from '../provider/caching-provider';
import type { AiSceneReview, AiSceneReviewRequest } from '../provider/scene-review-wire';
import { scenePreset } from '../scene-presets/catalog';
import type { AiPlanProvider } from '../types';
import type { LandedSection, PagePlan, SectionContract } from './page-plan/types';
import type { SceneProbe, SceneProbeContext, SceneProbeReport } from './scene-probe';
import type { SceneCheckHost } from './scene-review';
import { sceneReviewSourceKey, testedScenePreset } from './scene-review-economy';
import { checkWritten } from './section-candidate';

/*
  What a scene review no longer pays for (2026-10-13): a scene whose code is a catalogued preset
  or kit unchanged is run but not looked at, and the same section looked at again reuses its
  verdict through the caching provider. The last test is the representative build the cost
  report is measured on: no model is called, the provider is a counting fake.
*/

function presetCode(id: string): string {
  const preset = scenePreset(id);
  if (preset === undefined) throw new Error(`no preset ${id}`);
  return preset.code;
}

const MURAL = presetCode('flow-field-silk');
const ARCADE = presetCode('arcade');
/** A scene a writer wrote: it opens a stage, and no catalogue has it. */
const WRITTEN =
  "const s=await ck.scene({libs:['fx']});\nconst fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion});\nif(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));\ns.dispose(()=>fx.dispose());";
const CSS = '.ck-scene{position:relative;aspect-ratio:16/9;min-height:320px}';

function section(
  js: string,
  heading = 'Roasted this morning',
  jsParams?: NonNullable<LandedSection['jsParams']>,
): LandedSection {
  return {
    tree: {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'ck-scene py-16',
          attributes: { id: 'hero' },
          children: [{ kind: 'element', tag: 'h2', text: heading, children: [] }],
        },
      ],
    },
    css: CSS,
    js,
    ...(jsParams === undefined ? {} : { jsParams }),
  };
}

describe('testedScenePreset', () => {
  it('knows a preset or a kit by its code, byte for byte, whatever tree a writer gave it', () => {
    expect(testedScenePreset(section(MURAL))?.id).toBe('flow-field-silk');
    expect(testedScenePreset(section(ARCADE))?.category).toBe('game');
    // As scene.preset lands one in the edit lane: params inside the preset's own spec.
    expect(testedScenePreset(section(MURAL, 'x', { seed: 42, speed: 0.5 }))?.id).toBe(
      'flow-field-silk',
    );
  });

  it('looks at everything edited or written: one character of code, a param outside the spec', () => {
    expect(testedScenePreset(section(WRITTEN))).toBeUndefined();
    expect(testedScenePreset(section(`${MURAL}\n`))).toBeUndefined();
    expect(testedScenePreset(section(MURAL.replace('ck.scene', 'ck.stage')))).toBeUndefined();
    expect(testedScenePreset(section(MURAL, 'x', { seed: 0 }))).toBeUndefined();
    expect(testedScenePreset(section(MURAL, 'x', { glitter: true }))).toBeUndefined();
    expect(testedScenePreset(section(MURAL, 'x', ['seed']))).toBeUndefined();
    expect(testedScenePreset({ tree: null })).toBeUndefined();
  });
});

const CONTRACT: SectionContract = {
  key: 'hero',
  role: 'hero',
  title: 'Roasted this morning',
  anchorId: 'hero',
  purpose: 'Say what the roastery is.',
  mustSay: [],
  mustNotRepeat: [],
};

const DESKTOP_ONLY: Omit<AiSceneReviewRequest, 'sourceKey'> = {
  image: { mediaType: 'image/jpeg', base64: 'REVTSw==', width: 640, height: 360 },
  contract: { title: CONTRACT.title, purpose: CONTRACT.purpose, mustSay: [] },
  brief: { palette: ['bg #fafaf9'] },
  lang: 'en',
};
const REQUEST: Omit<AiSceneReviewRequest, 'sourceKey'> = {
  ...DESKTOP_ONLY,
  phone: { mediaType: 'image/jpeg', base64: 'UEhPTkU=', width: 201, height: 360 },
};

describe('sceneReviewSourceKey', () => {
  it('names what the pictures were drawn from, never the pictures themselves', () => {
    const key = sceneReviewSourceKey(section(WRITTEN), REQUEST);
    const redrawn = { ...REQUEST, image: { ...REQUEST.image, base64: 'T1RIRVI=' } };
    expect(sceneReviewSourceKey(section(WRITTEN), redrawn)).toBe(key);
    expect(sceneReviewSourceKey(section(WRITTEN, 'Another heading'), REQUEST)).not.toBe(key);
    expect(sceneReviewSourceKey(section(`${WRITTEN};`), REQUEST)).not.toBe(key);
    expect(sceneReviewSourceKey(section(WRITTEN), DESKTOP_ONLY)).not.toBe(key);
    expect(sceneReviewSourceKey(section(WRITTEN), { ...REQUEST, lang: 'ar' })).not.toBe(key);
  });
});

const WRONG: AiSceneReview = {
  ok: false,
  findings: [{ where: 'desktop', problem: 'The title is unreadable.', fix: 'Add a scrim' }],
};

describe('the caching provider and scene reviews', () => {
  it('remembers a verdict by its source key, and passes a review without one through', async () => {
    const inner = vi.fn(() => Promise.resolve(WRONG));
    const usage: unknown[] = [];
    const cached = createCachingAiPlanProvider({
      propose: () => Promise.reject(new Error('not here')),
      reviewScene: inner,
    });
    const keyed = { ...REQUEST, sourceKey: 'k1' };

    expect(await cached.reviewScene?.(keyed)).toEqual(WRONG);
    expect(await cached.reviewScene?.(keyed, { onUsage: (line) => usage.push(line) })).toEqual(
      WRONG,
    );
    expect(inner).toHaveBeenCalledTimes(1);
    expect(usage).toEqual([expect.objectContaining({ cached: true, inputTokens: 0 })]);

    await cached.reviewScene?.(REQUEST);
    await cached.reviewScene?.(REQUEST);
    expect(inner).toHaveBeenCalledTimes(3);
  });

  it('never remembers a refusal or a failure', async () => {
    const inner = vi
      .fn<NonNullable<AiPlanProvider['reviewScene']>>()
      .mockRejectedValueOnce(new Error('declined'))
      .mockResolvedValue(WRONG);
    const cached = createCachingAiPlanProvider({
      propose: () => Promise.reject(new Error('not here')),
      reviewScene: inner,
    });
    const keyed = { ...REQUEST, sourceKey: 'k2' };
    await expect(cached.reviewScene?.(keyed)).rejects.toThrow('declined');
    expect(await cached.reviewScene?.(keyed)).toEqual(WRONG);
    expect(inner).toHaveBeenCalledTimes(2);
  });
});

// ── the representative build, measured ──────────────────────────────────────

const PLAN = {
  locale: { lang: 'en', dir: 'ltr' },
  tokens: { bg: '#fafaf9', surface: '#ffffff', ink: '#1c1917', accent: '#065f46' },
  sections: [],
} as unknown as PagePlan;

const contract = (key: string, title: string): SectionContract => ({
  ...CONTRACT,
  key,
  anchorId: key,
  title,
  role: key === 'hero' ? 'hero' : 'band',
});

/** A probe that runs every scene cleanly and takes its pictures when asked. */
function probe(): { readonly run: SceneProbe; readonly runs: SceneProbeContext[] } {
  const runs: SceneProbeContext[] = [];
  const frame = (asked: boolean, width: number) => ({
    region: { x: 0, y: 0, width: 1280, height: 720 },
    canvas: { rect: { x: 0, y: 0, width: 1280, height: 720 } },
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
    ...(asked
      ? {
          // Each run draws a different frame: the key must not depend on it.
          thumbnail: {
            dataUrl: `data:image/jpeg;base64,${btoa(String(runs.length)).replace(/=+$/u, '')}`,
            width,
            height: 360,
            ink: 0.4,
          },
        }
      : {}),
  });
  const run: SceneProbe = (_section, context) => {
    runs.push(context);
    const asked = context.thumbnails === true;
    const report: SceneProbeReport = {
      status: 'done',
      expectCanvas: true,
      stylesComplete: true,
      passes: [
        {
          status: 'done',
          report: frame(asked, 640),
          pass: { name: 'desktop', width: 1280, reducedMotion: false },
        },
        {
          status: 'done',
          report: frame(asked, 201),
          pass: { name: 'mobile', width: 390, reducedMotion: false },
        },
      ],
      skipped: [],
      elapsedMs: 900,
    };
    return Promise.resolve(report);
  };
  return { run, runs };
}

/** One build's step E over its three scene sections, as run-build calls it. */
async function buildChecks(
  provider: AiPlanProvider,
  sceneProbe: SceneProbe,
  runId: string,
  sections: readonly (readonly [SectionContract, LandedSection])[],
): Promise<number> {
  const host: SceneCheckHost = {
    runId,
    provider,
    request: 'A roastery site with a playable game and a flowing mural',
    freeCode: true,
    sceneProbe,
  };
  let issues = 0;
  for (const [written, landed] of sections) {
    issues += (await checkWritten(PLAN, written, landed, { scene: host })).length;
  }
  return issues;
}

describe('a representative build: a written hero scene, a ready mural and a game kit', () => {
  it('pays for two looks in nine across a build, its identical re-run and a regenerate', async () => {
    const inner = vi.fn((request: AiSceneReviewRequest) => {
      expect(request.sourceKey).toMatch(/^[0-9a-f]{16}:\d+$/u);
      return Promise.resolve(WRONG);
    });
    // The session's provider, as planProviderFromEnv builds it: the cache outside the network.
    const session = createCachingAiPlanProvider({
      propose: () => Promise.reject(new Error('not here')),
      reviewScene: inner,
    });
    const { run, runs } = probe();
    const page = [
      [contract('hero', 'Roasted this morning'), section(WRITTEN)],
      [contract('mural', 'From bean to cup'), section(MURAL, 'From bean to cup')],
      [contract('game', 'Catch the beans'), section(ARCADE, 'Catch the beans')],
    ] as const;

    // Build 1: the hero is looked at; the ready mural and the kit are run, not looked at.
    expect(await buildChecks(session, run, 'build-1', page)).toBe(1);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(runs.map(({ thumbnails }) => thumbnails === true)).toEqual([true, false, false]);

    // The same build again (an identical re-run, or a rebuild after an undo): the verdict is reused.
    expect(await buildChecks(session, run, 'build-2', page)).toBe(1);
    expect(inner).toHaveBeenCalledTimes(1);

    // A regenerate whose hero came out differently: that one section is looked at again.
    const regenerated = [[page[0][0], section(`${WRITTEN}\n// warmer`)], page[1], page[2]] as const;
    expect(await buildChecks(session, run, 'build-3', regenerated)).toBe(1);
    expect(inner).toHaveBeenCalledTimes(2);
    // Every scene section was still run by the probe, every time.
    expect(runs).toHaveLength(9);
  });
});
