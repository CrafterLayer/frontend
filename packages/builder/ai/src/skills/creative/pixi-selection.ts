import { compileKeyword, readRequestWords, requestHasKeyword } from '../keyword-match';
import type { AiSkillRegistry } from '../types';
import { GAME_LIB_CUES } from './game-cues';

/** Playbooks a request activates by its own words (most specific experience first). */
const PIXI_PRIMARY_IDS = [
  'craftkit.pixi-games',
  'craftkit.pixi-stories',
  'craftkit.pixi-murals',
  'craftkit.pixi-tile-worlds',
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

/** Explicit: planning and continuity for every creative piece. */
const PIXI_DIRECTOR_ID = 'craftkit.pixi-director';

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

function matched(
  registry: AiSkillRegistry,
  words: ReturnType<typeof readRequestWords>,
  id: string,
): boolean {
  const activation = registry.get(id)?.activation;
  return (
    activation?.mode === 'auto' &&
    activation.keywords?.some((keyword) => requestHasKeyword(words, compileKeyword(keyword))) ===
      true
  );
}

/** Targeted expertise for explicit build lanes; never enables unrelated automatic skills. */
export function pixiSkillIdsFor(
  registry: AiSkillRegistry | undefined,
  request: string,
): readonly string[] {
  if (registry === undefined) return [];
  const words = readRequestWords(request);
  const primary = PIXI_PRIMARY_IDS.filter((id) => matched(registry, words, id));
  if (primary.length === 0) return PIXI_GUIDE_IDS.filter((id) => matched(registry, words, id));
  const ids = new Set<string>(primary);
  ids.add(PIXI_DIRECTOR_ID);
  // Inside a creative piece plain words count ("أعداء", "music", "health"): the person asked.
  for (const cue of GAME_LIB_CUES)
    if (cue.words.some((word) => requestHasKeyword(words, compileKeyword(word))))
      ids.add(cue.skill);
  for (const id of primary) for (const companion of COMPANIONS[id] ?? []) ids.add(companion);
  for (const id of PIXI_GUIDE_IDS) if (matched(registry, words, id)) ids.add(id);
  return [...ids].filter((id) => registry.get(id) !== undefined);
}
