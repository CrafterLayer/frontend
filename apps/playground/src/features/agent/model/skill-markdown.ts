/**
 * A skill as Markdown (2026-10-12): the SKILL.md shape people already share skills in.
 *
 *     ---
 *     name: Brand voice
 *     description: Our tone for every headline and button
 *     keywords: brand, copy, نبرة
 *     mode: auto
 *     ---
 *     Write short, warm sentences. …
 *
 * Reading is forgiving: no front matter reads a leading `# Title` as the name and the rest as
 * the instructions; `keywords` may be a comma list, a `[a, b]` list or `- a` lines; without
 * keywords the words of the name turn the skill on. Nothing here judges limits: the draft
 * goes through `checkSkillDraft` like one typed by hand.
 */
import { splitKeywords, type UserSkill, type UserSkillDraft } from './user-skills';

const FRONT_MATTER = /^\s*---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/u;

/** `"a"` / `'a'` → `a`. */
function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(["'])(.*)\1$/u.exec(trimmed);
  return quoted === null ? trimmed : (quoted[2] ?? '');
}

/** The front matter's keys, with `- item` lines gathered under the key above them. */
function readFrontMatter(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  let listKey: string | undefined;
  for (const line of block.split('\n')) {
    const item = /^\s*-\s+(.*)$/u.exec(line);
    if (item !== null && listKey !== undefined) {
      const previous = fields.get(listKey) ?? '';
      fields.set(
        listKey,
        previous === '' ? unquote(item[1] ?? '') : `${previous}, ${unquote(item[1] ?? '')}`,
      );
      continue;
    }
    const pair = /^\s*([A-Za-z_-]+)\s*:\s*(.*)$/u.exec(line);
    if (pair === null) continue;
    const key = (pair[1] ?? '').toLowerCase();
    const value = (pair[2] ?? '').trim();
    listKey = value === '' ? key : undefined;
    fields.set(key, value.replace(/^\[(.*)\]$/u, '$1'));
  }
  return fields;
}

/** Words of a name long enough to mean something (3+ letters). */
function nameWords(name: string): readonly string[] {
  return splitKeywords(
    name
      .split(/\s+/u)
      .filter((word) => word.length >= 3)
      .join(','),
  );
}

/** A draft from Markdown, or `undefined` when there is no name and no instructions to read. */
export function parseSkillMarkdown(markdown: string): UserSkillDraft | undefined {
  const source = markdown.replace(/\r\n?/gu, '\n');
  const match = FRONT_MATTER.exec(source);
  let name = '';
  let description = '';
  let keywordText = '';
  let mode: UserSkillDraft['mode'] = 'auto';
  let body = source;
  if (match !== null) {
    const fields = readFrontMatter(match[1] ?? '');
    name = unquote(fields.get('name') ?? fields.get('title') ?? '');
    description = unquote(fields.get('description') ?? fields.get('when') ?? '');
    keywordText = fields.get('keywords') ?? fields.get('triggers') ?? '';
    mode = unquote(fields.get('mode') ?? '').toLowerCase() === 'always' ? 'always' : 'auto';
    body = source.slice(match[0].length);
  } else {
    const heading = /^\s*#\s+(.+)\n?/u.exec(source);
    if (heading !== null) {
      name = (heading[1] ?? '').trim();
      body = source.slice(heading[0].length);
    }
  }
  const instructions = body.trim();
  if (name === '' && instructions === '') return undefined;
  const keywords = splitKeywords(keywordText.split(',').map(unquote).join(','));
  return {
    name: name.trim(),
    description: description.trim(),
    instructions,
    keywords: keywords.length > 0 || mode === 'always' ? keywords : nameWords(name),
    mode,
  };
}

/** A kept skill as Markdown, readable back by `parseSkillMarkdown`. */
export function skillMarkdown(skill: UserSkill): string {
  const lines = [
    '---',
    `name: ${skill.name}`,
    ...(skill.description === '' ? [] : [`description: ${skill.description}`]),
    ...(skill.keywords.length === 0 ? [] : [`keywords: ${skill.keywords.join(', ')}`]),
    `mode: ${skill.mode}`,
    '---',
    '',
    skill.instructions,
    '',
  ];
  return lines.join('\n');
}
