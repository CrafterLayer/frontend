import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import {
  checkSkillDraft,
  EMPTY_SKILL_DRAFT,
  type UserSkill,
  type UserSkillDraft,
} from '../../model/user-skills';
import type { UserSkillWrite } from '../../model/user-skills-store';
import type { Locale } from '../../model/view-types';
import { SAMPLE_SKILLS, SAMPLE_SKILLS_AR } from '../../testing/knowledge-fixtures';

import { SkillEditor } from './SkillEditor';

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * The popover's tab panel the editor fills, drawn as the panel draws its root: theme,
 * language, direction and the `agent` inline-size container, on the popover's Sheet.
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 360 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        background: 'var(--bldr-surface)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
        padding: 'var(--bldr-space-md)',
      }}
    >
      <Story />
    </div>
  );
};

/** The store's judgement over no other skills: a refusal keeps the editor open. */
function judged(draft: UserSkillDraft): UserSkillWrite {
  const check = checkSkillDraft(draft, []);
  return check.ok
    ? { ok: true, skill: { id: 'user.skill-1', ...check.draft, enabled: true } }
    : check;
}

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');
const [BRAND_VOICE, HOUSE_STYLE] = SAMPLE_SKILLS as readonly [UserSkill, UserSkill, UserSkill];
const [BRAND_VOICE_AR, HOUSE_STYLE_AR] = SAMPLE_SKILLS_AR as readonly [UserSkill, UserSkill];

const meta = {
  title: 'Agent/Knowledge/SkillEditor',
  component: SkillEditor,
  parameters: { layout: 'centered' },
  args: {
    labels: EN,
    initial: EMPTY_SKILL_DRAFT,
    editing: false,
    onSave: fn(judged),
    onCancel: fn(),
  },
  argTypes: { labels: { control: false }, initial: { control: false } },
  decorators: [inPanel],
} satisfies Meta<typeof SkillEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const ARABIC = {
  args: { labels: AR },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
} as const;

/** A new skill: empty fields, turned on by its words, the words field showing. */
export const New: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'New skill' })).toBeVisible();
    await expect(canvas.getByRole('textbox', { name: /^Words that turn it on/u })).toBeVisible();
  },
};

/** A kept skill, its fields filled, under "Edit skill". */
export const Editing: Story = {
  args: { initial: BRAND_VOICE, editing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Edit skill' })).toBeVisible();
    await expect(canvas.getByRole('textbox', { name: 'Name' })).toHaveValue('Brand voice');
  },
};

/** Used in every request: no words field. */
export const EveryRequest: Story = {
  args: { initial: HOUSE_STYLE, editing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('radio', { name: EN.editor.modeAlways })).toBeChecked();
    await expect(canvas.queryByRole('textbox', { name: /^Words that turn it on/u })).toBeNull();
  },
};

/** Save with no name: the store refuses, and the line above Save says why. */
export const Refused: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save skill' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(EN.editor.refusals.name);
    await expect(canvas.getByRole('alert')).toBeVisible();
  },
};

/** The every-request budget, refused by the store for an edit. */
export const RefusedBudget: Story = {
  args: {
    initial: HOUSE_STYLE,
    editing: true,
    onSave: fn<(draft: UserSkillDraft) => UserSkillWrite>(() => ({
      ok: false,
      reason: 'alwaysBudget',
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save skill' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(EN.editor.refusals.alwaysBudget);
  },
};

/** Typed and saved: the words split on Latin and Arabic commas. */
export const Saved: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'Name' }), 'Brand voice');
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Instructions' }),
      'Write short, warm sentences.',
    );
    await userEvent.type(
      canvas.getByRole('textbox', { name: /^Words that turn it on/u }),
      'copy, headline، نبرة',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Save skill' }));
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ['copy', 'headline', 'نبرة'] }),
    );
    await expect(canvas.getByRole('alert')).toBeEmptyDOMElement();
  },
};

export const Dark: Story = {
  args: { initial: BRAND_VOICE, editing: true },
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'Edit skill' })).toBeVisible();
  },
};

export const RightToLeft: Story = {
  ...ARABIC,
  args: { ...ARABIC.args, initial: BRAND_VOICE_AR, editing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'تعديل المهارة' })).toBeVisible();
    await expect(canvas.getByRole('textbox', { name: 'الاسم' })).toHaveValue('نبرة العلامة');
  },
};

export const RefusedRightToLeft: Story = {
  ...ARABIC,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'احفظ المهارة' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(AR.editor.refusals.name);
  },
};

export const DarkRightToLeft: Story = {
  ...ARABIC,
  args: { ...ARABIC.args, initial: HOUSE_STYLE_AR, editing: true },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('radio', { name: AR.editor.modeAlways }),
    ).toBeChecked();
  },
};
