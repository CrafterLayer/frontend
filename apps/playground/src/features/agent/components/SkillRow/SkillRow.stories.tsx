import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import type { UserSkill } from '../../model/user-skills';
import type { Locale } from '../../model/view-types';
import { SAMPLE_SKILLS, SAMPLE_SKILLS_AR } from '../../testing/knowledge-fixtures';

import { SkillRow } from './SkillRow';

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * The Skills tab's list the row lives in, inside a panel root: theme, language, direction
 * and the `agent` inline-size container, on the popover's Sheet.
 */
const inList: Decorator = (Story, { parameters }) => {
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
      <ul className="ck-agent-kn-list" role="list">
        <Story />
      </ul>
    </div>
  );
};

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');
const [BRAND_VOICE, HOUSE_STYLE, SEASONAL_MENU] = SAMPLE_SKILLS as readonly [
  UserSkill,
  UserSkill,
  UserSkill,
];
const [BRAND_VOICE_AR, HOUSE_STYLE_AR] = SAMPLE_SKILLS_AR as readonly [UserSkill, UserSkill];

const meta = {
  title: 'Agent/Knowledge/SkillRow',
  component: SkillRow,
  parameters: { layout: 'centered' },
  args: {
    skill: BRAND_VOICE,
    labels: EN,
    onToggle: fn<(enabled: boolean) => string | undefined>(() => undefined),
    onEdit: fn(),
    onCopy: fn(() => Promise.resolve(true)),
    onRemove: fn(),
  },
  argTypes: { labels: { control: false } },
  decorators: [inList],
} satisfies Meta<typeof SkillRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const ARABIC = {
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
} as const;

/** On, turned on by its words: the switch, the line, Edit, Copy and Delete. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('switch', { name: 'Use Brand voice' })).toBeChecked();
    await expect(canvas.getByRole('button', { name: 'Edit Brand voice' })).toBeVisible();
  },
};

/** Used in every request. */
export const EveryRequest: Story = {
  args: { skill: HOUSE_STYLE },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(EN.skills.always)).toBeVisible();
  },
};

/** Off: the switch is clear. */
export const Off: Story = {
  args: { skill: SEASONAL_MENU },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('switch', { name: 'Use Seasonal menu' }),
    ).not.toBeChecked();
  },
};

/** Turning it on is refused (the every-request budget): the row says why. */
export const Refused: Story = {
  args: {
    skill: SEASONAL_MENU,
    onToggle: fn<(enabled: boolean) => string | undefined>(() => EN.editor.refusals.alwaysBudget),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('switch', { name: 'Use Seasonal menu' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(EN.editor.refusals.alwaysBudget);
    await expect(canvas.getByRole('alert')).toBeVisible();
  },
};

/** Delete asks once more, in the Alarm colour, before anything goes. */
export const ConfirmingDelete: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const remove = canvas.getByRole('button', { name: 'Delete Brand voice' });
    await userEvent.click(remove);
    await expect(remove).toHaveAttribute('data-confirming');
    await expect(remove).toHaveAccessibleName('Delete Brand voice?');
    await expect(args.onRemove).not.toHaveBeenCalled();
  },
};

/** Copied as SKILL.md: the button says so. */
export const Copied: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copy Brand voice as SKILL.md' }));
    await expect(await canvas.findByRole('button', { name: EN.skills.copied })).toBeVisible();
    await expect(args.onCopy).toHaveBeenCalledTimes(1);
  },
};

export const Dark: Story = {
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('switch', { name: 'Use Brand voice' }),
    ).toBeVisible();
  },
};

export const OffDark: Story = {
  args: { skill: SEASONAL_MENU },
  parameters: { panel: { theme: 'dark' } },
};

export const RightToLeft: Story = {
  ...ARABIC,
  args: { skill: BRAND_VOICE_AR, labels: AR },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('switch', { name: 'استخدم نبرة العلامة' })).toBeChecked();
    await expect(canvas.getByRole('button', { name: 'احذف نبرة العلامة' })).toBeVisible();
  },
};

export const RefusedRightToLeft: Story = {
  ...ARABIC,
  args: {
    skill: { ...HOUSE_STYLE_AR, enabled: false },
    labels: AR,
    onToggle: fn<(enabled: boolean) => string | undefined>(() => AR.editor.refusals.alwaysBudget),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('switch', { name: 'استخدم أسلوب المنزل' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(AR.editor.refusals.alwaysBudget);
  },
};

export const DarkRightToLeft: Story = {
  ...ARABIC,
  args: { skill: HOUSE_STYLE_AR, labels: AR },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(AR.skills.always)).toBeVisible();
  },
};
