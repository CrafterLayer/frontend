import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { createCraftkitAiSkillRegistry } from '@craftkit/builder';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { builtInSkillViews } from '../../model/builtin-skills';
import type { Locale } from '../../model/view-types';

import { BuiltInSkillsList } from './BuiltInSkillsList';

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The Skills tab the list lives in: theme, language, direction and the `agent` container. */
const inTab: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 380 } = (parameters['panel'] ?? {}) as Frame;
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

const SKILLS = createCraftkitAiSkillRegistry().list();

interface ListProps {
  readonly locale: Locale;
  /** Built-ins switched off when the story opens. */
  readonly off: readonly string[];
  /** Open the disclosure on mount. */
  readonly open: boolean;
  readonly onToggle: (id: string, enabled: boolean) => void;
  readonly onReset: () => void;
}

/** The list with its switches live, as the knowledge hook keeps them. */
function List({ locale, off, open, onToggle, onReset }: ListProps) {
  const [disabled, setDisabled] = useState(off);
  return (
    <BuiltInSkillsList
      skills={builtInSkillViews(SKILLS, locale, disabled)}
      labels={knowledgeLabels(locale).builtInSkills}
      defaultOpen={open}
      onToggle={(id, enabled) => {
        onToggle(id, enabled);
        setDisabled((current) =>
          enabled ? current.filter((entry) => entry !== id) : [...current, id],
        );
      }}
      onReset={() => {
        onReset();
        setDisabled([]);
      }}
    />
  );
}

const EN = knowledgeLabels('en').builtInSkills;
const AR = knowledgeLabels('ar').builtInSkills;
const SWITCHABLE = builtInSkillViews(SKILLS, 'en', []).filter((skill) => !skill.locked).length;

const meta = {
  title: 'Agent/Knowledge/BuiltInSkillsList',
  component: List,
  parameters: { layout: 'centered' },
  args: { locale: 'en', off: [], open: true, onToggle: fn(), onReset: fn() },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [inTab],
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

const RTL = { args: { locale: 'ar' }, globals: { direction: 'rtl' } } as const;

/** Every built-in on, by group; the engine's own close the list as "Always on". */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(EN.count(SWITCHABLE, SWITCHABLE))).toBeVisible();
    await expect(canvas.getAllByRole('switch')).toHaveLength(SWITCHABLE);
    await expect(canvas.getByRole('region', { name: EN.groups.always })).toBeVisible();
  },
};

/** Closed, as the Skills tab first shows it: the title and its count. */
export const Closed: Story = {
  args: { open: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText(EN.title(SWITCHABLE + 4)));
    await expect(canvas.getByText(EN.intro)).toBeVisible();
  },
};

export const Dark: Story = { parameters: { panel: { theme: 'dark' } } };

export const RightToLeft: Story = {
  ...RTL,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(AR.count(SWITCHABLE, SWITCHABLE))).toBeVisible();
    await expect(canvas.getByRole('switch', { name: AR.use('شعار أصيل') })).toBeVisible();
  },
};

export const DarkRightToLeft: Story = { ...RTL, parameters: { panel: { theme: 'dark' } } };

/** Two switched off: they read softer, the count says so, and a switch turns one back on. */
export const SomeOff: Story = {
  args: { off: ['craftkit.data-viz', 'craftkit.logo-design'] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(EN.count(SWITCHABLE - 2, SWITCHABLE))).toBeVisible();
    await userEvent.click(canvas.getByRole('switch', { name: EN.use('Charts and tables') }));
    await expect(args.onToggle).toHaveBeenCalledWith('craftkit.data-viz', true);
    await expect(canvas.getByText(EN.count(SWITCHABLE - 1, SWITCHABLE))).toBeVisible();
  },
};

/** The filter narrows the groups to what matches. */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', { name: EN.filter }), 'game');
    await expect(
      canvas.getByRole('switch', { name: EN.use('Pixi: playable 2D games') }),
    ).toBeVisible();
    await expect(canvas.queryByRole('region', { name: EN.groups.language })).toBeNull();
  },
};

/** Nothing matches the filter. */
export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', { name: EN.filter }), 'zzz');
    await expect(canvas.getByText(EN.noMatch)).toBeVisible();
  },
};

/** "Reset to defaults" turns every built-in back on. */
export const Reset: Story = {
  args: { off: ['craftkit.data-viz', 'craftkit.pixi-games', 'craftkit.arabic-rtl'] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: EN.reset }));
    await expect(args.onReset).toHaveBeenCalled();
    await expect(canvas.getByText(EN.count(SWITCHABLE, SWITCHABLE))).toBeVisible();
  },
};

/** The narrowest panel: rows truncate, the filter and Reset wrap. */
export const Narrow: Story = { parameters: { panel: { width: 300 } } };
