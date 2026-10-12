/**
 * Skills as Markdown (2026-10-12): the SKILL.md shape read forgivingly — front matter in its
 * usual spellings, or a plain `# Title` — and written back so it reads the same.
 */
import { describe, expect, it } from 'vitest';

import { parseSkillMarkdown, skillMarkdown } from './skill-markdown';
import type { UserSkill } from './user-skills';

describe('parseSkillMarkdown', () => {
  it('reads front matter: name, description, comma keywords and the mode', () => {
    const draft = parseSkillMarkdown(
      '---\nname: Brand voice\ndescription: "Every line of copy"\nkeywords: copy, headline\nmode: auto\n---\nWrite short, warm sentences.\n',
    );
    expect(draft).toEqual({
      name: 'Brand voice',
      description: 'Every line of copy',
      instructions: 'Write short, warm sentences.',
      keywords: ['copy', 'headline'],
      mode: 'auto',
    });
  });

  it('reads bracket and dash lists, CRLF line ends and an always mode', () => {
    expect(
      parseSkillMarkdown('---\r\nname: A\r\nkeywords: [copy, "cta"]\r\n---\r\nDo it.')?.keywords,
    ).toEqual(['copy', 'cta']);
    const listed = parseSkillMarkdown(
      "---\nname: B\ntriggers:\n  - menu\n  - 'winter'\nmode: always\n---\nSoup first.",
    );
    expect(listed).toMatchObject({ keywords: ['menu', 'winter'], mode: 'always' });
  });

  it('reads a plain Markdown skill: the heading is the name, the words of the name turn it on', () => {
    expect(parseSkillMarkdown('# Seasonal menu\n\nLead with soups.')).toEqual({
      name: 'Seasonal menu',
      description: '',
      instructions: 'Lead with soups.',
      keywords: ['seasonal', 'menu'],
      mode: 'auto',
    });
  });

  it('reads nothing from an empty text', () => {
    expect(parseSkillMarkdown('   ')).toBeUndefined();
    expect(parseSkillMarkdown('---\n---\n')).toBeUndefined();
  });
});

describe('skillMarkdown', () => {
  it('writes a skill that reads back the same', () => {
    const skill: UserSkill = {
      id: 'user.skill-1',
      name: 'نبرة العلامة',
      description: 'كل النصوص',
      instructions: 'اكتب جملًا قصيرة.',
      keywords: ['نص', 'عنوان'],
      mode: 'auto',
      enabled: true,
    };
    const text = skillMarkdown(skill);
    expect(text.startsWith('---\nname: نبرة العلامة\n')).toBe(true);
    expect(parseSkillMarkdown(text)).toEqual({
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      keywords: skill.keywords,
      mode: skill.mode,
    });
    expect(
      skillMarkdown({ ...skill, description: '', keywords: [], mode: 'always' }),
    ).not.toContain('keywords:');
  });
});

describe('parseSkillMarkdown, MDX', () => {
  it('drops imports and exports, reads the meta export and unwraps JSX', () => {
    const mdx = [
      "import { Callout } from '../components';",
      '',
      'export const meta = {',
      "  name: 'Clinic tone',",
      '  description: "Every clinic page",',
      "  keywords: ['clinic', 'عيادة'],",
      "  mode: 'auto',",
      '};',
      '',
      'Speak calmly and plainly.',
      '',
      '<Callout type="warning">Never promise a cure.</Callout>',
      '{/* reviewed by the clinic, 2026 */}',
      '<Divider />',
    ].join('\n');
    expect(parseSkillMarkdown(mdx)).toEqual({
      name: 'Clinic tone',
      description: 'Every clinic page',
      instructions: 'Speak calmly and plainly.\n\nNever promise a cure.',
      keywords: ['clinic', 'عيادة'],
      mode: 'auto',
    });
  });

  it('reads MDX with front matter like Markdown, and keeps lowercase HTML', () => {
    const mdx =
      "---\nname: Menu\nkeywords: menu\n---\nimport X from 'x';\n\nUse <strong>bold</strong> prices.\n";
    expect(parseSkillMarkdown(mdx)).toMatchObject({
      name: 'Menu',
      instructions: 'Use <strong>bold</strong> prices.',
    });
  });
});
