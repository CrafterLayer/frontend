/**
 * The composer's `/` (2026-10-12): as in other agents, a slash at the start of the message or
 * after a space lists the skills, and the words after it narrow the list. Picking one takes
 * the `/words` out of the draft and pins the skill to the next message, where the engine must
 * use it (an explicit selection). Pure functions; `useSkillSlash` and SkillSlash draw it.
 */
import type { DefaultSkillView } from './default-skills';
import type { BuiltInSkillView } from './knowledge';
import type { UserSkill } from './user-skills';

/** A request carries at most this many pinned skills (explicit skills are mandatory). */
export const MAX_PINNED_SKILLS = 3;

/**
 * The commands the `/` list offers before the skills (2026-10-12): keep the message as a
 * memory, save a checkpoint named by it, or start a skill from it. Each answers to its English
 * and Arabic words.
 */
export const SLASH_COMMANDS = ['remember', 'checkpoint', 'skill'] as const;
export type SlashCommand = (typeof SLASH_COMMANDS)[number];

const COMMAND_WORDS: Readonly<Record<SlashCommand, readonly string[]>> = {
  remember: ['remember', 'memory', 'تذكر', 'ذاكرة', 'احفظ'],
  checkpoint: ['checkpoint', 'save', 'restore', 'نقطة', 'حفظ', 'استرجاع'],
  skill: ['skill', 'new-skill', 'مهارة', 'مهارة-جديدة'],
};

/** The commands a query names: every one for no words, else those a word of theirs starts with. */
export function slashCommands(query: string): readonly SlashCommand[] {
  const wanted = fold(query.trim());
  if (wanted === '') return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((command) =>
    COMMAND_WORDS[command].some((word) => fold(word).startsWith(wanted)),
  );
}

/** The words before the `/`: what a command acts on ("Our colour is green /remember"). */
export function textBeforeSlash(draft: string, token: SlashToken): string {
  return draft.slice(0, token.start).trim();
}

export interface SlashToken {
  /** The words after the slash, as typed. */
  readonly query: string;
  /** Where the slash is in the draft. */
  readonly start: number;
}

export interface SlashOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** What follows the slash: `/brand-voice`, `/copywriting`. */
  readonly command: string;
  readonly source: 'user' | 'default' | 'builtin';
}

/** The `/words` the draft ends on, when it ends on one (start of the message or after a space). */
export function slashToken(draft: string): SlashToken | null {
  const match = /(^|\s)\/([^\s/]*)$/u.exec(draft);
  if (match === null) return null;
  const query = match[2] ?? '';
  return { query, start: draft.length - query.length - 1 };
}

/** The draft without its `/words`, and without the space it leaves at the end. */
export function withoutSlash(draft: string, token: SlashToken): string {
  return draft
    .slice(0, token.start)
    .replace(/\s+$/u, (space) => (token.start === 0 ? '' : space.slice(0, 1)));
}

/** A name as a command: lower case, words joined by `-` (Arabic letters kept). */
export function commandOf(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

/** Case, hamza and taa marbuta folded, so «اسلوب» finds «أسلوب». */
function fold(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[ً-ْ]/gu, '')
    .replace(/[أإآ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/ى/gu, 'ي');
}

/**
 * The options for a query: the person's enabled skills first, then the enabled default skills,
 * then the built-ins; a skill already pinned is left out. A query matches the start of a command
 * or any word of the name, then anywhere in the name or description.
 */
export function slashOptions(
  skills: readonly UserSkill[],
  builtIns: readonly BuiltInSkillView[],
  query: string,
  pinned: readonly string[] = [],
  defaults: readonly DefaultSkillView[] = [],
): readonly SlashOption[] {
  const options: SlashOption[] = [
    ...skills
      .filter((skill) => skill.enabled)
      .map((skill): SlashOption => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        command: commandOf(skill.name),
        source: 'user',
      })),
    ...defaults
      .filter((skill) => skill.enabled)
      .map((skill): SlashOption => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        command: skill.id.replace(/^craftkit\./u, ''),
        source: 'default',
      })),
    ...builtIns.map((skill): SlashOption => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      command: skill.id.replace(/^craftkit\./u, ''),
      source: 'builtin',
    })),
  ].filter((option) => !pinned.includes(option.id));
  const wanted = fold(query.trim());
  if (wanted === '') return options;
  const rank = (option: SlashOption): number => {
    const command = fold(option.command);
    const name = fold(option.name);
    if (command.startsWith(wanted) || name.split(/\s+/u).some((word) => word.startsWith(wanted)))
      return 0;
    if (name.includes(wanted) || command.includes(wanted)) return 1;
    if (fold(option.description).includes(wanted)) return 2;
    return 3;
  };
  return options
    .map((option, index) => ({ option, index, rank: rank(option) }))
    .filter((entry) => entry.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.option);
}
