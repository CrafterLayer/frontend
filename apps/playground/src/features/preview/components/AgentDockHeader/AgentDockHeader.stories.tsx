import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { AgentDockHeader } from './AgentDockHeader';

const meta = {
  title: 'Playground/AgentDockHeader',
  component: AgentDockHeader,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ inlineSize: 320 }}><Story /></div>],
  args: {
    face: { mood: 'idle', line: { key: 'idle' }, typing: false, since: 0 },
    conversations: [{ id: 'one', title: 'Landing page', turnCount: 2 }],
    activeId: 'one',
    onSelectConversation: () => undefined,
    onNewChat: () => undefined,
  },
} satisfies Meta<typeof AgentDockHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {};
export const Working: Story = {
  args: { face: { mood: 'thinking', line: { key: 'thinking', subject: 'Hero' }, typing: true, since: 0 } },
};
export const WithHistory: Story = {
  args: {
    conversations: [
      { id: 'one', title: 'Landing page', turnCount: 2 },
      { id: 'two', title: 'Pricing', turnCount: 5 },
    ],
  },
};
export const Rtl: Story = { args: { locale: 'ar' }, decorators: [(Story) => <div dir="rtl"><Story /></div>] };
