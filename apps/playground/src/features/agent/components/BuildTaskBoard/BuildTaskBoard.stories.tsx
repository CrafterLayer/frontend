import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { t } from '../../copy';
import { spineRows } from '../../testing/wp-12-records-fixtures';

import { BuildTaskBoard } from './BuildTaskBoard';

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

const inPanel: Decorator = (Story, { args, parameters }) => {
  const { theme = 'light', width = 288 } = parameters as Frame;
  const locale = args['locale'] === 'ar' ? 'ar' : 'en';
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        padding: 16,
        boxSizing: 'border-box',
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
      }}
    >
      <Story />
    </div>
  );
};

const meta = {
  title: 'Agent/Records/BuildTaskBoard',
  component: BuildTaskBoard,
  parameters: { layout: 'centered' },
  decorators: [inPanel],
  args: {
    locale: 'en',
    phase: 'building',
    writers: 3,
    rows: spineRows('en', ['landed', 'writing', 'retrying', 'drafted', 'waiting', 'failed']),
  },
} satisfies Meta<typeof BuildTaskBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(t('en', 'tasks.active', { n: 2 }))).toBeVisible();
    await expect(canvas.getByRole('progressbar')).toHaveAttribute('value', '1');
  },
};

export const Queued: Story = { args: { rows: spineRows('en', ['waiting', 'waiting', 'waiting']) } };
export const DraftsAwaitingLanding: Story = {
  args: { rows: spineRows('en', ['writing', 'drafted', 'drafted']) },
};
export const UnknownHistoricalPool: Story = { args: { writers: null } };
export const Empty: Story = { args: { phase: 'skeleton', rows: [] } };
export const Stopped: Story = {
  args: { phase: 'stopped', rows: spineRows('en', ['landed', 'notWritten', 'notWritten']) },
};
export const Failed: Story = {
  args: { phase: 'failed', rows: spineRows('en', ['landed', 'failed', 'notWritten']) },
};
export const NarrowRightToLeftDark: Story = {
  args: {
    locale: 'ar',
    writers: 6,
    rows: spineRows('ar', ['landed', 'writing', 'writing', 'drafted', 'waiting', 'failed']),
  },
  parameters: { theme: 'dark', width: 248 },
};
