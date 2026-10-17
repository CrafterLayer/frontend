import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';

import { AgentStatusPill } from './AgentStatusPill';

interface Frame {
  readonly theme?: 'light' | 'dark';
}

/** The editor's status bar the pill sits in: 32px, Sheet, a Hairline on top. */
const inStatusBar: Decorator = (Story, { parameters }) => {
  const { theme = 'light' } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="bldr-root"
      data-bldr-theme={theme}
      style={{
        display: 'flex',
        alignItems: 'center',
        inlineSize: 720,
        blockSize: 'var(--bldr-statusbar-height)',
        paddingInline: 'var(--bldr-space-md)',
        borderBlockStart: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
        background: 'var(--bldr-surface)',
      }}
    >
      <Story />
    </div>
  );
};

const meta = {
  title: 'Agent/Panel/AgentStatusPill',
  component: AgentStatusPill,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    view: { kind: 'building', done: 3, total: 8 },
    face: { mood: 'working', typing: false },
    onOpen: fn(),
  },
  decorators: [inStatusBar],
} satisfies Meta<typeof AgentStatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A live run: Stop is in reach. */
const LIVE = { onStop: fn() } as const;

export const Building: Story = {
  args: LIVE,
  play: async ({ canvasElement, args }) => {
    const bar = within(canvasElement);
    await userEvent.click(bar.getByRole('button', { name: 'Abu Ghadab is building the page, 3 of 8' }));
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
    await userEvent.click(bar.getByRole('button', { name: t('en', 'stop') }));
    await expect(args.onStop).toHaveBeenCalledTimes(1);
    // 28px, never taller than the bar it sits in.
    const pill = canvasElement.querySelector('.ck-agent-pill');
    await expect(pill?.getBoundingClientRect().height).toBe(28);
  },
};

export const BuildingArabic: Story = {
  args: { ...LIVE, locale: 'ar' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'أبو غضب يبني الصفحة، 3 من 8' }),
    ).toBeVisible();
  },
};

export const BuildingArabicDark: Story = {
  args: { ...LIVE, locale: 'ar' },
  parameters: { panel: { theme: 'dark' } },
};

export const Editing: Story = { args: { ...LIVE, view: { kind: 'editing', target: 'Hero' } } };
export const EditingArabic: Story = {
  args: { ...LIVE, locale: 'ar', view: { kind: 'editing', target: 'الواجهة' } },
};
export const Working: Story = { args: { ...LIVE, view: { kind: 'working' } } };
export const Stopping: Story = { args: { ...LIVE, view: { kind: 'working' }, stopping: true } };

/** A whole build that landed while the panel was hidden: nothing left to stop. */
export const Done: Story = {
  args: { view: { kind: 'done', sections: 8 }, face: { mood: 'done', typing: false } },
};
export const DoneArabic: Story = {
  args: {
    locale: 'ar',
    view: { kind: 'done', sections: 8 },
    face: { mood: 'done', typing: false },
  },
};
