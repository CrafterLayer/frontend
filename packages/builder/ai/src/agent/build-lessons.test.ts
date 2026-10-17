import { describe, expect, it } from 'vitest';

import type { AiContextProvider } from '@craftkit/builder-schema';

import {
  BUILD_LESSONS_PROVIDER_ID,
  MAX_BUILD_LESSONS,
  buildLessonsOf,
  learnFromRepair,
  lessonOf,
  repairedCheck,
} from './build-lessons';
import type { SectionCheckIssue } from './page-plan/types';
import { withBuildLessons } from './section-providers';

/*
  Build lessons (2026-10-13), unit by unit: the one line a fixed finding teaches, what counts as
  fixed, the dedupe by code and gist, the cap, and the fragment a starting writer is handed.
*/

const LIB_FX: SectionCheckIssue = {
  code: 'scene-lib',
  message:
    "List 'fx' in the scene's libs — write ck.scene({libs:['fx', …]}): the code uses s.lib.fx, but s.lib holds only the libraries ck.scene lists, so it is undefined.",
};
const LIB_ANIM: SectionCheckIssue = { ...LIB_FX, message: LIB_FX.message.replace(/fx/gu, 'anim') };
const DOM: SectionCheckIssue = {
  code: 'scene-dom',
  message:
    "Put data-game-action on the element the code means in the section's tree, or look up an attribute it has: the code queries [data-game-action], no element in the tree carries it, so the lookup returns null.",
};
const THROW: SectionCheckIssue = {
  code: 'scene-runtime',
  message:
    'The scene threw "hero is not defined" at js line 5 — define hero before use (or fix its spelling).',
  path: 'js line 5',
};
const SEEN: SectionCheckIssue = {
  code: 'scene-visual',
  message: 'Seen in the rendered section: the title sits on bright stars — add a scrim.',
};

function build(runId: string): { readonly runId: string } {
  return { runId };
}

function fragmentOf(providers: readonly AiContextProvider[]) {
  const provider = providers.find(({ id }) => id === BUILD_LESSONS_PROVIDER_ID);
  return provider?.collect({} as never, []);
}

describe('lessonOf', () => {
  it('teaches one fixed line per code, or the finding’s own instruction where it names the thing', () => {
    expect(lessonOf(LIB_FX)?.text).toBe(
      "scene-lib: list every library the code uses as s.lib.<key> in ck.scene({libs:['<key>', …]}), written literally — s.lib holds only those",
    );
    // Every scene-lib finding teaches the same lesson: one key for both.
    expect(lessonOf(LIB_ANIM)?.key).toBe(lessonOf(LIB_FX)?.key);
    expect(lessonOf(DOM)?.text).toBe(
      "scene-dom: put data-game-action on the element the code means in the section's tree, or look up an attribute it has",
    );
    expect(lessonOf(THROW)?.text).toBe(
      'scene-runtime: define hero before use (or fix its spelling)',
    );
    // What the model saw is never looked at again after the repair: it never becomes a lesson.
    expect(lessonOf(SEEN)).toBeUndefined();
  });
});

describe('learnFromRepair', () => {
  it('keeps a lesson for each finding the repair fixed, once, in the order learned', () => {
    const run = build('lessons-unit-1');
    learnFromRepair(run, [LIB_FX, DOM, SEEN], [DOM]);
    expect(buildLessonsOf(run)).toEqual([lessonOf(LIB_FX)?.text]);
    // The same lesson from another section is not kept twice; a new one joins after it.
    learnFromRepair(run, [LIB_ANIM, THROW], []);
    expect(buildLessonsOf(run)).toEqual([lessonOf(LIB_FX)?.text, lessonOf(THROW)?.text]);
    // Another build learns nothing from this one.
    expect(buildLessonsOf(build('lessons-unit-2'))).toEqual([]);
  });

  it('keeps at most six', () => {
    const run = build('lessons-unit-cap');
    const issues = Array.from({ length: 9 }, (_, at): SectionCheckIssue => ({
      code: 'scene-forbidden',
      message: `Remove thing number ${String(at)}: it is not allowed.`,
    }));
    learnFromRepair(run, issues, []);
    expect(buildLessonsOf(run)).toHaveLength(MAX_BUILD_LESSONS);
  });

  it('reports the repaired check as before while it learns', () => {
    const run = build('lessons-unit-check');
    expect(repairedCheck(run, [LIB_FX], [])).toEqual({ issues: [], repaired: true });
    expect(buildLessonsOf(run)).toHaveLength(1);
  });
});

describe('withBuildLessons (the section providers seam)', () => {
  it('adds the lessons so far as one data fragment, only once there are any', () => {
    const run = build('lessons-unit-seam');
    const own: AiContextProvider = {
      id: 'craftkit:photo-catalog',
      collect: () => ({ title: 'Photos', body: '' }),
    };
    expect(withBuildLessons(run, [own])).toEqual([own]);

    learnFromRepair(run, [LIB_FX], []);
    const handed = withBuildLessons(run, [own]);
    expect(handed.map(({ id }) => id)).toEqual([
      'craftkit:photo-catalog',
      BUILD_LESSONS_PROVIDER_ID,
    ]);
    expect(fragmentOf(handed)).toEqual({
      source: BUILD_LESSONS_PROVIDER_ID,
      kind: 'data',
      trust: 'reviewed',
      title: 'Lessons from this build so far',
      body: `Earlier sections of THIS page were sent back for these and fixed in their repair round. Get them right the first time:\n- ${lessonOf(LIB_FX)?.text ?? ''}`,
    });
    // Fixed when the writer starts: a lesson learned afterwards is not in its fragment.
    learnFromRepair(run, [DOM], []);
    expect(fragmentOf(handed)?.body).not.toContain('scene-dom');
    expect(fragmentOf(withBuildLessons(run, []))?.body).toContain('scene-dom');
    // A host that already serves the fragment keeps its own.
    expect(withBuildLessons(run, handed)).toBe(handed);
  });
});
