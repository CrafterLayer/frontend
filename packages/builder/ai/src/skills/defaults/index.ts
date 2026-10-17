import type { AiSkillDefinitionV1 } from '../types';
import { DESIGN_INTELLIGENCE_SKILL } from './design-intelligence';
import { EVERYDAY_DEFAULT_SKILLS } from './everyday-skills';
import { LANDING_PATTERNS_SKILL } from './landing-patterns';

/**
 * The default skills (2026-10-12): reviewed skills a host turns on for every person, beside the
 * engine's built-ins, which the person may switch off one by one. They are not part of
 * `CRAFTKIT_AI_SKILL_DEFINITIONS`: a host opts in by passing them to
 * `createCraftkitAiSkillRegistry([...CRAFTKIT_DEFAULT_SKILLS, …])`. All word-triggered, below
 * the built-ins in priority, so a tight budget keeps the engine's own skills first.
 */
export const CRAFTKIT_DEFAULT_SKILLS: readonly AiSkillDefinitionV1[] = Object.freeze([
  DESIGN_INTELLIGENCE_SKILL,
  LANDING_PATTERNS_SKILL,
  ...EVERYDAY_DEFAULT_SKILLS,
]);

export { DESIGN_ROWS, TYPE_MOODS, type DesignRow, type TypeMood } from './design-intelligence';
export { LANDING_PATTERNS, type LandingPattern } from './landing-patterns';
