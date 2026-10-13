/**
 * The composer's `/` (2026-10-12): as in other agents, a slash at the start of the message or
 * after a space lists the skills, and the words after it narrow the list. Picking one takes
 * the partial `/words` into a complete inline token for this request. The queued request keeps
 * that same text. Pure functions; SkillSlash draws it.
 */
import type { DefaultSkillView } from './default-skills';
import type { BuiltInSkillView } from './knowledge';
import type { UserSkill } from './user-skills';

/**
 * The commands the `/` list offers before the skills (2026-10-12): keep the message as a
 * memory, save a checkpoint named by it, start a skill from it, or run it on several pages
 * as a background job (`batch`). Each answers to its English and Arabic words.
 */
export const SLASH_COMMANDS = ['remember', 'checkpoint', 'skill', 'batch'] as const;
export type SlashCommand = (typeof SLASH_COMMANDS)[number];

const COMMAND_WORDS: Readonly<Record<SlashCommand, readonly string[]>> = {
  remember: ['remember', 'memory', 'تذكر', 'ذاكرة', 'احفظ'],
  checkpoint: ['checkpoint', 'save', 'restore', 'نقطة', 'حفظ', 'استرجاع'],
  skill: ['skill', 'new-skill', 'مهارة', 'مهارة-جديدة'],
  batch: ['batch', 'background', 'jobs', 'خلفية', 'دفعة', 'مهام'],
};

/** `/batch Translate every page`: the command typed out in full, then sent. */
const BATCH_SENT = /^\s*\/(?:batch|background|خلفية|دفعة)(?:\s+([\s\S]*))?$/iu;

/** The request of a sent `/batch <request>` (empty for a bare `/batch`), or none. */
export function batchCommandText(draft: string): string | undefined {
  const match = BATCH_SENT.exec(draft);
  return match === null ? undefined : (match[1] ?? '').trim();
}

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

/** Complete the chosen token at the prompt's start; links elsewhere are never skill syntax. */
export function withInlineSkill(draft: string, token: SlashToken, option: SlashOption): string {
  return `/${option.command} ${withoutSlash(draft, token).trimStart()}`;
}

function skillPrefix(request: string, options: readonly SlashOption[]) {
  const commands = new Map(options.map((option) => [fold(option.command), option.id]));
  const ids = new Set<string>();
  let end = 0;
  for (;;) {
    const match = /^\s*\/([^\s/]+)(?=\s|$)/u.exec(request.slice(end));
    if (match === null) break;
    const id = commands.get(fold(match[1] ?? ''));
    if (id === undefined) break;
    ids.add(id);
    end += match[0].length;
  }
  return { ids: [...ids], end };
}

/** Only contiguous enabled skill tokens at the beginning are explicit selections. */
export function inlineSkillIds(
  request: string,
  options: readonly SlashOption[],
): readonly string[] {
  return skillPrefix(request, options).ids;
}

/** Leave ordinary prose, relative links, unknown slash words and paths byte-for-byte intact. */
export function inlineSkillRequest(request: string, options: readonly SlashOption[]): string {
  const { end } = skillPrefix(request, options);
  return end === 0 ? request : request.slice(end).trimStart();
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
 * then the built-ins; a skill already selected in this prompt is left out. A query matches the start of a command
 * or any word of the name, then anywhere in the name or description.
 */
export function slashOptions(
  skills: readonly UserSkill[],
  builtIns: readonly BuiltInSkillView[],
  query: string,
  selected: readonly string[] = [],
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
  ];
  // A person's skill must not shadow a built-in token or an executable slash command.
  const reserved = new Set(
    Object.values(COMMAND_WORDS)
      .flat()
      .map((word) => fold(commandOf(word))),
  );
  const counts = new Map<string, number>();
  for (const option of options) {
    const command = fold(option.command);
    counts.set(command, (counts.get(command) ?? 0) + 1);
  }
  const vocabulary = options
    .map((option) =>
      option.source === 'user' &&
      (option.command === '' ||
        reserved.has(fold(option.command)) ||
        (counts.get(fold(option.command)) ?? 0) > 1)
        ? { ...option, command: `${option.command || 'skill'}-${commandOf(option.id)}` }
        : option,
    )
    .filter((option) => !selected.includes(option.id));
  const wanted = fold(query.trim());
  if (wanted === '') return vocabulary;
  const rank = (option: SlashOption): number => {
    const command = fold(option.command);
    const name = fold(option.name);
    if (command.startsWith(wanted) || name.split(/\s+/u).some((word) => word.startsWith(wanted)))
      return 0;
    if (name.includes(wanted) || command.includes(wanted)) return 1;
    if (fold(option.description).includes(wanted)) return 2;
    return 3;
  };
  return vocabulary
    .map((option, index) => ({ option, index, rank: rank(option) }))
    .filter((entry) => entry.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.option);
}
