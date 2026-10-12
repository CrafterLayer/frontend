/**
 * SkillRow (2026-10-12): one of the person's skills — a switch named "Use {name}", the line
 * that says when it turns on, and Edit, Copy as SKILL.md and Delete, each named for the
 * skill. A refused switch says why in the row; Delete asks once more in place.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { knowledgeLabels, type KnowledgeLabels } from '../../copy/knowledge-labels';
import type { UserSkill } from '../../model/user-skills';
import { SAMPLE_SKILLS, SAMPLE_SKILLS_AR } from '../../testing/knowledge-fixtures';

import { SkillRow } from './SkillRow';

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');
const [BRAND_VOICE, HOUSE_STYLE, SEASONAL_MENU] = SAMPLE_SKILLS as [
  UserSkill,
  UserSkill,
  UserSkill,
];

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'SkillRow', 'SkillRow.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

interface Setup {
  readonly skill?: UserSkill;
  readonly labels?: KnowledgeLabels;
  readonly refusal?: string;
  readonly copies?: boolean;
}

/** One row in its list, as SkillsTab draws it. */
function setup({ skill = BRAND_VOICE, labels = EN, refusal, copies = true }: Setup = {}) {
  const onToggle = vi.fn<(enabled: boolean) => string | undefined>(() => refusal);
  const onEdit = vi.fn();
  const onCopy = vi.fn(() => Promise.resolve(copies));
  const onRemove = vi.fn();
  render(
    <ul role="list">
      <SkillRow
        skill={skill}
        labels={labels}
        onToggle={onToggle}
        onEdit={onEdit}
        onCopy={onCopy}
        onRemove={onRemove}
      />
    </ul>,
  );
  return { user: userEvent.setup(), onToggle, onEdit, onCopy, onRemove };
}

describe('SkillRow', () => {
  it('names its switch for the skill, and says which words turn it on', () => {
    setup();
    const row = screen.getByRole('listitem');
    expect(screen.getByRole('switch', { name: 'Use Brand voice' })).toBeChecked();
    expect(row).toHaveAttribute('data-enabled');
    expect(row).toHaveTextContent('Brand voice');
    expect(row).toHaveTextContent('When a request mentions copy, headline, button');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says an every-request skill is used in every request', () => {
    setup({ skill: HOUSE_STYLE });
    expect(screen.getByRole('listitem')).toHaveTextContent(EN.skills.always);
  });

  it('marks a skill that is off', () => {
    setup({ skill: SEASONAL_MENU });
    expect(screen.getByRole('switch', { name: 'Use Seasonal menu' })).not.toBeChecked();
    expect(screen.getByRole('listitem')).not.toHaveAttribute('data-enabled');
  });

  it('turns the skill off and on through onToggle', async () => {
    const { user, onToggle } = setup();
    await user.click(screen.getByRole('switch', { name: 'Use Brand voice' }));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says why when the switch is refused', async () => {
    const { user, onToggle } = setup({
      skill: SEASONAL_MENU,
      refusal: EN.editor.refusals.alwaysBudget,
    });
    await user.click(screen.getByRole('switch', { name: 'Use Seasonal menu' }));
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(screen.getByRole('alert')).toHaveTextContent(EN.editor.refusals.alwaysBudget);
  });

  it('Edit opens the skill', async () => {
    const { user, onEdit } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit Brand voice' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('Copy says Copied once the clipboard has the SKILL.md', async () => {
    const { user, onCopy } = setup();
    await user.click(screen.getByRole('button', { name: 'Copy Brand voice as SKILL.md' }));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: EN.skills.copied })).toBeInTheDocument();
  });

  it('Copy keeps its name when the clipboard refused', async () => {
    const { user, onCopy } = setup({ copies: false });
    const copy = screen.getByRole('button', { name: 'Copy Brand voice as SKILL.md' });
    await user.click(copy);
    await vi.waitFor(() => {
      expect(onCopy).toHaveBeenCalledTimes(1);
    });
    expect(copy).toHaveAccessibleName('Copy Brand voice as SKILL.md');
  });

  it('Delete asks once more: the first press arms it, the second deletes', async () => {
    const { user, onRemove } = setup();
    const remove = screen.getByRole('button', { name: 'Delete Brand voice' });
    expect(remove).not.toHaveAttribute('data-confirming');
    await user.click(remove);
    expect(remove).toHaveAttribute('data-confirming');
    expect(remove).toHaveAccessibleName('Delete Brand voice?');
    expect(onRemove).not.toHaveBeenCalled();
    await user.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('leaving an armed Delete disarms it', async () => {
    const { user, onRemove } = setup();
    const remove = screen.getByRole('button', { name: 'Delete Brand voice' });
    await user.click(remove);
    expect(remove).toHaveAttribute('data-confirming');
    await user.tab();
    expect(remove).not.toHaveAttribute('data-confirming');
    expect(remove).toHaveAccessibleName('Delete Brand voice');
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('speaks Arabic: the switch, the line and every action', () => {
    setup({ skill: SAMPLE_SKILLS_AR[0]!, labels: AR });
    expect(screen.getByRole('switch', { name: 'استخدم نبرة العلامة' })).toBeChecked();
    expect(screen.getByRole('listitem')).toHaveTextContent('حين يذكر الطلب نص، عنوان');
    expect(screen.getByRole('button', { name: 'عدّل نبرة العلامة' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'انسخ نبرة العلامة كملف SKILL.md' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'احذف نبرة العلامة' })).toBeInTheDocument();
  });

  it('arms Delete in Arabic too', async () => {
    const { user } = setup({ skill: SAMPLE_SKILLS_AR[1]!, labels: AR });
    expect(screen.getByRole('listitem')).toHaveTextContent(AR.skills.always);
    const remove = screen.getByRole('button', { name: 'احذف أسلوب المنزل' });
    await user.click(remove);
    expect(remove).toHaveAttribute('data-confirming');
    expect(remove).toHaveAccessibleName('احذف أسلوب المنزل؟');
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
