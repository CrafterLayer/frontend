import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { t } from '../../copy';

import { WorkerMenu } from './WorkerMenu';

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
  title: 'Agent/Composer/WorkerMenu',
  component: WorkerMenu,
  parameters: { layout: 'centered' },
  decorators: [inPanel],
  args: { locale: 'en', value: 3, running: false, onChange: fn() },
} satisfies Meta<typeof WorkerMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Balanced: Story = {
  play: async ({ canvasElement, args }) => {
    const select = within(canvasElement).getByRole('combobox', { name: t('en', 'workers.label') });
    await userEvent.selectOptions(select, '6');
    await expect(args.onChange).toHaveBeenCalledWith(6);
  },
};
export const Sequential: Story = { args: { value: 1 } };
export const SixWorkers: Story = { args: { value: 6 } };
export const LockedDuringRun: Story = {
  args: { running: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox')).toBeDisabled();
  },
};
export const NarrowRightToLeftDark: Story = {
  args: { locale: 'ar' },
  parameters: { theme: 'dark', width: 248 },
};
