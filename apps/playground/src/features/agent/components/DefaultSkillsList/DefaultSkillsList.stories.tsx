import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { defaultSkillViews, type DefaultSkillView } from '../../model/default-skills';
import type { Locale } from '../../model/view-types';

import { DefaultSkillsList } from './DefaultSkillsList';

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

interface ListProps {
  readonly locale: Locale;
  /** Defaults switched off when the story opens. */
  readonly off: readonly string[];
  readonly onMakeOwn: (skill: DefaultSkillView) => void;
}

/** The list with its switches live, as the knowledge hook keeps them. */
function List({ locale, off, onMakeOwn }: ListProps) {
  const [disabled, setDisabled] = useState(off);
  return (
    <DefaultSkillsList
      skills={defaultSkillViews(locale, disabled)}
      labels={knowledgeLabels(locale)}
      onToggle={(id, enabled) => {
        setDisabled((current) =>
          enabled ? current.filter((entry) => entry !== id) : [...current, id],
        );
      }}
      onMakeOwn={onMakeOwn}
    />
  );
}

const EN = knowledgeLabels('en').defaults;
const AR = knowledgeLabels('ar').defaults;

const meta = {
  title: 'Agent/Knowledge/DefaultSkillsList',
  component: List,
  parameters: { layout: 'centered' },
  args: { locale: 'en', off: [], onMakeOwn: fn() },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [inTab],
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

const RTL = { args: { locale: 'ar' }, globals: { direction: 'rtl' } } as const;

/** Every project starts with all seven on. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(EN.count(7, 7))).toBeVisible();
    await expect(canvas.getAllByRole('switch')).toHaveLength(7);
  },
};

export const Dark: Story = { parameters: { panel: { theme: 'dark' } } };

export const RightToLeft: Story = {
  ...RTL,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(AR.count(7, 7))).toBeVisible();
  },
};

export const DarkRightToLeft: Story = { ...RTL, parameters: { panel: { theme: 'dark' } } };

/** Two switched off: they read at reduced strength and the count says so. */
export const SomeOff: Story = {
  args: { off: ['craftkit.trust-proof', 'craftkit.pro-max-ux'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(EN.count(5, 7))).toBeVisible();
    await userEvent.click(canvas.getByRole('switch', { name: EN.use('Honest trust and proof') }));
    await expect(canvas.getByText(EN.count(6, 7))).toBeVisible();
  },
};

/** "What it teaches the Agent", open: the exact instructions, scrolling on their own. */
export const Teaches: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas
      .getByRole('switch', { name: EN.use('Design intelligence (UI UX Pro Max)') })
      .closest('li') as HTMLElement;
    await userEvent.click(within(row).getByText(EN.teaches));
    await expect(within(row).getByText(/DESIGN SYSTEM FIRST/u)).toBeVisible();
  },
};

/** "Make it my own" hands the default to New skill. */
export const MakeOwn: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: EN.own('Landing patterns that convert') }),
    );
    await expect(args.onMakeOwn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'craftkit.pro-max-landing' }),
    );
  },
};
