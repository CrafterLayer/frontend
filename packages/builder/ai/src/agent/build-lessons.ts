import type { AiContextProvider } from '@craftkit/builder-schema';

import { buildMemoryOf } from './build-memory';
import type { SectionCheckCode, SectionCheckIssue } from './page-plan/types';
import type { AiBuildSectionCheck } from './types';

/*
  Build lessons (2026-10-13): the writers of ONE build learn from each other. When a section's
  checks (or its scene run) find a mistake and that section's ONE repair round fixes it, the
  build keeps a one-line lesson — "scene-lib: list every library the code uses in
  ck.scene({libs:[…]})" — and every writer that STARTS later in the same build is handed the
  lessons so far as a data fragment (section-providers.ts `withBuildLessons`). Writers run in
  parallel, so a lesson reaches only those that start after it was learned; on a page whose
  writers make the same mistake, each later one is spared the repair round it would cost.

  Deterministic and free: no model call, the lesson's words are fixed per finding code (or, for
  a code whose findings name the thing to fix, the finding's own instruction), deduplicated by
  code and gist, at most six. A lesson is only learned from a fix the checks VERIFIED: what the
  model saw in a picture (`scene-visual`) is not looked at again after the repair, so it never
  becomes one.
*/

/** The most lessons a build keeps, and the most lines a writer is handed. */
export const MAX_BUILD_LESSONS = 6;
export const BUILD_LESSONS_PROVIDER_ID = 'craftkit:build-lessons';
const LESSON_MAX_CHARS = 170;

/** The lesson a finding of this code teaches, when one sentence covers every finding of it. */
const LESSON_BY_CODE: Partial<Readonly<Record<SectionCheckCode, string>>> = {
  'raw-colour':
    "colour with the page's tokens (ck-ink, ck-muted, ck-surface, ck-accent-fill; var(--ck-accent) in css), never raw hex or palette classes",
  'heading-level': "the page's one h1 is the hero's; every other section heads with h2",
  'cta-label':
    "every button that leads to the page's action is a link (a.ck-btn) labelled with the action's exact words",
  'missing-anchor':
    "put the section's own anchor id on its outer element, and link only to anchors the plan lists",
  'placeholder-left': "write finished, realistic copy — never XXX, 0000, lorem or a field's name",
  'foreign-image': "take image addresses only from PHOTOS YOU MAY USE (or the person's own)",
  contrast:
    "keep text on its ground's own colour (ck-ink or ck-muted inside ck-ground, ck-surface, ck-inverse or ck-accent-fill)",
  'must-say': 'carry every MUST SAY claim of the contract, in its words or close to them',
  repeats: 'never repeat a claim the contract lists under MUST NOT REPEAT',
  'foreign-font': "use only the page's two fonts, the plan's display and body faces",
  'scene-syntax':
    'the js is the body of async (ck)=>{…} and must parse on its own: balanced brackets and quotes, no import or export',
  'scene-lib':
    "list every library the code uses as s.lib.<key> in ck.scene({libs:['<key>', …]}), written literally — s.lib holds only those",
  'scene-height':
    'give a scene region a height in its css, e.g. .ck-scene{position:relative;aspect-ratio:16/9;min-height:320px}',
  'scene-cleanup':
    'release every listener, interval, observer and ticker in ck.onDispose (s.dispose under ck.scene), or animate on s.tick',
  'scene-guard':
    'when ck.reducedMotion (s.reducedMotion) is true, draw one finished frame and start no loop',
  'scene-text': 'keep Arabic text whole (s.words or s.text, or the DOM), never split into letters',
  'scene-params': 'read every jsParams setting through ck.params({…}), with a default for each',
  'scene-blank':
    'draw the first frame at once (a background and the main shapes), and a finished still frame under reduced motion',
  'scene-layout':
    'size the stage from the region (s.width/s.height, no fixed sizes), re-lay out on s.onResize, never scroll sideways',
  'scene-control':
    'keep scene controls above the canvas (position:relative; z-index:1) and wire their clicks inside ck.root',
};

/** Findings that never become lessons: the build does not check them again after the repair. */
const UNVERIFIED: ReadonlySet<SectionCheckCode> = new Set<SectionCheckCode>(['scene-visual']);

/**
 * The instruction a finding of a code without a fixed lesson carries: for a run's finding
 * ("The scene threw … — define x before use") the part after the dash, else its first clause.
 */
function gistOf(issue: SectionCheckIssue): string {
  const message = issue.message.replace(/\s+/gu, ' ').trim();
  const dash = message.indexOf(' — ');
  const instruction =
    issue.code === 'scene-runtime' && dash !== -1
      ? message.slice(dash + 3)
      : (message.split(/: | — /u)[0] ?? message);
  const clean = instruction.replace(/[.\s]+$/u, '');
  const first = clean.charAt(0).toLowerCase() + clean.slice(1);
  return first.length > LESSON_MAX_CHARS ? `${first.slice(0, LESSON_MAX_CHARS - 1)}…` : first;
}

/** A finding's lesson and the key it is deduplicated by (its code and gist); none for some. */
export function lessonOf(
  issue: SectionCheckIssue,
): { readonly key: string; readonly text: string } | undefined {
  if (UNVERIFIED.has(issue.code)) return undefined;
  const gist = LESSON_BY_CODE[issue.code] ?? gistOf(issue);
  if (gist === '') return undefined;
  const key = `${issue.code}|${gist
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()}`;
  return { key, text: `${issue.code}: ${gist}` };
}

/**
 * Learn from one section's repair round: every finding of the first answer that the repaired
 * answer no longer has (by code and gist) is a lesson, kept once, at most `MAX_BUILD_LESSONS`.
 */
export function learnFromRepair(
  build: { readonly runId: string },
  issues: readonly SectionCheckIssue[],
  remaining: readonly SectionCheckIssue[],
): void {
  const { lessons } = buildMemoryOf(build);
  const left = new Set(remaining.map((issue) => lessonOf(issue)?.key));
  for (const issue of issues) {
    const lesson = lessonOf(issue);
    if (lesson === undefined || left.has(lesson.key) || lessons.has(lesson.key)) continue;
    if (lessons.size >= MAX_BUILD_LESSONS) return;
    lessons.set(lesson.key, lesson.text);
  }
}

/**
 * The report of a section whose repair was kept (run-build's `checkAndRepair`), learning from
 * it on the way: what is left is reported, what was fixed is a lesson for the writers after.
 */
export function repairedCheck(
  build: { readonly runId: string },
  issues: readonly SectionCheckIssue[],
  remaining: readonly SectionCheckIssue[],
): AiBuildSectionCheck {
  try {
    learnFromRepair(build, issues, remaining);
  } catch {
    // A lesson is advice: failing to keep one never costs the section.
  }
  return Object.freeze({ issues: remaining, repaired: true });
}

/** The lessons this build has learned so far, oldest first. */
export function buildLessonsOf(build: { readonly runId: string }): readonly string[] {
  return [...buildMemoryOf(build).lessons.values()];
}

/** The lessons as one writer's data fragment, fixed at the moment the writer starts. */
export function createBuildLessonsProvider(lessons: readonly string[]): AiContextProvider {
  const lines = lessons.slice(0, MAX_BUILD_LESSONS).map((lesson) => `- ${lesson}`);
  return {
    id: BUILD_LESSONS_PROVIDER_ID,
    collect() {
      return {
        source: BUILD_LESSONS_PROVIDER_ID,
        kind: 'data',
        trust: 'reviewed',
        title: 'Lessons from this build so far',
        body: [
          'Earlier sections of THIS page were sent back for these and fixed in their repair round. Get them right the first time:',
          ...lines,
        ].join('\n'),
      };
    },
  };
}
