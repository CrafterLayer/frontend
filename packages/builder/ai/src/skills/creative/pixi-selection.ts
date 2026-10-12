import {
  BEDTIME_WORDS,
  PHYSICS_CUE_WORDS,
  SCROLL_CUE_WORDS,
  STORY_WORDS,
} from '../../creative/creative-activation';
import { compileKeyword, readRequestWords, requestHasKeyword } from '../keyword-match';
import type { AiSkillRegistry } from '../types';
import { GAME_LIB_CUES } from './game-cues';
import { PIXI_PAGE_SHAPES_ID } from './page-shapes';

/** Playbooks a request activates by its own words (most specific experience first). */
const PIXI_PRIMARY_IDS = [
  'craftkit.pixi-games',
  'craftkit.pixi-stories',
  'craftkit.pixi-murals',
  'craftkit.pixi-scroll-murals',
  'craftkit.pixi-tile-worlds',
  'craftkit.pixi-physics',
  'craftkit.pixi-dialogue',
  'craftkit.pixi-animation',
  'craftkit.pixi-effects',
  'craftkit.pixi-game-ai',
  'craftkit.pixi-hud',
  'craftkit.pixi-audio',
] as const;

/** PixiJS v8 guides, matched by their own keywords after the playbooks. */
const PIXI_GUIDE_IDS = [
  'craftkit.pixi-v8-core',
  'craftkit.pixi-v8-graphics',
  'craftkit.pixi-v8-text-assets',
  'craftkit.pixi-v8-effects',
  'craftkit.pixi-v8-interaction-perf',
] as const;

/** Every creative piece draws with Graphics, whatever words asked for it. */
const PIXI_GRAPHICS_ID = 'craftkit.pixi-v8-graphics';

/** Explicit: planning and continuity for every creative piece. */
const PIXI_DIRECTOR_ID = 'craftkit.pixi-director';

const STORIES_ID = 'craftkit.pixi-stories';

/*
  creative agent (2026-10-12): a game is more than its loop — it needs character motion and
  game feel; a story needs a dialogue engine. The engines' own keywords rarely appear in a
  brief ("بدي لعبة تجمع فيها نجوم" never says "particles"), so a matched playbook brings its
  companions. Order is priority: when a writer's skill budget is short, later ids drop first.
*/
const COMPANIONS: Readonly<Record<string, readonly string[]>> = {
  'craftkit.pixi-games': ['craftkit.pixi-effects', 'craftkit.pixi-animation'],
  'craftkit.pixi-stories': [
    'craftkit.pixi-dialogue',
    'craftkit.pixi-animation',
    'craftkit.pixi-effects',
  ],
  'craftkit.pixi-murals': ['craftkit.pixi-effects'],
  // creative power (2026-10-12): a scroll mural is a mural; a physics toy is a game.
  'craftkit.pixi-scroll-murals': ['craftkit.pixi-murals'],
  'craftkit.pixi-physics': ['craftkit.pixi-games', 'craftkit.pixi-effects'],
  'craftkit.pixi-tile-worlds': [
    'craftkit.pixi-games',
    'craftkit.pixi-effects',
    'craftkit.pixi-animation',
  ],
  'craftkit.pixi-dialogue': ['craftkit.pixi-stories', 'craftkit.pixi-animation'],
  // game libraries (2026-10-12): enemies, a HUD or sound belong to a game.
  'craftkit.pixi-game-ai': ['craftkit.pixi-games', 'craftkit.pixi-tile-worlds'],
  'craftkit.pixi-hud': ['craftkit.pixi-games'],
  'craftkit.pixi-audio': ['craftkit.pixi-games'],
};

/* Plain words that bring a library playbook once a piece is creative (like GAME_LIB_CUES). */
const SCENE_CUES: readonly { readonly skill: string; readonly words: readonly string[] }[] = [
  { skill: 'craftkit.pixi-physics', words: PHYSICS_CUE_WORDS },
  { skill: 'craftkit.pixi-scroll-murals', words: SCROLL_CUE_WORDS },
];

type RequestWords = ReturnType<typeof readRequestWords>;

function hasAny(words: RequestWords, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => requestHasKeyword(words, compileKeyword(keyword)));
}

function matched(registry: AiSkillRegistry, words: RequestWords, id: string): boolean {
  const activation = registry.get(id)?.activation;
  return activation?.mode === 'auto' && hasAny(words, activation.keywords ?? []);
}

/**
 * Targeted expertise for explicit build lanes; never enables unrelated automatic skills.
 * `lane: 'page-plan'` is the page planner's set: the same expertise led by the creative page
 * shapes (creative power, 2026-10-12), which no section writer is given.
 */
export function pixiSkillIdsFor(
  registry: AiSkillRegistry | undefined,
  request: string,
  lane: 'section' | 'page-plan' = 'section',
): readonly string[] {
  if (registry === undefined) return [];
  const words = readRequestWords(request);
  const primary: string[] = PIXI_PRIMARY_IDS.filter((id) => matched(registry, words, id));
  // A story asked for at bedtime, in any word order (creative-activation.ts).
  if (!primary.includes(STORIES_ID) && hasAny(words, STORY_WORDS) && hasAny(words, BEDTIME_WORDS))
    primary.push(STORIES_ID);
  if (primary.length === 0) return PIXI_GUIDE_IDS.filter((id) => matched(registry, words, id));
  const ids = new Set<string>(lane === 'page-plan' ? [PIXI_PAGE_SHAPES_ID] : []);
  for (const id of primary) ids.add(id);
  ids.add(PIXI_DIRECTOR_ID);
  // Inside a creative piece plain words count ("أعداء", "music", "parallax"): the person asked.
  for (const cue of [...GAME_LIB_CUES, ...SCENE_CUES])
    if (hasAny(words, cue.words)) ids.add(cue.skill);
  for (const id of primary) for (const companion of COMPANIONS[id] ?? []) ids.add(companion);
  for (const id of PIXI_GUIDE_IDS)
    if (id === PIXI_GRAPHICS_ID || matched(registry, words, id)) ids.add(id);
  return [...ids].filter((id) => registry.get(id) !== undefined);
}
