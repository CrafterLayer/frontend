/**
 * The person's OWN skills (2026-10-12): expertise they write for their site — a brand voice,
 * a house style, "every page ends with our booking band" — that the Agent reads like its
 * built-in skills. Pure data and rules here; `user-skills-store.ts` keeps and persists them.
 *
 * A skill is data, never code (the engine's `AiSkillDefinitionV1` has no script, URL or
 * network capability): a name, when it applies, and the instructions. It turns on one of two
 * ways:
 * - `always`: in every request. Always-on skills are MANDATORY in the engine (a run that
 *   cannot fit them fails), so their instructions share a small budget here
 *   (`USER_SKILLS_MAX_ALWAYS_CHARS`), far under the engine's 16k-token skill budget.
 * - `auto`: when the request mentions one of its words. The engine matches them the way it
 *   matches its own skills (case, hamza, taa marbuta, Arabic clitics: «لعيادتي» holds «عيادة»).
 *
 * Skills are also shared as Markdown, the SKILL.md shape: a `---` front matter with `name`,
 * `description`, `keywords` and `mode`, then the instructions.
 */
import type { AiSkillDefinitionV1, AiSkillRegistry } from '@craftkit/builder';

export const USER_SKILLS_MAX = 24;
export const USER_SKILL_MAX_NAME = 80;
export const USER_SKILL_MAX_DESCRIPTION = 300;
export const USER_SKILL_MAX_INSTRUCTIONS = 6_000;
export const USER_SKILL_MAX_KEYWORDS = 16;
const MAX_KEYWORD_LENGTH = 40;
/** Every enabled always-on skill's instructions together (~2k tokens). */
export const USER_SKILLS_MAX_ALWAYS_CHARS = 8_000;
/** The id namespace; the engine's id pattern needs a dotted, lowercase id. */
export const USER_SKILL_ID_PREFIX = 'user.skill-';

export type UserSkillMode = 'always' | 'auto';

export interface UserSkill {
  readonly id: string;
  readonly name: string;
  /** When to use it, in the person's words (the engine's `description`). */
  readonly description: string;
  readonly instructions: string;
  /** The words that turn an `auto` skill on. */
  readonly keywords: readonly string[];
  readonly mode: UserSkillMode;
  readonly enabled: boolean;
}

/** What the editor holds while a skill is written. */
export interface UserSkillDraft {
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly keywords: readonly string[];
  readonly mode: UserSkillMode;
}

/** Why a skill was not saved; each has its own line in the editor. */
export type UserSkillRefusal =
  'name' | 'instructions' | 'keywords' | 'tooLong' | 'full' | 'alwaysBudget';

export type UserSkillCheck =
  | { readonly ok: true; readonly draft: UserSkillDraft }
  | { readonly ok: false; readonly reason: UserSkillRefusal };

export const EMPTY_SKILL_DRAFT: UserSkillDraft = {
  name: '',
  description: '',
  instructions: '',
  keywords: [],
  mode: 'auto',
};

/** "brand, voice; نبرة" → ['brand', 'voice', 'نبرة']: commas (Latin or Arabic), semicolons or new lines. */
export function splitKeywords(text: string): readonly string[] {
  const words = text
    .split(/[,،;؛\n]/u)
    .map((word) => word.trim().replace(/\s+/gu, ' '))
    .filter((word) => word !== '' && word.length <= MAX_KEYWORD_LENGTH);
  return [...new Set(words.map((word) => word.toLowerCase()))].slice(0, USER_SKILL_MAX_KEYWORDS);
}

/** The always-on instructions a set of skills already spends, `except` one being edited. */
function alwaysChars(skills: readonly UserSkill[], except?: string): number {
  return skills
    .filter((skill) => skill.enabled && skill.mode === 'always' && skill.id !== except)
    .reduce((total, skill) => total + skill.instructions.length, 0);
}

/**
 * A draft cleaned and judged against the skills already kept. `editing` is the id of the
 * skill being changed (its own size does not count against the always-on budget twice).
 */
export function checkSkillDraft(
  draft: UserSkillDraft,
  skills: readonly UserSkill[],
  editing?: string,
): UserSkillCheck {
  const name = draft.name.trim().replace(/\s+/gu, ' ');
  const instructions = draft.instructions.trim();
  const description = draft.description.trim().replace(/\s+/gu, ' ');
  const keywords = splitKeywords(draft.keywords.join(','));
  if (name === '') return { ok: false, reason: 'name' };
  if (instructions === '') return { ok: false, reason: 'instructions' };
  if (
    name.length > USER_SKILL_MAX_NAME ||
    description.length > USER_SKILL_MAX_DESCRIPTION ||
    instructions.length > USER_SKILL_MAX_INSTRUCTIONS
  ) {
    return { ok: false, reason: 'tooLong' };
  }
  if (draft.mode === 'auto' && keywords.length === 0) return { ok: false, reason: 'keywords' };
  if (editing === undefined && skills.length >= USER_SKILLS_MAX)
    return { ok: false, reason: 'full' };
  if (
    draft.mode === 'always' &&
    alwaysChars(skills, editing) + instructions.length > USER_SKILLS_MAX_ALWAYS_CHARS
  ) {
    return { ok: false, reason: 'alwaysBudget' };
  }
  return { ok: true, draft: { name, description, instructions, keywords, mode: draft.mode } };
}

/** Whether turning `id` on would spend more always-on instructions than the budget holds. */
export function exceedsAlwaysBudget(skills: readonly UserSkill[], id: string): boolean {
  const skill = skills.find((entry) => entry.id === id);
  if (skill?.mode !== 'always') return false;
  return alwaysChars(skills, id) + skill.instructions.length > USER_SKILLS_MAX_ALWAYS_CHARS;
}

/** The next free id: `user.skill-1`, `user.skill-2`, … (never reused while the skill exists). */
export function nextSkillId(skills: readonly UserSkill[]): string {
  const taken = skills
    .map((skill) => Number(skill.id.slice(USER_SKILL_ID_PREFIX.length)))
    .filter((value) => Number.isInteger(value));
  return `${USER_SKILL_ID_PREFIX}${String(Math.max(0, ...taken) + 1)}`;
}

/** The engine's definition of an ENABLED skill (`source: 'host'`, reviewed: the person wrote it). */
export function userSkillDefinition(skill: UserSkill): AiSkillDefinitionV1 {
  return {
    schemaVersion: 1,
    id: skill.id,
    name: skill.name,
    description: skill.description === '' ? skill.name : skill.description,
    version: '1.0.0',
    instructions: skill.instructions,
    tags: ['user'],
    source: 'host',
    trust: 'reviewed',
    activation:
      skill.mode === 'always' ? { mode: 'always' } : { mode: 'auto', keywords: skill.keywords },
  };
}

export function userSkillDefinitions(skills: readonly UserSkill[]): AiSkillDefinitionV1[] {
  return skills.filter((skill) => skill.enabled).map(userSkillDefinition);
}

/**
 * The person's skills a request turns on, by the engine's own matcher (`registry.prepare`):
 * the always-on ones and the auto ones whose words it mentions. A build names these for its
 * steps (`RunAiAgentOptions.hostSkillIds`). A registry that cannot prepare names none.
 */
export function userSkillIdsFor(
  registry: AiSkillRegistry,
  skills: readonly UserSkill[],
  request: string,
): readonly string[] {
  const enabled = new Set(skills.filter((skill) => skill.enabled).map((skill) => skill.id));
  if (enabled.size === 0) return [];
  try {
    return registry
      .prepare({ request })
      .active.map((skill) => skill.id)
      .filter((id) => enabled.has(id));
  } catch {
    return [...enabled].filter((id) => skills.find((skill) => skill.id === id)?.mode === 'always');
  }
}

/* ── Stored form ─────────────────────────────────────────────────────────────── */

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.length <= max ? value : undefined;
}

/** One stored skill, or `undefined` when anything about it is not a skill this version wrote. */
export function readUserSkill(value: unknown): UserSkill | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const entry = value as Record<string, unknown>;
  const id = text(entry['id'], 40);
  const name = text(entry['name'], USER_SKILL_MAX_NAME);
  const description = text(entry['description'], USER_SKILL_MAX_DESCRIPTION) ?? '';
  const instructions = text(entry['instructions'], USER_SKILL_MAX_INSTRUCTIONS);
  const mode =
    entry['mode'] === 'always' ? 'always' : entry['mode'] === 'auto' ? 'auto' : undefined;
  const keywords = Array.isArray(entry['keywords'])
    ? splitKeywords(entry['keywords'].filter((word) => typeof word === 'string').join(','))
    : [];
  if (
    id === undefined ||
    !/^user\.skill-[1-9]\d*$/u.test(id) ||
    name === undefined ||
    name.trim() === '' ||
    instructions === undefined ||
    instructions.trim() === '' ||
    mode === undefined ||
    (mode === 'auto' && keywords.length === 0)
  ) {
    return undefined;
  }
  return {
    id,
    name,
    description,
    instructions,
    keywords,
    mode,
    enabled: entry['enabled'] !== false,
  };
}
