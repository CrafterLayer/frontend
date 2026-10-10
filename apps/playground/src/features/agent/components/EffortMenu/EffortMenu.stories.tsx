import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { AgentTooltipProvider } from '../IconButton';

import { EffortMenu } from './EffortMenu';

const meta = {
  title: 'Agent/Composer/EffortMenu',
  component: EffortMenu,
  args: {
    locale: 'en',
    effort: { selected: 'medium', options: ['low', 'medium', 'high', 'xhigh', 'max'] },
    onEffortChange: fn(),
  },
  decorators: [
    (Story, { args, parameters }) => (
      <div
        className="bldr-root ck-agent"
        lang={args.locale}
        dir={args.locale === 'ar' ? 'rtl' : 'ltr'}
        data-bldr-theme={parameters['dark'] === true ? 'dark' : 'light'}
        style={{ padding: 24, background: 'var(--bldr-panel)' }}
      >
        <AgentTooltipProvider>
          <Story />
        </AgentTooltipProvider>
      </div>
    ),
  ],
} satisfies Meta<typeof EffortMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const High: Story = { args: { effort: { ...meta.args.effort, selected: 'high' } } };
export const ArabicDark: Story = { args: { locale: 'ar' }, parameters: { dark: true } };
export const ChooseWithKeyboard: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Thinking: Medium' }));
    await userEvent.keyboard('{Home}{Enter}');
    await expect(args.onEffortChange).toHaveBeenCalledWith('low');
  },
};
