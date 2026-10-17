import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { AssistantModes } from './AssistantModes';

const meta = {
  title: 'Playground/AssistantModes',
  component: AssistantModes,
  parameters: { layout: 'centered' },
  args: { mode: 'ask', onChange: fn(), busy: false, lockReasonId: 'lock', locale: 'ar' },
  argTypes: { onChange: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--bldr-panel)', padding: '1rem' }}>
        <Story />
        <p id="lock" className="pg-chat__mode-hint">
          Stop the request to change mode.
        </p>
      </div>
    ),
  ],
} satisfies Meta<typeof AssistantModes>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ask: propose, then wait for Apply. */
export const Ask: Story = {};

/** Auto: apply a validated plan immediately — still one atomic, undoable change. */
export const Auto: Story = { args: { mode: 'auto' } };

/** Plan: only plan. Nothing in the panel writes while this is chosen. */
export const Plan: Story = { args: { mode: 'plan' } };

/** A run is in flight: the authority was decided when it started. */
export const LockedWhileBusy: Story = { args: { busy: true, mode: 'auto' } };

/** Arabic: ArrowLeft is FORWARD, because the row reads right to left. */
export const ArabicArrows: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('radio', { name: 'Ask' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(args.onChange).toHaveBeenCalledWith('auto');
  },
};

/** English: ArrowRight is forward, and the ends wrap. */
export const EnglishArrows: Story = {
  args: { locale: 'en' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('radio', { name: 'Ask' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(args.onChange).toHaveBeenCalledWith('plan');
  },
};
