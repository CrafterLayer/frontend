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
 *
 * MDX reads too (a SKILL.mdx, 2026-10-12): `import` lines and `export` statements are not
 * instructions and are dropped — an `export const meta = { name: '…', … }` (or `frontmatter`,
 * `metadata`) stands in for the front matter — and JSX tags are unwrapped to their words, so
 * `<Callout>Never use red.</Callout>` teaches "Never use red." Nothing in it is ever run.
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

const MDX_IMPORT = /^\s*import\s+(?:[^'"]*\s+from\s+)?['"][^'"]+['"];?\s*$/u;
const MDX_META = /^\s*export\s+const\s+(?:meta|frontmatter|metadata)\s*=\s*\{/u;

/** `key: 'value'` and `key: ['a', 'b']` pairs of an MDX `export const meta = { … }`. */
function readMetaObject(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  const pair = /([A-Za-z_]+)\s*:\s*(\[[^\]]*\]|"[^"]*"|'[^']*'|`[^`]*`)/gu;
  for (const [, key = '', raw = ''] of block.matchAll(pair)) {
    const value = raw.startsWith('[')
      ? raw
          .slice(1, -1)
          .split(',')
          .map(unquote)
          .filter((word) => word !== '')
          .join(', ')
      : raw.slice(1, -1);
    fields.set(key.toLowerCase(), value);
  }
  return fields;
}

/** MDX as Markdown: imports and exports out (the meta object kept apart), JSX unwrapped. */
function readMdx(source: string): { readonly body: string; readonly meta: Map<string, string> } {
  const lines = source.split('\n');
  const kept: string[] = [];
  let meta = new Map<string, string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (MDX_IMPORT.test(line)) continue;
    if (/^\s*export\s/u.test(line)) {
      // The statement runs until its braces close (one line, or an object over several).
      let block = line;
      let depth = (line.match(/\{/gu) ?? []).length - (line.match(/\}/gu) ?? []).length;
      while (depth > 0 && index + 1 < lines.length) {
        index += 1;
        const next = lines[index] ?? '';
        block += `\n${next}`;
        depth += (next.match(/\{/gu) ?? []).length - (next.match(/\}/gu) ?? []).length;
      }
      if (MDX_META.test(block)) meta = readMetaObject(block);
      continue;
    }
    kept.push(line);
  }
  const body = kept
    .join('\n')
    .replace(/\{\/\*[\s\S]*?\*\/\}/gu, '')
    .replace(/<\/?[A-Z][\w.]*(?:\s[^<>]*)?\/?>/gu, '');
  return { body, meta };
}

/** A draft from Markdown or MDX, or `undefined` when there is no name and no instructions. */
export function parseSkillMarkdown(markdown: string): UserSkillDraft | undefined {
  const mdx = readMdx(markdown.replace(/\r\n?/gu, '\n'));
  const source = mdx.body.replace(/^\s*\n/u, '');
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
  } else if (mdx.meta.size > 0) {
    name = mdx.meta.get('name') ?? mdx.meta.get('title') ?? '';
    description = mdx.meta.get('description') ?? '';
    keywordText = mdx.meta.get('keywords') ?? mdx.meta.get('triggers') ?? '';
    mode = (mdx.meta.get('mode') ?? '').toLowerCase() === 'always' ? 'always' : 'auto';
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
