import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import type { BuildTask } from '../AssistantPanel/AssistantPanel.build';
import { BuildApprovalCard } from './BuildApprovalCard';

const task = (position: number, title: string): BuildTask => ({
  id: `t${String(position)}`,
  position,
  title,
  status: 'waiting',
  attempts: 0,
});

const FIVE = [
  task(1, 'Hero'),
  task(2, 'Services'),
  task(3, 'Team'),
  task(4, 'Testimonials'),
  task(5, 'Contact'),
];

const meta = {
  title: 'Playground/BuildApprovalCard',
  component: BuildApprovalCard,
  parameters: { layout: 'centered' },
  args: {
    direction: 'A calm clinic page: one clear promise, six services, and a booking line that works on a phone.',
    tasks: FIVE,
    turnId: 'story',
    onAnswer: fn(),
  },
  argTypes: { tasks: { control: false }, onAnswer: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BuildApprovalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The one question, with the direction it decided and the sections it would write. */
export const Default: Story = {};

/** Arabic: the direction reads in the language the scaffold answered in. */
export const Arabic: Story = {
  args: {
    direction:
      'صفحة عيادة أسنان هادئة: وعد واحد واضح، ستّ خدمات، وسطر حجز يعمل على الهاتف.',
    tasks: [task(1, 'الافتتاحية'), task(2, 'الخدمات'), task(3, 'تواصل')],
  },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
};

/** A two-section page: the count is the page's, not a constant. */
export const TwoSections: Story = { args: { tasks: [task(1, 'Hero'), task(2, 'Contact')] } };

/** Pressing Build answers once. */
export const Approve: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Build' }));
    await expect(args.onAnswer).toHaveBeenCalledWith('build');
  },
};

/** Refusing is one press too — the build does not ask again. */
export const Refuse: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Stop build' }));
    await expect(args.onAnswer).toHaveBeenCalledWith('stop');
  },
};
