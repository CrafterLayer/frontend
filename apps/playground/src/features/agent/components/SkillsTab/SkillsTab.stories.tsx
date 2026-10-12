import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import type { Fetcher } from '../../model/skill-link';
import { skillTemplates, type SkillTemplate } from '../../model/skill-templates';
import type { UserSkill } from '../../model/user-skills';
import type { Locale } from '../../model/view-types';
import { SAMPLE_SKILLS, SAMPLE_SKILLS_AR, seededStorage } from '../../testing/knowledge-fixtures';

import { SkillsTab } from './SkillsTab';

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * The popover's tab panel, inside a panel root: theme, the story's language and direction,
 * and the `agent` inline-size container, on the popover's Sheet.
 */
const inPanel: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 384 } = (parameters['panel'] ?? {}) as Frame;
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

interface LiveSkillsProps {
  readonly locale: Locale;
  /** What the browser's storage holds when the tab mounts. */
  readonly skills: readonly UserSkill[];
  readonly clipboard: (text: string) => Promise<void>;
  /** Starter skills, as KnowledgePopover passes them (`skillTemplates(locale)`). */
  readonly templates?: readonly SkillTemplate[];
  /** What answers a skill link (a stand-in: stories never reach the network). */
  readonly fetcher?: Fetcher;
}

/** The tab over the real stores (`useAgentKnowledge`), seeded as the browser would hold them. */
function LiveSkills({ locale, skills, clipboard, templates, fetcher }: LiveSkillsProps) {
  const [storage] = useState(() => seededStorage(skills));
  const { view } = useAgentKnowledge({ storage });
  return (
    <SkillsTab
      skills={view.skills}
      labels={knowledgeLabels(locale)}
      clipboard={clipboard}
      templates={templates}
      fetcher={fetcher}
    />
  );
}

/** A SKILL.mdx: imports and exports are not instructions; the meta object names the skill. */
const MDX = [
  "import { Callout } from './callout';",
  '',
  'export const meta = {',
  "  name: 'Tone of voice',",
  "  description: 'Every line of copy',",
  "  keywords: ['copy', 'headline'],",
  '};',
  '',
  '<Callout>Never use exclamation marks.</Callout>',
  '',
  'Write short, warm sentences.',
].join('\n');

/** Two every-request skills that cannot both be on: 5000 + 4000 > the 8000 budget. */
const OVER_BUDGET: readonly UserSkill[] = [
  {
    id: 'user.skill-1',
    name: 'Long house style',
    description: 'Every page',
    instructions: 'Use generous white space. '.repeat(200).slice(0, 5_000),
    keywords: [],
    mode: 'always',
    enabled: true,
  },
  {
    id: 'user.skill-2',
    name: 'Long tone guide',
    description: 'Every line of copy',
    instructions: 'Write short, warm sentences. '.repeat(150).slice(0, 4_000),
    keywords: [],
    mode: 'always',
    enabled: false,
  },
];

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');

const meta = {
  title: 'Agent/Knowledge/SkillsTab',
  component: LiveSkills,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    skills: SAMPLE_SKILLS,
    clipboard: fn(() => Promise.resolve()),
  },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [inPanel],
} satisfies Meta<typeof LiveSkills>;

export default meta;
type Story = StoryObj<typeof meta>;

const ARABIC = {
  args: { locale: 'ar', skills: SAMPLE_SKILLS_AR },
  globals: { direction: 'rtl' },
} as const;

/** Three skills of the person's own (one off), New skill and Import, and the built-ins. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The person's three, then the seven default skills in their own section.
    await expect(canvas.getAllByRole('switch')).toHaveLength(10);
    await expect(canvas.getByText('3 of 24')).toBeVisible();
    await expect(canvas.getByRole('region', { name: EN.defaults.title })).toBeVisible();
  },
};

/** None of their own yet: one quiet line, and the built-ins they already have. */
export const Empty: Story = {
  args: { skills: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(EN.skills.empty)).toBeVisible();
  },
};

/** New skill: the editor takes the tab's place. */
export const Editing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'New skill' }));
    await expect(canvas.getByRole('heading', { name: 'New skill' })).toBeVisible();
  },
};

/** Import: a SKILL.md pasted into one field. */
export const Importing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Import' }));
    await expect(canvas.getByRole('textbox', { name: EN.skills.importLabel })).toBeVisible();
  },
};

/** Imported: the front matter's name and mode, added to the list. */
export const Imported: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Import' }));
    await userEvent.click(canvas.getByRole('textbox', { name: EN.skills.importLabel }));
    await userEvent.paste(
      '---\nname: Booking band\nmode: always\n---\nEnd every page with the booking band.',
    );
    await userEvent.click(canvas.getByRole('button', { name: EN.skills.importSave }));
    await expect(canvas.getByRole('switch', { name: 'Use Booking band' })).toBeChecked();
  },
};

/** An import that cannot be read: the refusal line says why. */
export const ImportRefused: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Import' }));
    await userEvent.click(canvas.getByRole('button', { name: EN.skills.importSave }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(EN.editor.refusals.unreadable);
  },
};

/** Turning on a second long every-request skill: refused by the budget, in the row. */
export const Refused: Story = {
  args: { skills: OVER_BUDGET },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('switch', { name: 'Use Long tone guide' }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(EN.editor.refusals.alwaysBudget);
  },
};

/** The built-in skills, opened. */
export const BuiltIns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText(/^Built-in skills \(\d+\)$/u));
    await expect(canvas.getByText(EN.skills.builtInsHint)).toBeVisible();
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

export const RightToLeft: Story = {
  ...ARABIC,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('switch', { name: 'استخدم نبرة العلامة' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: AR.skills.add })).toBeVisible();
  },
};

export const EditingRightToLeft: Story = {
  ...ARABIC,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'عدّل نبرة العلامة' }));
    await expect(canvas.getByRole('heading', { name: AR.editor.editTitle })).toBeVisible();
  },
};

export const DarkRightToLeft: Story = {
  ...ARABIC,
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('2 من 24')).toBeVisible();
  },
};

/** "Start from a template", opened: each starter skill with its + button. */
export const Templates: Story = {
  args: { templates: skillTemplates('en') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText(EN.templates.title));
    const add = canvas.getByRole('button', { name: EN.templates.add('Accessible by default') });
    await expect(add).toBeVisible();
    await userEvent.click(add);
    await expect(canvas.getByRole('status')).toHaveTextContent(
      EN.templates.added('Accessible by default'),
    );
  },
};

export const TemplatesRightToLeft: Story = {
  ...ARABIC,
  args: { ...ARABIC.args, templates: skillTemplates('ar') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText(AR.templates.title));
    await expect(canvas.getAllByRole('button', { name: /^أضف /u }).length).toBeGreaterThan(0);
  },
};

/** Two files uploaded, one unreadable: the status line says what came in and what did not. */
export const Uploaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText<HTMLInputElement>(EN.upload.choose, { selector: 'input' });
    await userEvent.upload(input, [
      new File([MDX], 'tone.mdx', { type: 'text/mdx' }),
      new File(['  '], 'broken.md', { type: 'text/markdown' }),
    ]);
    // The status line speaks once every file has been read.
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('broken.md'));
    await expect(canvas.getByRole('status')).toHaveTextContent(EN.upload.imported(1));
    await expect(canvas.getByRole('switch', { name: 'Use Tone of voice' })).toBeVisible();
  },
};

/** A link pasted into Import: fetched into the box to read, then Add skill adds it. */
export const ImportFromLink: Story = {
  args: {
    skills: [],
    fetcher: (url) => {
      const response = new Response(MDX, { headers: { 'content-type': 'text/plain' } });
      Object.defineProperty(response, 'url', { value: url });
      return Promise.resolve(response);
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: EN.skills.import }));
    const box = canvas.getByRole('textbox', { name: EN.skills.importLabel });
    await userEvent.click(box);
    await userEvent.paste('https://github.com/acme/skills/blob/main/tone/SKILL.mdx');
    await userEvent.click(canvas.getByRole('button', { name: EN.link.fetch }));
    await waitFor(() => expect(box).toHaveValue(MDX));
    await expect(canvas.getByRole('status')).toHaveTextContent(
      EN.link.fetched('raw.githubusercontent.com'),
    );
  },
};
