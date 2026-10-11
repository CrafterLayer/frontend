import { compileKeyword, readRequestWords, requestHasKeyword } from './keyword-match';
import type { AiSkillRegistry } from './types';

const PIXI_SKILL_IDS = [
  'craftkit.pixi-games',
  'craftkit.pixi-stories',
  'craftkit.pixi-murals',
  'craftkit.pixi-v8-core',
  'craftkit.pixi-v8-graphics',
  'craftkit.pixi-v8-text-assets',
  'craftkit.pixi-v8-effects',
  'craftkit.pixi-v8-interaction-perf',
] as const;

/** Targeted expertise for explicit build lanes; never enables unrelated automatic skills. */
export function pixiSkillIdsFor(
  registry: AiSkillRegistry | undefined,
  request: string,
): readonly string[] {
  if (registry === undefined) return [];
  const words = readRequestWords(request);
  return PIXI_SKILL_IDS.filter((id) => {
    const activation = registry.get(id)?.activation;
    return (
      activation?.mode === 'auto' &&
      activation.keywords?.some((keyword) => requestHasKeyword(words, compileKeyword(keyword))) ===
        true
    );
  });
}
