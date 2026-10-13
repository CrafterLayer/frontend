import {
  declaredLibs,
  type AiContextProvider,
  type BuilderDocument,
  type NodeId,
} from '@craftkit/builder-schema';

import { subtreeIds, treeElementText, type AiDocumentFocus } from '../context/document-tree-mode';
import {
  CREATIVE_BRIEF_PROVIDER_ID,
  createCreativeBriefContextProvider,
} from '../creative/context-providers';
import { BEDTIME_WORDS, PHYSICS_CUE_WORDS, STORY_WORDS } from '../creative/creative-activation';
import { GENRES, SETTINGS } from '../creative/creative-genres';
import {
  learnCreativeMemoryFromScripts,
  readCreativeMemory,
  type CreativeMemoryV1,
} from '../creative/creative-memory';
import type { IntentRoute } from '../intent';
import { creativeCreationRequest } from '../intent/route-intent';
import type { GenerateAiPlanOptions } from '../plan/generate-plan';
import type { AiSkillRegistry } from '../skills';
import { pixiSkillIdsFor } from '../skills/creative/pixi-selection';
import {
  compileKeyword,
  readRequestWords,
  requestHasKeyword,
  type CompiledKeyword,
} from '../skills/keyword-match';
import { isArabicPage } from './plan-page';
import { pinningRegistry } from './pinning-registry';
import { createReadyScenesContextProvider, offersReadyScenes } from './scene-ready';
import type { RunAiAgentOptions } from './types';

/*
  Creative EDITS get what creative builds get (creative-power Phase 2 H, 2026-10-12).

  A build names a scene writer's playbooks and hands it the planner's brief (section-providers.ts).
  A single run only matched skills on the request's words, so «خلّي الليل أغمق», "make chapter 3
  calmer" or a selected story plus "add a read-aloud button" — words that name no genre — reached
  the model with no Pixi playbook, no director and no brief, while the region it edits is a whole
  program. Here the run reads WHAT it edits: the customCode regions with code under the selection
  or the focused sections — or, on the whole page, every scene region when the words speak of
  the scene. Their code says what they are (`ck.scene({ libs })`, `s.lib.X`, game and story
  cues), and the build's own lane (`pixiSkillIdsFor`) picks the playbooks from those cues and the
  request. Deterministic and free: no model call; a page without scene code costs one walk.
*/

const CUSTOM_CODE = 'customCode';
const DIRECTOR_ID = 'craftkit.pixi-director';
const CORE_ID = 'craftkit.pixi-v8-core';
/** The scenes one edit's cues are read from; a page of twenty murals is still one edit. */
const MAX_SCENES = 3;
const CODE_SCAN_CHARS = 32_000;
const TEXT_SCAN_CHARS = 600;

/** One customCode region with code: the program an edit of it changes. */
export interface SceneRegion {
  readonly id: NodeId;
  readonly code: string;
  readonly label: string;
  /** The region's own DOM copy, clipped: where its setting and names are written. */
  readonly text: string;
}

/** What a creative edit adds to its run. */
export interface SceneEditContext {
  /** The regions the edit targets, in reading order. */
  readonly regions: readonly SceneRegion[];
  /** Playbooks to pin, most needed first (the lead playbook, the director, the v8 core). */
  readonly skillIds: readonly string[];
  /** The planner's brief for the edit, with the scene standing in for the page's request. */
  readonly brief: AiContextProvider;
}

export interface SceneEditInput {
  readonly request: string;
  readonly document: BuilderDocument;
  /** The person's selection, root excluded. */
  readonly selection: readonly NodeId[];
  /** The sections the engine focused the edit on (`reading.focus`). */
  readonly focus?: AiDocumentFocus;
  readonly registry?: AiSkillRegistry;
  readonly memory?: CreativeMemoryV1;
  readonly lang?: string;
}

// ── Which regions an edit is about ───────────────────────────────────────────

/*
  Words that speak of the scene on a page that has one: every genre word the planner reads
  (broad ones too — a café's "our story" is no risk where a story region exists), the story
  and bedtime words, physics cues, and the nouns of a playable piece.
*/
const SCENE_NOUNS = [
  'level',
  'character',
  'chapter',
  'player',
  'canvas',
  'مستوى',
  'مستويات',
  'شخصية',
  'شخصيات',
  'فصل',
  'لاعب',
];

let sceneKeywords: readonly CompiledKeyword[] | undefined;

function sceneWords(): readonly CompiledKeyword[] {
  sceneKeywords ??= [
    ...new Set([
      ...GENRES.flatMap(({ keywords }) => keywords),
      ...STORY_WORDS,
      ...BEDTIME_WORDS,
      ...PHYSICS_CUE_WORDS,
      ...SCENE_NOUNS,
    ]),
  ].map(compileKeyword);
  return sceneKeywords;
}

type Words = ReturnType<typeof readRequestWords>;

function hasAny(words: Words, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => requestHasKeyword(words, compileKeyword(keyword)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sceneRegion(document: BuilderDocument, id: NodeId): SceneRegion | undefined {
  const node = document.nodes[id];
  if (node?.type !== CUSTOM_CODE) return undefined;
  const js = node.props['js'];
  if (typeof js !== 'string' || js.trim() === '') return undefined;
  const label = node.props['label'];
  const tree = node.props['tree'];
  return {
    id,
    code: js.slice(0, CODE_SCAN_CHARS),
    label: typeof label === 'string' ? label : '',
    text: isRecord(tree) ? treeElementText(tree).slice(0, TEXT_SCAN_CHARS) : '',
  };
}

function regionsUnder(document: BuilderDocument, roots: readonly NodeId[]): SceneRegion[] {
  const seen = new Set<NodeId>();
  const regions: SceneRegion[] = [];
  for (const root of roots) {
    for (const id of subtreeIds(root, document)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const region = sceneRegion(document, id);
      if (region !== undefined) regions.push(region);
    }
  }
  return regions;
}

/** Whether a scene shows a setting the words name: «الليل» and a mural whose code draws stars. */
function showsSetting(region: SceneRegion, asked: typeof SETTINGS): boolean {
  const own = readRequestWords(`${region.label} ${region.text} ${region.code}`);
  return asked.some(({ keywords, weather }) => hasAny(own, [...keywords, ...weather]));
}

/**
 * The scene regions an edit targets: those under the selection or the focused sections; with
 * neither ("Whole page"), every scene region when the words speak of the scene, or the ones that
 * show the setting the words name. Empty when the edit is about something else.
 */
export function sceneRegionsFor(input: SceneEditInput): readonly SceneRegion[] {
  const { document } = input;
  const pointed = [...input.selection, ...(input.focus?.nodeIds ?? [])].filter(
    (id) => id !== document.rootId,
  );
  if (pointed.length > 0) return regionsUnder(document, pointed);
  const regions = regionsUnder(document, [document.rootId]);
  if (regions.length === 0) return regions;
  const words = readRequestWords(input.request);
  if (sceneWords().some((keyword) => requestHasKeyword(words, keyword))) return regions;
  const asked = SETTINGS.filter(({ keywords }) => hasAny(words, keywords));
  return asked.length === 0 ? [] : regions.filter((region) => showsSetting(region, asked));
}

// ── What the scene's code says it is ────────────────────────────────────────

const GAME_CODE = /data-game-(?:action|key|status)|\bs\s*\.\s*input\b|\bfixedTick\s*\(/u;
const STORY_CODE = /\bs\s*\.\s*story\b|\.\s*cast\s*\(|data-story|\bchapters?\b/iu;
const JUMP_CODE = /\bonGround\b|\bjump/iu;
const SCROLL_CODE = /\bs\s*\.\s*scroll\b/u;
const LIB_USE = /\blib\s*\.\s*([a-z]+)\b/gu;

/*
  What each library the scene loads says: [to the playbook lane, to the planner] (a word one of
  them does not read is harmless). The planner's word is left out where the genre rule already
  brings the library, and for `dialogue`, whose word turns every story into a visual novel.
*/
const LIB_CUES: Readonly<Record<string, readonly [string, string?]>> = {
  tilemap: ['tilemap'],
  dialogue: ['dialogue system'],
  ink: ['ink story', 'ink'],
  anim: ['character animation'],
  fx: ['game feel'],
  emitter: ['game feel'],
  gameai: ['enemies', 'enemies'],
  hud: ['hud', 'hud'],
  audio: ['sound', 'sound'],
  physics: ['physics', 'physics'],
  filters: ['pixi filter', 'glow'],
  viewport: ['zoom', 'zoom'],
  brush: ['brush', 'brush'],
  rough: ['hand drawn', 'hand drawn'],
};

/** The genre phrase a scene's code reads as, in words the playbooks and the planner both know. */
function genreOf(code: string, libs: ReadonlySet<string>): string {
  if (libs.has('physics')) return 'physics game';
  if (libs.has('tilemap')) return JUMP_CODE.test(code) ? 'platformer' : 'maze game';
  if (libs.has('gameai') || libs.has('hud') || GAME_CODE.test(code)) return '2d game';
  if (libs.has('dialogue') || libs.has('ink') || STORY_CODE.test(code)) return 'interactive story';
  return 'mural';
}

interface SceneCues {
  readonly skills: readonly string[];
  readonly brief: readonly string[];
}

function cuesOf(region: SceneRegion): SceneCues {
  const libs = new Set<string>(declaredLibs(region.code).libs);
  for (const match of region.code.matchAll(LIB_USE)) if (match[1] !== undefined) libs.add(match[1]);
  const genre = genreOf(region.code, libs);
  const scroll = SCROLL_CODE.test(region.code) ? ['parallax'] : [];
  const cues = [...libs].flatMap((lib) => {
    const cue = LIB_CUES[lib];
    return cue === undefined ? [] : [cue];
  });
  return {
    skills: [genre, ...cues.map(([skill]) => skill), ...scroll, region.label],
    brief: [genre, ...cues.flatMap(([, brief]) => (brief === undefined ? [] : [brief])), ...scroll],
  };
}

/** The lead playbook, then the director and the v8 core, then the rest in the lane's order. */
function rankedSkills(registry: AiSkillRegistry, ids: readonly string[]): readonly string[] {
  const ranked = [...new Set([...ids.slice(0, 1), DIRECTOR_ID, CORE_ID, ...ids.slice(1)])];
  // A pinned skill must never narrow the command policy a skill-free direct edit was held to.
  return ranked.filter((id) => {
    const manifest = registry.get(id);
    return manifest !== undefined && manifest.restrictToCommands === undefined;
  });
}

/**
 * The creative context of an edit of scene code: the playbooks to pin and the brief. Undefined
 * when the edit targets no scene region. `regions` when the caller already found them.
 */
export function sceneEditContext(
  input: SceneEditInput,
  regions: readonly SceneRegion[] = sceneRegionsFor(input),
): SceneEditContext | undefined {
  if (regions.length === 0) return undefined;
  const read = regions.slice(0, MAX_SCENES);
  const cues = read.map(cuesOf);
  const memory = learnCreativeMemoryFromScripts(
    read.map(({ code }) => code),
    input.memory,
  );
  const canon = [memory.genre, memory.title].filter((word): word is string => word !== undefined);
  const ids =
    input.registry === undefined
      ? []
      : rankedSkills(
          input.registry,
          pixiSkillIdsFor(
            input.registry,
            [input.request, ...cues.flatMap(({ skills }) => skills), ...canon].join(' '),
          ),
        );
  const scene = [
    ...cues.flatMap(({ brief }) => brief),
    ...read.map(({ label }) => label),
    ...canon,
  ].join(' ');
  return {
    regions,
    skillIds: ids,
    brief: createCreativeBriefContextProvider(input.request, {
      ...(input.lang === undefined ? {} : { lang: input.lang }),
      page: scene,
      memory,
    }),
  };
}

// ── The run's seam ───────────────────────────────────────────────────────────

/** What `runAiAgent` reads about its request (its `RunReading`). */
export interface SceneEditReading {
  readonly route: IntentRoute;
  readonly focus?: AiDocumentFocus;
}

type SceneEditOptions = Pick<
  GenerateAiPlanOptions,
  'skillRegistry' | 'selectedSkillIds' | 'additionalContextProviders'
>;

/** One reading, one answer: generation options are built twice per run from the same reading. */
const ANSWERS = new WeakMap<SceneEditReading, SceneEditOptions>();

function hostMemory(options: RunAiAgentOptions): CreativeMemoryV1 | undefined {
  if (options.creativeMemory === undefined) return undefined;
  try {
    return readCreativeMemory(options.creativeMemory()).memory;
  } catch {
    // A host memory that fails to load never blocks an edit; the brief plans without it.
    return undefined;
  }
}

function servesBrief(options: RunAiAgentOptions): boolean {
  return [
    ...(options.contextProviders ?? []),
    ...(options.additionalContextProviders ?? []),
    ...options.kernel.context.registry.aiContextProviders(),
  ].some(({ id }) => id === CREATIVE_BRIEF_PROVIDER_ID);
}

/** The brief, planned when the context is assembled — never on a direct edit. */
function lazyBrief(scene: () => SceneEditContext | undefined, request: string): AiContextProvider {
  return {
    id: CREATIVE_BRIEF_PROVIDER_ID,
    collect: (ctx, selection) => {
      let brief: AiContextProvider | undefined;
      try {
        brief = scene()?.brief;
      } catch {
        // A scene that cannot be read still gets a brief: planned from the request alone.
        brief = undefined;
      }
      return (brief ?? createCreativeBriefContextProvider(request)).collect(ctx, selection);
    },
  };
}

/**
 * A NEW mural (no scene region targeted, 2026-10-13): the ready scenes that fit the request
 * beside the run's own context, so one `scene.preset` step can stand where minutes of
 * hand-written scene code timed out (scene-ready.ts).
 */
function newMuralOptions(
  options: RunAiAgentOptions,
  registry: AiSkillRegistry | undefined,
  own: SceneEditOptions,
): SceneEditOptions {
  const ids = pixiSkillIdsFor(registry, options.request);
  const pinned =
    registry === undefined || options.autoSkills === false || ids.length === 0
      ? own
      : { ...own, skillRegistry: pinningRegistry(registry, options.policy, () => ids) };
  if (!offersReadyScenes(ids)) return pinned;
  const lang = isArabicPage(options.kernel, options.request) ? 'ar' : 'en';
  return {
    ...pinned,
    additionalContextProviders: [
      ...(own.additionalContextProviders ?? []),
      createReadyScenesContextProvider(options.request, lang),
    ],
  };
}

function sceneEditOptions(
  options: RunAiAgentOptions,
  reading: SceneEditReading,
  registry: AiSkillRegistry | undefined,
  own: SceneEditOptions,
): SceneEditOptions {
  const document = options.kernel.getDocument();
  const focus = reading.focus ?? options.composition?.documentFocus;
  const input: SceneEditInput = {
    request: options.request,
    document,
    selection: (options.selection ?? options.kernel.context.store.getState().selection).filter(
      (id) => id !== document.rootId,
    ),
    ...(focus === undefined ? {} : { focus }),
  };
  const regions = sceneRegionsFor(input);
  if (regions.length === 0) return newMuralOptions(options, registry, own);
  let scene: SceneEditContext | undefined;
  const read = (): SceneEditContext | undefined => {
    if (scene !== undefined) return scene;
    const memory = hostMemory(options);
    scene = sceneEditContext(
      {
        ...input,
        ...(registry === undefined ? {} : { registry }),
        ...(memory === undefined ? {} : { memory }),
        lang: isArabicPage(options.kernel, options.request) ? 'ar' : 'en',
      },
      regions,
    );
    return scene;
  };
  const pins = (): readonly string[] => {
    try {
      return read()?.skillIds ?? [];
    } catch {
      // An aid that fails must never cost the person their edit: no pins.
      return [];
    }
  };
  return {
    // `autoSkills: false` keeps exactly the skills the host named: no pins, the brief still.
    ...(registry === undefined || options.autoSkills === false
      ? own
      : { ...own, skillRegistry: pinningRegistry(registry, options.policy, pins) }),
    ...(servesBrief(options)
      ? {}
      : {
          additionalContextProviders: [
            ...(own.additionalContextProviders ?? []),
            lazyBrief(read, options.request),
          ],
        }),
  };
}

/**
 * The generation's `skillRegistry`, `selectedSkillIds` and `additionalContextProviders`: the
 * run's own and — on a free-code edit (or new section) that targets scene code — a registry
 * view that pins the scene's playbooks after the person's own picks, and the scene's brief. A
 * build step (no reading), a question, a page build and a run without free code get exactly
 * their own. Only the target regions are found here; the rest is read when the model path
 * prepares skills or assembles context.
 */
export function withSceneEdit(
  options: RunAiAgentOptions,
  reading: SceneEditReading | undefined,
  registry: AiSkillRegistry | undefined,
): SceneEditOptions {
  const own: SceneEditOptions = {
    ...(registry === undefined ? {} : { skillRegistry: registry }),
    ...(options.selectedSkillIds === undefined
      ? {}
      : { selectedSkillIds: options.selectedSkillIds }),
    ...(options.additionalContextProviders === undefined
      ? {}
      : { additionalContextProviders: options.additionalContextProviders }),
  };
  if (reading === undefined || options.freeCode !== true) return own;
  const kind = reading.route.kind;
  if (kind !== 'edit' && kind !== 'add-section' && !creativeCreationRequest(options.request))
    return own;
  let answer = ANSWERS.get(reading);
  if (answer === undefined) {
    try {
      answer = sceneEditOptions(options, reading, registry, own);
    } catch {
      // An aid that fails must never cost the person their edit: the run keeps its own.
      answer = own;
    }
    ANSWERS.set(reading, answer);
  }
  return answer;
}
