import {
  SCENE_PRESETS,
  scenePreset,
  type ScenePreset,
  type ScenePresetCategory,
} from '../scene-presets/catalog';
import type { AiContextProvider } from '@craftkit/builder-schema';

import { composesWithKit, MURAL_KIT_EDIT_LINE, MURAL_KIT_WRITER_LINE } from '../creative/mural-kit';
import { SCENE_INITIALIZATION_HEADER } from '../provider/scene-init-wire';
import type { AiPlan } from '../types';
import type { PagePlan, SectionContract } from './page-plan/types';
import { creativeRequestOf } from './section-providers';
import type { RunAiBuildOptions } from './types';

/*
  Ready scenes in a build (2026-10-13). The owner's murals failed on time: a scene writer wrote
  its whole Pixi scene by hand — thousands of output tokens of code inside a JSON string, the
  slowest write a build has — and a write still running at its deadline was thrown away and
  the retry started the same long write from nothing.

  The catalogue's backdrop presets are tested scenes of 2–9k characters that take the page's
  palette by default. A scene writer is now shown the few that fit its brief, and names one by
  setting its region's `js` to `@preset:<id>`; the build puts the preset's code in before the
  door sees the answer (through the writer's completing provider), so the
  writer can omit markup: `completeReadyScene` fills its contract copy and scene host locally.
  A writer whose first attempt failed is told to place one, so the retry finishes without
  repeating the long write. A repair
  round is shown the marker in place of the code (`markReadyScenes`) and its answer expanded
  the same way, so a repair never re-writes code it did not write.

  Only backdrops that stand as they are: no words of their own (`type`), no photo (`photo`),
  no controls in a tree (`game`, `story` — the kits). The initializer attaches catalog metadata
  and validated params only when declared; absent overrides use the page's palette, seed and pace.

  The mural kit (2026-10-14): a picture no ready scene closely matches — a coral reef, a Ramadan
  night, a winter village — is no longer nudged into the nearest-sounding preset (a reef into
  differential-growth-coral). Its first attempt is told to compose it with s.lib.mural, a short
  spec that writes in seconds. A retry, a preset named in the request, an abstract mural and a
  brief with no picture in it keep the ready scenes as before (`composesWithKit`, shared with the
  creative planner, decides).
*/

/** The categories whose presets a section can carry as they stand. */
const READY_CATEGORIES: ReadonlySet<ScenePresetCategory> = new Set<ScenePresetCategory>([
  'mural',
  'pattern',
  'particles',
  'toy',
]);
/** What a writer sets its `js` to, to place a ready scene. */
export const READY_SCENE_MARKER = '@preset:';
const MARKER = /^\s*@preset:\s*([a-z0-9-]+)\s*$/u;
/** How many a brief lists: enough to choose from, few enough to stay short. */
export const READY_SCENES_LISTED = 4;
/** The scene code a writer's own write should stay under; the region allows 32 000. */
export const OWN_SCENE_CODE_CHARS = 9_000;
/** Offered when nothing in the brief points anywhere: calm, broad, in the page's palette. */
const FALLBACK_IDS: readonly string[] = [
  'aurora-curtains',
  'flow-field-silk',
  'low-poly-terrain',
  'topographic-contours',
];
const ARABIC_FALLBACK_IDS: readonly string[] = [
  'girih-starfield',
  'arabesque-vines',
  'aurora-curtains',
  'flow-field-silk',
];

/** The presets a section can carry as they stand, in catalogue order. */
export function readyScenes(): readonly ScenePreset[] {
  return SCENE_PRESETS.filter(({ category }) => READY_CATEGORIES.has(category));
}

/** Words every brief and description shares, which say nothing about the picture. */
const PLAIN_WORDS: ReadonlySet<string> = new Set([
  'the',
  'and',
  'with',
  'for',
  'that',
  'this',
  'from',
  'into',
  'over',
  'your',
  'its',
  'page',
  'section',
  'scene',
  'website',
  'site',
  'قسم',
  'القسم',
  'صفحة',
  'الصفحة',
  'مع',
  'في',
  'من',
]);

function wordsOf(text: string): ReadonlySet<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !PLAIN_WORDS.has(word)),
  );
}

function presetWords(preset: ScenePreset): ReadonlySet<string> {
  return wordsOf(
    [
      preset.id.replaceAll('-', ' '),
      preset.title.en,
      preset.title.ar,
      preset.description.en,
      preset.description.ar,
      preset.category,
      ...preset.tags,
    ].join(' '),
  );
}

/**
 * The ready scenes that fit a brief best: most words shared with the preset's id, names,
 * descriptions and tags (English and Arabic), an Arabic page leaning to the Arabic patterns;
 * a brief that matches nothing gets a calm, broad few. Deterministic: ties keep catalogue order.
 */
export function suggestReadyScenes(brief: string, lang: string): readonly ScenePreset[] {
  const asked = wordsOf(brief);
  const arabic = /^ar(?:-|$)/iu.test(lang);
  const scored = readyScenes().map((preset, order) => {
    let score = 0;
    for (const word of presetWords(preset)) if (asked.has(word)) score += 1;
    if (score > 0 && arabic && preset.tags.includes('arabic')) score += 0.5;
    return { preset, score, order };
  });
  const matched = scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ preset }) => preset);
  const fallback = (arabic ? ARABIC_FALLBACK_IDS : FALLBACK_IDS)
    .map((id) => scenePreset(id))
    .filter((preset): preset is ScenePreset => preset !== undefined);
  const listed: ScenePreset[] = [];
  for (const preset of [...matched, ...fallback]) {
    if (listed.length >= READY_SCENES_LISTED) break;
    if (!listed.includes(preset)) listed.push(preset);
  }
  return listed;
}

function customScene(brief: string): boolean {
  const text = brief.toLowerCase();
  if (
    /\b(?:bespoke|from scratch|custom (?:pixi )?(?:scene|mural|composition))\b|من الصفر|جدارية مخصصة|مشهد مخصص/u.test(
      text,
    )
  )
    return true;
  const targets = readyScenes()
    .map(({ id }) => id)
    .join('|');
  const qualifiers =
    '(?:(?:the|a|an|any|ready|tested|built-in|catalog|preset|scene|mural|version|of|using|القالب|المشهد|الجدارية|هذه|هاي|جدارية|مشهد|جاهزة|جاهز|نسخة|من)\\s+){0,4}';
  return new RegExp(
    `(?:\\b(?:do not use|don't use|avoid|unlike|without|except|no|not)\\b|لا تستخدم|لا تستعمل|تجنب|بدون|ما بدي|مش نفس)\\s+${qualifiers}(?:\\b(?:${targets}|presets?|templates?)\\b|مشاهد جاهزة|جدارية جاهزة|قوالب)`,
    'u',
  ).test(text);
}

function explicitScenes(brief: string): readonly ScenePreset[] {
  const text = brief.toLowerCase();
  if (customScene(brief)) return [];
  return readyScenes().filter(({ id }) =>
    new RegExp(`(?:^|[^a-z0-9-])${id}(?=$|[^a-z0-9-])`, 'u').test(text),
  );
}

function firstClause(text: string): string {
  const clause = text.split(/[.;—]/u)[0]?.trim() ?? '';
  return clause.length <= 70 ? clause : `${clause.slice(0, 69)}…`;
}

/**
 * What a scene writer's brief adds: the ready scenes that fit, and how to place one. The
 * first attempt may still write its own scene, kept short; an explicit preset id or retry selects
 * initialization only, identified separately from general creative advice by the wire header.
 */
export function readySceneLines(
  listed: readonly ScenePreset[],
  attempt: 1 | 2,
  originalBrief = '',
): readonly string[] {
  if (listed.length === 0) return [];
  if (customScene(originalBrief)) return [];
  const explicit = explicitScenes(originalBrief);
  const mandatory = attempt === 2 || explicit.length > 0;
  const allowed = explicit.length > 0 ? explicit.slice(0, READY_SCENES_LISTED) : listed;
  const list = allowed
    .map(({ id, description }) => `${id} (${firstClause(description.en)})`)
    .join(' · ');
  return [
    ...(mandatory
      ? [`${SCENE_INITIALIZATION_HEADER} ${allowed.map(({ id }) => id).join('|')}`]
      : []),
    `READY SCENES (tested, in the page's palette; placed in seconds, where scene code of your own takes minutes): ${list}.`,
    `To initialize a complete scene section, answer with ONE setProp step {"id":"<this region id>","key":"js","value":"${READY_SCENE_MARKER}<id>"}. The build fills the tested code, responsive tree and css, exact contract title and required copy, and primary action for a hero or cta. No markup is needed. An explicit tree or css stays as you write it; put copy above the scene (position:relative;z-index:1) and size the region by its width, never vh.`,
    mandatory
      ? `${attempt === 2 ? 'The first attempt at this section failed' : 'The request names a ready preset'}: choose an id listed above and set this region's js to exactly "${READY_SCENE_MARKER}<id>" — no scene code of your own.`
      : `Write scene code of your own only when none of these fits the brief, and keep it under ${OWN_SCENE_CODE_CHARS.toLocaleString('en-US')} characters.`,
  ];
}

type Step = AiPlan['commands'][number];

function mapJsSteps(plan: AiPlan, change: (code: string) => string | undefined): AiPlan {
  const written: unknown = (plan as { readonly commands?: unknown }).commands;
  if (!Array.isArray(written)) return plan;
  // A property, not a local: the flag is set in a callback the checker cannot see.
  const state = { changed: false };
  const commands = (written as readonly Step[]).map((step): Step => {
    const args: unknown = step.args;
    if (step.command !== 'setProp' || typeof args !== 'object' || args === null) return step;
    const record = args as Readonly<Record<string, unknown>>;
    const value = record['value'];
    if (record['key'] !== 'js' || typeof value !== 'string') return step;
    const next = change(value);
    if (next === undefined || next === value) return step;
    state.changed = true;
    return { ...step, args: { ...record, value: next } };
  });
  return state.changed ? { ...plan, commands } : plan;
}

function readyById(id: string): ScenePreset | undefined {
  const preset = scenePreset(id);
  return preset !== undefined && READY_CATEGORIES.has(preset.category) ? preset : undefined;
}

/** Each `js` that names a ready scene (`@preset:<id>`) given that scene's tested code. */
export function expandReadyScenes(answer: AiPlan): AiPlan {
  return mapJsSteps(answer, (code) => {
    const id = MARKER.exec(code)?.[1];
    return id === undefined ? undefined : readyById(id)?.code;
  });
}

/** The reverse, for a repair round: a ready scene's code shown as its marker. */
export function markReadyScenes(plan: AiPlan): AiPlan {
  return mapJsSteps(plan, (code) => {
    const preset = readyScenes().find((entry) => entry.code === code);
    return preset === undefined ? undefined : `${READY_SCENE_MARKER}${preset.id}`;
  });
}

/** The playbooks of a backdrop mural; a game or a story is a kit, never a backdrop. */
const MURAL_PLAYBOOKS: readonly string[] = ['craftkit.pixi-murals', 'craftkit.pixi-scroll-murals'];
const KIT_PLAYBOOKS: readonly string[] = ['craftkit.pixi-games', 'craftkit.pixi-stories'];

/** Whether a scene's playbooks make ready backdrops a fit: a mural, and not a game or story. */
export function offersReadyScenes(skillIds: readonly string[]): boolean {
  return (
    skillIds.some((id) => MURAL_PLAYBOOKS.includes(id)) &&
    !skillIds.some((id) => KIT_PLAYBOOKS.includes(id))
  );
}

/**
 * A page-plan writer's request, with the ready scenes that fit its brief when it writes a
 * mural (`scene` given, its playbooks a mural's) — matched on the words its creative
 * expertise is matched on.
 */
export function withReadyScenes(
  request: string,
  scene:
    | {
        readonly options: Pick<RunAiBuildOptions, 'request'>;
        readonly plan: Pick<PagePlan, 'locale'>;
        readonly contract: SectionContract | undefined;
        readonly skillIds: readonly string[];
      }
    | undefined,
  attempt: 1 | 2,
): string {
  if (scene?.contract === undefined || !offersReadyScenes(scene.skillIds)) return request;
  const brief = creativeRequestOf(scene.options, scene.contract);
  if (customScene(brief)) return request;
  if (explicitScenes(brief).length === 0 && composesWithKit(brief)) {
    return [request, '', MURAL_KIT_WRITER_LINE].join('\n');
  }
  // A preset named for the lead scene must not force an unrelated later mural into that preset.
  const originalBrief =
    scene.contract.role === 'hero'
      ? scene.options.request
      : explicitScenes(scene.options.request)
          .filter(({ id }) => explicitScenes(brief).some((preset) => preset.id === id))
          .map(({ id }) => id)
          .join(' ');
  const lines = readySceneLines(
    suggestReadyScenes(brief, scene.plan.locale.lang),
    attempt,
    originalBrief,
  );
  return lines.length === 0 ? request : [request, '', ...lines].join('\n');
}

export const READY_SCENES_PROVIDER_ID = 'craftkit:ready-scenes';

/**
 * A new mural in an EDIT (one run, the edit lane): the ready scenes that fit the request, as a
 * data fragment, placed with the `scene.preset` tool the lane already lists — its params
 * included. Per request, never in the cached prefix.
 */
export function createReadyScenesContextProvider(request: string, lang: string): AiContextProvider {
  return {
    id: READY_SCENES_PROVIDER_ID,
    collect() {
      if (explicitScenes(request).length === 0 && composesWithKit(request)) {
        return {
          source: READY_SCENES_PROVIDER_ID,
          kind: 'data',
          trust: 'reviewed',
          title: 'Compose this mural with s.lib.mural',
          body: MURAL_KIT_EDIT_LINE,
        };
      }
      const listed = suggestReadyScenes(request, lang)
        .map(({ id, description }) => `${id} (${firstClause(description.en)})`)
        .join(' · ');
      return {
        source: READY_SCENES_PROVIDER_ID,
        kind: 'data',
        trust: 'reviewed',
        title: 'Ready scenes that fit this request',
        body: `Tested scenes in the page's palette: ${listed}. Place one with ONE scene.preset step ({"preset":"<id>","params":{…}}) instead of writing scene code — seconds, where scene code of your own takes minutes. Write scene code only for what none of them shows, and keep it under ${OWN_SCENE_CODE_CHARS.toLocaleString('en-US')} characters.`,
      };
    },
  };
}
