import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { QueuedRequestCard } from './QueuedRequestCard';

const meta = {
  title: 'Playground/QueuedRequestCard',
  component: QueuedRequestCard,
  decorators: [(Story) => <div style={{ inlineSize: 320 }}><Story /></div>],
  args: { request: 'Make the heading more direct', context: 'Home · Hero heading', onChange: () => undefined, onRemove: () => undefined },
} satisfies Meta<typeof QueuedRequestCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {};
export const Stale: Story = { args: { state: 'stale' } };
export const MissingTarget: Story = { args: { state: 'missing-target', context: 'Removed Hero heading' } };
export const PausedAfterStop: Story = { args: { paused: true, onRun: () => undefined } };
export const Rtl: Story = { args: { request: 'كبّر العنوان الرئيسي', context: 'الرئيسية · العنوان' }, decorators: [(Story) => <div dir="rtl"><Story /></div>] };
