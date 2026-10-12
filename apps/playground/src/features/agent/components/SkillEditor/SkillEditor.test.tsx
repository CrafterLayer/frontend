/**
 * SkillEditor (2026-10-12): writing one of the person's skills — its name, when to use it,
 * the instructions and how it turns on. Saving goes through the store's own judgement
 * (`createUserSkillsStore`), so the refusal lines asserted here are the ones a person sees:
 * one alert line above Save, in the panel's language, never the browser's own bubble.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { knowledgeLabels, type KnowledgeLabels } from '../../copy/knowledge-labels';
import { EMPTY_SKILL_DRAFT, type UserSkillDraft } from '../../model/user-skills';
import { createUserSkillsStore, type UserSkillWrite } from '../../model/user-skills-store';
import { SAMPLE_SKILLS, SAMPLE_SKILLS_AR } from '../../testing/knowledge-fixtures';

import { SkillEditor } from './SkillEditor';

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'SkillEditor', 'SkillEditor.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

interface Setup {
  readonly labels?: KnowledgeLabels;
  readonly initial?: UserSkillDraft;
  readonly editing?: boolean;
  readonly onSave?: (draft: UserSkillDraft) => UserSkillWrite;
}

/** The editor over a real, empty skills store: its `add` judges every save. */
function setup({ labels = EN, initial = EMPTY_SKILL_DRAFT, editing, onSave }: Setup = {}) {
  const store = createUserSkillsStore(undefined);
  const save = vi.fn(onSave ?? store.add);
  const cancel = vi.fn();
  render(
    <SkillEditor
      labels={labels}
      initial={initial}
      editing={editing}
      onSave={save}
      onCancel={cancel}
    />,
  );
  return { user: userEvent.setup(), save, cancel, store };
}

function field(name: string | RegExp): HTMLElement {
  return screen.getByRole('textbox', { name });
}

describe('SkillEditor', () => {
  it('opens a new skill under its title, turned on by its words, with the words field', () => {
    setup();
    expect(screen.getByRole('form', { name: EN.editor.newTitle })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New skill' })).toBeInTheDocument();
    expect(field('Name')).toBeRequired();
    expect(field('When to use it')).not.toBeRequired();
    expect(field('Instructions')).toBeRequired();
    expect(screen.getByRole('radio', { name: EN.editor.modeAuto })).toBeChecked();
    expect(screen.getByRole('radio', { name: EN.editor.modeAlways })).not.toBeChecked();
    expect(field(/^Words that turn it on/u)).toHaveAccessibleDescription(EN.editor.keywordsHint);
    expect(screen.getByText(EN.editor.length(0))).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  it('refuses a skill with no name, then one with no instructions, then one with no words', async () => {
    const { user, save } = setup();
    const alert = screen.getByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    // The form never blocks on `required`: the store answers, and the line says why.
    expect(save).toHaveBeenCalledTimes(1);
    expect(alert).toHaveTextContent(EN.editor.refusals.name);

    await user.type(field('Name'), 'Brand voice');
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    expect(alert).toHaveTextContent(EN.editor.refusals.instructions);

    await user.type(field('Instructions'), 'Write short, warm sentences.');
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    expect(alert).toHaveTextContent(EN.editor.refusals.keywords);
    expect(screen.getByRole('heading', { name: 'New skill' })).toBeInTheDocument();
  });

  it('hides the words field for a skill used in every request, and brings it back', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: EN.editor.modeAlways }));
    expect(screen.queryByRole('textbox', { name: /^Words that turn it on/u })).toBeNull();
    await user.click(screen.getByRole('radio', { name: EN.editor.modeAuto }));
    expect(field(/^Words that turn it on/u)).toBeInTheDocument();
  });

  it('saves a draft whose words are split on Latin and Arabic commas', async () => {
    const { user, save, store } = setup();
    await user.type(field('Name'), 'Brand voice');
    await user.type(field('When to use it'), 'Every line of copy');
    await user.type(field('Instructions'), 'Write short, warm sentences.');
    await user.type(field(/^Words that turn it on/u), 'copy, headline، نبرة');
    expect(screen.getByText(EN.editor.length(28))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    expect(save).toHaveBeenCalledWith({
      name: 'Brand voice',
      description: 'Every line of copy',
      instructions: 'Write short, warm sentences.',
      keywords: ['copy', 'headline', 'نبرة'],
      mode: 'auto',
    });
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    expect(store.get()).toHaveLength(1);
  });

  it('saves an every-request skill with no words', async () => {
    const { user, save } = setup();
    await user.type(field('Name'), 'House style');
    await user.type(field('Instructions'), 'Generous white space.');
    await user.click(screen.getByRole('radio', { name: EN.editor.modeAlways }));
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ mode: 'always', keywords: [] }));
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  it('says the refusal the store gives, such as the every-request budget', async () => {
    const { user } = setup({
      initial: SAMPLE_SKILLS[1]!,
      editing: true,
      onSave: () => ({ ok: false, reason: 'alwaysBudget' }),
    });
    await user.click(screen.getByRole('button', { name: 'Save skill' }));
    expect(screen.getByRole('alert')).toHaveTextContent(EN.editor.refusals.alwaysBudget);
  });

  it('Cancel leaves without saving', async () => {
    const { user, save, cancel } = setup();
    await user.type(field('Name'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('edits a kept skill under "Edit skill", its fields filled', () => {
    const skill = SAMPLE_SKILLS[0]!;
    setup({ initial: skill, editing: true });
    expect(screen.getByRole('heading', { name: 'Edit skill' })).toBeInTheDocument();
    expect(field('Name')).toHaveValue(skill.name);
    expect(field('When to use it')).toHaveValue(skill.description);
    expect(field('Instructions')).toHaveValue(skill.instructions);
    expect(field(/^Words that turn it on/u)).toHaveValue('copy, headline, button');
    expect(screen.getByText(EN.editor.length(skill.instructions.length))).toBeInTheDocument();
  });

  it('opens an every-request skill without its words field', () => {
    setup({ initial: SAMPLE_SKILLS[1]!, editing: true });
    expect(screen.getByRole('radio', { name: EN.editor.modeAlways })).toBeChecked();
    expect(screen.queryByRole('textbox', { name: /^Words that turn it on/u })).toBeNull();
  });

  it('speaks Arabic: its title, fields and refusal line', async () => {
    const { user } = setup({ labels: AR });
    expect(screen.getByRole('heading', { name: 'مهارة جديدة' })).toBeInTheDocument();
    expect(field('الاسم')).toBeRequired();
    expect(field('التعليمات')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: AR.editor.modeAuto })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'احفظ المهارة' }));
    expect(screen.getByRole('alert')).toHaveTextContent('أعطِ المهارة اسمًا.');
    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeInTheDocument();
  });

  it('edits an Arabic skill under its Arabic title', () => {
    setup({ labels: AR, initial: SAMPLE_SKILLS_AR[0]!, editing: true });
    expect(screen.getByRole('heading', { name: 'تعديل المهارة' })).toBeInTheDocument();
    expect(field('الاسم')).toHaveValue('نبرة العلامة');
    expect(field(/^الكلمات التي تشغّلها/u)).toHaveValue('نص, عنوان');
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
