import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import type { Suggestion } from '../AssistantPanel/AssistantPanel.suggestions';
import { SuggestionRail } from './SuggestionRail';

const MIXED: readonly Suggestion[] = [
  { id: 'followUp:كمل التنسيق والألوان', kind: 'followUp', text: 'كمل التنسيق والألوان' },
  {
    id: 'selection:rewrite the hero text to be clearer',
    kind: 'selection',
    text: 'rewrite the hero text to be clearer',
  },
  {
    id: 'example:قسم افتتاحي عربي لعيادة أسنان',
    kind: 'example',
    text: 'قسم افتتاحي عربي لعيادة أسنان',
  },
  {
    id: 'example:a premium hero for a SaaS company',
    kind: 'example',
    text: 'a premium hero for a SaaS company',
  },
];

const meta = {
  title: 'Playground/SuggestionRail',
  component: SuggestionRail,
  parameters: { layout: 'centered' },
  args: { suggestions: MIXED, layout: 'rail', busy: false, onPick: fn() },
  argTypes: { onPick: { control: false }, suggestions: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SuggestionRail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In conversation: one row, scrolled sideways, at a fixed height. */
export const Rail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('list', { name: 'Suggestions' });
    await userEvent.click(canvas.getByRole('button', { name: 'Next suggestions' }));
    await waitFor(() => expect(list.scrollLeft).toBeGreaterThan(0));
    await userEvent.click(canvas.getByRole('button', { name: 'Previous suggestions' }));
    await waitFor(() => expect(Math.abs(list.scrollLeft)).toBeLessThan(2));
  },
};

/** An empty panel: nothing to crowd, so the suggestions are full-width targets. */
export const Stack: Story = { args: { layout: 'stack' } };

/** While the assistant works: present, holding its height, not pressable. */
export const Busy: Story = { args: { busy: true } };

/** Arabic: the rail mirrors, and each chip still declares its own language. */
export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)' }}>
        <Story />
      </div>
    ),
  ],
};

/** Pressing a chip sends its sentence unchanged. */
export const PickSendsTheSentence: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'كمل التنسيق والألوان' }));
    await expect(args.onPick).toHaveBeenCalledWith('كمل التنسيق والألوان');
  },
};
